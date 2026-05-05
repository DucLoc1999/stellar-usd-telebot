import * as Sentry from '@sentry/node';
import { logger } from '../config/logger';

/**
 * Captures an error to Sentry with additional context
 * Also logs the error using the application logger
 *
 * @param error - The error to capture
 * @param context - Additional context to attach to the error
 * @param level - Sentry severity level (default: 'error')
 */
export function captureErrorWithContext(
  error: unknown,
  context?: {
    userId?: number | string;
    chatId?: number | string;
    orderId?: string;
    action?: string;
    [key: string]: any;
  },
  level: Sentry.SeverityLevel = 'error'
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log to application logger
  logger.error(
    {
      error: errorMessage,
      stack: errorStack,
      ...context,
    },
    context?.action || 'Error occurred'
  );

  // Capture to Sentry
  Sentry.captureException(error, {
    level,
    tags: {
      action: context?.action,
      userId: context?.userId?.toString(),
      chatId: context?.chatId?.toString(),
    },
    contexts: {
      error_context: {
        ...context,
      },
    },
    extra: {
      errorMessage,
      errorStack,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Captures a message to Sentry with additional context
 * Also logs the message using the application logger
 *
 * @param message - The message to capture
 * @param context - Additional context to attach to the message
 * @param level - Sentry severity level (default: 'warning')
 */
export function captureMessageWithContext(
  message: string,
  context?: {
    userId?: number | string;
    chatId?: number | string;
    [key: string]: any;
  },
  level: Sentry.SeverityLevel = 'warning'
): void {
  // Log to application logger
  const logLevel = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info';
  logger[logLevel](context || {}, message);

  // Capture to Sentry
  Sentry.captureMessage(message, {
    level,
    tags: {
      userId: context?.userId?.toString(),
      chatId: context?.chatId?.toString(),
    },
    contexts: {
      message_context: {
        ...context,
      },
    },
    extra: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Wraps an async function with error handling that captures to Sentry
 *
 * @param fn - The async function to wrap
 * @param context - Context to attach to any errors
 * @returns The wrapped function
 */
export function withSentryErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: {
    action?: string;
    [key: string]: any;
  }
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      captureErrorWithContext(error, context);
      throw error;
    }
  }) as T;
}

/**
 * Sets user context for Sentry
 *
 * @param userId - User ID
 * @param email - User email (optional)
 * @param username - Username (optional)
 */
export function setSentryUser(userId: number | string, email?: string, username?: string): void {
  Sentry.setUser({
    id: userId.toString(),
    email,
    username,
  });
}

/**
 * Clears user context from Sentry
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Adds a breadcrumb to Sentry for tracking user actions
 *
 * @param message - Breadcrumb message
 * @param category - Category (e.g., 'payment', 'kyc', 'telegram')
 * @param data - Additional data
 * @param level - Breadcrumb level (default: 'info')
 */
export function addSentryBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}
