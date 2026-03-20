import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { osService, type OSFilters } from '@/services/osService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import logger from '@/lib/logger';
import type { OrdemServicoInsert } from '@/types';

export const osKeys = {
  all: ['ordens_servico'] as const,
  lists: () => [...osKeys.all, 'list'] as const,
  list: (filters: OSFilters) => [...osKeys.lists(), filters] as const,
  details: () => [...osKeys.all, 'detail'] as const,
  detail: (id: string) => [...osKeys.details(), id] as const,
  byTecnico: (id: string) => [...osKeys.all, 'tecnico', id] as const,
  workOrders: ['work_orders'] as const,
  minhasOS: (profileId?: string | null, isTecnico?: boolean) =>
    ['ordens_servico', 'by_tecnico', profileId, isTecnico] as const,
};

export function useOrdensServico(filters?: OSFilters) {
  return useQuery({
    queryKey: osKeys.list(filters ?? {}),
    queryFn: () => osService.list(filters),
  });
}

export function useOrdemServico(id: string) {
  return useQuery({
    queryKey: osKeys.detail(id),
    queryFn: () => osService.getById(id),
    enabled: !!id,
  });
}

export function useOSByTecnico(tecnicoId: string) {
  return useQuery({
    queryKey: osKeys.byTecnico(tecnicoId),
    queryFn: () => osService.getByTecnico(tecnicoId),
    enabled: !!tecnicoId,
  });
}

export function useCreateOS() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OrdemServicoInsert) => osService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: osKeys.lists() });
    },
  });
}

export function useAssignTecnico() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ osId, tecnicoId }: { osId: string; tecnicoId: string }) =>
      osService.assignTecnico(osId, tecnicoId),
    onSuccess: (_, { osId }) => {
      queryClient.invalidateQueries({ queryKey: osKeys.detail(osId) });
      queryClient.invalidateQueries({ queryKey: osKeys.lists() });
    },
  });
}

// ─── Migrated from useWorkOrdersQuery.tsx ───

const WO_SELECT = `
  *,
  tickets!inner(
    id, titulo, status, prioridade, endereco_servico,
    clientes(empresa, ufv_solarz, prioridade)
  ),
  rme_relatorios(id, status)
`;

export function useWorkOrders() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: osKeys.workOrders,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(WO_SELECT)
        .order('data_emissao', { ascending: false });

      if (error) throw error;

      return (data || []).map((os: any) => ({
        ...os,
        work_type: os.work_type || [],
        rme_relatorios: os.rme_relatorios || [],
      }));
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('work_orders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => {
        queryClient.invalidateQueries({ queryKey: osKeys.workOrders });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useDeleteOS() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ osId, ticketId }: { osId: string; ticketId: string }) => {
      const { error: osError } = await supabase
        .from('ordens_servico')
        .delete()
        .eq('id', osId);
      if (osError) throw osError;

      const { error: ticketError } = await supabase
        .from('tickets')
        .update({ status: 'aprovado' } as any)
        .eq('id', ticketId);
      if (ticketError) throw ticketError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: osKeys.workOrders });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: 'OS excluída', description: 'Ordem de serviço excluída e ticket revertido para aprovado.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir OS', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSendCalendarInvite() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (osId: string) => {
      const { data, error } = await supabase.functions.invoke('send-calendar-invite', {
        body: { os_id: osId, action: 'create' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar email');
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Email enviado!', description: `Convite enviado para: ${data.recipients?.join(', ')}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao enviar email', description: error.message, variant: 'destructive' });
    },
  });
}

// ─── Migrated from useOrdensServico.tsx ───

const MINHAS_OS_SELECT = `
  *,
  data_programada,
  hora_inicio,
  hora_fim,
  equipe,
  servico_solicitado,
  inspetor_responsavel,
  tipo_trabalho,
  tickets!inner (
    id,
    numero_ticket,
    titulo,
    descricao,
    endereco_servico,
    prioridade,
    status,
    data_inicio_execucao,
    clientes (
      empresa,
      endereco,
      cidade,
      estado,
      profiles!clientes_profile_id_fkey(telefone)
    )
  )
`;

interface UseMinhasOSOptions {
  profileId?: string | null;
  isTecnico?: boolean;
  enabled?: boolean;
}

export function useMinhasOS(options: UseMinhasOSOptions = {}) {
  const { profileId, isTecnico = false, enabled = true } = options;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: osKeys.minhasOS(profileId, isTecnico),
    queryFn: async () => {
      let q = supabase
        .from('ordens_servico')
        .select(MINHAS_OS_SELECT)
        .order('data_emissao', { ascending: false });

      if (isTecnico && profileId) {
        const { data: tecnicoData, error: tecnicoError } = await supabase
          .from('tecnicos')
          .select('id')
          .eq('profile_id', profileId)
          .single();

        if (tecnicoError) {
          toast({
            title: 'Erro ao carregar perfil',
            description: 'Seu usuário não está vinculado a um perfil de técnico.',
            variant: 'destructive',
          });
          throw tecnicoError;
        }

        q = q.eq('tecnico_id', tecnicoData.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && (isTecnico ? !!profileId : true),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('ordens_servico_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordens_servico' },
        () => {
          logger.debug('Realtime: ordens_servico changed');
          queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        () => {
          logger.debug('Realtime: tickets changed (for OS view)');
          queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useUpdateOSStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ ticketId, status, extraData }: {
      ticketId: string;
      status: string;
      extraData?: Record<string, unknown>;
    }) => {
      const updateData: Record<string, unknown> = {
        status,
        ...extraData,
      };
      const { error } = await supabase
        .from('tickets')
        .update(updateData as any)
        .eq('id', ticketId);

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
          throw new Error('Você não tem permissão para alterar o status deste ticket. Fale com o administrador.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
      queryClient.invalidateQueries({ queryKey: osKeys.workOrders });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}