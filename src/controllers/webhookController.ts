import type { FastifyReply, FastifyRequest } from 'fastify';
import webhookService from '../services/webhookService';
import telegramService from '../services/telegramService';
import type { WebhookEvent } from '../models/webhook';
import { logger } from '../config/logger';
import db from '../config/knex';
import type { Order } from '../models/usdt247';

export class WebhookController {
  /**
   * Handle payment webhook notification
   * @param request Fastify request
   * @param reply Fastify reply
   */
  async handlePaymentWebhook(
    request: FastifyRequest<{ Body: WebhookEvent }>,
    reply: FastifyReply
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Extract headers
      const contentType = request.headers['content-type'];
      const userAgent = request.headers['user-agent'];
      const eventTopic = request.headers['x-hspay-event-topic'];
      const eventSignature = request.headers['x-hspay-event-signature'];

      logger.info(
        {
          contentType,
          userAgent,
          eventTopic,
          hasSignature: !!eventSignature,
        },
        'Received webhook request'
      );

      // Validate required headers
      if (!contentType || contentType !== 'application/json') {
        logger.warn({ contentType }, 'Invalid Content-Type header');
        return reply.status(400).send({
          success: false,
          error: 'Invalid Content-Type. Expected application/json',
        });
      }

      if (!userAgent || !userAgent.startsWith('HSPay-Webhook-Dispatcher')) {
        logger.warn({ userAgent }, 'Invalid User-Agent header');
        return reply.status(400).send({
          success: false,
          error: 'Invalid User-Agent',
        });
      }

      if (!eventTopic || eventTopic !== 'pay.order.status-updated') {
        logger.warn({ eventTopic }, 'Invalid or unsupported event topic');
        return reply.status(400).send({
          success: false,
          error: 'Invalid or unsupported event topic',
        });
      }

      if (!eventSignature) {
        logger.warn('Missing X-HSPay-Event-Signature header');
        return reply.status(400).send({
          success: false,
          error: 'Missing signature header',
        });
      }

      // Get raw body for signature verification
      const rawBody = JSON.stringify(request.body);

      // Verify signature - ensure eventSignature is a string
      const signatureString: string = Array.isArray(eventSignature)
        ? eventSignature[0] || ''
        : eventSignature || '';
      const isValidSignature = webhookService.verifySignature(signatureString, rawBody);

      if (!isValidSignature) {
        logger.error(
          {
            eventId: request.body.id,
            orderId: request.body.payload?.order_id,
          },
          'Invalid webhook signature'
        );
        return reply.status(401).send({
          success: false,
          error: 'Invalid signature',
        });
      }

      logger.info({ eventId: request.body.id }, 'Webhook signature verified successfully');

      // Validate webhook event structure
      const event = request.body;
      if (!event.id || !event.topic || !event.ts || !event.payload) {
        logger.warn({ event }, 'Invalid webhook event structure');
        return reply.status(400).send({
          success: false,
          error: 'Invalid webhook event structure',
        });
      }

      // Validate payload structure
      const { payload } = event;
      if (
        !payload.order_id ||
        payload.old_order_state === undefined ||
        payload.new_order_state === undefined
      ) {
        logger.warn({ payload }, 'Invalid webhook payload structure');
        return reply.status(400).send({
          success: false,
          error: 'Invalid webhook payload structure',
        });
      }

      // Process the webhook event
      const stateChange = await webhookService.processWebhookEvent(event);

      const processingTime = Date.now() - startTime;

      const logData: Record<string, unknown> = {
        eventId: event.id,
        orderId: stateChange.orderId,
        stateTransition: `${webhookService.getStateName(stateChange.oldState)} -> ${webhookService.getStateName(stateChange.newState)}`,
        processingTimeMs: processingTime,
      };

      // Only log processing state transition if it exists
      if (stateChange.oldProcessingState && stateChange.newProcessingState) {
        logData.processingStateTransition = `${webhookService.getProcessingStateName(stateChange.oldProcessingState)} -> ${webhookService.getProcessingStateName(stateChange.newProcessingState)}`;
      }

      logger.info(logData, 'Webhook processed successfully');

      // Send Telegram notification to user
      try {
        const order = await db('orders').where('id', stateChange.orderId).first<Order>();
        if (order && order.chat_id) {
          await telegramService.sendOrderStatusUpdate(
            order.chat_id,
            stateChange.orderId,
            stateChange.newState,
            stateChange.newProcessingState
          );
          logger.info(
            { chatId: order.chat_id, orderId: stateChange.orderId },
            'Telegram notification sent'
          );
        }
      } catch (notificationError) {
        // Log but don't fail the webhook processing
        logger.error({ error: notificationError }, 'Failed to send Telegram notification');
      }

      // Return 200 OK to acknowledge receipt
      return reply.status(200).send({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        {
          error: errorMessage,
          eventId: request.body?.id,
          orderId: request.body?.payload?.order_id,
          processingTimeMs: processingTime,
        },
        'Error processing webhook'
      );

      // Still return 200 to prevent retries for application errors
      // Only return non-200 for validation errors (handled above)
      return reply.status(500).send({
        success: false,
        error: errorMessage,
      });
    }
  }
}

export default new WebhookController();
