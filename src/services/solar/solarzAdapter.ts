// SolarZ API adapter – implements ISolarMonitoringSource
// Uses Cloudflare Worker proxy with X-Proxy-Secret header
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

// ── SolarZ raw response types ───────────────────────────────

interface SolarzRawPlant {
  id: number;
  name: string;
  installedPower?: number;
  status?: { status: string; at: string };
  dataInstalacao?: string;
  cliente?: { nome?: string; email?: string; cpf?: string };
  endereco?: {
    cidade?: string;
    siglaEstado?: string;
    logradouro?: string;
    latitude?: number;
    longitude?: number;
  };
}

interface SolarzEnergyDay {
  date: string;
  total: number;
  totalExpected?: number;
}

interface SolarzPowerData {
  plantId: number;
  plantName: string;
  status: string;
  installedPower: number;
  instantPower: number;
  totalGenerated: number;
  generation365Days: number;
}

interface SolarzStatusData {
  plantId: number;
  status: string;
  at: string;
}

interface SolarzPerformanceData {
  total1D: number;
  expected1D: number;
  total15D: number;
  expected15D: number;
  total30D: number;
  expected30D: number;
  total365D: number;
  expected365D: number;
}

// ── Adapter ─────────────────────────────────────────────────

export class SolarzAdapter implements ISolarMonitoringSource {
  readonly providerName = 'SolarZ';

  private baseUrl: string;
  private proxySecret: string;

  constructor(config: { baseUrl: string; proxySecret: string }) {
    let url = config.baseUrl.replace(/\/$/, '');
    if (url && !url.startsWith('http')) {
      url = 'https://' + url;
    }
    this.baseUrl = url;
    this.proxySecret = config.proxySecret;
  }

  // ── Auth (handled by Cloudflare Worker proxy) ──────────

  async authenticate(): Promise<void> {
    logger.info('[SolarZ] Using Cloudflare Worker proxy (no direct auth needed)');
  }

