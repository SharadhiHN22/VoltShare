import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { DEFAULT_PAGE_SIZE } from '@voltshare/shared';

/**
 * Create a review for a completed, paid booking.
 * Enforces:
 *   - Authenticated user is the seeker who booked the slot
 *   - Booking status is COMPLETED
 *   - Payment status is COMPLETED
 *   - Charger is not owned by the reviewer
 *   - One review per booking (duplicate reviews blocked)
 *   - Rating is integer 1 to 5 stars
 *   - Recalculates and updates the charger's average rating & review count
 */
export const createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reviewerId = req.user!.id;
    const { bookingId, rating, comment } = req.body;

    // Verify booking exists, is owned by reviewer, has completed status and payment
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        charger: true,
        payment: true,
        review: true,
      },
    });

    if (!booking) {
      throw new AppError('Booking not found.', 404);
    }

    if (booking.seekerId !== reviewerId) {
      throw new AppError('You can only review bookings you made as a driver.', 403);
    }

    // Prevent driver from reviewing their own charger
    if (booking.charger.hostId === reviewerId) {
      throw new AppError('You cannot review your own charger.', 400);
    }

    // Must be COMPLETED
    if (booking.status !== 'COMPLETED') {
      throw new AppError('You can only review completed charging sessions.', 400);
    }

    // Must be paid
    if (!booking.payment || booking.payment.status !== 'COMPLETED') {
      throw new AppError('You can only review bookings with a completed payment.', 400);
    }

    // Verify charger ID if passed by client
    if (req.body.chargerId && booking.chargerId !== req.body.chargerId) {
      throw new AppError('The charger ID does not match the booking.', 400);
    }

    // Check duplicate
    if (booking.review) {
      throw new AppError('You have already submitted a review for this booking.', 409);
    }

    const chargerId = booking.chargerId;
    const starRating = parseInt(String(rating), 10);
    if (!Number.isInteger(starRating) || starRating < 1 || starRating > 5) {
      throw new AppError('Rating must be an integer between 1 and 5.', 400);
    }

    // Create review and update charger aggregate rating inside transaction
    const [review] = await prisma.$transaction(async (tx) => {
      const newReview = await tx.review.create({
        data: {
          bookingId,
          reviewerId,
          chargerId,
          rating: starRating,
          comment: comment ? comment.trim() : null,
        },
        include: {
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      // Recalculate charger aggregate rating
      const aggregation = await tx.review.aggregate({
        where: { chargerId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const avgRating = aggregation._avg.rating !== null ? Math.round(aggregation._avg.rating * 100) / 100 : 0.00;
      const totalReviews = aggregation._count.rating || 0;

      await tx.charger.update({
        where: { id: chargerId },
        data: {
          avgRating,
          totalReviews,
        },
      });

      return [newReview];
    });

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review submitted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated reviews for a specific charger. Public endpoint.
 * Supports both /api/chargers/:id/reviews and /api/reviews/charger/:chargerId
 */
export const getChargerReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chargerId = req.params.chargerId || req.params.id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * limit;

    // Verify charger exists
    const charger = await prisma.charger.findUnique({
      where: { id: chargerId },
      select: { id: true, title: true, avgRating: true, totalReviews: true },
    });

    if (!charger) {
      throw new AppError('Charger not found.', 404);
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { chargerId },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.review.count({ where: { chargerId } }),
    ]);

    res.json({
      success: true,
      data: reviews,
      meta: {
        avgRating: Number(charger.avgRating || 0),
        totalReviews: charger.totalReviews || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check review status for a specific booking.
 */
export const getBookingReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: { select: { status: true } },
        review: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    });

    if (!booking) {
      throw new AppError('Booking not found.', 404);
    }

    if (booking.seekerId !== userId) {
      throw new AppError('You do not have permission to view review status for this booking.', 403);
    }

    const isPaid = booking.payment?.status === 'COMPLETED';
    const isCompleted = booking.status === 'COMPLETED';
    const hasReviewed = !!booking.review;
    const canReview = isCompleted && isPaid && !hasReviewed;

    res.json({
      success: true,
      data: {
        canReview,
        hasReviewed,
        review: booking.review || null,
        bookingStatus: booking.status,
        paymentStatus: booking.payment?.status || 'UNPAID',
      },
    });
  } catch (error) {
    next(error);
  }
};
