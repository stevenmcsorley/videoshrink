/**
 * Presets API
 * Returns available compression presets with FFmpeg parameters
 */

import { FastifyInstance } from 'fastify';

export interface CompressionPreset {
  id: string;
  name: string;
  description: string;
  codec: 'h264' | 'h265';
  crf: number;
  twoPass: boolean;
  recommendedUseCase: string;
  estimatedCompression: string;
  quality: 'high' | 'medium' | 'low';
  speed: 'fast' | 'medium' | 'slow';
}

// Preset configurations
const PRESETS: CompressionPreset[] = [
  {
    id: 'high',
    name: 'High Quality',
    description: 'Best quality with modern H.265 codec. Larger file size but excellent visual fidelity.',
    codec: 'h265',
    crf: 20,
    twoPass: true,
    recommendedUseCase: 'Professional videos, archival, content where quality is paramount',
    estimatedCompression: '40-60% reduction',
    quality: 'high',
    speed: 'slow',
  },
  {
    id: 'medium',
    name: 'Balanced Quality',
    description: 'Good balance between quality and file size using H.264 codec. Best for general use.',
    codec: 'h264',
    crf: 23,
    twoPass: false,
    recommendedUseCase: 'General purpose videos, web content, social media',
    estimatedCompression: '50-70% reduction',
    quality: 'medium',
    speed: 'medium',
  },
  {
    id: 'low',
    name: 'Maximum Compression',
    description: 'Smallest file size with acceptable quality. Great for bandwidth-constrained scenarios.',
    codec: 'h264',
    crf: 28,
    twoPass: false,
    recommendedUseCase: 'Mobile viewing, slow connections, storage optimization',
    estimatedCompression: '70-85% reduction',
    quality: 'low',
    speed: 'fast',
  },
];

export default async function presetRoutes(fastify: FastifyInstance) {
  // GET /api/presets - List all available presets
  fastify.get('/api/presets', async (request, reply) => {
    try {
      return reply.send({
        success: true,
        presets: PRESETS,
        total: PRESETS.length,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get presets',
        message: error.message,
      });
    }
  });

  // GET /api/presets/:id - Get specific preset details
  fastify.get('/api/presets/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const preset = PRESETS.find(p => p.id === id);

      if (!preset) {
        return reply.code(404).send({
          error: 'Preset not found',
          message: `No preset found with ID: ${id}`,
        });
      }

      return reply.send({
        success: true,
        preset,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get preset',
        message: error.message,
      });
    }
  });

  // GET /api/presets/:id/estimate - Estimate compression for a given file size
  fastify.get('/api/presets/:id/estimate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { fileSize } = request.query as { fileSize?: string };

    try {
      const preset = PRESETS.find(p => p.id === id);

      if (!preset) {
        return reply.code(404).send({
          error: 'Preset not found',
          message: `No preset found with ID: ${id}`,
        });
      }

      if (!fileSize) {
        return reply.code(400).send({
          error: 'Missing parameter',
          message: 'fileSize query parameter is required',
        });
      }

      const originalSize = parseInt(fileSize);
      if (isNaN(originalSize) || originalSize <= 0) {
        return reply.code(400).send({
          error: 'Invalid parameter',
          message: 'fileSize must be a positive number',
        });
      }

      // Estimate compression based on preset
      let reductionMin = 0;
      let reductionMax = 0;

      if (preset.id === 'high') {
        reductionMin = 0.4;
        reductionMax = 0.6;
      } else if (preset.id === 'medium') {
        reductionMin = 0.5;
        reductionMax = 0.7;
      } else if (preset.id === 'low') {
        reductionMin = 0.7;
        reductionMax = 0.85;
      }

      const estimatedMin = Math.round(originalSize * (1 - reductionMax));
      const estimatedMax = Math.round(originalSize * (1 - reductionMin));

      return reply.send({
        success: true,
        preset: preset.name,
        originalSize,
        estimatedSize: {
          min: estimatedMin,
          max: estimatedMax,
          average: Math.round((estimatedMin + estimatedMax) / 2),
        },
        estimatedReduction: {
          min: `${(reductionMin * 100).toFixed(0)}%`,
          max: `${(reductionMax * 100).toFixed(0)}%`,
        },
        unit: 'bytes',
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to estimate compression',
        message: error.message,
      });
    }
  });
}
