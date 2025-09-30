import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';

const prisma = new PrismaClient();

// Allowed video MIME types
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/x-msvideo',
  'video/quicktime',
  'video/x-matroska',
  'video/webm',
];

// Max file size: 2GB
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

export default async function uploadRoutes(fastify: FastifyInstance) {
  // Ensure upload directories exist
  const uploadsDir = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'uploads');
  const tempDir = path.join(uploadsDir, 'temp');
  const outputDir = path.join(uploadsDir, 'output');

  [uploadsDir, tempDir, outputDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // POST /api/upload - Upload video file
  fastify.post('/api/upload', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({
          error: 'No file uploaded',
          message: 'Please provide a video file',
        });
      }

      // Validate file type
      if (!ALLOWED_VIDEO_TYPES.includes(data.mimetype)) {
        return reply.code(400).send({
          error: 'Invalid file type',
          message: `Only video files are allowed. Received: ${data.mimetype}`,
          allowedTypes: ALLOWED_VIDEO_TYPES,
        });
      }

      // Validate file size (stream-based, checked during upload)
      let fileSize = 0;
      const filename = data.filename;
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFilename = `${Date.now()}-${sanitizedFilename}`;
      const filePath = path.join(tempDir, uniqueFilename);

      // Create write stream and track file size
      const writeStream = createWriteStream(filePath);

      // Monitor file size during upload
      data.file.on('data', (chunk: Buffer) => {
        fileSize += chunk.length;
        if (fileSize > MAX_FILE_SIZE) {
          data.file.destroy(new Error('File size exceeds 2GB limit'));
          writeStream.destroy();
          fs.unlinkSync(filePath); // Clean up partial file
        }
      });

      try {
        await pipeline(data.file, writeStream);
      } catch (error: any) {
        if (error.message.includes('File size exceeds')) {
          return reply.code(413).send({
            error: 'File too large',
            message: 'File size must not exceed 2GB',
            maxSize: MAX_FILE_SIZE,
          });
        }
        throw error;
      }

      // Create file upload record
      const fileUpload = await prisma.fileUpload.create({
        data: {
          filename: uniqueFilename,
          originalName: filename,
          mimeType: data.mimetype,
          size: fileSize,
          path: filePath,
        },
      });

      return reply.code(201).send({
        success: true,
        message: 'File uploaded successfully',
        fileId: fileUpload.id,
        filename: filename,
        size: fileSize,
        path: filePath,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Upload failed',
        message: error.message || 'An error occurred during file upload',
      });
    }
  });

  // GET /api/upload/status/:jobId - Get upload/job status
  fastify.get('/api/upload/status/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    try {
      const job = await prisma.job.findUnique({
        where: { id: parseInt(jobId) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No job found with ID: ${jobId}`,
        });
      }

      return reply.send({
        jobId: job.id,
        fileName: job.fileName,
        status: job.status,
        progress: job.progress,
        fileSize: job.fileSize,
        outputSize: job.outputSize,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to fetch job status',
        message: error.message,
      });
    }
  });
}
