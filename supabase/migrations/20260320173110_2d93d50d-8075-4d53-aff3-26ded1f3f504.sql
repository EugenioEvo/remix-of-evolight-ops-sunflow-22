
-- Tabela cliente_prontuario para o Agente Encantador
CREATE TABLE public.cliente_prontuario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome_contato TEXT,
  telefone TEXT,
  email TEXT,
  cargo TEXT,
  canal_preferido TEXT DEFAULT 'whatsapp',
  horario_preferido TEXT,
  historico_interacoes JSONB DEFAULT '[]'::jsonb,
  notas TEXT,
  ultima_interacao TIMESTAMP WITH TIME ZONE,
  satisfacao_score INTEGER,
  tags TEXT[],
  dados_extras JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.cliente_prontuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage prontuario"
  ON public.cliente_prontuario FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'area_tecnica'::app_role));

CREATE POLICY "Clients view own prontuario"
  ON public.cliente_prontuario FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM clientes c JOIN profiles p ON p.id = c.profile_id
    WHERE c.id = cliente_prontuario.cliente_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "System insert prontuario"
  ON public.cliente_prontuario FOR INSERT
  WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_cliente_prontuario_updated_at
  BEFORE UPDATE ON public.cliente_prontuario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_cliente_prontuario_cliente_id ON public.cliente_prontuario(cliente_id);
