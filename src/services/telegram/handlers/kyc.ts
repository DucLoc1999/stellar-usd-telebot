import { Bot } from 'grammy';
import { Messages, Keyboards } from '../index';
import { getState, setState, clearState, type UserState } from '../user-state';
import { logger } from '../../../config/logger';
import { getUserId } from './context';
import { telegramConfig } from '../../../config/app';
import teleUserService from '../../teleUserService';
import kycService from '../../kycService';
import fptAiVisionService from '../../fptAiVisionService';
import s3Service from '../../s3Service';
import { parseSexForDatabase, isDuplicateKeyError } from '../utils';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

function checkNeedsBackSide(idData: any, documentType: 'cccd' | 'passport'): boolean {
  if (documentType === 'passport') {
    return false;
  }

  const hasId = !!(idData && idData.id && idData.id.trim());
  const hasName = !!(idData && idData.name && idData.name.trim());
  const hasDob = !!(idData && idData.dob && idData.dob.trim() && idData.dob !== 'N/A');
  const hasSex = !!(idData && idData.sex && idData.sex.trim() && idData.sex !== 'N/A');
  const hasNationality = !!(
    idData &&
    idData.nationality &&
    idData.nationality.trim() &&
    idData.nationality !== 'N/A'
  );

  const frontHasRequiredData = hasId && hasName && hasDob && hasSex && hasNationality;

  logger.info(
    {
      hasId,
      hasName,
      hasDob,
      hasSex,
      hasNationality,
      frontHasRequiredData,
      idData,
    },
    'Checking if front-side data is sufficient'
  );

  return !frontHasRequiredData;
}

export function setupKycHandlers(bot: Bot): void {
  bot.callbackQuery('kyc', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});

    try {
      const userId = getUserId(ctx);

      logger.info({ userId }, 'Checking KYC status');
      const kycRecord = await kycService.findByChatId(userId);

      if (kycRecord) {
        logger.info({ userId, kycId: kycRecord.id }, 'User has completed KYC');
        await ctx.editMessageText(Messages.KYC_COMPLETED(kycRecord), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      } else {
        logger.info({ userId }, 'User has not completed KYC');
        await ctx.editMessageText(Messages.KYC_NOT_COMPLETED(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.kycStart(),
        });
      }
    } catch (error) {
      logger.error({ error }, 'Error checking KYC status');
      await ctx.editMessageText(
        `❌ <b>Lỗi kiểm tra KYC</b>\n\n` +
          `Không thể kiểm tra trạng thái KYC của bạn.\n\n` +
          `Vui lòng thử lại sau!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
    }
  });

  bot.callbackQuery('start_kyc', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});

    try {
      const userId = getUserId(ctx);
      logger.info({ userId }, 'User started KYC process');

      const hasExceeded = await teleUserService.hasExceededKycAttempts(userId);
      if (hasExceeded) {
        logger.warn({ userId }, 'User has exceeded KYC attempt limit');
        await ctx.editMessageText(Messages.KYC_ATTEMPTS_EXCEEDED(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.kycAttemptsExceeded(),
        });
        return;
      }

      setState(
        userId,
        { action: 'kyc', waitingFor: 'kyc_phone' },
        { action: 'handler.state.set', chatType: ctx.chat?.type, chatId: ctx.chat?.id }
      );

      await ctx.editMessageText(Messages.KYC_REQUEST_PHONE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.kycCancel(),
      });

      await ctx.reply(`📱 Nhấn nút bên dưới để chia sẻ số điện thoại:`, {
        reply_markup: Keyboards.kycPhoneRequest(),
      });
    } catch (error) {
      logger.error({ error }, 'Error starting KYC process');
      await ctx.editMessageText(
        `❌ <b>Lỗi khởi động KYC</b>\n\n` +
          `Không thể bắt đầu quy trình KYC.\n\n` +
          `Vui lòng thử lại sau!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
    }
  });

  bot.callbackQuery('cancel_kyc', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    logger.info({ userId }, 'User cancelled KYC process');
    clearState(userId, {
      action: 'handler.state.clear',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });
    const firstName = ctx.from?.first_name || 'bạn';
    await ctx.editMessageText(Messages.WELCOME(firstName), {
      parse_mode: 'HTML',
      reply_markup: await Keyboards.mainMenu(userId),
    });
  });

  bot.callbackQuery('kyc_select_cccd', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || !state.kycPhoneNumber) {
      await ctx.editMessageText(
        `❌ <b>Lỗi trạng thái</b>\n\n` +
          `Phiên KYC đã hết hạn hoặc không hợp lệ.\n\n` +
          `Vui lòng bắt đầu lại quy trình KYC!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
      return;
    }

    logger.info({ userId }, 'User selected CCCD for KYC verification');
    state.kycDocumentType = 'cccd';
    state.waitingFor = 'kyc_id_card';
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    await ctx.editMessageText(Messages.KYC_REQUEST_ID_CARD(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.kycCancel(),
    });
  });

  bot.callbackQuery('kyc_select_passport', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || !state.kycPhoneNumber) {
      await ctx.editMessageText(
        `❌ <b>Lỗi trạng thái</b>\n\n` +
          `Phiên KYC đã hết hạn hoặc không hợp lệ.\n\n` +
          `Vui lòng bắt đầu lại quy trình KYC!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
      return;
    }

    logger.info({ userId }, 'User selected Passport for KYC verification');
    state.kycDocumentType = 'passport';
    state.waitingFor = 'kyc_id_card';
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    await ctx.editMessageText(Messages.KYC_REQUEST_PASSPORT(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.kycCancel(),
    });
  });

  bot.callbackQuery('kyc_recapture_id_card', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state) {
      return;
    }

    logger.info({ userId }, 'User requested to recapture ID card');

    state.kycIdCardData = undefined;
    state.kycIdCardBackData = undefined;
    state.kycImageUrl = undefined;
    state.kycImageUrlBack = undefined;
    state.lastProcessedPhotoId = undefined;
    state.waitingFor = 'kyc_id_card';
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    const message =
      state.kycDocumentType === 'passport'
        ? Messages.KYC_REQUEST_PASSPORT()
        : Messages.KYC_REQUEST_ID_CARD();

    await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: Keyboards.kycCancel() });
  });

  bot.callbackQuery('kyc_try_different_id', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state) {
      return;
    }

    logger.info({ userId }, 'User requested to try different ID card after duplicate error');

    state.kycIdCardData = undefined;
    state.kycIdCardBackData = undefined;
    state.kycImageUrl = undefined;
    state.kycImageUrlBack = undefined;
    state.lastProcessedPhotoId = undefined;
    state.waitingFor = 'kyc_id_card';
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    const message =
      state.kycDocumentType === 'passport'
        ? Messages.KYC_REQUEST_PASSPORT()
        : Messages.KYC_REQUEST_ID_CARD();

    await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: Keyboards.kycCancel() });
  });
}

