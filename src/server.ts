import './instrument';

import dotenv from 'dotenv';
import { buildApp } from './app';
import { appConfig } from './config/app';
import { logger } from './config/logger';
import db from './config/knex';
import notificationQueueService from './services/notificationQueueService';
import paymentService from './services/paymentService';
import { clearAllPendingTimers } from './services/telegram/order-tracking';

dotenv.config();

let isShuttingDown = false;

const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Shutdown already in progress, ignoring repeated signal');
    return;
  }
  isShuttingDown = true;

  logger.info({ signal }, 'Starting graceful shutdown...');

  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 30 seconds, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    logger.info('Draining notification queues...');
    await notificationQueueService.drainQueues(10000);

    logger.info('Cancelling pending order tracking timers...');
    clearAllPendingTimers();

    logger.info('Closing database connections...');
    await db.destroy();

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

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

    try {
      const rate = await paymentService.getRate();
      if (rate) {
        logger.info('📚 Exchange rates fetched successfully');
      } else {
        logger.error(
          { error: 'Failed to fetch exchange rates' },
          '📚 Failed to fetch exchange rates'
        );
      }
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

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

void start();
