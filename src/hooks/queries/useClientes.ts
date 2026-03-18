import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clienteService } from '@/services/clienteService';
import type { ClienteInsert } from '@/types';

export const clienteKeys = {
  all: ['clientes'] as const,
  lists: () => [...clienteKeys.all, 'list'] as const,
  details: () => [...clienteKeys.all, 'detail'] as const,
  detail: (id: string) => [...clienteKeys.details(), id] as const,
};

export function useClientes() {
  return useQuery({
    queryKey: clienteKeys.lists(),
    queryFn: () => clienteService.list(),
  });
}

export function useCliente(id: string) {
  return useQuery({
    queryKey: clienteKeys.detail(id),
    queryFn: () => clienteService.getById(id),
    enabled: !!id,
  });
}

export function useCreateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClienteInsert) => clienteService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clienteKeys.lists() });
    },
  });
}

export function useUpdateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClienteInsert> }) =>
      clienteService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: clienteKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: clienteKeys.lists() });
    },
  });
}
