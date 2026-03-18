import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { logger } from '@/services/api';

export interface TechnicianSchedule {
  date: Date;
  startTime: string;
  endTime: string;
  osNumber?: string;
  ticketTitle?: string;
}

export const useConflictCheck = () => {
  const [loading, setLoading] = useState(false);

  const checkTechnicianConflict = async (
    tecnicoId: string,
    date: Date,
    startTime: string,
    endTime: string,
    osId?: string
  ): Promise<{ hasConflict: boolean; conflicts: TechnicianSchedule[] }> => {
    setLoading(true);
    try {
      const { data: hasConflict, error } = await supabase.rpc('check_schedule_conflict', {
        p_tecnico_id: tecnicoId,
        p_data: format(date, 'yyyy-MM-dd'),
        p_hora_inicio: startTime,
        p_hora_fim: endTime,
        p_os_id: osId || null
      });

      if (error) throw error;

      if (hasConflict) {
        // Buscar detalhes dos conflitos
        const { data: conflictingOS, error: conflictError } = await supabase
          .from('ordens_servico')
          .select(`
            numero_os,
            data_programada,
            hora_inicio,
            hora_fim,
            tickets(titulo)
          `)
          .eq('tecnico_id', tecnicoId)
          .gte('data_programada', format(date, 'yyyy-MM-dd'))
          .lte('data_programada', format(date, 'yyyy-MM-dd'))
          .not('id', 'eq', osId || '00000000-0000-0000-0000-000000000000');

        if (conflictError) throw conflictError;

        const conflicts: TechnicianSchedule[] = (conflictingOS || [])
          .filter(os => {
            if (!os.hora_inicio || !os.hora_fim) return false;
            
            // Verificar sobreposição de horários
            const conflictStart = os.hora_inicio;
            const conflictEnd = os.hora_fim;
            
            return (
              (startTime >= conflictStart && startTime < conflictEnd) ||
              (endTime > conflictStart && endTime <= conflictEnd) ||
              (startTime <= conflictStart && endTime >= conflictEnd)
            );
          })
          .map(os => ({
            date: new Date(os.data_programada),
            startTime: os.hora_inicio!,
            endTime: os.hora_fim!,
            osNumber: os.numero_os,
            ticketTitle: (os.tickets as any)?.titulo
          }));

        return { hasConflict: true, conflicts };
      }

      return { hasConflict: false, conflicts: [] };
    } catch (error) {
      console.error('Erro ao verificar conflito:', error);
      return { hasConflict: false, conflicts: [] };
    } finally {
      setLoading(false);
    }
  };

  const getTechnicianSchedule = async (
    tecnicoId: string,
    date: Date
  ): Promise<TechnicianSchedule[]> => {
    try {
      const { data, error } = await supabase
        .from('ordens_servico')
        .select(`
          numero_os,
          data_programada,
          hora_inicio,
          hora_fim,
          tickets(titulo)
        `)
        .eq('tecnico_id', tecnicoId)
        .gte('data_programada', format(date, 'yyyy-MM-dd'))
        .lte('data_programada', format(date, 'yyyy-MM-dd'))
        .not('hora_inicio', 'is', null)
        .not('hora_fim', 'is', null)
        .order('hora_inicio');

      if (error) throw error;

      return (data || []).map(os => ({
        date: new Date(os.data_programada),
        startTime: os.hora_inicio!,
        endTime: os.hora_fim!,
        osNumber: os.numero_os,
        ticketTitle: (os.tickets as any)?.titulo
      }));
    } catch (error) {
      console.error('Erro ao buscar agenda:', error);
      return [];
    }
  };

  return {
    checkTechnicianConflict,
    getTechnicianSchedule,
    loading
  };
};
