import { supabase } from '@/integrations/supabase/client';
import { fetchData, mutateData } from './api';
import type { 
  Ticket, TicketInsert, TicketUpdate, TicketComCliente, 
  TicketStatus, PrioridadeTipo 
} from '@/types';

export interface TicketFilters {
  status?: TicketStatus;
  prioridade?: PrioridadeTipo;
  clienteId?: string;
  responsavelId?: string;
  search?: string;
}

export const ticketService = {
  async list(filters?: TicketFilters): Promise<TicketComCliente[]> {
    let query = supabase
      .from('tickets')
      .select('*, clientes(*)')
      .order('created_at', { ascending: false });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.prioridade) query = query.eq('prioridade', filters.prioridade);
    if (filters?.clienteId) query = query.eq('cliente_id', filters.clienteId);
    if (filters?.search) query = query.ilike('titulo', `%${filters.search}%`);

    return fetchData(query);
  },

  async getById(id: string): Promise<TicketComCliente> {
    return fetchData(
      supabase.from('tickets').select('*, clientes(*)').eq('id', id).single()
    );
  },

  async create(data: TicketInsert): Promise<Ticket> {
    return mutateData(
      supabase.from('tickets').insert(data).select().single(),
      'Ticket criado com sucesso'
    );
  },

  async update(id: string, data: TicketUpdate): Promise<Ticket> {
    return mutateData(
      supabase.from('tickets').update(data).eq('id', id).select().single(),
      'Ticket atualizado'
    );
  },

  async updateStatus(id: string, status: TicketStatus): Promise<Ticket> {
    return mutateData(
      supabase.from('tickets').update({ status }).eq('id', id).select().single()
    );
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) throw error;
  },
};
