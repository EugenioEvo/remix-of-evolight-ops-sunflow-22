import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  tickets_abertos: number;
  tickets_criticos: number;
  tickets_hoje: number;
  os_geradas: number;
  em_execucao: number;
  concluidos: number;
}

export const dashboardKeys = {
  stats: ['dashboard-stats'] as const,
  recentActivity: ['recent-activity'] as const,
};

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (error) throw error;
      const raw = data as unknown as DashboardStats;
      return {
        ticketsAbertos: raw.tickets_abertos || 0,
        ticketsCriticos: raw.tickets_criticos || 0,
        ticketsHoje: raw.tickets_hoje || 0,
        osGeradas: raw.os_geradas || 0,
        emExecucao: raw.em_execucao || 0,
        concluidos: raw.concluidos || 0,
      };
    },
    refetchInterval: 30000,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: dashboardKeys.recentActivity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('status_historico')
        .select(`
          *,
          tickets(numero_ticket, titulo),
          profiles:alterado_por(nome)
        `)
        .order('data_alteracao', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });
}
