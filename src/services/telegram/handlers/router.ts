import { Bot } from 'grammy';
import { Messages, Keyboards } from '../index';
import { userStates } from '../user-state';
import { logger } from '../../../config/logger';
import { validateVietnamesePhoneNumber } from '../utils';

export function setupRouterHandlers(bot: Bot): void {
  bot.on('message:contact', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates.get(userId);

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
        userStates.set(userId, state);

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
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (!state || state.waitingFor !== 'kyc_id_card') {
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
    userStates.set(userId, state);

    logger.info({ userId, photoUniqueId }, 'Starting ID card photo processing');

    try {
      const { handleKycIdCardPhoto } = await import('./kyc');
      await handleKycIdCardPhoto(ctx, userId, state);
    } catch (error) {
      logger.error({ error, userId }, 'Error handling ID card photo');
      state.waitingFor = 'kyc_id_card';
      state.lastProcessedPhotoId = undefined;
      userStates.set(userId, state);
    }
  });

  bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (!state) {
      return;
    }

    const text = ctx.message.text.trim();

    if (state.waitingFor === 'buy_amount') {
      const { handleBuyAmountInput } = await import('./buy');
      await handleBuyAmountInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'sell_amount') {
      const { handleSellAmountInput } = await import('./sell');
      await handleSellAmountInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'wallet') {
      const { handleWalletInput } = await import('./buy');
      await handleWalletInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'full_name') {
      const { handleFullNameInput } = await import('./sell');
      await handleFullNameInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'account_number') {
      const { handleAccountNumberInput } = await import('./sell');
      await handleAccountNumberInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'bank_details_single') {
      const { handleBankDetailsSingleInput } = await import('./sell');
      await handleBankDetailsSingleInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'delete_bank_index') {
      const { handleDeleteBankIndexInput } = await import('./delete');
      await handleDeleteBankIndexInput(ctx, userId, state, text);
    } else if (state.waitingFor === 'delete_wallet_index') {
      const { handleDeleteWalletIndexInput } = await import('./delete');
      await handleDeleteWalletIndexInput(ctx, userId, state, text);
    }
  });
}
