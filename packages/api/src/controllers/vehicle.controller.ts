import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

/**
 * Get all vehicles saved by the authenticated EV Driver (SEEKER).
 */
export const getVehicles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;

    const vehicles = await prisma.vehicle.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: vehicles,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a new vehicle for the authenticated EV Driver (SEEKER).
 * Never trusts client-provided userId; always binds to req.user!.id.
 */
export const createVehicle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { make, model, year, connectorType, batteryCapacity, registrationNumber } = req.body;

    const vehicle = await prisma.vehicle.create({
      data: {
        userId,
        make: make.trim(),
        model: model.trim(),
        year: Number(year),
        connectorType,
        batteryCapacity: batteryCapacity !== undefined && batteryCapacity !== null ? Number(batteryCapacity) : null,
        registrationNumber: registrationNumber ? registrationNumber.trim().toUpperCase() : null,
      },
    });

    res.status(201).json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};
