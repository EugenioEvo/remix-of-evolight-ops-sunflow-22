import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/services/api';

export const useCancelOS = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const cancelOS = async (osId: string, motivo?: string): Promise<boolean> => {
    setLoading(true);
    try {
      // Buscar dados da OS antes de cancelar
      const { data: os, error: fetchError } = await supabase
        .from('ordens_servico')
        .select('numero_os, data_programada, calendar_invite_sent_at')
        .eq('id', osId)
        .single();

      if (fetchError || !os) {
        throw new Error('OS não encontrada');
      }

      // Atualizar ticket relacionado para status cancelado
      const { data: osData } = await supabase
        .from('ordens_servico')
        .select('ticket_id')
        .eq('id', osId)
        .single();

      if (osData?.ticket_id) {
        await supabase
          .from('tickets')
          .update({ status: 'cancelado' })
          .eq('id', osData.ticket_id);
      }

      // Se tinha convite enviado, enviar cancelamento
      if (os.calendar_invite_sent_at && os.data_programada) {
        try {
          await supabase.functions.invoke('send-calendar-invite', {
            body: {
              os_id: osId,
              action: 'cancel'
            }
          });
        } catch (emailError) {
          logger.error('Erro ao enviar cancelamento:', emailError);
          // Não bloquear o cancelamento se email falhar
        }
      }

      // Limpar dados de agendamento da OS
      const { error: updateError } = await supabase
        .from('ordens_servico')
        .update({
          data_programada: null,
          hora_inicio: null,
          hora_fim: null,
          duracao_estimada_min: null
        })
        .eq('id', osId);

      if (updateError) throw updateError;

      toast({
        title: 'OS cancelada',
        description: `OS ${os.numero_os} foi cancelada. Convites de calendário removidos.`
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao cancelar OS:', error);
      toast({
        title: 'Erro ao cancelar',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { cancelOS, loading };
};
