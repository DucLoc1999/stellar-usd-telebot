import db from '../config/knex';
import { logger } from '../config/logger';
import type { Referral, CreateReferralRequest } from '../models/types';

export class ReferralService {
  private tableName = 'referrals';

  /**
   * Create a new referral record
   * @param data - Referral data containing chat_id (referred user) and referral (referrer)
   * @returns The created referral record
   * @throws Error if creation fails (except for duplicate entries which are logged but not thrown)
   */
  async createReferral(data: CreateReferralRequest): Promise<Referral | null> {
    try {
      logger.info(
        { referredUserId: data.chat_id, referrerId: data.referral },
        'Creating referral record'
      );

      const [id] = await db(this.tableName).insert({
        chat_id: data.chat_id,
        referral: data.referral,
      });

      const record = await db(this.tableName).where({ id }).first<Referral>();

      if (!record) {
        throw new Error('Failed to create referral record');
      }

      logger.info(
        { referralId: id, referredUserId: data.chat_id, referrerId: data.referral },
        'Referral record created successfully'
      );

      return record;
    } catch (error) {
      // Check if this is a duplicate entry error
      if (this.isDuplicateError(error)) {
        logger.warn(
          { referredUserId: data.chat_id, referrerId: data.referral },
          'Referral record already exists for this user (duplicate chat_id)'
        );
        // Return null instead of throwing - this is expected behavior
        return null;
      }

      // For other errors, log and throw
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { referredUserId: data.chat_id, referrerId: data.referral, error: errorMessage },
        'Error creating referral record'
      );
      throw error;
    }
  }

  /**
   * Find referral record by chat_id (the referred user)
   * @param chatId - The chat_id of the referred user
   * @returns The referral record if found, null otherwise
   */
  async findByChatId(chatId: number): Promise<Referral | null> {
    try {
      const record = await db(this.tableName).where({ chat_id: chatId }).first<Referral>();
      return record || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ chatId, error: errorMessage }, 'Error fetching referral record');
      throw error;
    }
  }

  /**
   * Get all users referred by a specific user
   * @param referrerId - The chat_id of the referrer
   * @returns Array of referral records
   */
  async getReferralsByReferrer(referrerId: number): Promise<Referral[]> {
    try {
      const records = await db(this.tableName).where({ referral: referrerId }).select<Referral[]>();
      return records;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ referrerId, error: errorMessage }, 'Error fetching referrals by referrer');
      throw error;
    }
  }

  /**
   * Get referral count for a specific referrer
   * @param referrerId - The chat_id of the referrer
   * @returns Number of users referred by this user
   */
  async getReferralCount(referrerId: number): Promise<number> {
    try {
      const result = await db(this.tableName).where({ referral: referrerId }).count('id as count');
      return result[0]?.count ? Number(result[0].count) : 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ referrerId, error: errorMessage }, 'Error getting referral count');
      throw error;
    }
  }

  /**
   * Check if an error is a duplicate key constraint violation
   * MySQL error code 1062 = ER_DUP_ENTRY
   * @param error - The error to check
   * @returns true if this is a duplicate key error, false otherwise
   */
  private isDuplicateError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    // Check MySQL error code
    const err = error as { code?: string; errno?: number; message?: string };
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      return true;
    }

    // Check error message for duplicate key patterns
    const errorMessage = err.message?.toLowerCase() || '';
    if (
      errorMessage.includes('duplicate') ||
      errorMessage.includes('unique constraint') ||
      errorMessage.includes('duplicate entry')
    ) {
      return true;
    }

    return false;
  }
}

export default new ReferralService();
