/**
 * Conversion Worker - Processes format conversion jobs
 */
import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { ConversionGenerator } from './conversion-generator.js';
import { FFmpegExecutor } from './ffmpeg-executor.js';
import { probeVideo } from './ffprobe.js';
import { tryGenerateThumbnail } from './thumbnail-utils.js';
import Redis from 'ioredis';
import path from 'path';

const prisma = new PrismaClient();

// Redis connection
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const redis = new Redis(redisConnection);

export function startConversionWorker() {
  const worker = new Worker(
    'format-conversion',
    async (job: Job) => {
      const { jobId, inputFile, fromFormat, toFormat, preset, videoCodec, audioCodec } =
        job.data;

      console.log(`[Conversion Worker] Starting job ${jobId}: ${fromFormat} → ${toFormat}`);

      try {
        // Update job status to processing
        await prisma.conversionJob.update({
          where: { id: jobId },
          data: {
            status: 'processing',
            startedAt: new Date(),
            progress: 0,
          },
        });

        // Probe input video for metadata
        console.log(`[Conversion Worker] Probing input file: ${inputFile}`);
        let metadata;
        try {
          metadata = await probeVideo(inputFile);
          console.log(
            `[Conversion Worker] Input: ${metadata.width}x${metadata.height}, ${metadata.bitrate} kbps, ${metadata.codec}`
          );
        } catch (error: any) {
          console.warn(
            `[Conversion Worker] Could not probe video metadata: ${error.message}`
          );
        }

        // Generate output file path
        const outputDir = path.dirname(inputFile);
        const baseFileName = path.basename(inputFile, path.extname(inputFile));
        const outputFile = path.join(outputDir, `${baseFileName}_converted.${toFormat}`);

        // Generate FFmpeg command
        const command = ConversionGenerator.generate({
          inputFile,
          outputFile,
          fromFormat,
          toFormat,
          preset,
          videoCodec,
          audioCodec,
        });

        console.log(
          `[Conversion Worker] Conversion type: ${command.type} (${
            command.type === 'remux' ? 'fast, no re-encoding' : 're-encoding'
          })`
        );
        console.log(`[Conversion Worker] Command: ${command.command.join(' ')}`);

        // Execute FFmpeg conversion
        const executor = new FFmpegExecutor();

        // Progress callback
        const onProgress = async (progress: number) => {
          await prisma.conversionJob.update({
            where: { id: jobId },
            data: { progress },
          });

          // Publish progress to Redis for real-time updates
          await redis.publish(
            `conversion:progress:${jobId}`,
            JSON.stringify({ jobId, progress, status: 'processing' })
          );

          console.log(`[Conversion Worker] Job ${jobId} progress: ${progress.toFixed(1)}%`);
        };

        // Execute the conversion
        await executor.execute({
          command: command.command,
          onProgress,
        });

        // Get output file size
        const fs = await import('fs');
        const stats = fs.statSync(outputFile);
        const outputSize = stats.size;

        // Generate thumbnail automatically (only for video formats)
        let thumbnailPath: string | null = null;
        const videoFormats = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm4v', 'mpg', 'mpeg', 'wmv'];
        if (videoFormats.includes(toFormat.toLowerCase())) {
          console.log(`[Conversion Worker] Job ${jobId} - Generating thumbnail...`);
          thumbnailPath = await tryGenerateThumbnail({
            inputFile: outputFile,
            timestamp: '1',
            width: 320,
          });

          if (thumbnailPath) {
            console.log(`[Conversion Worker] Job ${jobId} - Thumbnail generated: ${thumbnailPath}`);
          }
        }

        // Update job to completed
        await prisma.conversionJob.update({
          where: { id: jobId },
          data: {
            status: 'completed',
            progress: 100,
            outputFile,
            outputSize,
            thumbnailPath,
            completedAt: new Date(),
          },
        });

        // Publish completion event
        await redis.publish(
          `conversion:progress:${jobId}`,
          JSON.stringify({ jobId, progress: 100, status: 'completed', outputFile })
        );

        console.log(
          `[Conversion Worker] Job ${jobId} completed successfully! Output: ${outputFile}`
        );

        return { success: true, outputFile, outputSize };
      } catch (error: any) {
        console.error(`[Conversion Worker] Job ${jobId} failed:`, error);

        // Update job to failed
        await prisma.conversionJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          },
        });

        // Publish failure event
        await redis.publish(
          `conversion:progress:${jobId}`,
          JSON.stringify({ jobId, status: 'failed', error: error.message })
        );

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 2, // Process up to 2 conversions at once
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Conversion Worker] ✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Conversion Worker] ❌ Job ${job?.id} failed:`, err.message);
  });

  console.log('✅ Conversion Worker started and listening for jobs...');

  return worker;
}
