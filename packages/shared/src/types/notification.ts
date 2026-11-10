export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'PAYMENT_SUCCESS'
  | 'BOOKING_CANCELLED'
  | 'CHARGING_COMPLETED'
  | 'NEW_BOOKING';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  createdAt: string | Date;
}

export interface NotificationSummary {
  notifications: Notification[];
  unreadCount: number;
}
