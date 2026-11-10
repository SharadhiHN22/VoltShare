// ── Booking Types ────────────────────────────────────

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Booking {
  id: string;
  seekerId: string;
  chargerId: string;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  totalAmount: number;
  qrCode?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBookingInput {
  chargerId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  notes?: string;
  vehicleId?: string;
  currentBattery?: number;
  targetBattery?: number;
}

export interface BookingWithDetails extends Booking {
  chargerTitle: string;
  chargerAddress: string;
  chargerType: string;
  hostName: string;
  seekerName: string;
}
