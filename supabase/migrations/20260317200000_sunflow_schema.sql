-- Sunflow O&M Pro - Complete Database Schema
-- Enable PostGIS for geolocation
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE plant_status AS ENUM ('active', 'inactive', 'maintenance', 'decommissioned');
CREATE TYPE equipment_status AS ENUM ('operational', 'degraded', 'failed', 'maintenance', 'offline');
CREATE TYPE work_order_status AS ENUM ('open', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE work_order_type AS ENUM ('preventive', 'corrective', 'inspection', 'emergency', 'improvement');
CREATE TYPE work_order_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE inspection_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE finding_severity AS ENUM ('info', 'low', 'medium', 'high', 'critical');
CREATE TYPE finding_status AS ENUM ('open', 'in_progress', 'resolved', 'wont_fix');
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'error', 'critical');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved');
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'technician', 'viewer');

-- ============================================================
-- TABLES
-- ============================================================

-- 1. user_profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'viewer',
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. solar_plants
CREATE TABLE solar_plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  status plant_status NOT NULL DEFAULT 'active',
  capacity_kwp NUMERIC(12,2) NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'BR',
  commissioning_date DATE,
  owner_name TEXT,
  owner_contact TEXT,
  health_score NUMERIC(5,2) DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. equipment
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES solar_plants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- inverter, string_box, panel, transformer, etc.
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  status equipment_status NOT NULL DEFAULT 'operational',
  installation_date DATE,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  capacity_kw NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plant_id, serial_number)
);

