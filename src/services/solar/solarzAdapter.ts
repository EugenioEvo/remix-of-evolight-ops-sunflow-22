// SolarZ API adapter – implements ISolarMonitoringSource
import logger from '@/lib/logger';
import type {
  ISolarMonitoringSource,
  SolarPlant,
  SolarMetric,
  SolarAlert,
  DeviceStatus,
  DeviceInfo,
  DateRange,
} from './types';

// ── Helpers ─────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      logger.warn(`[SolarZ] ${label} attempt ${attempt + 1} failed, retrying in ${delay}ms`, lastError.message);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  logger.error(`[SolarZ] ${label} failed after ${MAX_RETRIES} attempts`, lastError);
  throw lastError;
}

// ── SolarZ raw response types (minimal) ─────────────────────

interface SolarzLoginResponse {
  token: string;
  expiresAt?: string;
}

interface SolarzRawPlant {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  capacity?: number;
  inverter_brand?: string;
  inverter_model?: string;
  inverter_serial?: string;
  installation_date?: string;
  status?: string;
}

interface SolarzRawMetric {
  plant_id: string;
  timestamp: string;
  generation_kwh?: number;
  instant_power_kw?: number;
  irradiation_wm2?: number;
  inverter_temp?: number;
  voltage_dc?: number;
  current_dc?: number;
  voltage_ac?: number;
  current_ac?: number;
  frequency_hz?: number;
  power_factor?: number;
  efficiency?: number;
}

interface SolarzRawAlert {
  id: string;
  plant_id: string;
  type: string;
  severity: string;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  created_at: string;
}

interface SolarzRawDevice {
  id: string;
  type: string;
  name: string;
  serial?: string;
  status: string;
  last_seen?: string;
  metadata?: Record<string, unknown>;
}

// ── Adapter ─────────────────────────────────────────────────

export class SolarzAdapter implements ISolarMonitoringSource {
  readonly providerName = 'SolarZ';

  private baseUrl: string;
  private username: string;
  private password: string;
  private token: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(config: { baseUrl: string; username: string; password: string }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.username = config.username;
    this.password = config.password;
  }

  // ── Auth ────────────────────────────────────────────────

