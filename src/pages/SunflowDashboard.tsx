import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sun,
  Zap,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/sunflow/KPICard';
import { StatusBadge } from '@/components/sunflow/StatusBadge';
import { useSolarPlants, useSolarAlerts } from '@/hooks/queries/useSolar';
import type { Tables } from '@/integrations/supabase/types';

function formatCapacity(kwp: number | null | undefined): string {
  if (kwp == null) return '—';
  if (kwp >= 1000) return `${(Number(kwp) / 1000).toFixed(1)} MWp`;
  return `${Number(kwp).toFixed(0)} kWp`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function SunflowDashboard() {
  const { data: plants, isLoading: plantsLoading } = useSolarPlants({ ativo: true });
  const { data: allAlerts, isLoading: alertsLoading } = useSolarAlerts({ status: 'aberto' });

  const plantList = plants ?? [];
  const activeAlerts = (allAlerts ?? []).slice(0, 5);

  const totalCapacity = plantList.reduce((sum, p) => sum + Number(p.potencia_kwp ?? 0), 0);
  const criticalAlerts = (allAlerts ?? []).filter((a: any) => a.severidade === 'critical').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sun className="h-6 w-6 text-yellow-500" />
            Dashboard Executivo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral do portfólio de usinas solares
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/sunflow/plants">
            Ver Todas as Usinas <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <KPICard
          title="Plantas Ativas"
          value={plantsLoading ? '—' : plantList.length}
          subtitle="usinas em operação"
          icon={Sun}
          loading={plantsLoading}
        />
        <KPICard
          title="Capacidade Total"
          value={plantsLoading ? '—' : formatCapacity(totalCapacity)}
          subtitle="instalada"
          icon={Zap}
          loading={plantsLoading}
        />
        <KPICard
          title="Alertas Abertos"
          value={alertsLoading ? '—' : (allAlerts ?? []).length}
          subtitle="requerem atenção"
          icon={AlertTriangle}
          loading={alertsLoading}
        />
        <KPICard
          title="Alertas Críticos"
          value={alertsLoading ? '—' : criticalAlerts}
          subtitle="severidade crítica"
          icon={AlertTriangle}
          iconClassName="bg-red-50"
          loading={alertsLoading}
        />
      </div>

      {/* Plants + Alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plants overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Usinas</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/sunflow/plants">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {plantsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))
              : plantList.slice(0, 6).map((plant) => (
                  <Link
                    key={plant.id}
                    to={`/sunflow/plants/${plant.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusBadge context="plant" value={plant.ativo ? 'active' : 'inactive'} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{plant.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {plant.cidade}{plant.estado ? `, ${plant.estado}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatCapacity(plant.potencia_kwp)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
            {!plantsLoading && plantList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma usina cadastrada.{' '}
                <Link to="/sunflow/plants/new" className="text-primary underline">Cadastrar agora</Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Active alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Alertas Ativos</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/sunflow/alerts">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))
              : activeAlerts.map((alert: any) => (
                  <div
                    key={alert.id}
                    className="flex items-start justify-between p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <StatusBadge context="alert" value={alert.severidade} className="mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{alert.titulo}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.solar_plants?.nome} · {formatDate(alert.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            {!alertsLoading && activeAlerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum alerta ativo.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