export async function handleKycIdCardPhoto(
  ctx: any,
  userId: number,
  state: UserState,
  side: 'front' | 'back' = 'front'
): Promise<void> {
  const documentType = state.kycDocumentType || 'cccd';
  logger.info({ userId, documentType, side }, 'Processing ID card photo');

  await teleUserService.incrementKycAttempts(userId);
  logger.info({ userId }, 'Incremented KYC attempt counter');

  await ctx.reply(Messages.KYC_PROCESSING_IMAGE(), { parse_mode: 'HTML' });

  try {
    const photos = ctx.message.photo;
    const photo = photos[photos.length - 1];

    logger.info(
      { userId, fileId: photo.file_id, fileUniqueId: photo.file_unique_id, side },
      'Downloading photo from Telegram'
    );

    const file = await ctx.api.getFile(photo.file_id);
    const filePath = file.file_path;

    if (!filePath) {
      throw new Error('Failed to get file path');
    }

    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const localFilePath = path.join(dataDir, `${userId}_${side}.jpg`);
    const fileUrl = `https://api.telegram.org/file/bot${telegramConfig.botToken}/${filePath}`;

    const response = await axios.get(fileUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(localFilePath);

    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', reject);
    });

    logger.info({ userId, localFilePath, side }, 'ID card image saved to disk');

    logger.info({ userId, documentType, side }, 'Calling FPT AI Vision API');
    const idData = await fptAiVisionService.recognizeIdCard(localFilePath, documentType);
    logger.info({ userId, documentType, side, idData }, 'FPT AI Vision API call successful');

    const s3FileName = `kyc/${userId}_${side}_${Date.now()}.jpg`;
    logger.info({ userId, localFilePath, s3FileName, side }, 'Uploading KYC image to S3');
    const s3Url = await s3Service.uploadImage(localFilePath, s3FileName, 'image/jpeg');
    logger.info({ userId, s3Url, side }, 'KYC image uploaded to S3 successfully');

    try {
      fs.unlinkSync(localFilePath);
      logger.info(
        { userId, localFilePath, side },
        'Temporary KYC image file deleted from local disk'
      );
    } catch (deleteError) {
      logger.warn(
        { userId, localFilePath, error: deleteError },
        'Failed to delete temporary KYC image file'
      );
    }

    if (side === 'back') {
      state.kycIdCardBackData = idData;
      state.kycImageUrlBack = s3Url;
      logger.info({ userId }, 'Back side data stored, proceeding to save KYC data');
      await saveKycData(ctx, userId, state);
    } else {
      state.kycIdCardData = idData;
      state.kycImageUrl = s3Url;

      const needsBackSide = checkNeedsBackSide(idData, documentType);

      if (needsBackSide) {
        state.waitingFor = 'kyc_id_card_back';
        state.lastProcessedPhotoId = undefined;
        setState(userId, state, {
          action: 'handler.state.set',
          chatType: ctx.chat?.type,
          chatId: ctx.chat?.id,
        });

        await ctx.reply(Messages.KYC_REQUEST_ID_CARD_BACK(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.kycCancel(),
        });
        logger.info({ userId }, 'Front side data insufficient, asking for back side');
      } else {
        logger.info({ userId }, 'Front side data sufficient, saving KYC data');
        await saveKycData(ctx, userId, state);
      }
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        side,
        documentType,
      },
      'Error processing ID card photo'
    );

    await ctx.reply(Messages.KYC_IMAGE_ERROR(side), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.kycCancel(),
    });

    state.waitingFor = side === 'back' ? 'kyc_id_card_back' : 'kyc_id_card';
    state.lastProcessedPhotoId = undefined;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    throw error;
  }
}

