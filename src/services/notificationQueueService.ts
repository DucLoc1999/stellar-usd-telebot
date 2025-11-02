import { logger } from '../config/logger';
import telegramService from './telegramService';

/**
 * Notification message to be queued
 */
interface QueuedNotification {
  chatId: number;
  orderId: string;
  state: number;
  processingState?: number;
  timestamp: string;
  eventId: string;
}

/**
 * Queue processor for a specific chat
 */
interface ChatQueue {
  processing: boolean;
  queue: QueuedNotification[];
}

/**
 * Service to manage sequential delivery of order status notifications
 * Ensures messages are sent in chronological order even when webhooks arrive out of sequence
 */
export class NotificationQueueService {
  private queues: Map<number, ChatQueue>;

  constructor() {
    this.queues = new Map();
  }

  /**
   * Enqueue a notification for delivery
   * @param notification Notification details
   */
  async enqueueNotification(notification: QueuedNotification): Promise<void> {
    const { chatId, orderId, timestamp, eventId } = notification;

    logger.info(
      {
        chatId,
        orderId,
        eventId,
        timestamp,
      },
      'Enqueueing notification'
    );

    // Get or create queue for this chat
    let chatQueue = this.queues.get(chatId);
    if (!chatQueue) {
      chatQueue = {
        processing: false,
        queue: [],
      };
      this.queues.set(chatId, chatQueue);
    }

    // Add notification to queue
    chatQueue.queue.push(notification);

    // Sort queue by timestamp to ensure chronological order
    chatQueue.queue.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    logger.info(
      {
        chatId,
        queueLength: chatQueue.queue.length,
        isProcessing: chatQueue.processing,
      },
      'Notification added to queue'
    );

    // Start processing if not already processing
    if (!chatQueue.processing) {
      await this.processQueue(chatId);
    }
  }

  /**
   * Process all notifications in the queue for a specific chat
   * @param chatId Chat ID to process notifications for
   */
  private async processQueue(chatId: number): Promise<void> {
    const chatQueue = this.queues.get(chatId);
    if (!chatQueue) {
      return;
    }

    // Mark as processing
    chatQueue.processing = true;

    logger.info(
      {
        chatId,
        queueLength: chatQueue.queue.length,
      },
      'Starting queue processing'
    );

    try {
      while (chatQueue.queue.length > 0) {
        // Get the oldest notification (first in sorted queue)
        const notification = chatQueue.queue.shift();
        if (!notification) {
          break;
        }

        logger.info(
          {
            chatId,
            orderId: notification.orderId,
            eventId: notification.eventId,
            timestamp: notification.timestamp,
            remainingInQueue: chatQueue.queue.length,
          },
          'Processing notification from queue'
        );

        try {
          // Add 3-second delay for processing state notifications
          const isProcessingNotification =
            notification.state === 2 ||
            (notification.processingState && notification.processingState > 0);

          if (isProcessingNotification) {
            logger.info(
              {
                chatId,
                orderId: notification.orderId,
                eventId: notification.eventId,
                state: notification.state,
                processingState: notification.processingState,
              },
              'Delaying processing state notification by 3 seconds'
            );
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }

          // Send the notification
          await telegramService.sendOrderStatusUpdate(
            notification.chatId,
            notification.orderId,
            notification.state,
            notification.processingState
          );

          logger.info(
            {
              chatId,
              orderId: notification.orderId,
              eventId: notification.eventId,
            },
            'Notification sent successfully'
          );
        } catch (error) {
          logger.error(
            {
              chatId,
              orderId: notification.orderId,
              eventId: notification.eventId,
              error,
            },
            'Failed to send notification'
          );
          // Continue processing other notifications even if one fails
        }

        // Small delay between messages to avoid rate limiting
        if (chatQueue.queue.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } finally {
      // Mark as not processing
      chatQueue.processing = false;

      logger.info(
        {
          chatId,
          remainingInQueue: chatQueue.queue.length,
        },
        'Queue processing completed'
      );

      // Clean up empty queues
      if (chatQueue.queue.length === 0) {
        this.queues.delete(chatId);
        logger.info({ chatId }, 'Queue cleaned up (empty)');
      }
    }
  }

  /**
   * Get queue status for monitoring/debugging
   * @param chatId Optional chat ID to get specific queue status
   */
  getQueueStatus(chatId?: number): Record<string, unknown> {
    if (chatId !== undefined) {
      const queue = this.queues.get(chatId);
      return {
        chatId,
        exists: !!queue,
        processing: queue?.processing ?? false,
        queueLength: queue?.queue.length ?? 0,
        notifications: queue?.queue.map((n) => ({
          orderId: n.orderId,
          timestamp: n.timestamp,
          eventId: n.eventId,
        })),
      };
    }

    // Return status for all queues
    const allQueues: Record<number, unknown> = {};
    this.queues.forEach((queue, chatId) => {
      allQueues[chatId] = {
        processing: queue.processing,
        queueLength: queue.queue.length,
        notifications: queue.queue.map((n) => ({
          orderId: n.orderId,
          timestamp: n.timestamp,
          eventId: n.eventId,
        })),
      };
    });

    return {
      totalQueues: this.queues.size,
      queues: allQueues,
    };
  }
}

export default new NotificationQueueService();
