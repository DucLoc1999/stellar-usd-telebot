import db from '../config/knex';
import { logger } from '../config/logger';
import type { Kyc, CreateKycRequest } from '../models/types';

export class KycService {
  private tableName = 'kyc';

  /**
   * Find KYC record by chat_id
   */
  async findByChatId(chatId: number): Promise<Kyc | null> {
    try {
      logger.info({ chatId }, 'Fetching KYC information');

      const record = await db(this.tableName).where({ chat_id: chatId }).first<Kyc>();

      if (record) {
        logger.info({ chatId, kycId: record.id }, 'KYC information found');
      } else {
        logger.info({ chatId }, 'No KYC information found');
      }

      return record || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ chatId, error: errorMessage }, 'Error fetching KYC information');
      throw error;
    }
  }

  /**
   * Create new KYC record
   */
  async create(data: CreateKycRequest): Promise<Kyc> {
    try {
      logger.info({ chatId: data.chat_id, type: data.type }, 'Creating KYC record');

      const [id] = await db(this.tableName).insert({
        chat_id: data.chat_id,
        phone: data.phone,
        type: data.type,
        id_number: data.id_number,
        name: data.name,
        dob: data.dob,
        sex: data.sex,
        nationality: data.nationality,
        home: data.home,
        address: data.address,
        doe: data.doe,
        passport_number: data.passport_number || null,
      });

      const record = await db(this.tableName).where({ id }).first<Kyc>();

      if (!record) {
        throw new Error('Failed to create KYC record');
      }

      logger.info(
        { chatId: data.chat_id, kycId: id, type: data.type },
        'KYC record created successfully'
      );

      return record;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ chatId: data.chat_id, error: errorMessage }, 'Error creating KYC record');
      throw error;
    }
  }

  /**
   * Update existing KYC record
   */
  async update(chatId: number, data: Partial<CreateKycRequest>): Promise<Kyc> {
    try {
      logger.info({ chatId }, 'Updating KYC record');

      await db(this.tableName)
        .where({ chat_id: chatId })
        .update({
          ...data,
          updated_at: db.fn.now(),
        });

      const record = await db(this.tableName).where({ chat_id: chatId }).first<Kyc>();

      if (!record) {
        throw new Error('Failed to update KYC record');
      }

      logger.info({ chatId, kycId: record.id }, 'KYC record updated successfully');

      return record;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ chatId, error: errorMessage }, 'Error updating KYC record');
      throw error;
    }
  }

  /**
   * Check if KYC record exists for a user
   */
  async exists(chatId: number): Promise<boolean> {
    try {
      const record = await db(this.tableName).where({ chat_id: chatId }).first();
      return !!record;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ chatId, error: errorMessage }, 'Error checking KYC existence');
      throw error;
    }
  }
}

export default new KycService();
