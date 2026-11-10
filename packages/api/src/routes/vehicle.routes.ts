import { Router } from 'express';
import { getVehicles, createVehicle } from '../controllers/vehicle.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createVehicleSchema } from '@voltshare/shared';

const router = Router();

// All vehicle endpoints require authenticated SEEKER (EV Driver)
router.use(authenticate, authorize('SEEKER'));

/** GET /api/vehicles — List authenticated driver's saved vehicles */
router.get('/', getVehicles);

/** POST /api/vehicles — Save a new vehicle for authenticated driver */
router.post('/', validate(createVehicleSchema), createVehicle);

export default router;
