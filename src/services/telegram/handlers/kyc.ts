import { Bot } from 'grammy';
import { Messages, Keyboards } from '../index';
import { userStates, type UserState } from '../user-state';
import { logger } from '../../../config/logger';
import { telegramConfig } from '../../../config/app';
import teleUserService from '../../teleUserService';
import kycService from '../../kycService';
import fptAiVisionService from '../../fptAiVisionService';
import s3Service from '../../s3Service';
import { parseSexForDatabase, isDuplicateKeyError } from '../utils';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

export function setupKycHandlers(bot: Bot): void {
  bot.callbackQuery('kyc', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});

    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        logger.error('Missing chat ID in kyc callback');
        await ctx.editMessageText(
          `❌ <b>Lỗi hệ thống</b>\n\n` +
            `Không thể xác định tài khoản của bạn.\n\n` +
            `Vui lòng thử lại!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
        return;
      }

      logger.info({ chatId }, 'Checking KYC status');
      const kycRecord = await kycService.findByChatId(chatId);

      if (kycRecord) {
        logger.info({ chatId, kycId: kycRecord.id }, 'User has completed KYC');
        await ctx.editMessageText(Messages.KYC_COMPLETED(kycRecord), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      } else {
        logger.info({ chatId }, 'User has not completed KYC');
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
      const userId = ctx.from.id;
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

      userStates.set(userId, { action: 'kyc', waitingFor: 'kyc_phone' });

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
    const userId = ctx.from.id;
    logger.info({ userId }, 'User cancelled KYC process');
    userStates.delete(userId);
    const firstName = ctx.from?.first_name || 'bạn';
    await ctx.editMessageText(Messages.WELCOME(firstName), {
      parse_mode: 'HTML',
      reply_markup: await Keyboards.mainMenu(userId),
    });
  });

  bot.callbackQuery('kyc_select_cccd', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;
    const state = userStates.get(userId);

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
    userStates.set(userId, state);

    await ctx.editMessageText(Messages.KYC_REQUEST_ID_CARD(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.kycCancel(),
    });
  });

  bot.callbackQuery('kyc_select_passport', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;
    const state = userStates.get(userId);

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
    userStates.set(userId, state);

    await ctx.editMessageText(Messages.KYC_REQUEST_PASSPORT(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.kycCancel(),
    });
  });

  bot.callbackQuery('kyc_recapture_id_card', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (!state) {
      return;
    }

    logger.info({ userId }, 'User requested to recapture ID card');

    state.kycIdCardData = undefined;
    state.lastProcessedPhotoId = undefined;
    state.waitingFor = 'kyc_id_card';
    userStates.set(userId, state);

    const message =
      state.kycDocumentType === 'passport'
        ? Messages.KYC_REQUEST_PASSPORT()
        : Messages.KYC_REQUEST_ID_CARD();

    await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: Keyboards.kycCancel() });
  });

  bot.callbackQuery('kyc_try_different_id', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (!state) {
      return;
    }

    logger.info({ userId }, 'User requested to try different ID card after duplicate error');

    state.kycIdCardData = undefined;
    state.lastProcessedPhotoId = undefined;
    state.waitingFor = 'kyc_id_card';
    userStates.set(userId, state);

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
  state: UserState
): Promise<void> {
  logger.info({ userId }, 'Processing ID card photo');

  await teleUserService.incrementKycAttempts(userId);
  logger.info({ userId }, 'Incremented KYC attempt counter');

  await ctx.reply(Messages.KYC_PROCESSING_IMAGE(), { parse_mode: 'HTML' });

  try {
    const photos = ctx.message.photo;
    const photo = photos[photos.length - 1];

    logger.info(
      { userId, fileId: photo.file_id, fileUniqueId: photo.file_unique_id },
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

    const localFilePath = path.join(dataDir, `${userId}.jpg`);
    const fileUrl = `https://api.telegram.org/file/bot${telegramConfig.botToken}/${filePath}`;

    const response = await axios.get(fileUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(localFilePath);

    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve());
      writer.on('error', reject);
    });

    logger.info({ userId, localFilePath }, 'ID card image saved to disk');

    const documentType = state.kycDocumentType || 'cccd';

    logger.info({ userId, documentType }, 'Calling FPT AI Vision API');
    const idData = await fptAiVisionService.recognizeIdCard(localFilePath, documentType);
    logger.info({ userId, documentType, idData }, 'FPT AI Vision API call successful');

    logger.info({ userId, localFilePath }, 'Uploading KYC image to S3');
    const s3Url = await s3Service.uploadKycImage(localFilePath, userId);
    logger.info({ userId, s3Url }, 'KYC image uploaded to S3 successfully');

    try {
      fs.unlinkSync(localFilePath);
      logger.info({ userId, localFilePath }, 'Temporary KYC image file deleted from local disk');
    } catch (deleteError) {
      logger.warn(
        { userId, localFilePath, error: deleteError },
        'Failed to delete temporary KYC image file'
      );
    }

    state.kycIdCardData = idData;
    state.kycImageUrl = s3Url;
    userStates.set(userId, state);

    logger.info({ userId }, 'ID card data extracted, automatically saving to database');

    await saveKycData(ctx, userId, state);
  } catch (error) {
    logger.error({ error, userId }, 'Error processing ID card photo');

    await ctx.reply(Messages.KYC_IMAGE_ERROR(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.kycCancel(),
    });

    state.waitingFor = 'kyc_id_card';
    state.lastProcessedPhotoId = undefined;
    userStates.set(userId, state);

    throw error;
  }
}

