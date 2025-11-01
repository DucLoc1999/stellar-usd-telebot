import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import teleUserController from '../controllers/teleUserController';

export const teleUserRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
): Promise<void> => {
  fastify.post(
    '/users',
    {
      schema: {
        body: {
          type: 'object',
          required: ['chat_id', 'username'],
          properties: {
            chat_id: {
              type: 'number',
            },
            first_name: {
              type: 'string',
            },
            last_name: {
              type: 'string',
            },
            username: {
              type: 'string',
            },
          },
        },
      },
    },
    teleUserController.createOrUpdateUser.bind(teleUserController)
  );

  fastify.get(
    '/users/:chat_id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['chat_id'],
          properties: {
            chat_id: {
              type: 'number',
            },
          },
        },
      },
    },
    teleUserController.getUserByChatId.bind(teleUserController)
  );

  return Promise.resolve();
};

export default teleUserRoutes;
