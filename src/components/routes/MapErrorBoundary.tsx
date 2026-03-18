import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface MapErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

class MapErrorBoundary extends React.Component<
  { children: React.ReactNode }, 
  MapErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: undefined };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }
  
  componentDidCatch(error: any, info: any) {
    console.error('MapErrorBoundary caught error:', error, info);
  }
  
  handleReset = () => {
    this.setState({ hasError: false, errorMessage: undefined });
    window.location.reload();
  };
  
  render() {
    if (this.state.hasError) {
      return (
        <Card className="h-full">
          <CardContent className="p-6 flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <div>
                <p className="text-sm font-medium mb-2">Erro ao carregar o mapa</p>
                <p className="text-xs text-muted-foreground mb-4">
                  {this.state.errorMessage || 'Ocorreu um erro inesperado'}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={this.handleReset}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar mapa
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return <>{this.props.children}</>;
  }
}

export default MapErrorBoundary;
