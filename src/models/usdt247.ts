export interface Usdt247PaymentInfo {
  bank_id: number;
  full_name: string;
  account_type: number;
  account_number: string;
}

export interface Usdt247Timestamp {
  seconds: number;
  nanos: number;
}

export interface Usdt247BankInfo {
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankId?: string;
  bankName?: string;
}

export interface Usdt247ResponseBody {
  bank_id?: number;
  full_name?: string;
  account_type?: number;
  account_number?: string;
  amount?: string;
  qr_code?: string;
  qr_data?: string;
  qr_link?: string;
  bankInfo?: Usdt247BankInfo;
}

export interface Usdt247PayData {
  address?: string;
  amount?: string;
  chain_id?: string;
  token_address?: string;
  qr_code?: string;
}

export interface Usdt247CreateWithdrawalRequest {
  amount: string;
  chain_id: string;
  token_address: string;
  callback: string;
  payment_info: Usdt247PaymentInfo;
}

export interface Usdt247CreateDepositRequest {
  amount: string;
  chain_id: string;
  token_address: string;
  recipient: string;
  callback: string;
}

export interface Usdt247OrderData {
  id: string;
  user_id: string;
  order_type: number | string;
  external_id: string;
  code: string;
  provider: number | string;
  callback: string;
  amount: string;
  currency: string;
  rate: string;
  token_address: string;
  recipient: string;
  chain_id: number;
  partner_id: string;
  state: number;
  processing_state: number;
  transaction_hash?: string;
  body?: Usdt247ResponseBody;
  pay_data?: Usdt247PayData;
  payment_info?: Usdt247PaymentInfo;
  expired_at: Usdt247Timestamp;
  created_at: Usdt247Timestamp;
  updated_at: Usdt247Timestamp;
  client_ip: string | null;
  outcome: string | null;
  original_rate: string | null;
  total_fee_vnd: number;
}

export interface Usdt247CreateOrderResponse {
  success: boolean;
  data: Usdt247OrderData;
  message?: string;
}

export type Usdt247Order = Usdt247OrderData;

// draft
export enum Usdt247OrderType {
  WITHDRAWAL = 1,
  DEPOSIT = 2,
}
// draft
export enum Usdt247OrderState {
  PENDING = 0,
  PROCESSING = 1,
  COMPLETED = 2,
  CANCELLED = 3,
  FAILED = 4,
  EXPIRED = 5,
}

export interface WithdrawalRequest {
  chat_id: number;
  amount: string;
  chain_id: string;
  token_address: string;
  callback: string;
  payment_info: Usdt247PaymentInfo;
}

export interface DepositRequest {
  chat_id: number;
  amount: string;
  chain_id: string;
  token_address: string;
  recipient: string;
  callback: string;
}

export interface Order {
  id: string;
  chat_id: number;
  user_id: string;
  order_type: number;
  external_id: string | null;
  code: string;
  provider: number;
  callback: string;
  amount: string;
  currency: string;
  rate: string;
  token_address: string;
  recipient: string;
  chain_id: string;
  partner_id: string;
  state: number;
  processing_state: number;
  transaction_hash: string | null;
  body: Usdt247ResponseBody | null;
  pay_data: Usdt247PayData | null;
  payment_info: Usdt247PaymentInfo | null;
  expired_at: Date;
  created_at: Date;
  updated_at: Date;
  client_ip: string | null;
  outcome: string | null;
  original_rate: string | null;
  total_fee_vnd: number | null;
}
