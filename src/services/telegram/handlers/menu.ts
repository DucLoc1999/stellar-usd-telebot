import { Bot } from 'grammy';
import { Messages, Keyboards } from '../index';
import teleUserService from '../../teleUserService';
import paymentInformationService from '../../paymentInformationService';
import kycService from '../../kycService';
import referralService from '../../referralService';
import { userStates } from '../user-state';
import { logger } from '../../../config/logger';

export function setupMenuHandlers(bot: Bot): void {
  bot.command('start', async (ctx) => {
    try {
      const chatId = ctx.chat?.id;
      const firstName = ctx.from?.first_name;
      const lastName = ctx.from?.last_name;
      const username = ctx.from?.username;

      if (!chatId || !firstName) {
        logger.error({ chatId, firstName }, 'Missing required user information in /start command');
        await ctx.reply(
          `❌ <b>Lỗi khởi tạo</b>\n\n` +
            `Không thể lấy thông tin tài khoản của bạn.\n\n` +
            `Vui lòng thử lại hoặc liên hệ support!`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      const referralUsername = ctx.match ? ctx.match.trim() : null;

      logger.info(
        { chatId, firstName, lastName, username, referralUsername },
        'Processing /start command'
      );

      const existingUser = await teleUserService.findByChatId(chatId);
      const isNewUser = !existingUser;

      let referralToSave: number | undefined = undefined;

      if (isNewUser && referralUsername) {
        const referrer = await teleUserService.findByUsername(referralUsername);

        if (referrer) {
          logger.info(
            { chatId, referralUsername, referrerChatId: referrer.chat_id },
            'New user referred by existing user'
          );
          referralToSave = referrer.chat_id;
          await teleUserService.incrementReferralCount(referrer.chat_id);
          logger.info(
            { referrerChatId: referrer.chat_id, referralUsername },
            'Incremented referral count for referrer'
          );

          await referralService.createReferral({ chat_id: chatId, referral: referrer.chat_id });
          logger.info(
            { referredUserId: chatId, referrerId: referrer.chat_id },
            'Referral record saved'
          );
        } else {
          logger.warn({ chatId, referralUsername }, 'Referral username not found in database');
        }
      }

      await teleUserService.upsertUser({
        chat_id: chatId,
        first_name: firstName,
        last_name: lastName,
        username: username ?? '',
        referral: referralToSave,
      });

      logger.info({ chatId, isNewUser }, 'User information updated successfully');

      await ctx.reply(Messages.WELCOME(firstName), {
        parse_mode: 'HTML',
        reply_markup: await Keyboards.mainMenu(chatId),
      });
    } catch (error) {
      logger.error({ error }, 'Error handling /start command');
      await ctx.reply(
        `❌ <b>Lỗi hệ thống</b>\n\n` +
          `Có lỗi xảy ra khi khởi động bot.\n\n` +
          `Vui lòng thử lại sau!`,
        { parse_mode: 'HTML' }
      );
    }
  });

  bot.callbackQuery('check_rate', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const { fetchExchangeRates } = await import('../utils');
      const rates = await fetchExchangeRates();
      if (rates) {
        const updated = new Date(rates.created_at).toLocaleString('vi-VN');
        await ctx.editMessageText(Messages.RATE_CHECK(rates.sell, rates.buy, updated), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      } else {
        await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      }
    } catch (error) {
      await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    }
  });

  bot.callbackQuery('contact_support', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const supportMessage =
      `📞 <b>LIÊN HỆ SUPPORT</b>\n\n` +
      `Vui lòng liên hệ với đội ngũ hỗ trợ của chúng tôi:\n\n` +
      `💬 Telegram: @usdt247shopsupport\n\n` +
      `Chúng tôi sẽ hỗ trợ bạn trong thời gian sớm nhất!`;
    await ctx.editMessageText(supportMessage, {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  });

  bot.callbackQuery('referral', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const chatId = ctx.from.id;
      const username = ctx.from.username;

      if (!username) {
        await ctx.editMessageText(
          `❌ <b>Không thể tạo link giới thiệu</b>\n\n` +
            `Bạn cần có username Telegram để sử dụng tính năng này.\n\n` +
            `Vui lòng thiết lập username trong cài đặt Telegram và thử lại!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
        return;
      }

      const referralCount = await teleUserService.getReferralCount(chatId);
      const botInfo = await ctx.api.getMe();
      const botUsername = botInfo.username;

      logger.info({ chatId, username, referralCount }, 'User viewed referral information');

      await ctx.editMessageText(Messages.REFERRAL_INFO(username, referralCount, botUsername), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    } catch (error) {
      logger.error({ error }, 'Error showing referral information');
      await ctx.editMessageText(
        `❌ <b>Lỗi hệ thống</b>\n\n` +
          `Không thể hiển thị thông tin giới thiệu.\n\n` +
          `Vui lòng thử lại sau!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
    }
  });

  bot.callbackQuery('bank_accounts', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        logger.error('Missing chat ID in bank_accounts callback');
        await ctx.editMessageText(
          `❌ <b>Lỗi hệ thống</b>\n\n` +
            `Không thể xác định tài khoản của bạn.\n\n` +
            `Vui lòng thử lại!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
        return;
      }

      const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(chatId, 'BANK');
      logger.info(
        { chatId, bankAccountsCount: savedBankAccounts.length },
        'Bank accounts retrieved'
      );

      let message = `🏦 <b>NGÂN HÀNG ĐÃ LƯU</b>\n\n`;

      if (savedBankAccounts.length === 0) {
        message += `❌ Bạn chưa lưu tài khoản ngân hàng nào.\n\n`;
        message += `💡 Nhấn "➕ Thêm mới" để thêm tài khoản ngân hàng.`;
        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          reply_markup: Keyboards.bankAccountsList([]),
        });
      } else {
        savedBankAccounts.forEach((account, index) => {
          const { banks } = require('../../models/webhook');
          const bank = banks.find((b: any) => b.id === account.bank_id);
          const bankName = bank ? bank.short_name : account.bank_id?.toString() || 'N/A';
          message += `<b>${index + 1}. ${account.full_name || 'N/A'}</b>\n`;
          message += `   🏛️ Ngân hàng: ${bankName}\n`;
          message += `   💳 Số TK: <code>${account.bank_account || 'N/A'}</code>\n\n`;
        });
        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          reply_markup: Keyboards.bankAccountsList(savedBankAccounts),
        });
      }
    } catch (error) {
      logger.error({ error }, 'Error fetching bank accounts');
      await ctx.editMessageText(
        `❌ <b>Lỗi tải dữ liệu</b>\n\n` +
          `Không thể tải danh sách ngân hàng.\n\n` +
          `Vui lòng thử lại sau!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
    }
  });

  bot.callbackQuery('crypto_wallets', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        logger.error('Missing chat ID in crypto_wallets callback');
        await ctx.editMessageText(
          `❌ <b>Lỗi hệ thống</b>\n\n` +
            `Không thể xác định tài khoản của bạn.\n\n` +
            `Vui lòng thử lại!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
        return;
      }

      const savedWallets = await paymentInformationService.findByTypeAndChatId(chatId, 'CRYPTO');
      logger.info({ chatId, walletsCount: savedWallets.length }, 'Crypto wallets retrieved');

      let message = `💎 <b>VÍ CRYPTO ĐÃ LƯU</b>\n\n`;

      if (savedWallets.length === 0) {
        message += `❌ Bạn chưa lưu địa chỉ ví crypto nào.\n\n`;
        message += `💡 Nhấn "➕ Thêm mới" để thêm địa chỉ ví.`;
        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          reply_markup: Keyboards.cryptoWalletsList([]),
        });
      } else {
        savedWallets.forEach((wallet, index) => {
          message += `<b>${index + 1}. Ví ${index + 1}</b>\n`;
          message += `📮 Địa chỉ: <code>${wallet.wallet_address || 'N/A'}</code>\n\n`;
        });
        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          reply_markup: Keyboards.cryptoWalletsList(savedWallets),
        });
      }
    } catch (error) {
      logger.error({ error }, 'Error fetching crypto wallets');
      await ctx.editMessageText(
        `❌ <b>Lỗi tải dữ liệu</b>\n\n` +
          `Không thể tải danh sách ví crypto.\n\n` +
          `Vui lòng thử lại sau!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
    }
  });

  bot.callbackQuery('account_info', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const chatId = ctx.chat?.id;
      if (!chatId) {
        logger.error('Missing chat ID in account_info callback');
        await ctx.editMessageText(
          `❌ <b>Lỗi hệ thống</b>\n\n` +
            `Không thể xác định tài khoản của bạn.\n\n` +
            `Vui lòng thử lại!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
        return;
      }

      const teleUser = await teleUserService.findByChatId(chatId);
      if (!teleUser) {
        logger.warn({ chatId }, 'User not found in database');
        await ctx.editMessageText(
          `❌ <b>Không tìm thấy thông tin</b>\n\n` +
            `Không tìm thấy thông tin tài khoản của bạn trong hệ thống.\n\n` +
            `Vui lòng thử lại hoặc liên hệ support!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
        return;
      }

      const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(chatId, 'BANK');
      const savedWallets = await paymentInformationService.findByTypeAndChatId(chatId, 'CRYPTO');

      let phoneNumber: string | null = null;
      if (teleUser.is_kyc) {
        const kycRecord = await kycService.findByChatId(chatId);
        if (kycRecord) phoneNumber = kycRecord.phone;
      }

      await ctx.editMessageText(
        Messages.ACCOUNT_INFO(
          teleUser.chat_id,
          teleUser.first_name || 'N/A',
          teleUser.last_name ?? null,
          teleUser.username || '',
          teleUser.is_kyc ?? false,
          savedBankAccounts,
          savedWallets,
          phoneNumber
        ),
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
    } catch (error) {
      logger.error({ error }, 'Error fetching user information');
      await ctx.editMessageText(
        `❌ <b>Lỗi tải thông tin</b>\n\n` +
          `Không thể tải thông tin tài khoản.\n\n` +
          `Vui lòng thử lại sau!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
    }
  });

  bot.callbackQuery('back_to_menu', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;
    userStates.delete(userId);
    const firstName = ctx.from?.first_name || 'bạn';
    await ctx.editMessageText(Messages.WELCOME(firstName), {
      parse_mode: 'HTML',
      reply_markup: await Keyboards.mainMenu(userId),
    });
  });
}
