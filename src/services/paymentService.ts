import db from '../config/knex';
import teleUserService from './teleUserService';
import { logger } from '../config/logger';
import { captureErrorWithContext } from '../utils/sentryHelper';
import type {
  Usdt247CreateWithdrawalRequest,
  Usdt247CreateDepositRequest,
  Usdt247Order,
  Usdt247CreateOrderResponse,
  Usdt247Timestamp,
  Order,
  WithdrawalRequest,
  DepositRequest,
} from '../models/usdt247';

export class PaymentService {
  private readonly apiBaseUrl = process.env.API_PAY || '';
  private readonly partnerAppKey = process.env.PARTNER_APP_KEY || '';

  async getRate(): Promise<{
    buy: number;
    sell: number;
    fee_rate_buy: number;
    fee_rate_sell: number;
    min_fee_vnd: number;
    created_at: string;
  } | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/rate/usdt_vnd`);
      if (!response.ok) {
        logger.error({ status: response.status }, 'Failed to fetch rate');
        return null;
      }
      const data = (await response.json()) as {
        buy: number;
        sell: number;
        fee_rate_buy?: number;
        fee_rate_sell?: number;
        min_fee_vnd?: number;
        created_at: string;
      };
      return {
        buy: data.buy,
        sell: data.sell,
        fee_rate_buy: data.fee_rate_buy ?? 0,
        fee_rate_sell: data.fee_rate_sell ?? 0,
        min_fee_vnd: data.min_fee_vnd ?? 0,
        created_at: data.created_at,
      };
    } catch (error) {
      logger.error({ error }, 'Error fetching rate');
      return null;
    }
  }

  async getXlmRate(): Promise<number | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/rate/xlm_vnd`);
      if (!response.ok) {
        logger.error({ status: response.status }, 'Failed to fetch XLM rate');
        return null;
      }

      const data = (await response.json()) as {
        buy?: number;
        sell?: number;
        rate?: number;
        xlm_vnd?: number;
      };

      return data.buy ?? data.sell ?? data.rate ?? data.xlm_vnd ?? null;
    } catch (error) {
      logger.error({ error }, 'Error fetching XLM rate');
      return null;
    }
  }

  private convertTimestamp(timestamp: Usdt247Timestamp): Date {
    const milliseconds = timestamp.seconds * 1000 + timestamp.nanos / 1000000;
    return new Date(milliseconds);
  }

  private async checkKYC(chatId: number): Promise<boolean> {
    const user = await teleUserService.findByChatId(chatId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.is_kyc) {
      throw new Error('KYC verification required');
    }

    return true;
  }

  private async callWithdrawalAPI(
    requestData: Usdt247CreateWithdrawalRequest
  ): Promise<Usdt247Order> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/orders/withdrawal`, {
        method: 'POST',
        headers: {
          'Partner-App-Key': this.partnerAppKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      logger.info(
        { status: response.status, ok: response.ok },
        'Withdrawal API HTTP response received'
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, errorText },
          'Withdrawal API returned error status'
        );
        throw new Error(`USDT247 API error: ${response.status} - ${errorText}`);
      }

      const apiResponse = (await response.json()) as Usdt247CreateOrderResponse;

      logger.info(
        {
          hasData: !!apiResponse.data,
          orderId: apiResponse.data?.id,
        },
        'Withdrawal API JSON response parsed'
      );

      if (!apiResponse.data) {
        logger.error({ apiResponse }, 'Invalid API response structure: missing data');
        throw new Error('Invalid API response structure: missing data');
      }

      return apiResponse.data;
    } catch (error) {
      captureErrorWithContext(error, {
        action: 'callWithdrawalAPI',
        apiUrl: `${this.apiBaseUrl}/api/orders/withdrawal`,
      });
      throw error;
    }
  }

  private async callDepositAPI(requestData: Usdt247CreateDepositRequest): Promise<Usdt247Order> {
    try {
      logger.info(
        {
          url: `${this.apiBaseUrl}/api/orders/deposit`,
          requestBody: requestData,
        },
        'Sending deposit API request'
      );

      const response = await fetch(`${this.apiBaseUrl}/api/orders/deposit`, {
        method: 'POST',
        headers: {
          'Partner-App-Key': this.partnerAppKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      logger.info(
        { status: response.status, ok: response.ok },
        'Deposit API HTTP response received'
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          {
            status: response.status,
            errorText,
            requestBody: requestData,
          },
          'Deposit API returned error status'
        );
        throw new Error(`USDT247 API error: ${response.status} - ${errorText}`);
      }

      const apiResponse = (await response.json()) as Usdt247CreateOrderResponse;

      logger.info(
        {
          hasData: !!apiResponse.data,
          orderId: apiResponse.data?.id,
          orderAmount: apiResponse.data?.amount,
          orderCurrency: apiResponse.data?.currency,
          orderRate: apiResponse.data?.rate,
          bodyAmount: apiResponse.data?.body?.amount,
          payDataAmount: apiResponse.data?.pay_data?.amount,
        },
        'Deposit API JSON response parsed'
      );

      if (!apiResponse.data) {
        logger.error({ apiResponse }, 'Invalid API response structure: missing data');
        throw new Error('Invalid API response structure: missing data');
      }

      return apiResponse.data;
    } catch (error) {
      captureErrorWithContext(error, {
        action: 'callDepositAPI',
        apiUrl: `${this.apiBaseUrl}/api/orders/deposit`,
      });
      throw error;
    }
  }

  private mapOrderType(orderType: string | number): number {
    if (typeof orderType === 'number') return orderType;
    const map: Record<string, number> = { buy: 2, sell: 1 };
    return map[orderType] ?? 0;
  }

  private mapProvider(provider: string | number): number {
    if (typeof provider === 'number') return provider;
    const map: Record<string, number> = { sepay: 1, chain: 2 };
    return map[provider] ?? 0;
  }

  private async saveOrder(chatId: number, apiResponse: Usdt247Order): Promise<Order> {
    const orderData = {
      id: apiResponse.id,
      chat_id: chatId,
      user_id: apiResponse.user_id,
      order_type: this.mapOrderType(apiResponse.order_type),
      external_id: apiResponse.external_id || null,
      code: apiResponse.code,
      provider: this.mapProvider(apiResponse.provider),
      callback: apiResponse.callback,
      amount: apiResponse.amount,
      currency: apiResponse.currency,
      rate: apiResponse.rate,
      token_address: apiResponse.token_address,
      recipient: apiResponse.recipient,
      chain_id: String(apiResponse.chain_id),
      partner_id: apiResponse.partner_id,
      state: apiResponse.state,
      processing_state: apiResponse.processing_state,
      transaction_hash: apiResponse.transaction_hash || null,
      body: apiResponse.body ? JSON.stringify(apiResponse.body) : null,
      pay_data: apiResponse.pay_data ? JSON.stringify(apiResponse.pay_data) : null,
      payment_info: apiResponse.payment_info ? JSON.stringify(apiResponse.payment_info) : null,
      expired_at: this.convertTimestamp(apiResponse.expired_at),
      created_at: this.convertTimestamp(apiResponse.created_at),
      updated_at: this.convertTimestamp(apiResponse.updated_at),
      client_ip: apiResponse.client_ip || null,
      outcome: apiResponse.outcome || null,
      original_rate: apiResponse.original_rate || null,
      total_fee_vnd: apiResponse.total_fee_vnd,
    };

    await db('orders').insert(orderData);

    return {
      ...orderData,
      body: apiResponse.body || null,
      pay_data: apiResponse.pay_data || null,
      payment_info: apiResponse.payment_info || null,
    };
  }

  async processWithdrawal(request: WithdrawalRequest): Promise<Usdt247Order> {
    logger.info(
      { chatId: request.chat_id, amount: request.amount },
      'Processing withdrawal request'
    );

    const isKYCVerified = await this.checkKYC(request.chat_id);
    if (!isKYCVerified) {
      logger.warn({ chatId: request.chat_id }, 'KYC verification failed for withdrawal');
      throw new Error('KYC verification required');
    }

    const apiRequest: Usdt247CreateWithdrawalRequest = {
      amount: request.amount,
      chain_id: request.chain_id,
      token_address: request.token_address,
      callback: request.callback,
      payment_info: request.payment_info,
    };

    logger.info(
      {
        chatId: request.chat_id,
        bankId: request.payment_info.bank_id,
        apiUrl: `${this.apiBaseUrl}/api/orders/withdrawal`,
      },
      'Calling withdrawal API'
    );

    const apiResponse = await this.callWithdrawalAPI(apiRequest);

    logger.info(
      {
        chatId: request.chat_id,
        orderId: apiResponse.id,
        hasPayData: !!apiResponse.pay_data,
        hasAddress: !!apiResponse.pay_data?.address,
        payData: apiResponse.pay_data,
        recipient: apiResponse.recipient,
        body: apiResponse.body,
      },
      'Withdrawal API response received - full details'
    );

    // Save to database
    await this.saveOrder(request.chat_id, apiResponse);

    logger.info(
      { chatId: request.chat_id, orderId: apiResponse.id },
      'Withdrawal order saved to database'
    );

    // Return the original HSPay API response
    return apiResponse;
  }

  async processDeposit(request: DepositRequest): Promise<Usdt247Order> {
    logger.info({ chatId: request.chat_id, amount: request.amount }, 'Processing deposit request');

    const isKYCVerified = await this.checkKYC(request.chat_id);
    if (!isKYCVerified) {
      logger.warn({ chatId: request.chat_id }, 'KYC verification failed');
      throw new Error('KYC verification required');
    }

    const apiRequest: Usdt247CreateDepositRequest = {
      amount: request.amount,
      chain_id: request.chain_id,
      token_address: request.token_address,
      asset_code: request.asset_code,
      recipient: request.recipient,
      callback: request.callback,
    };

    logger.info(
      { chatId: request.chat_id, apiUrl: `${this.apiBaseUrl}/api/orders/deposit` },
      'Calling deposit API'
    );

    const apiResponse = await this.callDepositAPI(apiRequest);

    logger.info(
      {
        chatId: request.chat_id,
        orderId: apiResponse.id,
        hasBody: !!apiResponse.body,
        hasQrCode: !!apiResponse.body?.qr_code,
        hasQrLink: !!apiResponse.body?.qr_link,
      },
      'Deposit API response received'
    );

    // Save to database
    await this.saveOrder(request.chat_id, apiResponse);

    logger.info({ chatId: request.chat_id, orderId: apiResponse.id }, 'Order saved to database');

    // Return the original HSPay API response
    return apiResponse;
  }
}

export default new PaymentService();
