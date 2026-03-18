import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import logger from '@/lib/logger';
import { toast } from 'sonner';

// ===== Error Handling =====

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  '42501': 'Sem permissão para esta ação',
  '23505': 'Registro duplicado',
  '23503': 'Registro referenciado não existe',
  'PGRST116': 'Registro não encontrado',
};

export function handleSupabaseError(error: PostgrestError): never {
  const message = ERROR_MESSAGES[error.code] || error.message;
  logger.error('Supabase error', { code: error.code, message: error.message, details: error.details });
  throw new ApiError(message, error.code, error.details);
}

// ===== Query Helpers =====

export async function fetchData<T>(
  queryPromise: PromiseLike<{ data: T | null; error: PostgrestError | null }>
): Promise<T> {
  const { data, error } = await queryPromise;
  if (error) handleSupabaseError(error);
  if (data === null) throw new ApiError('Dados não encontrados', 'NOT_FOUND');
  return data;
}

export async function mutateData<T>(
  queryPromise: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  successMessage?: string
): Promise<T> {
  const { data, error } = await queryPromise;
  if (error) {
    const message = ERROR_MESSAGES[error.code] || error.message;
    toast.error(message);
    handleSupabaseError(error);
  }
  if (successMessage) toast.success(successMessage);
  if (data === null) throw new ApiError('Operação não retornou dados');
  return data;
}

// ===== Paginated Query =====

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

type SupabaseTable = 'tickets' | 'ordens_servico' | 'clientes' | 'prestadores' | 'rme_relatorios' | 'equipamentos' | 'insumos';

export async function paginatedQuery<T>(
  table: SupabaseTable,
  options: PaginationOptions & {
    select?: string;
    orderBy?: string;
    ascending?: boolean;
    filters?: (query: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>;
  } = {}
): Promise<PaginatedResult<T>> {
  const { page = 1, pageSize = 20, select = '*', orderBy = 'created_at', ascending = false, filters } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from(table)
    .select(select, { count: 'exact' })
    .order(orderBy, { ascending })
    .range(from, to);

  if (filters) {
    query = filters(query) as typeof query;
  }

  const { data, error, count } = await query;

  if (error) handleSupabaseError(error);

  const totalCount = count ?? 0;

  return {
    data: (data as T[]) ?? [],
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    currentPage: page,
    pageSize,
  };
}
