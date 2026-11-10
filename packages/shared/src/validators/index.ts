import { z } from 'zod';

// ── Auth Validators ──────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().optional(),
  role: z.enum(['SEEKER', 'HOST']),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ── Charger Validators ──────────────────────────────

const availabilitySlotSchema = z.object({
  day: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
});

export const createChargerSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(1000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(5, 'Address is required'),
  chargerType: z.enum(['LEVEL_1', 'LEVEL_2', 'DC_FAST']),
  connectorType: z.enum(['TYPE_1', 'TYPE_2', 'CCS_1', 'CCS_2', 'CHAdeMO', 'TESLA', 'GB_T']),
  kwRating: z.number().positive('kW rating must be positive'),
  pricePerKwh: z.number().min(0).optional(),
  pricePerHour: z.number().min(0).optional(),
  availabilityHours: z.array(availabilitySlotSchema).min(1, 'At least one availability slot required'),
  photoUrls: z.array(z.string().url()).optional(),
});

export const searchChargersSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.5).max(50).optional().default(10),
  chargerType: z.enum(['LEVEL_1', 'LEVEL_2', 'DC_FAST']).optional(),
  connectorType: z
    .enum(['TYPE_1', 'TYPE_2', 'CCS_1', 'CCS_2', 'CHAdeMO', 'TESLA', 'GB_T'])
    .optional(),
  maxPricePerKwh: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ── Booking Validators ──────────────────────────────

export const createBookingSchema = z
  .object({
    chargerId: z.string().uuid('Invalid charger ID'),
    startTime: z.string().datetime('Invalid start time'),
    endTime: z.string().datetime('Invalid end time'),
    notes: z.string().max(500).optional(),
    vehicleId: z.string().uuid('Invalid vehicle ID').optional(),
    currentBattery: z.number().min(0, 'Current battery must be between 0% and 100%').max(100, 'Current battery must be between 0% and 100%').optional(),
    targetBattery: z.number().min(0, 'Target battery must be between 0% and 100%').max(100, 'Target battery must be between 0% and 100%').optional(),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
  .refine(
    (data) => {
      if (data.currentBattery !== undefined && data.targetBattery !== undefined) {
        return data.targetBattery > data.currentBattery;
      }
      return true;
    },
    {
      message: 'Target battery percentage must be greater than current battery percentage',
      path: ['targetBattery'],
    }
  );

// ── Review Validators ───────────────────────────────

export const createReviewSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  chargerId: z.string().uuid('Invalid charger ID').optional(),
  rating: z.coerce.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  comment: z.string().max(500, 'Review cannot exceed 500 characters').optional(),
});

// ── Vehicle Validators ──────────────────────────────
export const createVehicleSchema = z.object({
  make: z.string().min(1, 'Make/Brand is required').max(50),
  model: z.string().min(1, 'Model is required').max(50),
  year: z.coerce.number().int().min(1990, 'Year must be 1990 or later').max(new Date().getFullYear() + 1, 'Invalid model year'),
  connectorType: z.enum(['TYPE_1', 'TYPE_2', 'CCS_1', 'CCS_2', 'CHAdeMO', 'TESLA', 'GB_T']),
  batteryCapacity: z.coerce.number().positive('Battery capacity must be positive').max(300).optional(),
  registrationNumber: z.string().max(50).optional(),
});

// Export types inferred from schemas
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateChargerInput = z.infer<typeof createChargerSchema>;
export type SearchChargersInput = z.infer<typeof searchChargersSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateVehicleSchemaInput = z.infer<typeof createVehicleSchema>;
