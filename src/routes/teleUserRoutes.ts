import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import teleUserController from '../controllers/teleUserController';

export const teleUserRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
): Promise<void> => {
  fastify.post(
    '/users',
    {
      schema: {
        description: 'Create or update a Telegram user',
        tags: ['Users'],
        body: {
          type: 'object',
          required: ['chat_id', 'first_name', 'last_name', 'username'],
          properties: {
            chat_id: {
              type: 'number',
              description: 'Telegram chat ID',
            },
            first_name: {
              type: 'string',
              description: 'User first name',
            },
            last_name: {
              type: 'string',
              description: 'User last name',
            },
            username: {
              type: 'string',
              description: 'Telegram username',
            },
          },
        },
        response: {
          200: {
            description: 'Successful response',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  chat_id: { type: 'number' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                  username: { type: 'string' },
                  is_kyc: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          400: {
            description: 'Bad request - missing required fields',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          500: {
            description: 'Internal server error',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
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
        description: 'Get a Telegram user by chat ID',
        tags: ['Users'],
        params: {
          type: 'object',
          required: ['chat_id'],
          properties: {
            chat_id: {
              type: 'number',
              description: 'Telegram chat ID',
            },
          },
        },
        response: {
          200: {
            description: 'Successful response',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  chat_id: { type: 'number' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                  username: { type: 'string' },
                  is_kyc: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          400: {
            description: 'Bad request - missing required fields',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          500: {
            description: 'Internal server error',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
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
