// Solar monitoring integration – Domain types & provider interface

// ── Domain Types ────────────────────────────────────────────

export interface SolarPlant {
  externalId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  capacityKwp: number;
  inverterBrand?: string;
  inverterModel?: string;
  inverterSerial?: string;
  installationDate?: string;
  status: 'online' | 'offline' | 'alert' | 'unknown';
}

export interface SolarMetric {
  plantExternalId: string;
  timestamp: string;
  generationKwh?: number;
  instantPowerKw?: number;
  irradiationWm2?: number;
  inverterTempC?: number;
  voltageDc?: number;
  currentDc?: number;
  voltageAc?: number;
  currentAc?: number;
  frequencyHz?: number;
  powerFactor?: number;
  efficiencyPercent?: number;
}

export interface SolarAlert {
  externalId: string;
  plantExternalId: string;
  type: 'offline' | 'baixa_geracao' | 'erro_inversor' | 'comunicacao' | 'temperatura';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description?: string;
  contextData?: Record<string, unknown>;
  timestamp: string;
}

export interface DeviceStatus {
  plantExternalId: string;
  devices: DeviceInfo[];
}

export interface DeviceInfo {
  id: string;
  type: 'inverter' | 'meter' | 'sensor' | 'string_box';
  name: string;
  serial?: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastSeen?: string;
  metadata?: Record<string, unknown>;
}

export interface DateRange {
  start: string; // ISO 8601
  end: string;
}

// ── Provider Interface ──────────────────────────────────────

/**
 * Generic monitoring source.
 * Implement this for each provider (SolarZ, Growatt, Huawei FusionSolar, etc.)
 */
export interface ISolarMonitoringSource {
  readonly providerName: string;

  /** Authenticate / refresh token. Called automatically before each request. */
  authenticate(): Promise<void>;

  /** List all plants visible to the authenticated account. */
  getPlants(): Promise<SolarPlant[]>;

  /** Fetch generation metrics for a plant in a date range. */
  getPlantMetrics(plantExternalId: string, range: DateRange): Promise<SolarMetric[]>;

  /** Fetch active alerts, optionally filtered by plant. */
  getAlerts(plantExternalId?: string): Promise<SolarAlert[]>;

  /** Get real-time device status for a plant. */
  getDeviceStatus(plantExternalId: string): Promise<DeviceStatus>;
}
