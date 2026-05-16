import { Bot } from 'grammy';
import { Messages, Keyboards } from '../index';
import {
  getState,
  setState,
  clearState,
  processingUsers,
  newlyCreatedOrders,
  type UserState,
} from '../user-state';
import { logger } from '../../../config/logger';
import { getUserId } from './context';
import { telegramConfig } from '../../../config/app';
import paymentService from '../../paymentService';
import paymentInformationService from '../../paymentInformationService';
import teleUserService from '../../teleUserService';
import { captureErrorWithContext } from '../../../utils/sentryHelper';
import { banks } from '../../../models/webhook';
import {
  fetchExchangeRates,
  scheduleOrderTrackingCleanup,
  sendOrderNotice,
  calculateGatewayFee,
  getOrderSlots,
  setMainMsgId,
  initOrderSlots,
} from '../index';

function getPreorderSellNoticeKey(chatId?: number): string | null {
  if (!chatId) return null;
  return `preorder:${chatId}:sell`;
}

export function setupSellHandlers(bot: Bot): void {
  bot.callbackQuery('sell_usdt', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);

    try {
      logger.info({ userId }, 'Checking KYC status for sell USDC');
      const user = await teleUserService.findByChatId(userId);

      if (!user) {
        logger.warn({ userId }, 'User not found in database for sell USDC');
        await ctx.editMessageText(
          `❌ <b>Lỗi tài khoản</b>\n\n` +
            `Không tìm thấy thông tin tài khoản của bạn.\n\n` +
            `Vui lòng liên hệ support!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
        return;
      }

      if (!user.is_kyc) {
        logger.info({ userId, isKyc: user.is_kyc }, 'User attempted to sell USDC without KYC');
        await ctx.editMessageText(Messages.KYC_REQUIRED_FOR_TRADING(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.kycRequiredForTrading(),
        });
        return;
      }

      logger.info(
        { userId, isKyc: user.is_kyc },
        'User is KYC verified, proceeding with sell flow'
      );
      setState(
        userId,
        { action: 'sell' },
        { action: 'handler.state.set', chatType: ctx.chat?.type, chatId: ctx.chat?.id }
      );
      await ctx.editMessageText(Messages.SELL_SELECT_AMOUNT(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.sellAmountSelection(),
      });
    } catch (error) {
      logger.error({ error, userId }, 'Error checking KYC status for sell USDC');
      await ctx.editMessageText(
        `❌ <b>Lỗi kiểm tra KYC</b>\n\n` +
          `Không thể kiểm tra trạng thái KYC.\n\n` +
          `Vui lòng thử lại sau!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
    }
  });

  bot.callbackQuery(/^sell_amount_\d+$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const amount = ctx.callbackQuery.data.replace('sell_amount_', '');

    const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(userId, 'BANK');

    if (savedBankAccounts.length > 0) {
      setState(
        userId,
        { action: 'sell', amount },
        { action: 'handler.state.set', chatType: ctx.chat?.type, chatId: ctx.chat?.id }
      );
      await ctx.editMessageText(Messages.SELECT_SAVED_BANK_ACCOUNT(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.savedBankAccountSelection(savedBankAccounts),
      });
    } else {
      const state =
        getState(userId, {
          action: 'handler.state.get',
          chatType: ctx.chat?.type,
          chatId: ctx.chat?.id,
        }) || {};
      state.action = 'sell';
      state.amount = amount;
      state.waitingFor = 'bank_details_single';
      state.isNewPaymentInfo = true;
      setState(userId, state, {
        action: 'handler.state.set',
        chatType: ctx.chat?.type,
        chatId: ctx.chat?.id,
      });

      logger.info(
        { userId, amount },
        'Sell amount selected, showing single-input bank details prompt'
      );

      await ctx.editMessageText(Messages.ENTER_BANK_DETAILS_SINGLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    }
  });

  bot.callbackQuery('sell_custom', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    setState(
      userId,
      { action: 'sell', waitingFor: 'sell_amount' },
      { action: 'handler.state.set', chatType: ctx.chat?.type, chatId: ctx.chat?.id }
    );
    await ctx.editMessageText(Messages.ENTER_CUSTOM_AMOUNT_SELL(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  });

  bot.callbackQuery(/^select_bank_\d+$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const bankId = parseInt(ctx.callbackQuery.data.replace('select_bank_', ''));
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || state.action !== 'sell') {
      await ctx.reply(
        `❌ <b>Lỗi trạng thái</b>\n\n` + `Phiên làm việc đã hết hạn.\n\n` + `Vui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const selectedBank = banks.find((b) => b.id === bankId);
    if (!selectedBank) {
      logger.error({ userId, bankId }, 'Bank not found');
      await ctx.reply(
        `❌ <b>Lỗi ngân hàng</b>\n\n` +
          `Không tìm thấy thông tin ngân hàng.\n\n` +
          `Vui lòng thử lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    state.bankId = bankId;
    state.bankName = selectedBank.short_name;
    state.waitingFor = 'full_name';
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    logger.info({ userId, bankId, bankName: selectedBank.short_name }, 'Bank selected');

    await ctx.editMessageText(Messages.ENTER_FULL_NAME(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  });

  bot.callbackQuery(/^show_more_banks_\d+$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const offset = parseInt(ctx.callbackQuery.data.replace('show_more_banks_', ''));
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || state.action !== 'sell') {
      await ctx.reply(
        `❌ <b>Lỗi trạng thái</b>\n\n` + `Phiên làm việc đã hết hạn.\n\n` + `Vui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    state.bankPageOffset = offset;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    logger.info({ userId, offset }, 'Showing more banks');

    await ctx.editMessageText(Messages.SELECT_BANK(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.bankSelection(offset),
    });
  });

  bot.callbackQuery(/^use_saved_bank_\d+$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery().catch(() => {});
    } catch (error) {
      logger.debug({ error, userId: ctx.from.id }, 'Failed to answer callback query');
    }

    const userId = getUserId(ctx);
    const paymentInfoId = parseInt(ctx.callbackQuery.data.replace('use_saved_bank_', ''));
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || state.action !== 'sell') {
      await ctx.reply(
        `❌ <b>Lỗi trạng thái</b>\n\n` + `Phiên làm việc đã hết hạn.\n\n` + `Vui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const paymentInfo = await paymentInformationService.findById(paymentInfoId);
    if (
      !paymentInfo ||
      !paymentInfo.bank_id ||
      !paymentInfo.full_name ||
      !paymentInfo.bank_account
    ) {
      logger.error({ userId, paymentInfoId }, 'Saved bank account not found');
      const key = getPreorderSellNoticeKey(ctx.chat?.id);
      if (key) {
        await sendOrderNotice(
          ctx,
          key,
          `❌ <b>Lỗi ngân hàng</b>\n\n` +
            `Không tìm thấy thông tin ngân hàng đã lưu.\n\n` +
            `Vui lòng thử lại!`
        );
      } else {
        await ctx.reply(
          `❌ <b>Lỗi ngân hàng</b>\n\n` +
            `Không tìm thấy thông tin ngân hàng đã lưu.\n\n` +
            `Vui lòng thử lại!`,
          { parse_mode: 'HTML' }
        );
      }
      return;
    }

    const bank = banks.find((b) => b.id === paymentInfo.bank_id);
    if (!bank) {
      logger.error({ userId, bankId: paymentInfo.bank_id }, 'Bank not found');
      await ctx.reply(
        `❌ <b>Lỗi ngân hàng</b>\n\n` +
          `Không tìm thấy thông tin ngân hàng.\n\n` +
          `Vui lòng thử lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    state.bankId = paymentInfo.bank_id;
    state.bankName = bank.short_name;
    state.fullName = paymentInfo.full_name;
    state.accountNumber = paymentInfo.bank_account;
    state.paymentInfoId = paymentInfoId;
    state.waitingFor = undefined;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    logger.info({ userId, paymentInfoId, bankId: paymentInfo.bank_id }, 'Using saved bank account');

    let rates;
    try {
      rates = await fetchExchangeRates();
    } catch (error) {
      logger.error({ error, userId }, 'Failed to fetch exchange rates');
      rates = null;
    }

    if (!rates) {
      try {
        await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      } catch (error) {
        const key = getPreorderSellNoticeKey(ctx.chat?.id);
        if (key) {
          await sendOrderNotice(ctx, key, Messages.RATE_UNAVAILABLE(), Keyboards.backToMenu());
        } else {
          await ctx.reply(Messages.RATE_UNAVAILABLE(), {
            parse_mode: 'HTML',
            reply_markup: Keyboards.backToMenu(),
          });
        }
      }
      return;
    }

    const usdtAmount = parseFloat(state.amount!);
    const vndAmount = usdtAmount * rates.sell;
    const serviceFee = calculateGatewayFee(
      vndAmount,
      rates.fee_rate_sell ?? 0,
      rates.min_fee_vnd ?? 0
    );

    await ctx.editMessageText(
      Messages.SELL_CONFIRMATION(
        state.amount!,
        bank.short_name,
        paymentInfo.full_name,
        paymentInfo.bank_account,
        rates.sell,
        vndAmount,
        serviceFee
      ),
      { parse_mode: 'HTML', reply_markup: Keyboards.confirmPayment() }
    );
  });

  bot.callbackQuery('add_new_bank', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || state.action !== 'sell') {
      await ctx.reply(
        `❌ <b>Lỗi trạng thái</b>\n\n` + `Phiên làm việc đã hết hạn.\n\n` + `Vui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    state.waitingFor = 'bank_details_single';
    state.isNewPaymentInfo = true;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    logger.info({ userId }, 'User chose to add new bank account - single input mode');

    await ctx.editMessageText(Messages.ENTER_BANK_DETAILS_SINGLE(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  });
}

export async function handleSellAmountInput(
  ctx: any,
  userId: number,
  state: UserState,
  text: string
): Promise<void> {
  const amount = parseFloat(text.replace(/,/g, ''));

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply(Messages.INVALID_AMOUNT(), { parse_mode: 'HTML' });
    return;
  }

  state.amount = text.replace(/,/g, '');

  const savedBankAccounts = await paymentInformationService.findByTypeAndChatId(userId, 'BANK');

  if (savedBankAccounts.length > 0) {
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });
    await ctx.reply(Messages.SELECT_SAVED_BANK_ACCOUNT(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.savedBankAccountSelection(savedBankAccounts),
    });
  } else {
    state.waitingFor = 'bank_details_single';
    state.isNewPaymentInfo = true;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    logger.info(
      { userId, amount: state.amount },
      'Custom sell amount entered, showing single-input bank details prompt'
    );

    await ctx.reply(Messages.ENTER_BANK_DETAILS_SINGLE(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  }
}

export async function handleFullNameInput(
  ctx: any,
  userId: number,
  state: UserState,
  text: string
): Promise<void> {
  if (!text || text.length < 2) {
    await ctx.reply(Messages.INVALID_FULL_NAME(), { parse_mode: 'HTML' });
    return;
  }

  state.fullName = text;
  state.waitingFor = 'account_number';
  setState(userId, state, {
    action: 'handler.state.set',
    chatType: ctx.chat?.type,
    chatId: ctx.chat?.id,
  });

  logger.info({ userId, fullName: text }, 'Full name entered');

  await ctx.reply(Messages.ENTER_ACCOUNT_NUMBER(), { parse_mode: 'HTML' });
}

export async function handleAccountNumberInput(
  ctx: any,
  userId: number,
  state: UserState,
  text: string
): Promise<void> {
  if (!/^\d+$/.test(text)) {
    await ctx.reply(Messages.INVALID_ACCOUNT_NUMBER(), { parse_mode: 'HTML' });
    return;
  }

  state.accountNumber = text;
  state.waitingFor = undefined;

  logger.info({ userId, accountNumber: text }, 'Account number entered');

  if (!state.amount || !state.bankName || !state.fullName || !state.bankId) {
    logger.error({ userId, state }, 'Missing required fields for sell confirmation');
    await ctx.reply(
      `❌ <b>Lỗi thông tin</b>\n\n` +
        `Thiếu thông tin cần thiết để xác nhận giao dịch.\n\n` +
        `Vui lòng bắt đầu lại!`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (state.isNewPaymentInfo) {
    try {
      const exists = await paymentInformationService.bankAccountExists(userId, state.bankId, text);
      if (!exists) {
        await paymentInformationService.createPaymentInfo({
          chat_id: userId,
          type: 'BANK',
          bank_id: state.bankId,
          full_name: state.fullName,
          bank_account: text,
        });
        logger.info(
          { userId, bankId: state.bankId, accountNumber: text },
          'Saved new bank account'
        );
      } else {
        logger.info(
          { userId, bankId: state.bankId, accountNumber: text },
          'Bank account already exists, skipping save'
        );
      }
    } catch (error) {
      logger.error(
        { userId, bankId: state.bankId, accountNumber: text, error },
        'Error saving bank account'
      );
    }
    state.isNewPaymentInfo = false;
  }

  setState(userId, state, {
    action: 'handler.state.set',
    chatType: ctx.chat?.type,
    chatId: ctx.chat?.id,
  });

  let rates;
  try {
    rates = await fetchExchangeRates();
  } catch (error) {
    logger.error({ error, userId }, 'Failed to fetch exchange rates');
    rates = null;
  }

  if (!rates) {
    await ctx.reply(Messages.RATE_UNAVAILABLE(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
    return;
  }

  const usdtAmount = parseFloat(state.amount);
  const vndAmount = usdtAmount * rates.sell;
  const serviceFee = calculateGatewayFee(
    vndAmount,
    rates.fee_rate_sell ?? 0,
    rates.min_fee_vnd ?? 0
  );

  await ctx.reply(
    Messages.SELL_CONFIRMATION(
      state.amount,
      state.bankName,
      state.fullName,
      text,
      rates.sell,
      vndAmount,
      serviceFee
    ),
    { parse_mode: 'HTML', reply_markup: Keyboards.confirmPayment() }
  );
}

export async function handleBankDetailsSingleInput(
  ctx: any,
  userId: number,
  state: UserState,
  text: string
): Promise<void> {
  const parts = text.split(',').map((part: string) => part.trim());

  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    await ctx.reply(Messages.INVALID_BANK_DETAILS_FORMAT(), { parse_mode: 'HTML' });
    return;
  }

  const bankNameInput = parts[0];
  const fullNameInput = parts[1];
  const accountNumberInput = parts[2];

  if (/\d/.test(bankNameInput)) {
    await ctx.reply(Messages.INVALID_BANK_NAME_HAS_NUMBERS(), { parse_mode: 'HTML' });
    return;
  }

  if (/\d/.test(fullNameInput)) {
    await ctx.reply(Messages.INVALID_FULL_NAME_HAS_NUMBERS(), { parse_mode: 'HTML' });
    return;
  }

  if (fullNameInput.length < 2) {
    await ctx.reply(Messages.INVALID_FULL_NAME(), { parse_mode: 'HTML' });
    return;
  }

  if (!/^\d+$/.test(accountNumberInput)) {
    await ctx.reply(Messages.INVALID_ACCOUNT_NUMBER(), { parse_mode: 'HTML' });
    return;
  }

  const bankNameUpper = bankNameInput.toUpperCase();
  const fullNameUpper = fullNameInput.toUpperCase();

  const bank = banks.find(
    (b) =>
      b.short_name.toUpperCase() === bankNameUpper ||
      b.bank_name.toUpperCase().includes(bankNameUpper) ||
      b.cvpay_code.toUpperCase() === bankNameUpper
  );

  if (!bank) {
    logger.warn({ userId, bankNameInput: bankNameUpper }, 'Bank not found');
    await ctx.reply(Messages.BANK_NOT_FOUND(), { parse_mode: 'HTML' });
    return;
  }

  state.bankId = bank.id;
  state.bankName = bank.short_name;
  state.fullName = fullNameUpper;
  state.accountNumber = accountNumberInput;
  state.waitingFor = undefined;

  logger.info(
    { userId, bankId: bank.id, bankName: bank.short_name, fullName: fullNameUpper },
    'Bank details parsed successfully from single input'
  );

  if (state.isNewPaymentInfo) {
    try {
      const exists = await paymentInformationService.bankAccountExists(
        userId,
        bank.id,
        accountNumberInput
      );
      if (!exists) {
        await paymentInformationService.createPaymentInfo({
          chat_id: userId,
          type: 'BANK',
          bank_id: bank.id,
          full_name: fullNameUpper,
          bank_account: accountNumberInput,
        });
        logger.info(
          { userId, bankId: bank.id, accountNumber: accountNumberInput },
          'Saved new bank account from single input'
        );
      } else {
        logger.info(
          { userId, bankId: bank.id, accountNumber: accountNumberInput },
          'Bank account already exists, skipping save'
        );
      }
    } catch (error) {
      logger.error(
        { userId, bankId: bank.id, accountNumber: accountNumberInput, error },
        'Error saving bank account from single input'
      );
    }
    state.isNewPaymentInfo = false;
  }

  if (!state.amount) {
    clearState(userId, {
      action: 'handler.state.clear',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });
    await ctx.reply(
      `✅ <b>ĐÃ LƯU TÀI KHOẢN NGÂN HÀNG</b>\n\n` +
        `Tài khoản ngân hàng đã được lưu thành công!\n\n` +
        `🏛️ Ngân hàng: <b>${bank.short_name}</b>\n` +
        `👤 Chủ TK: <b>${fullNameUpper}</b>\n` +
        `💳 Số TK: <code>${accountNumberInput}</code>`,
      { parse_mode: 'HTML', reply_markup: await Keyboards.mainMenu(userId) }
    );
    return;
  }

  setState(userId, state, {
    action: 'handler.state.set',
    chatType: ctx.chat?.type,
    chatId: ctx.chat?.id,
  });

  let rates;
  try {
    rates = await fetchExchangeRates();
  } catch (error) {
    logger.error({ error, userId }, 'Failed to fetch exchange rates');
    rates = null;
  }

  if (!rates) {
    await ctx.reply(Messages.RATE_UNAVAILABLE(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
    return;
  }

  const usdtAmount = parseFloat(state.amount);
  const vndAmount = usdtAmount * rates.sell;
  const serviceFee = calculateGatewayFee(
    vndAmount,
    rates.fee_rate_sell ?? 0,
    rates.min_fee_vnd ?? 0
  );

  await ctx.reply(
    Messages.SELL_CONFIRMATION(
      state.amount,
      bank.short_name,
      fullNameUpper,
      accountNumberInput,
      rates.sell,
      vndAmount,
      serviceFee
    ),
    { parse_mode: 'HTML', reply_markup: Keyboards.confirmPayment() }
  );
}

export async function handleSellConfirmation(
  ctx: any,
  userId: number,
  state: UserState
): Promise<void> {
  if (processingUsers.has(userId)) {
    logger.warn({ userId }, 'User is already processing an order, ignoring duplicate request');
    await ctx.answerCallbackQuery('⏳ Đơn hàng đang được xử lý, vui lòng đợi...');
    return;
  }

  if (!state.amount || !state.bankId || !state.fullName || !state.accountNumber) {
    logger.error({ userId, state }, 'Missing required fields for sell confirmation');
    await ctx.reply(
      `❌ <b>Lỗi thông tin</b>\n\n` +
        `Thiếu thông tin cần thiết để xác nhận giao dịch.\n\n` +
        `Vui lòng bắt đầu lại!`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  processingUsers.add(userId);
  logger.info({ userId }, 'User marked as processing order');

  try {
    logger.info(
      {
        userId,
        amount: state.amount,
        bankId: state.bankId,
        bankName: state.bankName,
        fullName: state.fullName,
        accountNumber: state.accountNumber,
      },
      'Processing sell order with complete payment info'
    );

    logger.info({ userId }, 'Calling withdrawal API');

    const order = await paymentService.processWithdrawal({
      chat_id: userId,
      amount: state.amount,
      chain_id: 57,
      asset_code: 'USDC',
      token_address: telegramConfig.tokenAddress,
      callback: telegramConfig.callbackUrl,
      payment_info: {
        bank_id: String(state.bankId),
        full_name: state.fullName,
        account_type: 0,
        account_number: state.accountNumber,
      },
    });

    logger.info(
      {
        userId,
        orderId: order.id,
        hasPayData: !!order.pay_data,
        hasAddress: !!order.pay_data?.address,
        recipient: order.recipient,
      },
      'Withdrawal order created successfully'
    );

    newlyCreatedOrders.add(order.id);
    logger.info({ orderId: order.id }, 'Order added to tracking set');

    setTimeout(() => {
      newlyCreatedOrders.delete(order.id);
      logger.debug({ orderId: order.id }, 'Removed order from newly created tracking set');
    }, 30000);

    state.orderId = order.id;
    clearState(userId, {
      action: 'handler.state.clear',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    let recipientAddress: string | undefined;
    if (order.pay_data?.address) {
      recipientAddress = order.pay_data.address;
    } else if (order.recipient) {
      recipientAddress = order.recipient;
    }

    if (recipientAddress) {
      logger.info(
        { userId, orderId: order.id, paymentCode: order.code, recipientAddress },
        'Processing payment details for sell order'
      );

      const currentMsgId = ctx.callbackQuery?.message?.message_id;
      if (currentMsgId && ctx.chat?.id) {
        if (!getOrderSlots(order.id)) {
          initOrderSlots(order.id, ctx.chat.id);
        }
        setMainMsgId(order.id, currentMsgId);
      }

      const caption = Messages.PAYMENT_SELL_ADDRESS(
        recipientAddress,
        state.amount,
        order.code ?? '',
        order.net_vnd,
        state.bankName,
        state.accountNumber,
        state.fullName
      );

      const chatId = ctx.chat?.id;
      const slots = getOrderSlots(order.id);

      if (slots?.mainMsgId && chatId) {
        logger.info(
          { orderId: order.id, mainMsgId: slots.mainMsgId },
          'Editing existing message with payment details and reply markup'
        );
        await ctx.api.editMessageText(chatId, slots.mainMsgId, caption, {
          parse_mode: 'HTML',
        });
        await ctx.api.editMessageReplyMarkup(chatId, slots.mainMsgId, {
          reply_markup: Keyboards.qrCodeWithCancel(order.id),
        });
        logger.info({ userId, orderId: order.id }, 'Message updated with cancel button');
      } else {
        logger.info({ orderId: order.id }, 'No existing message ID, sending new message');
        await ctx.reply(caption, {
          parse_mode: 'HTML',
          replyMarkup: Keyboards.qrCodeWithCancel(order.id),
        });
      }

      await ctx.reply(Messages.ORDER_STATE_CREATED(order.id), {
        parse_mode: 'HTML',
      });
      logger.info({ userId, orderId: order.id }, 'Order created notification sent');

      scheduleOrderTrackingCleanup(order.id);
    } else {
      logger.error(
        {
          userId,
          orderId: order.id,
          pay_data: order.pay_data,
          recipient: order.recipient,
          body: order.body,
        },
        'No recipient address found in any expected field'
      );
      await sendOrderNotice(
        ctx,
        order.id,
        `❌ <b>Lỗi hệ thống</b>\n\n` +
          `Không tìm thấy địa chỉ ví nhận USDC trong phản hồi từ hệ thống.\n\n` +
          `Mã đơn: <code>${order.id}</code>\n\n` +
          `Vui lòng liên hệ support với mã đơn hàng trên để được hỗ trợ!`,
        Keyboards.backToMenu()
      );
    }
  } catch (error) {
    captureErrorWithContext(error, {
      userId,
      action: 'handleSellConfirmation',
      amount: state.amount,
      bankId: state.bankId,
      accountNumber: state.accountNumber,
    });
    throw error;
  } finally {
    processingUsers.delete(userId);
    logger.info({ userId }, 'User removed from processing set');
  }
}
