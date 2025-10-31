import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import webhookController from '../controllers/webhookController';

export const webhookRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
): Promise<void> => {
  fastify.post(
    '/webhooks/payment',
    {
      schema: {
        description: 'Webhook endpoint for payment notifications from HSPay',
        tags: ['Webhooks'],
        body: {
          type: 'object',
          required: ['id', 'topic', 'ts', 'payload'],
          properties: {
            id: {
              type: 'string',
              description: 'Webhook event ID (UUID)',
            },
            topic: {
              type: 'string',
              description: 'Event topic',
            },
            ts: {
              type: 'string',
              description: 'Event timestamp (ISO 8601)',
            },
            payload: {
              type: 'object',
              required: ['order_id', 'old_order_state', 'new_order_state'],
              properties: {
                order_id: {
                  type: 'string',
                  description: 'Order ID (UUID)',
                },
                old_order_state: {
                  type: 'number',
                  description:
                    'Previous order state (1=Created, 2=Processing, 3=Completed, 4=Failed, 5=Closed)',
                },
                new_order_state: {
                  type: 'number',
                  description:
                    'New order state (1=Created, 2=Processing, 3=Completed, 4=Failed, 5=Closed)',
                },
                old_order_processing_state: {
                  type: 'number',
                  description: 'Previous processing state (10-16 for deposit orders, optional)',
                },
                new_order_processing_state: {
                  type: 'number',
                  description: 'New processing state (10-16 for deposit orders, optional)',
                },
              },
            },
          },
        },
        headers: {
          type: 'object',
          properties: {
            'Content-Type': {
              type: 'string',
              description: 'Must be application/json',
            },
            'User-Agent': {
              type: 'string',
              description: 'HSPay webhook dispatcher identifier',
            },
            'X-HSPay-Event-Topic': {
              type: 'string',
              description: 'Event topic (pay.order.status-updated)',
            },
            'X-HSPay-Event-Signature': {
              type: 'string',
              description: 'Base64 encoded ED25519 signature of request body',
            },
          },
        },
        response: {
          200: {
            description: 'Webhook processed successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          400: {
            description: 'Bad request - invalid headers or payload',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          401: {
            description: 'Unauthorized - invalid signature',
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
    webhookController.handlePaymentWebhook.bind(webhookController)
  );

  return Promise.resolve();
};

export default webhookRoutes;
