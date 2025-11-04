export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface HelloWorldResponse {
  message: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  waitForConnections: boolean;
  queueLimit: number;
}

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
}

export interface TeleUser {
  id?: number;
  chat_id: number;
  first_name?: string;
  last_name?: string;
  username: string;
  is_kyc?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateTeleUserRequest {
  chat_id: number;
  first_name?: string;
  last_name?: string;
  username: string;
}

export interface TelegramConfig {
  botToken: string;
  webhookSecret: string;
  chainId: number;
  tokenAddress: string;
  callbackUrl: string;
}

export type PaymentType = 'BANK' | 'CRYPTO';

export interface PaymentInformation {
  id?: number;
  chat_id: number;
  type: PaymentType;
  wallet_address?: string | null;
  bank_id?: number | null;
  full_name?: string | null;
  bank_account?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreatePaymentInformationRequest {
  chat_id: number;
  type: PaymentType;
  wallet_address?: string;
  bank_id?: number;
  full_name?: string;
  bank_account?: string;
}

export interface Kyc {
  id?: number;
  chat_id: number;
  phone: string;
  id_number: string;
  name: string;
  dob: Date;
  sex: string;
  nationality: string;
  home: string;
  address: string;
  doe: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateKycRequest {
  chat_id: number;
  phone: string;
  id_number: string;
  name: string;
  dob: Date;
  sex: string;
  nationality: string;
  home: string;
  address: string;
  doe: Date;
}
