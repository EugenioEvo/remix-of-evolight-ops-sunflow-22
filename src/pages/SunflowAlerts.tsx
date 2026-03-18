import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Search, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/sunflow/StatusBadge';
import { KPICard } from '@/components/sunflow/KPICard';
import { useSolarAlerts, useResolveSolarAlert } from '@/hooks/queries/useSolar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type StatusFilter = 'all' | 'aberto' | 'reconhecido' | 'resolvido';
type SeverityFilter = 'all' | 'info' | 'warning' | 'critical';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function SunflowAlerts() {
  const [searchParams] = useSearchParams();
  const plantIdParam = searchParams.get('plant_id') ?? undefined;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: allAlerts, isLoading: loading } = useSolarAlerts({
    plantId: plantIdParam,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const resolveAlert = useResolveSolarAlert();

  const alerts = (allAlerts ?? []).filter((a: any) => {
    if (severityFilter !== 'all' && a.severidade !== severityFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      a.titulo?.toLowerCase().includes(s) ||
      a.descricao?.toLowerCase().includes(s) ||
      a.solar_plants?.nome?.toLowerCase().includes(s)
    );
  });

  const activeCount = alerts.filter((a: any) => a.status === 'aberto').length;
  const criticalCount = alerts.filter((a: any) => a.severidade === 'critical').length;
  const resolvedCount = alerts.filter((a: any) => a.status === 'resolvido').length;

  const handleResolve = async (id: string) => {
    if (!user) {
      toast({ title: 'Usuário não autenticado', variant: 'destructive' });
      return;
    }
    try {
      await resolveAlert.mutateAsync({ alertId: id, resolvidoPor: user.id });
      toast({ title: 'Alerta resolvido' });
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
          <p className="text-sm text-muted-foreground">{alerts.length} alertas no total</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard title="Abertos" value={activeCount} loading={loading} />
        <KPICard title="Críticos" value={criticalCount} loading={loading} />
        <KPICard title="Resolvidos" value={resolvedCount} loading={loading} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, descrição ou usina..."
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
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="reconhecido">Reconhecido</SelectItem>
            <SelectItem value="resolvido">Resolvido</SelectItem>
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
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))
          ) : alerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum alerta encontrado.</p>
          ) : (
            alerts.map((alert: any) => (
              <AlertRow key={alert.id} alert={alert} onResolve={handleResolve} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertRow({
  alert,
  onResolve,
}: {
  alert: any;
  onResolve: (id: string) => void;
}) {
  const severityBg: Record<string, string> = {
    info: 'border-l-blue-400',
    warning: 'border-l-yellow-400',
    critical: 'border-l-red-600',
  };

  const alertStatusMap = (s: string) =>
    s === 'aberto' ? 'active' : s === 'reconhecido' ? 'acknowledged' : 'resolved';

  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg border border-l-4 ${severityBg[alert.severidade] ?? 'border-l-gray-400'} hover:bg-muted/30 transition-colors`}>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <StatusBadge context="alert" value={alert.severidade} />
          <StatusBadge context="alertStatus" value={alertStatusMap(alert.status)} />
          {alert.solar_plants && (
            <span className="text-xs text-muted-foreground">{alert.solar_plants.nome}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(alert.created_at).toLocaleDateString('pt-BR')}
          </span>
        </div>
        <p className="font-medium text-sm">{alert.titulo}</p>
        {alert.descricao && (
          <p className="text-sm text-muted-foreground mt-0.5">{alert.descricao}</p>
        )}
      </div>
      {alert.status === 'aberto' && (
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
