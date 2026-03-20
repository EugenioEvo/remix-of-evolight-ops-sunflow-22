import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MapPin, Zap, Sun, AlertTriangle, ChevronRight, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KPICard } from '@/components/sunflow/KPICard';
import { useSolarPlants } from '@/hooks/queries/useSolar';

type SolarzStatus = 'OK' | 'ALERTA' | 'CRITICO' | 'DESCONHECIDO';
type StatusFilter = 'all' | SolarzStatus;

function normalizeSolarzStatus(raw: string | null | undefined): SolarzStatus {
  if (!raw) return 'DESCONHECIDO';
  const upper = raw.toUpperCase();
  if (upper === 'OK') return 'OK';
  if (upper === 'ALERTA') return 'ALERTA';
  if (upper === 'CRITICO') return 'CRITICO';
  return 'DESCONHECIDO';
}

const statusColors: Record<SolarzStatus, { bg: string; text: string }> = {
  OK: { bg: 'bg-green-100', text: 'text-green-800' },
  ALERTA: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  CRITICO: { bg: 'bg-red-100', text: 'text-red-800' },
  DESCONHECIDO: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

const statusOrder: Record<SolarzStatus, number> = { CRITICO: 0, DESCONHECIDO: 1, ALERTA: 2, OK: 3 };

function formatCapacity(kwp: number | null | undefined): string {
  if (kwp == null) return '—';
  const n = Number(kwp);
  if (n >= 1000) return `${(n / 1000).toFixed(1)} MWp`;
  return `${n.toFixed(0)} kWp`;
}

export default function Plants() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: plants = [], isLoading: loading } = useSolarPlants();

  // KPIs
  const totalCapacity = plants.reduce((sum, p: any) => sum + Number(p.potencia_kwp ?? 0), 0);
  const onlineCount = plants.filter((p: any) => normalizeSolarzStatus(p.solarz_status) === 'OK').length;
  const problemCount = plants.filter((p: any) => ['CRITICO', 'DESCONHECIDO'].includes(normalizeSolarzStatus(p.solarz_status))).length;

  const filtered = useMemo(() => {
    return plants
      .filter((p: any) => {
        if (statusFilter !== 'all' && normalizeSolarzStatus(p.solarz_status) !== statusFilter) return false;
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          p.nome?.toLowerCase().includes(s) ||
          p.cidade?.toLowerCase().includes(s) ||
          (p as any).clientes?.empresa?.toLowerCase().includes(s)
        );
      })
      .sort((a: any, b: any) => {
        return statusOrder[normalizeSolarzStatus(a.solarz_status)] - statusOrder[normalizeSolarzStatus(b.solarz_status)];
      });
  }, [plants, statusFilter, search]);

  const filterTabs: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: `Todos (${plants.length})` },
    { value: 'OK', label: `OK` },
    { value: 'ALERTA', label: `Alerta` },
    { value: 'CRITICO', label: `Crítico` },
    { value: 'DESCONHECIDO', label: `Desconhecido` },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usinas Solares</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão e monitoramento do portfólio
          </p>
        </div>
        <Button asChild>
          <Link to="/sunflow/plants/new">
            <Plus className="mr-2 h-4 w-4" /> Nova Usina
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total de Usinas" value={loading ? '—' : plants.length} icon={Sun} loading={loading} />
        <KPICard title="Potência Instalada" value={loading ? '—' : formatCapacity(totalCapacity)} icon={Zap} loading={loading} />
        <KPICard
          title="Online (OK)"
          value={loading ? '—' : onlineCount}
          icon={Activity}
          loading={loading}
          valueClassName="text-green-600"
        />
        <KPICard
          title="Com Problema"
          value={loading ? '—' : problemCount}
          icon={AlertTriangle}
          loading={loading}
          valueClassName={problemCount > 0 ? 'text-red-600' : undefined}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cidade ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filterTabs.map((tab) => (
            <Button
              key={tab.value}
              size="sm"
              variant={statusFilter === tab.value ? 'default' : 'outline'}
              onClick={() => setStatusFilter(tab.value)}
              className="text-xs"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Nenhuma usina encontrada.</p>
          <Button asChild className="mt-4">
            <Link to="/sunflow/plants/new">Cadastrar primeira usina</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((plant: any) => (
            <PlantCard key={plant.id} plant={plant} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlantCard({ plant }: { plant: any }) {
  const status = normalizeSolarzStatus(plant.solarz_status);
  const colors = statusColors[status];
  const clientName = (plant as any).clientes?.empresa;

  return (
    <Card className="hover:shadow-md transition-shadow h-full">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between mb-2">
          <p className="font-bold text-sm truncate flex-1 mr-2">{plant.nome}</p>
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold shrink-0 border-transparent ${colors.bg} ${colors.text}`}
          >
            {status}
          </Badge>
        </div>

        <div className="space-y-1.5 text-sm text-muted-foreground mb-3 flex-1">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span>{plant.potencia_kwp != null ? `${Number(plant.potencia_kwp).toFixed(0)} kWp` : '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {plant.cidade ?? '—'}{plant.estado ? `, ${plant.estado}` : ''}
            </span>
          </div>
          {clientName && (
            <p className="text-xs truncate">
              Cliente: <span className="font-medium text-foreground">{clientName}</span>
            </p>
          )}
        </div>

        <Button asChild size="sm" variant="outline" className="w-full mt-auto">
          <Link to={`/sunflow/plants/${plant.id}`}>
            Ver detalhes <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
