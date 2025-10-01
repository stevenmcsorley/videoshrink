import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const prisma = new PrismaClient();

// BullMQ Queue for video trimming
const trimQueue = new Queue('video-trim', {
  connection: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export default async function trimRoutes(fastify: FastifyInstance) {
  // POST /api/trim - Create video trim job
  fastify.post('/api/trim', async (request, reply) => {
    const { fileId, startTime, endTime, lossless } = request.body as {
      fileId: number;
      startTime: string; // Format: HH:MM:SS or seconds
      endTime: string;   // Format: HH:MM:SS or seconds
      lossless?: boolean; // If true, use -c copy (no re-encoding)
    };

    if (!fileId || !startTime || !endTime) {
      return reply.code(400).send({
        error: 'Invalid request',
        message: 'fileId, startTime, and endTime are required',
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

      // Validate time format (HH:MM:SS or numeric seconds)
      const timeRegex = /^(\d{1,2}):(\d{2}):(\d{2})$|^\d+(\.\d+)?$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return reply.code(400).send({
          error: 'Invalid time format',
          message: 'Time must be in HH:MM:SS format or numeric seconds',
        });
      }

      // Convert to seconds for validation
      const parseTime = (time: string): number => {
        if (time.includes(':')) {
          const [h, m, s] = time.split(':').map(Number);
          return h * 3600 + m * 60 + s;
        }
        return parseFloat(time);
      };

      const startSeconds = parseTime(startTime);
      const endSeconds = parseTime(endTime);

      if (startSeconds >= endSeconds) {
        return reply.code(400).send({
          error: 'Invalid time range',
          message: 'Start time must be before end time',
        });
      }

      if (startSeconds < 0 || endSeconds < 0) {
        return reply.code(400).send({
          error: 'Invalid time',
          message: 'Time values cannot be negative',
        });
      }

      // Create trim job in database
      const job = await prisma.trimJob.create({
        data: {
          inputFile: file.path,
          fileName: file.originalName,
          fileSize: file.size,
          startTime,
          endTime,
          duration: endSeconds - startSeconds,
          lossless: lossless ?? true, // Default to lossless
          status: 'pending',
          progress: 0,
        },
      });

      // Add job to BullMQ queue for processing
      await trimQueue.add('trim-video', {
        jobId: job.id,
        inputFile: file.path,
        startTime,
        endTime,
        lossless: lossless ?? true,
      });

      return reply.code(201).send({
        success: true,
        message: 'Trim job created',
        jobId: job.id,
        status: job.status,
        duration: job.duration,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to create trim job',
        message: error.message,
      });
    }
  });

  // GET /api/trim/jobs - List trim jobs
  fastify.get('/api/trim/jobs', async (request, reply) => {
    const { status, limit = 50, offset = 0 } = request.query as {
      status?: string;
      limit?: number;
      offset?: number;
    };

    try {
      const where = status ? { status } : {};

      const [jobs, total] = await Promise.all([
        prisma.trimJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.trimJob.count({ where }),
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
        error: 'Failed to list trim jobs',
        message: error.message,
      });
    }
  });

  // GET /api/trim/jobs/:id - Get trim job status
  fastify.get('/api/trim/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.trimJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No trim job found with ID: ${id}`,
        });
      }

      return reply.send({ job });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get trim job',
        message: error.message,
      });
    }
  });

  // GET /api/trim/jobs/:id/download - Download trimmed video
  fastify.get('/api/trim/jobs/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.trimJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No trim job found with ID: ${id}`,
        });
      }

      if (job.status !== 'completed' || !job.outputFile) {
        return reply.code(400).send({
          error: 'Job not completed',
          message: 'Trimming has not completed successfully',
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
      const fileName = job.fileName.replace(/(\.[^.]+)$/, '_trimmed$1');
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

  // DELETE /api/trim/jobs/:id - Delete trim job
  fastify.delete('/api/trim/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.trimJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No trim job found with ID: ${id}`,
        });
      }

      // Delete output file if it exists
      if (job.outputFile) {
        const fs = await import('fs');
        if (fs.existsSync(job.outputFile)) {
          fs.unlinkSync(job.outputFile);
        }
      }

      await prisma.trimJob.delete({
        where: { id: parseInt(id) },
      });

      return reply.send({
        success: true,
        message: 'Trim job deleted',
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
