/**
 * Webhook payload types for HSPay payment notifications
 */

/**
 * Order state enumeration
 */
export enum OrderState {
  CREATED = 1,
  PROCESSING = 2,
  COMPLETED = 3,
  FAILED = 4,
  CLOSED = 5,
}

/**
 * Order processing state enumeration for deposit orders
 */
export enum OrderProcessingState {
  WAITING_FIAT_DEPOSIT = 10,
  FIAT_CONFIRMED = 11,
  FIAT_FAILED = 12,
  WAITING_USDT_TRANSFER = 13,
  USDT_CONFIRMED = 14,
  USDT_FAILED = 15,
  WAITING_ADMIN_APPROVAL = 16,
}

/**
 * Webhook event payload structure
 */
export interface WebhookPayload {
  order_id: string;
  old_order_state: number;
  new_order_state: number;
  old_order_processing_state?: number;
  new_order_processing_state?: number;
}

/**
 * Complete webhook event structure
 */
export interface WebhookEvent {
  id: string;
  topic: string;
  ts: string;
  payload: WebhookPayload;
}

/**
 * Expected webhook headers
 */
export interface WebhookHeaders {
  'content-type': string;
  'user-agent': string;
  'x-hspay-event-topic': string;
  'x-hspay-event-signature': string;
}

/**
 * Order state change information
 */
export interface OrderStateChange {
  orderId: string;
  oldState: number;
  newState: number;
  oldProcessingState: number;
  newProcessingState: number;
  timestamp: string;
}
