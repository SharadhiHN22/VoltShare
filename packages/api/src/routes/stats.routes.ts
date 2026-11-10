import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { PlatformStats } from '@voltshare/shared';

const router = Router();

/**
 * GET /api/stats
 * Public endpoint to fetch real dynamic platform statistics from the database.
 * - Registered EV Drivers: count users with role SEEKER
 * - Active Charging Ports: count active chargers (status ACTIVE)
 * - Completed Charging Sessions: count completed bookings (status COMPLETED)
 * - Customer Reviews: count reviews
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [registeredDrivers, activeChargers, completedSessions, reviewsCount] = await Promise.all([
      prisma.user.count({ where: { role: 'SEEKER' } }),
      prisma.charger.count({ where: { status: 'ACTIVE' } }),
      prisma.booking.count({ where: { status: 'COMPLETED' } }),
      prisma.review.count(),
    ]);

    const stats: PlatformStats = {
      registeredDrivers,
      activeChargers,
      completedSessions,
      reviewsCount,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