export async function saveKycData(ctx: any, userId: number, state: UserState): Promise<void> {
  const idData = state.kycIdCardData;
  const phoneNumber = state.kycPhoneNumber;
  const documentType = state.kycDocumentType || 'cccd';
  const kycImageUrl = state.kycImageUrl;

  if (!idData || !phoneNumber) {
    throw new Error('Missing KYC data');
  }

  logger.info({ userId, documentType, kycImageUrl }, 'Saving KYC data to database');

  try {
    const dob = fptAiVisionService.parseDate(idData.dob);
    const doe = fptAiVisionService.parseDate(idData.doe);

    if (!dob || !doe) {
      throw new Error('Invalid date format in ID card data');
    }

    const kycType: 'PASSPORT' | 'IDC' = documentType === 'passport' ? 'PASSPORT' : 'IDC';
    const passportNumber =
      documentType === 'passport' && idData.passport_number ? idData.passport_number : undefined;

    const home = documentType === 'passport' ? idData.pob || 'N/A' : idData.home || 'N/A';
    const address = documentType === 'passport' ? idData.pob || 'N/A' : idData.address || 'N/A';

    const idNumber = documentType === 'passport' ? idData.id_number : idData.id;

    const sexForDatabase = parseSexForDatabase(idData.sex);

    await kycService.create({
      chat_id: userId,
      phone: phoneNumber,
      type: kycType,
      id_number: idNumber,
      name: idData.name,
      dob: dob,
      sex: sexForDatabase,
      nationality: idData.nationality,
      home: home,
      address: address,
      doe: doe,
      passport_number: passportNumber,
      kyc_image: kycImageUrl,
    });

    await teleUserService.updateKycStatus(userId, true);

    logger.info({ userId }, 'KYC data saved successfully');

    userStates.delete(userId);

    await ctx.reply(Messages.KYC_SAVE_SUCCESS(idData.name, phoneNumber), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  } catch (error: any) {
    const isDuplicateError = isDuplicateKeyError(error);

    if (isDuplicateError) {
      const idNumberLast4 = idData.id ? idData.id.slice(-4) : 'unknown';
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

    logger.error({ error, userId }, 'Error saving KYC data to database');
    throw error;
  }
}
