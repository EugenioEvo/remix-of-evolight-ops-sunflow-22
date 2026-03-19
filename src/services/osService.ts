import { supabase } from '@/integrations/supabase/client';
import { fetchData, mutateData, handleSupabaseError, type PaginatedResult, type PaginationOptions } from './api';
import type {
  OrdemServico, OrdemServicoInsert, OSComTicket, OSComTecnico, OSCompleta
} from '@/types';

// ===== Tipos do serviço =====

export interface OSFilters extends PaginationOptions {
  status?: string;
  tecnicoId?: string;
  clienteId?: string;
  dataInicio?: string;
  dataFim?: string;
}

const OS_SELECT_FULL = `
  *,
  tickets(*, clientes(*)),
  tecnicos(*, profiles(*))
`;

const OS_SELECT_COMPLETE = `
  *,
  tickets(*, clientes(*)),
  tecnicos(*, profiles(*)),
  rme_relatorios(*)
`;

// ===== Service =====

export const osService = {
  /** Lista ordens de serviço com filtros e paginação */
  async getOrdensServico(filters: OSFilters = {}): Promise<PaginatedResult<OSComTecnico>> {
    const { page = 1, pageSize = 20, tecnicoId, dataInicio, dataFim } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('ordens_servico')
      .select(OS_SELECT_FULL, { count: 'exact' })
      .order('data_programada', { ascending: true })
      .range(from, to);

    if (tecnicoId) query = query.eq('tecnico_id', tecnicoId);
    if (dataInicio) query = query.gte('data_programada', dataInicio);
    if (dataFim) query = query.lte('data_programada', dataFim);

    const { data, error, count } = await query;
    if (error) handleSupabaseError(error);

    const totalCount = count ?? 0;

    return {
      data: (data as OSComTecnico[]) ?? [],
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
      pageSize,
    };
  },

  /** Busca OS por ID com dados completos (ticket, técnico, RME) */
  async getOSById(id: string): Promise<OSCompleta> {
    return fetchData(
      supabase
        .from('ordens_servico')
        .select(OS_SELECT_COMPLETE)
        .eq('id', id)
        .single()
    ) as Promise<OSCompleta>;
  },

  /** Atualiza uma OS existente */
  async updateOS(id: string, data: Partial<OrdemServicoInsert>): Promise<OrdemServico> {
    return mutateData(
      supabase.from('ordens_servico').update(data).eq('id', id).select().single(),
      'Ordem de serviço atualizada'
    );
  },

  /** Lista OS atribuídas a um técnico específico */
  async getOSByTecnico(tecnicoId: string): Promise<OSComTicket[]> {
    return fetchData(
      supabase
        .from('ordens_servico')
        .select('*, tickets(*, clientes(*))')
        .eq('tecnico_id', tecnicoId)
        .order('data_programada', { ascending: true })
    ) as Promise<OSComTicket[]>;
  },

  /** Cria uma nova OS */
  async create(data: OrdemServicoInsert): Promise<OrdemServico> {
    return mutateData(
      supabase.from('ordens_servico').insert(data).select().single(),
      'Ordem de serviço criada'
    );
  },

  /** Atribui técnico a uma OS */
  async assignTecnico(osId: string, tecnicoId: string): Promise<OrdemServico> {
    return mutateData(
      supabase
        .from('ordens_servico')
        .update({ tecnico_id: tecnicoId })
        .eq('id', osId)
        .select()
        .single(),
      'Técnico atribuído'
    );
  },

  // Aliases
  list: undefined as unknown as typeof osService.getOrdensServico,
  getById: undefined as unknown as typeof osService.getOSById,
  getByTecnico: undefined as unknown as typeof osService.getOSByTecnico,
};

osService.list = osService.getOrdensServico;
osService.getById = osService.getOSById;
osService.getByTecnico = osService.getOSByTecnico;
