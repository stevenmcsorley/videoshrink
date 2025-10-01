import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const prisma = new PrismaClient();

// BullMQ Queue for GIF creation
const gifQueue = new Queue('gif-creation', {
  connection: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export default async function gifRoutes(fastify: FastifyInstance) {
  // POST /api/gif - Create GIF from video
  fastify.post('/api/gif', async (request, reply) => {
    const { fileId, startTime, endTime, fps, width, optimize } = request.body as {
      fileId: number;
      startTime?: string; // Optional: HH:MM:SS or seconds (default: start of video)
      endTime?: string;   // Optional: HH:MM:SS or seconds (default: 5 seconds from start)
      fps?: number;       // Frames per second (default: 10)
      width?: number;     // Width in pixels (height auto-calculated, default: 480)
      optimize?: boolean; // Use palette optimization (default: true)
    };

    if (!fileId) {
      return reply.code(400).send({
        error: 'Invalid request',
        message: 'fileId is required',
      });
    }

    try {
      // Get the uploaded file
      const file = await prisma.fileUpload.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        return reply.code(404).send({
          error: 'File not found',
          message: `No file found with ID: ${fileId}`,
        });
      }

      // Validate and set defaults
      const gifFps = fps && fps >= 5 && fps <= 30 ? fps : 10;
      const gifWidth = width && width >= 240 && width <= 1920 ? width : 480;
      const useOptimize = optimize ?? true;

      // Parse times if provided
      const parseTime = (time: string | undefined): string | undefined => {
        if (!time) return undefined;
        const timeRegex = /^(\d{1,2}):(\d{2}):(\d{2})$|^\d+(\.\d+)?$/;
        if (!timeRegex.test(time)) {
          throw new Error('Time must be in HH:MM:SS format or numeric seconds');
        }
        return time;
      };

      const gifStartTime = parseTime(startTime) || '0';
      const gifEndTime = parseTime(endTime);

      // Calculate duration
      const getSeconds = (time: string): number => {
        if (time.includes(':')) {
          const [h, m, s] = time.split(':').map(Number);
          return h * 3600 + m * 60 + s;
        }
        return parseFloat(time);
      };

      const start = getSeconds(gifStartTime);
      const end = gifEndTime ? getSeconds(gifEndTime) : start + 5; // Default 5 seconds
      const duration = end - start;

      if (duration <= 0) {
        return reply.code(400).send({
          error: 'Invalid time range',
          message: 'End time must be after start time',
        });
      }

      if (duration > 30) {
        return reply.code(400).send({
          error: 'Duration too long',
          message: 'GIF duration cannot exceed 30 seconds',
        });
      }

      // Create GIF job in database
      const job = await prisma.gifJob.create({
        data: {
          inputFile: file.path,
          fileName: file.originalName,
          fileSize: file.size,
          startTime: gifStartTime,
          endTime: gifEndTime || (start + 5).toString(),
          duration,
          fps: gifFps,
          width: gifWidth,
          optimize: useOptimize,
          status: 'pending',
          progress: 0,
        },
      });

      // Add job to BullMQ queue for processing
      await gifQueue.add('create-gif', {
        jobId: job.id,
        inputFile: file.path,
        startTime: gifStartTime,
        endTime: gifEndTime || (start + 5).toString(),
        fps: gifFps,
        width: gifWidth,
        optimize: useOptimize,
      });

      return reply.code(201).send({
        success: true,
        message: 'GIF creation job created',
        jobId: job.id,
        status: job.status,
        duration: job.duration,
        fps: job.fps,
        width: job.width,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to create GIF job',
        message: error.message,
      });
    }
  });

  // GET /api/gif/jobs - List GIF jobs
  fastify.get('/api/gif/jobs', async (request, reply) => {
    const { status, limit = 50, offset = 0 } = request.query as {
      status?: string;
      limit?: number;
      offset?: number;
    };

    try {
      const where = status ? { status } : {};

      const [jobs, total] = await Promise.all([
        prisma.gifJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.gifJob.count({ where }),
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
        error: 'Failed to list GIF jobs',
        message: error.message,
      });
    }
  });

  // GET /api/gif/jobs/:id - Get GIF job status
  fastify.get('/api/gif/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.gifJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No GIF job found with ID: ${id}`,
        });
      }

      return reply.send({ job });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get GIF job',
        message: error.message,
      });
    }
  });

  // GET /api/gif/jobs/:id/download - Download GIF
  fastify.get('/api/gif/jobs/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.gifJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No GIF job found with ID: ${id}`,
        });
      }

      if (job.status !== 'completed' || !job.outputFile) {
        return reply.code(400).send({
          error: 'Job not completed',
          message: 'GIF creation has not completed successfully',
        });
      }

      // Check if file exists
      const fs = await import('fs');
      if (!fs.existsSync(job.outputFile)) {
        return reply.code(404).send({
          error: 'File not found',
          message: 'The output file does not exist on the server',
        });
      }

      // Send the file
      const fileName = job.fileName.replace(/\.[^.]+$/, '.gif');
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);

      const stream = fs.createReadStream(job.outputFile);
      return reply.send(stream);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to download file',
        message: error.message,
      });
    }
  });

  // DELETE /api/gif/jobs/:id - Delete GIF job
  fastify.delete('/api/gif/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.gifJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No GIF job found with ID: ${id}`,
        });
      }

      // Delete output file if it exists
      if (job.outputFile) {
        const fs = await import('fs');
        if (fs.existsSync(job.outputFile)) {
          fs.unlinkSync(job.outputFile);
        }
      }

      await prisma.gifJob.delete({
        where: { id: parseInt(id) },
      });

      return reply.send({
        success: true,
        message: 'GIF job deleted',
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
