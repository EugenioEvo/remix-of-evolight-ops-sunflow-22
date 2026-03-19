// Solar monitoring service – Facade that syncs provider data into the database
import { supabase } from '@/integrations/supabase/client';
import logger from '@/lib/logger';
import type { ISolarMonitoringSource, DateRange } from './types';

export class SolarService {
  constructor(private source: ISolarMonitoringSource) {}

  // ── syncPlants ────────────────────────────────────────────

  /** Fetch plants from the provider and upsert into solar_plants. */
  async syncPlants(): Promise<{ synced: number; errors: number }> {
    logger.info(`[SolarService] Syncing plants from ${this.source.providerName}`);
    const plants = await this.source.getPlants();

    let synced = 0;
    let errors = 0;

    for (const plant of plants) {
      // Find existing row by solarz_plant_id
      const { data: existing } = await supabase
        .from('solar_plants')
        .select('id')
        .eq('solarz_plant_id', plant.externalId)
        .maybeSingle();

      const payload = {
        nome: plant.name,
        endereco: plant.address ?? null,
        cidade: plant.city ?? null,
        estado: plant.state ?? null,
        potencia_kwp: plant.capacityKwp,
        marca_inversor: plant.inverterBrand ?? null,
        modelo_inversor: plant.inverterModel ?? null,
        serial_inversor: plant.inverterSerial ?? null,
        data_instalacao: plant.installationDate ?? null,
        solarz_plant_id: plant.externalId,
        solarz_status: plant.status,
        ultima_sincronizacao: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from('solar_plants')
          .update(payload)
          .eq('id', existing.id);
        if (error) {
          logger.error(`[SolarService] Failed to update plant ${plant.externalId}`, error);
          errors++;
        } else {
          synced++;
        }
      } else {
        logger.warn(
          `[SolarService] Plant ${plant.externalId} (${plant.name}) not found in solar_plants. ` +
            'Create it manually with a cliente_id first, then sync.',
        );
        errors++;
      }
    }

    logger.info(`[SolarService] Plants sync done: ${synced} synced, ${errors} errors`);
    return { synced, errors };
  }

  // ── syncMetrics ───────────────────────────────────────────

  /** Fetch recent metrics for a plant and insert into solar_metrics. */
  async syncMetrics(
    plantId: string,
    range?: DateRange,
  ): Promise<{ inserted: number }> {
    // Resolve the solarz_plant_id
    const { data: plant, error: plantErr } = await supabase
      .from('solar_plants')
      .select('id, solarz_plant_id')
      .eq('id', plantId)
      .single();

    if (plantErr || !plant?.solarz_plant_id) {
      throw new Error(`Plant ${plantId} not found or missing solarz_plant_id`);
    }

    const now = new Date();
    const defaultRange: DateRange = range ?? {
      start: new Date(now.getTime() - 24 * 60 * 60 * 1_000).toISOString(),
      end: now.toISOString(),
    };

    logger.info(`[SolarService] Syncing metrics for plant ${plantId}`);
    const metrics = await this.source.getPlantMetrics(plant.solarz_plant_id, defaultRange);

    if (metrics.length === 0) {
      logger.info('[SolarService] No new metrics to insert');
      return { inserted: 0 };
    }

    const rows = metrics.map((m) => ({
      plant_id: plantId,
      timestamp: m.timestamp,
      geracao_kwh: m.generationKwh ?? null,
      potencia_instantanea_kw: m.instantPowerKw ?? null,
      irradiacao_wm2: m.irradiationWm2 ?? null,
      temperatura_inversor: m.inverterTempC ?? null,
      tensao_dc: m.voltageDc ?? null,
      corrente_dc: m.currentDc ?? null,
      tensao_ac: m.voltageAc ?? null,
      corrente_ac: m.currentAc ?? null,
      frequencia_hz: m.frequencyHz ?? null,
      fator_potencia: m.powerFactor ?? null,
      eficiencia_percent: m.efficiencyPercent ?? null,
    }));

    const { error } = await supabase.from('solar_metrics').insert(rows);
    if (error) {
      logger.error('[SolarService] Failed to insert metrics', error);
      throw error;
    }

    logger.info(`[SolarService] Inserted ${rows.length} metric rows`);
    return { inserted: rows.length };
  }

