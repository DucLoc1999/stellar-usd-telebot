import Fastify, { type FastifyInstance, type FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { errorHandler } from './middlewares/errorHandler';
import teleUserRoutes from './routes/teleUserRoutes';
import paymentRoutes from './routes/paymentRoutes';
import webhookRoutes from './routes/webhookRoutes';
import { testConnection } from './config/database';
import { logger } from './config/logger';
import { runMigrations } from './utils/migrationRunner';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: logger as FastifyBaseLogger,
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
  });

  // Swagger
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'USDT247',
        description: 'API documentation for Fastify TypeScript MySQL project',
        version: '1.0.0',
      },
      externalDocs: {
        url: 'https://swagger.io',
        description: 'Find more info here',
      },
      // Use URL_SWAGGER environment variable for production, fallback to localhost for development
      host: process.env.URL_SWAGGER
        ? process.env.URL_SWAGGER.replace(/^https?:\/\//, '').replace(/\/$/, '')
        : `localhost:${process.env.PORT || 3000}`,
      // HTTPS first for production, HTTP second for local development
      // Swagger uses the first scheme as the default for "Try it out" requests
      schemes: ['https', 'http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'Users', description: 'Telegram user management endpoints' },
        { name: 'Payment', description: 'Payment processing endpoints' },
        { name: 'Webhooks', description: 'Webhook endpoints for external notifications' },
      ],
    },
  });

  // Register Swagger UI
  await fastify.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  fastify.setErrorHandler(errorHandler);

  fastify.addHook('preSerialization', async (request, _reply, payload) => {
    request.responsePayload = payload;
    return payload;
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const responsePayload: unknown = request.responsePayload;

    request.log.info(
      {
        responseBody: responsePayload,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'Response sent'
    );
  });

  // check health
  fastify.get('/health', () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  void fastify.register(teleUserRoutes, { prefix: '/api/v1' });
  void fastify.register(paymentRoutes, { prefix: '/api/v1' });
  void fastify.register(webhookRoutes, { prefix: '/api' });

  // run migration on startup
  fastify.addHook('onReady', async () => {
    try {
      await runMigrations();

      await testConnection();
      logger.info('Database connection verified');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, 'Failed to connect to database');
      throw error;
    }
  });

  return fastify;
}

export default buildApp;
