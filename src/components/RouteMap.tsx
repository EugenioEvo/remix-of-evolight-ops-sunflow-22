import React, { useState, useEffect, useMemo, useCallback } from 'react';
import logger from '@/lib/logger';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Route as RouteIcon, RefreshCw, TestTube } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeocoding } from '@/hooks/useGeocoding';
import { toast } from "sonner";
import { optimizeRouteAdvanced } from '@/components/RouteOptimization';
import { RouteStatsCards } from '@/components/RouteStatsCards';
import { RouteFilters } from '@/components/RouteFilters';
import { RouteLegend } from '@/components/RouteLegend';
import { useRouteOptimization } from '@/hooks/useRouteOptimization';

// New refactored components
import {
  GeocodingProgress,
  RouteList,
  RouteDetails,
  MapView,
  normalizeCoordinates,
  calculateRouteTotals,
  EVOLIGHT_COORDS
} from '@/components/routes';
import type { TicketData, RotaOtimizada, TecnicoOption, RouteProvider } from '@/components/routes/types';

const RouteMap: React.FC = () => {
  // State
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ordensServico, setOrdensServico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tecnicoFilter, setTecnicoFilter] = useState('todos');
  const [prioridadeFilter, setPrioridadeFilter] = useState('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [optimizingRoute, setOptimizingRoute] = useState<number | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);
  const [routeProvider, setRouteProvider] = useState<RouteProvider>(null);
  const [tecnicos, setTecnicos] = useState<TecnicoOption[]>([]);
  const [optimizingAll, setOptimizingAll] = useState(false);
  
  // Hooks
  const { profile } = useAuth();
  const { geocodeBatch, loading: geocoding, progress, completed, total } = useGeocoding();
  const { optimizeRoute, loading: optimizing } = useRouteOptimization();

  // Load initial data
  useEffect(() => {
    setMounted(true);
    loadOrdensServico();
    loadTecnicos();
  }, [dateFilter, statusFilter, tecnicoFilter, prioridadeFilter, searchQuery, profile]);

  // Clear geometry when route changes
  useEffect(() => {
    setRouteGeometry(null);
    setRouteProvider(null);
  }, [selectedRoute]);

  // Load persisted route when selecting a route
  useEffect(() => {
    const loadPersistedRoute = async () => {
      if (!selectedRoute) return;
      
      const rota = rotasOtimizadas.find(r => r.id === selectedRoute);
      const firstTicket = rota?.ticketsData?.[0];
      if (!firstTicket?.tecnicoId) return;

      const dates = (rota!.ticketsData)
        .map(t => t.dataProgramada)
        .filter(Boolean)
        .map((d: string) => new Date(d));
      const dataRota = (dates.length 
        ? new Date(Math.min(...dates.map(d => d.getTime()))) 
        : new Date()
      ).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('route_optimizations')
        .select('*')
        .eq('tecnico_id', firstTicket.tecnicoId)
        .eq('data_rota', dataRota)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        logger.warn('⚠️ Erro ao carregar rota persistida:', error);
        return;
      }

      const record = data?.[0];
      if (record?.geometry && Array.isArray(record.geometry) && record.geometry.length > 0) {
        const toLeaflet = (coords: [number, number][]) => 
          coords.map(c => [c[1], c[0]] as [number, number]);
        
        setRouteGeometry(toLeaflet(record.geometry as [number, number][]));
        setRouteProvider(record.optimization_method as RouteProvider);
      }
    };

    loadPersistedRoute();
  }, [selectedRoute]);

  const loadTecnicos = async () => {
    const { data } = await supabase
      .from('tecnicos')
      .select('id, profiles!inner(nome)')
      .order('profiles(nome)');
    
    if (data) {
      setTecnicos(data.map(t => ({ id: t.id, nome: (t.profiles as any).nome })));
    }
  };

  const loadOrdensServico = async () => {
    try {
      let query = supabase
        .from('ordens_servico')
        .select(`
          *,
          tickets!inner(
            id, numero_ticket, titulo, endereco_servico,
            latitude, longitude, geocoded_at, prioridade,
            status, tempo_estimado,
            clientes!inner(empresa)
          ),
          tecnicos!inner(id, profiles!inner(nome))
        `);

      // Filter by technician for field technicians
      if (profile?.role === 'tecnico_campo') {
        const { data: tecnicoData } = await supabase
          .from('tecnicos')
          .select('id')
          .eq('profile_id', profile?.id)
          .single();
        
        if (tecnicoData) {
          query = query.eq('tecnico_id', tecnicoData.id);
        }
      }

      // Apply filters
      if (tecnicoFilter !== 'todos') {
        query = query.eq('tecnico_id', tecnicoFilter);
      }

      if (statusFilter !== 'todos') {
        query = query.eq('tickets.status', statusFilter as any);
      } else {
        query = query.in('tickets.status', ['ordem_servico_gerada', 'em_execucao', 'concluido']);
      }

      // Date filter
      const today = new Date();
      if (dateFilter === 'hoje') {
        query = query.eq('data_programada', today.toISOString().split('T')[0]);
      } else if (dateFilter === 'amanha') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        query = query.eq('data_programada', tomorrow.toISOString().split('T')[0]);
      } else if (dateFilter === 'semana') {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        query = query.gte('data_programada', today.toISOString().split('T')[0])
          .lte('data_programada', weekEnd.toISOString().split('T')[0]);
      } else if (dateFilter === 'mes') {
        const monthEnd = new Date(today);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        query = query.gte('data_programada', today.toISOString().split('T')[0])
          .lte('data_programada', monthEnd.toISOString().split('T')[0]);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      let filteredData = data || [];

      // Priority filter
      if (prioridadeFilter !== 'todas') {
        filteredData = filteredData.filter(os => os.tickets.prioridade === prioridadeFilter);
      }

      // Search filter
      if (searchQuery.trim()) {
        const search = searchQuery.toLowerCase();
        filteredData = filteredData.filter(os => 
          os.tickets.endereco_servico?.toLowerCase().includes(search) ||
          os.tickets.clientes?.empresa?.toLowerCase().includes(search) ||
          os.tickets.numero_ticket?.toLowerCase().includes(search)
        );
      }

      setOrdensServico(filteredData);
    } catch (error) {
      console.error('Erro ao carregar ordens de serviço:', error);
    } finally {
      setLoading(false);
    }
  };

  // Convert OS to tickets format - memoized
  const tickets: TicketData[] = useMemo(() => {
    return ordensServico.map((os) => {
      const hasCoords = os.tickets.latitude && os.tickets.longitude;
      
      return {
        id: os.id,
        ticketId: os.tickets.id,
        numeroOS: os.numero_os,
        numero: os.tickets.numero_ticket,
        cliente: os.tickets.clientes?.empresa || 'Cliente não definido',
        endereco: os.tickets.endereco_servico,
        prioridade: os.tickets.prioridade,
        status: os.tickets.status,
        tipo: os.tickets.titulo,
        tecnico: os.tecnicos?.profiles?.nome || 'Não atribuído',
        estimativa: os.tickets.tempo_estimado ? `${os.tickets.tempo_estimado}h` : 'N/A',
        dataProgramada: os.data_programada,
        coordenadas: hasCoords 
          ? normalizeCoordinates(os.tickets.latitude, os.tickets.longitude)
          : EVOLIGHT_COORDS,
        hasRealCoords: hasCoords,
        tecnicoId: os.tecnicos?.id || null
      };
    });
  }, [ordensServico]);

  // Group by technician AND date - memoized
  const rotasOtimizadas: RotaOtimizada[] = useMemo(() => {
    interface RotaTemp {
      tecnico: string;
      tecnicoId: string | null;
      dataRota: string | null;
      ticketsData: TicketData[];
    }
    
    // Create a key combining technician and date
    const rotasPorTecnicoData = new Map<string, RotaTemp>();
    
    ordensServico.forEach(os => {
      const tecnicoNome = os.tecnicos?.profiles?.nome || 'Sem técnico';
      const tecnicoId = os.tecnicos?.id || null;
      const dataOS = os.data_programada ? os.data_programada.split('T')[0] : 'sem-data';
      const key = `${tecnicoId || 'sem-tecnico'}_${dataOS}`;
      
      if (!rotasPorTecnicoData.has(key)) {
        rotasPorTecnicoData.set(key, {
          tecnico: tecnicoNome,
          tecnicoId,
          dataRota: dataOS !== 'sem-data' ? dataOS : null,
          ticketsData: []
        });
      }
      
      const ticketData = tickets.find(t => t.id === os.id);
      if (ticketData) {
        rotasPorTecnicoData.get(key)!.ticketsData.push(ticketData);
      }
    });

    // Convert to array and add IDs, optimize, and calculate totals
    let routeId = 0;
    const optimizedRoutes: RotaOtimizada[] = [];

    // Sort entries by date (today first, then tomorrow, etc)
    const sortedEntries = Array.from(rotasPorTecnicoData.entries()).sort((a, b) => {
      const dateA = a[1].dataRota || '9999-99-99';
      const dateB = b[1].dataRota || '9999-99-99';
      return dateA.localeCompare(dateB);
    });

    for (const [, rota] of sortedEntries) {
      routeId++;
      const optimizedTickets = optimizeRouteAdvanced(rota.ticketsData);
      const totals = calculateRouteTotals(optimizedTickets);
      const allGeocoded = optimizedTickets.every((t: TicketData) => t.hasRealCoords);
      const canOptimize = allGeocoded && optimizedTickets.length >= 2;
      
      optimizedRoutes.push({
        id: routeId,
        nome: `${rota.tecnico} - ${rota.dataRota || 'Sem data'}`,
        ticketsData: optimizedTickets,
        tecnico: rota.tecnico,
        tecnicoId: rota.tecnicoId,
        dataRota: rota.dataRota,
        distanciaTotal: totals.distance,
        tempoEstimado: totals.time,
        allGeocoded,
        canOptimize,
        isOptimized: false
      });
    }

    return optimizedRoutes.length > 0 ? optimizedRoutes : [
      {
        id: 1,
        nome: 'Ordens Pendentes',
        ticketsData: optimizeRouteAdvanced(tickets),
        tecnico: 'Diversos',
        tecnicoId: null,
        dataRota: null,
        distanciaTotal: calculateRouteTotals(tickets).distance,
        tempoEstimado: calculateRouteTotals(tickets).time,
        allGeocoded: tickets.every(t => t.hasRealCoords),
        canOptimize: false,
        isOptimized: false
      }
    ];
  }, [ordensServico, tickets]);

  // Handlers
  const handleGeocode = useCallback(async (rota: RotaOtimizada) => {
    const ticketsToGeocode = rota.ticketsData
      .filter(t => !t.hasRealCoords)
      .map(t => ({ id: t.ticketId, address: t.endereco }));
    
    await geocodeBatch(ticketsToGeocode);
    loadOrdensServico();
  }, [geocodeBatch]);

  const handleOptimize = useCallback(async (rota: RotaOtimizada) => {
    setOptimizingRoute(rota.id);
    
    // Usar dataRota e tecnicoId diretamente da rota
    const result = await optimizeRoute(rota.ticketsData, {
      tecnicoId: rota.tecnicoId || undefined,
      dataRota: rota.dataRota || new Date().toISOString().slice(0, 10)
    });

    if (result?.data?.route?.geometry) {
      const toLeaflet = (coords: [number, number][]) => 
        coords.map(c => [c[1], c[0]] as [number, number]);
      setRouteGeometry(toLeaflet(result.data.route.geometry));
    } else {
      const coords = rota.ticketsData
        .filter(t => t.hasRealCoords)
        .map(t => t.coordenadas);
      setRouteGeometry(coords.length > 1 ? coords : null);
    }
    setRouteProvider(result?.provider || null);
    
    // Recarregar para mostrar badge de "Otimizada"
    await loadOrdensServico();
    setOptimizingRoute(null);
  }, [optimizeRoute]);

  const handleRouteReorder = useCallback(async (routeId: number, newTicketsOrder: TicketData[]) => {
    // Update local state immediately for responsive UI
    setOrdensServico(prev => {
      const updatedOS = [...prev];
      newTicketsOrder.forEach((ticket, index) => {
        const osIndex = updatedOS.findIndex(os => os.id === ticket.id);
        if (osIndex !== -1) {
          updatedOS[osIndex] = { ...updatedOS[osIndex], _ordem: index };
        }
      });
      return updatedOS;
    });

    // Persist to database
    const rota = rotasOtimizadas.find(r => r.id === routeId);
    if (!rota?.tecnicoId || !rota?.dataRota) {
      toast.warning("Ordem atualizada localmente (sem técnico/data para persistir)");
      return;
    }

    try {
      const waypointsOrder = newTicketsOrder.map((t, idx) => ({
        ticketId: t.ticketId,
        osId: t.id,
        ordem: idx,
        endereco: t.endereco
      }));

      const ticketIds = newTicketsOrder.map(t => t.ticketId);
      
      // Calculate simple distance estimate
      const coords = newTicketsOrder
        .filter(t => t.hasRealCoords)
        .map(t => t.coordenadas);
      
      let totalDistance = 0;
      for (let i = 1; i < coords.length; i++) {
        const [lat1, lon1] = coords[i - 1];
        const [lat2, lon2] = coords[i];
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        totalDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      // Upsert route optimization record
      const { error } = await supabase
        .from('route_optimizations')
        .upsert({
          tecnico_id: rota.tecnicoId,
          data_rota: rota.dataRota,
          waypoints_order: waypointsOrder,
          ticket_ids: ticketIds,
          geometry: coords,
          distance_km: Math.round(totalDistance * 10) / 10,
          duration_minutes: newTicketsOrder.length * 30,
          optimization_method: 'manual',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tecnico_id,data_rota'
        });

      if (error) throw error;
      toast.success("Ordem das paradas salva!");
    } catch (err) {
      console.error('Erro ao persistir ordem:', err);
      toast.error("Erro ao salvar ordem no banco");
    }
  }, [rotasOtimizadas]);

  const handleOptimizeAll = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const todayRoutes = rotasOtimizadas.filter(
      r => r.dataRota === today && r.canOptimize && !r.isOptimized
    );

    if (todayRoutes.length === 0) {
      toast.info('Nenhuma rota para otimizar hoje');
      return;
    }

    setOptimizingAll(true);
    toast.info(`Otimizando ${todayRoutes.length} rotas...`);

    let successCount = 0;
    for (const rota of todayRoutes) {
      setOptimizingRoute(rota.id);
      try {
        await optimizeRoute(rota.ticketsData, {
          tecnicoId: rota.tecnicoId || undefined,
          dataRota: rota.dataRota || today
        });
        successCount++;
      } catch {
        toast.error(`Erro ao otimizar rota de ${rota.tecnico}`);
      }
    }

    await loadOrdensServico();
    setOptimizingRoute(null);
    setOptimizingAll(false);
    toast.success(`${successCount} de ${todayRoutes.length} rotas otimizadas`);
  }, [rotasOtimizadas, optimizeRoute]);

  const handleTestMapbox = useCallback(async () => {
    const enderecoTeste = "Avenida Paulista, 1578, São Paulo, SP";
    toast.info('🔍 Testando geocodificação...', { description: `Endereço: ${enderecoTeste}` });

    try {
      const { data, error } = await supabase.functions.invoke('mapbox-geocode', {
        body: { address: enderecoTeste }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('✅ Token Mapbox funcionando!', {
          description: `Lat: ${data.data.latitude.toFixed(6)}, Lng: ${data.data.longitude.toFixed(6)}`
        });
      } else {
        toast.error('❌ Erro na geocodificação', { description: data?.error || 'Erro desconhecido' });
      }
    } catch (err: any) {
      toast.error('❌ Falha no teste', { description: err.message || 'Verifique os logs' });
    }
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const totalOS = tickets.length;
    const totalDistance = rotasOtimizadas.reduce((sum, r) => {
      const km = parseFloat(r.distanciaTotal?.replace(' km', '') || '0');
      return sum + km;
    }, 0);
    const activeTechnicians = new Set(ordensServico.map(os => os.tecnico_id).filter(Boolean)).size;
    const avgDuration = ordensServico.reduce((sum, os) => sum + (os.tickets?.tempo_estimado || 0), 0) 
      / (ordensServico.length || 1) * 60;

    return { totalOS, totalDistance, activeTechnicians, avgDuration };
  }, [tickets, rotasOtimizadas, ordensServico]);

  const priorityCounts = useMemo(() => {
    return rotasOtimizadas.reduce((acc, r) => {
      r.ticketsData.forEach(t => {
        const p = t.prioridade?.toLowerCase() || 'baixa';
        acc[p] = (acc[p] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
  }, [rotasOtimizadas]);

  // Loading state
  if (loading || !mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <div className="lg:col-span-1">
          <Card className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card className="h-full flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando mapa...</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Empty state
  if (tickets.length === 0) {
    return (
      <div className="space-y-6">
        <RouteStatsCards totalOS={0} totalDistance={0} activeTechnicians={0} avgDuration={0} />
        
        <RouteFilters
          periodo={dateFilter}
          setPeriodo={setDateFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          tecnicoFilter={tecnicoFilter}
          setTecnicoFilter={setTecnicoFilter}
          prioridadeFilter={prioridadeFilter}
          setPrioridadeFilter={setPrioridadeFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          tecnicos={tecnicos}
        />

        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center">
              <MapPin className="h-12 w-12 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma ordem de serviço encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {dateFilter !== 'todos' 
                  ? 'Não há OSs para o período selecionado. Tente ajustar os filtros acima.'
                  : 'Não há ordens de serviço cadastradas no sistema.'}
              </p>
            </div>
            {dateFilter !== 'todos' && (
              <Button 
                variant="outline"
                onClick={() => {
                  setDateFilter('todos');
                  setStatusFilter('todos');
                  setTecnicoFilter('todos');
                  setPrioridadeFilter('todas');
                  setSearchQuery('');
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Geocoding Progress */}
      <GeocodingProgress
        isGeocoding={geocoding}
        progress={progress}
        completed={completed}
        total={total}
      />

      {/* Stats Cards */}
      <RouteStatsCards 
        totalOS={stats.totalOS}
        totalDistance={stats.totalDistance}
        activeTechnicians={stats.activeTechnicians}
        avgDuration={stats.avgDuration}
      />

      {/* Filters */}
      <RouteFilters
        periodo={dateFilter}
        setPeriodo={setDateFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        tecnicoFilter={tecnicoFilter}
        setTecnicoFilter={setTecnicoFilter}
        prioridadeFilter={prioridadeFilter}
        setPrioridadeFilter={setPrioridadeFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        tecnicos={tecnicos}
      />

      {/* Mapbox Test Button */}
      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TestTube className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Testar Geocodificação Mapbox</p>
              <p className="text-xs text-muted-foreground">Verifica se o token está funcionando</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleTestMapbox}>
            <TestTube className="h-4 w-4 mr-2" />
            Testar Agora
          </Button>
        </div>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Left Column - Routes List */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto">
          <RouteList
            rotas={rotasOtimizadas}
            selectedRoute={selectedRoute}
            onSelectRoute={setSelectedRoute}
            onGeocode={handleGeocode}
            onOptimize={handleOptimize}
            onOptimizeAll={handleOptimizeAll}
            isGeocoding={geocoding}
            optimizingRouteId={optimizingRoute}
            isOptimizingAll={optimizingAll}
          />

          {/* Route Details/Timeline */}
          <RouteDetails
            selectedRoute={selectedRoute}
            rotas={rotasOtimizadas}
            onRouteUpdate={handleRouteReorder}
          />

          {/* Legend */}
          <RouteLegend
            criticalCount={priorityCounts['critica'] || 0}
            highCount={priorityCounts['alta'] || 0}
            mediumCount={priorityCounts['media'] || 0}
            lowCount={priorityCounts['baixa'] || 0}
            routeProvider={routeProvider}
          />
        </div>

        {/* Right Column - Map */}
        <div className="lg:col-span-2">
          <MapView
            tickets={tickets}
            selectedRoute={selectedRoute}
            rotas={rotasOtimizadas}
            routeGeometry={routeGeometry}
            routeProvider={routeProvider}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(RouteMap);
