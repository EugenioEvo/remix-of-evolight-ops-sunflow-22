import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { osService, type OSFilters } from '@/services/osService';
import type { OrdemServicoInsert } from '@/types';

export const osKeys = {
  all: ['ordens_servico'] as const,
  lists: () => [...osKeys.all, 'list'] as const,
  list: (filters: OSFilters) => [...osKeys.lists(), filters] as const,
  details: () => [...osKeys.all, 'detail'] as const,
  detail: (id: string) => [...osKeys.details(), id] as const,
  byTecnico: (id: string) => [...osKeys.all, 'tecnico', id] as const,
};

export function useOrdensServico(filters?: OSFilters) {
  return useQuery({
    queryKey: osKeys.list(filters ?? {}),
    queryFn: () => osService.list(filters),
  });
}

export function useOrdemServico(id: string) {
  return useQuery({
    queryKey: osKeys.detail(id),
    queryFn: () => osService.getById(id),
    enabled: !!id,
  });
}

export function useOSByTecnico(tecnicoId: string) {
  return useQuery({
    queryKey: osKeys.byTecnico(tecnicoId),
    queryFn: () => osService.getByTecnico(tecnicoId),
    enabled: !!tecnicoId,
  });
}

export function useCreateOS() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OrdemServicoInsert) => osService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: osKeys.lists() });
    },
  });
}

export function useAssignTecnico() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ osId, tecnicoId }: { osId: string; tecnicoId: string }) =>
      osService.assignTecnico(osId, tecnicoId),
    onSuccess: (_, { osId }) => {
      queryClient.invalidateQueries({ queryKey: osKeys.detail(osId) });
      queryClient.invalidateQueries({ queryKey: osKeys.lists() });
    },
  });
}
