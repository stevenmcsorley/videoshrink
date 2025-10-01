import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const prisma = new PrismaClient();

// BullMQ Queue for thumbnail generation
const thumbnailQueue = new Queue('thumbnail-generation', {
  connection: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export default async function thumbnailRoutes(fastify: FastifyInstance) {
  // POST /api/thumbnail - Generate thumbnails from video
  fastify.post('/api/thumbnail', async (request, reply) => {
    fastify.log.info('Thumbnail upload started');
    try {
      // Handle multipart file upload
      const data = await request.file();
      fastify.log.info('File received');

      if (!data) {
        return reply.code(400).send({
          error: 'No file uploaded',
          message: 'Please provide a video file',
        });
      }

      // Get form fields
      const fields = data.fields as any;
      const count = fields.count ? parseInt(fields.count.value) : undefined;
      const width = fields.width ? parseInt(fields.width.value) : undefined;
      const timestamps = fields.timestamps ? JSON.parse(fields.timestamps.value) : undefined;

      if (!timestamps && !count) {
        return reply.code(400).send({
          error: 'Invalid request',
          message: 'Either timestamps or count must be provided',
        });
      }

      // Save the uploaded file
      const fs = await import('fs');
      const path = await import('path');
      const { pipeline } = await import('stream/promises');
      const uploadDir = process.env.UPLOAD_DIR || '/uploads/temp';

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const fileName = `${timestamp}-${randomId}-${data.filename}`;
      const filePath = path.join(uploadDir, fileName);

      // Write file to disk using streaming
      await pipeline(data.file, fs.createWriteStream(filePath));

      const fileSize = fs.statSync(filePath).size;
      fastify.log.info(`File saved: ${filePath}, size: ${fileSize}`);

      // Validate settings
      const thumbWidth = width && width >= 160 && width <= 1920 ? width : 320;
      const thumbCount = count && count >= 1 && count <= 50 ? count : (timestamps?.length || 1);

      if (thumbCount > 50) {
        return reply.code(400).send({
          error: 'Too many thumbnails',
          message: 'Cannot generate more than 50 thumbnails at once',
        });
      }

      // Create thumbnail job in database
      const job = await prisma.thumbnailJob.create({
        data: {
          inputFile: filePath,
          fileName: data.filename,
          fileSize: fileSize,
          timestamps: timestamps ? JSON.stringify(timestamps) : null,
          count: thumbCount,
          width: thumbWidth,
          status: 'pending',
          progress: 0,
        },
      });

      // Add job to BullMQ queue for processing
      await thumbnailQueue.add('generate-thumbnails', {
        jobId: job.id,
        inputFile: filePath,
        timestamps,
        count: thumbCount,
        width: thumbWidth,
      });

      return reply.code(201).send({
        success: true,
        message: 'Thumbnail generation job created',
        jobId: job.id,
        status: job.status,
        count: thumbCount,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to create thumbnail job',
        message: error.message,
      });
    }
  });

  // GET /api/thumbnail/jobs - List thumbnail jobs
  fastify.get('/api/thumbnail/jobs', async (request, reply) => {
    const { status, limit = 50, offset = 0 } = request.query as {
      status?: string;
      limit?: number;
      offset?: number;
    };

    try {
      const where = status ? { status } : {};

      const [jobs, total] = await Promise.all([
        prisma.thumbnailJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.thumbnailJob.count({ where }),
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
        error: 'Failed to list thumbnail jobs',
        message: error.message,
      });
    }
  });

  // GET /api/thumbnail/jobs/:id - Get thumbnail job status
  fastify.get('/api/thumbnail/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.thumbnailJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No thumbnail job found with ID: ${id}`,
        });
      }

      return reply.send({ job });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get thumbnail job',
        message: error.message,
      });
    }
  });

  // GET /api/thumbnail/jobs/:id/files - Get list of generated thumbnail files
  fastify.get('/api/thumbnail/jobs/:id/files', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.thumbnailJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No thumbnail job found with ID: ${id}`,
        });
      }

      if (job.status !== 'completed' || !job.outputFiles) {
        return reply.code(400).send({
          error: 'Job not completed',
          message: 'Thumbnail generation has not completed successfully',
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
        error: 'Failed to get thumbnail files',
        message: error.message,
      });
    }
  });

  // GET /api/thumbnail/jobs/:id/download/:index - Download specific thumbnail
  fastify.get('/api/thumbnail/jobs/:id/download/:index', async (request, reply) => {
    const { id, index } = request.params as { id: string; index: string };

    try {
      const job = await prisma.thumbnailJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No thumbnail job found with ID: ${id}`,
        });
      }

      if (job.status !== 'completed' || !job.outputFiles) {
        return reply.code(400).send({
          error: 'Job not completed',
          message: 'Thumbnail generation has not completed successfully',
        });
      }

      const files = JSON.parse(job.outputFiles);
      const fileIndex = parseInt(index);

      if (fileIndex < 0 || fileIndex >= files.length) {
        return reply.code(404).send({
          error: 'Invalid index',
          message: `Thumbnail index ${index} not found`,
        });
      }

      const filePath = files[fileIndex];

      // Check if file exists
      const fs = await import('fs');
      if (!fs.existsSync(filePath)) {
        return reply.code(404).send({
          error: 'File not found',
          message: 'The thumbnail file does not exist on the server',
        });
      }

      // Send the file
      const fileName = `${job.fileName.replace(/\.[^.]+$/, '')}_thumb_${fileIndex + 1}.jpg`;
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Type', 'image/jpeg');

      const stream = fs.createReadStream(filePath);
      return reply.send(stream);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to download thumbnail',
        message: error.message,
      });
    }
  });

  // DELETE /api/thumbnail/jobs/:id - Delete thumbnail job
  fastify.delete('/api/thumbnail/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.thumbnailJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No thumbnail job found with ID: ${id}`,
        });
      }

      // Delete output files if they exist
      if (job.outputFiles) {
        const fs = await import('fs');
        const files = JSON.parse(job.outputFiles);
        files.forEach((filePath: string) => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }

      await prisma.thumbnailJob.delete({
        where: { id: parseInt(id) },
      });

      return reply.send({
        success: true,
        message: 'Thumbnail job deleted',
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
