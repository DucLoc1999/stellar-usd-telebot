import './instrument';

import dotenv from 'dotenv';
import { buildApp } from './app';
import { appConfig } from './config/app';
import { logger } from './config/logger';

dotenv.config();

const start = async (): Promise<void> => {
  try {
    const app = await buildApp();

    await app.listen({
      port: appConfig.port,
      host: appConfig.host,
    });

    logger.info(`🚀 Server is running on http://${appConfig.host}:${appConfig.port}`);
    logger.info(
      `📚 API Documentation available at http://${appConfig.host}:${appConfig.port}/docs`
    );
    logger.info(`🏥 Health check available at http://${appConfig.host}:${appConfig.port}/health`);
    logger.info(`📋 Logs API available at http://${appConfig.host}:${appConfig.port}/api/logs`);

    // check exchange rate
    try {
      const response = await fetch(
        process.env.EXCHANGE_RATES_URL ||
          'https://iakzvzwriyxyshfggbwu.supabase.co/functions/v1/get_exchange_rates'
      );
      if (!response.ok) {
        logger.error({
          error: '📚 Failed to fetch exchange rates',
          responseText: response.statusText,
        });
      }
      await response.json();
      logger.info('📚 Exchange rates fetched successfully');
    } catch (error) {
      logger.info('📚 Failed to fetch exchange rates');
      logger.error(error);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Error starting server');
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});
void start();
