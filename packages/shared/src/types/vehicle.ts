import { ConnectorType } from './charger';

export interface Vehicle {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: number;
  connectorType: ConnectorType;
  batteryCapacity?: number | null;
  registrationNumber?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleInput {
  make: string;
  model: string;
  year: number;
  connectorType: ConnectorType;
  batteryCapacity?: number;
  registrationNumber?: string;
}
