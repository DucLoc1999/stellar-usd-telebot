import { Bot } from 'grammy';
import { Messages } from './messages';
import { userCancelledOrders, newlyCreatedOrders } from './user-state';
import { getOrderSlots, initOrderSlots, setNotifyMsgId } from './order-tracking';
import { Keyboards } from './keyboards';
import { logger } from '../../config/logger';
import teleUserService from '../teleUserService';

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

    const message = this.getOrderStateMessage(orderId, state, transactionHash);

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
    });

    setNotifyMsgId(orderId, msg.message_id);

    if (state === 3) {
      const user = await teleUserService.findByChatId(chatId);
      const firstName = user?.first_name || 'bạn';
      await this.bot.api.sendMessage(chatId, Messages.WELCOME(firstName), {
        parse_mode: 'HTML',
        reply_markup: await Keyboards.mainMenu(chatId),
      });
    }
  }

  private getOrderStateMessage(orderId: string, state: number, transactionHash?: string): string {
    switch (state) {
      case 1:
        return Messages.ORDER_STATE_CREATED(orderId);
      case 2:
        return Messages.ORDER_STATE_PROCESSING(orderId);
      case 3:
        return Messages.ORDER_STATE_COMPLETED(orderId, transactionHash);
      case 4:
        return Messages.ORDER_STATE_FAILED(orderId);
      case 5:
        return Messages.ORDER_STATE_CANCELLED(orderId);
      default:
        return Messages.ORDER_STATUS_UPDATE(orderId, `State ${state}`);
    }
  }
}
