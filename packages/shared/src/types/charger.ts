// ── Charger Types ────────────────────────────────────

export enum ChargerType {
  LEVEL_1 = 'LEVEL_1',
  LEVEL_2 = 'LEVEL_2',
  DC_FAST = 'DC_FAST',
}

export enum ConnectorType {
  TYPE_1 = 'TYPE_1', // J1772
  TYPE_2 = 'TYPE_2', // Mennekes
  CCS_1 = 'CCS_1',
  CCS_2 = 'CCS_2',
  CHADEMO = 'CHAdeMO',
  TESLA = 'TESLA',
  GB_T = 'GB_T',
}

export enum ChargerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  REJECTED = 'REJECTED',
}

export interface AvailabilitySlot {
  day: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // "08:00"
  endTime: string; // "20:00"
}

export interface Charger {
  id: string;
  hostId: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  address: string;
  chargerType: ChargerType;
  connectorType: ConnectorType;
  kwRating: number;
  pricePerKwh?: number;
  pricePerHour?: number;
  status: ChargerStatus;
  availabilityHours: AvailabilitySlot[];
  photoUrls: string[];
  avgRating: number;
  totalReviews: number;
  isPublicStation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChargerInput {
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  address: string;
  chargerType: ChargerType;
  connectorType: ConnectorType;
  kwRating: number;
  pricePerKwh?: number;
  pricePerHour?: number;
  availabilityHours: AvailabilitySlot[];
  photoUrls?: string[];
}

export interface ChargerSearchParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  chargerType?: ChargerType;
  connectorType?: ConnectorType;
  maxPricePerKwh?: number;
  minRating?: number;
  page?: number;
  limit?: number;
}

export interface ChargerSearchResult extends Charger {
  distanceKm: number;
  hostName: string;
  hostAvatarUrl?: string;
  source?: 'VOLTShare' | 'EXTERNAL';
  operatorName?: string;
  isExternal?: boolean;
  externalUrl?: string;
  directionsUrl?: string;
  connectionsList?: Array<{
    connectorType: string;
    powerKW?: number;
    quantity?: number;
    level?: string;
  }>;
}
