import { Bot } from 'grammy';
import { Messages } from './messages';
import { userCancelledOrders, newlyCreatedOrders } from './user-state';
import { getOrderSlots, initOrderSlots, setNotifyMsgId, clearMainMsgId } from './order-tracking';
import { Keyboards } from './keyboards';
import { logger } from '../../config/logger';
import db from '../../config/knex';
import { Usdt247OrderType, type Order, type Usdt247PaymentInfo } from '../../models/usdt247';
import teleUserService from '../teleUserService';

function parsePaymentInfo(paymentInfo: unknown): Usdt247PaymentInfo | null {
  if (!paymentInfo) return null;
  if (typeof paymentInfo === 'string') {
    try {
      return JSON.parse(paymentInfo) as Usdt247PaymentInfo;
    } catch {
      return null;
    }
  }
  return paymentInfo as Usdt247PaymentInfo;
}

export class NotificationService {
  constructor(private bot: Bot) {}

  async sendNotification(chatId: number, message: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      console.error(`Failed to send notification to ${chatId}:`, error);
    }
  }

  async sendOrderStatusUpdate(
    chatId: number,
    orderId: string,
    state: number,
    processingState?: number,
    transactionHash?: string
  ): Promise<void> {
    if (state === 5 && userCancelledOrders.has(orderId)) {
      logger.info(
        { chatId, orderId, state },
        'Skipping webhook notification for user-cancelled order'
      );
      userCancelledOrders.delete(orderId);
      return;
    }

    if (state === 1 && newlyCreatedOrders.has(orderId)) {
      logger.info({ chatId, orderId, state }, 'Skipping duplicate CREATED webhook notification');
      newlyCreatedOrders.delete(orderId);
      return;
    }

    const message = await this.getOrderStateMessage(orderId, state, transactionHash);

    logger.info(
      { chatId, orderId, state, processingState: processingState ?? 'N/A' },
      'Sending order state notification'
    );

    const slots = getOrderSlots(orderId);
    if (!slots) {
      initOrderSlots(orderId, chatId);
    } else if (slots.notifyMsgId) {
      try {
        await this.bot.api.deleteMessage(chatId, slots.notifyMsgId);
      } catch (err: any) {
        if (err?.error_code !== 403 && err?.error_code !== 400) {
          logger.warn(
            { orderId, msgId: slots.notifyMsgId, err },
            'Failed to delete old notify message'
          );
        }
      }
    }

    const msg = await this.bot.api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(state === 5 ? { reply_markup: await Keyboards.mainMenu(chatId) } : {}),
    });

    setNotifyMsgId(orderId, msg.message_id);

    if (state === 3) {
      const slotsAfterCompleted = getOrderSlots(orderId);
      if (slotsAfterCompleted?.mainMsgId) {
        try {
          await this.bot.api.deleteMessage(chatId, slotsAfterCompleted.mainMsgId);
        } catch (err: any) {
          if (err?.error_code !== 403 && err?.error_code !== 400) {
            logger.warn(
              { orderId, msgId: slotsAfterCompleted.mainMsgId, err },
              'Failed to delete main order summary message after completion'
            );
          }
        } finally {
          clearMainMsgId(orderId);
        }
      }
    }

    if (state === 5) {
      const slotsAfterNotify = getOrderSlots(orderId);
      if (slotsAfterNotify?.mainMsgId) {
        try {
          await this.bot.api.deleteMessage(chatId, slotsAfterNotify.mainMsgId);
        } catch (err: any) {
          if (err?.error_code !== 403 && err?.error_code !== 400) {
            logger.warn(
              { orderId, msgId: slotsAfterNotify.mainMsgId, err },
              'Failed to delete main order message for expired order'
            );
          }
        } finally {
          clearMainMsgId(orderId);
        }
      }
    }

    if (state === 3) {
      const user = await teleUserService.findByChatId(chatId);
      const firstName = user?.first_name || 'bạn';
      await this.bot.api.sendMessage(chatId, Messages.WELCOME(firstName), {
        parse_mode: 'HTML',
        reply_markup: await Keyboards.mainMenu(chatId),
      });
    }
  }

  private async getOrderStateMessage(
    orderId: string,
    state: number,
    transactionHash?: string
  ): Promise<string> {
    switch (state) {
      case 1:
        return Messages.ORDER_STATE_CREATED(orderId);
      case 2:
        return Messages.ORDER_STATE_PROCESSING(orderId);
      case 3: {
        const order = await db('orders').where('id', orderId).first<Order>();
        if (order) {
          const paymentInfo = parsePaymentInfo(order.payment_info);
          const orderType = Number(order.order_type);
          const assetCode = order.currency || 'USDC';

          if (orderType === Usdt247OrderType.DEPOSIT) {
            return Messages.ORDER_STATE_COMPLETED_BUY(
              order.id,
              order.amount,
              order.recipient,
              assetCode,
              transactionHash
            );
          }

          if (orderType === Usdt247OrderType.WITHDRAWAL) {
            return Messages.ORDER_STATE_COMPLETED_SELL(
              order.id,
              order.amount,
              Number(order.net_vnd ?? 0),
              paymentInfo?.account_number ?? 'N/A',
              assetCode,
              paymentInfo?.bank_id ?? null
            );
          }
        }

        return Messages.ORDER_STATE_COMPLETED(orderId, transactionHash);
      }
      case 4:
        return Messages.ORDER_STATE_FAILED(orderId);
      case 5:
        return Messages.ORDER_STATE_EXPIRED(orderId);
      default:
        return Messages.ORDER_STATUS_UPDATE(orderId, `State ${state}`);
    }
  }
}
