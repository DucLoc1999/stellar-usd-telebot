import { Bot, InlineKeyboard, InputFile } from 'grammy';
import { telegramConfig } from '../config/app';
import paymentService from './paymentService';
import { logger } from '../config/logger';
import { banks } from '../models/webhook';

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

  RATE_CHECK: (buyRate: number, sellRate: number, updated: string) =>
    `💱 <b>TỶ GIÁ USDT HIỆN TẠI</b>\n\n` +
    `📈 Giá mua: <b>${buyRate.toLocaleString('vi-VN')} VND</b>\n` +
    `📉 Giá bán: <b>${sellRate.toLocaleString('vi-VN')} VND</b>\n\n` +
    `🕐 Cập nhật: ${updated}\n\n` +
    `💡 Tỷ giá được cập nhật liên tục`,

  RATE_UNAVAILABLE: () =>
    `⚠️ <b>Không thể lấy tỷ giá</b>\n\n` +
    `Hệ thống đang bảo trì hoặc có lỗi kết nối.\n` +
    `Vui lòng thử lại sau ít phút.`,

  BUY_SELECT_AMOUNT: () => `💰 <b>MUA USDT</b>\n\n` + `Vui lòng chọn số tiền VND muốn mua USDT:`,

  SELL_SELECT_AMOUNT: () => `💸 <b>BÁN USDT</b>\n\n` + `Vui lòng chọn số lượng USDT muốn bán:`,

  ENTER_CUSTOM_AMOUNT_BUY: () =>
    `✏️ Vui lòng nhập số tiền VND muốn mua USDT:\n\n` + `📊 Ví dụ: 100000, 500000, 1000000`,

  ENTER_CUSTOM_AMOUNT_SELL: () =>
    `✏️ Vui lòng nhập số lượng USDT muốn bán:\n\n` + `📊 Ví dụ: 10, 50, 100`,

  ENTER_WALLET_ADDRESS: () =>
    `📮 <b>NHẬP ĐỊA CHỈ VÍ</b>\n\n` +
    `Vui lòng nhập địa chỉ ví BSC (BEP-20) để nhận USDT:\n\n` +
    `⚠️ Lưu ý: Kiểm tra kỹ địa chỉ ví trước khi gửi!`,

  SELECT_BANK: () => `🏦 <b>CHỌN NGÂN HÀNG</b>\n\n` + `Vui lòng chọn ngân hàng nhận tiền VND:`,

  ENTER_FULL_NAME: () =>
    `👤 <b>NHẬP TÊN TÀI KHOẢN</b>\n\n` +
    `Vui lòng nhập họ tên chủ tài khoản ngân hàng:\n\n` +
    `📝 Ví dụ: Nguyen Van A`,

  ENTER_ACCOUNT_NUMBER: () =>
    `💳 <b>NHẬP SỐ TÀI KHOẢN</b>\n\n` +
    `Vui lòng nhập số tài khoản ngân hàng:\n\n` +
    `📝 Ví dụ: 1234567890`,

  INVALID_AMOUNT: () => `❌ Số lượng không hợp lệ!\n\n` + `Vui lòng nhập số hợp lệ (VD: 100)`,

  INVALID_WALLET: () =>
    `❌ Địa chỉ ví không hợp lệ!\n\n` + `Vui lòng nhập địa chỉ ví BSC hợp lệ (0x...)`,

  INVALID_FULL_NAME: () =>
    `❌ Tên tài khoản không hợp lệ!\n\n` + `Vui lòng nhập họ tên đầy đủ (VD: Nguyen Van A)`,

  INVALID_ACCOUNT_NUMBER: () =>
    `❌ Số tài khoản không hợp lệ!\n\n` + `Vui lòng nhập số tài khoản hợp lệ (chỉ chứa số)`,

  ORDER_SUMMARY_BUY: (amount: string, wallet: string) =>
    `📋 <b>XÁC NHẬN ĐƠN HÀNG - MUA USDT</b>\n\n` +
    `💵 Số tiền: <b>${amount} VND</b>\n` +
    `📮 Địa chỉ ví nhận: <code>${wallet}</code>\n` +
    `🌐 Mạng: BNB Chain (BSC)\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi thanh toán!`,

  ORDER_SUMMARY_SELL: (amount: string) =>
    `📋 <b>XÁC NHẬN ĐƠN HÀNG - BÁN USDT</b>\n\n` +
    `💎 Số lượng: <b>${amount} USDT</b>\n` +
    `🌐 Mạng: BNB Chain (BSC)\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi chuyển USDT!`,

  SELL_CONFIRMATION: (amount: string, bankName: string, fullName: string, accountNumber: string) =>
    `💸 <b>XÁC NHẬN BÁN USDT</b>\n\n` +
    `💰 Số lượng: <b>${amount} USDT</b>\n` +
    `🏦 Ngân hàng: <b>${bankName}</b>\n` +
    `👤 Tên tài khoản: <b>${fullName}</b>\n` +
    `💳 Số tài khoản: <code>${accountNumber}</code>\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi xác nhận!`,

  PAYMENT_QR_MESSAGE: (bankName?: string, accountNumber?: string, accountName?: string) => {
    let message = `🏦 <b>THÔNG TIN CHUYỂN KHOẢN</b>\n\n`;

    if (bankName && accountNumber && accountName) {
      message += `🏛️ Ngân hàng: <b>${bankName}</b>\n`;
      message += `💳 Số tài khoản: <code>${accountNumber}</code>\n`;
      message += `👤 Chủ tài khoản: <b>${accountName}</b>\n\n`;
    }

    message += `💰 Vui lòng quét mã QR bên dưới để thanh toán`;
    return message;
  },

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

  KYC_INFO: () =>
    `🔐 <b>XÁC MINH DANH TÍNH (KYC)</b>\n\n` +
    `Để đảm bảo an toàn và tuân thủ quy định, chúng tôi yêu cầu xác minh danh tính cho các giao dịch lớn.\n\n` +
    `<b>Quy trình KYC:</b>\n` +
    `1️⃣ Cung cấp CMND/CCCD\n` +
    `2️⃣ Chụp ảnh selfie với giấy tờ\n` +
    `3️⃣ Xác minh số điện thoại\n\n` +
    `📞 Liên hệ support để được hướng dẫn chi tiết!`,

  ACCOUNT_INFO: (userId: number, firstName: string, lastName: string, username: string) =>
    `👤 <b>THÔNG TIN TÀI KHOẢN</b>\n\n` +
    `🆔 User ID: <code>${userId}</code>\n` +
    `👤 Tên: ${firstName} ${lastName || ''}\n` +
    `📱 Username: ${username ? '@' + username : 'Chưa có'}\n\n` +
    `✅ Trạng thái: Đang hoạt động\n` +
    `🔐 KYC: Chưa xác minh`,

  ORDER_STATUS_UPDATE: (orderId: string, status: string) =>
    `📢 <b>CẬP NHẬT ĐƠN HÀNG</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: <b>${status}</b>\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}`,

  // Enhanced order state messages
  ORDER_STATE_CREATED: (orderId: string) =>
    `✅ <b>ĐƠN HÀNG ĐÃ TẠO</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Đã tạo\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
    `💡 Đơn hàng của bạn đã được tạo thành công!`,

  ORDER_STATE_PROCESSING: (orderId: string) =>
    `⏳ <b>ĐANG XỬ LÝ</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Đang xử lý\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
    `💡 Đơn hàng của bạn đang được xử lý...`,

  ORDER_STATE_COMPLETED: (orderId: string) =>
    `🎉 <b>HOÀN THÀNH</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Hoàn thành\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
    `✨ Giao dịch đã hoàn tất thành công!\n` +
    `💰 Vui lòng kiểm tra ví của bạn.`,

  ORDER_STATE_FAILED: (orderId: string) =>
    `❌ <b>THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Thất bại\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
    `💡 Giao dịch không thành công. Vui lòng liên hệ support để được hỗ trợ!`,

  ORDER_STATE_CANCELLED: (orderId: string) =>
    `🚫 <b>ĐÃ HỦY</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Đã hủy\n\n` +
    `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
    `💡 Đơn hàng đã được hủy.`,

  // Processing state messages
  PROCESSING_STATE_WAITING_FIAT: (orderId: string) =>
    `⏳ <b>CHỜ CHUYỂN KHOẢN VND</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Đang chờ bạn chuyển khoản VND.\n` +
    `📱 Vui lòng quét mã QR để thanh toán.`,

  PROCESSING_STATE_FIAT_CONFIRMED: (orderId: string) =>
    `✅ <b>ĐÃ XÁC NHẬN CHUYỂN KHOẢN VND</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Chuyển khoản VND đã được xác nhận.\n` +
    `⏳ Đang xử lý chuyển USDT...`,

  PROCESSING_STATE_FIAT_FAILED: (orderId: string) =>
    `❌ <b>CHUYỂN KHOẢN VND THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Chuyển khoản VND không thành công.\n` +
    `📞 Vui lòng liên hệ support để được hỗ trợ!`,

  PROCESSING_STATE_WAITING_USDT: (orderId: string) =>
    `⏳ <b>CHỜ CHUYỂN USDT</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Đang chờ chuyển USDT vào ví của bạn...`,

  PROCESSING_STATE_USDT_CONFIRMED: (orderId: string) =>
    `✅ <b>ĐÃ CHUYỂN USDT THÀNH CÔNG</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `🎉 USDT đã được chuyển vào ví của bạn!\n` +
    `💰 Vui lòng kiểm tra ví.`,

  PROCESSING_STATE_USDT_FAILED: (orderId: string) =>
    `❌ <b>CHUYỂN USDT THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Chuyển USDT không thành công.\n` +
    `📞 Vui lòng liên hệ support để được hỗ trợ!`,

  PROCESSING_STATE_WAITING_ADMIN: (orderId: string) =>
    `⏳ <b>CHỜ ADMIN DUYỆT</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Đơn hàng đang chờ admin duyệt.\n` +
    `⏰ Vui lòng đợi trong giây lát...`,
};

