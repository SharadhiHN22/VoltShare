import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { DEFAULT_PAGE_SIZE, DEFAULT_SEARCH_RADIUS_KM, ChargerSearchResult } from '@voltshare/shared';
import { Prisma } from '@prisma/client';
import { fetchNearbyOpenChargeMapStations } from '../services/openChargeMap.service';

/**
 * Search for chargers near a location using MySQL 8.0 spatial ST_Distance_Sphere.
 * Supports filtering by charger type, connector type, max price, min rating, and radius.
 * Returns paginated results ordered by distance.
 */
export const searchChargers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      latitude,
      longitude,
      radiusKm = DEFAULT_SEARCH_RADIUS_KM,
      chargerType,
      connectorType,
      maxPricePerKwh,
      minRating,
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
    } = req.query as unknown as {
      latitude: number;
      longitude: number;
      radiusKm?: number;
      chargerType?: string;
      connectorType?: string;
      maxPricePerKwh?: number;
      minRating?: number;
      page?: number;
      limit?: number;
    };

    const parsedLat = Number(latitude);
    const parsedLng = Number(longitude);
    const parsedRadiusKm = Number(radiusKm);
    const parsedLimit = Number(limit);
    const parsedPage = Number(page);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      throw new AppError('Valid latitude and longitude are required.', 400);
    }
    if (!Number.isFinite(parsedRadiusKm) || parsedRadiusKm <= 0) {
      throw new AppError('Valid radiusKm is required.', 400);
    }

    const offset = (parsedPage - 1) * parsedLimit;
    const radiusMeters = parsedRadiusKm * 1000;

    // MySQL 8.0 ST_Distance_Sphere uses ST_SRID(POINT(longitude, latitude), 4326)
    // or standard ST_Distance_Sphere(POINT(lng1, lat1), POINT(lng2, lat2)) in meters
    const conditions: string[] = [
      `c.status = 'ACTIVE'`,
      `ST_Distance_Sphere(POINT(c.longitude, c.latitude), POINT(${parsedLng}, ${parsedLat})) <= ${radiusMeters}`,
    ];

    const ALLOWED_CHARGER_TYPES = ['LEVEL_1', 'LEVEL_2', 'DC_FAST'];
    const ALLOWED_CONNECTOR_TYPES = ['TYPE_1', 'TYPE_2', 'CCS_1', 'CCS_2', 'CHAdeMO', 'TESLA', 'GB_T'];

    if (chargerType) {
      if (!ALLOWED_CHARGER_TYPES.includes(String(chargerType))) {
        throw new AppError('Invalid chargerType filter.', 400);
      }
      conditions.push(`c.chargerType = '${chargerType}'`);
    }
    if (connectorType) {
      if (!ALLOWED_CONNECTOR_TYPES.includes(String(connectorType))) {
        throw new AppError('Invalid connectorType filter.', 400);
      }
      conditions.push(`c.connectorType = '${connectorType}'`);
    }
    if (maxPricePerKwh !== undefined) {
      const parsedMaxPrice = Number(maxPricePerKwh);
      if (!Number.isFinite(parsedMaxPrice) || parsedMaxPrice < 0) {
        throw new AppError('Invalid maxPricePerKwh filter.', 400);
      }
      conditions.push(`c.pricePerKwh <= ${parsedMaxPrice}`);
    }
    if (minRating !== undefined) {
      const parsedMinRating = Number(minRating);
      if (!Number.isFinite(parsedMinRating) || parsedMinRating < 0 || parsedMinRating > 5) {
        throw new AppError('Invalid minRating filter.', 400);
      }
      conditions.push(`c.avgRating >= ${parsedMinRating}`);
    }

    const whereClause = conditions.join(' AND ');

    // 1. Fetch VoltShare chargers from MySQL ordered by distance
    const voltshareChargersRaw = await prisma.$queryRawUnsafe<
      Array<Record<string, unknown>>
    >(
      `SELECT
         c.id,
         c.hostId,
         c.title,
         c.description,
         CAST(c.latitude AS DOUBLE) AS latitude,
         CAST(c.longitude AS DOUBLE) AS longitude,
         c.address,
         c.chargerType,
         c.connectorType,
         CAST(c.kwRating AS DOUBLE) AS kwRating,
         CAST(c.pricePerKwh AS DOUBLE) AS pricePerKwh,
         CAST(c.pricePerHour AS DOUBLE) AS pricePerHour,
         c.status,
         c.availabilityHours,
         c.photoUrls,
         CAST(c.avgRating AS DOUBLE) AS avgRating,
         c.totalReviews,
         c.isPublicStation,
         c.createdAt,
         c.updatedAt,
         u.name AS hostName,
         u.avatarUrl AS hostAvatarUrl,
         ROUND(
           ST_Distance_Sphere(POINT(c.longitude, c.latitude), POINT(${parsedLng}, ${parsedLat})) / 1000.0, 2
         ) AS distanceKm
       FROM chargers c
       JOIN users u ON u.id = c.hostId
       WHERE ${whereClause}
       ORDER BY distanceKm ASC`,
    );

    const voltshareChargers: ChargerSearchResult[] = voltshareChargersRaw.map((c) => ({
      ...c,
      source: 'VOLTShare' as const,
      isExternal: false,
    } as unknown as ChargerSearchResult));

    // 2. Fetch external public EV stations from Open Charge Map
    let externalStations: ChargerSearchResult[] = [];
    try {
      externalStations = await fetchNearbyOpenChargeMapStations(parsedLat, parsedLng, parsedRadiusKm);
    } catch (ocmErr) {
      console.warn('[OpenChargeMap] Error while querying external stations:', ocmErr);
      externalStations = [];
    }

    // 3. Filter external stations using user criteria if supplied
    if (chargerType) {
      externalStations = externalStations.filter((s) => s.chargerType === chargerType);
    }
    if (connectorType) {
      externalStations = externalStations.filter(
        (s) =>
          s.connectorType === connectorType ||
          s.connectionsList?.some((c) => c.connectorType === connectorType)
      );
    }
    if (maxPricePerKwh !== undefined) {
      // External stations don't specify VoltShare kWh rates; only retain if explicitly free (pricePerKwh === 0)
      externalStations = externalStations.filter(
        (s) => s.pricePerKwh !== undefined && s.pricePerKwh <= Number(maxPricePerKwh)
      );
    }
    if (minRating !== undefined && Number(minRating) > 0) {
      // External stations don't have VoltShare platform ratings; exclude if minimum rating is specified
      externalStations = externalStations.filter(
        (s) => s.avgRating !== undefined && s.avgRating >= Number(minRating)
      );
    }

    // 4. Combine VoltShare chargers and Open Charge Map stations
    const combinedChargers: ChargerSearchResult[] = [
      ...voltshareChargers,
      ...externalStations,
    ];

    // 5. Sort combined list by nearest distance (ascending)
    combinedChargers.sort((a, b) => Number(a.distanceKm || 0) - Number(b.distanceKm || 0));

    // 6. Paginate combined list
    const total = combinedChargers.length;
    const paginated = combinedChargers.slice(offset, offset + parsedLimit);

    res.json({
      success: true,
      data: paginated,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single charger by ID, including host info and recent reviews.
 */
export const getChargerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (id.startsWith('ocm-')) {
      throw new AppError('Public charging stations from Open Charge Map cannot be booked via VoltShare.', 400);
    }

    const charger = await prisma.charger.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, name: true, avatarUrl: true },
        },
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!charger) {
      throw new AppError('Charger not found.', 404);
    }

    res.json({ success: true, data: charger });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new charger listing. Status defaults to PENDING_APPROVAL.
 * Only users with the HOST role should call this.
 */
