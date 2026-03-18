import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { logger } from '@/services/api';

export interface Notificacao {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  link: string | null;
  created_at: string;
}

export const useNotifications = () => {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [naoLidas, setNaoLidas] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setNotificacoes([]);
      setNaoLidas(0);
      setLoading(false);
      return;
    }

    loadNotificacoes();

    // Realtime subscription
    const channel = supabase
      .channel('notificacoes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadNotificacoes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadNotificacoes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotificacoes(data || []);
      setNaoLidas((data || []).filter(n => !n.lida).length);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  const marcarComoLida = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', id);

      if (error) throw error;

      setNotificacoes(prev =>
        prev.map(n => (n.id === id ? { ...n, lida: true } : n))
      );
      setNaoLidas(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const marcarTodasComoLidas = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('user_id', user.id)
        .eq('lida', false);

      if (error) throw error;

      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
      setNaoLidas(0);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const deletarNotificacao = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotificacoes(prev => prev.filter(n => n.id !== id));
      const notificacao = notificacoes.find(n => n.id === id);
      if (notificacao && !notificacao.lida) {
        setNaoLidas(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
    }
  };

  return {
    notificacoes,
    loading,
    naoLidas,
    marcarComoLida,
    marcarTodasComoLidas,
    deletarNotificacao,
  };
};
