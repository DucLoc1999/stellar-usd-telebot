import { logger } from '../../config/logger';

export interface UserState {
  action?: 'buy' | 'sell' | 'kyc';
  amount?: string;
  walletAddress?: string;
  waitingFor?:
    | 'buy_amount'
    | 'sell_amount'
    | 'wallet'
    | 'bank_selection'
    | 'full_name'
    | 'account_number'
    | 'bank_details_single'
    | 'delete_bank_index'
    | 'delete_wallet_index'
    | 'kyc_phone'
    | 'kyc_id_card'
    | 'kyc_processing';
  bankId?: number;
  bankName?: string;
  fullName?: string;
  accountNumber?: string;
  bankPageOffset?: number;
  paymentInfoId?: number;
  isNewPaymentInfo?: boolean;
  orderId?: string;
  savedBankAccounts?: any[];
  savedWallets?: any[];
  kycPhoneNumber?: string;
  kycDocumentType?: 'cccd' | 'passport';
  kycIdCardData?: any;
  kycImageUrl?: string;
  lastProcessedPhotoId?: string;
}

export interface StateLogMeta {
  action?: string;
  chatType?: string;
  chatId?: number;
}

export const userStates = new Map<number, UserState>();
export const processingUsers = new Set<number>();
export const userCancelledOrders = new Set<string>();
export const newlyCreatedOrders = new Set<string>();
export const sentMessages = new Map<string, Set<string>>();

export function getState(userId: number, meta: StateLogMeta = {}): UserState | undefined {
  const state = userStates.get(userId);
  logger.debug(
    {
      userId,
      chatType: meta.chatType ?? 'unknown',
      chatId: meta.chatId ?? null,
      action: meta.action ?? 'state.get',
      waitingFor: state?.waitingFor ?? null,
    },
    'Telegram user state read'
  );
  return state;
}

export function setState(userId: number, state: UserState, meta: StateLogMeta = {}): void {
  userStates.set(userId, state);
  logger.debug(
    {
      userId,
      chatType: meta.chatType ?? 'unknown',
      chatId: meta.chatId ?? null,
      action: meta.action ?? 'state.set',
      waitingFor: state.waitingFor ?? null,
    },
    'Telegram user state write'
  );
}

export function clearState(userId: number, meta: StateLogMeta = {}): void {
  const state = userStates.get(userId);
  userStates.delete(userId);
  logger.debug(
    {
      userId,
      chatType: meta.chatType ?? 'unknown',
      chatId: meta.chatId ?? null,
      action: meta.action ?? 'state.clear',
      waitingFor: state?.waitingFor ?? null,
    },
    'Telegram user state cleared'
  );
}
