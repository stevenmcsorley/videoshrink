import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const prisma = new PrismaClient();
const execAsync = promisify(exec);

const frameQueue = new Queue('frame-extraction', {
  connection: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

const DEFAULT_FPS = 1;
const MIN_FPS = 0.1;
const MAX_FPS = 60;
const MAX_FRAMES = 5000;

function parseTime(time?: string): string | undefined {
  if (!time) return undefined;
  const timeRegex = /^(\d{1,2}):(\d{2}):(\d{2})(\.\d+)?$|^\d+(\.\d+)?$/;
  if (!timeRegex.test(time)) {
    throw new Error('Time must be in HH:MM:SS format or numeric seconds');
  }
  return time;
}

function timeToSeconds(time: string): number {
  if (time.includes(':')) {
    const [h, m, s] = time.split(':');
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }
  return parseFloat(time);
}

async function probeDuration(filePath: string): Promise<number> {
  const { stdout } = await execAsync(
    `ffprobe -v quiet -print_format json -show_format "${filePath}"`
  );
  const data = JSON.parse(stdout);
  const duration = parseFloat(data.format?.duration || '0');
  if (!duration || Number.isNaN(duration)) {
    throw new Error('Could not determine video duration');
  }
  return duration;
}

function sanitizeBaseName(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName));
  const safeBase = base.replace(/[^a-zA-Z0-9_-]+/g, '_');
  return safeBase || 'frames';
}

