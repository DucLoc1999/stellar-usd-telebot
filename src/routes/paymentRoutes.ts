// import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
// import paymentController from '../controllers/paymentController';

// export const paymentRoutes: FastifyPluginAsync = async (
//   fastify: FastifyInstance
// ): Promise<void> => {
//   fastify.post(
//     '/payment/withdrawal',
//     {
//       schema: {
//         body: {
//           type: 'object',
//           required: ['chat_id', 'amount', 'chain_id', 'token_address', 'callback', 'payment_info'],
//           properties: {
//             chat_id: {
//               type: 'number',
//             },
//             amount: {
//               type: 'string',
//             },
//             chain_id: {
//               type: 'number',
//             },
//             token_address: {
//               type: 'string',
//             },
//             callback: {
//               type: 'string',
//             },
//             payment_info: {
//               type: 'object',
//               required: ['bank_id', 'full_name', 'account_type', 'account_number'],
//               properties: {
//                 bank_id: {
//                   type: 'number',
//                 },
//                 full_name: {
//                   type: 'string',
//                 },
//                 account_type: {
//                   type: 'number',
//                 },
//                 account_number: {
//                   type: 'string',
//                 },
//               },
//             },
//           },
//         },
//       },
//     },
//     paymentController.processWithdrawal.bind(paymentController)
//   );

//   fastify.post(
//     '/payment/deposit',
//     {
//       schema: {
//         body: {
//           type: 'object',
//           required: ['chat_id', 'amount', 'chain_id', 'token_address', 'recipient', 'callback'],
//           properties: {
//             chat_id: {
//               type: 'number',
//             },
//             amount: {
//               type: 'string',
//             },
//             chain_id: {
//               type: 'number',
//             },
//             token_address: {
//               type: 'string',
//             },
//             recipient: {
//               type: 'string',
//             },
//             callback: {
//               type: 'string',
//             },
//           },
//         },
//       },
//     },
//     paymentController.processDeposit.bind(paymentController)
//   );

//   return Promise.resolve();
// };

// export default paymentRoutes;
