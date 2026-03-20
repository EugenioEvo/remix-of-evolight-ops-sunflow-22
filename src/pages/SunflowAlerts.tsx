import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Search, XCircle, ShieldAlert, ShieldCheck, Ticket } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/sunflow/StatusBadge';
import { KPICard } from '@/components/sunflow/KPICard';
import { useSolarAlerts, useResolveSolarAlert } from '@/hooks/queries/useSolar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type StatusFilter = 'all' | 'aberto' | 'reconhecido' | 'resolvido';
type SeverityFilter = 'all' | 'info' | 'warning' | 'critical';

const tipoLabels: Record<string, string> = {
  inversor_offline: 'Inversor Offline',
  comunicacao: 'Comunicação',
  alerta_solarz: 'Alerta SolarZ',
  baixa_geracao: 'Baixa Geração',
  temperatura: 'Temperatura',
  erro_inversor: 'Erro Inversor',
};

export default function SunflowAlerts() {
  const [searchParams] = useSearchParams();
  const plantIdParam = searchParams.get('plant_id') ?? undefined;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch all alerts (no status filter on query so we can count across statuses)
  const { data: allAlerts, isLoading: loading } = useSolarAlerts({
    plantId: plantIdParam,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  // Also fetch unfiltered for counts
  const { data: unfilteredAlerts } = useSolarAlerts({ plantId: plantIdParam });

  const resolveAlert = useResolveSolarAlert();

  const allList = unfilteredAlerts ?? [];
  const openCount = allList.filter((a: any) => a.status === 'aberto').length;
  const ackCount = allList.filter((a: any) => a.status === 'reconhecido').length;
  const criticalCount = allList.filter((a: any) => a.severidade === 'critical' && a.status !== 'resolvido').length;

  const alerts = useMemo(() => {
    return (allAlerts ?? []).filter((a: any) => {
      if (severityFilter !== 'all' && a.severidade !== severityFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        a.titulo?.toLowerCase().includes(s) ||
        a.descricao?.toLowerCase().includes(s) ||
        a.solar_plants?.nome?.toLowerCase().includes(s) ||
        a.tipo?.toLowerCase().includes(s)
      );
    });
  }, [allAlerts, severityFilter, search]);

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
          <p className="text-sm text-muted-foreground">
            Monitoramento em tempo real · {alerts.length} alerta{alerts.length !== 1 ? 's' : ''} exibido{alerts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Abertos"
          value={loading ? '—' : openCount}
          subtitle="aguardando ação"
          icon={ShieldAlert}
          iconClassName="bg-red-50"
          loading={loading}
          valueClassName={openCount > 0 ? 'text-red-600' : undefined}
        />
        <KPICard
          title="Reconhecidos"
          value={loading ? '—' : ackCount}
          subtitle="em acompanhamento"
          icon={ShieldCheck}
          iconClassName="bg-blue-50"
          loading={loading}
          valueClassName={ackCount > 0 ? 'text-blue-600' : undefined}
        />
        <KPICard
          title="Críticos"
          value={loading ? '—' : criticalCount}
          subtitle="severidade máxima"
          icon={AlertTriangle}
          iconClassName="bg-red-50"
          loading={loading}
          valueClassName={criticalCount > 0 ? 'text-red-600' : undefined}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, usina ou tipo..."
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
        <CardHeader>
          <CardTitle className="text-base">Alertas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
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
  const severityBorder: Record<string, string> = {
    info: 'border-l-blue-400',
    warning: 'border-l-yellow-400',
    critical: 'border-l-red-600',
  };

  const statusBadgeColors: Record<string, { bg: string; text: string; label: string }> = {
    aberto: { bg: 'bg-red-100', text: 'text-red-800', label: 'Aberto' },
    reconhecido: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Reconhecido' },
    resolvido: { bg: 'bg-green-100', text: 'text-green-800', label: 'Resolvido' },
  };

  const statusStyle = statusBadgeColors[alert.status] ?? statusBadgeColors.aberto;
  const tipoLabel = tipoLabels[alert.tipo] ?? alert.tipo;

  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-lg border border-l-4 ${
        severityBorder[alert.severidade] ?? 'border-l-gray-400'
      } hover:bg-muted/30 transition-colors`}
    >
      <div className="flex-1 min-w-0">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <StatusBadge context="alert" value={alert.severidade} />
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold border-transparent ${statusStyle.bg} ${statusStyle.text}`}
          >
            {statusStyle.label}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">
            {tipoLabel}
          </Badge>
          {alert.ticket_id && (
            <Badge variant="outline" className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 border-transparent">
              <Ticket className="h-3 w-3 mr-0.5" />
              OS Gerada
            </Badge>
          )}
        </div>

        {/* Title & plant */}
        <p className="font-medium text-sm">{alert.titulo}</p>
        <div className="flex items-center gap-3 mt-1">
          {alert.solar_plants?.nome && (
            <span className="text-xs text-muted-foreground">
              🏭 {alert.solar_plants.nome}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
        {alert.descricao && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.descricao}</p>
        )}
      </div>

      {alert.status === 'aberto' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onResolve(alert.id)}
          title="Resolver"
          className="shrink-0"
        >
          <XCircle className="h-4 w-4 mr-1" /> Resolver
        </Button>
      )}
    </div>
  );
}
