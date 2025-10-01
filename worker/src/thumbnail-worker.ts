/**
 * Thumbnail Generation Worker - Generates thumbnail images from videos
 */
import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { FFmpegExecutor } from './ffmpeg-executor.js';
import { probeVideo } from './ffprobe.js';
import Redis from 'ioredis';
import path from 'path';

const prisma = new PrismaClient();

// Redis connection
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const redis = new Redis(redisConnection);

/**
 * Generate FFmpeg command for thumbnail extraction
 */
function generateThumbnailCommand(options: {
  inputFile: string;
  outputFile: string;
  timestamp: string;
  width: number;
}): string[] {
  const { inputFile, outputFile, timestamp, width } = options;

  return [
    'ffmpeg',
    '-ss', timestamp,              // Seek to timestamp
    '-i', inputFile,
    '-vframes', '1',               // Extract 1 frame
    '-vf', `scale=${width}:-1`,    // Scale to width, maintain aspect ratio
    '-q:v', '2',                   // High quality JPEG
    '-y',
    outputFile,
  ];
}

/**
 * Calculate evenly distributed timestamps for auto-thumbnails
 */
function calculateTimestamps(duration: number, count: number): string[] {
  const timestamps: string[] = [];
  const interval = duration / (count + 1);

  for (let i = 1; i <= count; i++) {
    const seconds = interval * i;
    timestamps.push(seconds.toFixed(2));
  }

  return timestamps;
}

export function startThumbnailWorker() {
  const worker = new Worker(
    'thumbnail-generation',
    async (job: Job) => {
      const { jobId, inputFile, timestamps, count, width } = job.data;

      console.log(
        `[Thumbnail Worker] Starting job ${jobId}: ${count} thumbnails at ${width}px`
      );

      try {
        // Update job status to processing
        await prisma.thumbnailJob.update({
          where: { id: jobId },
          data: {
            status: 'processing',
            startedAt: new Date(),
            progress: 0,
          },
        });

        // If timestamps not provided, calculate them based on video duration
        let thumbTimestamps = timestamps;
        if (!thumbTimestamps) {
          console.log(`[Thumbnail Worker] Probing video to calculate timestamps...`);
          const metadata = await probeVideo(inputFile);
          thumbTimestamps = calculateTimestamps(metadata.duration, count);
          console.log(`[Thumbnail Worker] Generated timestamps: ${thumbTimestamps.join(', ')}`);
        }

        // Generate output directory
        const outputDir = path.dirname(inputFile);
        const baseFileName = path.basename(inputFile, path.extname(inputFile));
        const outputFiles: string[] = [];

        const executor = new FFmpegExecutor();

        // Generate each thumbnail
        for (let i = 0; i < thumbTimestamps.length; i++) {
          const timestamp = thumbTimestamps[i];
          const outputFile = path.join(outputDir, `${baseFileName}_thumb_${i + 1}.jpg`);

          console.log(`[Thumbnail Worker] Generating thumbnail ${i + 1}/${thumbTimestamps.length} at ${timestamp}s`);

          const command = generateThumbnailCommand({
            inputFile,
            outputFile,
            timestamp,
            width,
          });

          await executor.execute({
            command,
            onProgress: async (progress) => {
              // Calculate overall progress across all thumbnails
              const baseProgress = (i / thumbTimestamps.length) * 100;
              const thumbProgress = (progress / thumbTimestamps.length);
              const overallProgress = baseProgress + thumbProgress;

              await prisma.thumbnailJob.update({
                where: { id: jobId },
                data: { progress: overallProgress },
              });

              await redis.publish(
                `thumbnail:progress:${jobId}`,
                JSON.stringify({ jobId, progress: overallProgress, status: 'processing', current: i + 1, total: thumbTimestamps.length })
              );
            },
          });

          outputFiles.push(outputFile);
          console.log(`[Thumbnail Worker] Thumbnail ${i + 1} created: ${outputFile}`);
        }

        // Update job to completed
        await prisma.thumbnailJob.update({
          where: { id: jobId },
          data: {
            status: 'completed',
            progress: 100,
            outputFiles: JSON.stringify(outputFiles),
            completedAt: new Date(),
          },
        });

        // Publish completion event
        await redis.publish(
          `thumbnail:progress:${jobId}`,
          JSON.stringify({ jobId, progress: 100, status: 'completed', outputFiles })
        );

        console.log(
          `[Thumbnail Worker] Job ${jobId} completed successfully! Generated ${outputFiles.length} thumbnails`
        );

        return { success: true, outputFiles };
      } catch (error: any) {
        console.error(`[Thumbnail Worker] Job ${jobId} failed:`, error);

        // Update job to failed
        await prisma.thumbnailJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          },
        });

        // Publish failure event
        await redis.publish(
          `thumbnail:progress:${jobId}`,
          JSON.stringify({ jobId, status: 'failed', error: error.message })
        );

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3, // Thumbnail generation is lightweight
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Thumbnail Worker] ✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Thumbnail Worker] ❌ Job ${job?.id} failed:`, err.message);
  });

  console.log('✅ Thumbnail Worker started and listening for jobs...');

  return worker;
}
