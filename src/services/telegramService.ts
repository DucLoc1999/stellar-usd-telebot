import { Bot, InlineKeyboard, InputFile } from 'grammy';
import { telegramConfig } from '../config/app';
import paymentService from './paymentService';

/**
 * Message Templates (Vietnamese)
 */
export const Messages = {
  WELCOME: (firstName: string) =>
    `👋 Xin chào <b>${firstName}</b>!\n\n` +
    `🤖 Chào mừng bạn đến với Bot Mua/Bán USDT tự động!\n\n` +
    `💰 Tỷ giá cạnh tranh nhất thị trường\n` +
    `⚡️ Giao dịch nhanh chóng, an toàn\n` +
    `🔒 Bảo mật tuyệt đối\n\n` +
    `Vui lòng chọn chức năng bên dưới:`,

  BUY_SELECT_AMOUNT: () =>
    `💰 <b>MUA USDT</b>\n\n` + `Vui lòng nhập số lượng USDT muốn mua (VD: 100):`,

  SELL_SELECT_AMOUNT: () =>
    `💸 <b>BÁN USDT</b>\n\n` + `Vui lòng nhập số lượng USDT muốn bán (VD: 100):`,

  ENTER_WALLET_ADDRESS: () =>
    `📮 <b>NHẬP ĐỊA CHỈ VÍ</b>\n\n` +
    `Vui lòng nhập địa chỉ ví BSC (BEP-20) để nhận USDT:\n\n` +
    `⚠️ Lưu ý: Kiểm tra kỹ địa chỉ ví trước khi gửi!`,

  INVALID_AMOUNT: () => `❌ Số lượng không hợp lệ!\n\n` + `Vui lòng nhập số hợp lệ (VD: 100)`,

  INVALID_WALLET: () =>
    `❌ Địa chỉ ví không hợp lệ!\n\n` + `Vui lòng nhập địa chỉ ví BSC hợp lệ (0x...)`,

  ORDER_SUMMARY_BUY: (amount: string, wallet: string) =>
    `📋 <b>XÁC NHẬN ĐƠN HÀNG - MUA USDT</b>\n\n` +
    `💎 Số lượng: <b>${amount} USDT</b>\n` +
    `📮 Địa chỉ ví nhận: <code>${wallet}</code>\n` +
    `🌐 Mạng: BNB Chain (BSC)\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi thanh toán!`,

  ORDER_SUMMARY_SELL: (amount: string) =>
    `📋 <b>XÁC NHẬN ĐƠN HÀNG - BÁN USDT</b>\n\n` +
    `💎 Số lượng: <b>${amount} USDT</b>\n` +
    `🌐 Mạng: BNB Chain (BSC)\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi chuyển USDT!`,

  PAYMENT_QR_MESSAGE: () =>
    `🏦 <b>THANH TOÁN</b>\n\n` + `Vui lòng quét mã QR bên dưới để thanh toán:`,

  PAYMENT_QR_CAPTION: () =>
    `💳 Quét mã QR để thanh toán\n\n` +
    `⏰ Sau khi thanh toán, USDT sẽ được chuyển vào ví của bạn trong vòng 5-10 phút.\n\n` +
    `📞 Liên hệ support nếu có vấn đề!`,

  PAYMENT_SELL_ADDRESS: (recipientAddress: string) =>
    `📮 <b>ĐỊA CHỈ VÍ NHẬN USDT</b>\n\n` +
    `Vui lòng chuyển USDT đến địa chỉ:\n\n` +
    `<code>${recipientAddress}</code>\n\n` +
    `🌐 Mạng: <b>BNB Chain (BSC)</b>\n` +
    `💎 Token: <b>USDT (BEP-20)</b>\n\n` +
    `⏰ Sau khi chuyển, tiền VND sẽ được chuyển vào tài khoản của bạn trong vòng 5-10 phút.\n\n` +
    `⚠️ Lưu ý: Chỉ chuyển USDT trên mạng BSC!`,

  PAYMENT_CANCELLED: () =>
    `❌ <b>ĐÃ HỦY THANH TOÁN</b>\n\n` +
    `Đơn hàng đã được hủy.\n\n` +
    `Bạn có thể thực hiện giao dịch mới bất cứ lúc nào!`,

  ERROR_GENERIC: () => `❌ Có lỗi xảy ra. Vui lòng thử lại sau!`,

  KYC_REQUIRED: () =>
    `🔐 <b>YÊU CẦU XÁC MINH KYC</b>\n\n` +
    `Bạn cần xác minh danh tính (KYC) để thực hiện giao dịch.\n\n` +
    `📞 Vui lòng liên hệ support để được hướng dẫn!`,

  ORDER_STATUS_UPDATE: (orderId: string, status: string) =>
    `📢 <b>CẬP NHẬT ĐƠN HÀNG</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: <b>${status}</b>\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}`,
};