export async function saveKycData(ctx: any, userId: number, state: UserState): Promise<void> {
  const frontIdData = state.kycIdCardData;
  const backIdData = state.kycIdCardBackData;
  const phoneNumber = state.kycPhoneNumber;
  const documentType = state.kycDocumentType || 'cccd';
  const kycImageUrl = state.kycImageUrl;
  const kycImageUrlBack = state.kycImageUrlBack;

  if (!frontIdData || !phoneNumber) {
    throw new Error('Missing KYC front data');
  }

  const kycImage = kycImageUrlBack || kycImageUrl;

  logger.info({ userId, documentType, kycImage }, 'Saving KYC data to database');

  try {
    const dob = fptAiVisionService.parseDate(frontIdData.dob);
    if (!dob) {
      throw new Error('Invalid date of birth in ID card data');
    }

    let doe: Date | null = null;
    if (documentType === 'passport') {
      doe = fptAiVisionService.parseDate(frontIdData.doe);
      if (!doe) {
        throw new Error('Invalid date of expiry in passport data');
      }
    } else if (backIdData && backIdData.issue_date) {
      doe = fptAiVisionService.parseDate(backIdData.issue_date);
    }

    const kycType: 'PASSPORT' | 'IDC' = documentType === 'passport' ? 'PASSPORT' : 'IDC';
    const passportNumber =
      documentType === 'passport' && frontIdData.passport_number
        ? frontIdData.passport_number
        : undefined;

    const home = documentType === 'passport' ? frontIdData.pob || 'N/A' : frontIdData.home || 'N/A';
    const address =
      documentType === 'passport' ? frontIdData.pob || 'N/A' : frontIdData.address || 'N/A';

    const idNumber = documentType === 'passport' ? frontIdData.id_number : frontIdData.id;

    const sexForDatabase = parseSexForDatabase(frontIdData.sex);

    await kycService.create({
      chat_id: userId,
      phone: phoneNumber,
      type: kycType,
      id_number: idNumber,
      name: frontIdData.name,
      dob: dob,
      sex: sexForDatabase,
      nationality: frontIdData.nationality,
      home: home,
      address: address,
      doe: doe ?? undefined,
      passport_number: passportNumber,
      kyc_image: kycImage,
    });

    await teleUserService.updateKycStatus(userId, true);

    logger.info({ userId }, 'KYC data saved successfully');

    clearState(userId, {
      action: 'handler.state.clear',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    await ctx.reply(Messages.KYC_SAVE_SUCCESS(frontIdData.name, phoneNumber), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  } catch (error: any) {
    const isDuplicateError = isDuplicateKeyError(error);

    if (isDuplicateError) {
      const idNumberLast4 = frontIdData.id ? frontIdData.id.slice(-4) : 'unknown';
      logger.warn(
        { userId, idNumberLast4, errorCode: error.code, errorMessage: error.message },
        'Duplicate ID card number detected - ID already registered to another account'
      );

      await ctx.reply(Messages.KYC_ID_ALREADY_REGISTERED(idNumberLast4), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.kycDuplicateIdError(),
      });

      return;
    }

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
      },
      'Error saving KYC data to database'
    );
    throw error;
  }
}
