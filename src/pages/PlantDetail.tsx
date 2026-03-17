import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, MapPin, Zap, Calendar, User, ClipboardList, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/sunflow/StatusBadge';
import { KPICard } from '@/components/sunflow/KPICard';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import {
  getPlantById,
  getWorkOrders,
  getAlerts,
  formatCapacity,
  formatPerformanceRatio,
  formatAvailability,
  formatDate,
} from '@/integrations/sunflow/client';

export default function PlantDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: plant, loading: plantLoading } = useSupabaseQuery(
    () => getPlantById(id!),
    [id]
  );

  const { data: woResult, loading: woLoading } = useSupabaseQuery(
    () => getWorkOrders({ plant_id: id, pageSize: 10 }),
    [id]
  );

  const { data: alertsResult, loading: alertsLoading } = useSupabaseQuery(
    () => getAlerts({ plant_id: id, pageSize: 10 }),
    [id]
  );

  if (plantLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-100 rounded w-64 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!plant) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Usina não encontrada.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/sunflow/plants">Voltar</Link>
        </Button>
      </div>
    );
  }

  const workOrders = woResult?.data ?? [];
  const alerts = alertsResult?.data ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/sunflow/plants" className="flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Usinas
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{plant.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{plant.name}</h1>
            <StatusBadge context="plant" value={plant.status} />
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-1">{plant.code}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/sunflow/work-orders?plant_id=${plant.id}`}>
              <ClipboardList className="mr-1.5 h-4 w-4" /> OSs
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/sunflow/alerts?plant_id=${plant.id}`}>
              <AlertTriangle className="mr-1.5 h-4 w-4" /> Alertas
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Capacidade"
          value={formatCapacity(plant.capacity_kwp)}
          icon={Zap}
        />
        <KPICard
          title="Performance Ratio"
          value={formatPerformanceRatio(plant.avg_pr_7d)}
          subtitle="últimos 7 dias"
        />
        <KPICard
          title="Disponibilidade"
          value={formatAvailability(plant.avg_availability_7d)}
          subtitle="últimos 7 dias"
        />
        <KPICard
          title="Health Score"
          value={plant.health_score !== null ? `${plant.health_score.toFixed(0)}%` : '—'}
          trend={
            plant.health_score !== null
              ? {
                  direction: plant.health_score >= 80 ? 'up' : 'down',
                  label: plant.health_score >= 80 ? 'Bom' : 'Atenção necessária',
                }
              : undefined
          }
        />
      </div>

      {/* Info + alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plant info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Informações da Usina</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p>{plant.address ?? '—'}</p>
                <p className="text-muted-foreground">{plant.city}, {plant.state} · {plant.country}</p>
              </div>
            </div>
            {plant.commissioning_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Comissionado em {formatDate(plant.commissioning_date)}</span>
              </div>
            )}
            {plant.owner_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <span>{plant.owner_name}</span>
                  {plant.owner_contact && (
                    <p className="text-muted-foreground">{plant.owner_contact}</p>
                  )}
                </div>
              </div>
            )}
            {plant.notes && (
              <p className="text-muted-foreground bg-muted/50 rounded p-2">{plant.notes}</p>
            )}
          </CardContent>
        </Card>

        {/* Recent alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Alertas Recentes</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/sunflow/alerts?plant_id=${plant.id}`}>Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertsLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                ))
              : alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="flex items-start gap-2 py-1.5 border-b last:border-0">
                    <StatusBadge context="alert" value={alert.severity} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(alert.created_at)}</p>
                    </div>
                    <StatusBadge context="alertStatus" value={alert.status} className="ml-auto shrink-0" />
                  </div>
                ))}
            {!alertsLoading && alerts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">Nenhum alerta.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Work orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Ordens de Serviço</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/sunflow/work-orders?plant_id=${plant.id}`}>Ver todas</Link>
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
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Prioridade</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map((wo) => (
                    <tr key={wo.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{wo.wo_number}</td>
                      <td className="py-2 pr-4 max-w-[200px] truncate">{wo.title}</td>
                      <td className="py-2 pr-4 capitalize text-muted-foreground">{wo.type}</td>
                      <td className="py-2 pr-4"><StatusBadge context="priority" value={wo.priority} /></td>
                      <td className="py-2"><StatusBadge context="workOrder" value={wo.status} /></td>
                    </tr>
                  ))}
                  {workOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        Nenhuma OS encontrada.
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