export default async function frameRoutes(fastify: FastifyInstance) {
  // POST /api/frames - Extract frames from video
  fastify.post('/api/frames', async (request, reply) => {
    fastify.log.info('Frame extraction upload started');
    try {
      const data = await request.file();
      fastify.log.info('File received');

      if (!data) {
        return reply.code(400).send({
          error: 'No file uploaded',
          message: 'Please provide a video file',
        });
      }

      const fields = data.fields as any;
      const startTime = parseTime(fields.startTime?.value);
      const endTime = parseTime(fields.endTime?.value);
      const fpsInput = fields.fps?.value;
      const formatInput = fields.format?.value?.toLowerCase();

      const fps = fpsInput ? parseFloat(fpsInput) : DEFAULT_FPS;
      if (Number.isNaN(fps) || fps < MIN_FPS || fps > MAX_FPS) {
        return reply.code(400).send({
          error: 'Invalid FPS',
          message: `FPS must be between ${MIN_FPS} and ${MAX_FPS}`,
        });
      }

      const outputFormat =
        formatInput === 'png' ? 'png' : formatInput === 'jpg' ? 'jpg' : 'jpg';

      if (formatInput && outputFormat !== formatInput) {
        return reply.code(400).send({
          error: 'Invalid format',
          message: 'Format must be jpg or png',
        });
      }

      const uploadDir = process.env.UPLOAD_DIR || '/uploads/temp';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const fileName = `${timestamp}-${randomId}-${data.filename}`;
      const filePath = path.join(uploadDir, fileName);

      const { pipeline } = await import('stream/promises');
      await pipeline(data.file, fs.createWriteStream(filePath));

      const fileSize = fs.statSync(filePath).size;
      fastify.log.info(`File saved: ${filePath}, size: ${fileSize}`);

      const videoDuration = await probeDuration(filePath);
      const startSeconds = startTime ? timeToSeconds(startTime) : 0;
      let endSeconds = endTime ? timeToSeconds(endTime) : videoDuration;

      if (startSeconds < 0 || startSeconds >= videoDuration) {
        return reply.code(400).send({
          error: 'Invalid start time',
          message: 'Start time must be within the video duration',
        });
      }

      if (endSeconds > videoDuration) {
        endSeconds = videoDuration;
      }

      if (endSeconds <= startSeconds) {
        return reply.code(400).send({
          error: 'Invalid time range',
          message: 'End time must be after start time',
        });
      }

      const duration = endSeconds - startSeconds;
      const estimatedFrames = Math.max(1, Math.ceil(duration * fps));

      if (estimatedFrames > MAX_FRAMES) {
        return reply.code(400).send({
          error: 'Too many frames',
          message: `Estimated ${estimatedFrames} frames. Reduce FPS or duration to stay under ${MAX_FRAMES}.`,
        });
      }

      const outputDir = path.join(uploadDir, `${timestamp}-${randomId}-frames`);
      fs.mkdirSync(outputDir, { recursive: true });
      const outputBaseName = sanitizeBaseName(data.filename);

      const job = await prisma.frameExtractionJob.create({
        data: {
          inputFile: filePath,
          fileName: data.filename,
          fileSize,
          outputFormat,
          fps,
          startTime: startTime || '0',
          endTime: endSeconds.toString(),
          duration,
          estimatedFrames,
          status: 'pending',
          progress: 0,
        },
      });

      await frameQueue.add('extract-frames', {
        jobId: job.id,
        inputFile: filePath,
        outputDir,
        outputBaseName,
        outputFormat,
        fps,
        startTime: startTime || '0',
        duration,
        estimatedFrames,
      });

      return reply.code(201).send({
        success: true,
        message: 'Frame extraction job created',
        jobId: job.id,
        status: job.status,
        estimatedFrames,
        fps,
        format: outputFormat,
        startTime: startTime || '0',
        endTime: endSeconds.toString(),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to create frame extraction job',
        message: error.message,
      });
    }
  });

  // GET /api/frames/jobs - List frame extraction jobs
  fastify.get('/api/frames/jobs', async (request, reply) => {
    const { status, limit = 50, offset = 0 } = request.query as {
      status?: string;
      limit?: number;
      offset?: number;
    };

    try {
      const where = status ? { status } : {};

      const [jobs, total] = await Promise.all([
        prisma.frameExtractionJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.frameExtractionJob.count({ where }),
      ]);

      return reply.send({
        jobs,
        total,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to list frame extraction jobs',
        message: error.message,
      });
    }
  });

  // GET /api/frames/jobs/:id - Get frame extraction job status
  fastify.get('/api/frames/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.frameExtractionJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No frame extraction job found with ID: ${id}`,
        });
      }

      return reply.send({ job });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get frame extraction job',
        message: error.message,
      });
    }
  });

  // GET /api/frames/jobs/:id/files - Get list of generated frame files
  fastify.get('/api/frames/jobs/:id/files', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.frameExtractionJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No frame extraction job found with ID: ${id}`,
        });
      }

      if (job.status !== 'completed' || !job.outputFiles) {
        return reply.code(400).send({
          error: 'Job not completed',
          message: 'Frame extraction has not completed successfully',
        });
      }

      const files = JSON.parse(job.outputFiles);

      return reply.send({
        files,
        count: files.length,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get frame files',
        message: error.message,
      });
    }
  });

  // GET /api/frames/jobs/:id/download - Download ZIP of frames
  fastify.get('/api/frames/jobs/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.frameExtractionJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No frame extraction job found with ID: ${id}`,
        });
      }

      if (job.status !== 'completed' || !job.outputFiles) {
        return reply.code(400).send({
          error: 'Job not completed',
          message: 'Frame extraction has not completed successfully',
        });
      }

      const files = JSON.parse(job.outputFiles) as string[];
      const validFiles = files.filter((filePath) => fs.existsSync(filePath));

      if (validFiles.length === 0) {
        return reply.code(404).send({
          error: 'Files not found',
          message: 'No frame files exist on the server',
        });
      }

      const zipName = `${job.fileName.replace(/\.[^.]+$/, '')}_frames.zip`;
      reply.header('Content-Disposition', `attachment; filename="${zipName}"`);
      reply.header('Content-Type', 'application/zip');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', (error: Error) => {
        fastify.log.error(error);
        if (!reply.sent) {
          reply.code(500).send({
            error: 'Failed to create ZIP archive',
            message: error.message,
          });
        }
      });

      validFiles.forEach((filePath) => {
        archive.file(filePath, { name: path.basename(filePath) });
      });

      archive.finalize();

      return reply.send(archive);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to download frames',
        message: error.message,
      });
    }
  });

  // DELETE /api/frames/jobs/:id - Delete frame extraction job
  fastify.delete('/api/frames/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.frameExtractionJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No frame extraction job found with ID: ${id}`,
        });
      }

      if (job.outputFiles) {
        const files = JSON.parse(job.outputFiles);
        files.forEach((filePath: string) => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }

      await prisma.frameExtractionJob.delete({
        where: { id: parseInt(id) },
      });

      return reply.send({
        success: true,
        message: 'Frame extraction job deleted',
        jobId: job.id,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to delete job',
        message: error.message,
      });
    }
  });
}
