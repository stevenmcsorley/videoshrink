import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  getAllFormats,
  getFormatsByCategory,
  getFormatByExtension,
  isConversionSupported,
  getRecommendedTargets,
} from '../config/formats.js';

const prisma = new PrismaClient();

// BullMQ Queue for format conversion
const conversionQueue = new Queue('format-conversion', {
  connection: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export interface ConversionPreset {
  id: string;
  name: string;
  description: string;
  speed: 'fast' | 'balanced' | 'slow';
  quality: 'low' | 'medium' | 'high';
  ffmpegParams: {
    video?: {
      codec: string;
      preset?: string;
      crf?: number;
      bitrate?: string;
    };
    audio?: {
      codec: string;
      bitrate: string;
      sampleRate?: string;
    };
  };
}

const CONVERSION_PRESETS: ConversionPreset[] = [
  {
    id: 'fast',
    name: 'Fast',
    description: 'Quick conversion with lower quality',
    speed: 'fast',
    quality: 'low',
    ffmpegParams: {
      video: {
        codec: 'libx264',
        preset: 'veryfast',
        crf: 28,
      },
      audio: {
        codec: 'aac',
        bitrate: '128k',
      },
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Good balance between speed and quality',
    speed: 'balanced',
    quality: 'medium',
    ffmpegParams: {
      video: {
        codec: 'libx264',
        preset: 'medium',
        crf: 23,
      },
      audio: {
        codec: 'aac',
        bitrate: '192k',
      },
    },
  },
  {
    id: 'high-quality',
    name: 'High Quality',
    description: 'Best quality, slower conversion',
    speed: 'slow',
    quality: 'high',
    ffmpegParams: {
      video: {
        codec: 'libx264',
        preset: 'slow',
        crf: 18,
      },
      audio: {
        codec: 'aac',
        bitrate: '256k',
      },
    },
  },
  {
    id: 'web-optimized',
    name: 'Web Optimized',
    description: 'Optimized for web streaming (WebM/VP9)',
    speed: 'balanced',
    quality: 'medium',
    ffmpegParams: {
      video: {
        codec: 'libvpx-vp9',
        bitrate: '1M',
      },
      audio: {
        codec: 'libopus',
        bitrate: '128k',
      },
    },
  },
  {
    id: 'audio-lossless',
    name: 'Audio Lossless',
    description: 'Lossless audio conversion (FLAC)',
    speed: 'fast',
    quality: 'high',
    ffmpegParams: {
      audio: {
        codec: 'flac',
        bitrate: '0', // lossless
      },
    },
  },
  {
    id: 'audio-compressed',
    name: 'Audio Compressed',
    description: 'High quality compressed audio (MP3/AAC)',
    speed: 'fast',
    quality: 'medium',
    ffmpegParams: {
      audio: {
        codec: 'libmp3lame',
        bitrate: '320k',
      },
    },
  },
];

export default async function convertRoutes(fastify: FastifyInstance) {
  // GET /api/convert/formats - Get all supported formats
  fastify.get('/api/convert/formats', async (request, reply) => {
    const { category } = request.query as { category?: 'video' | 'audio' };

    try {
      const formats = category ? getFormatsByCategory(category) : getAllFormats();

      return reply.send({
        formats,
        total: formats.length,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get formats',
        message: error.message,
      });
    }
  });

  // GET /api/convert/presets - Get conversion presets
  fastify.get('/api/convert/presets', async (request, reply) => {
    const { type } = request.query as { type?: 'video' | 'audio' };

    try {
      let presets = CONVERSION_PRESETS;

      // Filter presets based on type
      if (type === 'video') {
        presets = presets.filter((p) => p.ffmpegParams.video !== undefined);
      } else if (type === 'audio') {
        presets = presets.filter((p) => p.ffmpegParams.audio !== undefined);
      }

      return reply.send({
        presets,
        total: presets.length,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get presets',
        message: error.message,
      });
    }
  });

  // POST /api/convert/check - Check if conversion is supported
  fastify.post('/api/convert/check', async (request, reply) => {
    const { from, to } = request.body as { from: string; to: string };

    if (!from || !to) {
      return reply.code(400).send({
        error: 'Invalid request',
        message: 'Both "from" and "to" formats are required',
      });
    }

    try {
      const supported = isConversionSupported(from, to);
      const fromFormat = getFormatByExtension(from);
      const toFormat = getFormatByExtension(to);

      if (!fromFormat) {
        return reply.code(400).send({
          error: 'Invalid format',
          message: `Source format "${from}" is not supported`,
        });
      }

      if (!toFormat) {
        return reply.code(400).send({
          error: 'Invalid format',
          message: `Target format "${to}" is not supported`,
        });
      }

      const recommended = getRecommendedTargets(from);

      return reply.send({
        supported,
        from: fromFormat,
        to: toFormat,
        recommended: recommended.map((f) => f.extension),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to check conversion',
        message: error.message,
      });
    }
  });

  // GET /api/convert/recommended/:format - Get recommended target formats
  fastify.get('/api/convert/recommended/:format', async (request, reply) => {
    const { format } = request.params as { format: string };

    try {
      const recommended = getRecommendedTargets(format);

      if (recommended.length === 0) {
        return reply.code(404).send({
          error: 'Format not found',
          message: `No recommended conversions for format "${format}"`,
        });
      }

      return reply.send({
        sourceFormat: format,
        recommended,
        total: recommended.length,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get recommendations',
        message: error.message,
      });
    }
  });

  // POST /api/convert/jobs - Create conversion job
  fastify.post('/api/convert/jobs', async (request, reply) => {
    const { fileId, fromFormat, toFormat, preset, videoCodec, audioCodec } = request.body as {
      fileId: number;
      fromFormat: string;
      toFormat: string;
      preset?: string;
      videoCodec?: string;
      audioCodec?: string;
    };

    if (!fromFormat || !toFormat) {
      return reply.code(400).send({
        error: 'Invalid request',
        message: 'Both fromFormat and toFormat are required',
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

      // Check if conversion is supported
      if (!isConversionSupported(fromFormat, toFormat)) {
        return reply.code(400).send({
          error: 'Conversion not supported',
          message: `Cannot convert from ${fromFormat} to ${toFormat}`,
        });
      }

      // Create conversion job in database
      const job = await prisma.conversionJob.create({
        data: {
          inputFile: file.path,
          fileName: file.originalName,
          fileSize: file.size,
          fromFormat,
          toFormat,
          preset,
          videoCodec,
          audioCodec,
          status: 'pending',
          progress: 0,
        },
      });

      // Add job to BullMQ queue for processing
      await conversionQueue.add('convert-file', {
        jobId: job.id,
        inputFile: file.path,
        fromFormat,
        toFormat,
        preset,
        videoCodec,
        audioCodec,
      });

      return reply.code(201).send({
        success: true,
        message: 'Conversion job created',
        jobId: job.id,
        status: job.status,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to create conversion job',
        message: error.message,
      });
    }
  });

  // GET /api/convert/jobs - List conversion jobs
  fastify.get('/api/convert/jobs', async (request, reply) => {
    const { status, limit = 50, offset = 0 } = request.query as {
      status?: string;
      limit?: number;
      offset?: number;
    };

    try {
      const where = status ? { status } : {};

      const [jobs, total] = await Promise.all([
        prisma.conversionJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.conversionJob.count({ where }),
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
        error: 'Failed to list conversion jobs',
        message: error.message,
      });
    }
  });

  // GET /api/convert/jobs/:id - Get conversion job status
  fastify.get('/api/convert/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.conversionJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No conversion job found with ID: ${id}`,
        });
      }

      return reply.send({ job });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get conversion job',
        message: error.message,
      });
    }
  });

  // GET /api/convert/jobs/:id/download - Download converted file
  fastify.get('/api/convert/jobs/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.conversionJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No conversion job found with ID: ${id}`,
        });
      }

      if (job.status !== 'completed' || !job.outputFile) {
        return reply.code(400).send({
          error: 'Job not completed',
          message: 'Conversion has not completed successfully',
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
      const fileName = job.fileName.replace(/\.[^.]+$/, `.${job.toFormat}`);
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

  // GET /api/convert/jobs/:id/thumbnail - Get conversion job thumbnail
  fastify.get('/api/convert/jobs/:id/thumbnail', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.conversionJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No conversion job found with ID: ${id}`,
        });
      }

      if (!job.thumbnailPath) {
        return reply.code(404).send({
          error: 'Thumbnail not found',
          message: 'No thumbnail available for this job',
        });
      }

      // Check if thumbnail file exists
      const fs = await import('fs');
      if (!fs.existsSync(job.thumbnailPath)) {
        return reply.code(404).send({
          error: 'Thumbnail file not found',
          message: 'The thumbnail file does not exist on the server',
        });
      }

      // Send the thumbnail
      reply.header('Content-Type', 'image/jpeg');
      reply.header('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

      const stream = fs.createReadStream(job.thumbnailPath);
      return reply.send(stream);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get thumbnail',
        message: error.message,
      });
    }
  });

  // DELETE /api/convert/jobs/:id - Delete conversion job
  fastify.delete('/api/convert/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.conversionJob.findUnique({
        where: { id: parseInt(id) },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No conversion job found with ID: ${id}`,
        });
      }

      await prisma.conversionJob.delete({
        where: { id: parseInt(id) },
      });

      return reply.send({
        success: true,
        message: 'Conversion job deleted',
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
