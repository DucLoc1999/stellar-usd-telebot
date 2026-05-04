import { Bot, InputFile } from 'grammy';
import * as StellarSdk from 'stellar-sdk';
import { Messages, Keyboards } from '../index';
import { userStates, processingUsers, newlyCreatedOrders, type UserState } from '../user-state';
import { logger } from '../../../config/logger';
import { telegramConfig } from '../../../config/app';
import paymentService from '../../paymentService';
import paymentInformationService from '../../paymentInformationService';
import teleUserService from '../../teleUserService';
import { captureErrorWithContext } from '../../../utils/sentryHelper';
import {
  generateQRCode,
  hasMessageBeenSent,
  markMessageAsSent,
  scheduleOrderTrackingCleanup,
} from '../index';

async function checkUsdcTrustline(
  walletAddress: string
): Promise<{ valid: boolean; message?: string }> {
  try {
    const server = new StellarSdk.Horizon.Server(telegramConfig.horizonUrl);
    const account = await server.accounts().accountId(walletAddress).call();

    const trustline = account.balances.find(
      (balance: any) =>
        balance.asset_type !== 'native' &&
        balance.asset_code === 'USDC' &&
        balance.asset_issuer === telegramConfig.tokenAddress
    ) as any;

    if (!trustline) {
      return {
        valid: false,
        message:
          `⚠️ <b>Cảnh báo Trustline</b>\n\n` +
          `Ví của bạn chưa có trustline cho token USDC.\n\n` +
          `Địa chỉ token: <code>${telegramConfig.tokenAddress}</code>\n\n` +
          `Bạn cần thêm trustline trước khi mua hoặc sở hữu token USDC.\n\n` +
          `📌 <b>Cách thêm trustline:</b>\n` +
          `1. Mở ví Stellar (Lobstr, Solar, v.v.)\n` +
          `2. Tìm mục "Thêm asset" hoặc "Add trustline"\n` +
          `3. Nhập mã token: <code>USDC</code>\n` +
          `4. Nhập địa chỉ issuer: <code>${telegramConfig.tokenAddress}</code>\n` +
          `5. Xác nhận thêm trustline\n\n` +
          `Sau khi thêm trustline, bạn có thể quay lại để tiếp tục mua USDC.`,
      };
    }

    if (trustline.is_authorized === false) {
      return {
        valid: false,
        message:
          `⚠️ <b>Trustline chưa được ủy quyền</b>\n\n` +
          `Trustline cho USDC trên ví của bạn chưa được ủy quyền nhận token.\n\n` +
          `Vui lòng liên hệ hỗ trợ để được hướng dẫn thêm.`,
      };
    }

    return { valid: true };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return {
        valid: false,
        message:
          `⚠️ <b>Địa chỉ ví không tồn tại</b>\n\n` +
          `Địa chỉ ví Stellar không tồn tại trên mạng lưới Stellar.\n\n` +
          `Vui lòng kiểm tra lại địa chỉ ví: <code>${walletAddress}</code>\n\n` +
          `Đảm bảo bạn nhập đúng địa chỉ ví Stellar (bắt đầu bằng G...).`,
      };
    }
    logger.error({ error, walletAddress }, 'Error checking trustline');
    return {
      valid: false,
      message:
        `⚠️ <b>Lỗi kết nối mạng Stellar</b>\n\n` +
        `Không thể kết nối đến mạng lưới Stellar để kiểm tra trustline.\n\n` +
        `Nguyên nhân có thể:\n` +
        `• Mạng Stellar đang bận hoặc bảo trì\n` +
        `• Kết nối internet của bạn không ổn định\n\n` +
        `Vui lòng thử lại sau vài phút.`,
    };
  }
}

