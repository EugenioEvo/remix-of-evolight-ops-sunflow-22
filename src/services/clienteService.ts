import { supabase } from '@/integrations/supabase/client';
import { fetchData, mutateData, handleSupabaseError } from './api';
import type { Cliente, ClienteInsert } from '@/types';

// ===== Tipos compostos =====

export type ClienteComProfile = Cliente & {
  profiles: { nome: string; email: string; telefone: string | null } | null;
};

export type ClienteComEquipamentos = Cliente & {
  profiles: { nome: string; email: string; telefone: string | null } | null;
  equipamentos: Array<{
    id: string;
    nome: string;
    tipo: string;
    status: string;
    numero_serie: string | null;
    fabricante: string | null;
    modelo: string | null;
  }>;
};

const CLIENTE_SELECT = `
  id, empresa, endereco, cidade, estado, cep, cnpj_cpf, latitude, longitude,
  prioridade, ufv_solarz, created_at, updated_at, profile_id, geocoded_at,
  profiles(nome, email, telefone)
`;

// ===== Service =====

export const clienteService = {
  /** Lista todos os clientes com perfil */
  async getClientes(): Promise<ClienteComProfile[]> {
    return fetchData(
      supabase
        .from('clientes')
        .select(CLIENTE_SELECT)
        .order('empresa', { ascending: true })
    ) as Promise<ClienteComProfile[]>;
  },

  /** Busca cliente por ID */
  async getClienteById(id: string): Promise<ClienteComProfile> {
    return fetchData(
      supabase
        .from('clientes')
        .select(CLIENTE_SELECT)
        .eq('id', id)
        .single()
    ) as Promise<ClienteComProfile>;
  },

  /** Busca cliente com equipamentos (para monitoramento de plantas) */
  async getClienteWithPlants(id: string): Promise<ClienteComEquipamentos> {
    return fetchData(
      supabase
        .from('clientes')
        .select(`
          ${CLIENTE_SELECT},
          equipamentos(id, nome, tipo, status, numero_serie, fabricante, modelo)
        `)
        .eq('id', id)
        .single()
    ) as Promise<ClienteComEquipamentos>;
  },

  /** Cria um novo cliente */
  async create(data: ClienteInsert): Promise<Cliente> {
    return mutateData(
      supabase.from('clientes').insert(data).select().single(),
      'Cliente criado com sucesso'
    );
  },

  /** Atualiza um cliente */
  async update(id: string, data: Partial<ClienteInsert>): Promise<Cliente> {
    return mutateData(
      supabase.from('clientes').update(data).eq('id', id).select().single(),
      'Cliente atualizado'
    );
  },

  /** Busca clientes por nome */
  async searchByName(search: string): Promise<ClienteComProfile[]> {
    return fetchData(
      supabase
        .from('clientes')
        .select(CLIENTE_SELECT)
        .ilike('empresa', `%${search}%`)
        .limit(10)
    ) as Promise<ClienteComProfile[]>;
  },

  // Aliases
  list: undefined as unknown as typeof clienteService.getClientes,
  getById: undefined as unknown as typeof clienteService.getClienteById,
};

clienteService.list = clienteService.getClientes;
clienteService.getById = clienteService.getClienteById;
