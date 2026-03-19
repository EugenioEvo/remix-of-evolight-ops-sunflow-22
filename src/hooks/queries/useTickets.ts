import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketService, type TicketFilters } from '@/services/ticketService';
import { supabase } from '@/integrations/supabase/client';
import type { TicketInsert, TicketUpdate, TicketStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';

export type { TicketFilters } from '@/services/ticketService';

export const ticketKeys = {
  all: ['tickets'] as const,
  lists: () => [...ticketKeys.all, 'list'] as const,
  list: (filters: TicketFilters) => [...ticketKeys.lists(), filters] as const,
  details: () => [...ticketKeys.all, 'detail'] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
};

export function useTickets(filters?: TicketFilters) {
  return useQuery({
    queryKey: ticketKeys.list(filters ?? {}),
    queryFn: async () => {
      const result = await ticketService.list(filters);
      return {
        tickets: result.data,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
      };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => ticketService.getById(id),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: TicketInsert | Record<string, any>) => ticketService.create(data as TicketInsert),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      toast({ title: 'Sucesso', description: 'Ticket criado com sucesso!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message || 'Erro ao criar ticket', variant: 'destructive' });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TicketUpdate | Record<string, any> }) =>
      ticketService.update(id, data as TicketUpdate),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      toast({ title: 'Sucesso', description: 'Ticket atualizado com sucesso!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message || 'Erro ao atualizar ticket', variant: 'destructive' });
    },
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      ticketService.updateStatus(id, status),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => ticketService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      toast({ title: 'Sucesso', description: 'Ticket excluído com sucesso!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message || 'Erro ao excluir ticket', variant: 'destructive' });
    },
  });
}

// ── Prestadores ──────────────────────────────────────────

export function usePrestadores() {
  return useQuery({
    queryKey: ['prestadores', 'tecnicos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prestadores')
        .select('*')
        .eq('categoria', 'tecnico')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
