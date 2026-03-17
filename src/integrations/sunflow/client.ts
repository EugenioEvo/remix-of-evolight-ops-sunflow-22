// Sunflow O&M Pro - Supabase Client Utilities
import { supabase } from '@/integrations/supabase/client';
import type {
  SolarPlant,
  SolarPlantWithStats,
  WorkOrder,
  WorkOrderWithRelations,
  Alert,
  AlertWithRelations,
  OmKpis,
  CreateSolarPlant,
  UpdateSolarPlant,
  CreateWorkOrder,
  UpdateWorkOrder,
  AlertStatus,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
  AlertSeverity,
  PaginatedResult,
} from './types';

// ============================================================
// PLANTS
// ============================================================

export async function getPlantsWithStats(): Promise<SolarPlantWithStats[]> {
  const { data, error } = await supabase
    .from('plants_with_stats')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as SolarPlantWithStats[];
}

export async function getPlantById(id: string): Promise<SolarPlantWithStats | null> {
  const { data, error } = await supabase
    .from('plants_with_stats')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as SolarPlantWithStats | null;
}

export async function createPlant(plant: CreateSolarPlant): Promise<SolarPlant> {
  const { latitude, longitude, ...rest } = plant as CreateSolarPlant & {
    latitude?: number;
    longitude?: number;
  };
  const payload: Record<string, unknown> = { ...rest };
  if (latitude !== undefined && longitude !== undefined) {
    payload.location = `POINT(${longitude} ${latitude})`;
  }
  const { data, error } = await supabase
    .from('solar_plants')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as SolarPlant;
}

export async function updatePlant(id: string, updates: UpdateSolarPlant): Promise<SolarPlant> {
  const { data, error } = await supabase
    .from('solar_plants')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as SolarPlant;
}

// ============================================================
// WORK ORDERS
// ============================================================

export interface WorkOrderFilters {
  status?: WorkOrderStatus;
  type?: WorkOrderType;
  priority?: WorkOrderPriority;
  plant_id?: string;
  assigned_to?: string;
  page?: number;
  pageSize?: number;
}

export async function getWorkOrders(
  filters: WorkOrderFilters = {}
): Promise<PaginatedResult<WorkOrderWithRelations>> {
  const { page = 1, pageSize = 20, ...rest } = filters;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('work_orders')
    .select(
      `*, plant:solar_plants(id,name,code), assignee:user_profiles(id,full_name,email)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (rest.status) query = query.eq('status', rest.status);
  if (rest.type) query = query.eq('type', rest.type);
  if (rest.priority) query = query.eq('priority', rest.priority);
  if (rest.plant_id) query = query.eq('plant_id', rest.plant_id);
  if (rest.assigned_to) query = query.eq('assigned_to', rest.assigned_to);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    data: (data ?? []) as WorkOrderWithRelations[],
    count: count ?? 0,
    page,
    pageSize,
  };
}

export async function createWorkOrder(wo: CreateWorkOrder): Promise<WorkOrder> {
  const { data, error } = await supabase
    .from('work_orders')
    .insert(wo)
    .select()
    .single();
  if (error) throw error;
  return data as WorkOrder;
}

export async function updateWorkOrder(id: string, updates: UpdateWorkOrder): Promise<WorkOrder> {
  const { data, error } = await supabase
    .from('work_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as WorkOrder;
}

// ============================================================
// ALERTS
// ============================================================

export interface AlertFilters {
  status?: AlertStatus;
  severity?: AlertSeverity;
  plant_id?: string;
  page?: number;
  pageSize?: number;
}

export async function getAlerts(
  filters: AlertFilters = {}
): Promise<PaginatedResult<AlertWithRelations>> {
  const { page = 1, pageSize = 20, ...rest } = filters;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('alerts')
    .select(
      `*, plant:solar_plants(id,name,code), equipment(id,name,type)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (rest.status) query = query.eq('status', rest.status);
  if (rest.severity) query = query.eq('severity', rest.severity);
  if (rest.plant_id) query = query.eq('plant_id', rest.plant_id);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    data: (data ?? []) as AlertWithRelations[],
    count: count ?? 0,
    page,
    pageSize,
  };
}

export async function acknowledgeAlert(
  id: string,
  userId: string
): Promise<Alert> {
  const { data, error } = await supabase
    .from('alerts')
    .update({ status: 'acknowledged', acknowledged_by: userId, acknowledged_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Alert;
}

export async function resolveAlert(id: string): Promise<Alert> {
  const { data, error } = await supabase
    .from('alerts')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Alert;
}

// ============================================================
// DASHBOARD KPIs
// ============================================================

export async function getDashboardKpis(): Promise<OmKpis> {
  const { data, error } = await supabase
    .from('om_kpis')
    .select('*')
    .single();
  if (error) throw error;
  return data as OmKpis;
}

// ============================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================

export function subscribeToAlerts(
  onInsert: (alert: Alert) => void,
  onUpdate: (alert: Alert) => void
) {
  return supabase
    .channel('sunflow-alerts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) =>
      onInsert(payload.new as Alert)
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts' }, (payload) =>
      onUpdate(payload.new as Alert)
    )
    .subscribe();
}

export function subscribeToWorkOrders(
  onInsert: (wo: WorkOrder) => void,
  onUpdate: (wo: WorkOrder) => void
) {
  return supabase
    .channel('sunflow-work-orders')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_orders' }, (payload) =>
      onInsert(payload.new as WorkOrder)
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'work_orders' }, (payload) =>
      onUpdate(payload.new as WorkOrder)
    )
    .subscribe();
}

// ============================================================
// FORMATTERS
// ============================================================

export function formatCapacity(kwp: number): string {
  if (kwp >= 1000) return `${(kwp / 1000).toFixed(1)} MWp`;
  return `${kwp.toFixed(0)} kWp`;
}

export function formatPerformanceRatio(pr: number | null): string {
  if (pr === null) return '—';
  return `${(pr * 100).toFixed(1)}%`;
}

export function formatAvailability(av: number | null): string {
  if (av === null) return '—';
  return `${(av * 100).toFixed(2)}%`;
}

export function formatEnergy(kwh: number): string {
  if (kwh >= 1_000_000) return `${(kwh / 1_000_000).toFixed(2)} GWh`;
  if (kwh >= 1_000) return `${(kwh / 1_000).toFixed(1)} MWh`;
  return `${kwh.toFixed(1)} kWh`;
}

export function formatCurrency(brl: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(brl);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(iso));
}
