import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchData, mutateData } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

export const rmeKeys = {
  all: ['rme-relatorios'] as const,
  list: (osId?: string) => [...rmeKeys.all, osId] as const,
  detail: (id: string) => ['rme-relatorio', id] as const,
  checklist: (rmeId: string) => ['rme-checklist', rmeId] as const,
  lista: (page: number, searchTerm: string, status: string) =>
    ['rme-lista', page, searchTerm, status] as const,
  stats: ['rme-stats'] as const,
};

const ITEMS_PER_PAGE = 15;

// ─── Existing hooks ───

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

// ─── New hooks (migrated from useRMEQuery.tsx) ───

interface RMEListaParams {
  page?: number;
  searchTerm?: string;
  status?: string;
}

export function useRMEListaPaginada(params: RMEListaParams = {}) {
  const { page = 1, searchTerm = '', status = 'pendente' } = params;

  return useQuery({
    queryKey: rmeKeys.lista(page, searchTerm, status),
    queryFn: async () => {
      let query = supabase
        .from('rme_relatorios')
        .select(`
          *,
          tickets!inner(
            titulo,
            numero_ticket,
            clientes!inner(empresa, prioridade)
          ),
          tecnicos!inner(
            profiles!inner(nome)
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (status !== 'all') {
        query = query.eq('status_aprovacao', status);
      }

      if (searchTerm) {
        query = query.or(`
          tickets.titulo.ilike.%${searchTerm}%,
          tickets.numero_ticket.ilike.%${searchTerm}%
        `);
      }

      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Fetch approver names
      const approverIds = [...new Set((data || []).filter((r: any) => r.aprovado_por).map((r: any) => r.aprovado_por))];
      let approverMap: Record<string, string> = {};

      if (approverIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, nome')
          .in('user_id', approverIds);

        if (profiles) {
          approverMap = Object.fromEntries(profiles.map(p => [p.user_id, p.nome]));
        }
      }

      const rmesWithApprover = (data || []).map((rme: any) => ({
        ...rme,
        aprovador: rme.aprovado_por ? { nome: approverMap[rme.aprovado_por] || 'Desconhecido' } : null,
      }));

      return {
        rmes: rmesWithApprover,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
        currentPage: page,
      };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useRMEStats() {
  return useQuery({
    queryKey: rmeKeys.stats,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rme_relatorios')
        .select('status_aprovacao');

      if (error) throw error;

      return {
        pendente: data?.filter(r => r.status_aprovacao === 'pendente').length || 0,
        aprovado: data?.filter(r => r.status_aprovacao === 'aprovado').length || 0,
        rejeitado: data?.filter(r => r.status_aprovacao === 'rejeitado').length || 0,
        total: data?.length || 0,
      };
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useApproveRME() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ rmeId, observacoes }: { rmeId: string; observacoes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('rme_relatorios')
        .update({
          status_aprovacao: 'aprovado',
          aprovado_por: user.id,
          data_aprovacao: new Date().toISOString(),
          observacoes_aprovacao: observacoes,
        })
        .eq('id', rmeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rme-lista'] });
      queryClient.invalidateQueries({ queryKey: rmeKeys.stats });
      toast({
        title: 'RME Aprovado',
        description: 'O relatório foi aprovado com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao aprovar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRejectRME() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ rmeId, motivo }: { rmeId: string; motivo: string }) => {
      if (!motivo) throw new Error('Motivo da rejeição é obrigatório');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('rme_relatorios')
        .update({
          status_aprovacao: 'rejeitado',
          aprovado_por: user.id,
          data_aprovacao: new Date().toISOString(),
          observacoes_aprovacao: motivo,
        })
        .eq('id', rmeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rme-lista'] });
      queryClient.invalidateQueries({ queryKey: rmeKeys.stats });
      toast({
        title: 'RME Rejeitado',
        description: 'O relatório foi rejeitado. O técnico será notificado.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao rejeitar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
