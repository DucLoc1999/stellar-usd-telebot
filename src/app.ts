import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { errorHandler } from './middlewares/errorHandler';
import helloRoutes from './routes/helloRoutes';
import { testConnection } from './config/database';
import logger from './utils/logger';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
  });

  // Register Swagger
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'Fastify TypeScript MySQL API',
        description: 'API documentation for Fastify TypeScript MySQL project',
        version: '1.0.0',
      },
      externalDocs: {
        url: 'https://swagger.io',
        description: 'Find more info here',
      },
      host: `localhost:${process.env.PORT || 3000}`,
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [{ name: 'Hello', description: 'Hello world endpoints' }],
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

  // Set error handler
  fastify.setErrorHandler(errorHandler);

  // Health check route
  fastify.get('/health', () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register API routes
  void fastify.register(helloRoutes, { prefix: '/api' });

  // Test database connection on startup
  fastify.addHook('onReady', async () => {
    try {
      await testConnection();
      logger.info('Database connection verified');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
    }
  });

  return fastify;
}

export default buildApp;