export function setupBuyHandlers(bot: Bot): void {
  bot.callbackQuery('buy_usdt', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;

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
      userStates.set(userId, { action: 'buy' });
      await ctx.editMessageText(Messages.BUY_SELECT_AMOUNT(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.buyAmountSelection(),
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

  bot.callbackQuery(/^buy_amount_\d+$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;
    const amount = ctx.callbackQuery.data.replace('buy_amount_', '');

    const savedWallets = await paymentInformationService.findByTypeAndChatId(userId, 'CRYPTO');

    if (savedWallets.length > 0) {
      userStates.set(userId, { action: 'buy', amount });
      await ctx.editMessageText(Messages.SELECT_SAVED_WALLET(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.savedWalletSelection(savedWallets),
      });
    } else {
      userStates.set(userId, {
        action: 'buy',
        amount,
        waitingFor: 'wallet',
        isNewPaymentInfo: true,
      });
      await ctx.editMessageText(Messages.ENTER_WALLET_ADDRESS(), {
        parse_mode: 'HTML',
        reply_markup: Keyboards.backToMenu(),
      });
    }
  });

  bot.callbackQuery('buy_custom', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;
    userStates.set(userId, { action: 'buy', waitingFor: 'buy_amount' });
    await ctx.editMessageText(Messages.ENTER_CUSTOM_AMOUNT_BUY(), {
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

    const userId = ctx.from.id;
    const paymentInfoId = parseInt(ctx.callbackQuery.data.replace('use_saved_wallet_', ''));
    const state = userStates.get(userId);

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
      await ctx.reply(
        `❌ <b>Lỗi ví</b>\n\n` + `Không tìm thấy thông tin ví đã lưu.\n\n` + `Vui lòng thử lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    state.walletAddress = paymentInfo.wallet_address;
    state.paymentInfoId = paymentInfoId;
    state.waitingFor = undefined;
    userStates.set(userId, state);

    const trustlineCheck = await checkUsdcTrustline(paymentInfo.wallet_address);
    if (!trustlineCheck.valid) {
      await ctx.reply(trustlineCheck.message!, { parse_mode: 'HTML' });
      return;
    }

    logger.info(
      { userId, paymentInfoId, wallet: paymentInfo.wallet_address },
      'Using saved wallet'
    );

    let rates;
    try {
      rates = await paymentService.getRate();
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
        await ctx.reply(Messages.RATE_UNAVAILABLE(), {
          parse_mode: 'HTML',
          reply_markup: Keyboards.backToMenu(),
        });
      }
      return;
    }

    const usdtAmount = parseFloat(state.amount!);
    const vndAmount = usdtAmount * rates.buy;
    const gatewayFee = vndAmount * rates.fee_rate_buy;

    try {
      await ctx.editMessageText(
        Messages.ORDER_SUMMARY_BUY(
          state.amount!,
          paymentInfo.wallet_address,
          vndAmount,
          rates.buy,
          gatewayFee
        ),
        { parse_mode: 'HTML', reply_markup: Keyboards.confirmPayment() }
      );
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.info({ error: errMessage }, 'Message unchanged, ignoring');
    }
  });

  bot.callbackQuery('add_new_wallet', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const userId = ctx.from.id;
    const state = userStates.get(userId);

    if (!state || state.action !== 'buy') {
      await ctx.reply(
        `❌ <b>Lỗi trạng thái</b>\n\n` + `Phiên làm việc đã hết hạn.\n\n` + `Vui lòng bắt đầu lại!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    state.waitingFor = 'wallet';
    state.isNewPaymentInfo = true;
    userStates.set(userId, state);

    logger.info({ userId }, 'User chose to add new wallet');

    await ctx.editMessageText(Messages.ENTER_WALLET_ADDRESS(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.backToMenu(),
    });
  });
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

  state.amount = text.replace(/,/g, '');

  const savedWallets = await paymentInformationService.findByTypeAndChatId(userId, 'CRYPTO');

  if (savedWallets.length > 0) {
    userStates.set(userId, state);
    await ctx.reply(Messages.SELECT_SAVED_WALLET(), {
      parse_mode: 'HTML',
      reply_markup: Keyboards.savedWalletSelection(savedWallets),
    });
  } else {
    state.waitingFor = 'wallet';
    state.isNewPaymentInfo = true;
    userStates.set(userId, state);
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
    await ctx.reply(Messages.INVALID_WALLET(), { parse_mode: 'HTML' });
    return;
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
    userStates.delete(userId);
    await ctx.reply(
      `✅ <b>ĐÃ LƯU ĐỊA CHỈ VÍ</b>\n\n` +
        `Địa chỉ ví đã được lưu thành công!\n\n` +
        `📮 Địa chỉ: <code>${text}</code>`,
      { parse_mode: 'HTML', reply_markup: await Keyboards.mainMenu(userId) }
    );
    return;
  }

  userStates.set(userId, state);

  const trustlineCheck = await checkUsdcTrustline(text);
  if (!trustlineCheck.valid) {
    await ctx.reply(trustlineCheck.message!, { parse_mode: 'HTML' });
    return;
  }

  let rates;
  try {
    rates = await paymentService.getRate();
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

  const usdtAmount = parseFloat(state.amount!);
  const vndAmount = usdtAmount * rates.sell;
  const feeRate = rates.fee_rate_buy ?? 0;
  const gatewayFee = vndAmount * feeRate;

  await ctx.reply(
    Messages.ORDER_SUMMARY_BUY(state.amount!, text, vndAmount, rates.sell, gatewayFee),
    {
      parse_mode: 'HTML',
      reply_markup: Keyboards.confirmPayment(),
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
    } catch {}
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

  const trustlineCheck = await checkUsdcTrustline(state.walletAddress);
  if (!trustlineCheck.valid) {
    await ctx.reply(trustlineCheck.message!, { parse_mode: 'HTML' });
    return;
  }

  processingUsers.add(userId);
  logger.info({ userId }, 'User marked as processing order');

  try {
    logger.info(
      {
        userId,
        usdtAmount: state.amount,
        wallet: state.walletAddress,
        chainId: telegramConfig.chainId,
        tokenAddress: telegramConfig.tokenAddress,
      },
      'Calling deposit API with USDC amount'
    );

    const order = await paymentService.processDeposit({
      chat_id: userId,
      amount: state.amount,
      chain_id: telegramConfig.chainId,
      token_address: telegramConfig.tokenAddress,
      recipient: state.walletAddress,
      callback: telegramConfig.callbackUrl,
    });

    const bankInfo = order.body?.bankInfo;
    const totalAmount = bankInfo?.vaAmount ?? 0;

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

    userStates.delete(userId);

    const qrLink = order.body?.qr_link;
    const qrCode = order.body?.qr_code || order.body?.qr_data;

    if (qrLink || qrCode) {
      if (!hasMessageBeenSent(order.id, 'bank_info')) {
        await ctx.reply(
          Messages.PAYMENT_QR_MESSAGE(
            bankInfo?.bankName,
            bankInfo?.bankAccountNumber,
            bankInfo?.bankAccountName,
            totalAmount
          ),
          { parse_mode: 'HTML' }
        );
        markMessageAsSent(order.id, 'bank_info');
        logger.info({ orderId: order.id }, 'Bank information message sent');
      }

      if (!hasMessageBeenSent(order.id, 'qr_code')) {
        let qrSent = false;

        if (qrLink) {
          try {
            logger.info({ orderId: order.id, qrLink }, 'Sending QR code via URL from API');
            await ctx.replyWithPhoto(qrLink, {
              caption: Messages.PAYMENT_QR_CAPTION(),
              parse_mode: 'HTML',
              reply_markup: Keyboards.qrCodeWithCancel(order.id),
            });
            qrSent = true;
            logger.info({ orderId: order.id }, 'QR code image sent via URL successfully');
          } catch (qrLinkError) {
            logger.warn(
              { orderId: order.id, qrLink, error: qrLinkError },
              'Failed to send QR via URL, falling back to QR code generation'
            );
          }
        }

        if (!qrSent && qrCode) {
          logger.info({ orderId: order.id }, 'Generating QR code image from string');
          const qrCodeImage = await generateQRCode(qrCode);
          logger.info(
            { orderId: order.id, qrCodeSize: qrCodeImage.length },
            'QR code generated successfully'
          );

          await ctx.replyWithPhoto(new InputFile(qrCodeImage), {
            caption: Messages.PAYMENT_QR_CAPTION(),
            parse_mode: 'HTML',
            reply_markup: Keyboards.qrCodeWithCancel(order.id),
          });
          qrSent = true;
        }

        if (qrSent) {
          markMessageAsSent(order.id, 'qr_code');
        }
      }

      if (!hasMessageBeenSent(order.id, 'processing_status')) {
        await ctx.reply(Messages.ORDER_STATE_PROCESSING(order.id), { parse_mode: 'HTML' });
        markMessageAsSent(order.id, 'processing_status');
        logger.info({ orderId: order.id }, 'Processing status notification sent');
      }

      scheduleOrderTrackingCleanup(order.id);
    } else {
      logger.error({ orderId: order.id, body: order.body }, 'No QR code in order response');
      await ctx.reply(
        `❌ <b>Lỗi tạo đơn hàng</b>\n\n` +
          `Không thể tạo mã QR thanh toán.\n` +
          `Mã đơn hàng: <code>${order.id}</code>\n\n` +
          `Vui lòng thử lại hoặc liên hệ support!`,
        { parse_mode: 'HTML' }
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
