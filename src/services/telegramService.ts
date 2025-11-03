import { Bot, InlineKeyboard, InputFile } from 'grammy';
import { telegramConfig } from '../config/app';
import paymentService from './paymentService';
import paymentInformationService from './paymentInformationService';
import teleUserService from './teleUserService';
import { logger } from '../config/logger';
import { banks } from '../models/webhook';
import type { PaymentInformation } from '../models/types';

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

  ENTER_BANK_DETAILS_SINGLE: () =>
    `🏦 <b>NHẬP THÔNG TIN NGÂN HÀNG</b>\n\n` +
    `Vui lòng nhập thông tin theo định dạng:\n\n` +
    `<b>TÊN NGÂN HÀNG, HỌ TÊN, SỐ TÀI KHOẢN</b>\n\n` +
    `📝 Ví dụ: VIETCOMBANK, NGUYEN VAN A, 1234567890\n\n` +
    `⚠️ Lưu ý:\n` +
    `• Tên ngân hàng và họ tên không được chứa số\n` +
    `• Số tài khoản chỉ chứa chữ số\n` +
    `• Phân cách bằng dấu phẩy (,)`,

  INVALID_AMOUNT: () => `❌ Số lượng không hợp lệ!\n\n` + `Vui lòng nhập số hợp lệ (VD: 100)`,

  INVALID_WALLET: () =>
    `❌ Địa chỉ ví không hợp lệ!\n\n` + `Vui lòng nhập địa chỉ ví BSC hợp lệ (0x...)`,

  INVALID_FULL_NAME: () =>
    `❌ Tên tài khoản không hợp lệ!\n\n` + `Vui lòng nhập họ tên đầy đủ (VD: Nguyen Van A)`,

  INVALID_ACCOUNT_NUMBER: () =>
    `❌ Số tài khoản không hợp lệ!\n\n` + `Vui lòng nhập số tài khoản hợp lệ (chỉ chứa số)`,

  INVALID_BANK_DETAILS_FORMAT: () =>
    `❌ <b>Định dạng không hợp lệ!</b>\n\n` +
    `Vui lòng nhập theo mẫu:\n` +
    `<b>TÊN NGÂN HÀNG, HỌ TÊN, SỐ TÀI KHOẢN</b>\n\n` +
    `📝 Ví dụ: VIETCOMBANK, NGUYEN VAN A, 1234567890`,

  INVALID_BANK_NAME_HAS_NUMBERS: () =>
    `❌ <b>Tên ngân hàng không được chứa số!</b>\n\n` +
    `Vui lòng nhập lại theo định dạng:\n` +
    `<b>TÊN NGÂN HÀNG, HỌ TÊN, SỐ TÀI KHOẢN</b>`,

  INVALID_FULL_NAME_HAS_NUMBERS: () =>
    `❌ <b>Họ tên không được chứa số!</b>\n\n` +
    `Vui lòng nhập lại theo định dạng:\n` +
    `<b>TÊN NGÂN HÀNG, HỌ TÊN, SỐ TÀI KHOẢN</b>`,

  BANK_NOT_FOUND: () =>
    `❌ <b>Không tìm thấy ngân hàng!</b>\n\n` +
    `Vui lòng kiểm tra lại tên ngân hàng.\n\n` +
    `💡 Gợi ý: VIETCOMBANK, TECHCOMBANK, BIDV, AGRIBANK, VCB, TCB, MB, ACB, VPB, TPB, SACOMBANK, HDBANK, SHB, VIB, MSB, OCB, EXIMBANK, SCB, SEABANK, ABBANK, VIETINBANK, LIENVIETPOSTBANK, PVCOMBANK, BAOVIETBANK, GPBANK, NAMABANK, PGBANK, VIETABANK, VIETBANK, OCEANBANK, CBBANK, KIENLONGBANK, DONGABANK, WOORIBANK, PUBLICBANK, NONGHYUP, INDOVINABANK, SHINHAN, STANDARDCHARTERED, ANZ, HSBC, HONGKONG, CIMB, UOB, MAYBANK, BANGKOK, MIZUHO, MUFG, SMBC, DEUTSCHE, BNP, CITIBANK`,

  ORDER_SUMMARY_BUY: (
    vndAmount: string,
    wallet: string,
    usdtAmount: number,
    buyRate: number,
    gatewayFee: number
  ) =>
    `📋 <b>XÁC NHẬN ĐƠN HÀNG - MUA USDT</b>\n\n` +
    `Đơn hàng MUA <b>${usdtAmount.toFixed(2)} USDT</b> x <b>${buyRate.toLocaleString('vi-VN')}đ</b>\n\n` +
    `🌐 Mạng: BSC | ⚡ Phí gas: $0.00\n` +
    `💰 Thành tiền: <b>${parseFloat(vndAmount).toLocaleString('vi-VN')}đ</b> | 💳 Phí dịch vụ: <b>${Math.round(gatewayFee).toLocaleString('vi-VN')}đ</b>\n` +
    `📮 Ví nhận: <code>${wallet}</code>\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi thanh toán!`,

  ORDER_SUMMARY_SELL: (amount: string) =>
    `📋 <b>XÁC NHẬN ĐƠN HÀNG - BÁN USDT</b>\n\n` +
    `💎 Số lượng: <b>${amount} USDT</b>\n` +
    `🌐 Mạng: BNB Chain (BSC)\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi chuyển USDT!`,

  SELL_CONFIRMATION: (
    amount: string,
    bankName: string,
    fullName: string,
    accountNumber: string,
    sellRate: number,
    totalVND: number,
    serviceFee: number
  ) =>
    `💸 <b>XÁC NHẬN ĐƠN HÀNG - BÁN USDT</b>\n\n` +
    `Đơn hàng BÁN <b>${amount} USDT</b> x <b>${sellRate.toLocaleString('vi-VN')}đ</b>\n\n` +
    `🌐 Mạng: BSC | ⚡ Phí gas: $0.00\n` +
    `💰 Thành tiền: <b>${Math.round(totalVND).toLocaleString('vi-VN')}đ</b> |  💳 Phí dịch vụ: <b>${Math.round(serviceFee).toLocaleString('vi-VN')}đ</b>\n` +
    `🏦 Bank nhận: <code>${bankName}</code> | <code>${accountNumber}</code> | <code>${fullName}</code>\n\n` +
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
    `⏰ Sau khi thanh toán, USDT sẽ được chuyển vào ví của bạn trong vòng 3-30 giây.\n\n` +
    `📞 Liên hệ support nếu có vấn đề!`,

  PAYMENT_SELL_ADDRESS: (recipientAddress: string) =>
    `📮 <b>ĐỊA CHỈ VÍ NHẬN USDT</b>\n\n` +
    `Vui lòng chuyển USDT đến địa chỉ:\n\n` +
    `<code>${recipientAddress}</code>\n\n` +
    `🌐 Mạng: <b>BNB Chain (BSC)</b>\n` +
    `💎 Token: <b>USDT (BEP-20)</b>\n\n` +
    `⏰ Sau khi chuyển, tiền VND sẽ được chuyển vào tài khoản của bạn trong vòng 3-30 giây.\n\n` +
    `⚠️ Lưu ý: Chỉ chuyển USDT trên mạng BSC!`,

  PAYMENT_CANCELLED: () =>
    `❌ <b>ĐÃ HỦY THANH TOÁN</b>\n\n` +
    `Đơn hàng đã được hủy.\n\n` +
    `Bạn có thể thực hiện giao dịch mới bất cứ lúc nào!`,

  SELECT_SAVED_WALLET: () =>
    `🔑 <b>CHỌN ĐỊA CHỈ VÍ</b>\n\n` +
    `Bạn có các địa chỉ ví đã lưu. Vui lòng chọn một địa chỉ hoặc thêm địa chỉ mới:`,

  SELECT_SAVED_BANK_ACCOUNT: () =>
    `🏦 <b>CHỌN TÀI KHOẢN NGÂN HÀNG</b>\n\n` +
    `Bạn có các tài khoản ngân hàng đã lưu. Vui lòng chọn một tài khoản hoặc thêm tài khoản mới:`,

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

  ACCOUNT_INFO: (
    chatId: number,
    firstName: string,
    lastName: string | null,
    username: string,
    isKyc: boolean,
    savedBankAccounts: PaymentInformation[],
    savedWallets: PaymentInformation[]
  ) => {
    let message =
      `👤 <b>THÔNG TIN TÀI KHOẢN</b>\n\n` +
      `🆔 Chat ID: <code>${chatId}</code>\n` +
      `👤 Họ tên: ${firstName}${lastName ? ' ' + lastName : ''}\n` +
      `📱 Username: ${username ? '@' + username : 'Chưa có'}\n` +
      `🔐 Trạng thái KYC: ${isKyc ? '✅ Đã xác minh' : '❌ Chưa xác minh'}\n\n` +
      `💳 <b>THÔNG TIN THANH TOÁN ĐÃ LƯU</b>\n\n`;

    // Add bank accounts section
    if (savedBankAccounts.length > 0) {
      message += `🏦 <b>Ngân hàng:</b>\n`;
      savedBankAccounts.forEach((account) => {
        // Find bank name from banks array
        const bank = banks.find((b) => b.id === account.bank_id);
        const bankName = bank ? bank.short_name : 'N/A';
        message += `• <code>${bankName} - ${account.full_name || 'N/A'} - ${account.bank_account || 'N/A'}</code>\n`;
      });
      message += '\n';
    }

    // Add crypto wallets section
    if (savedWallets.length > 0) {
      message += `💎 <b>Ví crypto:</b>\n`;
      savedWallets.forEach((wallet) => {
        if (wallet.wallet_address) {
          // Display full wallet address wrapped in code tags for easy copying
          message += `• <code>${wallet.wallet_address}</code>\n`;
        }
      });
      message += '\n';
    }

    // If no payment info exists
    if (savedBankAccounts.length === 0 && savedWallets.length === 0) {
      message += `Chưa có thông tin thanh toán đã lưu`;
    }

    return message.trim();
  },

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

  static savedWalletSelection(wallets: PaymentInformation[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Add saved wallet buttons
    for (const wallet of wallets) {
      if (wallet.wallet_address) {
        // Format wallet address: 0x1234...5678
        const shortAddress = `${wallet.wallet_address.substring(0, 6)}...${wallet.wallet_address.substring(38)}`;
        keyboard.text(`🔑 ${shortAddress}`, `use_saved_wallet_${wallet.id}`).row();
      }
    }

    // Add "Add new wallet" button
    keyboard.text('➕ Thêm địa chỉ ví mới', 'add_new_wallet').row();

    // Add back button
    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');

    return keyboard;
  }

  static savedBankAccountSelection(accounts: PaymentInformation[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Add saved bank account buttons
    for (const account of accounts) {
      if (account.bank_id && account.bank_account && account.full_name) {
        // Find bank name
        const bank = banks.find((b) => b.id === account.bank_id);
        const bankName = bank?.short_name || 'Bank';

        // Format: [Bank Name] - [Account] - [Name]
        const label = `🏦 ${bankName} - ${account.bank_account} - ${account.full_name}`;
        keyboard.text(label, `use_saved_bank_${account.id}`).row();
      }
    }

    // Add "Add new bank account" button
    keyboard.text('➕ Thêm tài khoản ngân hàng mới', 'add_new_bank').row();

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
    | 'account_number'
    | 'bank_details_single'; // Single-input for bank details
  bankId?: number;
  bankName?: string;
  fullName?: string;
  accountNumber?: string;
  bankPageOffset?: number;
  paymentInfoId?: number; // ID of selected saved payment info
  isNewPaymentInfo?: boolean; // Flag to indicate if this is new payment info to be saved
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
      try {
        // Extract user information from Telegram context
        const chatId = ctx.chat?.id;
        const firstName = ctx.from?.first_name;
        const lastName = ctx.from?.last_name;
        const username = ctx.from?.username;

        if (!chatId || !firstName) {
          logger.error(
            { chatId, firstName },
            'Missing required user information in /start command'
          );
          await ctx.reply(Messages.ERROR_GENERIC());
          return;
        }

        // Upsert user information to database
        logger.info(
          { chatId, firstName, lastName, username },
          'Upserting user information on /start command'
        );

        await teleUserService.upsertUser({
          chat_id: chatId,
          first_name: firstName,
          last_name: lastName,
          username: username ?? '',
        });

        logger.info({ chatId }, 'User information updated successfully');

        // Send welcome message
        await ctx.reply(Messages.WELCOME(firstName), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.mainMenu(),
        });
      } catch (error) {
        logger.error({ error }, 'Error handling /start command');
        await ctx.reply(Messages.ERROR_GENERIC());
      }
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

      try {
        const chatId = ctx.chat?.id;

        if (!chatId) {
          logger.error('Missing chat ID in account_info callback');
          await ctx.editMessageText(Messages.ERROR_GENERIC(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
          return;
        }

        // Fetch user information from database
        logger.info({ chatId }, 'Fetching user information from database');
        const teleUser = await teleUserService.findByChatId(chatId);

        if (!teleUser) {
          logger.warn({ chatId }, 'User not found in database');
          await ctx.editMessageText(
            `❌ <b>Không tìm thấy thông tin</b>\n\n` +
              `Không tìm thấy thông tin tài khoản của bạn trong hệ thống.\n\n` +
              `Vui lòng thử lại hoặc liên hệ support!`,
            {
              parse_mode: 'HTML',
              reply_markup: Keyboards.backToMenu(),
            }
          );
          return;
        }

        logger.info({ chatId, userId: teleUser.id }, 'User information retrieved successfully');

        // Fetch saved payment information
        logger.info({ chatId }, 'Fetching saved payment information');
        const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(
          chatId,
          'BANK'
        );
        const savedWallets = await paymentInformationService.findByTypeAndChatId(chatId, 'CRYPTO');

        logger.info(
          {
            chatId,
            bankAccountsCount: savedBankAccounts.length,
            walletsCount: savedWallets.length,
          },
          'Payment information retrieved'
        );

        // Display user information from database
        await ctx.editMessageText(
          Messages.ACCOUNT_INFO(
            teleUser.chat_id,
            teleUser.first_name || 'N/A',
            teleUser.last_name ?? null,
            teleUser.username || '',
            teleUser.is_kyc ?? false,
            savedBankAccounts,
            savedWallets
          ),
          {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          }
        );
      } catch (error) {
        logger.error({ error }, 'Error fetching user information');
        await ctx.editMessageText(Messages.ERROR_GENERIC(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      }
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

      // Check for saved wallets
      const savedWallets = await paymentInformationService.findByTypeAndChatId(userId, 'CRYPTO');

      if (savedWallets.length > 0) {
        // Show saved wallets
        userStates.set(userId, { action: 'buy', amount });
        await ctx.editMessageText(Messages.SELECT_SAVED_WALLET(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.savedWalletSelection(savedWallets),
        });
      } else {
        // No saved wallets, ask for wallet address
        userStates.set(userId, {
          action: 'buy',
          amount,
          waitingFor: 'wallet',
          isNewPaymentInfo: true,
        });
        await ctx.editMessageText(Messages.ENTER_WALLET_ADDRESS(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      }
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

      // Check for saved bank accounts
      const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(userId, 'BANK');

      if (savedBankAccounts.length > 0) {
        // Show saved bank accounts
        userStates.set(userId, { action: 'sell', amount });
        await ctx.editMessageText(Messages.SELECT_SAVED_BANK_ACCOUNT(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.savedBankAccountSelection(savedBankAccounts),
        });
      } else {
        // No saved bank accounts, use simplified single-input format
        const state = userStates.get(userId) || {};
        state.action = 'sell';
        state.amount = amount;
        state.waitingFor = 'bank_details_single';
        state.isNewPaymentInfo = true;
        userStates.set(userId, state);

        logger.info(
          { userId, amount },
          'Sell amount selected, showing single-input bank details prompt'
        );

        await ctx.editMessageText(Messages.ENTER_BANK_DETAILS_SINGLE(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      }
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

    // Use saved wallet callback
    this.bot.callbackQuery(/^use_saved_wallet_\d+$/, async (ctx) => {
      // Answer callback query immediately to avoid timeout
      try {
        await ctx.answerCallbackQuery();
      } catch (error) {
        // Callback query might already be answered or expired - log and continue
        logger.debug({ error, userId: ctx.from.id }, 'Failed to answer callback query');
      }

      const userId = ctx.from.id;
      const paymentInfoId = parseInt(ctx.callbackQuery.data.replace('use_saved_wallet_', ''));
      const state = userStates.get(userId);

      if (!state || state.action !== 'buy') {
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      // Get the saved wallet info
      const paymentInfo = await paymentInformationService.findById(paymentInfoId);
      if (!paymentInfo || !paymentInfo.wallet_address) {
        logger.error({ userId, paymentInfoId }, 'Saved wallet not found');
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      state.walletAddress = paymentInfo.wallet_address;
      state.paymentInfoId = paymentInfoId;
      state.waitingFor = undefined;
      userStates.set(userId, state);

      logger.info(
        { userId, paymentInfoId, wallet: paymentInfo.wallet_address },
        'Using saved wallet'
      );

      // Fetch exchange rates and calculate fees
      let rates;
      try {
        rates = await this.fetchExchangeRates();
      } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch exchange rates');
        rates = null;
      }

      if (!rates) {
        try {
          await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        } catch (error) {
          // If edit fails, try sending a new message
          await ctx.reply(Messages.RATE_UNAVAILABLE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        }
        return;
      }

      const vndAmount = parseFloat(state.amount!);
      const usdtAmount = vndAmount / rates.buy;
      const gatewayFeesPercent = parseFloat(process.env.GATEWAY_FEES || '0.5');
      const gatewayFee = vndAmount * (gatewayFeesPercent / 100);

      await ctx.editMessageText(
        Messages.ORDER_SUMMARY_BUY(
          state.amount!,
          paymentInfo.wallet_address,
          usdtAmount,
          rates.buy,
          gatewayFee
        ),
        {
          parse_mode: 'HTML',
          reply_markup: Keyboards.confirmPayment(),
        }
      );
    });

    // Add new wallet callback
    this.bot.callbackQuery('add_new_wallet', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state || state.action !== 'buy') {
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      state.waitingFor = 'wallet';
      state.isNewPaymentInfo = true;
      userStates.set(userId, state);

      logger.info({ userId }, 'User chose to add new wallet');

      await ctx.editMessageText(Messages.ENTER_WALLET_ADDRESS(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    });

    // Use saved bank account callback
    this.bot.callbackQuery(/^use_saved_bank_\d+$/, async (ctx) => {
      // Answer callback query immediately to avoid timeout
      try {
        await ctx.answerCallbackQuery();
      } catch (error) {
        // Callback query might already be answered or expired - log and continue
        logger.debug({ error, userId: ctx.from.id }, 'Failed to answer callback query');
      }

      const userId = ctx.from.id;
      const paymentInfoId = parseInt(ctx.callbackQuery.data.replace('use_saved_bank_', ''));
      const state = userStates.get(userId);

      if (!state || state.action !== 'sell') {
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      // Get the saved bank account info
      const paymentInfo = await paymentInformationService.findById(paymentInfoId);
      if (
        !paymentInfo ||
        !paymentInfo.bank_id ||
        !paymentInfo.full_name ||
        !paymentInfo.bank_account
      ) {
        logger.error({ userId, paymentInfoId }, 'Saved bank account not found');
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      // Find bank name
      const bank = banks.find((b) => b.id === paymentInfo.bank_id);
      if (!bank) {
        logger.error({ userId, bankId: paymentInfo.bank_id }, 'Bank not found');
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      state.bankId = paymentInfo.bank_id;
      state.bankName = bank.short_name;
      state.fullName = paymentInfo.full_name;
      state.accountNumber = paymentInfo.bank_account;
      state.paymentInfoId = paymentInfoId;
      state.waitingFor = undefined;
      userStates.set(userId, state);

      logger.info(
        { userId, paymentInfoId, bankId: paymentInfo.bank_id },
        'Using saved bank account'
      );

      // Fetch exchange rates and calculate fees
      let rates;
      try {
        rates = await this.fetchExchangeRates();
      } catch (error) {
        logger.error({ error, userId }, 'Failed to fetch exchange rates');
        rates = null;
      }

      if (!rates) {
        try {
          await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        } catch (error) {
          // If edit fails, try sending a new message
          await ctx.reply(Messages.RATE_UNAVAILABLE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        }
        return;
      }

      const usdtAmount = parseFloat(state.amount!);
      const totalVND = usdtAmount * rates.sell;
      const gatewayFeesPercent = parseFloat(process.env.GATEWAY_FEES || '0.5');
      const serviceFee = totalVND * (gatewayFeesPercent / 100);

      await ctx.editMessageText(
        Messages.SELL_CONFIRMATION(
          state.amount!,
          bank.short_name,
          paymentInfo.full_name,
          paymentInfo.bank_account,
          rates.sell,
          totalVND,
          serviceFee
        ),
        {
          parse_mode: 'HTML',
          reply_markup: Keyboards.confirmPayment(),
        }
      );
    });

    // Add new bank account callback - Single input flow
    this.bot.callbackQuery('add_new_bank', async (ctx) => {
      await ctx.answerCallbackQuery();
      const userId = ctx.from.id;
      const state = userStates.get(userId);

      if (!state || state.action !== 'sell') {
        await ctx.reply(Messages.ERROR_GENERIC());
        return;
      }

      state.waitingFor = 'bank_details_single';
      state.isNewPaymentInfo = true;
      userStates.set(userId, state);

      logger.info({ userId }, 'User chose to add new bank account - single input mode');

      await ctx.editMessageText(Messages.ENTER_BANK_DETAILS_SINGLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
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
      } else if (state.waitingFor === 'bank_details_single') {
        await this.handleBankDetailsSingleInput(ctx, userId, state, text);
      }
    });

    // Error handler with better error classification
    this.bot.catch((err) => {
      const error = err.error;

      // Handle expected errors gracefully
      if (error?.error_code === 403) {
        // User blocked the bot - this is normal, log at info level
        logger.info(
          {
            errorCode: error.error_code,
            description: error.description,
            userId: err.ctx?.from?.id,
          },
          'User blocked the bot'
        );
        return;
      }

      if (error?.error_code === 400 && error?.description?.includes('query is too old')) {
        // Callback query timeout - user took too long or clicked multiple times
        logger.warn(
          {
            errorCode: error.error_code,
            description: error.description,
            userId: err.ctx?.from?.id,
          },
          'Callback query timeout or duplicate click'
        );
        return;
      }

      // Log unexpected errors at error level
      logger.error(
        {
          error: err,
          errorCode: error?.error_code,
          description: error?.description,
          userId: err.ctx?.from?.id,
        },
        'Unexpected bot error'
      );
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

    // Check for saved wallets
    const savedWallets = await paymentInformationService.findByTypeAndChatId(userId, 'CRYPTO');

    if (savedWallets.length > 0) {
      // Show saved wallets
      userStates.set(userId, state);
      await ctx.reply(Messages.SELECT_SAVED_WALLET(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.savedWalletSelection(savedWallets),
      });
    } else {
      // No saved wallets, ask for wallet address
      state.waitingFor = 'wallet';
      state.isNewPaymentInfo = true;
      userStates.set(userId, state);
      await ctx.reply(Messages.ENTER_WALLET_ADDRESS(), { parse_mode: 'HTML' });
    }
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

    // Check for saved bank accounts
    const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(userId, 'BANK');

    if (savedBankAccounts.length > 0) {
      // Show saved bank accounts
      userStates.set(userId, state);
      await ctx.reply(Messages.SELECT_SAVED_BANK_ACCOUNT(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.savedBankAccountSelection(savedBankAccounts),
      });
    } else {
      // No saved bank accounts, use simplified single-input format
      state.waitingFor = 'bank_details_single';
      state.isNewPaymentInfo = true;
      userStates.set(userId, state);

      logger.info(
        { userId, amount: state.amount },
        'Custom sell amount entered, showing single-input bank details prompt'
      );

      await ctx.reply(Messages.ENTER_BANK_DETAILS_SINGLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    }
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

    // Save wallet address if it's new payment info
    if (state.isNewPaymentInfo) {
      try {
        // Check if wallet already exists
        const exists = await paymentInformationService.walletExists(userId, text);
        if (!exists) {
          await paymentInformationService.createPaymentInfo({
            chat_id: userId,
            type: 'CRYPTO',
            wallet_address: text,
          });
          logger.info({ userId, wallet: text }, 'Saved new wallet address');
        } else {
          logger.info({ userId, wallet: text }, 'Wallet address already exists, skipping save');
        }
      } catch (error) {
        logger.error({ userId, wallet: text, error }, 'Error saving wallet address');
        // Continue with the flow even if save fails
      }
      state.isNewPaymentInfo = false;
    }

    userStates.set(userId, state);

    // Fetch exchange rates and calculate fees
    let rates;
    try {
      rates = await this.fetchExchangeRates();
    } catch (error) {
      logger.error({ error, userId }, 'Failed to fetch exchange rates');
      rates = null;
    }

    if (!rates) {
      await ctx.reply(Messages.RATE_UNAVAILABLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
      return;
    }

    const vndAmount = parseFloat(state.amount!);
    const usdtAmount = vndAmount / rates.buy;
    const gatewayFeesPercent = parseFloat(process.env.GATEWAY_FEES || '0.5');
    const gatewayFee = vndAmount * (gatewayFeesPercent / 100);

    await ctx.reply(
      Messages.ORDER_SUMMARY_BUY(state.amount!, text, usdtAmount, rates.buy, gatewayFee),
      {
        parse_mode: 'HTML',
        reply_markup: Keyboards.confirmPayment(),
      }
    );
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

    logger.info({ userId, accountNumber: text }, 'Account number entered');

    // Show confirmation screen with all collected details
    if (!state.amount || !state.bankName || !state.fullName || !state.bankId) {
      logger.error({ userId, state }, 'Missing required fields for sell confirmation');
      await ctx.reply(Messages.ERROR_GENERIC());
      return;
    }

    // Save bank account if it's new payment info
    if (state.isNewPaymentInfo) {
      try {
        // Check if bank account already exists
        const exists = await paymentInformationService.bankAccountExists(
          userId,
          state.bankId,
          text
        );
        if (!exists) {
          await paymentInformationService.createPaymentInfo({
            chat_id: userId,
            type: 'BANK',
            bank_id: state.bankId,
            full_name: state.fullName,
            bank_account: text,
          });
          logger.info(
            { userId, bankId: state.bankId, accountNumber: text },
            'Saved new bank account'
          );
        } else {
          logger.info(
            { userId, bankId: state.bankId, accountNumber: text },
            'Bank account already exists, skipping save'
          );
        }
      } catch (error) {
        logger.error(
          { userId, bankId: state.bankId, accountNumber: text, error },
          'Error saving bank account'
        );
        // Continue with the flow even if save fails
      }
      state.isNewPaymentInfo = false;
    }

    userStates.set(userId, state);

    // Fetch exchange rates and calculate fees
    let rates;
    try {
      rates = await this.fetchExchangeRates();
    } catch (error) {
      logger.error({ error, userId }, 'Failed to fetch exchange rates');
      rates = null;
    }

    if (!rates) {
      await ctx.reply(Messages.RATE_UNAVAILABLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
      return;
    }

    const usdtAmount = parseFloat(state.amount);
    const totalVND = usdtAmount * rates.sell;
    const gatewayFeesPercent = parseFloat(process.env.GATEWAY_FEES || '0.5');
    const serviceFee = totalVND * (gatewayFeesPercent / 100);

    await ctx.reply(
      Messages.SELL_CONFIRMATION(
        state.amount,
        state.bankName,
        state.fullName,
        text,
        rates.sell,
        totalVND,
        serviceFee
      ),
      {
        parse_mode: 'HTML',
        reply_markup: Keyboards.confirmPayment(),
      }
    );
  }

  /**
   * Handle bank details single input (format: BANK_NAME, FULL_NAME, ACCOUNT_NUMBER)
   */
  private async handleBankDetailsSingleInput(
    ctx: any,
    userId: number,
    state: UserState,
    text: string
  ): Promise<void> {
    // Split by comma and trim whitespace
    const parts = text.split(',').map((part) => part.trim());

    // Validate format: must have exactly 3 parts
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      await ctx.reply(Messages.INVALID_BANK_DETAILS_FORMAT(), { parse_mode: 'HTML' });
      return;
    }

    const bankNameInput = parts[0];
    const fullNameInput = parts[1];
    const accountNumberInput = parts[2];

    // Validate bank name: must not contain numbers
    if (/\d/.test(bankNameInput)) {
      await ctx.reply(Messages.INVALID_BANK_NAME_HAS_NUMBERS(), { parse_mode: 'HTML' });
      return;
    }

    // Validate full name: must not contain numbers and minimum 2 characters
    if (/\d/.test(fullNameInput)) {
      await ctx.reply(Messages.INVALID_FULL_NAME_HAS_NUMBERS(), { parse_mode: 'HTML' });
      return;
    }

    if (fullNameInput.length < 2) {
      await ctx.reply(Messages.INVALID_FULL_NAME(), { parse_mode: 'HTML' });
      return;
    }

    // Validate account number: must be numeric only
    if (!/^\d+$/.test(accountNumberInput)) {
      await ctx.reply(Messages.INVALID_ACCOUNT_NUMBER(), { parse_mode: 'HTML' });
      return;
    }

    // Convert to uppercase
    const bankNameUpper = bankNameInput.toUpperCase();
    const fullNameUpper = fullNameInput.toUpperCase();

    // Find bank by name (case-insensitive matching)
    const bank = banks.find(
      (b) =>
        b.short_name.toUpperCase() === bankNameUpper ||
        b.bank_name.toUpperCase().includes(bankNameUpper) ||
        b.cvpay_code.toUpperCase() === bankNameUpper
    );

    if (!bank) {
      logger.warn({ userId, bankNameInput: bankNameUpper }, 'Bank not found');
      await ctx.reply(Messages.BANK_NOT_FOUND(), { parse_mode: 'HTML' });
      return;
    }

    // Set state with parsed values
    state.bankId = bank.id;
    state.bankName = bank.short_name;
    state.fullName = fullNameUpper;
    state.accountNumber = accountNumberInput;
    state.waitingFor = undefined;

    logger.info(
      { userId, bankId: bank.id, bankName: bank.short_name, fullName: fullNameUpper },
      'Bank details parsed successfully from single input'
    );

    // Save bank account if it's new payment info
    if (state.isNewPaymentInfo) {
      try {
        // Check if bank account already exists
        const exists = await paymentInformationService.bankAccountExists(
          userId,
          bank.id,
          accountNumberInput
        );
        if (!exists) {
          await paymentInformationService.createPaymentInfo({
            chat_id: userId,
            type: 'BANK',
            bank_id: bank.id,
            full_name: fullNameUpper,
            bank_account: accountNumberInput,
          });
          logger.info(
            { userId, bankId: bank.id, accountNumber: accountNumberInput },
            'Saved new bank account from single input'
          );
        } else {
          logger.info(
            { userId, bankId: bank.id, accountNumber: accountNumberInput },
            'Bank account already exists, skipping save'
          );
        }
      } catch (error) {
        logger.error(
          { userId, bankId: bank.id, accountNumber: accountNumberInput, error },
          'Error saving bank account from single input'
        );
        // Continue with the flow even if save fails
      }
      state.isNewPaymentInfo = false;
    }

    userStates.set(userId, state);

    // Show confirmation screen with all collected details
    if (!state.amount) {
      logger.error({ userId, state }, 'Missing amount for sell confirmation');
      await ctx.reply(Messages.ERROR_GENERIC());
      return;
    }

    // Fetch exchange rates and calculate fees
    let rates;
    try {
      rates = await this.fetchExchangeRates();
    } catch (error) {
      logger.error({ error, userId }, 'Failed to fetch exchange rates');
      rates = null;
    }

    if (!rates) {
      await ctx.reply(Messages.RATE_UNAVAILABLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
      return;
    }

    const usdtAmount = parseFloat(state.amount);
    const totalVND = usdtAmount * rates.sell;
    const gatewayFeesPercent = parseFloat(process.env.GATEWAY_FEES || '0.5');
    const serviceFee = totalVND * (gatewayFeesPercent / 100);

    await ctx.reply(
      Messages.SELL_CONFIRMATION(
        state.amount,
        bank.short_name,
        fullNameUpper,
        accountNumberInput,
        rates.sell,
        totalVND,
        serviceFee
      ),
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

      // Send wallet address only (for easy copying)
      await ctx.reply(`<code>${recipientAddress}</code>`, {
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
          `⏰ Sau khi chuyển USDT, tiền VND sẽ được chuyển vào tài khoản của bạn trong vòng 3-30 giây.\n\n` +
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
