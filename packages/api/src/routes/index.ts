import { Router } from 'express';
import authRoutes from './auth.routes';
import chargerRoutes from './charger.routes';
import bookingRoutes from './booking.routes';
import paymentRoutes from './payment.routes';
import reviewRoutes from './review.routes';
import vehicleRoutes from './vehicle.routes';
import notificationRoutes from './notification.routes';
import statsRoutes from './stats.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/chargers', chargerRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/notifications', notificationRoutes);
router.use('/stats', statsRoutes);

export default router;
