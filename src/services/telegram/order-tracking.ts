import { InputFile } from 'grammy';
import { logger } from '../../config/logger';
import { sentMessages, newlyCreatedOrders, userCancelledOrders } from './user-state';

export interface OrderMessageSlots {
  chatId: number;
  mainMsgId?: number;
  notifyMsgId?: number;
}

const ORDER_SLOTS_TTL_MS = 5 * 60 * 1000;
const ORDER_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface TimedOrderSlots {
  slots: OrderMessageSlots;
  expiresAt: number;
}

export const orderMessageSlots = new Map<string, TimedOrderSlots>();

const pendingTimers = new Map<string, NodeJS.Timeout>();

function cleanupExpiredOrderSlots(): void {
  const now = Date.now();
  let deletedCount = 0;
  for (const [orderId, timedSlots] of orderMessageSlots) {
    if (timedSlots.expiresAt <= now) {
      orderMessageSlots.delete(orderId);
      const timer = pendingTimers.get(orderId);
      if (timer) {
        clearTimeout(timer);
        pendingTimers.delete(orderId);
      }
      deletedCount++;
    }
  }
  if (deletedCount > 0) {
    logger.debug(
      { deletedCount, remaining: orderMessageSlots.size },
      'Cleaned up expired order slots'
    );
  }
}

setInterval(cleanupExpiredOrderSlots, ORDER_CLEANUP_INTERVAL_MS);

export function getOrderSlots(orderId: string): OrderMessageSlots | undefined {
  const timedSlots = orderMessageSlots.get(orderId);
  if (!timedSlots) return undefined;
  if (timedSlots.expiresAt <= Date.now()) {
    orderMessageSlots.delete(orderId);
    pendingTimers.delete(orderId);
    return undefined;
  }
  return timedSlots.slots;
}

export function initOrderSlots(orderId: string, chatId: number): OrderMessageSlots {
  const slots: OrderMessageSlots = { chatId };
  orderMessageSlots.set(orderId, {
    slots,
    expiresAt: Date.now() + ORDER_SLOTS_TTL_MS,
  });
  return slots;
}

export function setMainMsgId(orderId: string, msgId: number): void {
  const timedSlots = orderMessageSlots.get(orderId);
  if (timedSlots) {
    timedSlots.slots.mainMsgId = msgId;
    timedSlots.expiresAt = Date.now() + ORDER_SLOTS_TTL_MS;
  }
}

export function setNotifyMsgId(orderId: string, msgId: number): void {
  const timedSlots = orderMessageSlots.get(orderId);
  if (timedSlots) {
    timedSlots.slots.notifyMsgId = msgId;
    timedSlots.expiresAt = Date.now() + ORDER_SLOTS_TTL_MS;
  }
}

export function clearMainMsgId(orderId: string): void {
  const timedSlots = orderMessageSlots.get(orderId);
  if (timedSlots) {
    timedSlots.slots.mainMsgId = undefined;
    timedSlots.expiresAt = Date.now() + ORDER_SLOTS_TTL_MS;
  }
}

export function clearOrderSlots(orderId: string): void {
  orderMessageSlots.delete(orderId);
  const timer = pendingTimers.get(orderId);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(orderId);
  }
}

export async function sendMainMessage(
  ctx: any,
  orderId: string,
  photo: InputFile | string,
  caption: string,
  replyMarkup?: any
): Promise<number | null> {
  const slots = getOrderSlots(orderId);
  const chatId = ctx.chat?.id;

  if (!chatId) return null;

  if (!slots) {
    initOrderSlots(orderId, chatId);
  } else if (slots.mainMsgId) {
    try {
      await ctx.api.deleteMessage(slots.mainMsgId);
    } catch (err: any) {
      if (err?.error_code !== 403 && err?.error_code !== 400) {
        logger.warn({ orderId, msgId: slots.mainMsgId, err }, 'Failed to delete old main message');
      }
    }
  }

  const msg = await ctx.replyWithPhoto(photo, { caption, parse_mode: 'HTML', replyMarkup });
  setMainMsgId(orderId, msg.message_id);
  return msg.message_id;
}

export async function updateMainMessage(
  ctx: any,
  orderId: string,
  photo: InputFile | string,
  caption: string,
  replyMarkup?: any
): Promise<number | null> {
  const slots = getOrderSlots(orderId);
  if (!slots?.mainMsgId) {
    return sendMainMessage(ctx, orderId, photo, caption, replyMarkup);
  }

  try {
    const mediaContent = typeof photo === 'string' ? { url: photo } : photo;
    await ctx.api.editMessageMedia(ctx.chat.id, slots.mainMsgId, {
      type: 'photo',
      media: mediaContent,
      caption,
      parse_mode: 'HTML',
    });

    await ctx.api.editMessageReplyMarkup(ctx.chat.id, slots.mainMsgId, {
      reply_markup: replyMarkup,
    });

    return slots.mainMsgId;
  } catch (err: any) {
    logger.warn(
      { orderId, msgId: slots.mainMsgId, err },
      'Failed to update main message, sending new'
    );
    return sendMainMessage(ctx, orderId, photo, caption, replyMarkup);
  }
}

export async function sendNotifyMessage(
  ctx: any,
  orderId: string,
  text: string,
  replyMarkup?: any
): Promise<number | null> {
  return sendOrderNotice(ctx, orderId, text, replyMarkup);
}

export async function sendOrderNotice(
  ctx: any,
  orderId: string,
  text: string,
  replyMarkup?: any
): Promise<number | null> {
  const chatId = ctx.chat?.id;
  if (!chatId) return null;

  const slots = getOrderSlots(orderId);

  if (!slots) {
    initOrderSlots(orderId, chatId);
  } else if (slots.notifyMsgId) {
    try {
      await ctx.api.deleteMessage(slots.notifyMsgId);
    } catch (err: any) {
      if (err?.error_code !== 403 && err?.error_code !== 400) {
        logger.warn(
          { orderId, msgId: slots.notifyMsgId, err },
          'Failed to delete old notify message'
        );
      }
    }
  }

  const msg = await ctx.reply(text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: replyMarkup,
  });

  setNotifyMsgId(orderId, msg.message_id);
  return msg.message_id;
}

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
  const existingTimer = pendingTimers.get(orderId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = setTimeout(() => {
    sentMessages.delete(orderId);
    newlyCreatedOrders.delete(orderId);
    userCancelledOrders.delete(orderId);
    orderMessageSlots.delete(orderId);
    pendingTimers.delete(orderId);
    logger.debug({ orderId }, 'Cleaned up order tracking data');
  }, delayMs);
  pendingTimers.set(orderId, timer);
}

export function cancelOrderTrackingCleanup(orderId: string): void {
  const timer = pendingTimers.get(orderId);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(orderId);
  }
}

export function clearAllPendingTimers(): void {
  for (const timer of pendingTimers.values()) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
}
