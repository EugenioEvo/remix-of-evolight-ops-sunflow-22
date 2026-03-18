import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import logger from '@/lib/logger';

const WO_SELECT = `
  *,
  tickets!inner(
    id, titulo, status, prioridade, endereco_servico,
    clientes(empresa, ufv_solarz, prioridade)
  ),
  rme_relatorios(id, status)
`;

export const useWorkOrdersQuery = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['work_orders'],
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

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('work_orders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => {
        queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
};

export const useDeleteWorkOrder = () => {
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
      queryClient.invalidateQueries({ queryKey: ['work_orders'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({ title: 'OS excluída', description: 'Ordem de serviço excluída e ticket revertido para aprovado.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir OS', description: error.message, variant: 'destructive' });
    },
  });
};

export const useSendCalendarInvite = () => {
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
};
