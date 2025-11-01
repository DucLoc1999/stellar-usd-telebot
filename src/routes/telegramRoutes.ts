import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import telegramController from '../controllers/telegramController';

export const telegramRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
): Promise<void> => {
  fastify.post(
    '/telegram/webhook',
    {
      schema: {
        description: 'Telegram bot webhook endpoint',
        tags: ['telegram'],
        body: {
          type: 'object',
        },
      },
    },
    telegramController.handleWebhook.bind(telegramController)
  );

  return Promise.resolve();
};

export default telegramRoutes;

