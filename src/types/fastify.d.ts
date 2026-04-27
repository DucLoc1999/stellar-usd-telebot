import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    responsePayload?: unknown;
    rawBody?: string;
  }
}
