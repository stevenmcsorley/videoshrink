import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import uploadRoutes from './routes/upload.js';
import jobRoutes from './routes/jobs.js';
import progressRoutes from './routes/progress.js';
import presetRoutes from './routes/presets.js';
import convertRoutes from './routes/convert.js';
import audioRoutes from './routes/audio.js';
import trimRoutes from './routes/trim.js';
import gifRoutes from './routes/gif.js';
import thumbnailRoutes from './routes/thumbnail.js';

const fastify = Fastify({
  logger: true,
});

// Register plugins
await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Register multipart for file uploads
await fastify.register(multipart, {
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB max file size
  },
});

// Register routes
await fastify.register(uploadRoutes);
await fastify.register(jobRoutes);
await fastify.register(progressRoutes);
await fastify.register(presetRoutes);
await fastify.register(convertRoutes);
await fastify.register(audioRoutes);
await fastify.register(trimRoutes);
await fastify.register(gifRoutes);
await fastify.register(thumbnailRoutes);

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message: error.message,
  });
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '4001');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`✅ Backend API running on http://localhost:${port}`);
    console.log(`📋 Health check: http://localhost:${port}/health`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
