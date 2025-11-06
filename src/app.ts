import Fastify, { type FastifyInstance, type FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import { errorHandler } from './middlewares/errorHandler';
// Disabled for security: Direct API access to user management and payment routes
// import teleUserRoutes from './routes/teleUserRoutes';
// import paymentRoutes from './routes/paymentRoutes';
import webhookRoutes from './routes/webhookRoutes';
import telegramRoutes from './routes/telegramRoutes';
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

  // SECURITY: Disabled direct API access to user management and payment routes
  // These routes are disabled to prevent external API access while maintaining internal functionality
  // The Telegram bot and internal services use the service layer directly, not these HTTP endpoints
  // void fastify.register(teleUserRoutes, { prefix: '/api/v1' });
  // void fastify.register(paymentRoutes, { prefix: '/api/v1' });

  // Keep webhook and Telegram bot routes active for external integrations
  void fastify.register(webhookRoutes, { prefix: '/api' });
  void fastify.register(telegramRoutes, { prefix: '/api' });

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