/**
 * Keyboard Layouts
 */
export class Keyboards {
  static mainMenu(): InlineKeyboard {
    return new InlineKeyboard()
      .text('💱 Kiểm tra tỷ giá', 'check_rate')
      .row()
      .text('💰 Mua USDT', 'buy_usdt')
      .text('💸 Bán USDT', 'sell_usdt')
      .row()
      .text('🔐 Xác minh KYC', 'kyc')
      .text('👤 Thông tin TK', 'account_info');
  }

  static buyAmountSelection(): InlineKeyboard {
    return new InlineKeyboard()
      .text('100,000 VND', 'buy_amount_100000')
      .text('200,000 VND', 'buy_amount_200000')
      .row()
      .text('500,000 VND', 'buy_amount_500000')
      .text('✏️ Nhập số khác', 'buy_custom')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static sellAmountSelection(): InlineKeyboard {
    return new InlineKeyboard()
      .text('10 USDT', 'sell_amount_10')
      .text('50 USDT', 'sell_amount_50')
      .row()
      .text('100 USDT', 'sell_amount_100')
      .text('✏️ Nhập số khác', 'sell_custom')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
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

  static bankSelection(offset: number = 0): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Determine how many banks to show
    let banksToShow: typeof banks;
    let hasMore = false;

    if (offset === 0) {
      // First page: show first 5 banks
      banksToShow = banks.slice(0, 5);
      hasMore = banks.length > 5;
    } else {
      // Subsequent pages: show 5 banks
      const endIndex = Math.min(offset + 5, banks.length);
      banksToShow = banks.slice(offset, endIndex);
      hasMore = endIndex < banks.length;
    }

    // Add bank buttons (one per row)
    for (const bank of banksToShow) {
      keyboard.text(bank.short_name, `select_bank_${bank.id}`).row();
    }

    // Add "Show More" button if there are more banks
    if (hasMore) {
      const nextOffset = offset === 0 ? 5 : offset + 5;
      keyboard.text('📋 Xem thêm', `show_more_banks_${nextOffset}`).row();
    }

    // Add back button
    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');

    return keyboard;
  }
}

/**
 * User State Management
 */
interface UserState {
  action?: 'buy' | 'sell';
  amount?: string;
  walletAddress?: string;
  waitingFor?:
    | 'buy_amount'
    | 'sell_amount'
    | 'wallet'
    | 'bank_selection'
    | 'full_name'
    | 'account_number';
  bankId?: number;
  bankName?: string;
  fullName?: string;
  accountNumber?: string;
  bankPageOffset?: number;
}

const userStates = new Map<number, UserState>();

/**
 * Exchange Rate Interface
 */
interface ExchangeRate {
  buy: number;
  sell: number;
  created_at: string;
}

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

