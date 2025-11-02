import db from '../config/knex';
import type {
  PaymentInformation,
  CreatePaymentInformationRequest,
  PaymentType,
} from '../models/types';
import { logger } from '../config/logger';

export class PaymentInformationService {
  private tableName = 'payment_information';

  /**
   * Find all payment information records by chat_id and type
   */
  async findByTypeAndChatId(chatId: number, type: PaymentType): Promise<PaymentInformation[]> {
    try {
      logger.info({ chatId, type }, 'Fetching payment information');

      const records = await db(this.tableName)
        .where({ chat_id: chatId, type })
        .orderBy('created_at', 'desc')
        .select<PaymentInformation[]>('*');

      logger.info({ chatId, type, count: records.length }, 'Payment information fetched');

      return records;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ chatId, type, error: errorMessage }, 'Error fetching payment information');
      throw error;
    }
  }

  /**
   * Create a new payment information record
   */
  async createPaymentInfo(data: CreatePaymentInformationRequest): Promise<PaymentInformation> {
    try {
      logger.info({ data }, 'Creating payment information');

      const [id] = await db(this.tableName).insert({
        chat_id: data.chat_id,
        type: data.type,
        wallet_address: data.wallet_address || null,
        bank_id: data.bank_id || null,
        full_name: data.full_name || null,
        bank_account: data.bank_account || null,
      });

      const record = await db(this.tableName).where({ id }).first<PaymentInformation>();

      if (!record) {
        throw new Error('Failed to create payment information');
      }

      logger.info({ id, chatId: data.chat_id, type: data.type }, 'Payment information created');

      return record;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ data, error: errorMessage }, 'Error creating payment information');
      throw error;
    }
  }

  /**
   * Find a specific payment information record by ID
   */
  async findById(id: number): Promise<PaymentInformation | null> {
    try {
      const record = await db(this.tableName).where({ id }).first<PaymentInformation>();
      return record || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ id, error: errorMessage }, 'Error fetching payment information by ID');
      throw error;
    }
  }

  /**
   * Check if a wallet address already exists for a user
   */
  async walletExists(chatId: number, walletAddress: string): Promise<boolean> {
    try {
      const record = await db(this.tableName)
        .where({ chat_id: chatId, type: 'CRYPTO', wallet_address: walletAddress })
        .first();

      return !!record;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { chatId, walletAddress, error: errorMessage },
        'Error checking wallet existence'
      );
      throw error;
    }
  }

  /**
   * Check if a bank account already exists for a user
   */
  async bankAccountExists(chatId: number, bankId: number, bankAccount: string): Promise<boolean> {
    try {
      const record = await db(this.tableName)
        .where({ chat_id: chatId, type: 'BANK', bank_id: bankId, bank_account: bankAccount })
        .first();

      return !!record;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { chatId, bankId, bankAccount, error: errorMessage },
        'Error checking bank account existence'
      );
      throw error;
    }
  }
}

export default new PaymentInformationService();
