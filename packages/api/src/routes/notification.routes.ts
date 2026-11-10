import { Router } from 'express';
import {
  getNotifications,
  getUnreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
} from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

/** GET /api/notifications — Get authenticated user's notifications */
router.get('/', getNotifications);

/** GET /api/notifications/unread-count — Get authenticated user's unread count */
router.get('/unread-count', getUnreadCountHandler);

/** PATCH /api/notifications/read-all — Mark all notifications as read */
router.patch('/read-all', markAllAsReadHandler);

/** PATCH /api/notifications/:id/read — Mark a single notification as read */
router.patch('/:id/read', markAsReadHandler);

export default router;
