import { supabase } from '@/integrations/supabase/client';
import { fetchData, mutateData } from './api';
import type { Cliente, ClienteInsert } from '@/types';

export const clienteService = {
  async list(): Promise<Cliente[]> {
    return fetchData(
      supabase.from('clientes').select('*').order('empresa', { ascending: true })
    );
  },

  async getById(id: string): Promise<Cliente> {
    return fetchData(
      supabase.from('clientes').select('*').eq('id', id).single()
    );
  },

  async create(data: ClienteInsert): Promise<Cliente> {
    return mutateData(
      supabase.from('clientes').insert(data).select().single(),
      'Cliente criado com sucesso'
    );
  },

  async update(id: string, data: Partial<ClienteInsert>): Promise<Cliente> {
    return mutateData(
      supabase.from('clientes').update(data).eq('id', id).select().single(),
      'Cliente atualizado'
    );
  },

  async searchByName(search: string): Promise<Cliente[]> {
    return fetchData(
      supabase
        .from('clientes')
        .select('*')
        .ilike('empresa', `%${search}%`)
        .limit(10)
    );
  },
};
