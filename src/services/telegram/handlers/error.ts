import { Bot } from 'grammy';
import { logger } from '../../../config/logger';

export function setupErrorHandler(bot: Bot): void {
  bot.catch((err) => {
    const error = err.error as any;

    logger.error(
      {
        err,
        error,
        errorConstructor: error?.constructor?.name,
        errorCode: error?.error_code,
        errorCodeType: typeof error?.error_code,
        description: error?.description,
        descriptionType: typeof error?.description,
        userId: err.ctx?.from?.id,
        ctx: err.ctx,
      },
      'Bot catch handler - error details'
    );

    if (error?.error_code === 403) {
      logger.info(
        { errorCode: error.error_code, description: error.description, userId: err.ctx?.from?.id },
        'User blocked the bot'
      );
      return;
    }

    if (
      (error?.error_code === 400 || error?.error_code === '400') &&
      error?.description?.includes('query is too old')
    ) {
      logger.warn(
        { errorCode: error.error_code, description: error.description, userId: err.ctx?.from?.id },
        'Callback query timeout or duplicate click'
      );
      return;
    }

    logger.error(
      {
        err,
        error,
        errorCode: error?.error_code,
        description: error?.description,
        userId: err.ctx?.from?.id,
      },
      'Unexpected bot error'
    );
  });
}
