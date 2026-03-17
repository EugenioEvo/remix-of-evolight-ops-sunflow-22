// Sunflow O&M Pro – Supabase backend
import { supabase } from '@/integrations/supabase/client';
import type {
  SolarPlant,
  SolarPlantWithStats,
  CreateSolarPlant,
  Alert,
  WorkOrderWithRelations,
  DashboardKpis,
  PaginatedResult,
  AlertStatus,
  AlertSeverity,
  WorkOrderStatus,
  WorkOrderType,
  WorkOrderPriority,
} from './types';

// ── Formatting helpers ──────────────────────────────────────

export function formatCapacity(kwp: number | null | undefined): string {
  if (kwp == null) return '—';
  if (kwp >= 1000) return `${(kwp / 1000).toFixed(1)} MWp`;
  return `${kwp.toFixed(0)} kWp`;
}

export function formatPerformanceRatio(pr: number | null | undefined): string {
  if (pr == null) return '—';
  return `${(pr * 100).toFixed(1)}%`;
}

export function formatAvailability(av: number | null | undefined): string {
  if (av == null) return '—';
  return `${(av * 100).toFixed(1)}%`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

// Columns to select from solar_plants (excluding geography column)
const PLANT_COLS =
  'id, name, code, status, capacity_kwp, address, city, state, country, commissioning_date, owner_name, owner_contact, health_score, notes, created_at, updated_at';

const STATS_COLS =
  'open_work_orders, active_alerts, critical_alerts, avg_pr_7d, avg_availability_7d';

function normalizePlant(row: Record<string, unknown>): SolarPlantWithStats {
  return {
    id: row.id as string,
    name: row.name as string,
    code: row.code as string,
    status: row.status as SolarPlant['status'],
    capacity_kwp: Number(row.capacity_kwp),
    address: (row.address as string) ?? null,
    city: row.city as string,
    state: row.state as string,
    country: row.country as string,
    commissioning_date: (row.commissioning_date as string) ?? null,
    owner_name: (row.owner_name as string) ?? null,
    owner_contact: (row.owner_contact as string) ?? null,
    health_score: row.health_score != null ? Number(row.health_score) : null,
    notes: (row.notes as string) ?? null,
    latitude: null,
    longitude: null,
    created_by: null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    avg_pr_7d: row.avg_pr_7d != null ? Number(row.avg_pr_7d) : null,
    avg_availability_7d: row.avg_availability_7d != null ? Number(row.avg_availability_7d) : null,
    active_alerts: Number(row.active_alerts ?? 0),
    critical_alerts: Number(row.critical_alerts ?? 0),
    open_work_orders: Number(row.open_work_orders ?? 0),
  };
}

// ── Plants ──────────────────────────────────────────────────

export async function getPlantsWithStats(): Promise<SolarPlantWithStats[]> {
  const { data, error } = await supabase
    .from('plants_with_stats' as any)
    .select(`${PLANT_COLS}, ${STATS_COLS}`)
    .order('name');
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalizePlant);
}

export async function getPlantById(id: string): Promise<SolarPlantWithStats | null> {
  const { data, error } = await supabase
    .from('plants_with_stats' as any)
    .select(`${PLANT_COLS}, ${STATS_COLS}`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizePlant(data as Record<string, unknown>) : null;
}

export async function createPlant(plant: CreateSolarPlant): Promise<SolarPlant> {
  const payload: Record<string, unknown> = {
    name: plant.name,
    code: plant.code,
    capacity_kwp: plant.capacity_kwp,
    city: plant.city,
    state: plant.state,
    country: plant.country,
    address: plant.address ?? null,
    commissioning_date: plant.commissioning_date ?? null,
    owner_name: plant.owner_name ?? null,
    owner_contact: plant.owner_contact ?? null,
    notes: plant.notes ?? null,
    status: plant.status ?? 'active',
  };

  if (plant.latitude != null && plant.longitude != null) {
    // PostGIS WKT format
    payload.location = `POINT(${plant.longitude} ${plant.latitude})`;
  }

  const { data, error } = await supabase
    .from('solar_plants' as any)
    .insert([payload])
    .select(PLANT_COLS)
    .single();

  if (error) throw error;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    name: row.name as string,
    code: row.code as string,
    status: row.status as SolarPlant['status'],
    capacity_kwp: Number(row.capacity_kwp),
    address: (row.address as string) ?? null,
    city: row.city as string,
    state: row.state as string,
    country: row.country as string,
    commissioning_date: (row.commissioning_date as string) ?? null,
    owner_name: (row.owner_name as string) ?? null,
    owner_contact: (row.owner_contact as string) ?? null,
    health_score: row.health_score != null ? Number(row.health_score) : null,
    notes: (row.notes as string) ?? null,
    latitude: plant.latitude ?? null,
    longitude: plant.longitude ?? null,
    created_by: null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    avg_pr_7d: null,
    avg_availability_7d: null,
  };
}

