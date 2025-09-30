/**
 * Real-time Progress Streaming
 * Provides Server-Sent Events (SSE) endpoint for job progress updates
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// Redis subscriber for progress updates
const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

export default async function progressRoutes(fastify: FastifyInstance) {
  // GET /api/jobs/:id/progress - Stream job progress via SSE
  fastify.get('/api/jobs/:id/progress', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const jobId = parseInt(id);

    // Set up SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 30000); // Every 30 seconds

    // Subscribe to job progress channel
    const channel = `job:${jobId}:progress`;
    const subscriber = redisSubscriber.duplicate();

    await subscriber.subscribe(channel);

    // Handle incoming progress messages
    subscriber.on('message', (ch: string, message: string) => {
      if (ch === channel) {
        try {
          const data = JSON.parse(message);
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);

          // Close connection if job is completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            setTimeout(() => {
              cleanup();
            }, 1000);
          }
        } catch (error: any) {
          fastify.log.error('Error parsing progress message:', error);
        }
      }
    });

    // Cleanup function
    const cleanup = () => {
      clearInterval(heartbeat);

      // Safely unsubscribe and quit
      if (subscriber.status === 'ready') {
        subscriber.unsubscribe(channel).catch(() => {}).finally(() => {
          subscriber.quit().catch(() => {});
        });
      }

      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
    };

    // Handle client disconnect
    request.raw.on('close', () => {
      cleanup();
    });
  });

  // GET /api/jobs/:id/progress/poll - Polling fallback (for browsers without SSE support)
  fastify.get('/api/jobs/:id/progress/poll', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const job = await prisma.job.findUnique({
        where: { id: parseInt(id) },
        select: {
          id: true,
          status: true,
          progress: true,
          error: true,
          outputFile: true,
        },
      });

      if (!job) {
        return reply.code(404).send({
          error: 'Job not found',
          message: `No job found with ID: ${id}`,
        });
      }

      return reply.send({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error,
        outputFile: job.outputFile,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'Failed to get job progress',
        message: error.message,
      });
    }
  });
}
