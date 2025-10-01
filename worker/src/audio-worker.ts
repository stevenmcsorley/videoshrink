/**
 * Audio Extraction Worker - Processes audio extraction jobs
 */
import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { ConversionGenerator } from './conversion-generator.js';
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

export function startAudioExtractionWorker() {
  const worker = new Worker(
    'audio-extraction',
    async (job: Job) => {
      const { jobId, inputFile, outputFormat, audioCodec, bitrate } = job.data;

      console.log(`[Audio Worker] Starting job ${jobId}: extracting ${outputFormat} from ${inputFile}`);

      try {
        // Update job status to processing
        await prisma.audioExtractionJob.update({
          where: { id: jobId },
          data: {
            status: 'processing',
            startedAt: new Date(),
            progress: 0,
          },
        });

        // Generate output file path
        const outputDir = path.dirname(inputFile);
        const baseFileName = path.basename(inputFile, path.extname(inputFile));
        const outputFile = path.join(outputDir, `${baseFileName}_audio.${outputFormat}`);

        console.log(`[Audio Worker] Output file: ${outputFile}`);

        // Generate FFmpeg command for audio extraction
        const command = ConversionGenerator.generateAudioExtract({
          inputFile,
          outputFile,
          fromFormat: path.extname(inputFile).slice(1),
          toFormat: outputFormat,
          audioCodec,
          audioBitrate: bitrate !== 'lossless' ? bitrate : undefined,
        });

        console.log(`[Audio Worker] FFmpeg command: ${command.command.join(' ')}`);

        // Execute FFmpeg extraction
        const executor = new FFmpegExecutor();

        // Progress callback
        const onProgress = async (progress: number) => {
          await prisma.audioExtractionJob.update({
            where: { id: jobId },
            data: { progress },
          });

          // Publish progress to Redis for real-time updates
          await redis.publish(
            `audio:progress:${jobId}`,
            JSON.stringify({ jobId, progress, status: 'processing' })
          );

          console.log(`[Audio Worker] Job ${jobId} progress: ${progress.toFixed(1)}%`);
        };

        // Execute the extraction
        await executor.execute({
          command: command.command,
          onProgress,
        });

        // Get output file size
        const fs = await import('fs');
        const stats = fs.statSync(outputFile);
        const outputSize = stats.size;

        // Update job to completed
        await prisma.audioExtractionJob.update({
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
          `audio:progress:${jobId}`,
          JSON.stringify({ jobId, progress: 100, status: 'completed', outputFile })
        );

        console.log(
          `[Audio Worker] Job ${jobId} completed successfully! Output: ${outputFile} (${(outputSize / 1024 / 1024).toFixed(2)} MB)`
        );

        return { success: true, outputFile, outputSize };
      } catch (error: any) {
        console.error(`[Audio Worker] Job ${jobId} failed:`, error);

        // Update job to failed
        await prisma.audioExtractionJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          },
        });

        // Publish failure event
        await redis.publish(
          `audio:progress:${jobId}`,
          JSON.stringify({ jobId, status: 'failed', error: error.message })
        );

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3, // Audio extraction is lightweight, can do more concurrently
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Audio Worker] ✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Audio Worker] ❌ Job ${job?.id} failed:`, err.message);
  });

  console.log('✅ Audio Extraction Worker started and listening for jobs...');

  return worker;
}
