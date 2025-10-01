/**
 * Video Trim Worker - Processes video trimming jobs
 */
import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { FFmpegExecutor } from './ffmpeg-executor.js';
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
 * Generate FFmpeg command for video trimming
 */
function generateTrimCommand(options: {
  inputFile: string;
  outputFile: string;
  startTime: string;
  endTime: string;
  lossless: boolean;
}): string[] {
  const { inputFile, outputFile, startTime, endTime, lossless } = options;

  if (lossless) {
    // Lossless trim with -c copy (no re-encoding, ultra fast)
    // Uses -ss before input for faster seeking
    return [
      'ffmpeg',
      '-ss', startTime,            // Start time
      '-to', endTime,              // End time
      '-i', inputFile,             // Input file
      '-c', 'copy',                // Copy streams without re-encoding
      '-avoid_negative_ts', 'make_zero', // Avoid timestamp issues
      '-y',                        // Overwrite output
      outputFile,
    ];
  } else {
    // Re-encode trim (accurate but slower)
    return [
      'ffmpeg',
      '-i', inputFile,
      '-ss', startTime,
      '-to', endTime,
      '-c:v', 'libx264',           // Re-encode video
      '-preset', 'medium',
      '-crf', '23',
      '-c:a', 'aac',               // Re-encode audio
      '-b:a', '192k',
      '-y',
      outputFile,
    ];
  }
}

export function startTrimWorker() {
  const worker = new Worker(
    'video-trim',
    async (job: Job) => {
      const { jobId, inputFile, startTime, endTime, lossless } = job.data;

      console.log(
        `[Trim Worker] Starting job ${jobId}: trim ${startTime} to ${endTime} (${lossless ? 'lossless' : 're-encode'})`
      );

      try {
        // Update job status to processing
        await prisma.trimJob.update({
          where: { id: jobId },
          data: {
            status: 'processing',
            startedAt: new Date(),
            progress: 0,
          },
        });

        // Generate output file path
        const outputDir = path.dirname(inputFile);
        const ext = path.extname(inputFile);
        const baseFileName = path.basename(inputFile, ext);
        const outputFile = path.join(outputDir, `${baseFileName}_trimmed${ext}`);

        console.log(`[Trim Worker] Output file: ${outputFile}`);

        // Generate FFmpeg command for trimming
        const command = generateTrimCommand({
          inputFile,
          outputFile,
          startTime,
          endTime,
          lossless,
        });

        console.log(`[Trim Worker] FFmpeg command: ${command.join(' ')}`);

        // Execute FFmpeg trimming
        const executor = new FFmpegExecutor();

        // Progress callback
        const onProgress = async (progress: number) => {
          await prisma.trimJob.update({
            where: { id: jobId },
            data: { progress },
          });

          // Publish progress to Redis for real-time updates
          await redis.publish(
            `trim:progress:${jobId}`,
            JSON.stringify({ jobId, progress, status: 'processing' })
          );

          console.log(`[Trim Worker] Job ${jobId} progress: ${progress.toFixed(1)}%`);
        };

        // Execute the trim
        await executor.execute({
          command,
          onProgress,
        });

        // Get output file size
        const fs = await import('fs');
        const stats = fs.statSync(outputFile);
        const outputSize = stats.size;

        // Update job to completed
        await prisma.trimJob.update({
          where: { id: jobId },
          data: {
            status: 'completed',
            progress: 100,
            outputFile,
            outputSize,
            completedAt: new Date(),
          },
        });

        // Publish completion event
        await redis.publish(
          `trim:progress:${jobId}`,
          JSON.stringify({ jobId, progress: 100, status: 'completed', outputFile })
        );

        console.log(
          `[Trim Worker] Job ${jobId} completed successfully! Output: ${outputFile} (${(outputSize / 1024 / 1024).toFixed(2)} MB)`
        );

        return { success: true, outputFile, outputSize };
      } catch (error: any) {
        console.error(`[Trim Worker] Job ${jobId} failed:`, error);

        // Update job to failed
        await prisma.trimJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          },
        });

        // Publish failure event
        await redis.publish(
          `trim:progress:${jobId}`,
          JSON.stringify({ jobId, status: 'failed', error: error.message })
        );

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 2, // Process up to 2 trim jobs at once
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Trim Worker] ✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Trim Worker] ❌ Job ${job?.id} failed:`, err.message);
  });

  console.log('✅ Trim Worker started and listening for jobs...');

  return worker;
}
