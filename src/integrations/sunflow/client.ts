// Sunflow O&M Pro – Client stub
// This module provides placeholder functions for the Sunflow integration.
// Replace with real API calls once the Sunflow backend is connected.

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

// ── Data access stubs ───────────────────────────────────────
// These return empty / default data. Wire them up to your real API.

export async function getDashboardKpis(): Promise<DashboardKpis> {
  return {
    active_plants: 0,
    total_capacity_kwp: 0,
    avg_pr_7d: null,
    avg_availability_7d: null,
    open_work_orders: 0,
    critical_alerts: 0,
  };
}

export async function getPlantsWithStats(): Promise<SolarPlantWithStats[]> {
  return [];
}

export async function getPlantById(id: string): Promise<SolarPlant | null> {
  console.log('[sunflow] getPlantById', id);
  return null;
}

export async function createPlant(data: CreateSolarPlant): Promise<SolarPlant> {
  console.log('[sunflow] createPlant', data);
  throw new Error('Sunflow backend not configured. Connect the Sunflow API to enable this feature.');
}

export async function getWorkOrders(params?: {
  plant_id?: string;
  status?: WorkOrderStatus;
  type?: WorkOrderType;
  priority?: WorkOrderPriority;
  pageSize?: number;
}): Promise<PaginatedResult<WorkOrderWithRelations>> {
  console.log('[sunflow] getWorkOrders', params);
  return { data: [], count: 0 };
}

export async function getAlerts(params?: {
  plant_id?: string;
  status?: AlertStatus;
  severity?: AlertSeverity;
  pageSize?: number;
}): Promise<PaginatedResult<Alert>> {
  console.log('[sunflow] getAlerts', params);
  return { data: [], count: 0 };
}

export async function acknowledgeAlert(alertId: string, userId: string): Promise<void> {
  console.log('[sunflow] acknowledgeAlert', alertId, userId);
  throw new Error('Sunflow backend not configured.');
}

export async function resolveAlert(alertId: string): Promise<void> {
  console.log('[sunflow] resolveAlert', alertId);
  throw new Error('Sunflow backend not configured.');
}