  private getProxyHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Proxy-Secret': this.proxySecret,
    };
  }

  private async authedFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.getProxyHeaders(),
        ...(init?.headers ?? {}),
      },
    });
  }

  // ── Plants ──────────────────────────────────────────────

  async getPlants(): Promise<SolarPlant[]> {
    logger.info('[SolarZ] Fetching plants via /openApi/seller/plantWithInfos/list');
    const allPlants: SolarzRawPlant[] = [];
    let page = 0;
    const pageSize = 100;

    while (true) {
      const res = await withRetry(
        () =>
          this.authedFetch('/openApi/seller/plantWithInfos/list', {
            method: 'POST',
            body: JSON.stringify({ page, pageSize }),
          }),
        `getPlants page ${page}`,
      );
      if (!res.ok) throw new Error(`SolarZ getPlants failed: ${res.status}`);
      const data = await res.json();
      const content: SolarzRawPlant[] = data.content ?? [];
      if (content.length === 0) break;
      allPlants.push(...content);
      if (content.length < pageSize) break;
      page++;
    }

    logger.info(`[SolarZ] Found ${allPlants.length} plants`);
    return allPlants.map(this.normalizePlant);
  }

  private normalizePlant(r: SolarzRawPlant): SolarPlant {
    const statusMap: Record<string, SolarPlant['status']> = {
      OK: 'online',
      ALERTA: 'alert',
      CRITICO: 'offline',
      DESCONHECIDO: 'unknown',
    };
    return {
      externalId: String(r.id),
      name: r.name,
      address: r.endereco?.logradouro,
      city: r.endereco?.cidade,
      state: r.endereco?.siglaEstado,
      capacityKwp: r.installedPower ?? 0,
      installationDate: r.dataInstalacao,
      status: statusMap[r.status?.status ?? ''] ?? 'unknown',
    };
  }

  // ── Metrics ─────────────────────────────────────────────

  async getPlantMetrics(plantExternalId: string, range: DateRange): Promise<SolarMetric[]> {
    logger.info(`[SolarZ] Fetching metrics for plant ${plantExternalId}`);
    const plantIdInt = parseInt(plantExternalId, 10);

    // 1. Day-range energy data
    const fromDate = range.start.substring(0, 10); // yyyy-MM-dd
    const toDate = range.end.substring(0, 10);

    const energyRes = await withRetry(
      () =>
        this.authedFetch(
          `/openApi/seller/plant/energy/dayRange?plantId=${plantIdInt}&fromLocalDate=${fromDate}&toLocalDate=${toDate}`,
          {
            method: 'POST',
            body: JSON.stringify({ plantId: plantIdInt, fromLocalDate: fromDate, toLocalDate: toDate }),
          },
        ),
      'getPlantMetrics/energy',
    );
    if (!energyRes.ok) throw new Error(`SolarZ energy/dayRange failed: ${energyRes.status}`);
    const energyData: SolarzEnergyDay[] = await energyRes.json();

    // 2. Current power snapshot
    let instantPower: number | undefined;
    try {
      const powerRes = await withRetry(
        () => this.authedFetch(`/openApi/seller/plant/power?id=${plantIdInt}`),
        'getPlantMetrics/power',
      );
      if (powerRes.ok) {
        const powerData: SolarzPowerData = await powerRes.json();
        instantPower = powerData.instantPower;
      }
    } catch {
      logger.warn(`[SolarZ] Could not fetch power for plant ${plantExternalId}`);
    }

    // Combine
    const metrics: SolarMetric[] = (energyData ?? []).map((d) => ({
      plantExternalId,
      timestamp: d.date,
      generationKwh: d.total,
    }));

    // Add instant power to the latest entry or create one
    if (instantPower !== undefined && metrics.length > 0) {
      metrics[metrics.length - 1].instantPowerKw = instantPower;
    } else if (instantPower !== undefined) {
      metrics.push({
        plantExternalId,
        timestamp: new Date().toISOString(),
        instantPowerKw: instantPower,
      });
    }

    return metrics;
  }

  // ── Alerts (derived from status + performance) ─────────

  async getAlerts(plantExternalId?: string): Promise<SolarAlert[]> {
    logger.info(`[SolarZ] Deriving alerts${plantExternalId ? ` for plant ${plantExternalId}` : ' for all plants'}`);

    if (!plantExternalId) {
      // Get all plants and derive alerts for each
      const plants = await this.getPlants();
      const allAlerts: SolarAlert[] = [];
      for (const p of plants) {
        try {
          const alerts = await this.deriveAlertsForPlant(p.externalId);
          allAlerts.push(...alerts);
        } catch (err) {
          logger.warn(`[SolarZ] Failed to derive alerts for plant ${p.externalId}`, err);
        }
      }
      return allAlerts;
    }

    return this.deriveAlertsForPlant(plantExternalId);
  }

  private async deriveAlertsForPlant(plantExternalId: string): Promise<SolarAlert[]> {
    const plantIdInt = parseInt(plantExternalId, 10);
    const alerts: SolarAlert[] = [];
    const now = new Date();

    // a) Status check
    try {
      const statusRes = await this.authedFetch(`/openApi/seller/plant/status?id=${plantIdInt}`);
      if (statusRes.ok) {
        const statusData: SolarzStatusData = await statusRes.json();
        const lastUpdate = new Date(statusData.at);
        const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / 60_000;

        if (statusData.status !== 'NORMAL' && minutesSinceUpdate > 30) {
          alerts.push({
            externalId: `derived-offline-${plantExternalId}-${now.toISOString()}`,
            plantExternalId,
            type: 'offline',
            severity: 'critical',
            title: `Planta offline: status ${statusData.status}`,
            description: `Última atualização há ${Math.round(minutesSinceUpdate)} minutos.`,
            contextData: { status: statusData.status, lastUpdate: statusData.at, minutesSinceUpdate },
            timestamp: now.toISOString(),
          });
        }

        if (minutesSinceUpdate > 120) {
          alerts.push({
            externalId: `derived-comm-${plantExternalId}-${now.toISOString()}`,
            plantExternalId,
            type: 'comunicacao',
            severity: 'warning',
            title: `Sem comunicação há ${Math.round(minutesSinceUpdate)} minutos`,
            description: `Última atualização: ${statusData.at}`,
            contextData: { lastUpdate: statusData.at, minutesSinceUpdate },
            timestamp: now.toISOString(),
          });
        }
      }
    } catch (err) {
      logger.warn(`[SolarZ] Status check failed for plant ${plantExternalId}`, err);
    }

    // b) Performance check (generation vs expected)
    try {
      const perfRes = await this.authedFetch(`/openApi/seller/plant/performance/plantId/${plantIdInt}`, {
        method: 'POST',
      });
      if (perfRes.ok) {
        const perfData: SolarzPerformanceData = await perfRes.json();
        if (perfData.expected1D > 0 && perfData.total1D > 0) {
          const ratio = perfData.total1D / perfData.expected1D;
          if (ratio < 0.70) {
            alerts.push({
              externalId: `derived-lowgen-${plantExternalId}-${now.toISOString()}`,
              plantExternalId,
              type: 'baixa_geracao',
              severity: 'warning',
              title: `Baixa geração: ${Math.round(ratio * 100)}% do esperado`,
              description: `Geração: ${perfData.total1D.toFixed(1)} kWh, Esperado: ${perfData.expected1D.toFixed(1)} kWh`,
              contextData: { ratio, total1D: perfData.total1D, expected1D: perfData.expected1D },
              timestamp: now.toISOString(),
            });
          }
        }
      }
    } catch (err) {
      logger.warn(`[SolarZ] Performance check failed for plant ${plantExternalId}`, err);
    }

    // c) Power check (zero power during solar hours)
    try {
      const powerRes = await this.authedFetch(`/openApi/seller/plant/power?id=${plantIdInt}`);
      if (powerRes.ok) {
        const powerData: SolarzPowerData = await powerRes.json();
        const hour = now.getHours();
        if (hour >= 6 && hour <= 18 && powerData.instantPower === 0) {
          alerts.push({
            externalId: `derived-zeropower-${plantExternalId}-${now.toISOString()}`,
            plantExternalId,
            type: 'offline',
            severity: 'warning',
            title: 'Potência instantânea zero em horário solar',
            description: `Potência instalada: ${powerData.installedPower} kWp, geração instantânea: 0`,
            contextData: { instantPower: 0, installedPower: powerData.installedPower, hour },
            timestamp: now.toISOString(),
          });
        }
      }
    } catch (err) {
      logger.warn(`[SolarZ] Power check failed for plant ${plantExternalId}`, err);
    }

    return alerts;
  }

  // ── Device Status ───────────────────────────────────────

  async getDeviceStatus(plantExternalId: string): Promise<DeviceStatus> {
    logger.info(`[SolarZ] Fetching device status for plant ${plantExternalId}`);
    const plantIdInt = parseInt(plantExternalId, 10);

    const res = await withRetry(
      () => this.authedFetch(`/openApi/seller/plant/power?id=${plantIdInt}`),
      'getDeviceStatus',
    );
    if (!res.ok) throw new Error(`SolarZ getDeviceStatus failed: ${res.status}`);
    const powerData: SolarzPowerData = await res.json();

    // Map to a generic device entry from available data
    const device: DeviceInfo = {
      id: `plant-${plantExternalId}`,
      type: 'inverter',
      name: powerData.plantName ?? `Planta ${plantExternalId}`,
      status: powerData.status === 'NORMAL' ? 'online' : 'offline',
      lastSeen: new Date().toISOString(),
      metadata: {
        installedPower: powerData.installedPower,
        instantPower: powerData.instantPower,
        totalGenerated: powerData.totalGenerated,
        generation365Days: powerData.generation365Days,
      },
    };

    return { plantExternalId, devices: [device] };
  }
}
