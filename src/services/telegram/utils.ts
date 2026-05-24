export interface ExchangeRate {
  buy: number;
  sell: number;
  fee_rate_buy?: number;
  fee_rate_sell?: number;
  min_fee_vnd?: number;
  created_at: string;
}

export async function fetchExchangeRates(): Promise<ExchangeRate | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(
      process.env.EXCHANGE_RATES_URL ||
        'https://iakzvzwriyxyshfggbwu.supabase.co/functions/v1/get_exchange_rates',
      { signal: controller.signal }
    );
    clearTimeout(timeout);
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

export function validateVietnamesePhoneNumber(phoneNumber: string): boolean {
  const cleaned = phoneNumber.replace(/[\s-]/g, '');
  const pattern1 = /^0\d{9}$/;
  const pattern2 = /^\+84\d{9,10}$/;
  const pattern3 = /^84\d{9,10}$/;
  return pattern1.test(cleaned) || pattern2.test(cleaned) || pattern3.test(cleaned);
}

export function parseSexForDatabase(sex: string | undefined): string {
  if (!sex) return 'N/A';
  if (sex.includes('/')) {
    const parts = sex.split('/');
    if (parts.length > 1) {
      return parts[1] || sex;
    }
  }
  const sexUpper = sex.toUpperCase().trim();
  if (sexUpper === 'NAM') {
    return 'M';
  } else if (sexUpper === 'NỮ' || sexUpper === 'NU') {
    return 'F';
  }
  return sex;
}

export function isDuplicateKeyError(error: any): boolean {
  if (!error) return false;
  if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
    return true;
  }
  const errorMessage = error.message?.toLowerCase() || '';
  if (
    errorMessage.includes('duplicate') ||
    errorMessage.includes('unique constraint') ||
    errorMessage.includes('duplicate entry')
  ) {
    return true;
  }
  return false;
}

export async function generateQRCode(qrString: string): Promise<Buffer> {
  const qrApiUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrString)}&size=300&margin=2`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const response = await fetch(qrApiUrl, { signal: controller.signal });
  clearTimeout(timeout);
  if (!response.ok) {
    throw new Error(`QR API returned status ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

const USDC_ISSUER =
  process.env.TOKEN_ADDRESS || 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const ASSET_CODE = process.env.TOKEN_CODE || 'USDC';

export function buildStellarPayURI(
  destination: string,
  amount: string,
  memo?: string,
  assetCode?: string
): string {
  const isNative = assetCode === 'XLM';
  let uri: string;
  if (isNative) {
    uri = `stellar:${destination}?destination=${destination}&amount=${amount}`;
  } else {
    uri = `stellar:${destination}?destination=${destination}&amount=${amount}&asset_code=${ASSET_CODE}&asset_issuer=${USDC_ISSUER}`;
  }
  if (memo) uri += `&memo=${encodeURIComponent(memo)}&memo_type=text`;
  return uri;
}

export async function generateStellarPayQR(
  destination: string,
  amount: string,
  memo?: string,
  assetCode?: string
): Promise<Buffer> {
  return generateQRCode(buildStellarPayURI(destination, amount, memo, assetCode));
}

export async function generateTrustlineQR(xdr: string): Promise<Buffer> {
  return generateQRCode(`web+stellar:tx?xdr=${encodeURIComponent(xdr)}`);
}

export function calculateGatewayFee(vndAmount: number, feeRate: number, minFeeVnd: number): number {
  const feeByRate = vndAmount * feeRate;
  return Math.max(feeByRate, minFeeVnd);
}

import * as StellarSdk from 'stellar-sdk';
import axios from 'axios';
import { telegramConfig } from '../../config/app';
import { logger } from '../../config/logger';

export enum StellarNetwork {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}

export async function shortenUrl(url: string): Promise<string> {
  try {
    const response = await axios.get(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
      { timeout: 5000 }
    );
    return response.data as string;
  } catch (error) {
    logger.warn({ error }, 'Failed to shorten URL, using original');
    return url;
  }
}

export function resolveNetwork(): StellarNetwork {
  const val = (telegramConfig.stellarNetwork || 'public').toLowerCase();
  return val === 'testnet' ? StellarNetwork.TESTNET : StellarNetwork.MAINNET;
}

export const NETWORK_CONFIGS = {
  [StellarNetwork.MAINNET]: {
    passphrase: StellarSdk.Networks.PUBLIC,
  },
  [StellarNetwork.TESTNET]: {
    passphrase: StellarSdk.Networks.TESTNET,
  },
};

export function messageDelay(): Promise<void> {
  const ms = telegramConfig.messageDelayMs;
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
