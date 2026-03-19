import React, { useState, useEffect, useRef } from 'react';
import logger from '@/lib/logger';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  getPrioridadeColor, 
  getStatusColor,
  EVOLIGHT_COORDS 
} from './utils';
import type { TicketData, RotaOtimizada, RouteProvider } from './types';

interface MapViewProps {
  tickets: TicketData[];
  selectedRoute: number | null;
  rotas: RotaOtimizada[];
  routeGeometry: [number, number][] | null;
  routeProvider: RouteProvider;
}

// Validar coordenadas antes de renderizar
const isValidCoordinate = (coords: [number, number] | undefined): boolean => {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) return false;
  const [lat, lon] = coords;
  return typeof lat === 'number' && typeof lon === 'number' &&
         !isNaN(lat) && !isNaN(lon) &&
         lat >= -90 && lat <= 90 &&
         lon >= -180 && lon <= 180;
};

const MapViewComponent: React.FC<MapViewProps> = ({
  tickets,
  selectedRoute,
  rotas,
  routeGeometry,
  routeProvider
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);

  const selectedRota = selectedRoute ? rotas.find(r => r.id === selectedRoute) : null;
  const validTickets = tickets.filter(t => isValidCoordinate(t.coordenadas));
  const validSelectedTickets = selectedRota?.ticketsData.filter(t => isValidCoordinate(t.coordenadas)) || [];
  const validGeometry = routeGeometry?.filter(coord => isValidCoordinate(coord)) || [];

  // Inicializar mapa usando Leaflet diretamente (sem react-leaflet)
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapContainerRef.current || mapRef.current) return;

      try {
        // Import Leaflet dinamicamente
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        if (!isMounted || !mapContainerRef.current) return;

        // Fix marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        // Criar mapa
        const map = L.map(mapContainerRef.current).setView(EVOLIGHT_COORDS, 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Marcador Evolight
        const evolightIcon = L.divIcon({
          className: 'evolight-marker',
          html: `<div style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #9333ea, #7c3aed);
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
          ">🏢</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        L.marker(EVOLIGHT_COORDS, { icon: evolightIcon })
          .addTo(map)
          .bindPopup('<b>Evolight</b><br>Ponto de Partida<br>Av. T9, 1001 - Setor Bueno');

        mapRef.current = map;
        setIsLoading(false);
      } catch (err) {
        console.error('Map init error:', err);
        if (isMounted) {
          setHasError(true);
          setErrorMessage(err instanceof Error ? err.message : 'Erro desconhecido');
        }
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Atualizar marcadores quando tickets mudam
  useEffect(() => {
    const updateMarkers = async () => {
      if (!mapRef.current) return;

      const L = (await import('leaflet')).default;
      const map = mapRef.current;

      // Limpar marcadores antigos
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current = [];

      const ticketsToShow = selectedRota ? validSelectedTickets : validTickets;

      ticketsToShow.forEach((ticket, index) => {
        const color = {
          critica: '#dc2626',
          alta: '#f97316',
          media: '#eab308',
          baixa: '#22c55e'
        }[ticket.prioridade] || '#3b82f6';

        const icon = selectedRota 
          ? L.divIcon({
              className: 'numbered-marker',
              html: `<div style="
                width: 28px;
                height: 28px;
                background: ${color};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 12px;
              ">${ticket.ordem || index + 1}</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            })
          : L.divIcon({
              className: 'default-marker',
              html: `<div style="
                width: 24px;
                height: 24px;
                background: ${color};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              "></div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            });

        const marker = L.marker(ticket.coordenadas, { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width: 180px;">
              <b>${ticket.cliente}</b><br>
              OS: ${ticket.numeroOS}<br>
              ${ticket.tipo}<br>
              <small>${ticket.endereco}</small><br>
              <span style="color: ${color}; font-weight: bold;">${ticket.prioridade}</span>
            </div>
          `);

        markersRef.current.push(marker);
      });
    };

    updateMarkers();
  }, [validTickets, validSelectedTickets, selectedRota]);

  // Atualizar polyline quando geometria muda
  useEffect(() => {
    const updatePolyline = async () => {
      if (!mapRef.current) return;

      const L = (await import('leaflet')).default;
      const map = mapRef.current;

      // Remover polyline antiga
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }

      if (selectedRoute && validGeometry.length > 1) {
        const color = routeProvider === 'mapbox' ? '#3b82f6' : 
                      routeProvider === 'osrm' ? '#8b5cf6' : '#6b7280';
        
        const polyline = L.polyline(validGeometry, {
          color,
          weight: 4,
          opacity: 0.85,
          dashArray: routeProvider === 'mapbox' ? '10, 5' : undefined
        }).addTo(map);

        polylineRef.current = polyline;
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      }
    };

    updatePolyline();
  }, [selectedRoute, validGeometry, routeProvider]);

  const handleReload = () => {
    window.location.reload();
  };

  if (hasError) {
    return (
      <Card className="h-full">
        <CardContent className="p-6 flex items-center justify-center h-[600px]">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <div>
              <p className="text-sm font-medium mb-2">Erro ao carregar o mapa</p>
              <p className="text-xs text-muted-foreground mb-4">{errorMessage}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReload}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Recarregar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardContent className="p-0 h-full">
        <div className="w-full h-[600px] rounded-lg overflow-hidden relative">
          {/* Indicador de provider */}
          {routeProvider && (
            <div className="absolute top-2 right-2 z-[1000] bg-background/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-medium border">
              {routeProvider === 'mapbox' && <span className="text-blue-600">🗺️ Mapbox</span>}
              {routeProvider === 'osrm' && <span className="text-purple-600">🛣️ OSRM</span>}
              {routeProvider === 'local' && <span className="text-muted-foreground">📍 Local</span>}
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Carregando mapa...</p>
              </div>
            </div>
          )}

          <div 
            ref={mapContainerRef} 
            className="w-full h-full"
            style={{ minHeight: '600px' }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export const MapView = React.memo(MapViewComponent);
