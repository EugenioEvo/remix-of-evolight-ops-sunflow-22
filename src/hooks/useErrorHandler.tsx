import { useToast } from '@/hooks/use-toast';
import logger from '@/lib/logger';
import { useCallback } from 'react';

interface ErrorHandlerOptions {
  showToast?: boolean;
  logError?: boolean;
  fallbackMessage?: string;
}

interface AppError {
  message: string;
  code?: string;
  details?: unknown;
}

const DEFAULT_ERROR_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente.';

export const useErrorHandler = () => {
  const { toast } = useToast();

  const handleError = useCallback((
    error: unknown,
    options: ErrorHandlerOptions = {}
  ): AppError => {
    const {
      showToast = true,
      logError = process.env.NODE_ENV === 'development',
      fallbackMessage = DEFAULT_ERROR_MESSAGE
    } = options;

    let appError: AppError;

    // Parse error to consistent format
    if (error instanceof Error) {
      appError = {
        message: error.message || fallbackMessage,
        details: error
      };
    } else if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      appError = {
        message: (err.message as string) || (err.error as string) || fallbackMessage,
        code: err.code as string,
        details: error
      };
    } else if (typeof error === 'string') {
      appError = { message: error };
    } else {
      appError = { message: fallbackMessage };
    }

    // Log in development only
    if (logError) {
      logger.error('[Error]', appError);
    }

    // Show toast notification
    if (showToast) {
      toast({
        title: 'Erro',
        description: appError.message,
        variant: 'destructive'
      });
    }

    return appError;
  }, [toast]);

  const handleAsyncError = useCallback(async <T,>(
    asyncFn: () => Promise<T>,
    options: ErrorHandlerOptions = {}
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      handleError(error, options);
      return null;
    }
  }, [handleError]);

  return { handleError, handleAsyncError };
};
