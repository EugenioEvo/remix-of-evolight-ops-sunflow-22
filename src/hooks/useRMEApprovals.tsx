import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/services/api';

export const useRMEApprovals = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const approveRME = async (rmeId: string, observacoes?: string) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('rme_relatorios')
        .update({
          status_aprovacao: 'aprovado',
          aprovado_por: userData.user?.id,
          data_aprovacao: new Date().toISOString(),
          observacoes_aprovacao: observacoes || null,
        })
        .eq('id', rmeId);

      if (error) throw error;

      toast({
        title: 'RME Aprovado',
        description: 'O relatório foi aprovado com sucesso!',
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao aprovar RME:', error);
      toast({
        title: 'Erro ao aprovar',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const rejectRME = async (rmeId: string, motivo: string) => {
    if (!motivo.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo da rejeição',
        variant: 'destructive',
      });
      return false;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('rme_relatorios')
        .update({
          status_aprovacao: 'rejeitado',
          aprovado_por: userData.user?.id,
          data_aprovacao: new Date().toISOString(),
          observacoes_aprovacao: motivo,
        })
        .eq('id', rmeId);

      if (error) throw error;

      toast({
        title: 'RME Rejeitado',
        description: 'O relatório foi rejeitado.',
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao rejeitar RME:', error);
      toast({
        title: 'Erro ao rejeitar',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { approveRME, rejectRME, loading };
};
