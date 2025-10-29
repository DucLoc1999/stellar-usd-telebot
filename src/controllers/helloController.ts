import type { FastifyReply, FastifyRequest } from 'fastify';
import helloService from '../services/helloService';
import type { ApiResponse, HelloWorldResponse } from '../models/types';

export class HelloController {
  async getHello(
    _request: FastifyRequest,
    reply: FastifyReply
  ): Promise<ApiResponse<HelloWorldResponse>> {
    try {
      const data = helloService.getHelloMessage();
      const response: ApiResponse<HelloWorldResponse> = {
        success: true,
        data,
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

export default new HelloController();
