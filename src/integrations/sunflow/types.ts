// Sunflow O&M Pro - TypeScript Types

// ============================================================
// ENUMS
// ============================================================

export type PlantStatus = 'active' | 'inactive' | 'maintenance' | 'decommissioned';
export type EquipmentStatus = 'operational' | 'degraded' | 'failed' | 'maintenance' | 'offline';
export type WorkOrderStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type WorkOrderType = 'preventive' | 'corrective' | 'inspection' | 'emergency' | 'improvement';
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical';
export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type FindingStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type UserRole = 'admin' | 'manager' | 'technician' | 'viewer';

// ============================================================
// ENTITIES
// ============================================================

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SolarPlant {
  id: string;
  name: string;
  code: string;
  status: PlantStatus;
  capacity_kwp: number;
  location: unknown | null; // PostGIS GEOGRAPHY
  address: string | null;
  city: string;
  state: string;
  country: string;
  commissioning_date: string | null;
  owner_name: string | null;
  owner_contact: string | null;
  health_score: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolarPlantWithStats extends SolarPlant {
  open_work_orders: number;
  active_alerts: number;
  critical_alerts: number;
  avg_pr_7d: number | null;
  avg_availability_7d: number | null;
}

export interface Equipment {
  id: string;
  plant_id: string;
  name: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: EquipmentStatus;
  installation_date: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  capacity_kw: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  wo_number: string;
  plant_id: string;
  equipment_id: string | null;
  title: string;
  description: string | null;
  type: WorkOrderType;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  assigned_to: string | null;
  created_by: string | null;
  scheduled_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderWithRelations extends WorkOrder {
  plant?: Pick<SolarPlant, 'id' | 'name' | 'code'>;
  assignee?: Pick<UserProfile, 'id' | 'full_name' | 'email'>;
}

export interface Inspection {
  id: string;
  plant_id: string;
  work_order_id: string | null;
  status: InspectionStatus;
  inspector_id: string | null;
  scheduled_date: string;
  completed_date: string | null;
  inspection_type: string;
  checklist: ChecklistItem[];
  overall_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  notes?: string;
}

export interface Finding {
  id: string;
  inspection_id: string;
  plant_id: string;
  equipment_id: string | null;
  title: string;
  description: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  assigned_to: string | null;
  photo_urls: string[];
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PerformanceData {
  id: string;
  plant_id: string;
  timestamp: string;
  energy_kwh: number | null;
  power_kw: number | null;
  irradiance_wm2: number | null;
  temperature_c: number | null;
  performance_ratio: number | null;
  availability: number | null;
  pr_target: number | null;
  created_at: string;
}

export interface Alert {
  id: string;
  plant_id: string;
  equipment_id: string | null;
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
  auto_resolved: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertWithRelations extends Alert {
  plant?: Pick<SolarPlant, 'id' | 'name' | 'code'>;
  equipment?: Pick<Equipment, 'id' | 'name' | 'type'>;
}

// ============================================================
// DASHBOARD / KPI TYPES
// ============================================================

export interface OmKpis {
  active_plants: number;
  total_capacity_kwp: number;
  avg_pr_7d: number | null;
  avg_availability_7d: number | null;
  open_work_orders: number;
  critical_alerts: number;
}

export interface KpiTrend {
  value: number;
  previousValue: number;
  direction: 'up' | 'down' | 'neutral';
  percentChange: number;
}

// ============================================================
// FORM / INPUT TYPES
// ============================================================

export type CreateSolarPlant = Omit<SolarPlant,
  'id' | 'created_at' | 'updated_at' | 'health_score' | 'location'
> & {
  latitude?: number;
  longitude?: number;
};

export type UpdateSolarPlant = Partial<CreateSolarPlant>;

export type CreateWorkOrder = Omit<WorkOrder,
  'id' | 'wo_number' | 'created_at' | 'updated_at' | 'started_at' | 'completed_at'
>;

export type UpdateWorkOrder = Partial<Omit<WorkOrder, 'id' | 'wo_number' | 'created_at'>>;

export type CreateAlert = Omit<Alert,
  'id' | 'created_at' | 'updated_at' | 'acknowledged_at' | 'resolved_at' | 'auto_resolved'
>;

// ============================================================
// UTILITY TYPES
// ============================================================

export type EntityWithTimestamps = { created_at: string; updated_at: string };
export type PaginatedResult<T> = { data: T[]; count: number; page: number; pageSize: number };
export type AsyncState<T> = { data: T | null; loading: boolean; error: string | null };