  // ── syncAlerts ────────────────────────────────────────────

  /** Fetch alerts from the provider and insert new ones into solar_alerts. */
  async syncAlerts(): Promise<{ created: number }> {
    logger.info('[SolarService] Syncing alerts');
    const alerts = await this.source.getAlerts();

    let created = 0;

    for (const alert of alerts) {
      // Resolve internal plant_id
      const { data: plant } = await supabase
        .from('solar_plants')
        .select('id')
        .eq('solarz_plant_id', alert.plantExternalId)
        .maybeSingle();

      if (!plant) {
        logger.warn(`[SolarService] Skipping alert for unknown plant ${alert.plantExternalId}`);
        continue;
      }

      const { error } = await supabase.from('solar_alerts').insert([{
        plant_id: plant.id,
        tipo: alert.type,
        severidade: alert.severity,
        titulo: alert.title,
        descricao: alert.description ?? null,
        dados_contexto: (alert.contextData ?? null) as any,
        status: 'aberto',
      }]);

      if (error) {
        logger.error(`[SolarService] Failed to insert alert`, error);
      } else {
        created++;
      }
    }

    logger.info(`[SolarService] Alerts sync done: ${created} created`);
    return { created };
  }

  // ── getPlantHealth ────────────────────────────────────────

  /** Return a consolidated health view for a plant. */
  async getPlantHealth(plantId: string) {
    const { data: plant } = await supabase
      .from('solar_plants')
      .select('id, nome, solarz_plant_id, solarz_status, potencia_kwp, ultima_sincronizacao')
      .eq('id', plantId)
      .single();

    if (!plant) throw new Error(`Plant ${plantId} not found`);

    // Latest metrics (last 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
    const { data: metrics } = await supabase
      .from('solar_metrics')
      .select('geracao_kwh, potencia_instantanea_kw, eficiencia_percent, timestamp')
      .eq('plant_id', plantId)
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(50);

    // Open alerts
    const { data: openAlerts, count: alertCount } = await supabase
      .from('solar_alerts')
      .select('id, tipo, severidade, titulo, created_at', { count: 'exact' })
      .eq('plant_id', plantId)
      .eq('status', 'aberto')
      .order('created_at', { ascending: false })
      .limit(10);

    // Device status (if provider is reachable)
    let deviceStatus = null;
    if (plant.solarz_plant_id) {
      try {
        deviceStatus = await this.source.getDeviceStatus(plant.solarz_plant_id);
      } catch (err) {
        logger.warn('[SolarService] Could not fetch device status', err);
      }
    }

    // Aggregates
    const totalGeneration = (metrics ?? []).reduce(
      (sum, m) => sum + (Number(m.geracao_kwh) || 0),
      0,
    );
    const avgEfficiency =
      (metrics ?? []).length > 0
        ? (metrics ?? []).reduce((s, m) => s + (Number(m.eficiencia_percent) || 0), 0) /
          (metrics ?? []).length
        : null;

    return {
      plant: {
        id: plant.id,
        name: plant.nome,
        capacityKwp: plant.potencia_kwp,
        status: plant.solarz_status,
        lastSync: plant.ultima_sincronizacao,
      },
      metrics: {
        last24h: {
          totalGenerationKwh: Math.round(totalGeneration * 100) / 100,
          avgEfficiencyPercent: avgEfficiency ? Math.round(avgEfficiency * 100) / 100 : null,
          dataPoints: (metrics ?? []).length,
        },
        latestReading: metrics?.[0] ?? null,
      },
      alerts: {
        openCount: alertCount ?? 0,
        items: openAlerts ?? [],
      },
      devices: deviceStatus,
    };
  }
}
