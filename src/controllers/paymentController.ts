// import type { FastifyReply, FastifyRequest } from 'fastify';
// import paymentService from '../services/paymentService';
// import { DepositRequest, Usdt247Order, WithdrawalRequest } from '@models/usdt247';
// import { ApiResponse } from '@models/types';

// export class PaymentController {
//   /**
//    * Handle withdrawal request
//    */
//   async processWithdrawal(
//     request: FastifyRequest<{ Body: WithdrawalRequest }>,
//     reply: FastifyReply
//   ): Promise<{ success: boolean; chat_id: number; data: Usdt247Order }> {
//     try {
//       const requestData = request.body;

//       if (
//         !requestData.chat_id ||
//         !requestData.amount ||
//         !requestData.chain_id ||
//         !requestData.token_address ||
//         !requestData.callback ||
//         !requestData.payment_info
//       ) {
//         const response: ApiResponse = {
//           success: false,
//           error:
//             'Missing required fields: chat_id, amount, chain_id, token_address, callback, payment_info',
//         };
//         return reply.status(400).send(response);
//       }

//       const { payment_info } = requestData;
//       if (
//         !payment_info.bank_id ||
//         !payment_info.full_name ||
//         !payment_info.account_type ||
//         !payment_info.account_number
//       ) {
//         const response: ApiResponse = {
//           success: false,
//           error:
//             'Missing required payment_info fields: bank_id, full_name, account_type, account_number',
//         };
//         return reply.status(400).send(response);
//       }

//       const order = await paymentService.processWithdrawal(requestData);

//       const response = {
//         success: true,
//         chat_id: requestData.chat_id,
//         data: order,
//       };

//       return reply.status(200).send(response);
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';

//       if (errorMessage === 'KYC verification required') {
//         const response: ApiResponse = {
//           success: false,
//           error: 'KYC verification is required to process withdrawal',
//         };
//         return reply.status(403).send(response);
//       }

//       if (errorMessage === 'User not found') {
//         const response: ApiResponse = {
//           success: false,
//           error: 'User not found',
//         };
//         return reply.status(404).send(response);
//       }

//       const response: ApiResponse = {
//         success: false,
//         error: errorMessage,
//       };

//       return reply.status(500).send(response);
//     }
//   }

//   /**
//    * Handle deposit request
//    */
//   async processDeposit(
//     request: FastifyRequest<{ Body: DepositRequest }>,
//     reply: FastifyReply
//   ): Promise<{ success: boolean; chat_id: number; data: Usdt247Order }> {
//     try {
//       const requestData = request.body;

//       if (
//         !requestData.chat_id ||
//         !requestData.amount ||
//         !requestData.chain_id ||
//         !requestData.token_address ||
//         !requestData.recipient ||
//         !requestData.callback
//       ) {
//         const response: ApiResponse = {
//           success: false,
//           error:
//             'Missing required fields: chat_id, amount, chain_id, token_address, recipient, callback',
//         };
//         return reply.status(400).send(response);
//       }

//       const order = await paymentService.processDeposit(requestData);

//       const response = {
//         success: true,
//         chat_id: requestData.chat_id,
//         data: order,
//       };

//       return reply.status(200).send(response);
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
//       if (errorMessage === 'KYC verification required') {
//         const response: ApiResponse = {
//           success: false,
//           error: 'KYC verification is required to process deposit',
//         };
//         return reply.status(403).send(response);
//       }

//       if (errorMessage === 'User not found') {
//         const response: ApiResponse = {
//           success: false,
//           error: 'User not found',
//         };
//         return reply.status(404).send(response);
//       }

//       const response: ApiResponse = {
//         success: false,
//         error: errorMessage,
//       };

//       return reply.status(500).send(response);
//     }
//   }
// }

// export default new PaymentController();
