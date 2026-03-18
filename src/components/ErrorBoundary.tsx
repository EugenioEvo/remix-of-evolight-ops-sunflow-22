import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { logger } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Aqui você pode enviar o erro para um serviço de logging
    // como Sentry, LogRocket, etc.
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3 text-destructive mb-2">
                <AlertCircle className="h-8 w-8" />
                <CardTitle className="text-2xl">Algo deu errado</CardTitle>
              </div>
              <CardDescription>
                Ocorreu um erro inesperado na aplicação. Nossa equipe foi notificada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Informações do erro (apenas em dev) */}
              {import.meta.env.DEV && this.state.error && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="font-mono text-sm">
                    <p className="font-semibold text-destructive mb-2">
                      {this.state.error.name}: {this.state.error.message}
                    </p>
                    {this.state.errorInfo && (
                      <pre className="text-xs overflow-auto max-h-64 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-wrap gap-3">
                <Button onClick={this.handleReset} variant="default">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
                <Button onClick={this.handleReload} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recarregar Página
                </Button>
                <Button onClick={this.handleGoHome} variant="outline">
                  <Home className="h-4 w-4 mr-2" />
                  Ir para Início
                </Button>
              </div>

              {/* Informações de suporte */}
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Se o problema persistir, entre em contato com o suporte técnico.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
