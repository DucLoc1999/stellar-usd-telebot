import { logger } from '../../config/logger';

const STATE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const USER_STATE_TTL_MS = 30 * 60 * 1000;

interface TimedUserState {
  state: UserState;
  expiresAt: number;
}

const userStatesWithExpiry = new Map<number, TimedUserState>();
export const processingUsers = new Set<number>();
export const userCancelledOrders = new Set<string>();
export const newlyCreatedOrders = new Set<string>();
export const sentMessages = new Map<string, Set<string>>();

function cleanupExpiredStates(): void {
  const now = Date.now();
  let deletedCount = 0;
  for (const [userId, timedState] of userStatesWithExpiry) {
    if (timedState.expiresAt <= now) {
      userStatesWithExpiry.delete(userId);
      deletedCount++;
    }
  }
  if (deletedCount > 0) {
    logger.debug(
      { deletedCount, remaining: userStatesWithExpiry.size },
      'Cleaned up expired user states'
    );
  }
}

setInterval(cleanupExpiredStates, STATE_CLEANUP_INTERVAL_MS);

export interface UserState {
  action?: 'buy' | 'sell' | 'kyc' | 'activate_wallet';
  assetCode?: string;
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
    | 'kyc_id_card_back'
    | 'kyc_processing';
  bankId?: number;
  bankName?: string;
  fullName?: string;
  accountNumber?: string;
  bankPageOffset?: number;
  paymentInfoId?: number;
  isNewPaymentInfo?: boolean;
  orderId?: string;
  buyRate?: number;
  gatewayFee?: number;
  savedBankAccounts?: any[];
  savedWallets?: any[];
  kycPhoneNumber?: string;
  kycDocumentType?: 'cccd' | 'passport';
  kycIdCardData?: any;
  kycImageUrl?: string;
  kycIdCardBackData?: any;
  kycImageUrlBack?: string;
  lastProcessedPhotoId?: string;
  activationRecipientWallet?: string;
  activationXlmAmount?: string;
  activationRate?: number;
  activationVndTotal?: number;
  activationFee?: number;
  payGateway?: 'bank' | 'napas';
}

export interface StateLogMeta {
  action?: string;
  chatType?: string;
  chatId?: number;
}

export function getState(userId: number, meta: StateLogMeta = {}): UserState | undefined {
  const timedState = userStatesWithExpiry.get(userId);
  if (!timedState) return undefined;
  if (timedState.expiresAt <= Date.now()) {
    userStatesWithExpiry.delete(userId);
    return undefined;
  }
  logger.debug(
    {
      userId,
      chatType: meta.chatType ?? 'unknown',
      chatId: meta.chatId ?? null,
      action: meta.action ?? 'state.get',
      waitingFor: timedState.state?.waitingFor ?? null,
    },
    'Telegram user state read'
  );
  return timedState.state;
}

export function setState(userId: number, state: UserState, meta: StateLogMeta = {}): void {
  userStatesWithExpiry.set(userId, {
    state,
    expiresAt: Date.now() + USER_STATE_TTL_MS,
  });
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
  const timedState = userStatesWithExpiry.get(userId);
  userStatesWithExpiry.delete(userId);
  logger.debug(
    {
      userId,
      chatType: meta.chatType ?? 'unknown',
      chatId: meta.chatId ?? null,
      action: meta.action ?? 'state.clear',
      waitingFor: timedState?.state?.waitingFor ?? null,
    },
    'Telegram user state cleared'
  );
}

export function getAllStatesForCleanup(): Map<number, UserState> {
  const result = new Map<number, UserState>();
  for (const [userId, timedState] of userStatesWithExpiry) {
    result.set(userId, timedState.state);
  }
  return result;
}
