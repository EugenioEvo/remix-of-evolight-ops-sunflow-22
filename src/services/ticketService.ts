import { supabase } from '@/integrations/supabase/client';
import { fetchData, mutateData, paginatedQuery, type PaginatedResult, type PaginationOptions } from './api';
import type {
  Ticket, TicketInsert, TicketUpdate, TicketComCliente,
  TicketStatus, PrioridadeTipo
} from '@/types';

// ===== Tipos do serviço =====

export interface TicketFilters extends PaginationOptions {
  status?: TicketStatus | 'todos';
  prioridade?: PrioridadeTipo | 'todas';
  clienteId?: string;
  responsavelId?: string;
  search?: string;
}

const TICKET_SELECT_FULL = `
  *,
  ordens_servico(numero_os, id, pdf_url),
  clientes(
    id, empresa, endereco, cidade, estado, cep, cnpj_cpf,
    profiles(nome, email, telefone)
  ),
  prestadores:tecnico_responsavel_id(
    id, nome, email
  )
`;

// ===== Tipo com joins completos =====

export type TicketFull = Ticket & {
  ordens_servico: Array<{ numero_os: string; id: string; pdf_url: string | null }>;
  clientes: {
    id: string;
    empresa: string | null;
    endereco: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
    cnpj_cpf: string | null;
    profiles: { nome: string; email: string; telefone: string | null } | null;
  } | null;
  prestadores: { id: string; nome: string; email: string } | null;
};

// ===== Service =====

export const ticketService = {
  /** Lista tickets com paginação, busca e filtros */
  async getTickets(filters: TicketFilters = {}): Promise<PaginatedResult<TicketFull>> {
    const { page = 1, pageSize = 20, status, prioridade, clienteId, search } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('tickets')
      .select(TICKET_SELECT_FULL, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status && status !== 'todos') {
      query = query.eq('status', status as TicketStatus);
    }
    if (prioridade && prioridade !== 'todas') {
      query = query.eq('prioridade', prioridade as PrioridadeTipo);
    }
    if (clienteId && clienteId !== 'todos') {
      query = query.eq('cliente_id', clienteId);
    }
    if (search) {
      query = query.or(`titulo.ilike.%${search}%,numero_ticket.ilike.%${search}%,descricao.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      const { handleSupabaseError } = await import('./api');
      handleSupabaseError(error);
    }

    const totalCount = count ?? 0;

    return {
      data: (data as TicketFull[]) ?? [],
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      currentPage: page,
      pageSize,
    };
  },

  /** Busca ticket por ID com joins para cliente, prestador e OS */
  async getTicketById(id: string): Promise<TicketFull> {
    return fetchData(
      supabase
        .from('tickets')
        .select(TICKET_SELECT_FULL)
        .eq('id', id)
        .single()
    ) as Promise<TicketFull>;
  },

  /** Cria um novo ticket */
  async createTicket(data: TicketInsert): Promise<Ticket> {
    return mutateData(
      supabase.from('tickets').insert(data).select().single(),
      'Ticket criado com sucesso'
    );
  },

  /** Atualiza um ticket existente */
  async updateTicket(id: string, data: TicketUpdate): Promise<Ticket> {
    return mutateData(
      supabase.from('tickets').update(data).eq('id', id).select().single(),
      'Ticket atualizado'
    );
  },

  /** Atualiza apenas o status de um ticket */
  async updateStatus(id: string, status: TicketStatus): Promise<Ticket> {
    return mutateData(
      supabase.from('tickets').update({ status }).eq('id', id).select().single()
    );
  },

  /** Exclui um ticket */
  async deleteTicket(id: string): Promise<void> {
    // Remove related solar_alerts first to avoid FK constraint
    const { error: alertsError } = await supabase
      .from('solar_alerts')
      .delete()
      .eq('ticket_id', id);
    if (alertsError) {
      console.warn('Error clearing solar_alerts:', alertsError.message);
    }

    // Remove related status_historico
    const { error: histError } = await supabase
      .from('status_historico')
      .delete()
      .eq('ticket_id', id);
    if (histError) {
      console.warn('Error clearing status_historico:', histError.message);
    }

    // Remove related aprovacoes
    const { error: aprovError } = await supabase
      .from('aprovacoes')
      .delete()
      .eq('ticket_id', id);
    if (aprovError) {
      console.warn('Error clearing aprovacoes:', aprovError.message);
    }

    // Remove related ordens_servico (and their RME/tokens)
    const { data: osData } = await supabase
      .from('ordens_servico')
      .select('id')
      .eq('ticket_id', id);
    
    if (osData && osData.length > 0) {
      const osIds = osData.map(os => os.id);
      
      // Remove RME reports linked to these OS
      for (const osId of osIds) {
        await supabase.from('rme_relatorios').delete().eq('ordem_servico_id', osId);
        await supabase.from('presence_confirmation_tokens').delete().eq('ordem_servico_id', osId);
      }
      
      // Remove the OS themselves
      await supabase.from('ordens_servico').delete().eq('ticket_id', id);
    }

    // Remove RME reports linked directly to ticket
    await supabase.from('rme_relatorios').delete().eq('ticket_id', id);

    // Finally delete the ticket
    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) {
      const { handleSupabaseError } = await import('./api');
      handleSupabaseError(error);
    }
  },

  // Alias para compatibilidade
  list: undefined as unknown as typeof ticketService.getTickets,
  getById: undefined as unknown as typeof ticketService.getTicketById,
  create: undefined as unknown as typeof ticketService.createTicket,
  update: undefined as unknown as typeof ticketService.updateTicket,
  delete: undefined as unknown as typeof ticketService.deleteTicket,
};

// Aliases
ticketService.list = ticketService.getTickets;
ticketService.getById = ticketService.getTicketById;
ticketService.create = ticketService.createTicket;
ticketService.update = ticketService.updateTicket;
ticketService.delete = ticketService.deleteTicket;
