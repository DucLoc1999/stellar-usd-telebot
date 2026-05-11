import { InputFile } from 'grammy';
import { logger } from '../../config/logger';
import { sentMessages, newlyCreatedOrders, userCancelledOrders } from './user-state';

export interface OrderMessageSlots {
  chatId: number;
  mainMsgId?: number;
  notifyMsgId?: number;
}

export const orderMessageSlots = new Map<string, OrderMessageSlots>();

export function getOrderSlots(orderId: string): OrderMessageSlots | undefined {
  return orderMessageSlots.get(orderId);
}

export function initOrderSlots(orderId: string, chatId: number): OrderMessageSlots {
  const slots: OrderMessageSlots = { chatId };
  orderMessageSlots.set(orderId, slots);
  return slots;
}

export function setMainMsgId(orderId: string, msgId: number): void {
  const slots = orderMessageSlots.get(orderId);
  if (slots) {
    slots.mainMsgId = msgId;
  }
}

export function setNotifyMsgId(orderId: string, msgId: number): void {
  const slots = orderMessageSlots.get(orderId);
  if (slots) {
    slots.notifyMsgId = msgId;
  }
}

export function clearOrderSlots(orderId: string): void {
  orderMessageSlots.delete(orderId);
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
    await ctx.api.editMessageMedia(ctx.chat.id, slots.mainMsgId, {
      type: 'photo',
      media: photo,
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
  setTimeout(() => {
    sentMessages.delete(orderId);
    newlyCreatedOrders.delete(orderId);
    userCancelledOrders.delete(orderId);
    orderMessageSlots.delete(orderId);
    logger.debug({ orderId }, 'Cleaned up order tracking data');
  }, delayMs);
}
