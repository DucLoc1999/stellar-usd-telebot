import db from '../config/knex';
import type { TeleUser, CreateTeleUserRequest } from '../models/types';

export class TeleUserService {
  private tableName = 'tele_users';

  async upsertUser(userData: CreateTeleUserRequest): Promise<TeleUser> {
    const { chat_id, first_name, last_name, username, referral } = userData;

    const query = `
      INSERT INTO ${this.tableName}
        (chat_id, first_name, last_name, username, is_kyc, referral, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, false, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        username = VALUES(username),
        updated_at = NOW()
    `;

    await db.raw(query, [
      chat_id,
      first_name ?? null,
      last_name ?? null,
      username,
      referral ?? null,
    ]);

    const user = await db(this.tableName).where({ chat_id }).first<TeleUser>();

    if (!user) {
      throw new Error('Failed to create or update user');
    }

    return user;
  }

  async findByChatId(chatId: number): Promise<TeleUser | undefined> {
    return db(this.tableName).where({ chat_id: chatId }).first();
  }

  /**
   * Update KYC status for a user
   */
  async updateKycStatus(chatId: number, isKyc: boolean): Promise<void> {
    await db(this.tableName)
      .where({ chat_id: chatId })
      .update({ is_kyc: isKyc, updated_at: db.fn.now() });
  }

  /**
   * Increment KYC attempt counter for a user
   */
  async incrementKycAttempts(chatId: number): Promise<void> {
    await db(this.tableName)
      .where({ chat_id: chatId })
      .increment('time_kyc', 1)
      .update({ updated_at: db.fn.now() });
  }

  /**
   * Check if user has exceeded KYC attempt limit
   * @param chatId - User's chat ID
   * @returns true if user has exceeded limit (time_kyc >= 3), false otherwise
   */
  async hasExceededKycAttempts(chatId: number): Promise<boolean> {
    const user = await this.findByChatId(chatId);
    if (!user) {
      return false;
    }
    return (user.time_kyc || 0) >= 3;
  }

  /**
   * Find user by username
   * @param username - User's Telegram username
   * @returns User object if found, undefined otherwise
   */
  async findByUsername(username: string): Promise<TeleUser | undefined> {
    return db(this.tableName).where({ username }).first();
  }

  /**
   * Increment referral count for a user
   * @param chatId - User's chat ID
   */
  async incrementReferralCount(chatId: number): Promise<void> {
    await db(this.tableName)
      .where({ chat_id: chatId })
      .increment('referral_count', 1)
      .update({ updated_at: db.fn.now() });
  }

  /**
   * Get referral count for a user
   * @param chatId - User's chat ID
   * @returns Referral count
   */
  async getReferralCount(chatId: number): Promise<number> {
    const user = await this.findByChatId(chatId);
    return user?.referral_count || 0;
  }
}

export default new TeleUserService();
