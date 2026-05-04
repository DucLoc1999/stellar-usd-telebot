import { Bot } from 'grammy';
import { setupMenuHandlers } from './menu';
import { setupBuyHandlers } from './buy';
import { setupSellHandlers } from './sell';
import { setupKycHandlers } from './kyc';
import { setupPaymentHandlers } from './payment';
import { setupDeleteHandlers } from './delete';
import { setupRouterHandlers } from './router';
import { setupErrorHandler } from './error';

export function setupHandlers(bot: Bot): void {
  setupMenuHandlers(bot);
  setupBuyHandlers(bot);
  setupSellHandlers(bot);
  setupKycHandlers(bot);
  setupPaymentHandlers(bot);
  setupDeleteHandlers(bot);
  setupRouterHandlers(bot);
  setupErrorHandler(bot);
}
