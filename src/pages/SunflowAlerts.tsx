import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Search, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/sunflow/StatusBadge';
import { KPICard } from '@/components/sunflow/KPICard';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { getAlerts, acknowledgeAlert, resolveAlert, formatDate } from '@/integrations/sunflow/client';
import { useToast } from '@/hooks/use-toast';
import type { AlertStatus, AlertSeverity, Alert } from '@/integrations/sunflow/types';
import { useAuth } from '@/hooks/useAuth';

type StatusFilter = AlertStatus | 'all';
type SeverityFilter = AlertSeverity | 'all';

export default function SunflowAlerts() {
  const [searchParams] = useSearchParams();
  const plantIdParam = searchParams.get('plant_id') ?? undefined;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: result, loading, refetch } = useSupabaseQuery(
    () =>
      getAlerts({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        plant_id: plantIdParam,
        pageSize: 100,
      }),
    [statusFilter, severityFilter, plantIdParam]
  );

  useRealtimeSubscription<Alert>({
    table: 'alerts',
    onInsert: () => refetch(),
    onUpdate: () => refetch(),
  });

  const alerts = (result?.data ?? []).filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.message.toLowerCase().includes(search.toLowerCase()) ||
      a.plant?.name.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const acknowledgedCount = alerts.filter((a) => a.status === 'acknowledged').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;

  const handleAcknowledge = async (id: string) => {
    if (!user) {
      toast({ title: 'Usuário não autenticado', variant: 'destructive' });
      return;
    }
    try {
      await acknowledgeAlert(id, user.id);
      toast({ title: 'Alerta reconhecido' });
      refetch();
    } catch {
      toast({ title: 'Erro ao reconhecer alerta', variant: 'destructive' });
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await resolveAlert(id);
      toast({ title: 'Alerta resolvido' });
      refetch();
    } catch {
      toast({ title: 'Erro ao resolver alerta', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-orange-500" />
        <div>
          <h1 className="text-2xl font-bold">Central de Alertas</h1>
          <p className="text-sm text-muted-foreground">{result?.count ?? 0} alertas no total</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Ativos" value={activeCount} loading={loading} />
        <KPICard title="Reconhecidos" value={acknowledgedCount} loading={loading} />
        <KPICard title="Críticos" value={criticalCount} loading={loading} />
        <KPICard title="Resolvidos" value={resolvedCount} loading={loading} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, mensagem ou usina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="acknowledged">Reconhecido</SelectItem>
            <SelectItem value="resolved">Resolvido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Aviso</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alert list */}
      <Card>
        <CardHeader><CardTitle className="text-base">Alertas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))
          ) : alerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum alerta encontrado.</p>
          ) : (
            alerts.map((alert) => <AlertRow key={alert.id} alert={alert} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertRow({
  alert,
  onAcknowledge,
  onResolve,
}: {
  alert: Alert & { plant?: { id: string; name: string; code: string } };
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const severityBg: Record<AlertSeverity, string> = {
    info: 'border-l-blue-400',
    warning: 'border-l-yellow-400',
    error: 'border-l-orange-500',
    critical: 'border-l-red-600',
  };

  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg border border-l-4 ${severityBg[alert.severity]} hover:bg-muted/30 transition-colors`}>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <StatusBadge context="alert" value={alert.severity} />
          <StatusBadge context="alertStatus" value={alert.status} />
          {alert.plant && (
            <span className="text-xs text-muted-foreground">{alert.plant.name}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{formatDate(alert.created_at)}</span>
        </div>
        <p className="font-medium text-sm">{alert.title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{alert.message}</p>
        {alert.metric_name && (
          <p className="text-xs text-muted-foreground mt-1">
            {alert.metric_name}: <strong>{alert.metric_value}</strong>
            {alert.threshold_value !== null && ` (threshold: ${alert.threshold_value})`}
          </p>
        )}
      </div>
      {alert.status === 'active' && (
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAcknowledge(alert.id)}
            title="Reconhecer"
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onResolve(alert.id)}
            title="Resolver"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}
      {alert.status === 'acknowledged' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onResolve(alert.id)}
          title="Resolver"
        >
          <XCircle className="h-4 w-4 mr-1" /> Resolver
        </Button>
      )}
    </div>
  );
}
