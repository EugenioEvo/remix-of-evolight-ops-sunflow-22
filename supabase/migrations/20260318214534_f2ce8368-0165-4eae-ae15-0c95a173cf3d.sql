
-- 1. solar_plants
CREATE TABLE public.solar_plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  nome TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  potencia_kwp NUMERIC(10,2),
  marca_inversor TEXT,
  modelo_inversor TEXT,
  serial_inversor TEXT,
  data_instalacao DATE,
  solarz_plant_id TEXT,
  solarz_status TEXT,
  ultima_sincronizacao TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. solar_metrics
CREATE TABLE public.solar_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES public.solar_plants(id) ON DELETE CASCADE NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL,
  geracao_kwh NUMERIC(10,3),
  potencia_instantanea_kw NUMERIC(10,3),
  irradiacao_wm2 NUMERIC(8,2),
  temperatura_inversor NUMERIC(5,1),
  tensao_dc NUMERIC(8,2),
  corrente_dc NUMERIC(8,3),
  tensao_ac NUMERIC(8,2),
  corrente_ac NUMERIC(8,3),
  frequencia_hz NUMERIC(5,2),
  fator_potencia NUMERIC(4,3),
  eficiencia_percent NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. solar_alerts
CREATE TABLE public.solar_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID REFERENCES public.solar_plants(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL,
  severidade TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  dados_contexto JSONB,
  status TEXT NOT NULL DEFAULT 'aberto',
  ticket_id UUID REFERENCES public.tickets(id),
  resolvido_em TIMESTAMPTZ,
  resolvido_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. solar_agent_logs
CREATE TABLE public.solar_agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL,
  plant_id UUID REFERENCES public.solar_plants(id),
  input_data JSONB,
  output_data JSONB,
  status TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_solar_metrics_plant_timestamp ON public.solar_metrics (plant_id, "timestamp" DESC);
CREATE INDEX idx_solar_alerts_plant_status ON public.solar_alerts (plant_id, status, created_at DESC);
CREATE INDEX idx_solar_alerts_open ON public.solar_alerts (status) WHERE status = 'aberto';
CREATE INDEX idx_solar_agent_logs_agent ON public.solar_agent_logs (agent_name, created_at DESC);

-- Updated_at triggers
CREATE TRIGGER set_updated_at_solar_plants BEFORE UPDATE ON public.solar_plants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_solar_alerts BEFORE UPDATE ON public.solar_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.solar_plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_agent_logs ENABLE ROW LEVEL SECURITY;

-- solar_plants policies
CREATE POLICY "Admins manage solar plants" ON public.solar_plants FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'area_tecnica'::app_role));
CREATE POLICY "Technicians view assigned solar plants" ON public.solar_plants FOR SELECT USING (has_role(auth.uid(), 'tecnico_campo'::app_role) AND can_tech_view_cliente(auth.uid(), cliente_id));
CREATE POLICY "Clients view own solar plants" ON public.solar_plants FOR SELECT USING (EXISTS (SELECT 1 FROM profiles p JOIN clientes c ON c.profile_id = p.id WHERE c.id = solar_plants.cliente_id AND p.user_id = auth.uid()));

-- solar_metrics policies
CREATE POLICY "Admins manage solar metrics" ON public.solar_metrics FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'area_tecnica'::app_role));
CREATE POLICY "Users view metrics of accessible plants" ON public.solar_metrics FOR SELECT USING (EXISTS (SELECT 1 FROM solar_plants sp WHERE sp.id = solar_metrics.plant_id AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'area_tecnica'::app_role) OR (has_role(auth.uid(), 'tecnico_campo'::app_role) AND can_tech_view_cliente(auth.uid(), sp.cliente_id)) OR EXISTS (SELECT 1 FROM profiles p JOIN clientes c ON c.profile_id = p.id WHERE c.id = sp.cliente_id AND p.user_id = auth.uid()))));

-- solar_alerts policies
CREATE POLICY "Admins manage solar alerts" ON public.solar_alerts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'area_tecnica'::app_role));
CREATE POLICY "Users view alerts of accessible plants" ON public.solar_alerts FOR SELECT USING (EXISTS (SELECT 1 FROM solar_plants sp WHERE sp.id = solar_alerts.plant_id AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'area_tecnica'::app_role) OR (has_role(auth.uid(), 'tecnico_campo'::app_role) AND can_tech_view_cliente(auth.uid(), sp.cliente_id)) OR EXISTS (SELECT 1 FROM profiles p JOIN clientes c ON c.profile_id = p.id WHERE c.id = sp.cliente_id AND p.user_id = auth.uid()))));

-- solar_agent_logs policies
CREATE POLICY "Admins manage agent logs" ON public.solar_agent_logs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'area_tecnica'::app_role));
CREATE POLICY "Admins view agent logs" ON public.solar_agent_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'area_tecnica'::app_role));
