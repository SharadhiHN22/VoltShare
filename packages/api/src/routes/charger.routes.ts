import { Router } from 'express';
import {
  searchChargers,
  getChargerById,
  getMyChargers,
  createCharger,
  updateCharger,
  toggleStatus,
  deleteCharger,
} from '../controllers/charger.controller';
import { getChargerReviews } from '../controllers/review.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { searchChargersSchema, createChargerSchema } from '@voltshare/shared';

const router = Router();

/** GET /api/chargers — Search chargers near a location (public) */
router.get('/', validate(searchChargersSchema, 'query'), searchChargers);

/** GET /api/chargers/mine — Get all chargers belonging to authenticated host */
router.get('/mine', authenticate, authorize('HOST'), getMyChargers);

/** GET /api/chargers/:id/reviews — Get reviews for a charger (public) */
router.get('/:id/reviews', getChargerReviews);

/** GET /api/chargers/:id — Get charger details (public) */
router.get('/:id', getChargerById);

/** POST /api/chargers — Create a new charger listing (HOST only) */
router.post('/', authenticate, authorize('HOST'), validate(createChargerSchema), createCharger);

/** PUT /api/chargers/:id — Update a charger (HOST only) */
router.put('/:id', authenticate, authorize('HOST'), updateCharger);

/** PATCH /api/chargers/:id/status — Toggle charger active/inactive (HOST only) */
router.patch('/:id/status', authenticate, authorize('HOST'), toggleStatus);

/** DELETE /api/chargers/:id — Delete a charger (HOST only) */
router.delete('/:id', authenticate, authorize('HOST'), deleteCharger);

export default router;
