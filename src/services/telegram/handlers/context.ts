import type { Context } from 'grammy';
import { logger } from '../../../config/logger';

const PRIVATE_ONLY_MESSAGE =
  'Bot chi ho tro giao dich trong chat rieng (private). Vui long nhan tin truc tiep voi bot.';

export function getUserId(ctx: Context): number {
  const userId = ctx.from?.id;
  if (!userId) {
    throw new Error('Missing Telegram user id (ctx.from.id)');
  }
  return userId;
}

export async function ensurePrivateChat(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat?.id;
  const chatType = ctx.chat?.type;

  if (chatType === 'private') {
    return true;
  }

  logger.warn(
    { chatType: chatType ?? 'unknown', chatId: chatId ?? null, sourceUserId: ctx.from?.id ?? null },
    'Rejected non-private Telegram update'
  );

  if (ctx.callbackQuery) {
    await ctx
      .answerCallbackQuery({ text: 'Chi ho tro chat rieng', show_alert: true })
      .catch(() => {});
  }

  await ctx.reply(PRIVATE_ONLY_MESSAGE).catch(() => {});
  return false;
}
