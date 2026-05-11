import { InlineKeyboard, Keyboard } from 'grammy';
import { banks } from '../../models/webhook';
import teleUserService from '../teleUserService';
import paymentInformationService from '../paymentInformationService';
import type { PaymentInformation } from '../../models/types';

const MAIN_MENU_CACHE_TTL_MS = 30 * 1000;
const CACHE_CLEANUP_INTERVAL_MS = 60 * 1000;

interface CachedMenuData {
  isKyc: boolean;
  hasBankAccounts: boolean;
  hasWallets: boolean;
  expiresAt: number;
}

const mainMenuCache = new Map<number, CachedMenuData>();

function getCachedMenuData(chatId: number): CachedMenuData | undefined {
  const cached = mainMenuCache.get(chatId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }
  mainMenuCache.delete(chatId);
  return undefined;
}

function setCachedMenuData(
  chatId: number,
  isKyc: boolean,
  hasBankAccounts: boolean,
  hasWallets: boolean
): void {
  mainMenuCache.set(chatId, {
    isKyc,
    hasBankAccounts,
    hasWallets,
    expiresAt: Date.now() + MAIN_MENU_CACHE_TTL_MS,
  });
}

function clearMenuCache(chatId?: number): void {
  if (chatId) {
    mainMenuCache.delete(chatId);
  } else {
    mainMenuCache.clear();
  }
}

export { clearMenuCache };

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of mainMenuCache) {
    if (value.expiresAt <= now) {
      mainMenuCache.delete(key);
    }
  }
}, CACHE_CLEANUP_INTERVAL_MS);

export class Keyboards {
  static async mainMenu(chatId: number): Promise<InlineKeyboard> {
    const cached = getCachedMenuData(chatId);
    let isKyc: boolean;
    let hasBankAccounts: boolean;
    let hasWallets: boolean;

    if (cached) {
      isKyc = cached.isKyc;
      hasBankAccounts = cached.hasBankAccounts;
      hasWallets = cached.hasWallets;
    } else {
      const [user, savedBankAccounts, savedWallets] = await Promise.all([
        teleUserService.findByChatId(chatId),
        paymentInformationService.findByTypeAndChatId(chatId, 'BANK'),
        paymentInformationService.findByTypeAndChatId(chatId, 'CRYPTO'),
      ]);
      isKyc = user?.is_kyc ?? false;
      hasBankAccounts = savedBankAccounts.length > 0;
      hasWallets = savedWallets.length > 0;
      setCachedMenuData(chatId, isKyc, hasBankAccounts, hasWallets);
    }

    const kycIndicator = isKyc ? '🟢' : '🔴';
    const bankIndicator = hasBankAccounts ? '🟢' : '🔴';
    const walletIndicator = hasWallets ? '🟢' : '🔴';

    return new InlineKeyboard()
      .text('💱 Kiểm tra tỷ giá', 'check_rate')
      .row()
      .text('💰 Mua USDC', 'buy_usdt')
      .text('💸 Bán USDC', 'sell_usdt')
      .row()
      .text(`🔐 Xác minh KYC ${kycIndicator}`, 'kyc')
      .text(`🏦 Ngân hàng ${bankIndicator}`, 'bank_accounts')
      .row()
      .text(`💎 Ví crypto ${walletIndicator}`, 'crypto_wallets')
      .text('👤 Tài khoản', 'account_info')
      .row()
      .text('🎁 Giới thiệu bạn bè', 'referral')
      .text('📞 Liên hệ hỗ trợ', 'contact_support');
  }

