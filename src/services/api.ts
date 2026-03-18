import { PostgrestError } from '@supabase/supabase-js';
import { toast } from 'sonner';

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
  throw new ApiError(message, error.code, error.details);
}

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

// Logger que só funciona em desenvolvimento
export const logger = {
  info: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.log('[INFO]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.warn('[WARN]', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args);
  },
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) console.debug('[DEBUG]', ...args);
  },
};
