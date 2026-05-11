import type { AppConfig, TelegramConfig } from '../models/types';

export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  timeZone: process.env.TIME_ZONE || 'Asia/Ho_Chi_Minh',
};

export const telegramConfig: TelegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  chainId: process.env.CHAIN_ID || 'Public Global Stellar Network ; September 2015',
  tokenAddress: process.env.TOKEN_ADDRESS || '',
  tokenCode: process.env.TOKEN_CODE || '',
  callbackUrl: process.env.CALLBACK_URL || '',
  horizonUrl: process.env.HORIZON_URL || 'https://horizon.stellar.org',
  stellarNetwork: process.env.STELLAR_NETWORK || 'public',
};

export default appConfig;