  static buyAmountSelection(): InlineKeyboard {
    return new InlineKeyboard()
      .text('10 USDC', 'buy_amount_10')
      .text('20 USDC', 'buy_amount_20')
      .row()
      .text('50 USDC', 'buy_amount_50')
      .text('✏️ Nhập số khác', 'buy_custom')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static sellAmountSelection(): InlineKeyboard {
    return new InlineKeyboard()
      .text('10 USDC', 'sell_amount_10')
      .text('50 USDC', 'sell_amount_50')
      .row()
      .text('100 USDC', 'sell_amount_100')
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

  static activateWalletOffer(): InlineKeyboard {
    return new InlineKeyboard()
      .text('⚡ Kích hoạt ví (1 XLM)', 'activate_wallet_confirm_prompt')
      .row()
      .text('❌ Hủy', 'cancel_activate_wallet');
  }

  static confirmActivateWallet(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Xác nhận kích hoạt ví', 'confirm_activate_wallet')
      .row()
      .text('❌ Hủy', 'cancel_activate_wallet');
  }

  static backToMenu(): InlineKeyboard {
    return new InlineKeyboard().text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static trustlineActions(webSignUrl: string | undefined, viewDetailsUrl: string): InlineKeyboard {
    const kb = new InlineKeyboard();
    kb.url('🔍 Xem transaction', viewDetailsUrl);
    if (webSignUrl) kb.url('✍️ Ký & gửi giao dịch', webSignUrl);
    kb.row().text('🔙 Quay lại Menu', 'back_to_menu');
    return kb;
  }

  static kycStart(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🚀 Bắt đầu KYC', 'start_kyc')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static kycRequiredForTrading(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🔐 Xác minh KYC ngay', 'start_kyc')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static kycPhoneRequest(): Keyboard {
    return new Keyboard().requestContact('📱 Chia sẻ số điện thoại').resized().oneTime();
  }

  static kycDocumentTypeSelection(): InlineKeyboard {
    return new InlineKeyboard()
      .text('🆔 CMND/CCCD', 'kyc_select_cccd')
      .row()
      .text('🛂 Hộ chiếu', 'kyc_select_passport')
      .row()
      .text('❌ Hủy', 'cancel_kyc');
  }

  static kycCancel(): InlineKeyboard {
    return new InlineKeyboard()
      .text('❌ Hủy', 'cancel_kyc')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static kycDuplicateIdError(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📸 Thử CCCD khác', 'kyc_try_different_id')
      .row()
      .text('📞 Liên hệ Support', 'contact_support')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static kycAttemptsExceeded(): InlineKeyboard {
    return new InlineKeyboard()
      .text('📞 Liên hệ hỗ trợ', 'contact_support')
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static qrCodeWithCancel(orderId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('❌ Hủy đơn hàng', `cancel_order_${orderId}`)
      .row()
      .text('🔙 Quay lại Menu', 'back_to_menu');
  }

  static bankAccountsList(accounts: any[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    keyboard.text('➕ Thêm mới', 'add_bank_from_menu');
    if (accounts.length > 0) {
      keyboard.text('🗑️ Xóa ngân hàng', 'delete_bank_prompt');
    }
    keyboard.row();
    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');
    return keyboard;
  }

  static cryptoWalletsList(wallets: any[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    keyboard.text('➕ Thêm mới', 'add_wallet_from_menu');
    if (wallets.length > 0) {
      keyboard.text('🗑️ Xóa ví crypto', 'delete_wallet_prompt');
    }
    keyboard.row();
    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');
    return keyboard;
  }

  static confirmDelete(): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Xác nhận xóa', 'confirm_delete')
      .row()
      .text('❌ Hủy', 'cancel_delete');
  }

  static bankSelection(offset: number = 0): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    let banksToShow: typeof banks;
    let hasMore = false;

    if (offset === 0) {
      banksToShow = banks.slice(0, 5);
      hasMore = banks.length > 5;
    } else {
      const endIndex = Math.min(offset + 5, banks.length);
      banksToShow = banks.slice(offset, endIndex);
      hasMore = endIndex < banks.length;
    }

    for (const bank of banksToShow) {
      keyboard.text(bank.short_name, `select_bank_${bank.id}`).row();
    }

    if (hasMore) {
      const nextOffset = offset === 0 ? 5 : offset + 5;
      keyboard.text('📋 Xem thêm', `show_more_banks_${nextOffset}`).row();
    }

    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');
    return keyboard;
  }

  static savedWalletSelection(wallets: PaymentInformation[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    for (const wallet of wallets) {
      if (wallet.wallet_address) {
        const shortAddress = `${wallet.wallet_address.substring(0, 6)}...${wallet.wallet_address.substring(52)}`;
        keyboard.text(`🔑 ${shortAddress}`, `use_saved_wallet_${wallet.id}`).row();
      }
    }

    keyboard.text('➕ Thêm địa chỉ ví mới', 'add_new_wallet').row();
    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');
    return keyboard;
  }

  static savedBankAccountSelection(accounts: PaymentInformation[]): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    for (const account of accounts) {
      if (account.bank_id && account.bank_account && account.full_name) {
        const bank = banks.find((b) => b.id === account.bank_id);
        const bankName = bank?.short_name || 'Bank';
        const label = `🏦 ${bankName} - ${account.bank_account} - ${account.full_name}`;
        keyboard.text(label, `use_saved_bank_${account.id}`).row();
      }
    }

    keyboard.text('➕ Thêm tài khoản ngân hàng mới', 'add_new_bank').row();
    keyboard.text('🔙 Quay lại Menu', 'back_to_menu');
    return keyboard;
  }
}