/**
 * Keyboard Layouts
 */
export class Keyboards {
  static mainMenu(): InlineKeyboard {
    return new InlineKeyboard().text('💰 Mua USDT', 'buy_usdt').text('💸 Bán USDT', 'sell_usdt');
  }

  static confirmPayment(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Xác nhận', 'confirm_payment')
      .row()
      .text('❌ Hủy', 'cancel_payment');
  }

  static backToMenu(): InlineKeyboard {
    return new InlineKeyboard().text('🔙 Quay lại Menu', 'back_to_menu');
  }
}

/**
 * User State Management
 */
interface UserState {
  action?: 'buy' | 'sell';
  amount?: string;
  walletAddress?: string;
  waitingFor?: 'amount' | 'wallet';
}

const userStates = new Map<number, UserState>();

/**
 * Telegram Bot Service
 */
export class TelegramService {
  private bot: Bot;

  constructor() {
    if (!telegramConfig.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
    this.bot = new Bot(telegramConfig.botToken);
    this.setupHandlers();
  }

  /**
   * Setup bot command and callback handlers
   */
  private setupHandlers(): void {
    // Start command
    this.bot.command('start', async (ctx) => {
      const firstName = ctx.from?.first_name || 'bạn';
      await ctx.reply(Messages.WELCOME(firstName), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.mainMenu(),
      });
    });

    // Buy USDT callback
    this.bot.callbackQuery('buy_usdt', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.set(userId, { action: 'buy', waitingFor: 'amount' });
      await ctx.editMessageText(Messages.BUY_SELECT_AMOUNT(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Sell USDT callback
    this.bot.callbackQuery('sell_usdt', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.set(userId, { action: 'sell', waitingFor: 'amount' });
      await ctx.editMessageText(Messages.SELL_SELECT_AMOUNT(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Confirm payment callback
    this.bot.callbackQuery('confirm_payment', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state || !state.action || !state.amount) {
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      try {
        if (state.action === 'buy') {
          await this.handleBuyConfirmation(ctx, userId, state);
        } else {
          await this.handleSellConfirmation(ctx, userId, state);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage === 'KYC verification required') {
          await ctx.reply(Messages.KYC_REQUIRED(), { parse_mode: 'HTML' });
        } else {
          await ctx.reply(Messages.ERROR_GENERIC());
        }
      }
    });

    // Cancel payment callback
    this.bot.callbackQuery('cancel_payment', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.delete(userId);
      await ctx.editMessageText(Messages.PAYMENT_CANCELLED(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.mainMenu(),
      });
    });

    // Back to menu callback
    this.bot.callbackQuery('back_to_menu', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.delete(userId);
      const firstName = ctx.from?.first_name || 'bạn';
      await ctx.editMessageText(Messages.WELCOME(firstName), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.mainMenu(),
      });
    });

    // Text message handler
    this.bot.on('message:text', async (ctx) => {
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state) {
        return;
      }

      const text = ctx.message.text.trim();

      if (state.waitingFor === 'amount') {
        await this.handleAmountInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'wallet') {
        await this.handleWalletInput(ctx, userId, state, text);
      }
    });

    // Error handler
    this.bot.catch((err) => {
      console.error('Bot error:', err);
    });
  }

  /**
   * Handle amount input
   */
  private async handleAmountInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    const amount = parseFloat(text);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(Messages.INVALID_AMOUNT(), { parse_mode: 'HTML' });
      return;
    }

