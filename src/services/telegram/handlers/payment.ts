import { Bot } from 'grammy';
import { Messages, Keyboards } from '../index';
import { getState, clearState, userCancelledOrders } from '../user-state';
import { sendNotifyMessage, getOrderSlots, clearMainMsgId } from '../index';
import { logger } from '../../../config/logger';
import { getUserId } from './context';
import { handleBuyConfirmation } from './buy';
import { handleSellConfirmation } from './sell';

export function setupPaymentHandlers(bot: Bot): void {
  bot.callbackQuery('confirm_payment', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    logger.info(
      { userId, state: state ? { action: state.action, amount: state.amount } : null },
      'Processing payment confirmation'
    );

    if (!state || !state.action || !state.amount) {
      logger.warn({ userId }, 'Invalid state for payment confirmation');
      await ctx.reply(
        `❌ <b>Lỗi trạng thái</b>\n\n` + `Phiên làm việc đã hết hạn.\n\n` + `Vui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    try {
      if (state.action === 'buy') {
        logger.info(
          { userId, amount: state.amount, wallet: state.walletAddress },
          'Processing buy order'
        );
        await handleBuyConfirmation(ctx, userId, state);
      } else {
        logger.info({ userId, amount: state.amount }, 'Processing sell order');
        await handleSellConfirmation(ctx, userId, state);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const { captureErrorWithContext } = await import('../../../utils/sentryHelper');
      captureErrorWithContext(error, {
        userId,
        action: 'processPaymentConfirmation',
        state: state.action,
      });

      const stateForError = getState(userId, {
        action: 'handler.state.get',
        chatType: ctx.chat?.type,
        chatId: ctx.chat?.id,
      });

      if (stateForError?.orderId && getOrderSlots(stateForError.orderId)) {
        const errorMsg =
          errorMessage === 'KYC verification required'
            ? Messages.KYC_REQUIRED()
            : errorMessage.includes('User not found')
              ? `❌ <b>Lỗi tài khoản</b>\n\nKhông tìm thấy thông tin tài khoản của bạn.\nVui lòng liên hệ support để được hỗ trợ!`
              : errorMessage.includes('API error')
                ? `❌ <b>Lỗi kết nối</b>\n\nKhông thể kết nối đến hệ thống thanh toán.\nVui lòng thử lại sau ít phút!`
                : `❌ <b>Có lỗi xảy ra</b>\n\nChi tiết: ${errorMessage}\n\nVui lòng thử lại hoặc liên hệ support!`;
        await sendNotifyMessage(ctx, stateForError.orderId, errorMsg);
      } else if (errorMessage === 'KYC verification required') {
        await ctx.reply(Messages.KYC_REQUIRED(), { parse_mode: 'HTML' });
      } else if (errorMessage.includes('User not found')) {
        await ctx.reply(
          `❌ <b>Lỗi tài khoản</b>\n\n` +
            `Không tìm thấy thông tin tài khoản của bạn.\n` +
            `Vui lòng liên hệ support để được hỗ trợ!`,
          { parse_mode: 'HTML' }
        );
      } else if (errorMessage.includes('API error')) {
        await ctx.reply(
          `❌ <b>Lỗi kết nối</b>\n\n` +
            `Không thể kết nối đến hệ thống thanh toán.\n` +
            `Vui lòng thử lại sau ít phút!`,
          { parse_mode: 'HTML' }
        );
      } else {
        await ctx.reply(
          `❌ <b>Có lỗi xảy ra</b>\n\n` +
            `Chi tiết: ${errorMessage}\n\n` +
            `Vui lòng thử lại hoặc liên hệ support!`,
          { parse_mode: 'HTML' }
        );
      }
    }
  });

  bot.callbackQuery('cancel_payment', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    clearState(userId, {
      action: 'handler.state.clear',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });
    await ctx.editMessageText(Messages.PAYMENT_CANCELLED(), {
      parse_mode: 'HTML',
      reply_markup: await Keyboards.mainMenu(userId),
    });
  });

  bot.callbackQuery(/^cancel_order_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const orderId = ctx.match[1];

    if (!orderId) {
      logger.error({ userId }, 'Order ID not found in callback data');
      await ctx.reply(
        `❌ <b>Lỗi đơn hàng</b>\n\n` + `Không tìm thấy mã đơn hàng.\n\n` + `Vui lòng thử lại!`,
        { parse_mode: 'HTML', reply_markup: await Keyboards.mainMenu(userId) }
      );
      return;
    }

    logger.info({ userId, orderId }, 'User requested to cancel order');

    try {
      const partnerAppKey = process.env.PARTNER_APP_KEY;
      if (!partnerAppKey) {
        logger.error('PARTNER_APP_KEY not configured');
        await ctx.reply(
          `❌ <b>Lỗi cấu hình</b>\n\n` +
            `Hệ thống chưa được cấu hình đúng.\n\n` +
            `Vui lòng liên hệ support!`,
          { parse_mode: 'HTML', reply_markup: await Keyboards.mainMenu(userId) }
        );
        return;
      }

      const apiPay = process.env.API_PAY;
      const response = await fetch(`${apiPay}/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Partner-App-Key': partnerAppKey,
        },
        body: '{}',
      });

      logger.info(
        { userId, orderId, status: response.status, ok: response.ok },
        'Cancel order API response received'
      );

      if (response.ok) {
        userCancelledOrders.add(orderId);
        logger.info(
          { userId, orderId },
          'Marked order as user-cancelled to suppress webhook notification'
        );

        setTimeout(() => {
          userCancelledOrders.delete(orderId);
          logger.debug({ orderId }, 'Removed order from user-cancelled tracking set');
        }, 60000);

        const slots = getOrderSlots(orderId);
        if (slots?.mainMsgId) {
          try {
            await ctx.api.deleteMessage(slots.chatId, slots.mainMsgId);
          } catch (err: any) {
            if (err?.error_code !== 403 && err?.error_code !== 400) {
              logger.warn(
                { userId, orderId, msgId: slots.mainMsgId, err },
                'Failed to delete main order message on cancel'
              );
            }
          } finally {
            clearMainMsgId(orderId);
          }
        }

        // Update existing order-state notice message in place (no new "🚫 ĐÃ HỦY" message).
        const slotsAfterDelete = getOrderSlots(orderId);
        if (slotsAfterDelete?.notifyMsgId) {
          try {
            await ctx.api.editMessageText(
              slotsAfterDelete.chatId,
              slotsAfterDelete.notifyMsgId,
              Messages.ORDER_STATE_CANCELLED(orderId),
              {
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: true },
                // Remove all buttons on "🚫 ĐÃ HỦY" status message.
                reply_markup: { inline_keyboard: [] },
              }
            );
          } catch (err: any) {
            // If message cannot be edited (not found / too old / rights), don't send a new status message.
            logger.warn(
              { userId, orderId, msgId: slotsAfterDelete.notifyMsgId, err },
              'Failed to edit notify message to cancelled state'
            );
          }
        }

        await ctx.reply(Messages.ORDER_CANCELLED(), {
          parse_mode: 'HTML',
          reply_markup: await Keyboards.mainMenu(userId),
        });
      } else {
        const errorText = await response.text();
        logger.error(
          { userId, orderId, status: response.status, errorText },
          'Failed to cancel order'
        );

        await ctx.reply(Messages.ORDER_CANCEL_FAILED(), {
          parse_mode: 'HTML',
          reply_markup: await Keyboards.mainMenu(userId),
        });
      }
    } catch (error) {
      logger.error(
        { userId, orderId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Error cancelling order'
      );

      await ctx.reply(Messages.ORDER_CANCEL_FAILED(), {
        parse_mode: 'HTML',
        reply_markup: await Keyboards.mainMenu(userId),
      });
    }
  });
}
