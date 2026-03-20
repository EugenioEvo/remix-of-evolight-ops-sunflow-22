import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sun,
  Zap,
  AlertTriangle,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KPICard } from '@/components/sunflow/KPICard';
import { StatusBadge } from '@/components/sunflow/StatusBadge';
import { useSolarPlants, useSolarAlerts } from '@/hooks/queries/useSolar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCapacity(kwp: number | null | undefined): string {
  if (kwp == null) return '—';
  if (kwp >= 1000) return `${(Number(kwp) / 1000).toFixed(1)} MWp`;
  return `${Number(kwp).toFixed(0)} kWp`;
}

type SolarzStatus = 'OK' | 'ALERTA' | 'CRITICO' | 'DESCONHECIDO';

function normalizeSolarzStatus(raw: string | null | undefined): SolarzStatus {
  if (!raw) return 'DESCONHECIDO';
  const upper = raw.toUpperCase();
  if (upper === 'OK') return 'OK';
  if (upper === 'ALERTA') return 'ALERTA';
  if (upper === 'CRITICO') return 'CRITICO';
  return 'DESCONHECIDO';
}

const statusColors: Record<SolarzStatus, { bg: string; text: string; bar: string }> = {
  OK: { bg: 'bg-green-100', text: 'text-green-800', bar: 'bg-green-500' },
  ALERTA: { bg: 'bg-yellow-100', text: 'text-yellow-800', bar: 'bg-yellow-500' },
  CRITICO: { bg: 'bg-red-100', text: 'text-red-800', bar: 'bg-red-500' },
  DESCONHECIDO: { bg: 'bg-gray-100', text: 'text-gray-800', bar: 'bg-gray-400' },
};

export default function SunflowDashboard() {
  const { data: plants, isLoading: plantsLoading } = useSolarPlants();
  const { data: allAlerts, isLoading: alertsLoading } = useSolarAlerts({ status: 'aberto' });

  const plantList = plants ?? [];
  const alertList = allAlerts ?? [];

  // KPI calculations
  const totalCapacity = plantList.reduce((sum, p) => sum + Number(p.potencia_kwp ?? 0), 0);
  const criticalAlerts = alertList.filter((a: any) => a.severidade === 'critical').length;

  // Status distribution
  const statusCounts: Record<SolarzStatus, number> = { OK: 0, ALERTA: 0, CRITICO: 0, DESCONHECIDO: 0 };
  plantList.forEach((p) => {
    statusCounts[normalizeSolarzStatus(p.solarz_status)]++;
  });

  const totalPlants = plantList.length;
  const availability = totalPlants > 0 ? (statusCounts.OK / totalPlants) * 100 : 0;
  const availabilityColor = availability > 80 ? 'text-green-600' : availability > 60 ? 'text-yellow-600' : 'text-red-600';

  // Plants sorted: non-OK first, then OK
  const sortedPlants = [...plantList].sort((a, b) => {
    const aStatus = normalizeSolarzStatus(a.solarz_status);
    const bStatus = normalizeSolarzStatus(b.solarz_status);
    if (aStatus === 'OK' && bStatus !== 'OK') return 1;
    if (aStatus !== 'OK' && bStatus === 'OK') return -1;
    const order: Record<SolarzStatus, number> = { CRITICO: 0, ALERTA: 1, DESCONHECIDO: 2, OK: 3 };
    return order[aStatus] - order[bStatus];
  });

  const recentAlerts = alertList.slice(0, 5);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KPICard
          title="Plantas Ativas"
          value={plantsLoading ? '—' : plantList.length}
          subtitle="usinas cadastradas"
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
          title="Disponibilidade"
          value={plantsLoading ? '—' : `${availability.toFixed(1)}%`}
          subtitle="plantas OK"
          icon={Activity}
          loading={plantsLoading}
          valueClassName={availabilityColor}
        />
        <KPICard
          title="Alertas Abertos"
          value={alertsLoading ? '—' : alertList.length}
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

      {/* Status Bar */}
      {!plantsLoading && totalPlants > 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Distribuição de Status das Plantas</p>
            <div className="flex w-full h-4 rounded-full overflow-hidden">
              {(['OK', 'ALERTA', 'CRITICO', 'DESCONHECIDO'] as SolarzStatus[]).map((status) => {
                const pct = (statusCounts[status] / totalPlants) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={status}
                    className={`${statusColors[status].bar} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${status}: ${statusCounts[status]} (${pct.toFixed(0)}%)`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {(['OK', 'ALERTA', 'CRITICO', 'DESCONHECIDO'] as SolarzStatus[]).map((status) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={`inline-block w-3 h-3 rounded-full ${statusColors[status].bar}`} />
                  <span className="text-xs text-muted-foreground">
                    {status}: <span className="font-medium text-foreground">{statusCounts[status]}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts + Plants row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Últimos Alertas</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/sunflow/alerts">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 bg-muted rounded animate-pulse" />
                ))
              : recentAlerts.map((alert: any) => (
                  <div
                    key={alert.id}
                    className="flex items-start justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <StatusBadge context="alert" value={alert.severidade} className="mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{alert.titulo}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.solar_plants?.nome} · {alert.tipo}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2 shrink-0">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                ))}
            {!alertsLoading && recentAlerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum alerta ativo.
              </p>
            )}
          </CardContent>
        </Card>

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
                  <div key={i} className="h-14 bg-muted rounded animate-pulse" />
                ))
              : sortedPlants.slice(0, 8).map((plant) => {
                  const status = normalizeSolarzStatus(plant.solarz_status);
                  const colors = statusColors[status];
                  return (
                    <Link
                      key={plant.id}
                      to={`/sunflow/plants/${plant.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold shrink-0 ${colors.bg} ${colors.text} border-transparent`}
                        >
                          {status}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{plant.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {(plant as any).clientes?.empresa ?? '—'}
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
                  );
                })}
            {!plantsLoading && plantList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma usina cadastrada.{' '}
                <Link to="/sunflow/plants/new" className="text-primary underline">Cadastrar agora</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
