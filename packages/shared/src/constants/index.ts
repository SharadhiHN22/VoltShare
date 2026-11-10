// ── Platform Constants ───────────────────────────────

export const PLATFORM_FEE_PERCENT = 10;

export const DEFAULT_SEARCH_RADIUS_KM = 10;
export const MAX_SEARCH_RADIUS_KM = 50;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const MIN_RATING = 1;
export const MAX_RATING = 5;

export const BOOKING_MIN_DURATION_MINUTES = 30;
export const BOOKING_MAX_DURATION_HOURS = 12;

// ── Charger Specs ────────────────────────────────────

export const CHARGER_TYPE_LABELS: Record<string, string> = {
  LEVEL_1: 'Level 1 (120V AC)',
  LEVEL_2: 'Level 2 (240V AC)',
  DC_FAST: 'DC Fast Charging',
};

export const CONNECTOR_TYPE_LABELS: Record<string, string> = {
  TYPE_1: 'Type 1 (J1772)',
  TYPE_2: 'Type 2 (Mennekes)',
  CCS_1: 'CCS Combo 1',
  CCS_2: 'CCS Combo 2',
  CHAdeMO: 'CHAdeMO',
  TESLA: 'Tesla',
  GB_T: 'GB/T',
};

export const CHARGER_TYPE_KW_RANGES: Record<string, { min: number; max: number }> = {
  LEVEL_1: { min: 1, max: 2.4 },
  LEVEL_2: { min: 3.3, max: 19.2 },
  DC_FAST: { min: 20, max: 350 },
};
