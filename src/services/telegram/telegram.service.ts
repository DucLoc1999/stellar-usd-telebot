import { Bot } from 'grammy';
import { telegramConfig } from '../../config/app';
import { setupHandlers } from './handlers/setup';
import { NotificationService } from './notification.service';

export class TelegramService {
  private bot: Bot;
  public notificationService: NotificationService;

  constructor() {
    if (!telegramConfig.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
    this.bot = new Bot(telegramConfig.botToken);
    this.notificationService = new NotificationService(this.bot);
    setupHandlers(this.bot);
  }

  getBot(): Bot {
    return this.bot;
  }

  async start(): Promise<void> {
    await this.bot.start();
  }

  async sendOrderStatusUpdate(
    chatId: number,
    orderId: string,
    state: number,
    processingState?: number,
    transactionHash?: string
  ): Promise<void> {
    return this.notificationService.sendOrderStatusUpdate(
      chatId,
      orderId,
      state,
      processingState,
      transactionHash
    );
  }
}

export default new TelegramService();
