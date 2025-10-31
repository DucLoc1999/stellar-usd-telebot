import { verify, createPublicKey } from 'crypto';
import db from '../config/knex';
import { logger } from '../config/logger';
import type { WebhookEvent, OrderStateChange } from '../models/webhook';
import type { Order } from '../models/usdt247';

export class WebhookService {
  private readonly publicKey: string;

  constructor() {
    this.publicKey = process.env.WEBHOOK_PUBLIC_KEY || ''; // Default public key for testing
    if (!this.publicKey) {
      logger.warn('WEBHOOK_PUBLIC_KEY not configured - signature verification will fail');
    }
  }

  /**
   * Verify ED25519 signature of the webhook payload
   * @param signature Base64 encoded signature from X-HSPay-Event-Signature header
   * @param payload Raw request body as string
   * @returns true if signature is valid, false otherwise
   */
  verifySignature(signature: string, payload: string): boolean {
    try {
      if (!this.publicKey) {
        logger.error('Cannot verify signature: WEBHOOK_PUBLIC_KEY not configured');
        return false;
      }

      // Decode the base64-encoded Ed25519 public key (32 bytes)
      const publicKeyBytes = Buffer.from(this.publicKey, 'base64');

      // Decode the base64-encoded signature
      const signatureBuffer = Buffer.from(signature, 'base64');

      // Ed25519 public keys in Node.js crypto need to be in SPKI DER format
      // The SPKI format for Ed25519 is: 0x302a300506032b6570032100 + 32-byte public key
      // This is the ASN.1 DER encoding with Ed25519 OID (1.3.101.112)
      const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
      const spkiPublicKey = Buffer.concat([spkiPrefix, publicKeyBytes]);

      // Create public key object from raw Ed25519 bytes wrapped in SPKI format
      const publicKeyObject = createPublicKey({
        key: spkiPublicKey,
        format: 'der',
        type: 'spki',
      });

      // Verify ED25519 signature against the raw request body
      // For ED25519, we don't need to hash the data - the signature is over the raw data
      const isValid = verify(
        null, // ED25519 doesn't use a hash algorithm
        Buffer.from(payload, 'utf-8'),
        publicKeyObject,
        signatureBuffer
      );

      return isValid;
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
      13: 'Waiting for USDT transfer',
      14: 'USDT transfer confirmed',
      15: 'USDT failed to transfer',
      16: 'Waiting for admin approval',
    };
    return processingStateNames[processingState] || `Unknown (${processingState})`;
  }
}

export default new WebhookService();
