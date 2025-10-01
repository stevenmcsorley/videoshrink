import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const prisma = new PrismaClient();

// BullMQ Queue for audio extraction
const audioQueue = new Queue('audio-extraction', {
  connection: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export interface AudioFormat {
  extension: string;
  name: string;
  codec: string;
  bitrates: string[];
  description: string;
}

const AUDIO_FORMATS: AudioFormat[] = [
  {
    extension: 'mp3',
    name: 'MP3',
    codec: 'libmp3lame',
    bitrates: ['128k', '192k', '256k', '320k'],
    description: 'Universal audio format, widely compatible',
  },
  {
    extension: 'aac',
    name: 'AAC',
    codec: 'aac',
    bitrates: ['128k', '192k', '256k', '320k'],
    description: 'High-quality compressed audio',
  },
  {
    extension: 'm4a',
    name: 'M4A',
    codec: 'aac',
    bitrates: ['128k', '192k', '256k', '320k'],
    description: 'AAC audio in MP4 container',
  },
  {
    extension: 'flac',
    name: 'FLAC',
    codec: 'flac',
    bitrates: ['lossless'],
    description: 'Lossless audio compression',
  },
  {
    extension: 'wav',
    name: 'WAV',
    codec: 'pcm_s16le',
    bitrates: ['lossless'],
    description: 'Uncompressed audio',
  },
  {
    extension: 'ogg',
    name: 'OGG Vorbis',
    codec: 'libvorbis',
    bitrates: ['128k', '192k', '256k'],
    description: 'Open-source compressed audio',
  },
  {
    extension: 'opus',
    name: 'Opus',
    codec: 'libopus',
    bitrates: ['64k', '96k', '128k', '192k'],
    description: 'Efficient audio codec for web',
  },
];

export default async function audioRoutes(fastify: FastifyInstance) {
  // GET /api/audio/formats - Get supported audio formats
  fastify.get('/api/audio/formats', async (request, reply) => {
    return reply.send({
      formats: AUDIO_FORMATS,
      total: AUDIO_FORMATS.length,
    });
  });

  // POST /api/audio/extract - Create audio extraction job
  fastify.post('/api/audio/extract', async (request, reply) => {
    const { fileId, format, bitrate } = request.body as {
      fileId: number;
      format: string;
      bitrate?: string;
    };

    if (!fileId || !format) {
      return reply.code(400).send({
        error: 'Invalid request',
        message: 'fileId and format are required',
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

      // Validate format
      const audioFormat = AUDIO_FORMATS.find((f) => f.extension === format);
      if (!audioFormat) {
        return reply.code(400).send({
          error: 'Invalid format',
          message: `Audio format "${format}" is not supported`,
        });
      }

      // Validate bitrate if provided
      if (bitrate && !audioFormat.bitrates.includes(bitrate)) {
        return reply.code(400).send({
          error: 'Invalid bitrate',
          message: `Bitrate "${bitrate}" is not supported for ${format}. Available: ${audioFormat.bitrates.join(', ')}`,
        });
      }

      // Create audio extraction job in database
      const job = await prisma.audioExtractionJob.create({
        data: {
          inputFile: file.path,
          fileName: file.originalName,
          fileSize: file.size,
          outputFormat: format,
          audioCodec: audioFormat.codec,
          bitrate: bitrate || audioFormat.bitrates[0],
          status: 'pending',
          progress: 0,
        },
      });

      // Add job to BullMQ queue for processing
      await audioQueue.add('extract-audio', {
        jobId: job.id,
        inputFile: file.path,
        outputFormat: format,
        audioCodec: audioFormat.codec,
        bitrate: bitrate || audioFormat.bitrates[0],
      });

      return reply.code(201).send({
        success: true,
        message: 'Audio extraction job created',
        jobId: job.id,
        status: job.status,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to create audio extraction job',
        message: error.message,
      });
    }
  });

  // GET /api/audio/jobs - List audio extraction jobs
  fastify.get('/api/audio/jobs', async (request, reply) => {
    const { status, limit = 50, offset = 0 } = request.query as {
      status?: string;
      limit?: number;
      offset?: number;
    };

    try {
      const where = status ? { status } : {};

      const [jobs, total] = await Promise.all([
        prisma.audioExtractionJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.audioExtractionJob.count({ where }),
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
        error: 'Failed to list audio extraction jobs',
        message: error.message,
      });
    }
  });

  // GET /api/audio/jobs/:id - Get audio extraction job status
  fastify.get('/api/audio/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.audioExtractionJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No audio extraction job found with ID: ${id}`,
        });
      }

      return reply.send({ job });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get audio extraction job',
        message: error.message,
      });
    }
  });

  // GET /api/audio/jobs/:id/download - Download extracted audio file
  fastify.get('/api/audio/jobs/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.audioExtractionJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No audio extraction job found with ID: ${id}`,
        });
      }

      if (job.status !== 'completed' || !job.outputFile) {
        return reply.code(400).send({
          error: 'Job not completed',
          message: 'Audio extraction has not completed successfully',
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
      const fileName = job.fileName.replace(/\.[^.]+$/, `.${job.outputFormat}`);
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

  // DELETE /api/audio/jobs/:id - Delete audio extraction job
  fastify.delete('/api/audio/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.audioExtractionJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No audio extraction job found with ID: ${id}`,
        });
      }

      // Delete output file if it exists
      if (job.outputFile) {
        const fs = await import('fs');
        if (fs.existsSync(job.outputFile)) {
          fs.unlinkSync(job.outputFile);
        }
      }

      await prisma.audioExtractionJob.delete({
        where: { id: parseInt(id) },
      });

      return reply.send({
        success: true,
        message: 'Audio extraction job deleted',
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
