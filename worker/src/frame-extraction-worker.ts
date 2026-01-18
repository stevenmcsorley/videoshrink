/**
 * Frame Extraction Worker - Extracts frames from videos
 */
import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { FFmpegExecutor } from './ffmpeg-executor.js';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const redis = new Redis(redisConnection);

function generateFrameCommand(options: {
  inputFile: string;
  outputPattern: string;
  startTime: string;
  duration: number;
  fps: number;
  format: 'jpg' | 'png';
}): string[] {
  const { inputFile, outputPattern, startTime, duration, fps, format } = options;

  const command = [
    'ffmpeg',
    '-ss', startTime,
    '-i', inputFile,
    '-t', duration.toString(),
    '-vf', `fps=${fps}`,
    '-start_number', '1',
  ];

  if (format === 'jpg') {
    command.push('-q:v', '2');
  } else {
    command.push('-compression_level', '3');
  }

  command.push('-y', outputPattern);

  return command;
}

function parseFrameProgress(log: string): number | null {
  const matches = [...log.matchAll(/frame=\s*(\d+)/g)];
  if (matches.length === 0) return null;
  const lastMatch = matches[matches.length - 1];
  return parseInt(lastMatch[1], 10);
}

export function startFrameExtractionWorker() {
  const worker = new Worker(
    'frame-extraction',
    async (job: Job) => {
      const {
        jobId,
        inputFile,
        outputDir,
        outputBaseName,
        outputFormat,
        fps,
        startTime,
        duration,
        estimatedFrames,
      } = job.data;

      console.log(
        `[Frame Worker] Starting job ${jobId}: ${outputFormat} at ${fps} fps`
      );

      try {
        await prisma.frameExtractionJob.update({
          where: { id: jobId },
          data: {
            status: 'processing',
            startedAt: new Date(),
            progress: 0,
          },
        });

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const safeBaseName =
          outputBaseName || path.basename(inputFile, path.extname(inputFile));
        const outputPattern = path.join(
          outputDir,
          `${safeBaseName}_frame_%05d.${outputFormat}`
        );

        const executor = new FFmpegExecutor();
        let lastProgress = 0;
        let lastUpdate = 0;
        const totalFrames = Number(estimatedFrames) || 0;

        const maybeUpdateProgress = async (progress: number, frame?: number) => {
          const now = Date.now();
          if (progress < lastProgress + 1 && now - lastUpdate < 1000) {
            return;
          }

          lastProgress = Math.min(progress, 99.5);
          lastUpdate = now;

          await prisma.frameExtractionJob.update({
            where: { id: jobId },
            data: { progress: lastProgress },
          });

          await redis.publish(
            `frames:progress:${jobId}`,
            JSON.stringify({
              jobId,
              progress: lastProgress,
              status: 'processing',
              frame,
              total: totalFrames || undefined,
            })
          );
        };

        const result = await executor.execute({
          command: generateFrameCommand({
            inputFile,
            outputPattern,
            startTime,
            duration,
            fps,
            format: outputFormat,
          }),
          timeout: 60 * 60 * 1000,
          onProgress: totalFrames
            ? undefined
            : async (progress) => {
                await maybeUpdateProgress(progress);
              },
          onLog: totalFrames
            ? async (log) => {
                const frame = parseFrameProgress(log);
                if (!frame) return;
                const progress = Math.min((frame / totalFrames) * 100, 99.5);
                await maybeUpdateProgress(progress, frame);
              }
            : undefined,
        });

        if (!result.success) {
          throw new Error(result.error || 'Frame extraction failed');
        }

        const outputFiles = fs
          .readdirSync(outputDir)
          .filter((file) => file.endsWith(`.${outputFormat}`))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map((file) => path.join(outputDir, file));

        await prisma.frameExtractionJob.update({
          where: { id: jobId },
          data: {
            status: 'completed',
            progress: 100,
            outputFiles: JSON.stringify(outputFiles),
            frameCount: outputFiles.length,
            completedAt: new Date(),
          },
        });

        await redis.publish(
          `frames:progress:${jobId}`,
          JSON.stringify({
            jobId,
            progress: 100,
            status: 'completed',
            outputFiles,
            total: outputFiles.length,
          })
        );

        console.log(
          `[Frame Worker] Job ${jobId} completed: ${outputFiles.length} frames`
        );

        return { success: true, outputFiles };
      } catch (error: any) {
        console.error(`[Frame Worker] Job ${jobId} failed:`, error);

        await prisma.frameExtractionJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          },
        });

        await redis.publish(
          `frames:progress:${jobId}`,
          JSON.stringify({ jobId, status: 'failed', error: error.message })
        );

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Frame Worker] ✅ Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Frame Worker] ❌ Job ${job?.id} failed:`, err.message);
  });

  console.log('✅ Frame Extraction Worker started and listening for jobs...');

  return worker;
}
