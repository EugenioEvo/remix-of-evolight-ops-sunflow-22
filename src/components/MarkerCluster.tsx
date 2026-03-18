import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

interface MarkerData {
  id: string;
  position: [number, number];
  icon?: L.DivIcon | L.Icon;
  popupContent?: string;
}

interface MarkerClusterProps {
  markers: MarkerData[];
  disableClustering?: boolean;
}

const MarkerCluster: React.FC<MarkerClusterProps> = ({ markers, disableClustering = false }) => {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    // Check if markerClusterGroup is available
    if (typeof (L as any).markerClusterGroup !== 'function') {
      return;
      return;
    }

    // Clean up existing cluster group
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }

    // Don't create cluster if no markers
    if (markers.length === 0) return;

    try {
      // Create cluster group with custom options
      const clusterGroup = (L as any).markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        maxClusterRadius: disableClustering ? 0 : 60,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 16,
        animate: true,
        animateAddingMarkers: false, // Disable to prevent animation issues
        spiderfyDistanceMultiplier: 1.5,
        spiderLegPolylineOptions: { 
          weight: 2, 
          color: 'hsl(217, 91%, 60%)', 
          opacity: 0.6 
        },
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          let size: 'small' | 'medium' | 'large' = 'small';
          
          if (count > 10) size = 'medium';
          if (count > 25) size = 'large';

          const sizeMap = { small: 36, medium: 44, large: 52 };
          const fontMap = { small: 14, medium: 16, large: 18 };

          return L.divIcon({
            html: `<div style="
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              width: ${sizeMap[size]}px;
              height: ${sizeMap[size]}px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: ${fontMap[size]}px;
              color: white;
            ">${count}</div>`,
            className: `marker-cluster marker-cluster-${size}`,
            iconSize: L.point(sizeMap[size], sizeMap[size]),
          });
        },
      });

      // Add markers to cluster group
      markers.forEach((markerData) => {
        if (!markerData.position || !Array.isArray(markerData.position)) return;
        
        const marker = L.marker(markerData.position, {
          icon: markerData.icon || L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        });

        if (markerData.popupContent) {
          marker.bindPopup(markerData.popupContent);
        }

        clusterGroup.addLayer(marker);
      });

      clusterGroupRef.current = clusterGroup;
      map.addLayer(clusterGroup);
    } catch (error) {
      console.error('MarkerCluster error:', error);
    }

    // Cleanup on unmount
    return () => {
      if (clusterGroupRef.current && map) {
        try {
          map.removeLayer(clusterGroupRef.current);
        } catch (e) {
          // Ignore cleanup errors
        }
        clusterGroupRef.current = null;
      }
    };
  }, [map, markers, disableClustering]);

  return null;
};

export default MarkerCluster;
