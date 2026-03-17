import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sun,
  Zap,
  Activity,
  AlertTriangle,
  ClipboardList,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KPICard } from '@/components/sunflow/KPICard';
import { StatusBadge } from '@/components/sunflow/StatusBadge';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import {
  getDashboardKpis,
  getPlantsWithStats,
  getAlerts,
  getWorkOrders,
  formatCapacity,
  formatPerformanceRatio,
  formatAvailability,
  formatDate,
} from '@/integrations/sunflow/client';
import type { Alert, WorkOrderWithRelations } from '@/integrations/sunflow/types';

export default function SunflowDashboard() {
  const { data: kpis, loading: kpisLoading, refetch: refetchKpis } = useSupabaseQuery(
    getDashboardKpis,
    [],
    { refetchInterval: 60_000 }
  );

  const { data: plantsResult, loading: plantsLoading } = useSupabaseQuery(
    getPlantsWithStats,
    []
  );

  const { data: alertsResult, loading: alertsLoading, refetch: refetchAlerts } = useSupabaseQuery(
    () => getAlerts({ status: 'active', pageSize: 5 }),
    []
  );

  const { data: woResult, loading: woLoading } = useSupabaseQuery(
    () => getWorkOrders({ pageSize: 5 }),
    []
  );

  // Real-time alert updates
  useRealtimeSubscription<Alert>({
    table: 'alerts',
    onInsert: () => { refetchAlerts(); refetchKpis(); },
    onUpdate: () => { refetchAlerts(); refetchKpis(); },
  });

  const plants = plantsResult ?? [];
  const activeAlerts = alertsResult?.data ?? [];
  const recentWOs = woResult?.data ?? [];

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="Plantas Ativas"
          value={kpisLoading ? '—' : (kpis?.active_plants ?? 0)}
          subtitle="usinas em operação"
          icon={Sun}
          loading={kpisLoading}
          className="xl:col-span-1"
        />
        <KPICard
          title="Capacidade Total"
          value={kpisLoading ? '—' : formatCapacity(kpis?.total_capacity_kwp ?? 0)}
          subtitle="instalada"
          icon={Zap}
          loading={kpisLoading}
          className="xl:col-span-1"
        />
        <KPICard
          title="Performance Ratio"
          value={kpisLoading ? '—' : formatPerformanceRatio(kpis?.avg_pr_7d ?? null)}
          subtitle="últimos 7 dias"
          icon={TrendingUp}
          trend={
            kpis?.avg_pr_7d != null
              ? {
                  direction: kpis.avg_pr_7d >= 0.8 ? 'up' : 'down',
                  label: kpis.avg_pr_7d >= 0.8 ? 'Acima da meta' : 'Abaixo da meta',
                }
              : undefined
          }
          loading={kpisLoading}
          className="xl:col-span-1"
        />
        <KPICard
          title="Disponibilidade"
          value={kpisLoading ? '—' : formatAvailability(kpis?.avg_availability_7d ?? null)}
          subtitle="últimos 7 dias"
          icon={Activity}
          trend={
            kpis?.avg_availability_7d != null
              ? {
                  direction: kpis.avg_availability_7d >= 0.98 ? 'up' : 'down',
                  label: kpis.avg_availability_7d >= 0.98 ? 'Meta atingida' : 'Abaixo da meta',
                }
              : undefined
          }
          loading={kpisLoading}
          className="xl:col-span-1"
        />
        <KPICard
          title="OSs Abertas"
          value={kpisLoading ? '—' : (kpis?.open_work_orders ?? 0)}
          subtitle="ordens de serviço"
          icon={ClipboardList}
          loading={kpisLoading}
          className="xl:col-span-1"
        />
        <KPICard
          title="Alertas Críticos"
          value={kpisLoading ? '—' : (kpis?.critical_alerts ?? 0)}
          subtitle="requerem atenção"
          icon={AlertTriangle}
          iconClassName="bg-red-50"
          loading={kpisLoading}
          className="xl:col-span-1"
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
                  <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                ))
              : plants.slice(0, 6).map((plant) => (
                  <Link
                    key={plant.id}
                    to={`/sunflow/plants/${plant.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusBadge context="plant" value={plant.status} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{plant.name}</p>
                        <p className="text-xs text-muted-foreground">{plant.city}, {plant.state}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatCapacity(plant.capacity_kwp)}</span>
                      {plant.critical_alerts > 0 && (
                        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                          {plant.critical_alerts}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
            {!plantsLoading && plants.length === 0 && (
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
                  <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                ))
              : activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start justify-between p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <StatusBadge context="alert" value={alert.severity} className="mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{alert.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.plant?.name} · {formatDate(alert.created_at)}
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

      {/* Priority work orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Ordens de Serviço Recentes</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/sunflow/work-orders">Ver todas</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {woLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Número</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Título</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Usina</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Prioridade</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentWOs.map((wo: WorkOrderWithRelations) => (
                    <tr key={wo.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{wo.wo_number}</td>
                      <td className="py-2 pr-4 max-w-[200px] truncate">{wo.title}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{wo.plant?.name ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge context="priority" value={wo.priority} />
                      </td>
                      <td className="py-2">
                        <StatusBadge context="workOrder" value={wo.status} />
                      </td>
                    </tr>
                  ))}
                  {recentWOs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        Nenhuma ordem de serviço encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