export const createCharger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hostId = req.user!.id;

    const charger = await prisma.charger.create({
      data: {
        ...req.body,
        hostId,
        status: 'ACTIVE',
        photoUrls: req.body.photoUrls || [],
      },
    });

    res.status(201).json({ success: true, data: charger });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing charger. Only the charger's host may update it.
 */
export const updateCharger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const hostId = req.user!.id;

    const existing = await prisma.charger.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Charger not found.', 404);
    }
    if (existing.hostId !== hostId) {
      throw new AppError('You can only update your own chargers.', 403);
    }

    // Remove fields the host should not overwrite directly
    const { hostId: _h, id: _i, status: _s, avgRating: _a, totalReviews: _t, ...updateData } = req.body;

    const charger = await prisma.charger.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, data: charger });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle a charger's status between ACTIVE and INACTIVE.
 * Only the charger's host may toggle.
 */
export const toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const hostId = req.user!.id;

    const existing = await prisma.charger.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Charger not found.', 404);
    }
    if (existing.hostId !== hostId) {
      throw new AppError('You can only update your own chargers.', 403);
    }

    if (existing.status !== 'ACTIVE' && existing.status !== 'INACTIVE' && existing.status !== 'PENDING_APPROVAL') {
      throw new AppError(
        `Cannot toggle status. Current status is ${existing.status}.`,
        400,
      );
    }

    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const charger = await prisma.charger.update({
      where: { id },
      data: { status: newStatus },
    });

    res.json({ success: true, data: charger });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a charger. Only the charger's host may delete it.
 */
export const deleteCharger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const hostId = req.user!.id;

    const existing = await prisma.charger.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Charger not found.', 404);
    }
    if (existing.hostId !== hostId) {
      throw new AppError('You can only delete your own chargers.', 403);
    }

    await prisma.charger.delete({ where: { id } });

    res.json({ success: true, message: 'Charger deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all chargers owned by the authenticated host.
 */
export const getMyChargers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hostId = req.user!.id;

    const chargers = await prisma.charger.findMany({
      where: { hostId },
      include: {
        _count: {
          select: { bookings: true, reviews: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: chargers });
  } catch (error) {
    next(error);
  }
};

/**
 * Geocode a user-provided address or location query using Nominatim / OpenStreetMap.
 */
export const geocodeLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query.q as string;
    if (!query || !query.trim()) {
      throw new AppError('Search query parameter "q" is required.', 400);
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VoltShare-EV-Charging-Platform/1.0 (voltshare@voltshare.internal)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new AppError(`Geocoding service responded with status ${response.status}`, 502);
    }

    const results = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (!Array.isArray(results) || results.length === 0) {
      throw new AppError(`Location "${query}" not found. Please try a different search term.`, 404);
    }

    const first = results[0];
    res.json({
      success: true,
      data: {
        latitude: parseFloat(first.lat),
        longitude: parseFloat(first.lon),
        displayName: first.display_name,
      },
    });
  } catch (error) {
    next(error);
  }
};
