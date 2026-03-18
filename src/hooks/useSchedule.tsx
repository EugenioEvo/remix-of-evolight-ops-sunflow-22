import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/services/api';
import { format } from 'date-fns';

interface ScheduleParams {
  osId: string;
  tecnicoId: string;
  data: Date;
  horaInicio: string;
  horaFim: string;
  duracaoMin?: number;
}

export const useSchedule = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const checkConflict = async (
    tecnicoId: string,
    data: Date,
    horaInicio: string,
    horaFim: string,
    osId?: string
  ): Promise<boolean> => {
    try {
      const { data: result, error } = await supabase.rpc('check_schedule_conflict', {
        p_tecnico_id: tecnicoId,
        p_data: format(data, 'yyyy-MM-dd'),
        p_hora_inicio: horaInicio,
        p_hora_fim: horaFim,
        p_os_id: osId || null
      });

      if (error) throw error;
      return result as boolean;
    } catch (error) {
      console.error('Erro ao verificar conflito:', error);
      return false;
    }
  };

  const scheduleOS = async (params: ScheduleParams): Promise<boolean> => {
    setLoading(true);
    try {
      // ===== VALIDAÇÕES PRÉ-AGENDAMENTO =====
      
      // 1. Validar data futura
      const agora = new Date();
      const dataAgendamento = new Date(params.data);
      if (dataAgendamento < agora) {
        toast({
          title: 'Data inválida',
          description: 'Não é possível agendar para uma data passada',
          variant: 'destructive'
        });
        return false;
      }

      // 2. Buscar dados atuais da OS
      const { data: currentOS, error: fetchError } = await supabase
        .from('ordens_servico')
        .select(`
          id,
          data_programada, 
          hora_inicio, 
          hora_fim,
          tickets!inner(status)
        `)
        .eq('id', params.osId)
        .single();

      if (fetchError) throw fetchError;

      // 3. Validar se OS não está concluída
      if (currentOS.tickets.status === 'concluido') {
        toast({
          title: 'OS já concluída',
          description: 'Não é possível agendar uma OS já concluída',
          variant: 'destructive'
        });
        return false;
      }

      // 4. Buscar email do técnico
      const { data: tecnicoData, error: tecnicoError } = await supabase
        .from('tecnicos')
        .select('profiles!inner(email)')
        .eq('id', params.tecnicoId)
        .single();

      if (tecnicoError) throw tecnicoError;

      const tecnicoEmail = tecnicoData?.profiles?.email;
      const hasEmail = !!tecnicoEmail;

      const isUpdate = currentOS?.data_programada && currentOS?.hora_inicio && currentOS?.hora_fim;

      // ===== VERIFICAR CONFLITO =====
      const hasConflict = await checkConflict(
        params.tecnicoId,
        params.data,
        params.horaInicio,
        params.horaFim,
        params.osId
      );

      if (hasConflict) {
        toast({
          title: 'Conflito de agenda',
          description: 'Já existe uma OS agendada para este técnico neste horário',
          variant: 'destructive'
        });
        return false;
      }

      // ===== SALVAR AGENDAMENTO =====
      const { error: updateError } = await supabase
        .from('ordens_servico')
        .update({
          data_programada: params.data.toISOString(),
          hora_inicio: params.horaInicio,
          hora_fim: params.horaFim,
          duracao_estimada_min: params.duracaoMin,
          // Resetar calendar_invite_sent_at para indicar que precisa enviar novo
          calendar_invite_sent_at: null
        })
        .eq('id', params.osId);

      if (updateError) throw updateError;

      // ===== ENVIAR CONVITE (SE TÉCNICO TEM EMAIL) =====
      if (hasEmail) {
        try {
          const { error: inviteError } = await supabase.functions.invoke('send-calendar-invite', {
            body: {
              os_id: params.osId,
              action: isUpdate ? 'update' : 'create'
            }
          });

          if (inviteError) throw inviteError;
          
          toast({
            title: isUpdate ? 'Reagendamento realizado' : 'Agendamento realizado',
            description: `OS ${isUpdate ? 'reagendada' : 'agendada'} para ${format(params.data, 'dd/MM/yyyy')} às ${params.horaInicio}. Convites enviados!`
          });
        } catch (emailError: any) {
          console.error('Erro ao enviar convite:', emailError);
          // Registrar erro no log da OS
          try {
            const { data: currentOS } = await supabase
              .from('ordens_servico')
              .select('email_error_log')
              .eq('id', params.osId)
              .single();

            const errorLog: any[] = Array.isArray(currentOS?.email_error_log) 
              ? currentOS.email_error_log 
              : [];
            
            errorLog.push({
              timestamp: new Date().toISOString(),
              type: 'calendar_invite',
              action: isUpdate ? 'update' : 'create',
              error: emailError.message || 'Falha ao enviar convite de calendário',
              details: emailError.toString()
            });

            await supabase
              .from('ordens_servico')
              .update({ email_error_log: errorLog })
              .eq('id', params.osId);
          } catch (logError) {
            console.error('Erro ao registrar log:', logError);
          }

          toast({
            title: isUpdate ? 'Reagendamento realizado' : 'Agendamento realizado',
            description: 'OS atualizada com sucesso. Falha ao enviar email - você pode reenviar depois.',
            variant: 'default'
          });
        }
      } else {
        // Técnico sem email - apenas confirmar agendamento
        toast({
          title: isUpdate ? 'Reagendamento realizado' : 'Agendamento realizado',
          description: `OS ${isUpdate ? 'reagendada' : 'agendada'} para ${format(params.data, 'dd/MM/yyyy')} às ${params.horaInicio}. Técnico sem email cadastrado.`,
          variant: 'default'
        });
      }

      return true;
    } catch (error: any) {
      console.error('Erro ao agendar OS:', error);
      toast({
        title: 'Erro ao agendar',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { scheduleOS, checkConflict, loading };
};
