import { Router } from 'express';
import {
  createBooking,
  getUserBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  checkInBooking,
  completeBooking,
} from '../controllers/booking.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createBookingSchema } from '@voltshare/shared';

const router = Router();

/** POST /api/bookings — Create a new booking (SEEKER only) */
router.post('/', authenticate, authorize('SEEKER'), validate(createBookingSchema), createBooking);

/** GET /api/bookings — List the authenticated user's bookings */
router.get('/', authenticate, getUserBookings);

/** GET /api/bookings/:id — Get booking details */
router.get('/:id', authenticate, getBookingById);

/** PATCH /api/bookings/:id/cancel — Explicit cancellation route */
router.patch('/:id/cancel', authenticate, cancelBooking);

/** POST /api/bookings/:id/cancel — Explicit cancellation route */
router.post('/:id/cancel', authenticate, cancelBooking);

/** POST /api/bookings/:id/check-in — Check in to start charging session (transitions CONFIRMED -> ACTIVE) */
router.post('/:id/check-in', authenticate, checkInBooking);
router.patch('/:id/check-in', authenticate, checkInBooking);

/** POST /api/bookings/:id/complete — Complete charging session (transitions ACTIVE -> COMPLETED) */
router.post('/:id/complete', authenticate, completeBooking);
router.patch('/:id/complete', authenticate, completeBooking);

/** PATCH /api/bookings/:id/status — Update booking status */
router.patch('/:id/status', authenticate, updateBookingStatus);

export default router;
