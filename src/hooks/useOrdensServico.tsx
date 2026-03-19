import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import logger from '@/lib/logger';

const OS_SELECT = `
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

interface UseOrdensServicoOptions {
  tecnicoId?: string | null;
  profileId?: string | null;
  isTecnico?: boolean;
  enabled?: boolean;
}

export const useOrdensServicoByTecnico = (options: UseOrdensServicoOptions = {}) => {
  const { profileId, isTecnico = false, enabled = true } = options;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['ordens_servico', 'by_tecnico', profileId, isTecnico],
    queryFn: async () => {
      let q = supabase
        .from('ordens_servico')
        .select(OS_SELECT)
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

  // Realtime subscription
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
};

export const useUpdateOSStatus = () => {
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
};
