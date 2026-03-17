// Sunflow O&M Pro – Type definitions

export type PlantStatus = 'active' | 'inactive' | 'maintenance' | 'decommissioned';
export type EquipmentStatus = 'operational' | 'degraded' | 'failed' | 'maintenance' | 'offline';
export type WorkOrderStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical';
export type WorkOrderType = 'preventive' | 'corrective' | 'inspection' | 'emergency' | 'improvement';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface SolarPlant {
  id: string;
  name: string;
  code: string;
  status: PlantStatus;
  capacity_kwp: number;
  city: string;
  state: string;
  country: string;
  address: string | null;
  commissioning_date: string | null;
  owner_name: string | null;
  owner_contact: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed / aggregated
  avg_pr_7d: number | null;
  avg_availability_7d: number | null;
  health_score: number | null;
}

export interface SolarPlantWithStats extends SolarPlant {
  active_alerts: number;
  critical_alerts: number;
  open_work_orders: number;
}

export interface CreateSolarPlant {
  name: string;
  code: string;
  capacity_kwp: number;
  city: string;
  state: string;
  country: string;
  address?: string | null;
  commissioning_date?: string | null;
  owner_name?: string | null;
  owner_contact?: string | null;
  notes?: string | null;
  status?: PlantStatus;
  created_by?: string | null;
  latitude?: number;
  longitude?: number;
}

export interface Alert {
  id: string;
  plant_id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  metric_name: string | null;
  metric_value: number | null;
  threshold_value: number | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  plant?: { id: string; name: string; code: string };
}

export interface WorkOrder {
  id: string;
  plant_id: string;
  wo_number: string;
  title: string;
  description: string | null;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignee_id: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderWithRelations extends WorkOrder {
  plant?: { id: string; name: string; code: string };
  assignee?: { id: string; full_name: string; email: string };
}

export interface DashboardKpis {
  active_plants: number;
  total_capacity_kwp: number;
  avg_pr_7d: number | null;
  avg_availability_7d: number | null;
  open_work_orders: number;
  critical_alerts: number;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
}
