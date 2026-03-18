import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchData, mutateData } from '@/services/api';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export const solarKeys = {
  plants: ['solar-plants'] as const,
  plantList: (filters?: Record<string, unknown>) => [...solarKeys.plants, 'list', filters] as const,
  plantDetail: (id: string) => [...solarKeys.plants, 'detail', id] as const,
  metrics: ['solar-metrics'] as const,
  metricsByPlant: (plantId: string, range?: string) => [...solarKeys.metrics, plantId, range] as const,
  alerts: ['solar-alerts'] as const,
  alertList: (filters?: Record<string, unknown>) => [...solarKeys.alerts, 'list', filters] as const,
  agentLogs: ['solar-agent-logs'] as const,
};

// ===== Solar Plants =====

export function useSolarPlants(filters?: { clienteId?: string; ativo?: boolean }) {
  return useQuery({
    queryKey: solarKeys.plantList(filters),
    queryFn: async () => {
      let query = supabase
        .from('solar_plants')
        .select('*, clientes(empresa, cidade, estado)')
        .order('nome');

      if (filters?.clienteId) query = query.eq('cliente_id', filters.clienteId);
      if (filters?.ativo !== undefined) query = query.eq('ativo', filters.ativo);

      return fetchData(query);
    },
  });
}

export function useSolarPlant(id: string) {
  return useQuery({
    queryKey: solarKeys.plantDetail(id),
    queryFn: () =>
      fetchData(
        supabase
          .from('solar_plants')
          .select('*, clientes(empresa, cidade, estado, endereco)')
          .eq('id', id)
          .single()
      ),
    enabled: !!id,
  });
}

export function useCreateSolarPlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TablesInsert<'solar_plants'>) =>
      mutateData(
        supabase.from('solar_plants').insert(data).select().single(),
        'Planta solar criada!'
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: solarKeys.plants }),
  });
}

export function useUpdateSolarPlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'solar_plants'> }) =>
      mutateData(
        supabase.from('solar_plants').update(data).eq('id', id).select().single(),
        'Planta solar atualizada!'
      ),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: solarKeys.plantDetail(id) });
      qc.invalidateQueries({ queryKey: solarKeys.plants });
    },
  });
}

// ===== Solar Metrics =====

export function useSolarMetrics(plantId: string, options?: { days?: number }) {
  const days = options?.days ?? 7;
  return useQuery({
    queryKey: solarKeys.metricsByPlant(plantId, `${days}d`),
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      return fetchData(
        supabase
          .from('solar_metrics')
          .select('*')
          .eq('plant_id', plantId)
          .gte('timestamp', since.toISOString())
          .order('timestamp', { ascending: true })
      );
    },
    enabled: !!plantId,
  });
}

// ===== Solar Alerts =====

export function useSolarAlerts(filters?: { plantId?: string; status?: string }) {
  return useQuery({
    queryKey: solarKeys.alertList(filters),
    queryFn: async () => {
      let query = supabase
        .from('solar_alerts')
        .select('*, solar_plants(nome, cliente_id)')
        .order('created_at', { ascending: false });

      if (filters?.plantId) query = query.eq('plant_id', filters.plantId);
      if (filters?.status) query = query.eq('status', filters.status);

      return fetchData(query);
    },
  });
}

export function useResolveSolarAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, resolvidoPor }: { alertId: string; resolvidoPor: string }) =>
      mutateData(
        supabase
          .from('solar_alerts')
          .update({
            status: 'resolvido',
            resolvido_em: new Date().toISOString(),
            resolvido_por: resolvidoPor,
          })
          .eq('id', alertId)
          .select()
          .single(),
        'Alerta resolvido!'
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: solarKeys.alerts }),
  });
}

// ===== Agent Logs =====

export function useSolarAgentLogs(filters?: { agentName?: string; limit?: number }) {
  return useQuery({
    queryKey: [...solarKeys.agentLogs, filters],
    queryFn: async () => {
      let query = supabase
        .from('solar_agent_logs')
        .select('*, solar_plants(nome)')
        .order('created_at', { ascending: false })
        .limit(filters?.limit ?? 50);

      if (filters?.agentName) query = query.eq('agent_name', filters.agentName);

      return fetchData(query);
    },
  });
}
