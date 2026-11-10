import { Request, Response, NextFunction } from 'express';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../services/notification.service';

/**
 * GET /api/notifications
 * Returns notifications belonging strictly to the authenticated user.
 */
export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const [notifications, unreadCount] = await Promise.all([
      getUserNotifications(userId, limit),
      getUnreadCount(userId),
    ]);

    res.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/unread-count
 * Returns the unread notification count for the authenticated user.
 */
export const getUnreadCountHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const count = await getUnreadCount(userId);

    res.json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Marks a notification as read. Verifies ownership.
 */
export const markAsReadHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const updated = await markAsRead(id, userId);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Marks all notifications for the authenticated user as read.
 */
export const markAllAsReadHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;

    const result = await markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
