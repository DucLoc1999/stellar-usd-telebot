import { Bot, InputFile } from 'grammy';
import * as StellarSdk from 'stellar-sdk';
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
import { buildTrustlineLinks } from '../trustline';
import {
  generateQRCode,
  generateTrustlineQR,
  scheduleOrderTrackingCleanup,
  getOrderSlots,
  setMainMsgId,
  initOrderSlots,
  sendNotifyMessage,
  sendOrderNotice,
  calculateGatewayFee,
} from '../index';
import { messageDelay } from '../utils';

type TrustlineCheckResult = {
  valid: boolean;
  reason?: 'missing' | 'unauthorized' | 'wallet_not_found' | 'network_error';
};

async function fetchQrImage(url: string, timeoutMs = 10000): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);
  if (!response.ok) {
    throw new Error(`Failed to fetch QR image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

const ACTIVATION_XLM_AMOUNT = process.env.ACTIVATION_XLM_AMOUNT || '5';

let stellarServer: StellarSdk.Horizon.Server | null = null;

function getStellarServer(): StellarSdk.Horizon.Server {
  if (!stellarServer) {
    stellarServer = new StellarSdk.Horizon.Server(telegramConfig.horizonUrl);
  }
  return stellarServer;
}

function extractProviderMessage(errorMessage: string): string | null {
  const jsonStart = errorMessage.indexOf('{');
  if (jsonStart < 0) return null;
  try {
    const payload = JSON.parse(errorMessage.slice(jsonStart)) as { message?: string };
    return payload.message ?? null;
  } catch {
    return null;
  }
}

async function checkUsdcTrustline(walletAddress: string): Promise<TrustlineCheckResult> {
  try {
    const server = getStellarServer();
    const account = await server.accounts().accountId(walletAddress).call();

    const trustline = account.balances.find(
      (balance: any) =>
        balance.asset_type !== 'native' &&
        balance.asset_code === 'USDC' &&
        balance.asset_issuer === telegramConfig.tokenAddress
    ) as any;

    if (!trustline) return { valid: false, reason: 'missing' };
    if (trustline.is_authorized === false) return { valid: false, reason: 'unauthorized' };
    return { valid: true };
  } catch (error: any) {
    if (error.response?.status === 404) return { valid: false, reason: 'wallet_not_found' };
    logger.error({ error, walletAddress }, 'Error checking trustline');
    return { valid: false, reason: 'network_error' };
  }
}

async function handleTrustlineFailure(
  ctx: any,
  state: UserState,
  trustlineCheck: TrustlineCheckResult,
  walletAddress: string
): Promise<void> {
  const preorderKey = getPreorderBuyNoticeKey(ctx.chat?.id);

  if (trustlineCheck.reason === 'missing') {
    const assetCode = state.assetCode || telegramConfig.tokenCode || 'USDC';
    const links = await buildTrustlineLinks(walletAddress, assetCode, telegramConfig.tokenAddress);
    const msg =
      `${Messages.TRUSTLINE_REQUIRED(assetCode, telegramConfig.tokenAddress)}\n\n` +
      `<b>Sau khi mở Stellar Lab:</b>\n` +
      `1. Chọn <b>Sign with wallet</b>\n` +
      `2. Chọn <b>Submit transaction</b>`;
    // `<b>Import XDR thủ công (nếu cần):</b>\n` +
    // `<code>${links.xdr}</code>`;

    const kb = Keyboards.trustlineActions(links.webSignUrl, links.viewUrl);
    const qrBuffer = await generateTrustlineQR(links.xdr);
    await ctx.replyWithPhoto(new InputFile(qrBuffer), {
      caption: msg,
      parse_mode: 'HTML',
      reply_markup: kb,
    });
    return;
  }

  if (trustlineCheck.reason === 'unauthorized') {
    const msg =
      `⚠️ <b>Trustline chưa được ủy quyền</b>\n\n` +
      `Trustline cho USDC trên ví của bạn chưa được ủy quyền nhận token.\n\n` +
      `Vui lòng liên hệ hỗ trợ để được hướng dẫn thêm.`;
    if (preorderKey) {
      await sendOrderNotice(ctx, preorderKey, msg);
    } else {
      await ctx.reply(msg, { parse_mode: 'HTML' });
    }
    return;
  }

  if (trustlineCheck.reason === 'wallet_not_found') {
    const msg =
      `⚠️ <b>Ví Stellar chưa được kích hoạt</b>\n\n` +
      `Ví này chưa tồn tại trên mạng Stellar và chưa thể nhận USDC.\n\n` +
      `📮 Ví: <code>${walletAddress}</code>\n\n` +
      `Bạn có thể kích hoạt ví bằng cách nạp <b>${ACTIVATION_XLM_AMOUNT} XLM</b>.`;

    state.activationRecipientWallet = walletAddress;
    state.activationXlmAmount = ACTIVATION_XLM_AMOUNT;
    setState(getUserId(ctx), state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (preorderKey) {
      await sendOrderNotice(ctx, preorderKey, msg, Keyboards.activateWalletOffer());
    } else {
      try {
        await ctx.editMessageText(msg, {
          parse_mode: 'HTML',
          reply_markup: Keyboards.activateWalletOffer(),
        });
      } catch {
        await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: Keyboards.activateWalletOffer() });
      }
    }
    return;
  }

  // network_error
  const msg =
    `⚠️ <b>Lỗi kết nối mạng Stellar</b>\n\n` +
    `Không thể kết nối đến mạng lưới Stellar để kiểm tra trustline.\n\n` +
    `Nguyên nhân có thể:\n` +
    `• Mạng Stellar đang bận hoặc bảo trì\n` +
    `• Kết nối internet của bạn không ổn định\n\n` +
    `Vui lòng thử lại sau vài phút.`;
  if (preorderKey) {
    await sendOrderNotice(ctx, preorderKey, msg);
  } else {
    await ctx.reply(msg, { parse_mode: 'HTML' });
  }
}

const WALLET_INVALID_TTL_MS = 10 * 60 * 1000;

interface TimedWalletAttempt {
  attempts: number;
  expiresAt: number;
}

const walletInvalidAttempts = new Map<number, TimedWalletAttempt>();

function incrementWalletAttempts(userId: number): number {
  const timed = walletInvalidAttempts.get(userId);
  const attempts = timed ? timed.attempts : 0;
  walletInvalidAttempts.set(userId, {
    attempts: attempts + 1,
    expiresAt: Date.now() + WALLET_INVALID_TTL_MS,
  });
  return attempts + 1;
}

function clearWalletAttempts(userId: number): void {
  walletInvalidAttempts.delete(userId);
}

function getPreorderBuyNoticeKey(chatId?: number): string | null {
  if (!chatId) return null;
  return `preorder:${chatId}:buy`;
}

export function setupBuyHandlers(bot: Bot): void {
  bot.callbackQuery('trade_usdc', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.editMessageText(Messages.TRADE_MENU('USDC'), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.tradeUsdcMenu(),
    });
  });

  bot.callbackQuery('trade_xlm', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.editMessageText(Messages.TRADE_MENU('XLM'), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.tradeXlmMenu(),
    });
  });

  bot.callbackQuery('activate_wallet_confirm_prompt', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || !state.activationRecipientWallet) {
      await ctx.reply(Messages.RATE_UNAVAILABLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
      return;
    }

    const [xlmRate, usdcRate] = await Promise.all([
      paymentService.getXlmRate(),
      paymentService.getRate(),
    ]);
    if (!xlmRate || !usdcRate) {
      await ctx.reply(Messages.RATE_UNAVAILABLE(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
      return;
    }

    const xlmAmount = state.activationXlmAmount || ACTIVATION_XLM_AMOUNT;
    const vndAmount = parseFloat(xlmAmount) * xlmRate;
    const feeRate = usdcRate.fee_rate_buy ?? 0;
    const activationFee = calculateGatewayFee(vndAmount, feeRate, usdcRate.min_fee_vnd);
    const activationVndTotal = vndAmount + activationFee;
    state.action = 'activate_wallet';
    state.activationRate = xlmRate;
    state.activationFee = activationFee;
    state.activationVndTotal = activationVndTotal;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    const summaryMsg = Messages.ACTIVATE_WALLET_SUMMARY(
      state.activationRecipientWallet,
      xlmAmount,
      xlmRate,
      activationVndTotal,
      activationFee
    );
    try {
      await ctx.editMessageText(summaryMsg, {
        parse_mode: 'HTML',
        reply_markup: Keyboards.confirmActivateWallet(),
      });
    } catch {
      await ctx.reply(summaryMsg, {
        parse_mode: 'HTML',
        reply_markup: Keyboards.confirmActivateWallet(),
      });
    }
  });

  bot.callbackQuery('confirm_activate_wallet', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || state.action !== 'activate_wallet' || !state.activationRecipientWallet) {
      await ctx.reply(
        `❌ <b>Lỗi trạng thái</b>\n\nPhiên kích hoạt ví đã hết hạn.\n\nVui lòng bắt đầu lại!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
      return;
    }

    try {
      await handleWalletActivationConfirmation(ctx, userId, state);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const providerMessage = extractProviderMessage(errorMessage);
      logger.error(
        {
          userId,
          flow: 'activate_wallet',
          assetCode: 'XLM',
          recipient: state.activationRecipientWallet,
          chainId: telegramConfig.chainId,
          providerMessage,
          error: errorMessage,
        },
        'Wallet activation confirmation failed'
      );

      if (
        errorMessage.includes('RECIPIENT_TRUSTLINE_INSUFFICIENT_LIMIT') ||
        providerMessage === 'RECIPIENT_TRUSTLINE_INSUFFICIENT_LIMIT'
      ) {
        await ctx.reply(
          `⚠️ <b>Không thể kích hoạt ví tự động</b>\n\n` +
            `Hệ thống thanh toán trả về lỗi trustline/limit cho ví nhận.\n\n` +
            `Vui lòng nạp XLM thủ công vào ví, sau đó thử mua USDC lại hoặc liên hệ hỗ trợ.`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
      } else if (errorMessage.includes('API error')) {
        await ctx.reply(
          `❌ <b>Lỗi kết nối</b>\n\n` +
            `Không thể kết nối đến hệ thống thanh toán.\n` +
            `Vui lòng thử lại sau ít phút!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
      } else {
        await ctx.reply(
          `❌ <b>Có lỗi xảy ra</b>\n\n` +
            `Chi tiết: ${errorMessage}\n\n` +
            `Vui lòng thử lại hoặc liên hệ support!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
      }
    }
  });

  bot.callbackQuery('cancel_activate_wallet', async (ctx) => {
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

  bot.callbackQuery('buy_usdc', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);

    try {
      logger.info({ userId }, 'Checking KYC status for buy USDC');
      const user = await teleUserService.findByChatId(userId);

      if (!user) {
        logger.warn({ userId }, 'User not found in database for buy USDC');
        await ctx.editMessageText(
          `❌ <b>Lỗi tài khoản</b>\n\n` +
            `Không tìm thấy thông tin tài khoản của bạn.\n\n` +
            `Vui lòng liên hệ support!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
        return;
      }

      if (!user.is_kyc) {
        logger.info({ userId, isKyc: user.is_kyc }, 'User attempted to buy USDC without KYC');
        await ctx.editMessageText(Messages.KYC_REQUIRED_FOR_TRADING(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.kycRequiredForTrading(),
        });
        return;
      }

      logger.info({ userId, isKyc: user.is_kyc }, 'User is KYC verified, proceeding with buy flow');
      setState(
        userId,
        { action: 'buy', assetCode: telegramConfig.tokenCode || 'USDC' },
        { action: 'handler.state.set', chatType: ctx.chat?.type, chatId: ctx.chat?.id }
      );
      await ctx.editMessageText(Messages.BUY_SELECT_AMOUNT('USDC'), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.buyAmountSelection('USDC'),
      });
    } catch (error) {
      logger.error({ error, userId }, 'Error checking KYC status for buy USDC');
      await ctx.editMessageText(
        `❌ <b>Lỗi kiểm tra KYC</b>\n\n` +
          `Không thể kiểm tra trạng thái KYC.\n\n` +
          `Vui lòng thử lại sau!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
    }
  });

  bot.callbackQuery('buy_xlm', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);

    try {
      logger.info({ userId }, 'Checking KYC status for buy XLM');
      const user = await teleUserService.findByChatId(userId);

      if (!user) {
        logger.warn({ userId }, 'User not found in database for buy XLM');
        await ctx.editMessageText(
          `❌ <b>Lỗi tài khoản</b>\n\n` +
            `Không tìm thấy thông tin tài khoản của bạn.\n\n` +
            `Vui lòng liên hệ support!`,
          { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
        );
        return;
      }

      if (!user.is_kyc) {
        logger.info({ userId, isKyc: user.is_kyc }, 'User attempted to buy XLM without KYC');
        await ctx.editMessageText(Messages.KYC_REQUIRED_FOR_TRADING(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.kycRequiredForTrading(),
        });
        return;
      }

      logger.info(
        { userId, isKyc: user.is_kyc },
        'User is KYC verified, proceeding with buy XLM flow'
      );
      setState(
        userId,
        { action: 'buy', assetCode: 'XLM' },
        { action: 'handler.state.set', chatType: ctx.chat?.type, chatId: ctx.chat?.id }
      );
      await ctx.editMessageText(Messages.BUY_SELECT_AMOUNT('XLM'), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.buyAmountSelection('XLM'),
      });
    } catch (error) {
      logger.error({ error, userId }, 'Error checking KYC status for buy XLM');
      await ctx.editMessageText(
        `❌ <b>Lỗi kiểm tra KYC</b>\n\n` +
          `Không thể kiểm tra trạng thái KYC.\n\n` +
          `Vui lòng thử lại sau!`,
        { parse_mode: 'HTML', reply_markup: Keyboards.backToMenu() }
      );
    }
  });

  bot.callbackQuery(/^buy_amount_\d+$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const amount = ctx.callbackQuery.data.replace('buy_amount_', '');
    const currentState = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });
    const assetCode = currentState?.assetCode || 'USDC';

    const savedWallets = await paymentInformationService.findByTypeAndChatId(userId, 'CRYPTO');

    if (savedWallets.length > 0) {
      setState(
        userId,
        { action: 'buy', assetCode, amount },
        { action: 'handler.state.set', chatType: ctx.chat?.type, chatId: ctx.chat?.id }
      );
      await ctx.editMessageText(Messages.SELECT_SAVED_WALLET(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.savedWalletSelection(savedWallets),
      });
    } else {
      setState(
        userId,
        {
          action: 'buy',
          assetCode,
          amount,
          waitingFor: 'wallet',
          isNewPaymentInfo: true,
        },
        { action: 'handler.state.set', chatType: ctx.chat?.type, chatId: ctx.chat?.id }
      );
      await ctx.editMessageText(Messages.ENTER_WALLET_ADDRESS(assetCode), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    }
  });

  bot.callbackQuery('buy_custom', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const currentState = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });
    const assetCode = currentState?.assetCode || 'USDC';
    const feeConfig = await paymentService.getFeeConfig(assetCode);
    const minAmount =
      feeConfig?.min_order_amount ??
      (assetCode === 'XLM'
        ? parseFloat(process.env.MIN_XLM_AMOUNT || '5')
        : parseFloat(process.env.MIN_USDC_AMOUNT || '1'));
    const maxAmount =
      feeConfig?.max_order_amount ??
      (assetCode === 'XLM'
        ? parseFloat(process.env.MAX_XLM_AMOUNT || '100000')
        : parseFloat(process.env.MAX_USDC_AMOUNT || '100000'));
    setState(
      userId,
      { action: 'buy', assetCode, waitingFor: 'buy_amount' },
      { action: 'handler.state.set', chatType: ctx.chat?.type, chatId: ctx.chat?.id }
    );
    await ctx.editMessageText(Messages.ENTER_CUSTOM_AMOUNT_BUY(assetCode, minAmount, maxAmount), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  });

  bot.callbackQuery(/^use_saved_wallet_\d+$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery().catch(() => {});
    } catch (error) {
      logger.debug({ error, userId: ctx.from.id }, 'Failed to answer callback query');
    }

    const userId = getUserId(ctx);
    const paymentInfoId = parseInt(ctx.callbackQuery.data.replace('use_saved_wallet_', ''));
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || state.action !== 'buy') {
      await ctx.reply(
        `❌ <b>Lỗi trạng thái</b>\n\n` + `Phiên làm việc đã hết hạn.\n\n` + `Vui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    const paymentInfo = await paymentInformationService.findById(paymentInfoId);
    if (!paymentInfo || !paymentInfo.wallet_address) {
      logger.error({ userId, paymentInfoId }, 'Saved wallet not found');
      const key = getPreorderBuyNoticeKey(ctx.chat?.id);
      if (key) {
        await sendOrderNotice(
          ctx,
          key,
          `❌ <b>Lỗi ví</b>\n\n` + `Không tìm thấy thông tin ví đã lưu.\n\n` + `Vui lòng thử lại!`
        );
      } else {
        await ctx.reply(
          `❌ <b>Lỗi ví</b>\n\n` + `Không tìm thấy thông tin ví đã lưu.\n\n` + `Vui lòng thử lại!`,
          { parse_mode: 'HTML' }
        );
      }
      return;
    }

    const isXlm = state.assetCode === 'XLM';

    if (!isXlm) {
      const trustlineCheck = await checkUsdcTrustline(paymentInfo.wallet_address);
      if (!trustlineCheck.valid) {
        logger.info(
          { userId, wallet: paymentInfo.wallet_address, reason: trustlineCheck.reason },
          'Trustline check failed for saved wallet'
        );
        await handleTrustlineFailure(ctx, state, trustlineCheck, paymentInfo.wallet_address);
        return;
      }
    }

    state.walletAddress = paymentInfo.wallet_address;
    state.paymentInfoId = paymentInfoId;
    state.waitingFor = undefined;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    logger.info(
      { userId, paymentInfoId, wallet: paymentInfo.wallet_address },
      'Using saved wallet'
    );

    let buyRate: number | null = null;
    let feeRateBuy = 0;
    let minFeeVnd = 0;

    if (isXlm) {
      const [xlmRate, usdcRates] = await Promise.all([
        paymentService.getXlmRate(),
        paymentService.getRate(),
      ]);
      buyRate = xlmRate;
      feeRateBuy = usdcRates?.fee_rate_buy ?? 0;
      minFeeVnd = usdcRates?.min_fee_vnd ?? 0;
    } else {
      const rates = await paymentService.getRate();
      if (rates) {
        buyRate = rates.buy;
        feeRateBuy = rates.fee_rate_buy ?? 0;
        minFeeVnd = rates.min_fee_vnd ?? 0;
      }
    }

    if (!buyRate) {
      try {
        await ctx.editMessageText(Messages.RATE_UNAVAILABLE(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      } catch (error) {
        const key = getPreorderBuyNoticeKey(ctx.chat?.id);
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
    const vndAmount = usdtAmount * buyRate;
    const gatewayFee = calculateGatewayFee(vndAmount, feeRateBuy, minFeeVnd);
    const totalAmount = vndAmount + gatewayFee;

    state.buyRate = buyRate;
    state.gatewayFee = gatewayFee;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    try {
      await ctx.editMessageText(
        Messages.ORDER_SUMMARY_BUY(
          state.amount!,
          paymentInfo.wallet_address,
          totalAmount,
          buyRate,
          gatewayFee,
          state.assetCode || 'USDC'
        ),
        { parse_mode: 'HTML', reply_markup: Keyboards.gatewaySelection() }
      );
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.info({ error: errMessage }, 'Message unchanged, ignoring');
    }
  });

  bot.callbackQuery('add_new_wallet', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || state.action !== 'buy') {
      await ctx.reply(
        `❌ <b>Lỗi trạng thái</b>\n\n` + `Phiên làm việc đã hết hạn.\n\n` + `Vui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    state.waitingFor = 'wallet';
    state.isNewPaymentInfo = true;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    logger.info({ userId }, 'User chose to add new wallet');

    await ctx.editMessageText(Messages.ENTER_WALLET_ADDRESS(state.assetCode || 'USDC'), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  });

  async function handleGatewaySelection(ctx: any, gateway: 'bank' | 'napas'): Promise<void> {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = getUserId(ctx);
    const state = getState(userId, {
      action: 'handler.state.get',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    if (!state || state.action !== 'buy' || !state.amount || !state.walletAddress) {
      await ctx.reply(
        `❌ <b>Lỗi trạng thái</b>\n\nPhiên làm việc đã hết hạn.\n\nVui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    state.payGateway = gateway;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    logger.info({ userId, gateway }, 'User selected payment gateway');

    try {
      await ctx.editMessageText(
        Messages.ORDER_SUMMARY_BUY(
          state.amount,
          state.walletAddress,
          (parseFloat(state.amount) * (state.buyRate ?? 0)) + (state.gatewayFee ?? 0),
          state.buyRate ?? 0,
          state.gatewayFee ?? 0,
          state.assetCode || 'USDC'
        ),
        { parse_mode: 'HTML', reply_markup: Keyboards.confirmPayment() }
      );
    } catch {
      await ctx.reply(
        Messages.ORDER_SUMMARY_BUY(
          state.amount,
          state.walletAddress,
          (parseFloat(state.amount) * (state.buyRate ?? 0)) + (state.gatewayFee ?? 0),
          state.buyRate ?? 0,
          state.gatewayFee ?? 0,
          state.assetCode || 'USDC'
        ),
        { parse_mode: 'HTML', reply_markup: Keyboards.confirmPayment() }
      );
    }
  }

  bot.callbackQuery('gateway_bank', (ctx) => handleGatewaySelection(ctx, 'bank'));
  bot.callbackQuery('gateway_napas', (ctx) => handleGatewaySelection(ctx, 'napas'));
}

export async function handleBuyAmountInput(
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

  const assetCode = state.assetCode || 'USDC';

  const feeConfig = await paymentService.getFeeConfig(assetCode);
  const minAmount =
    feeConfig?.min_order_amount ??
    (assetCode === 'XLM'
      ? parseFloat(process.env.MIN_XLM_AMOUNT || '5')
      : parseFloat(process.env.MIN_USDC_AMOUNT || '1'));
  const maxAmount =
    feeConfig?.max_order_amount ??
    (assetCode === 'XLM'
      ? parseFloat(process.env.MAX_XLM_AMOUNT || '100000')
      : parseFloat(process.env.MAX_USDC_AMOUNT || '100000'));

  if (amount < minAmount) {
    await ctx.reply(Messages.INVALID_AMOUNT_RANGE(assetCode, minAmount, maxAmount), {
      parse_mode: 'HTML',
    });
    return;
  }

  if (amount > maxAmount) {
    await ctx.reply(Messages.INVALID_AMOUNT_RANGE(assetCode, minAmount, maxAmount), {
      parse_mode: 'HTML',
    });
    return;
  }

  state.amount = text.replace(/,/g, '');

  const savedWallets = await paymentInformationService.findByTypeAndChatId(userId, 'CRYPTO');

  if (savedWallets.length > 0) {
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });
    await ctx.reply(Messages.SELECT_SAVED_WALLET(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.savedWalletSelection(savedWallets),
    });
  } else {
    state.waitingFor = 'wallet';
    state.isNewPaymentInfo = true;
    setState(userId, state, {
      action: 'handler.state.set',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });
    await ctx.reply(Messages.ENTER_WALLET_ADDRESS(), { parse_mode: 'HTML' });
  }
}

export async function handleWalletInput(
  ctx: any,
  userId: number,
  state: UserState,
  text: string
): Promise<void> {
  if (!/^G[A-Z2-7]{55}$/.test(text)) {
    const attempts = incrementWalletAttempts(userId);
    await ctx.reply(Messages.INVALID_WALLET(), { parse_mode: 'HTML' });
    if (attempts >= 3) {
      clearWalletAttempts(userId);
      await ctx.reply(Messages.WELCOME(ctx.from?.first_name || 'bạn'), {
        parse_mode: 'HTML',
        replyMarkup: await Keyboards.mainMenu(userId),
      });
    }
    return;
  }
  clearWalletAttempts(userId);

  if (state.action === 'buy' && state.amount && state.assetCode !== 'XLM') {
    const trustlineCheck = await checkUsdcTrustline(text);
    if (!trustlineCheck.valid) {
      logger.info(
        { userId, wallet: text, reason: trustlineCheck.reason },
        'Trustline check failed for new wallet input'
      );
      await handleTrustlineFailure(ctx, state, trustlineCheck, text);
      return;
    }
  }

  state.walletAddress = text;
  state.waitingFor = undefined;

  if (state.isNewPaymentInfo) {
    try {
      const exists = await paymentInformationService.walletExists(userId, text);
      if (!exists) {
        await paymentInformationService.createPaymentInfo({
          chat_id: userId,
          type: 'CRYPTO',
          wallet_address: text,
        });
        logger.info({ userId, wallet: text }, 'Saved new wallet address');
      } else {
        logger.info({ userId, wallet: text }, 'Wallet address already exists, skipping save');
      }
    } catch (error) {
      logger.error({ userId, wallet: text, error }, 'Error saving wallet address');
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
      `✅ <b>ĐÃ LƯU ĐỊA CHỈ VÍ</b>\n\n` +
        `Địa chỉ ví đã được lưu thành công!\n\n` +
        `📮 Địa chỉ: <code>${text}</code>`,
      { parse_mode: 'HTML', reply_markup: await Keyboards.mainMenu(userId) }
    );
    return;
  }

  setState(userId, state, {
    action: 'handler.state.set',
    chatType: ctx.chat?.type,
    chatId: ctx.chat?.id,
  });

  const isXlm = state.assetCode === 'XLM';
  let buyRate: number | null = null;
  let feeRateBuy = 0;
  let minFeeVnd = 0;

  try {
    if (isXlm) {
      const [xlmRate, usdcRates] = await Promise.all([
        paymentService.getXlmRate(),
        paymentService.getRate(),
      ]);
      buyRate = xlmRate;
      feeRateBuy = usdcRates?.fee_rate_buy ?? 0;
      minFeeVnd = usdcRates?.min_fee_vnd ?? 0;
    } else {
      const rates = await paymentService.getRate();
      if (rates) {
        buyRate = rates.buy;
        feeRateBuy = rates.fee_rate_buy ?? 0;
        minFeeVnd = rates.min_fee_vnd ?? 0;
      }
    }
  } catch (error) {
    logger.error({ error, userId }, 'Failed to fetch exchange rates');
  }

  if (!buyRate) {
    await ctx.reply(Messages.RATE_UNAVAILABLE(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
    return;
  }

  const usdtAmount = parseFloat(state.amount);
  const vndAmount = usdtAmount * buyRate;
  const gatewayFee = calculateGatewayFee(vndAmount, feeRateBuy, minFeeVnd);
  const totalAmount = vndAmount + gatewayFee;

  state.buyRate = buyRate;
  state.gatewayFee = gatewayFee;
  setState(userId, state, {
    action: 'handler.state.set',
    chatType: ctx.chat?.type,
    chatId: ctx.chat?.id,
  });

  await ctx.reply(
    Messages.ORDER_SUMMARY_BUY(
      state.amount,
      text,
      totalAmount,
      buyRate,
      gatewayFee,
      state.assetCode || 'USDC'
    ),
    {
      parse_mode: 'HTML',
      reply_markup: Keyboards.gatewaySelection(),
    }
  );
}

export async function handleBuyConfirmation(
  ctx: any,
  userId: number,
  state: UserState
): Promise<void> {
  if (processingUsers.has(userId)) {
    logger.warn({ userId }, 'User is already processing an order, ignoring duplicate request');
    try {
      await ctx.answerCallbackQuery('⏳ Đơn hàng đang được xử lý, vui lòng đợi...');
    } catch {
      // ignore
    }
    return;
  }

  if (!state.amount || !state.walletAddress) {
    logger.error({ userId, state }, 'Missing amount or wallet address in buy confirmation');
    await ctx.reply(
      `❌ <b>Lỗi thông tin</b>\n\n` +
        `Thiếu thông tin số lượng hoặc địa chỉ ví.\n\n` +
        `Vui lòng bắt đầu lại!`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  processingUsers.add(userId);
  logger.info({ userId }, 'User marked as processing order');

  const isXlm = state.assetCode === 'XLM';
  const assetCode = state.assetCode || telegramConfig.tokenCode;

  try {
    logger.info(
      {
        userId,
        amount: state.amount,
        assetCode,
        wallet: state.walletAddress,
        chainId: telegramConfig.chainId,
      },
      'Calling deposit API'
    );

    const order = await paymentService.processDeposit({
      chat_id: userId,
      amount: state.amount,
      chain_id: telegramConfig.chainId,
      token_address: isXlm ? '' : telegramConfig.tokenAddress,
      asset_code: assetCode,
      recipient: state.walletAddress,
      callback: telegramConfig.callbackUrl,
      pay_gateway: state.payGateway,
    });

    const bankInfo = order.body?.bankInfo;
    const totalAmount = order.net_vnd ?? bankInfo?.vaAmount ?? 0;

    logger.info(
      {
        orderId: order.id,
        hasBody: !!order.body,
        hasQrCode: !!order.body?.qr_code,
        hasQrLink: !!order.body?.qr_link,
      },
      'Deposit order created successfully'
    );

    newlyCreatedOrders.add(order.id);
    logger.info({ orderId: order.id }, 'Order added to tracking set');

    setTimeout(() => {
      newlyCreatedOrders.delete(order.id);
      logger.debug({ orderId: order.id }, 'Removed order from newly created tracking set');
    }, 30000);

    state.orderId = order.id;
    const currentMsgId = ctx.callbackQuery?.message?.message_id;
    if (currentMsgId && ctx.chat?.id) {
      if (!getOrderSlots(order.id)) {
        initOrderSlots(order.id, ctx.chat.id);
      }
      setMainMsgId(order.id, currentMsgId);
    }
    clearState(userId, {
      action: 'handler.state.clear',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    const qrLink = order.body?.qr_link;
    const qrCode = order.body?.qr_code || order.body?.qr_data;

    if (qrLink || qrCode) {
      const combinedCaption = Messages.ORDER_PAYMENT_BUY(
        state.amount,
        state.walletAddress,
        state.buyRate ?? 0,
        state.gatewayFee ?? 0,
        bankInfo?.bankName,
        bankInfo?.bankAccountNumber,
        bankInfo?.bankAccountName,
        totalAmount,
        assetCode,
        order.expired_at
      );

      const qrKeyboard = Keyboards.qrCodeWithCancel(order.id);
      const chatId = ctx.chat?.id;

      const slots = getOrderSlots(order.id);
      let msgId: number | null = null;

      if (qrLink) {
        try {
          if (slots?.mainMsgId && chatId) {
            logger.info(
              { orderId: order.id, qrLink },
              'Fetching and editing main message with QR photo via URL'
            );
            const qrImageBuffer = await fetchQrImage(qrLink);
            await ctx.api.editMessageMedia(chatId, slots.mainMsgId, {
              type: 'photo',
              media: new InputFile(qrImageBuffer),
              caption: combinedCaption,
              parse_mode: 'HTML',
            });
            await messageDelay();
            await ctx.api.editMessageReplyMarkup(chatId, slots.mainMsgId, {
              reply_markup: qrKeyboard,
            });
            msgId = slots.mainMsgId;
            logger.info(
              { orderId: order.id, msgId: slots.mainMsgId },
              'Edited main message with QR photo via URL'
            );
          } else {
            logger.info({ orderId: order.id, qrLink }, 'Sending new QR photo via URL');
            const qrImageBuffer = await fetchQrImage(qrLink);
            const msg = await ctx.replyWithPhoto(new InputFile(qrImageBuffer), {
              caption: combinedCaption,
              parse_mode: 'HTML',
              reply_markup: qrKeyboard,
            });
            msgId = msg.message_id;
            logger.info({ orderId: order.id, msgId }, 'Sent new QR photo via URL');
          }
        } catch (qrLinkError) {
          logger.warn(
            { orderId: order.id, error: qrLinkError },
            'Failed to edit/send QR from URL, trying qrCode'
          );
        }
      }

      if (!msgId && qrCode) {
        try {
          if (slots?.mainMsgId && chatId) {
            logger.info({ orderId: order.id }, 'Editing main message with generated QR photo');
            const qrCodeImage = await generateQRCode(qrCode);
            await ctx.api.editMessageMedia(chatId, slots.mainMsgId, {
              type: 'photo',
              media: new InputFile(qrCodeImage),
              caption: combinedCaption,
              parse_mode: 'HTML',
            });
            await messageDelay();
            await ctx.api.editMessageReplyMarkup(chatId, slots.mainMsgId, {
              reply_markup: qrKeyboard,
            });
            msgId = slots.mainMsgId;
            logger.info(
              { orderId: order.id, msgId: slots.mainMsgId },
              'Edited main message with generated QR'
            );
          } else {
            logger.info({ orderId: order.id }, 'Sending new QR photo via generated image');
            const qrCodeImage = await generateQRCode(qrCode);
            const msg = await ctx.replyWithPhoto(new InputFile(qrCodeImage), {
              caption: combinedCaption,
              parse_mode: 'HTML',
              reply_markup: qrKeyboard,
            });
            msgId = msg.message_id;
            logger.info({ orderId: order.id, msgId }, 'Sent new QR photo via generated image');
          }
        } catch (qrCodeError) {
          logger.error(
            { orderId: order.id, error: qrCodeError },
            'Failed to edit/send QR from qrCode'
          );
        }
      }

      if (!slots?.mainMsgId && chatId && msgId) {
        initOrderSlots(order.id, chatId);
        setMainMsgId(order.id, msgId);
        logger.info(
          { orderId: order.id, mainMsgId: msgId },
          'Initialized order slots with new photo message ID'
        );
      }

      await messageDelay();
      await sendNotifyMessage(ctx, order.id, Messages.ORDER_STATE_CREATED(order.id));

      scheduleOrderTrackingCleanup(order.id);
    } else {
      logger.error({ orderId: order.id, body: order.body }, 'No QR code in order response');
      await sendOrderNotice(
        ctx,
        order.id,
        `❌ <b>Lỗi tạo đơn hàng</b>\n\n` +
          `Không thể tạo mã QR thanh toán.\n` +
          `Mã đơn hàng: <code>${order.id}</code>\n\n` +
          `Vui lòng thử lại hoặc liên hệ support!`
      );
    }
  } catch (error) {
    captureErrorWithContext(error, {
      userId,
      action: 'handleBuyConfirmation',
      amount: state.amount,
      walletAddress: state.walletAddress,
    });
    throw error;
  } finally {
    processingUsers.delete(userId);
    logger.info({ userId }, 'User removed from processing set');
  }
}

export async function handleWalletActivationConfirmation(
  ctx: any,
  userId: number,
  state: UserState
): Promise<void> {
  if (processingUsers.has(userId)) {
    await ctx.answerCallbackQuery('⏳ Đơn hàng đang được xử lý, vui lòng đợi...').catch(() => {});
    return;
  }

  if (!state.activationRecipientWallet) {
    await ctx.reply(`❌ <b>Lỗi thông tin</b>\n\nThiếu địa chỉ ví cần kích hoạt.`, {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
    return;
  }

  processingUsers.add(userId);

  try {
    const amount = state.activationXlmAmount || ACTIVATION_XLM_AMOUNT;
    const order = await paymentService.processDeposit({
      chat_id: userId,
      amount,
      chain_id: telegramConfig.chainId,
      token_address: '',
      asset_code: 'XLM',
      recipient: state.activationRecipientWallet,
      callback: telegramConfig.callbackUrl,
    });

    const bankInfo = order.body?.bankInfo;
    const totalAmount = order.net_vnd ?? bankInfo?.vaAmount ?? 0;
    newlyCreatedOrders.add(order.id);
    setTimeout(() => newlyCreatedOrders.delete(order.id), 30000);

    const currentMsgId = ctx.callbackQuery?.message?.message_id;
    if (currentMsgId && ctx.chat?.id) {
      if (!getOrderSlots(order.id)) initOrderSlots(order.id, ctx.chat.id);
      setMainMsgId(order.id, currentMsgId);
    }
    clearState(userId, {
      action: 'handler.state.clear',
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
    });

    const qrLink = order.body?.qr_link;
    const qrCode = order.body?.qr_code || order.body?.qr_data;
    const caption = Messages.ORDER_PAYMENT_ACTIVATE_WALLET(
      amount,
      state.activationRecipientWallet,
      state.activationRate ?? 0,
      state.activationFee ?? 0,
      totalAmount,
      bankInfo?.bankName,
      bankInfo?.bankAccountNumber,
      bankInfo?.bankAccountName
    );
    const qrKeyboard = Keyboards.qrCodeWithCancel(order.id);

    const slots = getOrderSlots(order.id);
    const chatId = ctx.chat?.id;
    let msgId: number | null = null;

    if (qrLink) {
      try {
        if (slots?.mainMsgId && chatId) {
          logger.info(
            { orderId: order.id, qrLink },
            'Fetching and editing main message with QR photo via URL'
          );
          const qrImageBuffer = await fetchQrImage(qrLink);
          await ctx.api.editMessageMedia(chatId, slots.mainMsgId, {
            type: 'photo',
            media: new InputFile(qrImageBuffer),
            caption,
            parse_mode: 'HTML',
          });
          await messageDelay();
          await ctx.api.editMessageReplyMarkup(chatId, slots.mainMsgId, {
            reply_markup: qrKeyboard,
          });
          msgId = slots.mainMsgId;
          logger.info(
            { orderId: order.id, msgId: slots.mainMsgId },
            'Edited main message with QR photo via URL'
          );
        } else {
          logger.info({ orderId: order.id, qrLink }, 'Sending new QR photo via URL');
          const qrImageBuffer = await fetchQrImage(qrLink);
          const msg = await ctx.replyWithPhoto(new InputFile(qrImageBuffer), {
            caption,
            parse_mode: 'HTML',
            reply_markup: qrKeyboard,
          });
          msgId = msg.message_id;
          logger.info({ orderId: order.id, msgId }, 'Sent new QR photo via URL');
        }
      } catch (qrLinkError) {
        logger.warn(
          { orderId: order.id, error: qrLinkError },
          'Failed to edit/send QR from URL, trying qrCode'
        );
      }
    }

    if (!msgId && qrCode) {
      try {
        if (slots?.mainMsgId && chatId) {
          logger.info({ orderId: order.id }, 'Editing main message with generated QR photo');
          const qrCodeImage = await generateQRCode(qrCode);
          await ctx.api.editMessageMedia(chatId, slots.mainMsgId, {
            type: 'photo',
            media: new InputFile(qrCodeImage),
            caption,
            parse_mode: 'HTML',
          });
          await messageDelay();
          await ctx.api.editMessageReplyMarkup(chatId, slots.mainMsgId, {
            reply_markup: qrKeyboard,
          });
          msgId = slots.mainMsgId;
          logger.info(
            { orderId: order.id, msgId: slots.mainMsgId },
            'Edited main message with generated QR'
          );
        } else {
          logger.info({ orderId: order.id }, 'Sending new QR photo via generated image');
          const qrCodeImage = await generateQRCode(qrCode);
          const msg = await ctx.replyWithPhoto(new InputFile(qrCodeImage), {
            caption,
            parse_mode: 'HTML',
            reply_markup: qrKeyboard,
          });
          msgId = msg.message_id;
          logger.info({ orderId: order.id, msgId }, 'Sent new QR photo via generated image');
        }
      } catch (qrCodeError) {
        logger.error(
          { orderId: order.id, error: qrCodeError },
          'Failed to edit/send QR from qrCode'
        );
      }
    }

    if (!slots?.mainMsgId && chatId && msgId) {
      initOrderSlots(order.id, chatId);
      setMainMsgId(order.id, msgId);
      logger.info(
        { orderId: order.id, mainMsgId: msgId },
        'Initialized order slots with new photo message ID'
      );
    }

    if (qrLink || qrCode) {
      await messageDelay();
      await sendNotifyMessage(ctx, order.id, Messages.ORDER_STATE_CREATED(order.id));
      scheduleOrderTrackingCleanup(order.id);
    } else {
      logger.error({ orderId: order.id, body: order.body }, 'No QR code in order response');
      await sendOrderNotice(
        ctx,
        order.id,
        `❌ <b>Lỗi tạo đơn hàng</b>\n\n` +
          `Không thể tạo mã QR thanh toán.\n` +
          `Mã đơn hàng: <code>${order.id}</code>\n\n` +
          `Vui lòng thử lại hoặc liên hệ support!`
      );
    }
  } finally {
    processingUsers.delete(userId);
  }
}
