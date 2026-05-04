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

export const userStates = new Map<number, UserState>();
export const processingUsers = new Set<number>();
export const userCancelledOrders = new Set<string>();
export const newlyCreatedOrders = new Set<string>();
export const sentMessages = new Map<string, Set<string>>();
