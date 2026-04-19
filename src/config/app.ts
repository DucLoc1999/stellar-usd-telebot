import type { AppConfig, TelegramConfig } from '../models/types';

export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export const telegramConfig: TelegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  chainId: parseInt(process.env.CHAIN_ID || '56', 10),
  tokenAddress: process.env.TOKEN_ADDRESS || '0x55d398326f99059fF775485246999027B3197955',
  callbackUrl: process.env.CALLBACK_URL || '',
};

export default appConfig;
