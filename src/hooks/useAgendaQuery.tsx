import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import logger from '@/lib/logger';

const AGENDA_SELECT = `
  *,
  tecnicos!tecnico_id(
    id,
    profile_id,
    profiles!inner(nome, email)
  ),
  tickets!inner(
    numero_ticket,
    titulo,
    endereco_servico,
    status,
    prioridade,
    clientes!inner(empresa)
  )
`;

export const useAgendaQuery = (selectedDate: Date, selectedTecnico: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['agenda', selectedDate.getFullYear(), selectedDate.getMonth(), selectedTecnico],
    queryFn: async () => {
      const start = startOfMonth(selectedDate);
      const end = endOfMonth(selectedDate);

      let q = supabase
        .from('ordens_servico')
        .select(AGENDA_SELECT)
        .gte('data_programada', start.toISOString())
        .lte('data_programada', end.toISOString())
        .order('data_programada', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (selectedTecnico !== 'todos') {
        q = q.eq('tecnico_id', selectedTecnico);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data as any) || [];
    },
    staleTime: 30 * 1000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('agenda_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => {
        queryClient.invalidateQueries({ queryKey: ['agenda'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
};

export const useTecnicosQuery = () => {
  return useQuery({
    queryKey: ['tecnicos_prestadores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('prestadores')
        .select('id, nome')
        .eq('categoria', 'tecnico')
        .order('nome');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useResendCalendarInvite = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const resend = async (osId: string, numeroOS: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-calendar-invite', {
        body: { os_id: osId, action: 'create' },
      });
      if (error) throw error;
      toast({ title: 'Convite reenviado', description: `Convite de calendário reenviado para OS ${numeroOS}` });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
    } catch (error: any) {
      logger.error('Erro ao reenviar convite:', error);
      toast({ title: 'Erro ao reenviar', description: error.message || 'Não foi possível reenviar o convite', variant: 'destructive' });
      throw error;
    }
  };

  return { resend };
};

export const useGeneratePresenceQR = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const generate = async (osId: string) => {
    try {
      const { data, error } = await supabase.rpc('generate_presence_token', { p_os_id: osId });
      if (error) throw error;
      toast({ title: 'QR Code gerado', description: 'Token de confirmação de presença criado com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
    } catch (error: any) {
      logger.error('Erro ao gerar token:', error);
      toast({ title: 'Erro ao gerar QR Code', description: error.message, variant: 'destructive' });
    }
  };

  return { generate };
};