// ── Work Orders ─────────────────────────────────────────────

export async function getWorkOrders(params?: {
  plant_id?: string;
  status?: WorkOrderStatus;
  type?: WorkOrderType;
  priority?: WorkOrderPriority;
  pageSize?: number;
}): Promise<PaginatedResult<WorkOrderWithRelations>> {
  let query = (supabase as any)
    .from('work_orders')
    .select(
      `id, wo_number, plant_id, title, description, type, status, priority,
       assignee_id, scheduled_date, completed_at, created_at, updated_at,
       plant:solar_plants(id, name, code),
       assignee:user_profiles(id, full_name, email)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .limit(params?.pageSize ?? 50);

  if (params?.plant_id) query = query.eq('plant_id', params.plant_id);
  if (params?.status) query = query.eq('status', params.status);
  if (params?.type) query = query.eq('type', params.type);
  if (params?.priority) query = query.eq('priority', params.priority);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Record<string, unknown>[];
  const workOrders: WorkOrderWithRelations[] = rows.map((r) => ({
    id: r.id as string,
    plant_id: r.plant_id as string,
    wo_number: r.wo_number as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    type: r.type as WorkOrderWithRelations['type'],
    priority: r.priority as WorkOrderWithRelations['priority'],
    status: r.status as WorkOrderWithRelations['status'],
    assignee_id: (r.assignee_id as string) ?? null,
    scheduled_date: (r.scheduled_date as string) ?? null,
    completed_at: (r.completed_at as string) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    plant: r.plant as WorkOrderWithRelations['plant'],
    assignee: r.assignee as WorkOrderWithRelations['assignee'],
  }));

  return { data: workOrders, count: count ?? 0 };
}

// ── Alerts ──────────────────────────────────────────────────

export async function getAlerts(params?: {
  plant_id?: string;
  status?: AlertStatus;
  severity?: AlertSeverity;
  pageSize?: number;
}): Promise<PaginatedResult<Alert>> {
  let query = (supabase as any)
    .from('alerts')
    .select(
      `id, plant_id, title, message, severity, status,
       metric_name, metric_value, threshold_value,
       acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at,
       plant:solar_plants(id, name, code)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .limit(params?.pageSize ?? 100);

  if (params?.plant_id) query = query.eq('plant_id', params.plant_id);
  if (params?.status) query = query.eq('status', params.status);
  if (params?.severity) query = query.eq('severity', params.severity);

  const { data, error, count } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Record<string, unknown>[];
  const alerts: Alert[] = rows.map((r) => ({
    id: r.id as string,
    plant_id: r.plant_id as string,
    title: r.title as string,
    message: r.message as string,
    severity: r.severity as Alert['severity'],
    status: r.status as Alert['status'],
    metric_name: (r.metric_name as string) ?? null,
    metric_value: r.metric_value != null ? Number(r.metric_value) : null,
    threshold_value: r.threshold_value != null ? Number(r.threshold_value) : null,
    acknowledged_by: (r.acknowledged_by as string) ?? null,
    acknowledged_at: (r.acknowledged_at as string) ?? null,
    resolved_at: (r.resolved_at as string) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    plant: r.plant as Alert['plant'],
  }));

  return { data: alerts, count: count ?? 0 };
}

export async function acknowledgeAlert(alertId: string, userId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('alerts')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      // acknowledged_by omitted — FK references user_profiles which may not exist yet
    })
    .eq('id', alertId);
  if (error) throw error;
}

export async function resolveAlert(alertId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', alertId);
  if (error) throw error;
}

// ── Dashboard KPIs ──────────────────────────────────────────

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const { data, error } = await (supabase as any)
    .from('om_kpis')
    .select('*')
    .maybeSingle();

  if (error) throw error;

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    active_plants: Number(row.active_plants ?? 0),
    total_capacity_kwp: Number(row.total_capacity_kwp ?? 0),
    avg_pr_7d: row.avg_pr_7d != null ? Number(row.avg_pr_7d) : null,
    avg_availability_7d: row.avg_availability_7d != null ? Number(row.avg_availability_7d) : null,
    open_work_orders: Number(row.open_work_orders ?? 0),
    critical_alerts: Number(row.critical_alerts ?? 0),
  };
}
