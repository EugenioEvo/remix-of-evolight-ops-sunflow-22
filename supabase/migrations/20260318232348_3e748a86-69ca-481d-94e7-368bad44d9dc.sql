
-- Drop duplicated Sunflow tables/views created by the old migration
DROP VIEW IF EXISTS public.plants_with_stats CASCADE;
DROP VIEW IF EXISTS public.om_kpis CASCADE;
DROP TABLE IF EXISTS public.findings CASCADE;
DROP TABLE IF EXISTS public.inspections CASCADE;
DROP TABLE IF EXISTS public.performance_data CASCADE;
DROP TABLE IF EXISTS public.equipment CASCADE;
DROP TABLE IF EXISTS public.work_orders CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Add origem column to tickets for agent-generated tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS origem text DEFAULT 'manual';
COMMENT ON COLUMN public.tickets.origem IS 'Origem do ticket: manual, agente_monitor, importacao';
