import { banks } from '../../models/webhook';
import type { PaymentInformation, Kyc } from '../../models/types';
import type { Usdt247Timestamp } from '../../models/usdt247';
import { appConfig, telegramConfig } from '../../config/app';
import { DateTime } from 'luxon';

function resolveBankName(bankId?: string | number | null): string {
  if (bankId === undefined || bankId === null || bankId === '') return 'N/A';
  const numericBankId = typeof bankId === 'string' ? Number(bankId) : bankId;
  if (!Number.isFinite(numericBankId)) return String(bankId);
  const bank = banks.find((item) => item.id === numericBankId);
  return bank?.short_name || bank?.bank_name || String(bankId);
}

export const formatTimeWithTimeZone = (input?: string | Date | Usdt247Timestamp): string => {
  let dateValue: Date | undefined;
  if (input instanceof Date) {
    dateValue = input;
  } else if (typeof input === 'string') {
    dateValue = new Date(input);
  } else if (input && typeof input === 'object' && 'seconds' in input && 'nanos' in input) {
    dateValue = new Date(input.seconds * 1000 + input.nanos / 1000000);
  }

  const dt = dateValue
    ? DateTime.fromJSDate(dateValue).setZone(appConfig.timeZone)
    : DateTime.now().setZone(appConfig.timeZone);
  const time = dt.toFormat('HH:mm:ss');
  const date = dt.toFormat('d/M/yyyy');
  const offset = dt.offsetNameShort;
  return `${time} ${date} ${offset}`;
};

