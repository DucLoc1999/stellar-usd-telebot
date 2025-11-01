import type { FastifyReply, FastifyRequest } from 'fastify';
import { webhookCallback } from 'grammy';
import telegramService from '../services/telegramService';
import { logger } from '../config/logger';

export class TelegramController {
  /**
   * Handle Telegram webhook updates
   * @param request Fastify request
   * @param reply Fastify reply
   */
  async handleWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      logger.info('Received Telegram webhook update');

      const bot = telegramService.getBot();

      // Use Grammy's webhookCallback to handle the update
      const handleUpdate = webhookCallback(bot, 'fastify');

      // Process the update
      await handleUpdate(request, reply);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Error processing Telegram webhook');

      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  }
}

export default new TelegramController();
