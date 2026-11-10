import axios from 'axios';
import { config } from '../config';
import {
  ChargerSearchResult,
  ChargerType,
  ConnectorType,
  ChargerStatus,
} from '@voltshare/shared';

// In-memory cache to respect Open Charge Map fair use and prevent redundant API calls
interface CacheEntry {
  data: ChargerSearchResult[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Calculates Great-Circle distance using Haversine formula in kilometers.
 * Accurate for all global GPS coordinates.
 */
export const calculateHaversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
};

/**
 * Maps Open Charge Map ConnectionType to VoltShare ConnectorType.
 */
export const mapOpenChargeMapConnectorType = (connection: any): ConnectorType => {
  const connId = Number(connection?.ConnectionTypeID || connection?.ConnectionType?.ID);
  const title = String(connection?.ConnectionType?.Title || '').toLowerCase();
  const formalName = String(connection?.ConnectionType?.FormalName || '').toLowerCase();

  // CCS Type 2
  if (connId === 33 || title.includes('ccs (type 2)') || title.includes('ccs 2') || formalName.includes('combo 2')) {
    return ConnectorType.CCS_2;
  }
  // CCS Type 1
  if (connId === 32 || title.includes('ccs (type 1)') || title.includes('ccs 1') || formalName.includes('combo 1')) {
    return ConnectorType.CCS_1;
  }
  // Type 2 Mennekes
  if (connId === 25 || connId === 1036 || title.includes('type 2') || title.includes('mennekes')) {
    return ConnectorType.TYPE_2;
  }
  // Type 1 J1772
  if (connId === 1 || title.includes('type 1') || title.includes('j1772')) {
    return ConnectorType.TYPE_1;
  }
  // CHAdeMO
  if (connId === 2 || title.includes('chademo')) {
    return ConnectorType.CHADEMO;
  }
  // Tesla / NACS
  if (connId === 8 || connId === 27 || connId === 30 || title.includes('tesla') || title.includes('nacs')) {
    return ConnectorType.TESLA;
  }
  // GB/T
  if (connId === 1041 || connId === 1042 || title.includes('gb/t') || title.includes('gbt')) {
    return ConnectorType.GB_T;
  }

  return ConnectorType.TYPE_2;
};

/**
 * Maps Open Charge Map connection levels / power to VoltShare ChargerType.
 */
export const mapOpenChargeMapChargerType = (connections: any[] = []): ChargerType => {
  let isDCFast = false;
  let isLevel2 = false;

  for (const conn of connections) {
    const power = Number(conn?.PowerKW || 0);
    const levelId = Number(conn?.LevelID || conn?.Level?.ID || 0);
    const isFastCapable = Boolean(conn?.Level?.IsFastChargeCapable);
    const isDC = String(conn?.CurrentType?.Title || '').toUpperCase() === 'DC';

    if (power >= 30 || levelId === 3 || isFastCapable || isDC) {
      isDCFast = true;
      break;
    }
    if (power >= 7 || levelId === 2) {
      isLevel2 = true;
    }
  }

  if (isDCFast) return ChargerType.DC_FAST;
  if (isLevel2) return ChargerType.LEVEL_2;
  return ChargerType.LEVEL_1;
};

/**
 * Normalizes an Open Charge Map POI into VoltShare's ChargerSearchResult format.
 */
export const normalizeOpenChargeMapStation = (
  item: any,
  userLat: number,
  userLng: number
): ChargerSearchResult | null => {
  const stationLat = Number(item?.AddressInfo?.Latitude);
  const stationLng = Number(item?.AddressInfo?.Longitude);

  if (!Number.isFinite(stationLat) || !Number.isFinite(stationLng)) {
    return null;
  }

  const connections = Array.isArray(item?.Connections) ? item.Connections : [];
  const primaryConn = connections[0] || {};
  const connectorType = mapOpenChargeMapConnectorType(primaryConn);
  const chargerType = mapOpenChargeMapChargerType(connections);

  // Determine highest kW rating from connections, fallback gracefully
  let maxKw = 0;
  for (const conn of connections) {
    const kw = Number(conn?.PowerKW || 0);
    if (kw > maxKw) maxKw = kw;
  }
  if (maxKw === 0) {
    maxKw = chargerType === ChargerType.DC_FAST ? 50 : chargerType === ChargerType.LEVEL_2 ? 22 : 3.3;
  }

  // Address assembly
  const addr = item?.AddressInfo;
  const addressParts = [
    addr?.AddressLine1,
    addr?.AddressLine2,
    addr?.Town,
    addr?.StateOrProvince,
    addr?.Postcode,
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ') || 'Public EV Station';

  const operatorName = item?.OperatorInfo?.Title || 'Public Charging Network';
  const stationTitle = addr?.Title || operatorName || 'Public EV Charging Station';
  const distanceKm = calculateHaversineDistanceKm(userLat, userLng, stationLat, stationLng);

  const connectionsList = connections.map((c: any) => ({
    connectorType: mapOpenChargeMapConnectorType(c),
    powerKW: c?.PowerKW ? Number(c.PowerKW) : undefined,
    quantity: c?.Quantity ? Number(c.Quantity) : 1,
    level: c?.Level?.Title || (c?.PowerKW >= 30 ? 'DC Fast' : 'AC Standard'),
  }));

  const mediaUrls: string[] = [];
  if (Array.isArray(item?.MediaItems)) {
    for (const m of item.MediaItems) {
      if (m?.ItemURL) mediaUrls.push(m.ItemURL);
    }
  }

  return {
    id: `ocm-${item.ID}`,
    hostId: 'open-charge-map',
    title: stationTitle,
    description:
      item?.GeneralComments ||
      addr?.AccessComments ||
      item?.OperatorInfo?.Comments ||
      `Public EV station operated by ${operatorName}. Data provided by Open Charge Map.`,
    latitude: stationLat,
    longitude: stationLng,
    address: fullAddress,
    chargerType,
    connectorType,
    kwRating: maxKw,
    pricePerKwh: undefined, // Do not invent fake pricing
    pricePerHour: undefined,
    status: ChargerStatus.ACTIVE,
    availabilityHours: [],
    photoUrls: mediaUrls,
    avgRating: 0,
    totalReviews: 0,
    isPublicStation: true,
    source: 'EXTERNAL',
    isExternal: true,
    hostName: operatorName,
    operatorName,
    externalUrl: item?.OperatorInfo?.WebsiteURL || addr?.RelatedURL || 'https://openchargemap.org',
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${stationLat},${stationLng}`,
    distanceKm,
    connectionsList,
    createdAt: item?.DateCreated ? new Date(item.DateCreated) : new Date(),
    updatedAt: item?.DateLastStatusUpdate ? new Date(item.DateLastStatusUpdate) : new Date(),
  };
};

/**
 * Fetches nearby charging stations from Open Charge Map API.
 * Handles timeouts, network failures, and missing keys safely without breaking VoltShare.
 */
export const fetchNearbyOpenChargeMapStations = async (
  latitude: number,
  longitude: number,
  radiusKm: number = 15
): Promise<ChargerSearchResult[]> => {
  const apiKey = config.openChargeMapApiKey;

  if (!apiKey || apiKey.trim() === '') {
    console.log('[OpenChargeMap] API key not configured. Returning VoltShare stations only.');
    return [];
  }

  // Validate coordinates and radius
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || radiusKm <= 0) {
    return [];
  }

  // Cache key rounded to ~1km grid (2 decimal places) to throttle repeated queries
  const cacheKey = `ocm_${latitude.toFixed(2)}_${longitude.toFixed(2)}_${Math.round(radiusKm)}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    // Re-calculate exact distance based on current exact GPS coords and return
    return cached.data.map((station) => ({
      ...station,
      distanceKm: calculateHaversineDistanceKm(latitude, longitude, station.latitude, station.longitude),
    }));
  }

  try {
    const url = 'https://api.openchargemap.io/v3/poi/';
    const response = await axios.get(url, {
      params: {
        output: 'json',
        latitude,
        longitude,
        distance: radiusKm,
        distanceunit: 'KM',
        maxresults: 50,
      },
      headers: {
        'X-API-Key': apiKey,
        'User-Agent': 'VoltShare/1.0',
        Accept: 'application/json',
      },
      timeout: 6000, // 6 second safety timeout
    });

    if (!Array.isArray(response.data)) {
      return [];
    }

    const stations: ChargerSearchResult[] = [];
    for (const item of response.data) {
      const normalized = normalizeOpenChargeMapStation(item, latitude, longitude);
      if (normalized && normalized.distanceKm <= radiusKm) {
        stations.push(normalized);
      }
    }

    // Cache the result
    cache.set(cacheKey, { data: stations, timestamp: now });

    // Periodically prune stale cache entries (keep under 200 items)
    if (cache.size > 200) {
      for (const [k, v] of cache.entries()) {
        if (now - v.timestamp >= CACHE_TTL_MS) {
          cache.delete(k);
        }
      }
    }

    return stations;
  } catch (error: any) {
    // Log safely without exposing the API key
    const msg = error?.response?.data?.message || error?.message || 'Network request failed';
    console.warn(`[OpenChargeMap] External station fetch failed: ${msg}. Falling back to VoltShare database only.`);
    return [];
  }
};
