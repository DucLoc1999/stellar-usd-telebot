import { logger } from '../../config/logger';
import { sentMessages, newlyCreatedOrders, userCancelledOrders } from './user-state';

export function hasMessageBeenSent(orderId: string, messageType: string): boolean {
  const orderMessages = sentMessages.get(orderId);
  return orderMessages ? orderMessages.has(messageType) : false;
}

export function markMessageAsSent(orderId: string, messageType: string): void {
  let orderMessages = sentMessages.get(orderId);
  if (!orderMessages) {
    orderMessages = new Set<string>();
    sentMessages.set(orderId, orderMessages);
  }
  orderMessages.add(messageType);
  logger.debug({ orderId, messageType }, 'Marked message as sent');
}

export function scheduleOrderTrackingCleanup(orderId: string, delayMs: number = 300000): void {
  setTimeout(() => {
    sentMessages.delete(orderId);
    newlyCreatedOrders.delete(orderId);
    userCancelledOrders.delete(orderId);
    logger.debug({ orderId }, 'Cleaned up order tracking data');
  }, delayMs);
}
