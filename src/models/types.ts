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
  timeZone: string;
}

export interface TeleUser {
  id?: number;
  chat_id: number;
  first_name?: string;
  last_name?: string;
  username: string;
  is_kyc?: boolean;
  time_kyc?: number;
  referral?: number; // Chat ID of the user who referred this account
  referral_count?: number; // Total number of users referred by this account
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateTeleUserRequest {
  chat_id: number;
  first_name?: string;
  last_name?: string;
  username: string;
  referral?: number; // Chat ID of the user who referred this account
}

export interface TelegramConfig {
  botToken: string;
  webhookSecret: string;
  chainId: string;
  tokenAddress: string;
  tokenCode: string;
  callbackUrl: string;
  horizonUrl: string;
  stellarNetwork: string;
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
  type: 'PASSPORT' | 'IDC'; // Document type: PASSPORT or IDC (Identity Card/CCCD)
  id_number: string;
  name: string;
  dob: Date;
  sex: string;
  nationality: string;
  home: string;
  address: string;
  doe: Date;
  passport_number?: string; // Passport number (only for PASSPORT type)
  kyc_image?: string; // S3 URL of the uploaded KYC image
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateKycRequest {
  chat_id: number;
  phone: string;
  type: 'PASSPORT' | 'IDC'; // Document type: PASSPORT or IDC (Identity Card/CCCD)
  id_number: string;
  name: string;
  dob: Date;
  sex: string;
  nationality: string;
  home: string;
  address: string;
  doe: Date;
  passport_number?: string; // Passport number (only for PASSPORT type)
  kyc_image?: string; // S3 URL of the uploaded KYC image
}

export interface Referral {
  id?: number;
  chat_id: number; // The chat_id of the user who was referred
  referral: number; // The chat_id of the user who made the referral (the referrer)
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateReferralRequest {
  chat_id: number; // The chat_id of the user who was referred
  referral: number; // The chat_id of the user who made the referral (the referrer)
}
