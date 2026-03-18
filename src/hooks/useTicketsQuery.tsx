import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ITEMS_PER_PAGE = 20;

interface TicketsQueryParams {
  page?: number;
  searchTerm?: string;
  status?: string;
  cliente?: string;
  prioridade?: string;
}

export const useTicketsQuery = (params: TicketsQueryParams = {}) => {
  const { page = 1, searchTerm = '', status, cliente, prioridade } = params;

  return useQuery({
    queryKey: ['tickets', { page, searchTerm, status, cliente, prioridade }],
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          ordens_servico(numero_os, id, pdf_url),
          clientes(
            empresa,
            endereco,
            cidade,
            estado,
            cep,
            ufv_solarz,
            prioridade,
            profiles(nome, email)
          ),
          prestadores:tecnico_responsavel_id(
            id,
            nome,
            email
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Filtros
      if (status && status !== 'todos') {
        query = query.eq('status', status as any);
      }

      if (cliente && cliente !== 'todos') {
        query = query.eq('cliente_id', cliente);
      }

      if (prioridade && prioridade !== 'todas') {
        query = query.eq('prioridade', prioridade as any);
      }

      if (searchTerm) {
        query = query.or(`
          titulo.ilike.%${searchTerm}%,
          numero_ticket.ilike.%${searchTerm}%,
          descricao.ilike.%${searchTerm}%
        `);
      }

      // Paginação
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        tickets: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
        currentPage: page,
      };
    },
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos (antigo cacheTime)
  });
};

export const useClientesQuery = () => {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          id,
          empresa,
          endereco,
          cidade,
          estado,
          cep,
          cnpj_cpf,
          ufv_solarz,
          prioridade,
          profiles(nome, email, telefone)
        `)
        .order('empresa', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos - dados raramente mudam
    gcTime: 30 * 60 * 1000, // 30 minutos
  });
};

export const usePrestadoresQuery = () => {
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
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });
};

export const useCreateTicketMutation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ticketData: any) => {
      const { data, error } = await supabase
        .from('tickets')
        .insert([ticketData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({
        title: 'Sucesso',
        description: 'Ticket criado com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar ticket',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateTicketMutation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('tickets')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({
        title: 'Sucesso',
        description: 'Ticket atualizado com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar ticket',
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteTicketMutation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast({
        title: 'Sucesso',
        description: 'Ticket excluído com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir ticket',
        variant: 'destructive',
      });
    },
  });
};
