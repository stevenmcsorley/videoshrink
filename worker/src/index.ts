import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { FFmpegGenerator } from './ffmpeg-generator.js';
import { FFmpegExecutor } from './ffmpeg-executor.js';
import Redis from 'ioredis';
import path from 'path';

const prisma = new PrismaClient();

// Redis client for pub/sub
const redisPublisher = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

// Redis connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

interface VideoJobData {
  jobId: number;
  inputFile: string;
  outputFile?: string;
  preset?: 'high' | 'medium' | 'low';
  codec?: 'h264' | 'h265';
  crf?: number;
  bitrate?: string;
  resolution?: string;
  targetSize?: number;
}

// Create worker instance
const worker = new Worker<VideoJobData>(
  'video-compression',
  async (job: Job<VideoJobData>) => {
    const { jobId, inputFile, preset, codec, crf, bitrate, resolution, targetSize } = job.data;

    console.log(`[Worker] Processing job ${jobId}: ${inputFile}`);

    try {
      // Update job status to processing
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'processing',
          startedAt: new Date(),
          progress: 0,
        },
      });

      // Generate output file path
      const outputFile = job.data.outputFile || inputFile.replace(/\.[^.]+$/, '_compressed.mp4');

      // Get preset configuration if specified
      const presetConfig = preset ? FFmpegGenerator.getPresetConfig(preset) : {};

      // Generate FFmpeg commands
      const commands = FFmpegGenerator.generate({
        inputFile,
        outputFile,
        codec: codec || presetConfig.codec || 'h264',
        preset: preset || 'medium',
        crf: crf ?? presetConfig.crf,
        bitrate,
        resolution,
        targetSizePercent: targetSize,
        twoPass: presetConfig.twoPass || false,
      });

      console.log(`[Worker] Job ${jobId} - Generated ${commands.length} FFmpeg command(s)`);

      // Execute FFmpeg command(s)
      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const passLabel = cmd.passType === 'single' ? 'Single-pass' : `Pass ${i + 1}/${commands.length}`;

        console.log(`[Worker] Job ${jobId} - ${passLabel} encoding...`);

        const executor = new FFmpegExecutor();

        const result = await executor.execute({
          command: cmd.command,
          timeout: 60 * 60 * 1000, // 1 hour timeout
          onProgress: async (progress) => {
            // Calculate overall progress across passes
            const passProgress = commands.length > 1 ? 50 : 100;
            const baseProgress = i * passProgress;
            const totalProgress = Math.min(baseProgress + (progress * passProgress / 100), 100);

            await job.updateProgress(totalProgress);

            // Update database
            await prisma.job.update({
              where: { id: jobId },
              data: { progress: totalProgress },
            });

            // Publish progress to Redis pub/sub for real-time updates
            await redisPublisher.publish(
              `job:${jobId}:progress`,
              JSON.stringify({
                jobId,
                progress: totalProgress,
                status: 'processing',
                phase: cmd.passType === 'single' ? 'encoding' : `pass_${i + 1}`,
                timestamp: new Date().toISOString(),
              })
            );

            console.log(`[Worker] Job ${jobId} - Progress: ${totalProgress.toFixed(1)}%`);
          },
          onLog: (log) => {
            // Log important FFmpeg output
            if (log.includes('error') || log.includes('Error')) {
              console.error(`[Worker] Job ${jobId} - FFmpeg: ${log.trim()}`);
            }
          },
        });

        if (!result.success) {
          throw new Error(result.error || 'FFmpeg execution failed');
        }

        console.log(`[Worker] Job ${jobId} - ${passLabel} completed in ${(result.duration / 1000).toFixed(1)}s`);
      }

      // Job completed successfully
      await job.updateProgress(100);

      // Get output file size
      const fs = await import('fs');
      const outputSize = fs.existsSync(outputFile) ? fs.statSync(outputFile).size : null;

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          progress: 100,
          outputFile: outputFile,
          outputSize: outputSize,
          completedAt: new Date(),
        },
      });

      // Publish completion to Redis
      await redisPublisher.publish(
        `job:${jobId}:progress`,
        JSON.stringify({
          jobId,
          progress: 100,
          status: 'completed',
          outputFile,
          outputSize,
          timestamp: new Date().toISOString(),
        })
      );

      console.log(`[Worker] Job ${jobId} completed successfully`);

      return { success: true, jobId, outputFile };
    } catch (error: any) {
      console.error(`[Worker] Job ${jobId} failed:`, error);

      // Update job with error
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: error.message,
        },
      });

      // Publish failure to Redis
      await redisPublisher.publish(
        `job:${jobId}:progress`,
        JSON.stringify({
          jobId,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString(),
        })
      );

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2'), // Process 2 jobs concurrently
  }
);

// Worker event handlers
worker.on('ready', () => {
  console.log('✅ Worker is ready and waiting for jobs');
  console.log(`   Connected to Redis at ${redisConnection.host}:${redisConnection.port}`);
  console.log(`   Concurrency: ${worker.opts.concurrency}`);
});

worker.on('active', (job: Job) => {
  console.log(`[Worker] Job ${job.id} is now active`);
});

worker.on('completed', (job: Job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job: Job | undefined, error: Error) => {
  if (job) {
    console.error(`[Worker] Job ${job.id} failed:`, error.message);
  } else {
    console.error('[Worker] Job failed:', error.message);
  }
});

worker.on('error', (error: Error) => {
  console.error('[Worker] Worker error:', error);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[Worker] Shutting down gracefully...');

  try {
    await worker.close();
    await prisma.$disconnect();
    await redisPublisher.quit();
    console.log('[Worker] Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[Worker] Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('🚀 Video compression worker started');
console.log('   Queue: video-compression');
console.log('   Press Ctrl+C to exit');
