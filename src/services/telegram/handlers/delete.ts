import { Bot } from 'grammy';
import { Messages, Keyboards } from '../index';
import { userStates, type UserState } from '../user-state';
import { logger } from '../../../config/logger';
import { banks } from '../../../models/webhook';
import paymentInformationService from '../../paymentInformationService';

export function setupDeleteHandlers(bot: Bot): void {
  bot.callbackQuery('add_bank_from_menu', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;

    logger.info({ userId }, 'User chose to add new bank account from menu');

    userStates.set(userId, {
      action: 'sell',
      waitingFor: 'bank_details_single',
      isNewPaymentInfo: true,
    });

    await ctx.editMessageText(Messages.ENTER_BANK_DETAILS_SINGLE(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  });

  bot.callbackQuery('add_wallet_from_menu', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;

    logger.info({ userId }, 'User chose to add new wallet from menu');

    userStates.set(userId, {
      action: 'buy',
      waitingFor: 'wallet',
      isNewPaymentInfo: true,
    });

    await ctx.editMessageText(Messages.ENTER_WALLET_ADDRESS(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  });

  bot.callbackQuery('delete_bank_prompt', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;

    logger.info({ userId }, 'User initiated bank account deletion');

    const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(userId, 'BANK');

    userStates.set(userId, {
      waitingFor: 'delete_bank_index',
      savedBankAccounts: savedBankAccounts,
    });

    await ctx.editMessageText(Messages.ENTER_DELETE_BANK_INDEX(savedBankAccounts), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  });

  bot.callbackQuery('delete_wallet_prompt', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;

    logger.info({ userId }, 'User initiated wallet deletion');

    const savedWallets = await paymentInformationService.findByTypeAndChatId(userId, 'CRYPTO');

    userStates.set(userId, {
      waitingFor: 'delete_wallet_index',
      savedWallets: savedWallets,
    });

    await ctx.editMessageText(Messages.ENTER_DELETE_WALLET_INDEX(savedWallets), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  });

  bot.callbackQuery('confirm_delete', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (!state || !state.paymentInfoId) {
      logger.error({ userId }, 'No payment info ID in state for deletion');
      await ctx.editMessageText(
        `❌ <b>Lỗi trạng thái</b>\n\n` + `Phiên làm việc đã hết hạn.\n\n` + `Vui lòng thử lại!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
      return;
    }

    try {
      const deleted = await paymentInformationService.deleteById(state.paymentInfoId, userId);

      if (deleted) {
        logger.info({ userId, paymentInfoId: state.paymentInfoId }, 'Payment info deleted');
        await ctx.editMessageText(Messages.DELETE_SUCCESS(), {
          parse_mode: 'HTML',
          reply_markup: await Keyboards.mainMenu(userId),
        });
      } else {
        logger.error(
          { userId, paymentInfoId: state.paymentInfoId },
          'Failed to delete payment info'
        );
        await ctx.editMessageText(Messages.DELETE_FAILED(), {
          parse_mode: 'HTML',
          reply_markup: await Keyboards.mainMenu(userId),
        });
      }

      delete state.paymentInfoId;
      userStates.set(userId, state);
    } catch (error) {
      logger.error(
        { userId, paymentInfoId: state.paymentInfoId, error },
        'Error deleting payment info'
      );
      await ctx.editMessageText(Messages.DELETE_FAILED(), {
        parse_mode: 'HTML',
        reply_markup: await Keyboards.mainMenu(userId),
      });
    }
  });

  bot.callbackQuery('cancel_delete', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (state) {
      delete state.paymentInfoId;
      userStates.set(userId, state);
    }

    await ctx.editMessageText('❌ Đã hủy thao tác xóa.', {
      parse_mode: 'HTML',
      reply_markup: await Keyboards.mainMenu(userId),
    });
  });
}

export async function handleDeleteBankIndexInput(
  ctx: any,
  userId: number,
  state: UserState,
  text: string
): Promise<void> {
  const index = parseInt(text);

  if (
    isNaN(index) ||
    index < 1 ||
    !state.savedBankAccounts ||
    index > state.savedBankAccounts.length
  ) {
    await ctx.reply(Messages.INVALID_DELETE_INDEX(), { parse_mode: 'HTML' });
    return;
  }

  const selectedAccount = state.savedBankAccounts[index - 1];
  const bank = banks.find((b) => b.id === selectedAccount.bank_id);
  const bankName = bank ? bank.short_name : 'N/A';

  state.paymentInfoId = selectedAccount.id;
  state.waitingFor = undefined;
  userStates.set(userId, state);

  logger.info(
    { userId, index, paymentInfoId: selectedAccount.id },
    'User selected bank account to delete'
  );

  await ctx.reply(
    Messages.CONFIRM_DELETE_BANK(
      bankName,
      selectedAccount.bank_account || 'N/A',
      selectedAccount.full_name
    ),
    { parse_mode: 'HTML', reply_markup: Keyboards.confirmDelete() }
  );
}

export async function handleDeleteWalletIndexInput(
  ctx: any,
  userId: number,
  state: UserState,
  text: string
): Promise<void> {
  const index = parseInt(text);

  if (isNaN(index) || index < 1 || !state.savedWallets || index > state.savedWallets.length) {
    await ctx.reply(Messages.INVALID_DELETE_INDEX(), { parse_mode: 'HTML' });
    return;
  }

  const selectedWallet = state.savedWallets[index - 1];

  state.paymentInfoId = selectedWallet.id;
  state.waitingFor = undefined;
  userStates.set(userId, state);

  logger.info(
    { userId, index, paymentInfoId: selectedWallet.id },
    'User selected wallet to delete'
  );

  await ctx.reply(Messages.CONFIRM_DELETE_WALLET(selectedWallet.wallet_address || 'N/A'), {
    parse_mode: 'HTML',
    reply_markup: Keyboards.confirmDelete(),
  });
}
