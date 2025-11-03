import db from '../config/knex';
import teleUserService from './teleUserService';
import { logger } from '../config/logger';
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
      const response = await fetch(`${this.apiBaseUrl}/withdrawal`, {
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
          hasOrder: !!apiResponse.data?.order,
          orderId: apiResponse.data?.order?.id,
        },
        'Withdrawal API JSON response parsed'
      );

      if (!apiResponse.data || !apiResponse.data.order) {
        logger.error({ apiResponse }, 'Invalid API response structure: missing data.order');
        throw new Error('Invalid API response structure: missing data.order');
      }

      return apiResponse.data.order;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Error calling withdrawal API'
      );
      throw error;
    }
  }

  private async callDepositAPI(requestData: Usdt247CreateDepositRequest): Promise<Usdt247Order> {
    try {
      logger.info(
        {
          url: `${this.apiBaseUrl}/deposit`,
          requestBody: requestData,
        },
        'Sending deposit API request'
      );

      const response = await fetch(`${this.apiBaseUrl}/deposit`, {
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
          hasOrder: !!apiResponse.data?.order,
          orderId: apiResponse.data?.order?.id,
          orderAmount: apiResponse.data?.order?.amount,
          orderCurrency: apiResponse.data?.order?.currency,
          orderRate: apiResponse.data?.order?.rate,
          bodyAmount: apiResponse.data?.order?.body?.amount,
          payDataAmount: apiResponse.data?.order?.pay_data?.amount,
        },
        'Deposit API JSON response parsed'
      );

      if (!apiResponse.data || !apiResponse.data.order) {
        logger.error({ apiResponse }, 'Invalid API response structure: missing data.order');
        throw new Error('Invalid API response structure: missing data.order');
      }

      return apiResponse.data.order;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Error calling deposit API'
      );
      throw error;
    }
  }

  private async saveOrder(chatId: number, apiResponse: Usdt247Order): Promise<Order> {
    const orderData = {
      id: apiResponse.id,
      chat_id: chatId,
      user_id: apiResponse.user_id,
      order_type: apiResponse.order_type,
      external_id: apiResponse.external_id || null,
      code: apiResponse.code,
      provider: apiResponse.provider,
      callback: apiResponse.callback,
      amount: apiResponse.amount,
      currency: apiResponse.currency,
      rate: apiResponse.rate,
      token_address: apiResponse.token_address,
      recipient: apiResponse.recipient,
      chain_id: apiResponse.chain_id,
      partner_id: apiResponse.partner_id,
      state: apiResponse.state,
      processing_state: apiResponse.processing_state,
      body: apiResponse.body ? JSON.stringify(apiResponse.body) : null,
      pay_data: apiResponse.pay_data ? JSON.stringify(apiResponse.pay_data) : null,
      payment_info: apiResponse.payment_info ? JSON.stringify(apiResponse.payment_info) : null,
      expired_at: this.convertTimestamp(apiResponse.expired_at),
      created_at: this.convertTimestamp(apiResponse.created_at),
      updated_at: this.convertTimestamp(apiResponse.updated_at),
      client_ip: apiResponse.client_ip,
      outcome: apiResponse.outcome,
      original_rate: apiResponse.original_rate,
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
      callback: request.callback as string,
      payment_info: request.payment_info,
    };

    logger.info(
      {
        chatId: request.chat_id,
        bankId: request.payment_info.bank_id,
        apiUrl: `${this.apiBaseUrl}/withdrawal`,
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
      recipient: request.recipient,
      callback: request.callback as string,
    };

    logger.info(
      { chatId: request.chat_id, apiUrl: `${this.apiBaseUrl}/deposit` },
      'Calling deposit API'
    );

    const apiResponse = await this.callDepositAPI(apiRequest);

    logger.info(
      {
        chatId: request.chat_id,
        orderId: apiResponse.id,
        hasPayData: !!apiResponse.pay_data,
        hasQrCode: !!apiResponse.pay_data?.qr_code,
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
