import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MapPin, Zap, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/sunflow/StatusBadge';
import { useSolarPlants } from '@/hooks/queries/useSolar';

function formatCapacity(kwp: number | null | undefined): string {
  if (kwp == null) return '—';
  if (Number(kwp) >= 1000) return `${(Number(kwp) / 1000).toFixed(1)} MWp`;
  return `${Number(kwp).toFixed(0)} kWp`;
}

type StatusFilter = 'all' | 'active' | 'inactive';

export default function Plants() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: plants = [], isLoading: loading } = useSolarPlants();

  const filtered = plants.filter((p: any) => {
    const matchesSearch =
      !search ||
      p.nome?.toLowerCase().includes(search.toLowerCase()) ||
      p.serial_inversor?.toLowerCase().includes(search.toLowerCase()) ||
      p.cidade?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && p.ativo) ||
      (statusFilter === 'inactive' && !p.ativo);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usinas Solares</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {plants.length} usina{plants.length !== 1 ? 's' : ''} cadastrada{plants.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild>
          <Link to="/sunflow/plants/new">
            <Plus className="mr-2 h-4 w-4" /> Nova Usina
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="inactive">Inativa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((plant: any) => (
            <PlantCard key={plant.id} plant={plant} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlantCard({ plant }: { plant: any }) {
  return (
    <Link to={`/sunflow/plants/${plant.id}`}>
      <Card className="hover:shadow-md transition-shadow h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0">
              <p className="font-semibold text-base truncate">{plant.nome}</p>
              {plant.serial_inversor && (
                <p className="text-xs text-muted-foreground font-mono">{plant.serial_inversor}</p>
              )}
            </div>
            <StatusBadge context="plant" value={plant.ativo ? 'active' : 'inactive'} className="ml-2 shrink-0" />
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {plant.cidade}{plant.estado ? `, ${plant.estado}` : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/50 rounded-lg p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Zap className="h-3 w-3" />
                <span className="text-xs">Capacidade</span>
              </div>
              <p className="font-semibold">
                {plant.potencia_kwp != null ? `${Number(plant.potencia_kwp).toFixed(0)} kWp` : '—'}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-xs text-muted-foreground mb-1">Inversor</p>
              <p className="font-semibold truncate">{plant.marca_inversor ?? '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
