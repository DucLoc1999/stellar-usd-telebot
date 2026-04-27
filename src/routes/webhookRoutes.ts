import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import webhookController from '../controllers/webhookController';

export const webhookRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
): Promise<void> => {
  fastify.addHook('preParsing', async (request, _reply, payload) => {
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks);
    request.rawBody = raw.toString('utf-8');

    // Return a new readable stream from the same bytes
    const { Readable } = await import('stream');
    const stream = Readable.from(raw);
    return stream;
  });

  fastify.post(
    '/webhooks/payment',
    {
      schema: {
        body: {
          type: 'object',
          required: ['id', 'topic', 'ts', 'payload'],
          properties: {
            id: {
              type: 'string',
            },
            topic: {
              type: 'string',
            },
            ts: {
              type: 'string',
            },
            payload: {
              type: 'object',
              required: ['order_id', 'old_order_state', 'new_order_state'],
              properties: {
                order_id: {
                  type: 'string',
                },
                old_order_state: {
                  type: 'number',
                },
                new_order_state: {
                  type: 'number',
                },
                old_order_processing_state: {
                  type: 'number',
                },
                new_order_processing_state: {
                  type: 'number',
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
            },
            'X-Timestamp': {
              type: 'string',
            },
            'X-Signature': {
              type: 'string',
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
