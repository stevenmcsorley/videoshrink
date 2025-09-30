import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const prisma = new PrismaClient();

// Redis connection for BullMQ
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Create BullMQ queue for video compression
const videoQueue = new Queue('video-compression', {
  connection: redisConnection,
});

export default async function jobRoutes(fastify: FastifyInstance) {
  // POST /api/jobs - Create a new compression job
  fastify.post('/api/jobs', async (request, reply) => {
    const {
      fileId,
      preset,
      codec,
      crf,
      bitrate,
      resolution,
      targetSize,
    } = request.body as {
      fileId: number;
      preset?: 'high' | 'medium' | 'low';
      codec?: 'h264' | 'h265';
      crf?: number;
      bitrate?: string;
      resolution?: string;
      targetSize?: number;
    };

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

      // Create job in database
      const job = await prisma.job.create({
        data: {
          inputFile: file.path,
          fileName: file.originalName,
          fileSize: file.size,
          status: 'pending',
          progress: 0,
          preset,
          codec,
          crf,
          bitrate,
          resolution,
          targetSize,
        },
      });

      // Add job to BullMQ queue
      await videoQueue.add('compress-video', {
        jobId: job.id,
        inputFile: file.path,
        preset,
        codec,
        crf,
        bitrate,
        resolution,
        targetSize,
      });

      return reply.code(201).send({
        success: true,
        message: 'Compression job created',
        jobId: job.id,
        status: job.status,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to create job',
        message: error.message,
      });
    }
  });

  // GET /api/jobs - List all jobs
  fastify.get('/api/jobs', async (request, reply) => {
    const { status, limit = 50, offset = 0 } = request.query as {
      status?: string;
      limit?: number;
      offset?: number;
    };

    try {
      const where = status ? { status } : {};

      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.job.count({ where }),
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
        error: 'Failed to list jobs',
        message: error.message,
      });
    }
  });

  // GET /api/jobs/:id - Get job status
  fastify.get('/api/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.job.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No job found with ID: ${id}`,
        });
      }

      return reply.send({
        job,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get job',
        message: error.message,
      });
    }
  });

  // DELETE /api/jobs/:id - Cancel/delete job
  fastify.delete('/api/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.job.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No job found with ID: ${id}`,
        });
      }

      // If job is still in queue/processing, try to remove from queue
      if (job.status === 'pending' || job.status === 'processing') {
        // Update job status to cancelled
        await prisma.job.update({
          where: { id: parseInt(id) },
          data: {
            status: 'failed',
            error: 'Job cancelled by user',
          },
        });

        return reply.send({
          success: true,
          message: 'Job cancelled',
          jobId: job.id,
        });
      }

      // Delete completed/failed job
      await prisma.job.delete({
        where: { id: parseInt(id) },
      });

      return reply.send({
        success: true,
        message: 'Job deleted',
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

  // GET /api/jobs/:id/download - Download compressed file
  fastify.get('/api/jobs/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.job.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No job found with ID: ${id}`,
        });
      }

      if (job.status !== 'completed' || !job.outputFile) {
        return reply.code(400).send({
          error: 'Job not completed',
          message: 'Job has not completed successfully or output file is missing',
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

      // Send the actual file
      const fileName = job.fileName.replace(/\.[^.]+$/, '_compressed.mp4');

      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Type', 'video/mp4');

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
}