  async authenticate(): Promise<void> {
    if (this.token && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return; // token still valid
    }

    logger.info('[SolarZ] Authenticating…');
    const res = await withRetry(
      () =>
        fetch(`${this.baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.username, password: this.password }),
        }),
      'authenticate',
    );

    if (!res.ok) {
      throw new Error(`SolarZ auth failed: ${res.status} ${res.statusText}`);
    }

    const data: SolarzLoginResponse = await res.json();
    this.token = data.token;
    // Default to 55 min if no expiry provided
    this.tokenExpiresAt = data.expiresAt
      ? new Date(data.expiresAt)
      : new Date(Date.now() + 55 * 60 * 1_000);
    logger.info('[SolarZ] Authenticated successfully');
  }

  private async authedFetch(path: string, init?: RequestInit): Promise<Response> {
    await this.authenticate();
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...(init?.headers ?? {}),
      },
    });
  }

  // ── Plants ──────────────────────────────────────────────

  async getPlants(): Promise<SolarPlant[]> {
    logger.info('[SolarZ] Fetching plants');
    const res = await withRetry(() => this.authedFetch('/plants'), 'getPlants');
    if (!res.ok) throw new Error(`SolarZ getPlants failed: ${res.status}`);
    const raw: SolarzRawPlant[] = await res.json();
    return raw.map(this.normalizePlant);
  }

  private normalizePlant(r: SolarzRawPlant): SolarPlant {
    const statusMap: Record<string, SolarPlant['status']> = {
      online: 'online',
      offline: 'offline',
      alert: 'alert',
      warning: 'alert',
    };
    return {
      externalId: r.id,
      name: r.name,
      address: r.address,
      city: r.city,
      state: r.state,
      capacityKwp: r.capacity ?? 0,
      inverterBrand: r.inverter_brand,
      inverterModel: r.inverter_model,
      inverterSerial: r.inverter_serial,
      installationDate: r.installation_date,
      status: statusMap[r.status ?? ''] ?? 'unknown',
    };
  }

  // ── Metrics ─────────────────────────────────────────────

  async getPlantMetrics(plantExternalId: string, range: DateRange): Promise<SolarMetric[]> {
    logger.info(`[SolarZ] Fetching metrics for plant ${plantExternalId}`);
    const qs = `start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`;
    const res = await withRetry(
      () => this.authedFetch(`/plants/${plantExternalId}/metrics?${qs}`),
      'getPlantMetrics',
    );
    if (!res.ok) throw new Error(`SolarZ getPlantMetrics failed: ${res.status}`);
    const raw: SolarzRawMetric[] = await res.json();
    return raw.map(this.normalizeMetric);
  }

  private normalizeMetric(r: SolarzRawMetric): SolarMetric {
    return {
      plantExternalId: r.plant_id,
      timestamp: r.timestamp,
      generationKwh: r.generation_kwh,
      instantPowerKw: r.instant_power_kw,
      irradiationWm2: r.irradiation_wm2,
      inverterTempC: r.inverter_temp,
      voltageDc: r.voltage_dc,
      currentDc: r.current_dc,
      voltageAc: r.voltage_ac,
      currentAc: r.current_ac,
      frequencyHz: r.frequency_hz,
      powerFactor: r.power_factor,
      efficiencyPercent: r.efficiency,
    };
  }

  // ── Alerts ──────────────────────────────────────────────

  async getAlerts(plantExternalId?: string): Promise<SolarAlert[]> {
    logger.info(`[SolarZ] Fetching alerts${plantExternalId ? ` for plant ${plantExternalId}` : ''}`);
    const path = plantExternalId ? `/plants/${plantExternalId}/alerts` : '/alerts';
    const res = await withRetry(() => this.authedFetch(path), 'getAlerts');
    if (!res.ok) throw new Error(`SolarZ getAlerts failed: ${res.status}`);
    const raw: SolarzRawAlert[] = await res.json();
    return raw.map(this.normalizeAlert);
  }

  private normalizeAlert(r: SolarzRawAlert): SolarAlert {
    const typeMap: Record<string, SolarAlert['type']> = {
      offline: 'offline',
      low_generation: 'baixa_geracao',
      inverter_error: 'erro_inversor',
      communication: 'comunicacao',
      temperature: 'temperatura',
    };
    const sevMap: Record<string, SolarAlert['severity']> = {
      info: 'info',
      warning: 'warning',
      critical: 'critical',
      error: 'critical',
    };
    return {
      externalId: r.id,
      plantExternalId: r.plant_id,
      type: typeMap[r.type] ?? 'comunicacao',
      severity: sevMap[r.severity] ?? 'info',
      title: r.title,
      description: r.description,
      contextData: r.data,
      timestamp: r.created_at,
    };
  }

  // ── Device Status ───────────────────────────────────────

  async getDeviceStatus(plantExternalId: string): Promise<DeviceStatus> {
    logger.info(`[SolarZ] Fetching device status for plant ${plantExternalId}`);
    const res = await withRetry(
      () => this.authedFetch(`/plants/${plantExternalId}/devices`),
      'getDeviceStatus',
    );
    if (!res.ok) throw new Error(`SolarZ getDeviceStatus failed: ${res.status}`);
    const raw: SolarzRawDevice[] = await res.json();
    const devices: DeviceInfo[] = raw.map((d) => ({
      id: d.id,
      type: (['inverter', 'meter', 'sensor', 'string_box'].includes(d.type)
        ? d.type
        : 'sensor') as DeviceInfo['type'],
      name: d.name,
      serial: d.serial,
      status: (['online', 'offline', 'error', 'maintenance'].includes(d.status)
        ? d.status
        : 'offline') as DeviceInfo['status'],
      lastSeen: d.last_seen,
      metadata: d.metadata,
    }));
    return { plantExternalId, devices };
  }
}