export const Messages = {
  WELCOME: (firstName: string) =>
    `👋 Xin chào <b>${firstName}</b>!\n\n` +
    `🤖 Chào mừng bạn đến với Bot Mua/Bán USDC tự động!\n\n` +
    `💰 Tỷ giá cạnh tranh nhất thị trường\n` +
    `⚡️ Giao dịch nhanh chóng, an toàn\n` +
    `🔒 Bảo mật tuyệt đối\n\n` +
    `Vui lòng chọn chức năng bên dưới:`,

  RATE_CHECK: (
    buyRate: number,
    sellRate: number,
    xlmBuyRate: number | string | null,
    xlmSellRate: number | string | null,
    updated: string
  ) =>
    `💱 <b>TỶ GIÁ USDC HIỆN TẠI</b>\n\n` +
    `<b>💵 Tỷ giá USDC:</b>\n` +
    `mua: <b>${buyRate.toLocaleString('vi-VN')}đ</b> | bán: <b>${sellRate.toLocaleString('vi-VN')}đ</b>\n\n` +
    `<b>💵 Tỷ giá XLM:</b>\n` +
    `mua: <b>${typeof xlmBuyRate === 'number' ? xlmBuyRate.toLocaleString('vi-VN') + 'đ' : xlmBuyRate || 'N/A'}</b> | bán: <b>${typeof xlmSellRate === 'number' ? xlmSellRate.toLocaleString('vi-VN') + 'đ' : xlmSellRate || 'N/A'}</b>\n\n` +
    `🕐 Cập nhật: ${updated}\n\n` +
    `💡 Tỷ giá được cập nhật liên tục`,

  RATE_UNAVAILABLE: () =>
    `⚠️ <b>Không thể lấy tỷ giá</b>\n\n` +
    `Hệ thống đang bảo trì hoặc có lỗi kết nối.\n` +
    `Vui lòng thử lại sau ít phút.`,

  TRADE_MENU: (assetCode: string) =>
    `💱 <b>GIAO DỊCH ${assetCode}</b>\n\n` + `Chọn hành động bạn muốn thực hiện:`,

  BUY_SELECT_AMOUNT: (assetCode = 'USDC') =>
    `💰 <b>MUA ${assetCode}</b>\n\n` + `Vui lòng chọn số lượng ${assetCode} muốn mua:`,

  SELL_SELECT_AMOUNT: (assetCode = 'USDC') =>
    `💸 <b>BÁN ${assetCode}</b>\n\n` + `Vui lòng chọn số lượng ${assetCode} muốn bán:`,

  ENTER_CUSTOM_AMOUNT_BUY: (assetCode = 'USDC', minAmount?: number, maxAmount?: number) => {
    const min =
      minAmount ??
      (assetCode === 'XLM'
        ? parseFloat(process.env.MIN_XLM_AMOUNT || '5')
        : parseFloat(process.env.MIN_USDC_AMOUNT || '1'));
    const max =
      maxAmount ??
      (assetCode === 'XLM'
        ? parseFloat(process.env.MAX_XLM_AMOUNT || '100000')
        : parseFloat(process.env.MAX_USDC_AMOUNT || '100000'));
    return (
      `✏️ Vui lòng nhập số lượng ${assetCode} muốn mua:\n\n` +
      `⚠️ Tối thiểu: <b>${min} ${assetCode}</b>\n` +
      `⚠️ Tối đa: <b>${max} ${assetCode}</b>\n` +
      `📊 Ví dụ: 10, 50, 100`
    );
  },

  ENTER_CUSTOM_AMOUNT_SELL: (assetCode = 'USDC', minAmount?: number, maxAmount?: number) => {
    const min =
      minAmount ??
      (assetCode === 'XLM'
        ? parseFloat(process.env.MIN_XLM_AMOUNT || '5')
        : parseFloat(process.env.MIN_USDC_AMOUNT || '1'));
    const max =
      maxAmount ??
      (assetCode === 'XLM'
        ? parseFloat(process.env.MAX_XLM_AMOUNT || '100000')
        : parseFloat(process.env.MAX_USDC_AMOUNT || '100000'));
    return (
      `✏️ Vui lòng nhập số lượng ${assetCode} muốn bán:\n\n` +
      `⚠️ Tối thiểu: <b>${min} ${assetCode}</b>\n` +
      `⚠️ Tối đa: <b>${max} ${assetCode}</b>\n` +
      `📊 Ví dụ: 10, 50, 100`
    );
  },

  ENTER_WALLET_ADDRESS: (assetCode = 'USDC') =>
    `📮 <b>NHẬP ĐỊA CHỈ VÍ</b>\n\n` +
    `Vui lòng nhập địa chỉ ví Stellar để nhận ${assetCode}:\n\n` +
    `⚠️ Lưu ý: Kiểm tra kỹ địa chỉ ví trước khi gửi!`,

  TRUSTLINE_REQUIRED: (assetCode: string, issuer: string) =>
    `🛡️ <b>THÊM TRUSTLINE ${assetCode}</b>\n\n` +
    `Ví của bạn chưa có trustline để nhận và nắm giữ <b>${assetCode}</b>.\n\n` +
    `• Chi phí: ~ <b>0.00001 XLM</b>\n` +
    `• Bảo mật: ký không lưu ký (Non-custodial)\n` +
    `• Issuer: <code>${issuer}</code>\n\n` +
    `Chọn cách ký bên dưới, sau đó quay lại bấm xác nhận mua lại.`,

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

  INVALID_AMOUNT_RANGE: (assetCode: string, minAmount: number, maxAmount: number) =>
    `❌ <b>Số lượng không hợp lệ!</b>\n\n` +
    `Số lượng ${assetCode} phải nằm trong khoảng từ <b>${minAmount}</b> đến <b>${maxAmount}</b>.\n\n` +
    `Vui lòng nhập lại số lượng hợp lệ!`,

  INVALID_WALLET: () =>
    `❌ Địa chỉ ví không hợp lệ!\n\n` + `Vui lòng nhập địa chỉ ví Stellar hợp lệ (G...)`,

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
    usdtAmount: string,
    wallet: string,
    totalAmount: number,
    buyRate: number,
    gatewayFee: number,
    assetCode = 'USDC'
  ) =>
    `📋 <b>XÁC NHẬN ĐƠN HÀNG - MUA ${assetCode}</b>\n\n` +
    `Đơn hàng MUA <b>${usdtAmount} ${assetCode}</b> x <b>${buyRate.toLocaleString('vi-VN')}đ</b>\n\n` +
    `🌐 Mạng: Stellar | ⚡ Phí gas: $0.00\n` +
    `💰 Thành tiền: <b>${Math.round(totalAmount).toLocaleString('vi-VN')}đ</b> | 💳 Phí dịch vụ: <b>${Math.round(gatewayFee).toLocaleString('vi-VN')}đ</b>\n` +
    `📮 Ví nhận: <code>${wallet}</code>\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi thanh toán!`,

  ACTIVATE_WALLET_SUMMARY: (
    wallet: string,
    xlmAmount: string,
    xlmRate: number,
    totalVND: number,
    serviceFee: number
  ) =>
    `⚡ <b>XÁC NHẬN ĐƠN HÀNG - MUA XLM (KÍCH HOẠT VÍ STELLAR)</b>\n\n` +
    `Ví Stellar của bạn chưa được kích hoạt trên mạng lưới.\n\n` +
    `💎 Số lượng XLM: <b>${xlmAmount} XLM</b>\n` +
    `💱 Tỷ giá XLM: <b>${xlmRate.toLocaleString('vi-VN')}đ</b>\n` +
    `💰 Thành tiền: <b>${Math.round(totalVND).toLocaleString('vi-VN')}đ</b> |  💳 Phí dịch vụ: <b>${Math.round(serviceFee).toLocaleString('vi-VN')}đ</b>\n\n` +
    `📮 Ví nhận: <code>${wallet}</code>\n` +
    `Sau khi thanh toán, hệ thống sẽ gửi XLM để kích hoạt ví, sau đó bạn có thể bắt đầu mua/bán USDC.`,

  ORDER_SUMMARY_SELL: (amount: string, assetCode = 'USDC') =>
    `📋 <b>XÁC NHẬN ĐƠN HÀNG - BÁN ${assetCode}</b>\n\n` +
    `💎 Số lượng: <b>${amount} ${assetCode}</b>\n` +
    `🌐 Mạng: Stellar\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi chuyển ${assetCode}!`,

  SELL_CONFIRMATION: (
    amount: string,
    bankName: string,
    fullName: string,
    accountNumber: string,
    sellRate: number,
    totalVND: number,
    serviceFee: number,
    assetCode = 'USDC'
  ) =>
    `💸 <b>XÁC NHẬN ĐƠN HÀNG - BÁN ${assetCode}</b>\n\n` +
    `Đơn hàng BÁN <b>${amount} ${assetCode}</b> x <b>${sellRate.toLocaleString('vi-VN')}đ</b>\n\n` +
    `🌐 Mạng: Stellar | ⚡ Phí gas: $0.00\n` +
    `💰 Thành tiền: <b>${Math.round(totalVND - serviceFee).toLocaleString('vi-VN')}đ</b> |  💳 Phí dịch vụ: <b>${Math.round(serviceFee).toLocaleString('vi-VN')}đ</b>\n\n` +
    `<b>TÀI KHOẢN NHẬN TIỀN:</b>\n` +
    `🏦 Ngân hàng: <b>${bankName}</b>\n` +
    `👤 Tên tài khoản: <b>${fullName}</b>\n` +
    `💳 Số tài khoản: <code>${accountNumber}</code>\n\n` +
    `⚠️ Vui lòng kiểm tra kỹ thông tin trước khi xác nhận!`,

  PAYMENT_QR_MESSAGE: (
    bankName?: string,
    accountNumber?: string,
    accountName?: string,
    totalAmount?: number
  ) => {
    let message = `🏦 <b>THÔNG TIN CHUYỂN KHOẢN</b>\n\n`;

    if (bankName && accountNumber && accountName) {
      message += `🏛️ Ngân hàng: <b>${bankName}</b>\n`;
      message += `💳 Số tài khoản: <code>${accountNumber}</code>\n`;
      message += `👤 Chủ tài khoản: <b>${accountName}</b>\n\n`;
    }

    if (totalAmount) {
      message += `💰 Số tiền: <code>${Math.round(totalAmount).toLocaleString('vi-VN')}đ</code>\n\n`;
    }

    message += `💰 Vui lòng quét mã QR bên dưới để thanh toán`;
    return message;
  },

  SELECT_GATEWAY: () =>
    `🏧 <b>CHỌN PHƯƠNG THỨC THANH TOÁN</b>\n\n` +
    `Vui lòng chọn phương thức thanh toán:\n\n` +
    `🏦 <b>Chuyển khoản ngân hàng</b> — chuyển khoản thông thường\n` +
    `⚡ <b>NAPAS</b> — quét QR nhanh qua ứng dụng ngân hàng (VietQR)`,

  ORDER_PAYMENT_BUY: (
    usdtAmount: string,
    wallet: string,
    buyRate: number,
    gatewayFee: number,
    bankName?: string,
    accountNumber?: string,
    accountName?: string,
    totalVnd?: number,
    assetCode = 'USDC',
    expiredAt?: Parameters<typeof formatTimeWithTimeZone>[0]
  ) => {
    const totalAmount = totalVnd || parseFloat(usdtAmount) * buyRate + gatewayFee;
    let message = `🏦 <b>ĐƠN HÀNG - MUA ${assetCode}</b>\n\n`;
    message += `Đơn hàng MUA <b>${usdtAmount} ${assetCode}</b> x <b>${buyRate.toLocaleString('vi-VN')}đ</b>\n\n`;
    message += `🌐 Mạng: Stellar | ⚡ Phí gas: $0.00\n`;
    message += `💰 Thành tiền: <b>${Math.round(totalAmount).toLocaleString('vi-VN')}đ</b> | 💳 Phí dịch vụ: <b>${Math.round(gatewayFee).toLocaleString('vi-VN')}đ</b>\n`;
    message += `📮 Ví nhận: <code>${wallet}</code>\n\n`;
    if (bankName && accountNumber) {
      message += `🏛️ Ngân hàng: <b>${bankName}</b>\n`;
      message += `💳 Số tài khoản: <code>${accountNumber}</code>\n`;
      if (accountName) {
        message += `👤 Chủ tài khoản: <b>${accountName}</b>\n`;
      }
      message += '\n';
    }
    message += `💰 Vui lòng quét mã QR bên dưới để thanh toán`;
    if (expiredAt) {
      message += `\n\n⚠️ <b>Lưu ý:</b> Vui lòng thanh toán trước <b>${formatTimeWithTimeZone(expiredAt)}</b> để tránh bị hủy đơn.\n`;
    }
    return message;
  },

  ORDER_PAYMENT_ACTIVATE_WALLET: (
    xlmAmount: string,
    wallet: string,
    xlmRate: number,
    serviceFee: number,
    totalAmount: number,
    bankName?: string,
    accountNumber?: string,
    accountName?: string
  ) => {
    let message = `🏦 <b>ĐƠN HÀNG - MUA XLM (KÍCH HOẠT VÍ STELLAR)</b>\n\n`;
    message += `Kích hoạt ví với <b>${xlmAmount} XLM</b> x <b>${xlmRate.toLocaleString('vi-VN')}đ</b>\n\n`;
    message += `🌐 Mạng: Stellar | ⚡ Phí gas: $0.00\n`;
    message += `💰 Thành tiền: <b>${Math.round(totalAmount).toLocaleString('vi-VN')}đ</b> |  💳 Phí dịch vụ: <b>${Math.round(serviceFee).toLocaleString('vi-VN')}đ</b>\n`;
    message += `📮 Ví nhận: <code>${wallet}</code>\n\n`;
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
    `⏰ Sau khi thanh toán, USDC sẽ được chuyển vào ví của bạn trong vòng 3-30 giây.\n\n` +
    `📞 Liên hệ support nếu có vấn đề!`,

  ORDER_PAYMENT_SELL: (
    recipientAddress: string,
    usdtAmount: string,
    memo: string,
    netVndAmount?: number,
    bankName?: string,
    accountNumber?: string,
    fullName?: string,
    assetCode = 'USDC',
    expiredAt?: Parameters<typeof formatTimeWithTimeZone>[0]
  ) => {
    const isXlm = assetCode === 'XLM';
    const tokenLine = isXlm
      ? `💎 Token: <b>XLM (Native)</b>\n`
      : `💎 Token: <b>USDC (Circle)</b>\n` +
      `📄 Issuer: <code>${telegramConfig.tokenAddress}</code> | Asset name: <b>USDC</b>\n`;
    return (
      `<b>ĐƠN HÀNG - BÁN ${assetCode}</b>\n\n` +
      `💰 Số lượng: <code>${usdtAmount} ${assetCode}</code>\n\n` +
      `Vui lòng chuyển ${assetCode} đến địa chỉ ví:\n` +
      `<code>${recipientAddress}</code>\n\n` +
      `🌐 Mạng: <b>Stellar</b>\n` +
      tokenLine +
      `\n` +
      `🧾 <b>Memo bắt buộc:</b> <code>${memo}</code>\n` +
      `⚠️ Nếu thiếu/sai memo, hệ thống không thể đối soát đơn hàng.\n\n` +
      `⏰ Sau khi chuyển ${assetCode}, tiền VND sẽ được chuyển vào tài khoản của bạn trong vòng 3-30 giây.` +
      (netVndAmount
        ? `\n💰 <b>Số tiền nhận:</b> ${netVndAmount.toLocaleString('vi-VN')} VND`
        : '') +
      `${bankName
        ? `\n\n🏛️ Ngân hàng: <b>${bankName}</b>\n💳 Số TK: <code>${accountNumber}</code>\n👤 Chủ TK: <b>${fullName}</b>`
        : ''
      }\n\n` +
      (expiredAt
        ? `⚠️ <b>Lưu ý:</b> Vui lòng thanh toán trước <b>${formatTimeWithTimeZone(expiredAt)}</b> để tránh bị hủy đơn.\n\n`
        : '') +
      `📞 Liên hệ support nếu có vấn đề!`
    );
  },

  PAYMENT_CANCELLED: () =>
    `❌ <b>ĐÃ HỦY THANH TOÁN</b>\n\n` +
    `Đơn hàng đã được hủy.\n\n` +
    `Bạn có thể thực hiện giao dịch mới bất cứ lúc nào!`,

  ORDER_CANCELLED: () =>
    `✅ <b>ĐÃ HỦY ĐƠN HÀNG</b>\n\n` +
    `Đơn hàng của bạn đã được hủy thành công.\n\n` +
    `Bạn có thể thực hiện giao dịch mới bất cứ lúc nào!`,

  ORDER_CANCEL_FAILED: (reason?: string) =>
    `❌ <b>KHÔNG THỂ HỦY ĐƠN HÀNG</b>\n\n` +
    `${reason || 'Đơn hàng không thể hủy (có thể đã hoàn thành hoặc hết hạn).'}\n\n` +
    `Vui lòng liên hệ support nếu cần hỗ trợ!`,

  SELECT_SAVED_WALLET: () =>
    `🔑 <b>CHỌN ĐỊA CHỈ VÍ</b>\n\n` +
    `Bạn có các địa chỉ ví đã lưu. Vui lòng chọn một địa chỉ hoặc thêm địa chỉ mới:`,

  SELECT_SAVED_BANK_ACCOUNT: () =>
    `🏦 <b>CHỌN TÀI KHOẢN NGÂN HÀNG</b>\n\n` +
    `Bạn có các tài khoản ngân hàng đã lưu. Vui lòng chọn một tài khoản hoặc thêm tài khoản mới:`,

  CONFIRM_DELETE_BANK: (bankName: string, accountNumber: string, fullName?: string) =>
    `⚠️ <b>XÁC NHẬN XÓA</b>\n\n` +
    `Bạn có chắc muốn xóa tài khoản ngân hàng?\n\n` +
    `🏛️ Ngân hàng: <b>${bankName}</b>\n` +
    `💳 Số TK: <code>${accountNumber}</code>\n` +
    (fullName ? `👤 Chủ TK: <b>${fullName}</b>\n` : '') +
    `\n⚠️ Hành động này không thể hoàn tác!`,

  CONFIRM_DELETE_WALLET: (walletAddress: string) =>
    `⚠️ <b>XÁC NHẬN XÓA</b>\n\n` +
    `Bạn có chắc muốn xóa địa chỉ ví?\n\n` +
    `📮 Địa chỉ: <code>${walletAddress}</code>\n\n` +
    `⚠️ Hành động này không thể hoàn tác!`,

  DELETE_SUCCESS: () =>
    `✅ <b>ĐÃ XÓA THÀNH CÔNG</b>\n\n` + `Thông tin thanh toán đã được xóa khỏi hệ thống.`,

  DELETE_FAILED: () =>
    `❌ <b>XÓA THẤT BẠI</b>\n\n` +
    `Không thể xóa thông tin thanh toán.\n` +
    `Vui lòng thử lại hoặc liên hệ support!`,

  ENTER_DELETE_BANK_INDEX: (accounts: any[]) => {
    let message = `🗑️ <b>XÓA TÀI KHOẢN NGÂN HÀNG</b>\n\n`;
    message += `Danh sách tài khoản:\n\n`;

    accounts.forEach((account, index) => {
      const bank = banks.find((b) => b.id === account.bank_id);
      const bankName = bank ? bank.short_name : 'N/A';

      message += `<b>${index + 1}. ${account.full_name || 'N/A'}</b>\n`;
      message += `   🏛️ Ngân hàng: ${bankName}\n`;
      message += `   💳 Số TK: <code>${account.bank_account || 'N/A'}</code>\n\n`;
    });

    message += `Vui lòng nhập số thứ tự tài khoản muốn xóa (ví dụ: 1, 2):`;
    return message;
  },

  ENTER_DELETE_WALLET_INDEX: (wallets: any[]) => {
    let message = `🗑️ <b>XÓA VÍ CRYPTO</b>\n\n`;
    message += `Danh sách ví:\n\n`;

    wallets.forEach((wallet, index) => {
      const address = wallet.wallet_address || 'N/A';

      message += `<b>${index + 1}.</b> <code>${address}</code>\n`;
    });

    message += `\nVui lòng nhập số thứ tự ví muốn xóa (ví dụ: 1, 2):`;
    return message;
  },

  INVALID_DELETE_INDEX: () =>
    `❌ <b>SỐ THỨ TỰ KHÔNG HỢP LỆ</b>\n\n` + `Vui lòng nhập một số hợp lệ từ danh sách.`,

  KYC_REQUIRED: () =>
    `🔐 <b>YÊU CẦU XÁC MINH KYC</b>\n\n` +
    `Bạn cần xác minh danh tính (KYC) để thực hiện giao dịch.\n\n` +
    `📞 Vui lòng liên hệ support để được hướng dẫn!`,

  KYC_REQUIRED_FOR_TRADING: () =>
    `🔐 <b>YÊU CẦU XÁC MINH DANH TÍNH</b>\n\n` +
    `Để đảm bảo an toàn và tuân thủ quy định, bạn cần hoàn thành xác minh danh tính (KYC) trước khi mua/bán USDC.\n\n` +
    `<b>Lợi ích của KYC:</b>\n` +
    `✅ Bảo vệ tài khoản của bạn\n` +
    `✅ Tuân thủ quy định pháp luật\n` +
    `✅ Giao dịch an toàn và minh bạch\n` +
    `✅ Hạn mức giao dịch cao hơn\n\n` +
    `<b>Quy trình KYC nhanh chóng:</b>\n` +
    `1️⃣ Xác minh số điện thoại\n` +
    `2️⃣ Chụp ảnh CCCD/CMND/Passport\n\n` +
    `⏱️ Chỉ mất 2-3 phút để hoàn thành!\n\n` +
    `Nhấn nút bên dưới để bắt đầu xác minh ngay.`,

  KYC_INFO: () =>
    `🔐 <b>XÁC MINH DANH TÍNH (KYC)</b>\n\n` +
    `Để đảm bảo an toàn và tuân thủ quy định, chúng tôi yêu cầu xác minh danh tính cho các giao dịch lớn.\n\n` +
    `<b>Quy trình KYC:</b>\n\n` +
    `1️⃣ Xác minh số điện thoại\n` +
    `2️⃣ Cung cấp CCCD/CMND/Passport\n\n` +
    `📞 Liên hệ support để được hướng dẫn chi tiết!`,

  KYC_NOT_COMPLETED: () =>
    `🔐 <b>XÁC MINH DANH TÍNH (KYC)</b>\n\n` +
    `Bạn chưa hoàn thành xác minh danh tính.\n\n` +
    `Để sử dụng đầy đủ các tính năng giao dịch, vui lòng hoàn thành quy trình KYC.\n\n` +
    `<b>Quy trình KYC bao gồm:</b>\n\n` +
    `1️⃣ Xác minh số điện thoại\n` +
    `2️⃣ Cung cấp thông tin CCCD/CMND/Passport\n\n` +
    `Nhấn nút bên dưới để bắt đầu!`,

  KYC_COMPLETED: (kyc: Kyc) => {
    return (
      `✅ <b>THÔNG TIN KYC</b>\n\n` +
      `Quý khách đã hoàn thành KYC với tên: <b>${kyc.name}</b> - <code>${kyc.phone}</code>\n\n` +
      `💡 Thông tin KYC của bạn đã được xác minh và mã hoá bằng công nghệ zk.`
    );
  },

  KYC_REQUEST_PHONE: () =>
    `📱 <b>XÁC MINH SỐ ĐIỆN THOẠI</b>\n\n` +
    `Vui lòng chia sẻ số điện thoại của bạn để tiếp tục.\n\n` +
    `Nhấn nút "📱 Chia sẻ số điện thoại" bên dưới để chia sẻ số điện thoại từ Telegram.`,

  KYC_INVALID_PHONE: () =>
    `❌ <b>SỐ ĐIỆN THOẠI KHÔNG HỢP LỆ</b>\n\n` +
    `Vui lòng nhập số điện thoại hợp lệ.\n\n` +
    `📝 Định dạng chấp nhận:\n` +
    `• 0xxxxxxxxx (10 chữ số)\n` +
    `• +84xxxxxxxxx (bắt đầu với +84)\n\n` +
    `Vui lòng thử lại!`,

  KYC_PHONE_RECEIVED: (phoneNumber: string) =>
    `✅ <b>ĐÃ NHẬN SỐ ĐIỆN THOẠI</b>\n\n` +
    `📱 Số điện thoại: <code>${phoneNumber}</code>\n\n` +
    `Cảm ơn bạn! Chúng tôi sẽ tiếp tục với các bước tiếp theo của quy trình KYC.`,

  KYC_SELECT_DOCUMENT_TYPE: () =>
    `📄 <b>CHỌN LOẠI GIẤY TỜ</b>\n\n` +
    `Vui lòng chọn loại giấy tờ bạn muốn sử dụng để xác minh danh tính:\n\n` +
    `🆔 <b>CMND/CCCD</b> - Chứng minh nhân dân / Căn cước công dân\n` +
    `🛂 <b>Hộ chiếu</b> - Passport\n\n` +
    `Nhấn nút bên dưới để chọn:`,

  KYC_REQUEST_ID_CARD: () =>
    `📸 <b>CHỤP ẢNH CCCD</b>\n\n` +
    `Vui lòng gửi ảnh <b>mặt trước</b> của Căn cước công dân (CCCD) của bạn.\n\n` +
    `📝 <b>Lưu ý:</b>\n` +
    `• Ảnh phải rõ nét, không bị mờ\n` +
    `• Đảm bảo đầy đủ 4 góc của CCCD\n` +
    `• Không chụp qua màn hình\n` +
    `• Ánh sáng đủ, không bị lóa\n\n` +
    `📷 Nhấn nút 📎 và chọn ảnh từ thư viện hoặc chụp ảnh mới.`,

  KYC_REQUEST_ID_CARD_BACK: () =>
    `📸 <b>CHỤP ẢNH CCCD - MẶT SAU</b>\n\n` +
    `✅ <b>Mặt trước đã xử lý thành công!</b>\n\n` +
    `Bây giờ vui lòng gửi ảnh <b>mặt sau</b> của Căn cước công dân (CCCD) của bạn.\n\n` +
    `📝 <b>Lưu ý:</b>\n` +
    `• Ảnh phải rõ nét, không bị mờ\n` +
    `• Đảm bảo đầy đủ 4 góc của CCCD\n` +
    `• Không chụp qua màn hình\n` +
    `• Ánh sáng đủ, không bị lóa\n\n` +
    `📷 Nhấn nút 📎 và chọn ảnh từ thư viện hoặc chụp ảnh mới.`,

  KYC_REQUEST_PASSPORT: () =>
    `📸 <b>CHỤP ẢNH HỘ CHIẾU</b>\n\n` +
    `Vui lòng gửi ảnh <b>trang thông tin cá nhân</b> của Hộ chiếu (Passport) của bạn.\n\n` +
    `📝 <b>Lưu ý:</b>\n` +
    `• Ảnh phải rõ nét, không bị mờ\n` +
    `• Đảm bảo đầy đủ thông tin trên trang\n` +
    `• Không chụp qua màn hình\n` +
    `• Ánh sáng đủ, không bị lóa\n\n` +
    `📷 Nhấn nút 📎 và chọn ảnh từ thư viện hoặc chụp ảnh mới.`,

  KYC_PROCESSING_IMAGE: () =>
    `🤖 <b>AI ĐANG XỬ LÝ ẢNH...</b>\n\n` +
    `Vui lòng đợi trong giây lát, AI của chúng tôi đang tự động phân tích thông tin từ giấy tờ của bạn.`,

  KYC_ID_CARD_EXTRACTED: (idData: any, documentType: 'cccd' | 'passport' = 'cccd') => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      try {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          return `${parts[0]}/${parts[1]}/${parts[2]}`;
        }
        return dateStr;
      } catch {
        return dateStr;
      }
    };

    const formatSex = (sex: string | undefined) => {
      if (!sex) return 'N/A';
      const parts = sex.split('/');
      return parts[0] || sex;
    };

    if (documentType === 'passport') {
      return (
        `✅ <b>THÔNG TIN ĐÃ TRÍCH XUẤT</b>\n\n` +
        `Vui lòng kiểm tra thông tin bên dưới:\n\n` +
        `🛂 Số hộ chiếu: <code>${idData.passport_number || 'N/A'}</code>\n` +
        `🆔 Số CCCD: <code>${idData.id_number || idData.id || 'N/A'}</code>\n` +
        `👤 Họ tên: <b>${idData.name || 'N/A'}</b>\n` +
        `🎂 Ngày sinh: ${formatDate(idData.dob)}\n` +
        `⚧️ Giới tính: ${formatSex(idData.sex)}\n` +
        `🌍 Quốc tịch: ${idData.nationality || 'N/A'}\n` +
        `🏠 Nơi sinh: ${idData.pob || 'N/A'}\n` +
        `📅 Ngày hết hạn: ${formatDate(idData.doe)}\n\n` +
        `❓ Thông tin có chính xác không?`
      );
    }

    return (
      `✅ <b>THÔNG TIN ĐÃ TRÍCH XUẤT</b>\n\n` +
      `Vui lòng kiểm tra thông tin bên dưới:\n\n` +
      `🆔 Số CCCD: <code>${idData.id || 'N/A'}</code>\n` +
      `👤 Họ tên: <b>${idData.name || 'N/A'}</b>\n` +
      `🎂 Ngày sinh: ${formatDate(idData.dob)}\n` +
      `⚧️ Giới tính: ${formatSex(idData.sex)}\n` +
      `🌍 Quốc tịch: ${idData.nationality || 'N/A'}\n` +
      `🏠 Quê quán: ${idData.home || 'N/A'}\n` +
      `📍 Địa chỉ: ${idData.address || 'N/A'}\n` +
      `📅 Ngày hết hạn: ${formatDate(idData.doe)}\n\n` +
      `❓ Thông tin có chính xác không?`
    );
  },

  KYC_IMAGE_ERROR: (side: 'front' | 'back' = 'front') =>
    `❌ <b>LỖI XỬ LÝ ẢNH ${side === 'back' ? 'MẶT SAU' : 'MẶT TRƯỚC'}</b>\n\n` +
    `Không thể trích xuất thông tin từ ảnh CCCD ${side === 'back' ? 'mặt sau' : 'mặt trước'}.\n\n` +
    `<b>Nguyên nhân có thể:</b>\n` +
    `• Ảnh không rõ nét hoặc bị mờ\n` +
    `• Không phải ảnh CCCD hợp lệ\n` +
    `• Ảnh bị che khuất hoặc thiếu góc\n` +
    `• Ánh sáng không đủ\n\n` +
    `Vui lòng chụp lại ảnh CCCD ${side === 'back' ? 'mặt sau' : 'mặt trước'} của bạn.`,

  KYC_SAVE_SUCCESS: (name: string, phoneNumber: string) =>
    `🎉 <b>HOÀN TẤT KYC</b>\n\n` +
    `✅ Thông tin KYC của bạn đã được lưu thành công!\n\n` +
    `👤 Họ tên: <b>${name}</b>\n` +
    `📱 Số điện thoại: <b>${phoneNumber}</b>\n\n` +
    `💡 Thông tin KYC của bạn đã được xác minh và mã hoá bằng công nghệ zk.`,

  KYC_SAVE_ERROR: () =>
    `❌ <b>LỖI LƯU THÔNG TIN</b>\n\n` +
    `Có lỗi xảy ra khi lưu thông tin KYC của bạn.\n\n` +
    `Vui lòng thử lại hoặc liên hệ support để được hỗ trợ.`,

  KYC_ID_ALREADY_REGISTERED: (idNumberLast4: string) =>
    `⚠️ <b>SỐ CCCD ĐÃ ĐƯỢC ĐĂNG KÝ</b>\n\n` +
    `Số CCCD này (***${idNumberLast4}) đã được đăng ký với một tài khoản Telegram khác.\n\n` +
    `<b>Lưu ý:</b>\n` +
    `• Mỗi số CCCD chỉ có thể xác minh cho một tài khoản duy nhất\n` +
    `• Điều này nhằm đảm bảo an toàn và tuân thủ quy định\n\n` +
    `<b>Bạn có thể:</b>\n` +
    `• Sử dụng CCCD khác để xác minh\n` +
    `• Liên hệ support nếu bạn cho rằng đây là lỗi\n` +
    `• Liên hệ support nếu cần chuyển xác minh sang tài khoản này\n\n` +
    `📞 Vui lòng liên hệ support để được hỗ trợ!`,

  KYC_ATTEMPTS_EXCEEDED: () =>
    `🚫 <b>VƯỢT QUÁ SỐ LẦN XÁC MINH</b>\n\n` +
    `Bạn đã vượt quá số lần xác minh KYC cho phép.\n\n` +
    `Vui lòng liên hệ bộ phận hỗ trợ để được giúp đỡ.`,

  ACCOUNT_INFO: (
    chatId: number,
    firstName: string,
    lastName: string | null,
    username: string,
    isKyc: boolean,
    savedBankAccounts: PaymentInformation[],
    savedWallets: PaymentInformation[],
    phoneNumber?: string | null
  ) => {
    let message =
      `👤 <b>THÔNG TIN TÀI KHOẢN</b>\n\n` +
      `🆔 Chat ID: <code>${chatId}</code>\n` +
      `👤 Họ tên: ${firstName}${lastName ? ' ' + lastName : ''}\n` +
      `📱 Username: ${username ? '@' + username : 'Chưa có'}\n`;

    if (isKyc && phoneNumber) {
      message += `📞 Số điện thoại: <code>${phoneNumber}</code>\n`;
    }

    message +=
      `🔐 Trạng thái KYC: ${isKyc ? '✅ Đã xác minh' : '❌ Chưa xác minh'}\n\n` +
      `💳 <b>THÔNG TIN THANH TOÁN ĐÃ LƯU</b>\n\n`;

    if (savedBankAccounts.length > 0) {
      message += `🏦 <b>Ngân hàng:</b>\n`;
      savedBankAccounts.forEach((account) => {
        const bank = banks.find((b) => b.id === account.bank_id);
        const bankName = bank ? bank.short_name : 'N/A';
        message += `• <code>${bankName} - ${account.full_name || 'N/A'} - ${account.bank_account || 'N/A'}</code>\n`;
      });
      message += '\n';
    }

    if (savedWallets.length > 0) {
      message += `💎 <b>Ví crypto:</b>\n`;
      savedWallets.forEach((wallet) => {
        if (wallet.wallet_address) {
          message += `• <code>${wallet.wallet_address}</code>\n`;
        }
      });
      message += '\n';
    }

    if (savedBankAccounts.length === 0 && savedWallets.length === 0) {
      message += `Chưa có thông tin thanh toán đã lưu`;
    }

    return message.trim();
  },

  ORDER_STATUS_UPDATE: (orderId: string, status: string) =>
    `📢 <b>CẬP NHẬT ĐƠN HÀNG</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: <b>${status}</b>\n\n` +
    `⏰ Thời gian: ${formatTimeWithTimeZone()}`,

  ORDER_STATE_CREATED: (orderId: string) =>
    `✅ <b>ĐƠN HÀNG ĐÃ TẠO</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Đã tạo\n\n` +
    `⏰ Thời gian: ${formatTimeWithTimeZone()}\n\n` +
    `💡 Đơn hàng của bạn đã được tạo thành công!`,

  ORDER_STATE_PROCESSING: (orderId: string) =>
    `⏳ <b>ĐANG XỬ LÝ</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Đang xử lý\n\n` +
    `⏰ Thời gian: ${formatTimeWithTimeZone()}\n\n` +
    `💡 Đơn hàng của bạn đang được xử lý...`,

  ORDER_STATE_COMPLETED_BUY: (
    orderId: string,
    usdcAmount: string,
    walletAddress: string,
    assetCode: string = 'USDC',
    transactionHash?: string
  ) =>
    `✅ <b>GIAO DỊCH HOÀN THÀNH</b>\n\n` +
    `Bạn đã nhận được <b>${usdcAmount} ${assetCode}</b> vào địa chỉ ví <code>${walletAddress}</code>.\n\n` +
    `ℹ️ Chi tiết lệnh Onramp:\n` +
    `• Hình thức: Mua <b>${usdcAmount} ${assetCode} (Stellar)</b>\n` +
    `• Trạng thái: Thành công (Đã chuyển khoản)\n` +
    `• Mã lệnh: <code>${orderId}</code>\n` +
    (transactionHash
      ? `• ID giao dịch: <a href='https://stellarchain.io/tx/${transactionHash}'>${transactionHash}</a>\n`
      : '') +
    `\nCảm ơn bạn đã tin tưởng sử dụng dịch vụ!`,

  ORDER_STATE_COMPLETED_SELL: (
    orderId: string,
    usdcAmount: string,
    netVndAmount: number,
    bankAccountNumber: string,
    assetCode: string = 'USDC',
    bankId?: string | number | null
  ) =>
    `✅ <b>GIAO DỊCH HOÀN THÀNH</b>\n\n` +
    `Bạn đã nhận được số tiền <b>${Math.round(netVndAmount).toLocaleString('vi-VN')} VND</b> vào tài khoản <code>${bankAccountNumber}</code> ngân hàng <b>${resolveBankName(bankId)}</b>.\n\n` +
    `ℹ️ Chi tiết lệnh Offramp:\n` +
    `• Hình thức: Bán <b>${usdcAmount} ${assetCode} (Stellar)</b>\n` +
    `• Trạng thái: Thành công (Đã chuyển khoản)\n` +
    `• Mã lệnh: <code>${orderId}</code>\n\n` +
    `Cảm ơn bạn đã tin tưởng sử dụng dịch vụ!`,

  ORDER_STATE_COMPLETED: (orderId: string, transactionHash?: string) =>
    `🎉 <b>HOÀN THÀNH</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Hoàn thành\n\n` +
    `⏰ Thời gian: ${formatTimeWithTimeZone()}\n\n` +
    `💰 Vui lòng kiểm tra tài khoản/ví của bạn.` +
    (transactionHash
      ? `\n🔗 Tx Hash: <a href='https://stellarchain.io/tx/${transactionHash}'>${transactionHash}</a>`
      : ''),

  ORDER_STATE_FAILED: (orderId: string) =>
    `❌ <b>THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Thất bại\n\n` +
    `⏰ Thời gian: ${formatTimeWithTimeZone()}\n\n` +
    `💡 Giao dịch không thành công. Vui lòng liên hệ support để được hỗ trợ!`,

  ORDER_STATE_LIQUIDITY_FAILED: (orderId: string) =>
    `❌ <b>THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Thất bại (Hệ thống thiếu thanh khoản)\n\n` +
    `⏰ Thời gian: ${formatTimeWithTimeZone()}\n\n` +
    `💡 Không thể thực hiện đơn hàng do máy chủ hiện đang thiếu thanh khoản. Vui lòng thử lại sau hoặc liên hệ support để được hỗ trợ!`,

  ORDER_STATE_MAX_ORDER_EXCEEDED: (orderId: string) =>
    `❌ <b>THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Thất bại (Vượt giới hạn tối đa)\n\n` +
    `⏰ Thời gian: ${formatTimeWithTimeZone()}\n\n` +
    `💡 Số lượng đơn hàng vượt quá giới hạn tối đa cho phép. Vui lòng giảm số lượng và thử lại!`,

  ORDER_STATE_MIN_ORDER_EXCEEDED: (orderId: string) =>
    `❌ <b>THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Thất bại (Dưới giới hạn tối thiểu)\n\n` +
    `⏰ Thời gian: ${formatTimeWithTimeZone()}\n\n` +
    `💡 Số lượng đơn hàng dưới giới hạn tối thiểu cho phép. Vui lòng tăng số lượng và thử lại!`,

  ORDER_STATE_VND_BALANCE_FAILED: (orderId: string) =>
    `❌ <b>THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Thất bại (Hệ thống thiếu số dư VND)\n\n` +
    `⏰ Thời gian: ${formatTimeWithTimeZone()}\n\n` +
    `💡 Không thể thực hiện đơn hàng do máy chủ hiện đang thiếu số dư VND. Vui lòng thử lại sau hoặc liên hệ support để được hỗ trợ!`,

  ORDER_STATE_CANCELLED: (orderId: string) =>
    `🚫 <b>ĐÃ HỦY</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Đã hủy\n\n` +
    `⏰ Thời gian: ${formatTimeWithTimeZone()}\n\n` +
    `💡 Đơn hàng đã được hủy.`,

  ORDER_STATE_EXPIRED: (orderId: string) =>
    `🚫 <b>ĐÃ HẾT HẠN</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n` +
    `📊 Trạng thái: Đã hết hạn\n\n` +
    `⏰ Thời gian: ${formatTimeWithTimeZone()}\n\n` +
    `💡 Đơn hàng đã bị hủy vì quá thời hạn thanh toán theo quy định.`,

  PROCESSING_STATE_WAITING_FIAT: (orderId: string) =>
    `⏳ <b>CHỜ CHUYỂN KHOẢN VND</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Đang chờ bạn chuyển khoản VND.\n` +
    `📱 Vui lòng quét mã QR để thanh toán.`,

  PROCESSING_STATE_FIAT_CONFIRMED: (orderId: string) =>
    `✅ <b>ĐÃ XÁC NHẬN CHUYỂN KHOẢN VND</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Chuyển khoản VND đã được xác nhận.\n` +
    `⏳ Đang xử lý chuyển USDC...`,

  PROCESSING_STATE_FIAT_FAILED: (orderId: string) =>
    `❌ <b>CHUYỂN KHOẢN VND THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Chuyển khoản VND không thành công.\n` +
    `📞 Vui lòng liên hệ support để được hỗ trợ!`,

  PROCESSING_STATE_WAITING_USDT: (orderId: string) =>
    `⏳ <b>CHỜ CHUYỂN USDC</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Đang chờ chuyển USDC vào ví của bạn...`,

  PROCESSING_STATE_USDT_CONFIRMED: (orderId: string) =>
    `✅ <b>ĐÃ CHUYỂN USDC THÀNH CÔNG</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `🎉 USDC đã được chuyển vào ví của bạn!\n` +
    `💰 Vui lòng kiểm tra ví.`,

  PROCESSING_STATE_USDT_FAILED: (orderId: string) =>
    `❌ <b>CHUYỂN USDC THẤT BẠI</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Chuyển USDC không thành công.\n` +
    `📞 Vui lòng liên hệ support để được hỗ trợ!`,

  PROCESSING_STATE_WAITING_ADMIN: (orderId: string) =>
    `⏳ <b>CHỜ ADMIN DUYỆT</b>\n\n` +
    `🆔 Mã đơn: <code>${orderId}</code>\n\n` +
    `💡 Đơn hàng đang chờ admin duyệt.\n` +
    `⏰ Vui lòng đợi trong giây lát...`,

  REFERRAL_INFO: (username: string, referralCount: number, botUsername: string) =>
    `🎁 <b>CHƯƠNG TRÌNH GIỚI THIỆU BẠN BÈ</b>\n\n` +
    `👥 Số người bạn đã giới thiệu: <b>${referralCount}</b>\n\n` +
    `🔗 Link giới thiệu của bạn:\n` +
    `<code>https://t.me/${botUsername}?start=${username}</code>\n\n` +
    `💡 Chia sẻ link này với bạn bè để họ tham gia!\n` +
    `🎉 Mỗi người bạn giới thiệu sẽ được tính vào tổng số giới thiệu của bạn.`,
};
