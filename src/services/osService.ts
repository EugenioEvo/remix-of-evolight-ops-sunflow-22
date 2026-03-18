import { supabase } from '@/integrations/supabase/client';
import { fetchData, mutateData } from './api';
import type { 
  OrdemServico, OrdemServicoInsert, OSComTicket, OSComTecnico, OSCompleta 
} from '@/types';

export interface OSFilters {
  status?: string;
  tecnicoId?: string;
  clienteId?: string;
  dataInicio?: string;
  dataFim?: string;
}

export const osService = {
  async list(filters?: OSFilters): Promise<OSComTecnico[]> {
    let query = supabase
      .from('ordens_servico')
      .select(`
        *,
        tickets(*, clientes(*)),
        tecnicos(*, profiles(*))
      `)
      .order('data_programada', { ascending: true });

    if (filters?.tecnicoId) query = query.eq('tecnico_id', filters.tecnicoId);
    if (filters?.dataInicio) query = query.gte('data_programada', filters.dataInicio);
    if (filters?.dataFim) query = query.lte('data_programada', filters.dataFim);

    return fetchData(query);
  },

  async getById(id: string): Promise<OSCompleta> {
    return fetchData(
      supabase
        .from('ordens_servico')
        .select(`
          *,
          tickets(*, clientes(*)),
          tecnicos(*, profiles(*)),
          rme_relatorios(*)
        `)
        .eq('id', id)
        .single()
    );
  },

  async create(data: OrdemServicoInsert): Promise<OrdemServico> {
    return mutateData(
      supabase.from('ordens_servico').insert(data).select().single(),
      'Ordem de serviço criada'
    );
  },

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

  async getByTecnico(tecnicoId: string): Promise<OSComTicket[]> {
    return fetchData(
      supabase
        .from('ordens_servico')
        .select('*, tickets(*, clientes(*))')
        .eq('tecnico_id', tecnicoId)
        .order('data_programada', { ascending: true })
    );
  },
};
