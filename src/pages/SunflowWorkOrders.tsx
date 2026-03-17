import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/sunflow/StatusBadge';
import { KPICard } from '@/components/sunflow/KPICard';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { getWorkOrders, formatDate } from '@/integrations/sunflow/client';
import type { WorkOrderStatus, WorkOrderType, WorkOrderPriority } from '@/integrations/sunflow/types';

type StatusFilter = WorkOrderStatus | 'all';
type TypeFilter = WorkOrderType | 'all';
type PriorityFilter = WorkOrderPriority | 'all';

export default function SunflowWorkOrders() {
  const [searchParams] = useSearchParams();
  const plantIdParam = searchParams.get('plant_id') ?? undefined;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  const { data: result, loading } = useSupabaseQuery(
    () =>
      getWorkOrders({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        plant_id: plantIdParam,
        pageSize: 50,
      }),
    [statusFilter, typeFilter, priorityFilter, plantIdParam]
  );

  const workOrders = (result?.data ?? []).filter(
    (wo) =>
      !search ||
      wo.title.toLowerCase().includes(search.toLowerCase()) ||
      wo.wo_number.toLowerCase().includes(search.toLowerCase()) ||
      wo.plant?.name.toLowerCase().includes(search.toLowerCase())
  );

  const total = result?.count ?? 0;
  const openCount = workOrders.filter((w) => w.status === 'open').length;
  const inProgressCount = workOrders.filter((w) => w.status === 'in_progress').length;
  const criticalCount = workOrders.filter((w) => w.priority === 'critical').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Ordens de Serviço</h1>
          <p className="text-sm text-muted-foreground">{total} OS no total</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total" value={total} loading={loading} />
        <KPICard title="Abertas" value={openCount} loading={loading} />
        <KPICard title="Em Andamento" value={inProgressCount} loading={loading} />
        <KPICard title="Críticas" value={criticalCount} loading={loading} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, número ou usina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Aberta</SelectItem>
            <SelectItem value="assigned">Atribuída</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="preventive">Preventiva</SelectItem>
            <SelectItem value="corrective">Corretiva</SelectItem>
            <SelectItem value="inspection">Inspeção</SelectItem>
            <SelectItem value="emergency">Emergência</SelectItem>
            <SelectItem value="improvement">Melhoria</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="critical">Crítica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Lista de OSs</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Número</th>
                    <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Título</th>
                    <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Usina</th>
                    <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Prioridade</th>
                    <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map((wo) => (
                    <tr key={wo.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{wo.wo_number}</td>
                      <td className="py-3 pr-4 max-w-[200px]">
                        <p className="truncate font-medium">{wo.title}</p>
                        {wo.assignee && (
                          <p className="text-xs text-muted-foreground truncate">{wo.assignee.full_name}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{wo.plant?.name ?? '—'}</td>
                      <td className="py-3 pr-4 capitalize text-muted-foreground text-xs">{wo.type}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge context="priority" value={wo.priority} />
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge context="workOrder" value={wo.status} />
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {wo.scheduled_date ? formatDate(wo.scheduled_date) : formatDate(wo.created_at)}
                      </td>
                    </tr>
                  ))}
                  {workOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-muted-foreground">
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
