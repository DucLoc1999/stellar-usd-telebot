import { createHmac, timingSafeEqual } from 'crypto';
import db from '../config/knex';
import { logger } from '../config/logger';
import type { WebhookEvent, OrderStateChange } from '../models/webhook';
import type { Order } from '../models/usdt247';

export class WebhookService {
  private readonly secret: string;

  constructor() {
    this.secret = process.env.WEBHOOK_PUBLIC_KEY || '';
    if (!this.secret) {
      logger.warn('WEBHOOK_PUBLIC_KEY not configured - signature verification will fail');
    }
  }

  verifySignature(signature: string, timestamp: string, payload: string): boolean {
    try {
      if (!this.secret) {
        logger.error('Cannot verify signature: WEBHOOK_PUBLIC_KEY not configured');
        return false;
      }

      const expected = createHmac('sha256', this.secret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      const expectedBuf = Buffer.from(expected);
      const actualBuf = Buffer.from(signature);

      if (expectedBuf.length !== actualBuf.length) return false;
      return timingSafeEqual(expectedBuf, actualBuf);
    } catch (error) {
      logger.error({ error }, 'Error verifying webhook signature');
      return false;
    }
  }

  /**
   * Process webhook event and update order state
   * @param event Webhook event data
   * @returns Order state change information
   */
  async processWebhookEvent(event: WebhookEvent): Promise<OrderStateChange> {
    const { payload, ts } = event;
    const {
      order_id,
      old_order_state,
      new_order_state,
      old_order_processing_state,
      new_order_processing_state,
    } = payload;

    logger.info(
      {
        orderId: order_id,
        oldState: old_order_state,
        newState: new_order_state,
        oldProcessingState: old_order_processing_state ?? '--',
        newProcessingState: new_order_processing_state ?? '--',
      },
      'Processing webhook event for order state change'
    );

    // Check if order exists
    const existingOrder = await db('orders').where('id', order_id).first<Order>();

    if (!existingOrder) {
      logger.error({ orderId: order_id }, 'Order not found for webhook event');
      throw new Error(`Order not found: ${order_id}`);
    }

    // Build update object - only update processing_state if provided
    const updateData: Record<string, unknown> = {
      state: new_order_state,
      updated_at: db.fn.now(),
    };

    if (new_order_processing_state !== undefined) {
      updateData.processing_state = new_order_processing_state;
    }

    // Update order state and optionally processing state
    await db('orders').where('id', order_id).update(updateData);

    logger.info(
      {
        orderId: order_id,
        previousState: old_order_state,
        newState: new_order_state,
        previousProcessingState: old_order_processing_state ?? 'N/A',
        newProcessingState: new_order_processing_state ?? 'N/A',
      },
      'Order state updated successfully'
    );

    return {
      orderId: order_id,
      oldState: old_order_state,
      newState: new_order_state,
      oldProcessingState: old_order_processing_state ?? 0,
      newProcessingState: new_order_processing_state ?? 0,
      timestamp: ts,
    };
  }

  /**
   * Get human-readable state name
   * @param state Order state number
   * @returns State name
   */
  getStateName(state: number): string {
    const stateNames: Record<number, string> = {
      1: 'Created',
      2: 'Processing',
      3: 'Completed',
      4: 'Failed',
      5: 'Closed/Cancelled',
    };
    return stateNames[state] || `Unknown (${state})`;
  }

  /**
   * Get human-readable processing state name
   * @param processingState Order processing state number
   * @returns Processing state name
   */
  getProcessingStateName(processingState: number): string {
    const processingStateNames: Record<number, string> = {
      10: 'Waiting for fiat deposit',
      11: 'Fiat deposit confirmed',
      12: 'Fiat failed to deposit',
      13: 'Waiting for USDC transfer',
      14: 'USDT transfer confirmed',
      15: 'USDT failed to transfer',
      16: 'Waiting for admin approval',
    };
    return processingStateNames[processingState] || `Unknown (${processingState})`;
  }
}

export default new WebhookService();
