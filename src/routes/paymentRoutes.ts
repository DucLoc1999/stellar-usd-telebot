import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import paymentController from '../controllers/paymentController';

export const paymentRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
): Promise<void> => {
  fastify.post(
    '/payment/withdrawal',
    {
      schema: {
        description: 'Process a withdrawal request',
        tags: ['Payment'],
        body: {
          type: 'object',
          required: ['chat_id', 'amount', 'chain_id', 'token_address', 'callback', 'payment_info'],
          properties: {
            chat_id: {
              type: 'number',
              description: 'Telegram chat ID',
            },
            amount: {
              type: 'string',
              description: 'Withdrawal amount',
            },
            chain_id: {
              type: 'number',
              description: 'Blockchain chain ID',
            },
            token_address: {
              type: 'string',
              description: 'Token contract address',
            },
            callback: {
              type: 'string',
              description: 'Callback URL for payment status updates',
            },
            payment_info: {
              type: 'object',
              required: ['bank_id', 'full_name', 'account_type', 'account_number'],
              properties: {
                bank_id: {
                  type: 'number',
                  description: 'Bank ID',
                },
                full_name: {
                  type: 'string',
                  description: 'Account holder full name',
                },
                account_type: {
                  type: 'number',
                  description: 'Account type',
                },
                account_number: {
                  type: 'string',
                  description: 'Bank account number',
                },
              },
            },
          },
        },
        response: {
          200: {
            description: 'Successful withdrawal request',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  chat_id: { type: 'number' },
                  user_id: { type: 'string' },
                  order_type: { type: 'number' },
                  external_id: { type: ['string', 'null'] },
                  code: { type: 'string' },
                  provider: { type: 'number' },
                  callback: { type: 'string' },
                  amount: { type: 'string' },
                  currency: { type: 'string' },
                  rate: { type: 'string' },
                  token_address: { type: 'string' },
                  recipient: { type: 'string' },
                  chain_id: { type: 'number' },
                  partner_id: { type: 'string' },
                  state: { type: 'number' },
                  processing_state: { type: 'number' },
                  expired_at: { type: 'string', format: 'date-time' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                  client_ip: { type: 'string' },
                  outcome: { type: 'string' },
                  original_rate: { type: 'string' },
                  total_fee_vnd: { type: ['number', 'null'] },
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
          403: {
            description: 'Forbidden - KYC verification required',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          404: {
            description: 'Not found - User not found',
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
    paymentController.processWithdrawal.bind(paymentController)
  );

  fastify.post(
    '/payment/deposit',
    {
      schema: {
        description: 'Process a deposit request',
        tags: ['Payment'],
        body: {
          type: 'object',
          required: ['chat_id', 'amount', 'chain_id', 'token_address', 'recipient', 'callback'],
          properties: {
            chat_id: {
              type: 'number',
              description: 'Telegram chat ID',
            },
            amount: {
              type: 'string',
              description: 'Deposit amount',
            },
            chain_id: {
              type: 'number',
              description: 'Blockchain chain ID',
            },
            token_address: {
              type: 'string',
              description: 'Token contract address',
            },
            recipient: {
              type: 'string',
              description: 'Recipient wallet address',
            },
            callback: {
              type: 'string',
              description: 'Callback URL for payment status updates',
            },
          },
        },
        response: {
          200: {
            description: 'Successful deposit request',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  chat_id: { type: 'number' },
                  user_id: { type: 'string' },
                  order_type: { type: 'number' },
                  external_id: { type: ['string', 'null'] },
                  code: { type: 'string' },
                  provider: { type: 'number' },
                  callback: { type: 'string' },
                  amount: { type: 'string' },
                  currency: { type: 'string' },
                  rate: { type: 'string' },
                  token_address: { type: 'string' },
                  recipient: { type: 'string' },
                  chain_id: { type: 'number' },
                  partner_id: { type: 'string' },
                  state: { type: 'number' },
                  processing_state: { type: 'number' },
                  expired_at: { type: 'string', format: 'date-time' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                  client_ip: { type: 'string' },
                  outcome: { type: 'string' },
                  original_rate: { type: 'string' },
                  total_fee_vnd: { type: ['number', 'null'] },
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
          403: {
            description: 'Forbidden - KYC verification required',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
          404: {
            description: 'Not found - User not found',
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
    paymentController.processDeposit.bind(paymentController)
  );

  return Promise.resolve();
};

export default paymentRoutes;
