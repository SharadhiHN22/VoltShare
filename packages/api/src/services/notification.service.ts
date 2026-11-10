import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
}

/**
 * Creates a notification with deduplication check to prevent duplicate notifications
 * if payment or status webhooks/events are processed multiple times.
 */
export async function createNotification(data: CreateNotificationInput) {
  // Check if an identical notification was already created for this user
  const existing = await prisma.notification.findFirst({
    where: {
      userId: data.userId,
      type: data.type,
      message: data.message,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      isRead: false,
    },
  });
}

/**
 * Get all notifications belonging to a specific user, newest first.
 */
export async function getUserNotifications(userId: string, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get unread notification count for a specific user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

/**
 * Mark a single notification as read with strict user ownership validation.
 */
export async function markAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError('Notification not found.', 404);
  }

  // Security check: User can only modify their own notifications
  if (notification.userId !== userId) {
    throw new AppError('You do not have permission to modify this notification.', 403);
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

/**
 * Mark all notifications belonging to a specific user as read.
 */
export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: { isRead: true },
  });

  return { count: result.count };
}
