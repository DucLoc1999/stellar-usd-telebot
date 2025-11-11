import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import * as Sentry from '@sentry/node';

export interface CustomError extends Error {
  statusCode?: number;
  validation?: unknown;
}

export const errorHandler = async (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const statusCode = error.statusCode || 500;

  // Capture error in Sentry for server errors (5xx) and unexpected errors
  if (statusCode >= 500) {
    Sentry.captureException(error, {
      contexts: {
        request: {
          url: request.url,
          method: request.method,
          headers: request.headers,
          query: request.query,
        },
      },
      tags: {
        statusCode: statusCode.toString(),
      },
    });
  }

  // Log error for debugging
  console.error('Error occurred:', {
    url: request.url,
    method: request.method,
    error: error.message,
    stack: error.stack,
  });

  // Handle validation errors
  if (error.validation) {
    await reply.status(400).send({
      success: false,
      error: 'Validation Error',
      message: error.message,
      details: error.validation,
    });
    return;
  }

  // Handle different error types
  const errorResponse: {
    success: boolean;
    error: string;
    message: string;
    stack?: string;
  } = {
    success: false,
    error: error.name || 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
  };

  // Include stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  await reply.status(statusCode).send(errorResponse);
};

export default errorHandler;
