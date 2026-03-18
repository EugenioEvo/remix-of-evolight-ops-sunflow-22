import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, MapPin, Zap, Calendar, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/sunflow/StatusBadge';
import { KPICard } from '@/components/sunflow/KPICard';
import { useSolarPlant, useSolarMetrics, useSolarAlerts } from '@/hooks/queries/useSolar';

function formatCapacity(kwp: number | null | undefined): string {
  if (kwp == null) return '—';
  if (Number(kwp) >= 1000) return `${(Number(kwp) / 1000).toFixed(1)} MWp`;
  return `${Number(kwp).toFixed(0)} kWp`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function PlantDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: plant, isLoading: plantLoading } = useSolarPlant(id!);
  const { data: metrics } = useSolarMetrics(id!, { days: 7 });
  const { data: alerts, isLoading: alertsLoading } = useSolarAlerts({ plantId: id });

  if (plantLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted rounded w-64 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
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

  const alertList = alerts ?? [];

  // Calculate avg generation from metrics
  const avgGeneration = metrics && metrics.length > 0
    ? (metrics.reduce((s: number, m: any) => s + Number(m.geracao_kwh ?? 0), 0) / metrics.length).toFixed(1)
    : '—';

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/sunflow/plants" className="flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Usinas
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{plant.nome}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{plant.nome}</h1>
            <StatusBadge context="plant" value={plant.ativo ? 'active' : 'inactive'} />
          </div>
          {plant.serial_inversor && (
            <p className="text-sm text-muted-foreground font-mono mt-1">{plant.serial_inversor}</p>
          )}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/sunflow/alerts?plant_id=${plant.id}`}>
            <AlertTriangle className="mr-1.5 h-4 w-4" /> Alertas
          </Link>
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Capacidade"
          value={formatCapacity(plant.potencia_kwp)}
          icon={Zap}
        />
        <KPICard
          title="Geração Média (7d)"
          value={avgGeneration !== '—' ? `${avgGeneration} kWh` : '—'}
          subtitle="últimos 7 dias"
        />
        <KPICard
          title="Alertas Abertos"
          value={alertList.filter((a: any) => a.status === 'aberto').length}
          subtitle="requerem atenção"
        />
        <KPICard
          title="Inversor"
          value={plant.marca_inversor ?? '—'}
          subtitle={plant.modelo_inversor ?? ''}
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
                <p>{plant.endereco ?? '—'}</p>
                <p className="text-muted-foreground">
                  {plant.cidade}{plant.estado ? `, ${plant.estado}` : ''}
                </p>
              </div>
            </div>
            {plant.data_instalacao && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Instalada em {formatDate(plant.data_instalacao)}</span>
              </div>
            )}
            {plant.solarz_plant_id && (
              <p className="text-xs text-muted-foreground">
                SolarZ ID: <span className="font-mono">{plant.solarz_plant_id}</span>
              </p>
            )}
            {plant.solarz_status && (
              <p className="text-xs text-muted-foreground">
                Status SolarZ: {plant.solarz_status}
              </p>
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
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))
              : alertList.slice(0, 5).map((alert: any) => (
                  <div key={alert.id} className="flex items-start gap-2 py-1.5 border-b last:border-0">
                    <StatusBadge context="alert" value={alert.severidade} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{alert.titulo}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(alert.created_at)}</p>
                    </div>
                    <StatusBadge context="alertStatus" value={
                      alert.status === 'aberto' ? 'active' :
                      alert.status === 'reconhecido' ? 'acknowledged' : 'resolved'
                    } className="ml-auto shrink-0" />
                  </div>
                ))}
            {!alertsLoading && alertList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">Nenhum alerta.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
