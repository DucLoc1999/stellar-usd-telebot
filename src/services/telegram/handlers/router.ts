import { Bot } from 'grammy';
import { Messages, Keyboards } from '../index';
import { getState, setState } from '../user-state';
import { logger } from '../../../config/logger';
import { getUserId } from './context';
import { validateVietnamesePhoneNumber } from '../utils';
import { handleKycIdCardPhoto } from './kyc';
import { handleBuyAmountInput, handleWalletInput } from './buy';
import {
  handleSellAmountInput,
  handleFullNameInput,
  handleAccountNumberInput,
  handleBankDetailsSingleInput,
} from './sell';
import { handleDeleteBankIndexInput, handleDeleteWalletIndexInput } from './delete';

export function setupRouterHandlers(bot: Bot): void {
  bot.on('message:contact', async (ctx) => {
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || state.waitingFor !== 'kyc_phone') {
      return;
    }

    try {
      const contact = ctx.message.contact;
      const phoneNumber = contact.phone_number;

      logger.info({ userId, phoneNumber }, 'Received phone number via contact sharing');

      if (validateVietnamesePhoneNumber(phoneNumber)) {
        state.kycPhoneNumber = phoneNumber;
        state.waitingFor = undefined;
        setState(userId, state, {
          action: 'handler.state.set',
          chatType: ctx.chat?.type,
          chatId: ctx.chat?.id,
        });

        await ctx.reply(Messages.KYC_PHONE_RECEIVED(phoneNumber), {
          parse_mode: 'HTML',
          reply_markup: { remove_keyboard: true },
        });

        await ctx.reply(Messages.KYC_SELECT_DOCUMENT_TYPE(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.kycDocumentTypeSelection(),
        });

        logger.info(
          { userId, phoneNumber },
          'Phone number validated, requesting document type selection'
        );
      } else {
        await ctx.reply(Messages.KYC_INVALID_PHONE(), { parse_mode: 'HTML' });
      }
    } catch (error) {
      logger.error({ error, userId }, 'Error handling contact message');
      await ctx.reply(
        `❌ <b>Lỗi xử lý số điện thoại</b>\n\n` +
          `Không thể xử lý số điện thoại của bạn.\n\n` +
          `Vui lòng thử lại!`,
        { parse_mode: 'HTML' }
      );
    }
  });

  bot.on('message:photo', async (ctx) => {
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state) {
      return;
    }

    const isKycFront = state.waitingFor === 'kyc_id_card';
    const isKycBack = state.waitingFor === 'kyc_id_card_back';

    if (!isKycFront && !isKycBack) {
      return;
    }

    const photos = ctx.message.photo;
    if (!photos || photos.length === 0) {
      logger.error({ userId }, 'No photos found in message');
      return;
    }

    const photo = photos[photos.length - 1];
    if (!photo) {
      logger.error({ userId }, 'Failed to get photo from array');
      return;
    }

    const photoUniqueId = photo.file_unique_id;

    if (state.lastProcessedPhotoId === photoUniqueId) {
      logger.info(
        { userId, photoUniqueId },
        'Ignoring duplicate photo - already processed this image'
      );
      return;
    }

    state.waitingFor = 'kyc_processing';
    state.lastProcessedPhotoId = photoUniqueId;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    logger.info(
      { userId, photoUniqueId, side: isKycBack ? 'back' : 'front' },
      'Starting ID card photo processing'
    );

    try {
      await handleKycIdCardPhoto(ctx, userId, state, isKycBack ? 'back' : 'front');
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId,
          side: isKycBack ? 'back' : 'front',
        },
        'Error handling ID card photo'
      );
      state.waitingFor = isKycBack ? 'kyc_id_card_back' : 'kyc_id_card';
      state.lastProcessedPhotoId = undefined;
      setState(userId, state, {
        action: 'handler.state.set',
        chatType: ctx.chat?.type,
        chatId: ctx.chat?.id,
      });
    }
  });

  bot.on('message:text', async (ctx) => {
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state) {
      return;
    }

    const text = ctx.message.text.trim();

    if (state.waitingFor === 'buy_amount') {
      await handleBuyAmountInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'sell_amount') {
      await handleSellAmountInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'wallet') {
      await handleWalletInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'full_name') {
      await handleFullNameInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'account_number') {
      await handleAccountNumberInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'bank_details_single') {
      await handleBankDetailsSingleInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'delete_bank_index') {
      await handleDeleteBankIndexInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'delete_wallet_index') {
      await handleDeleteWalletIndexInput(ctx, userId, state, text);
    }
  });
}
