import type { FastifyReply, FastifyRequest } from 'fastify';
import teleUserService from '../services/teleUserService';
import type { ApiResponse, TeleUser, CreateTeleUserRequest } from '../models/types';

export class TeleUserController {
  async createOrUpdateUser(
    request: FastifyRequest<{ Body: CreateTeleUserRequest }>,
    reply: FastifyReply
  ): Promise<ApiResponse<TeleUser>> {
    try {
      const userData = request.body;

      if (!userData.chat_id || !userData.username) {
        const response: ApiResponse = {
          success: false,
          error: 'Missing required fields: chat_id, username',
        };
        return reply.status(400).send(response);
      }

      const user = await teleUserService.upsertUser(userData);

      const response: ApiResponse<TeleUser> = {
        success: true,
        data: user,
      };

      return reply.status(200).send(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const response: ApiResponse = {
        success: false,
        error: errorMessage,
      };

      return reply.status(500).send(response);
    }
  }

  async getUserByChatId(
    request: FastifyRequest<{ Params: { chat_id: number } }>,
    reply: FastifyReply
  ): Promise<ApiResponse<TeleUser>> {
    try {
      const chatId = request.params.chat_id;

      const user = await teleUserService.findByChatId(chatId);

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not found',
        };
        return reply.status(404).send(response);
      }

      const response: ApiResponse<TeleUser> = {
        success: true,
        data: user,
      };

      return reply.status(200).send(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const response: ApiResponse = {
        success: false,
        error: errorMessage,
      };

      return reply.status(500).send(response);
    }
  }
}

export default new TeleUserController();