    state.amount = text;

    if (state.action === 'buy') {
      state.waitingFor = 'wallet';
      await ctx.reply(Messages.ENTER_WALLET_ADDRESS(), { parse_mode: 'HTML' });
    } else {
      // For sell, show confirmation directly
      state.waitingFor = undefined;
      await ctx.reply(Messages.ORDER_SUMMARY_SELL(text), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.confirmPayment(),
      });
    }

    userStates.set(userId, state);
  }

  /**
   * Handle wallet address input
   */
  private async handleWalletInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    // Basic wallet validation (0x followed by 40 hex characters)
    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
      await ctx.reply(Messages.INVALID_WALLET(), { parse_mode: 'HTML' });
      return;
    }

    state.walletAddress = text;
    state.waitingFor = undefined;
    userStates.set(userId, state);

    await ctx.reply(Messages.ORDER_SUMMARY_BUY(state.amount!, text), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.confirmPayment(),
    });
  }

  /**
   * Handle buy confirmation - create deposit order and show QR code
   */
  private async handleBuyConfirmation(ctx: any, userId: number, state: UserState): Promise<void> {
    if (!state.amount || !state.walletAddress) {
      await ctx.reply(Messages.ERROR_GENERIC());
      return;
    }

    // Call deposit API
    const order = await paymentService.processDeposit({
      chat_id: userId,
      amount: state.amount,
      chain_id: telegramConfig.chainId,
      token_address: telegramConfig.tokenAddress,
      recipient: state.walletAddress,
      callback: telegramConfig.callbackUrl,
    });

    // Clear user state
    userStates.delete(userId);

    // Generate and send QR code
    if (order.body?.qr_code) {
      await ctx.reply(Messages.PAYMENT_QR_MESSAGE(), { parse_mode: 'HTML' });

      const qrCodeImage = await this.generateQRCode(order.body.qr_code);
      await ctx.replyWithPhoto(new InputFile(qrCodeImage), {
        caption: Messages.PAYMENT_QR_CAPTION(),
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    } else {
      await ctx.reply(Messages.ERROR_GENERIC());
    }
  }

  /**
   * Handle sell confirmation - create withdrawal order and show recipient address
   */
  private async handleSellConfirmation(ctx: any, userId: number, state: UserState): Promise<void> {
    if (!state.amount) {
      await ctx.reply(Messages.ERROR_GENERIC());
      return;
    }

    // Call withdrawal API - need to provide payment_info
    const order = await paymentService.processWithdrawal({
      chat_id: userId,
      amount: state.amount,
      chain_id: telegramConfig.chainId,
      token_address: telegramConfig.tokenAddress,
      callback: telegramConfig.callbackUrl,
      payment_info: {
        bank_id: 0,
        full_name: '',
        account_type: 0,
        account_number: '',
      },
    });

    // Clear user state
    userStates.delete(userId);

    // Show recipient address
    if (order.pay_data?.address) {
      await ctx.reply(Messages.PAYMENT_SELL_ADDRESS(order.pay_data.address), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    } else {
      await ctx.reply(Messages.ERROR_GENERIC());
    }
  }

  /**
   * Generate QR code from VietQR string
   */
  private async generateQRCode(qrString: string): Promise<Buffer> {
    const qrApiUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrString)}&size=300&margin=2`;

    const response = await fetch(qrApiUrl);

    if (!response.ok) {
      throw new Error(`QR API returned status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Send notification to user
   */
  async sendNotification(chatId: number, message: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error(`Failed to send notification to ${chatId}:`, error);
    }
  }

  /**
   * Send order status update notification
   */
  async sendOrderStatusUpdate(chatId: number, orderId: string, status: string): Promise<void> {
    const message = Messages.ORDER_STATUS_UPDATE(orderId, status);
    await this.sendNotification(chatId, message);
  }

  /**
   * Get bot instance for webhook handling
   */
  getBot(): Bot {
    return this.bot;
  }

  /**
   * Start bot (for polling mode - not used in production)
   */
  async start(): Promise<void> {
    await this.bot.start();
  }
}

export default new TelegramService();
