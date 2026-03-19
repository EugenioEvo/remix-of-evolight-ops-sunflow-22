import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchData, mutateData } from '@/services/api';

export const rmeKeys = {
  all: ['rme-relatorios'] as const,
  list: (osId?: string) => [...rmeKeys.all, osId] as const,
  detail: (id: string) => ['rme-relatorio', id] as const,
  checklist: (rmeId: string) => ['rme-checklist', rmeId] as const,
};

export function useRMERelatorios(osId?: string) {
  return useQuery({
    queryKey: rmeKeys.list(osId),
    queryFn: async () => {
      let query = supabase.from('rme_relatorios').select('*');
      if (osId) query = query.eq('ordem_servico_id', osId);
      return fetchData(query);
    },
  });
}

export function useRMERelatorio(id: string) {
  return useQuery({
    queryKey: rmeKeys.detail(id),
    queryFn: () =>
      fetchData(
        supabase.from('rme_relatorios').select('*').eq('id', id).single()
      ),
    enabled: !!id,
  });
}

export function useCreateRME() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) =>
      mutateData(
        supabase.from('rme_relatorios').insert([data as never]).select().single()
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rmeKeys.all });
    },
  });
}

export function useUpdateRME() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      mutateData(
        supabase.from('rme_relatorios').update(data as never).eq('id', id).select().single()
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: rmeKeys.all });
      queryClient.invalidateQueries({ queryKey: rmeKeys.detail(variables.id) });
    },
  });
}

export function useRMEChecklist(rmeId: string) {
  return useQuery({
    queryKey: rmeKeys.checklist(rmeId),
    queryFn: () =>
      fetchData(
        supabase
          .from('rme_checklist_items')
          .select('*')
          .eq('rme_id', rmeId)
          .order('category')
          .order('item_key')
      ),
    enabled: !!rmeId,
  });
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      mutateData(
        supabase.from('rme_checklist_items').update({ checked }).eq('id', id).select().single()
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rme-checklist'] });
    },
  });
}

export function usePopulateChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rmeId: string) => {
      const { data, error } = await supabase.rpc('populate_rme_checklist', { p_rme_id: rmeId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rme-checklist'] });
    },
  });
}