    // Check rate callback
    this.bot.callbackQuery('check_rate', async (ctx) => {
      await ctx.answerCallbackQuery();
      try {
        const rates = await this.fetchExchangeRates();
        if (rates) {
          const updated = new Date(rates.created_at).toLocaleString('vi-VN');
          await ctx.editMessageText(Messages.RATE_CHECK(rates.buy, rates.sell, updated), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        } else {
          await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        }
      } catch (error) {
        await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      }
    });

    // KYC callback
    this.bot.callbackQuery('kyc', async (ctx) => {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(Messages.KYC_INFO(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Account info callback
    this.bot.callbackQuery('account_info', async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = ctx.from;
      await ctx.editMessageText(
        Messages.ACCOUNT_INFO(user.id, user.first_name, user.last_name || '', user.username || ''),
        {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        }
      );
    });

    // Buy USDT callback - show amount selection
    this.bot.callbackQuery('buy_usdt', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.set(userId, { action: 'buy' });
      await ctx.editMessageText(Messages.BUY_SELECT_AMOUNT(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.buyAmountSelection(),
      });
    });

    // Buy amount preset buttons
    this.bot.callbackQuery(/^buy_amount_\d+$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const amount = ctx.callbackQuery.data.replace('buy_amount_', '');
      userStates.set(userId, { action: 'buy', amount, waitingFor: 'wallet' });
      await ctx.editMessageText(Messages.ENTER_WALLET_ADDRESS(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Buy custom amount
    this.bot.callbackQuery('buy_custom', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.set(userId, { action: 'buy', waitingFor: 'buy_amount' });
      await ctx.editMessageText(Messages.ENTER_CUSTOM_AMOUNT_BUY(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Sell USDT callback - show amount selection
    this.bot.callbackQuery('sell_usdt', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.set(userId, { action: 'sell' });
      await ctx.editMessageText(Messages.SELL_SELECT_AMOUNT(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.sellAmountSelection(),
      });
    });

    // Sell amount preset buttons
    this.bot.callbackQuery(/^sell_amount_\d+$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const amount = ctx.callbackQuery.data.replace('sell_amount_', '');
      const state = userStates.get(userId) || {};
      state.action = 'sell';
      state.amount = amount;
      state.waitingFor = 'bank_selection';
      state.bankPageOffset = 0;
      userStates.set(userId, state);

      logger.info({ userId, amount }, 'Sell amount selected, showing bank selection');

      await ctx.editMessageText(Messages.SELECT_BANK(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.bankSelection(0),
      });
    });

    // Sell custom amount
    this.bot.callbackQuery('sell_custom', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      userStates.set(userId, { action: 'sell', waitingFor: 'sell_amount' });
      await ctx.editMessageText(Messages.ENTER_CUSTOM_AMOUNT_SELL(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Bank selection callback
    this.bot.callbackQuery(/^select_bank_\d+$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const bankId = parseInt(ctx.callbackQuery.data.replace('select_bank_', ''));
      const state = userStates.get(userId);

      if (!state || state.action !== 'sell') {
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      // Find the selected bank
      const selectedBank = banks.find((b) => b.id === bankId);
      if (!selectedBank) {
        logger.error({ userId, bankId }, 'Bank not found');
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      // Store bank info in state
      state.bankId = bankId;
      state.bankName = selectedBank.short_name;
      state.waitingFor = 'full_name';
      userStates.set(userId, state);

      logger.info({ userId, bankId, bankName: selectedBank.short_name }, 'Bank selected');

      await ctx.editMessageText(Messages.ENTER_FULL_NAME(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Show more banks callback (pagination)
    this.bot.callbackQuery(/^show_more_banks_\d+$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const offset = parseInt(ctx.callbackQuery.data.replace('show_more_banks_', ''));
      const state = userStates.get(userId);

      if (!state || state.action !== 'sell') {
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      // Update offset in state
      state.bankPageOffset = offset;
      userStates.set(userId, state);

      logger.info({ userId, offset }, 'Showing more banks');

      await ctx.editMessageText(Messages.SELECT_BANK(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.bankSelection(offset),
      });
    });

    // Confirm payment callback
    this.bot.callbackQuery('confirm_payment', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      logger.info(
        { userId, state: state ? { action: state.action, amount: state.amount } : null },
        'Processing payment confirmation'
      );

      if (!state || !state.action || !state.amount) {
        logger.warn({ userId }, 'Invalid state for payment confirmation');
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      try {
        if (state.action === 'buy') {
          logger.info(
            { userId, amount: state.amount, wallet: state.walletAddress },
            'Processing buy order'
          );
          await this.handleBuyConfirmation(ctx, userId, state);
        } else {
          logger.info({ userId, amount: state.amount }, 'Processing sell order');
          await this.handleSellConfirmation(ctx, userId, state);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(
          { userId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
          'Error processing payment confirmation'
        );

        if (errorMessage === 'KYC verification required') {
          await ctx.reply(Messages.KYC_REQUIRED(), { parse_mode: 'HTML' });
        } else if (errorMessage.includes('User not found')) {
          await ctx.reply(
            `❌ <b>Lỗi tài khoản</b>\n\n` +
              `Không tìm thấy thông tin tài khoản của bạn.\n` +
              `Vui lòng liên hệ support để được hỗ trợ!`,
            { parse_mode: 'HTML' }
          );
        } else if (errorMessage.includes('API error')) {
          await ctx.reply(
            `❌ <b>Lỗi kết nối</b>\n\n` +
              `Không thể kết nối đến hệ thống thanh toán.\n` +
              `Vui lòng thử lại sau ít phút!`,
            { parse_mode: 'HTML' }
          );
        } else {
          await ctx.reply(
            `❌ <b>Có lỗi xảy ra</b>\n\n` +
              `Chi tiết: ${errorMessage}\n\n` +
              `Vui lòng thử lại hoặc liên hệ support!`,
            { parse_mode: 'HTML' }
          );
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

      if (state.waitingFor === 'buy_amount') {
        await this.handleBuyAmountInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'sell_amount') {
        await this.handleSellAmountInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'wallet') {
        await this.handleWalletInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'full_name') {
        await this.handleFullNameInput(ctx, userId, state, text);
      } else if (state.waitingFor === 'account_number') {
        await this.handleAccountNumberInput(ctx, userId, state, text);
      }
    });

    // Error handler
    this.bot.catch((err) => {
      console.error('Bot error:', err);
    });
  }

  /**
   * Fetch exchange rates from Supabase API
   */
  private async fetchExchangeRates(): Promise<ExchangeRate | null> {
    try {
      const response = await fetch(
        'https://iakzvzwriyxyshfggbwu.supabase.co/functions/v1/get_exchange_rates'
      );
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data as ExchangeRate;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      return null;
    }
  }

  /**
   * Handle buy amount input (custom amount)
   */
  private async handleBuyAmountInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    const amount = parseFloat(text.replace(/,/g, ''));

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(Messages.INVALID_AMOUNT(), { parse_mode: 'HTML' });
      return;
    }

    state.amount = text.replace(/,/g, '');
    state.waitingFor = 'wallet';
    userStates.set(userId, state);

    await ctx.reply(Messages.ENTER_WALLET_ADDRESS(), { parse_mode: 'HTML' });
  }

  /**
   * Handle sell amount input (custom amount)
   */
  private async handleSellAmountInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    const amount = parseFloat(text.replace(/,/g, ''));

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(Messages.INVALID_AMOUNT(), { parse_mode: 'HTML' });
      return;
    }

    state.amount = text.replace(/,/g, '');
    state.waitingFor = 'bank_selection';
    state.bankPageOffset = 0;
    userStates.set(userId, state);

    logger.info(
      { userId, amount: state.amount },
      'Custom sell amount entered, showing bank selection'
    );

    await ctx.reply(Messages.SELECT_BANK(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.bankSelection(0),
    });
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
   * Handle full name input for sell flow
   */
  private async handleFullNameInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    // Validate full name (non-empty, at least 2 characters)
    if (!text || text.length < 2) {
      await ctx.reply(Messages.INVALID_FULL_NAME(), { parse_mode: 'HTML' });
      return;
    }

    state.fullName = text;
    state.waitingFor = 'account_number';
    userStates.set(userId, state);

    logger.info({ userId, fullName: text }, 'Full name entered');

    await ctx.reply(Messages.ENTER_ACCOUNT_NUMBER(), { parse_mode: 'HTML' });
  }

  /**
   * Handle account number input for sell flow
   */
  private async handleAccountNumberInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    // Validate account number (numeric only)
    if (!/^\d+$/.test(text)) {
      await ctx.reply(Messages.INVALID_ACCOUNT_NUMBER(), { parse_mode: 'HTML' });
      return;
    }

    state.accountNumber = text;
    state.waitingFor = undefined;
    userStates.set(userId, state);

    logger.info({ userId, accountNumber: text }, 'Account number entered');

    // Show confirmation screen with all collected details
    if (!state.amount || !state.bankName || !state.fullName) {
      logger.error({ userId, state }, 'Missing required fields for sell confirmation');
      await ctx.reply(Messages.ERROR_GENERIC());
      return;
    }

    await ctx.reply(
      Messages.SELL_CONFIRMATION(state.amount, state.bankName, state.fullName, text),
      {
        parse_mode: 'HTML',
        reply_markup: Keyboards.confirmPayment(),
      }
    );
  }

  /**
   * Handle buy confirmation - create deposit order and show QR code
   */
  private async handleBuyConfirmation(ctx: any, userId: number, state: UserState): Promise<void> {
    if (!state.amount || !state.walletAddress) {
      logger.error({ userId, state }, 'Missing amount or wallet address in buy confirmation');
      await ctx.reply(Messages.ERROR_GENERIC());
      return;
    }

    logger.info(
      {
        userId,
        amount: state.amount,
        wallet: state.walletAddress,
        chainId: telegramConfig.chainId,
        tokenAddress: telegramConfig.tokenAddress,
      },
      'Calling deposit API'
    );

    // Call deposit API
    const order = await paymentService.processDeposit({
      chat_id: userId,
      amount: state.amount,
      chain_id: telegramConfig.chainId,
      token_address: telegramConfig.tokenAddress,
      recipient: state.walletAddress,
      callback: telegramConfig.callbackUrl,
    });

    // Extract bank information from order response
    const bankInfo = order.body?.bankInfo;

    logger.info(
      {
        orderId: order.id,
        hasPayData: !!order.pay_data,
        hasQrCode: !!order.pay_data?.qr_code,
        hasBankInfo: !!bankInfo,
        bankName: bankInfo?.bankName,
        accountNumber: bankInfo?.bankAccountNumber,
      },
      'Deposit order created successfully'
    );

    // Clear user state
    userStates.delete(userId);

    // Generate and send QR code from pay_data.qr_code
    if (order.pay_data?.qr_code) {
      logger.info({ orderId: order.id }, 'Generating QR code');

      // Send bank information message
      await ctx.reply(
        Messages.PAYMENT_QR_MESSAGE(
          bankInfo?.bankName,
          bankInfo?.bankAccountNumber,
          bankInfo?.bankAccountName
        ),
        { parse_mode: 'HTML' }
      );

      const qrCodeImage = await this.generateQRCode(order.pay_data.qr_code);
      logger.info(
        { orderId: order.id, qrCodeSize: qrCodeImage.length },
        'QR code generated, sending to user'
      );

      await ctx.replyWithPhoto(new InputFile(qrCodeImage), {
        caption: Messages.PAYMENT_QR_CAPTION(),
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });

      logger.info({ orderId: order.id }, 'QR code sent successfully');
    } else {
      logger.error({ orderId: order.id, payData: order.pay_data }, 'No QR code in order response');
      await ctx.reply(Messages.ERROR_GENERIC());
    }
  }

  /**
   * Handle sell confirmation - create withdrawal order and show recipient address
   */
  private async handleSellConfirmation(ctx: any, userId: number, state: UserState): Promise<void> {
    // Validate all required fields
    if (!state.amount || !state.bankId || !state.fullName || !state.accountNumber) {
      logger.error({ userId, state }, 'Missing required fields for sell confirmation');
      await ctx.reply(Messages.ERROR_GENERIC());
      return;
    }

    logger.info(
      {
        userId,
        amount: state.amount,
        bankId: state.bankId,
        bankName: state.bankName,
        fullName: state.fullName,
        accountNumber: state.accountNumber,
      },
      'Processing sell order with complete payment info'
    );

    // Call withdrawal API with collected payment_info
    logger.info({ userId }, 'Calling withdrawal API');

    const order = await paymentService.processWithdrawal({
      chat_id: userId,
      amount: state.amount,
      chain_id: telegramConfig.chainId,
      token_address: telegramConfig.tokenAddress,
      callback: telegramConfig.callbackUrl,
      payment_info: {
        bank_id: state.bankId,
        full_name: state.fullName,
        account_type: 1, // Always 1 as per requirements
        account_number: state.accountNumber,
      },
    });

    logger.info(
      {
        userId,
        orderId: order.id,
        hasPayData: !!order.pay_data,
        hasAddress: !!order.pay_data?.address,
        payData: order.pay_data,
        recipient: order.recipient,
        body: order.body,
      },
      'Withdrawal order created successfully - checking for recipient address'
    );

    // Extract recipient address - try multiple possible locations
    let recipientAddress: string | undefined;

    // Priority 1: Check pay_data.address
    if (order.pay_data?.address) {
      recipientAddress = order.pay_data.address;
      logger.info(
        { userId, orderId: order.id, source: 'pay_data.address' },
        'Found recipient address'
      );
    }
    // Priority 2: Check recipient field (top-level)
    else if (order.recipient) {
      recipientAddress = order.recipient;
      logger.info({ userId, orderId: order.id, source: 'recipient' }, 'Found recipient address');
    }

    // Clear user state
    userStates.delete(userId);

    // Show recipient address where user should send USDT
    if (recipientAddress) {
      logger.info(
        { userId, orderId: order.id, recipientAddress },
        'Sending recipient address to user'
      );

      // Send wallet address message
      await ctx.reply(Messages.PAYMENT_SELL_ADDRESS(recipientAddress), {
        parse_mode: 'HTML',
      });

      // Generate and send QR code for the wallet address
      logger.info({ orderId: order.id, recipientAddress }, 'Generating QR code for wallet address');

      const qrCodeImage = await this.generateQRCode(recipientAddress);
      logger.info(
        { orderId: order.id, qrCodeSize: qrCodeImage.length },
        'QR code generated, sending to user'
      );

      await ctx.replyWithPhoto(new InputFile(qrCodeImage), {
        caption:
          `📱 <b>Quét mã QR để sao chép địa chỉ ví</b>\n\n` +
          `⏰ Sau khi chuyển USDT, tiền VND sẽ được chuyển vào tài khoản của bạn trong vòng 5-10 phút.\n\n` +
          `📞 Liên hệ support nếu có vấn đề!`,
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });

      logger.info({ userId, orderId: order.id }, 'Sell flow completed successfully with QR code');
    } else {
      logger.error(
        {
          userId,
          orderId: order.id,
          fullOrder: {
            pay_data: order.pay_data,
            recipient: order.recipient,
            body: order.body,
            payment_info: order.payment_info,
          },
        },
        'No recipient address found in any expected field'
      );
      await ctx.reply(
        `❌ <b>Lỗi hệ thống</b>\n\n` +
          `Không tìm thấy địa chỉ ví nhận USDT trong phản hồi từ hệ thống.\n\n` +
          `Mã đơn: <code>${order.id}</code>\n\n` +
          `Vui lòng liên hệ support với mã đơn hàng trên để được hỗ trợ!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
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
   * Send order status update notification with enhanced messages
   */
  async sendOrderStatusUpdate(
    chatId: number,
    orderId: string,
    state: number,
    processingState?: number
  ): Promise<void> {
    let message: string;

    // Prioritize processing state messages if available
    if (processingState) {
      switch (processingState) {
        case 10:
          message = Messages.PROCESSING_STATE_WAITING_FIAT(orderId);
          break;
        case 11:
          message = Messages.PROCESSING_STATE_FIAT_CONFIRMED(orderId);
          break;
        case 12:
          message = Messages.PROCESSING_STATE_FIAT_FAILED(orderId);
          break;
        case 13:
          message = Messages.PROCESSING_STATE_WAITING_USDT(orderId);
          break;
        case 14:
          message = Messages.PROCESSING_STATE_USDT_CONFIRMED(orderId);
          break;
        case 15:
          message = Messages.PROCESSING_STATE_USDT_FAILED(orderId);
          break;
        case 16:
          message = Messages.PROCESSING_STATE_WAITING_ADMIN(orderId);
          break;
        default:
          // Fall back to order state message
          message = this.getOrderStateMessage(orderId, state);
      }
    } else {
      message = this.getOrderStateMessage(orderId, state);
    }

    await this.sendNotification(chatId, message);
  }

  /**
   * Get order state message based on state number
   */
  private getOrderStateMessage(orderId: string, state: number): string {
    switch (state) {
      case 1:
        return Messages.ORDER_STATE_CREATED(orderId);
      case 2:
        return Messages.ORDER_STATE_PROCESSING(orderId);
      case 3:
        return Messages.ORDER_STATE_COMPLETED(orderId);
      case 4:
        return Messages.ORDER_STATE_FAILED(orderId);
      case 5:
        return Messages.ORDER_STATE_CANCELLED(orderId);
      default:
        return Messages.ORDER_STATUS_UPDATE(orderId, `State ${state}`);
    }
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
