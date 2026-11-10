import { Router } from 'express';
import { createReview, getChargerReviews, getBookingReview } from '../controllers/review.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createReviewSchema } from '@voltshare/shared';

const router = Router();

/** POST /api/reviews — Submit a review for a completed booking (SEEKER only) */
router.post('/', authenticate, authorize('SEEKER'), validate(createReviewSchema), createReview);

/** GET /api/reviews/charger/:chargerId — Get reviews for a charger (public) */
router.get('/charger/:chargerId', getChargerReviews);

/** GET /api/reviews/booking/:bookingId — Get review status/review for a booking (auth required) */
router.get('/booking/:bookingId', authenticate, getBookingReview);

export default router;
