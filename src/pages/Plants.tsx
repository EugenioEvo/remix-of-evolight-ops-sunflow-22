import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, MapPin, Zap, AlertTriangle, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/sunflow/StatusBadge';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { getPlantsWithStats, formatCapacity, formatPerformanceRatio } from '@/integrations/sunflow/client';
import type { PlantStatus, SolarPlantWithStats } from '@/integrations/sunflow/types';

export default function Plants() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PlantStatus | 'all'>('all');

  const { data: plants = [], loading } = useSupabaseQuery(getPlantsWithStats, []);

  const filtered = plants.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.city.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
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
          onValueChange={(v) => setStatusFilter(v as PlantStatus | 'all')}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="inactive">Inativa</SelectItem>
            <SelectItem value="maintenance">Manutenção</SelectItem>
            <SelectItem value="decommissioned">Descomissionada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />
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
          {filtered.map((plant) => (
            <PlantCard key={plant.id} plant={plant} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlantCard({ plant }: { plant: SolarPlantWithStats }) {
  return (
    <Link to={`/sunflow/plants/${plant.id}`}>
      <Card className="hover:shadow-md transition-shadow h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0">
              <p className="font-semibold text-base truncate">{plant.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{plant.code}</p>
            </div>
            <StatusBadge context="plant" value={plant.status} className="ml-2 shrink-0" />
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{plant.city}, {plant.state}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/50 rounded-lg p-2.5">
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Zap className="h-3 w-3" />
                <span className="text-xs">Capacidade</span>
              </div>
              <p className="font-semibold">{formatCapacity(plant.capacity_kwp)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-xs text-muted-foreground mb-1">PR 7d</p>
              <p className="font-semibold">{formatPerformanceRatio(plant.avg_pr_7d)}</p>
            </div>
          </div>

          {(plant.active_alerts > 0 || plant.open_work_orders > 0) && (
            <div className="flex gap-3 mt-3 pt-3 border-t">
              {plant.active_alerts > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-red-600 font-medium">{plant.active_alerts} alert{plant.active_alerts !== 1 ? 'as' : 'a'}</span>
                </div>
              )}
              {plant.open_work_orders > 0 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-blue-600 font-medium">{plant.open_work_orders} OS</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
