/**
 * GIF Creation Worker - Processes video-to-GIF conversion jobs
 * Uses two-pass FFmpeg with palette optimization for high-quality GIFs
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
 * Generate FFmpeg commands for high-quality GIF creation
 * Two-pass approach:
 * 1. Generate custom color palette from video
 * 2. Use palette to create optimized GIF
 */
function generateGifCommands(options: {
  inputFile: string;
  outputFile: string;
  paletteFile: string;
  startTime: string;
  endTime: string;
  fps: number;
  width: number;
  optimize: boolean;
}): { paletteCommand: string[]; gifCommand: string[] } {
  const { inputFile, outputFile, paletteFile, startTime, endTime, fps, width, optimize } = options;

  // Filters for both passes
  const filters = [
    `fps=${fps}`,
    `scale=${width}:-1:flags=lanczos`,
  ];

  if (optimize) {
    // Pass 1: Generate optimized palette
    const paletteCommand = [
      'ffmpeg',
      '-ss', startTime,
      '-to', endTime,
      '-i', inputFile,
      '-vf', `${filters.join(',')},palettegen=stats_mode=diff`,
      '-y',
      paletteFile,
    ];

    // Pass 2: Create GIF using palette
    const gifCommand = [
      'ffmpeg',
      '-ss', startTime,
      '-to', endTime,
      '-i', inputFile,
      '-i', paletteFile,
      '-lavfi', `${filters.join(',')} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5`,
      '-y',
      outputFile,
    ];

    return { paletteCommand, gifCommand };
  } else {
    // Single pass without palette optimization (faster but lower quality)
    const gifCommand = [
      'ffmpeg',
      '-ss', startTime,
      '-to', endTime,
      '-i', inputFile,
      '-vf', filters.join(','),
      '-y',
      outputFile,
    ];

    return { paletteCommand: [], gifCommand };
  }
}

export function startGifWorker() {
  const worker = new Worker(
    'gif-creation',
    async (job: Job) => {
      const { jobId, inputFile, startTime, endTime, fps, width, optimize } = job.data;

      console.log(
        `[GIF Worker] Starting job ${jobId}: ${startTime} to ${endTime}, ${fps}fps, ${width}px, optimize=${optimize}`
      );

      try {
        // Update job status to processing
        await prisma.gifJob.update({
          where: { id: jobId },
          data: {
            status: 'processing',
            startedAt: new Date(),
            progress: 0,
          },
        });

        // Generate output file paths
        const outputDir = path.dirname(inputFile);
        const baseFileName = path.basename(inputFile, path.extname(inputFile));
        const outputFile = path.join(outputDir, `${baseFileName}.gif`);
        const paletteFile = path.join(outputDir, `${baseFileName}_palette.png`);

        console.log(`[GIF Worker] Output file: ${outputFile}`);

        // Generate FFmpeg commands
        const { paletteCommand, gifCommand } = generateGifCommands({
          inputFile,
          outputFile,
          paletteFile,
          startTime,
          endTime,
          fps,
          width,
          optimize,
        });

        const executor = new FFmpegExecutor();

        if (optimize && paletteCommand.length > 0) {
          // Two-pass: Generate palette first
          console.log(`[GIF Worker] Pass 1/2: Generating palette...`);
          console.log(`[GIF Worker] Command: ${paletteCommand.join(' ')}`);

          await executor.execute({
            command: paletteCommand,
            onProgress: async (progress) => {
              const overallProgress = progress * 0.4; // First pass is 40%
              await prisma.gifJob.update({
                where: { id: jobId },
                data: { progress: overallProgress },
              });

              await redis.publish(
                `gif:progress:${jobId}`,
                JSON.stringify({ jobId, progress: overallProgress, status: 'processing', phase: 'palette' })
              );
            },
          });

          console.log(`[GIF Worker] Pass 2/2: Creating GIF with palette...`);
        }

        // Create GIF (second pass or single pass)
        console.log(`[GIF Worker] Command: ${gifCommand.join(' ')}`);

        await executor.execute({
          command: gifCommand,
          onProgress: async (progress) => {
            const overallProgress = optimize ? 40 + (progress * 0.6) : progress;
            await prisma.gifJob.update({
              where: { id: jobId },
              data: { progress: overallProgress },
            });

            await redis.publish(
              `gif:progress:${jobId}`,
              JSON.stringify({ jobId, progress: overallProgress, status: 'processing', phase: 'gif' })
            );

            console.log(`[GIF Worker] Job ${jobId} progress: ${overallProgress.toFixed(1)}%`);
          },
        });

        // Clean up palette file if it exists
        if (optimize) {
          const fs = await import('fs');
          if (fs.existsSync(paletteFile)) {
            fs.unlinkSync(paletteFile);
          }
        }

        // Get output file size
        const fs = await import('fs');
        const stats = fs.statSync(outputFile);
        const outputSize = stats.size;

        // Update job to completed
        await prisma.gifJob.update({
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
          `gif:progress:${jobId}`,
          JSON.stringify({ jobId, progress: 100, status: 'completed', outputFile })
        );

        console.log(
          `[GIF Worker] Job ${jobId} completed successfully! Output: ${outputFile} (${(outputSize / 1024).toFixed(2)} KB)`
        );

        return { success: true, outputFile, outputSize };
      } catch (error: any) {
        console.error(`[GIF Worker] Job ${jobId} failed:`, error);

        // Update job to failed
        await prisma.gifJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          },
        });

        // Publish failure event
        await redis.publish(
          `gif:progress:${jobId}`,
          JSON.stringify({ jobId, status: 'failed', error: error.message })
        );

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 2, // Process up to 2 GIF jobs at once
    }
  );

  worker.on('completed', (job) => {
    console.log(`[GIF Worker] ✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[GIF Worker] ❌ Job ${job?.id} failed:`, err.message);
  });

  console.log('✅ GIF Worker started and listening for jobs...');

  return worker;
}
