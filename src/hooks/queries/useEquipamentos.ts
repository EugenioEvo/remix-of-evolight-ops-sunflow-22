import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchData } from '@/services/api';

export const equipamentoKeys = {
  all: ['equipamentos'] as const,
  list: (filters?: Record<string, unknown>) => [...equipamentoKeys.all, 'list', filters] as const,
  detail: (id: string) => [...equipamentoKeys.all, 'detail', id] as const,
  search: (criteria: string) => [...equipamentoKeys.all, 'search', criteria] as const,
};

export function useEquipamentos(filters?: { clienteId?: string }) {
  return useQuery({
    queryKey: equipamentoKeys.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('equipamentos')
        .select('*')
        .order('nome');

      if (filters?.clienteId) query = query.eq('cliente_id', filters.clienteId);

      return fetchData(query);
    },
  });
}

export function useEquipamento(id: string) {
  return useQuery({
    queryKey: equipamentoKeys.detail(id),
    queryFn: () =>
      fetchData(
        supabase.from('equipamentos').select('*').eq('id', id).single()
      ),
    enabled: !!id,
  });
}
