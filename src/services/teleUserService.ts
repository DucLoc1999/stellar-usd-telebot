import db from '../config/knex';
import type { TeleUser, CreateTeleUserRequest } from '../models/types';

export class TeleUserService {
  private tableName = 'tele_users';

  async upsertUser(userData: CreateTeleUserRequest): Promise<TeleUser> {
    const { chat_id, first_name, last_name, username } = userData;

    const query = `
      INSERT INTO ${this.tableName} 
        (chat_id, first_name, last_name, username, is_kyc, created_at, updated_at)
      VALUES 
        (?, ?, ?, ?, true, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        username = VALUES(username),
        updated_at = NOW()
    `;

    await db.raw(query, [chat_id, first_name ?? null, last_name ?? null, username]);

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
}

export default new TeleUserService();