-- 4. work_orders
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number TEXT NOT NULL UNIQUE,
  plant_id UUID NOT NULL REFERENCES solar_plants(id) ON DELETE RESTRICT,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  type work_order_type NOT NULL,
  status work_order_status NOT NULL DEFAULT 'open',
  priority work_order_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  scheduled_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_hours NUMERIC(6,2),
  actual_hours NUMERIC(6,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. inspections
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES solar_plants(id) ON DELETE RESTRICT,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  status inspection_status NOT NULL DEFAULT 'scheduled',
  inspector_id UUID REFERENCES user_profiles(id),
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  inspection_type TEXT NOT NULL DEFAULT 'routine',
  checklist JSONB DEFAULT '[]',
  overall_score NUMERIC(5,2) CHECK (overall_score BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. findings
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES solar_plants(id) ON DELETE RESTRICT,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity finding_severity NOT NULL DEFAULT 'medium',
  status finding_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES user_profiles(id),
  photo_urls TEXT[] DEFAULT '{}',
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. performance_data (time-series)
CREATE TABLE performance_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES solar_plants(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  energy_kwh NUMERIC(12,4),
  power_kw NUMERIC(10,4),
  irradiance_wm2 NUMERIC(8,2),
  temperature_c NUMERIC(6,2),
  performance_ratio NUMERIC(5,4) CHECK (performance_ratio BETWEEN 0 AND 2),
  availability NUMERIC(5,4) CHECK (availability BETWEEN 0 AND 1),
  pr_target NUMERIC(5,4) DEFAULT 0.80,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_performance_data_plant_timestamp ON performance_data(plant_id, timestamp DESC);

-- 8. alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES solar_plants(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'warning',
  status alert_status NOT NULL DEFAULT 'active',
  metric_name TEXT,
  metric_value NUMERIC,
  threshold_value NUMERIC,
  acknowledged_by UUID REFERENCES user_profiles(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  auto_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_solar_plants_updated_at BEFORE UPDATE ON solar_plants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inspections_updated_at BEFORE UPDATE ON inspections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_findings_updated_at BEFORE UPDATE ON findings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: auto-generate wo_number
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS wo_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_wo_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.wo_number = 'WO-' || LPAD(nextval('wo_number_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_work_orders_wo_number
  BEFORE INSERT ON work_orders
  FOR EACH ROW
  WHEN (NEW.wo_number IS NULL OR NEW.wo_number = '')
  EXECUTE FUNCTION generate_wo_number();

-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW plants_with_stats AS
SELECT
  p.*,
  COUNT(DISTINCT CASE WHEN wo.status NOT IN ('completed','cancelled') THEN wo.id END) AS open_work_orders,
  COUNT(DISTINCT CASE WHEN a.status = 'active' THEN a.id END) AS active_alerts,
  COUNT(DISTINCT CASE WHEN a.status = 'active' AND a.severity = 'critical' THEN a.id END) AS critical_alerts,
  AVG(pd.performance_ratio) FILTER (WHERE pd.timestamp >= now() - interval '7 days') AS avg_pr_7d,
  AVG(pd.availability) FILTER (WHERE pd.timestamp >= now() - interval '7 days') AS avg_availability_7d
FROM solar_plants p
LEFT JOIN work_orders wo ON wo.plant_id = p.id
LEFT JOIN alerts a ON a.plant_id = p.id
LEFT JOIN performance_data pd ON pd.plant_id = p.id
GROUP BY p.id;

CREATE OR REPLACE VIEW om_kpis AS
SELECT
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS active_plants,
  SUM(p.capacity_kwp) FILTER (WHERE p.status = 'active') AS total_capacity_kwp,
  AVG(pd.performance_ratio) FILTER (WHERE pd.timestamp >= now() - interval '7 days') AS avg_pr_7d,
  AVG(pd.availability) FILTER (WHERE pd.timestamp >= now() - interval '7 days') AS avg_availability_7d,
  COUNT(DISTINCT wo.id) FILTER (WHERE wo.status NOT IN ('completed','cancelled')) AS open_work_orders,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'active' AND a.severity = 'critical') AS critical_alerts
FROM solar_plants p
LEFT JOIN performance_data pd ON pd.plant_id = p.id
LEFT JOIN work_orders wo ON wo.plant_id = p.id
LEFT JOIN alerts a ON a.plant_id = p.id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE solar_plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- user_profiles: users see their own, admins/managers see all
CREATE POLICY "users_own_profile" ON user_profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "admins_all_profiles" ON user_profiles FOR ALL USING (get_user_role() IN ('admin','manager'));

-- solar_plants: authenticated users can read, only admin/manager can write
CREATE POLICY "plants_read" ON solar_plants FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "plants_write" ON solar_plants FOR ALL USING (get_user_role() IN ('admin','manager'));

-- equipment: same as plants
CREATE POLICY "equipment_read" ON equipment FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "equipment_write" ON equipment FOR ALL USING (get_user_role() IN ('admin','manager','technician'));

-- work_orders: all authenticated can read; technicians can update their own; admin/manager full access
CREATE POLICY "wo_read" ON work_orders FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "wo_write_admin" ON work_orders FOR ALL USING (get_user_role() IN ('admin','manager'));
CREATE POLICY "wo_update_technician" ON work_orders FOR UPDATE USING (assigned_to = auth.uid());

-- inspections
CREATE POLICY "inspections_read" ON inspections FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "inspections_write" ON inspections FOR ALL USING (get_user_role() IN ('admin','manager','technician'));

-- findings
CREATE POLICY "findings_read" ON findings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "findings_write" ON findings FOR ALL USING (get_user_role() IN ('admin','manager','technician'));

-- performance_data
CREATE POLICY "perf_read" ON performance_data FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "perf_write" ON performance_data FOR INSERT WITH CHECK (get_user_role() IN ('admin','manager'));

-- alerts
CREATE POLICY "alerts_read" ON alerts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "alerts_write" ON alerts FOR ALL USING (get_user_role() IN ('admin','manager','technician'));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_solar_plants_status ON solar_plants(status);
CREATE INDEX idx_equipment_plant_id ON equipment(plant_id);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_work_orders_plant_id ON work_orders(plant_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_assigned_to ON work_orders(assigned_to);
CREATE INDEX idx_alerts_plant_id ON alerts(plant_id);
CREATE INDEX idx_alerts_status_severity ON alerts(status, severity);
CREATE INDEX idx_findings_inspection_id ON findings(inspection_id);
