import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { createNotification } from '../services/notification.service';
import type { BookingStatus } from '@voltshare/shared';

/**
 * Create a new booking for a charger.
 * Validates the charger is ACTIVE, checks for time-slot overlaps,
 * calculates the total amount, and generates a QR code identifier.
 */
export const createBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const seekerId = req.user!.id;
    const { chargerId, startTime, endTime, notes, vehicleId, currentBattery, targetBattery } = req.body;

    // Verify charger exists and is active
    const charger = await prisma.charger.findUnique({ where: { id: chargerId } });
    if (!charger) {
      throw new AppError('Charger not found.', 404);
    }
    if (charger.status !== 'ACTIVE') {
      throw new AppError('This charger is not currently available for booking.', 400);
    }

    // Prevent host from booking their own charger
    if (charger.hostId === seekerId) {
      throw new AppError('You cannot book your own charger.', 400);
    }

    // Verify vehicle ownership and authenticity if provided
    let vehicle = null;
    if (vehicleId) {
      vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle) {
        throw new AppError('Vehicle not found.', 404);
      }
      if (vehicle.userId !== seekerId) {
        throw new AppError('You can only use vehicles saved to your account.', 403);
      }
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    // Check for overlapping bookings (excluding CANCELLED ones)
    const overlapping = await prisma.booking.findFirst({
      where: {
        chargerId,
        status: { notIn: ['CANCELLED'] },
        OR: [
          { startTime: { lt: end }, endTime: { gt: start } },
        ],
      },
    });

    if (overlapping) {
      throw new AppError('This time slot is already booked. Please select a different time.', 409);
    }

    // Calculate total amount: vehicle-aware when vehicle battery capacity is available
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    let totalAmount = 0;
    let calculatedEnergyKwh: number | undefined;

    if (
      vehicle &&
      vehicle.batteryCapacity &&
      currentBattery !== undefined &&
      targetBattery !== undefined
    ) {
      if (currentBattery < 0 || currentBattery > 100) {
        throw new AppError('Current battery percentage must be between 0 and 100.', 400);
      }
      if (targetBattery < 0 || targetBattery > 100) {
        throw new AppError('Target battery percentage must be between 0 and 100.', 400);
      }
      if (targetBattery <= currentBattery) {
        throw new AppError('Target battery must be greater than current battery percentage.', 400);
      }

      // Energy required in kWh: BatteryCapacity × (Target - Current) / 100
      const batteryCapacity = Number(vehicle.batteryCapacity);
      const energyNeeded = batteryCapacity * ((targetBattery - currentBattery) / 100);
      const boundedEnergy = Math.min(energyNeeded, batteryCapacity);
      calculatedEnergyKwh = Math.round(boundedEnergy * 100) / 100;

      if (charger.pricePerKwh) {
        totalAmount = Number(charger.pricePerKwh) * boundedEnergy;
      } else if (charger.pricePerHour) {
        totalAmount = Number(charger.pricePerHour) * durationHours;
      }
    } else {
      // Fallback when battery capacity is not specified or vehicle is omitted
      if (charger.pricePerHour) {
        totalAmount = Number(charger.pricePerHour) * durationHours;
      } else if (charger.pricePerKwh) {
        const estimatedKwh = Number(charger.kwRating) * durationHours;
        calculatedEnergyKwh = Math.round(estimatedKwh * 100) / 100;
        totalAmount = Number(charger.pricePerKwh) * estimatedKwh;
      }
    }

    totalAmount = Math.round(totalAmount * 100) / 100; // Round to 2 decimals

    // Generate a unique QR code string for check-in
    const qrCode = uuidv4();

    const booking = await prisma.booking.create({
      data: {
        seekerId,
        chargerId,
        startTime: start,
        endTime: end,
        totalAmount,
        qrCode,
        notes,
        status: 'PENDING',
      },
      include: {
        charger: {
          select: { title: true, address: true, chargerType: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...booking,
        estimatedKwh: calculatedEnergyKwh,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all bookings for the authenticated user.
 * Returns bookings where the user is either the seeker or the host of the charger.
 */
export const getUserBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    const bookings = await prisma.booking.findMany({
      where: role === 'HOST'
        ? { charger: { hostId: userId } }
        : { seekerId: userId },
      include: {
        charger: {
          select: {
            id: true,
            title: true,
            address: true,
            chargerType: true,
            photoUrls: true,
          },
        },
        seeker: {
          select: { id: true, name: true, avatarUrl: true },
        },
        payment: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
        review: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single booking by ID with full details.
 */
export const getBookingById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        charger: {
          include: {
            host: { select: { id: true, name: true, avatarUrl: true, phone: true } },
          },
        },
        seeker: {
          select: { id: true, name: true, avatarUrl: true, phone: true },
        },
        payment: true,
        review: true,
      },
    });

    if (!booking) {
      throw new AppError('Booking not found.', 404);
    }

    // Only the seeker or the charger host may view the booking
    if (booking.seekerId !== userId && booking.charger.hostId !== userId) {
      throw new AppError('You do not have permission to view this booking.', 403);
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

// ── Valid status transitions ────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED'],
};

/**
 * Update a booking's status.
 * Enforces valid status transitions:
 *   PENDING → CONFIRMED | CANCELLED
 *   CONFIRMED → ACTIVE | CANCELLED
 *   ACTIVE → COMPLETED
 */
export const updateBookingStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: BookingStatus };
    const userId = req.user!.id;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { charger: true },
    });

    if (!booking) {
      throw new AppError('Booking not found.', 404);
    }

    // Only the seeker or charger host may modify status
    if (booking.seekerId !== userId && booking.charger.hostId !== userId) {
      throw new AppError('You do not have permission to update this booking.', 403);
    }

    const allowed = VALID_TRANSITIONS[booking.status];
    if (!allowed || !allowed.includes(status)) {
      throw new AppError(
        `Cannot transition from ${booking.status} to ${status}.`,
        400,
      );
    }

    const operations: any[] = [
      prisma.booking.update({
        where: { id },
        data: { status },
      }),
    ];

    if (status === 'CANCELLED') {
      const existingPayment = await prisma.payment.findUnique({
        where: { bookingId: id },
      });
      if (existingPayment && existingPayment.status === 'PENDING') {
        operations.push(
          prisma.payment.update({
            where: { id: existingPayment.id },
            data: { status: 'FAILED' },
          }),
        );
      }
    }

    const [updated] = await prisma.$transaction(operations);

    // Send notifications based on the status transition
    const chargerTitle = booking.charger?.title || 'the station';

    if (status === 'CANCELLED') {
      await Promise.allSettled([
        // Notify driver
        createNotification({
          userId: booking.seekerId,
          type: 'BOOKING_CANCELLED',
          title: 'Booking cancelled',
          message: `Your booking at ${chargerTitle} has been cancelled.`,
        }),
        // Notify host
        booking.charger?.hostId
          ? createNotification({
              userId: booking.charger.hostId,
              type: 'BOOKING_CANCELLED',
              title: 'Booking cancelled',
              message: `A booking for your charger ${chargerTitle} has been cancelled.`,
            })
          : Promise.resolve(),
      ]);
    } else if (status === 'COMPLETED') {
      // Notify driver
      await createNotification({
        userId: booking.seekerId,
        type: 'CHARGING_COMPLETED',
        title: 'Charging completed',
        message: `Your charging session at ${chargerTitle} is completed.`,
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a booking explicitly.
 * Endpoint: POST /api/bookings/:id/cancel or PATCH /api/bookings/:id/cancel
 * Verifies:
 *  - User is authenticated
 *  - Booking belongs to current seeker (or charger host)
 *  - Booking is not already COMPLETED, ACTIVE, or CANCELLED
 *  - Associated unpaid pending payment safely marked as FAILED (never COMPLETED)
 */
export const cancelBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { charger: true, payment: true },
    });

    if (!booking) {
      throw new AppError('Booking not found.', 404);
    }

    // Security: Only the seeker who created the booking (or host of the charger) may cancel
    if (booking.seekerId !== userId && booking.charger.hostId !== userId) {
      throw new AppError('You are not authorized to cancel this booking.', 403);
    }

    if (booking.status === 'CANCELLED') {
      throw new AppError('This booking has already been cancelled.', 400);
    }

    if (booking.status === 'COMPLETED') {
      throw new AppError('Cannot cancel an already completed charging session.', 400);
    }

    if (booking.status === 'ACTIVE') {
      throw new AppError('Cannot cancel an active charging session.', 400);
    }

    const operations: any[] = [
      prisma.booking.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),
    ];

    if (booking.payment && booking.payment.status === 'PENDING') {
      operations.push(
        prisma.payment.update({
          where: { id: booking.payment.id },
          data: { status: 'FAILED' },
        }),
      );
    }

    const [updatedBooking] = await prisma.$transaction(operations);

    // Send notifications to driver and host
    const chargerTitle = booking.charger?.title || 'the station';
    await Promise.allSettled([
      createNotification({
        userId: booking.seekerId,
        type: 'BOOKING_CANCELLED',
        title: 'Booking cancelled',
        message: `Your booking at ${chargerTitle} has been cancelled.`,
      }),
      booking.charger?.hostId
        ? createNotification({
            userId: booking.charger.hostId,
            type: 'BOOKING_CANCELLED',
            title: 'Booking cancelled',
            message: `A booking for your charger ${chargerTitle} has been cancelled.`,
          })
        : Promise.resolve(),
    ]);

    res.json({
      success: true,
      message: 'Booking cancelled successfully.',
      data: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check in to a confirmed booking, transitioning its status to ACTIVE.
 * Endpoint: POST/PATCH /api/bookings/:id/check-in
 * Verifies:
 *  - User is authenticated
 *  - Booking belongs to current seeker (or host)
 *  - Booking is in CONFIRMED state (paid)
 *  - Transitions status to ACTIVE
 */
export const checkInBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { charger: true, payment: true },
    });

    if (!booking) {
      throw new AppError('Booking not found.', 404);
    }

    if (booking.seekerId !== userId && booking.charger.hostId !== userId) {
      throw new AppError('You are not authorized to check in for this booking.', 403);
    }

    if (booking.status === 'ACTIVE') {
      res.json({ success: true, message: 'Charging session is already active.', data: booking });
      return;
    }

    if (booking.status === 'COMPLETED') {
      throw new AppError('Cannot check in to an already completed charging session.', 400);
    }

    if (booking.status === 'CANCELLED') {
      throw new AppError('Cannot check in to a cancelled booking.', 400);
    }

    if (booking.status !== 'CONFIRMED') {
      throw new AppError(`Booking must be paid and confirmed before check-in. Current status: ${booking.status}.`, 400);
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: { charger: true, payment: true },
    });

    res.json({
      success: true,
      message: 'Check-in successful. Charging session is now active.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete an active charging session, transitioning its status to COMPLETED.
 * Endpoint: POST/PATCH /api/bookings/:id/complete
 * Verifies:
 *  - User is authenticated
 *  - Booking belongs to current seeker (or host)
 *  - Booking is in ACTIVE state (driver has checked in)
 *  - Transitions status to COMPLETED
 *  - Dispatches CHARGING_COMPLETED notification
 */
export const completeBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { charger: true, payment: true },
    });

    if (!booking) {
      throw new AppError('Booking not found.', 404);
    }

    if (booking.seekerId !== userId && booking.charger.hostId !== userId) {
      throw new AppError('You are not authorized to complete this session.', 403);
    }

    if (booking.status === 'COMPLETED') {
      throw new AppError('Charging session is already completed.', 400);
    }

    if (booking.status !== 'ACTIVE') {
      throw new AppError(`Charging session must be ACTIVE to be completed. Current status: ${booking.status}.`, 400);
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: { charger: true, payment: true },
    });

    const chargerTitle = booking.charger?.title || 'the station';
    await createNotification({
      userId: booking.seekerId,
      type: 'CHARGING_COMPLETED',
      title: 'Charging completed',
      message: `Your charging session at ${chargerTitle} is completed.`,
    });

    res.json({
      success: true,
      message: 'Charging session completed successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
