import { supabase } from '@/integrations/supabase/client';
import { fetchData, mutateData } from './api';
import type { RMERelatorio, RMEComOS } from '@/types';

export const rmeService = {
  async list(): Promise<RMEComOS[]> {
    return fetchData(
      supabase
        .from('rme_relatorios')
        .select(`
          *,
          ordens_servico(*, tickets(*, clientes(*)))
        `)
        .order('created_at', { ascending: false })
    );
  },

  async getByOS(osId: string): Promise<RMERelatorio | null> {
    const { data } = await supabase
      .from('rme_relatorios')
      .select('*')
      .eq('ordem_servico_id', osId)
      .maybeSingle();
    return data;
  },

  async create(data: Partial<RMERelatorio>): Promise<RMERelatorio> {
    return mutateData(
      supabase.from('rme_relatorios').insert(data as never).select().single(),
      'RME criado com sucesso'
    );
  },

  async update(id: string, data: Partial<RMERelatorio>): Promise<RMERelatorio> {
    return mutateData(
      supabase.from('rme_relatorios').update(data as never).eq('id', id).select().single(),
      'RME atualizado'
    );
  },
};
