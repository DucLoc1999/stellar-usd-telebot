import { Bot } from 'grammy';
import { Messages } from './messages';
import { userCancelledOrders, newlyCreatedOrders } from './user-state';
import { logger } from '../../config/logger';

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

    if (state === 2 && newlyCreatedOrders.has(orderId)) {
      logger.info({ chatId, orderId, state }, 'Skipping initial PROCESSING webhook notification');
      newlyCreatedOrders.delete(orderId);
      return;
    }

    const message = this.getOrderStateMessage(orderId, state, transactionHash);

    logger.info(
      { chatId, orderId, state, processingState: processingState ?? 'N/A' },
      'Sending order state notification'
    );

    await this.sendNotification(chatId, message);
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
