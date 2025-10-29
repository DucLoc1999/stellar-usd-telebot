import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import helloController from '../controllers/helloController';

export const helloRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  fastify.get(
    '/hello',
    {
      schema: {
        description: 'Get hello world message',
        tags: ['Hello'],
        response: {
          200: {
            description: 'Successful response',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    helloController.getHello.bind(helloController)
  );
};

export default helloRoutes;
