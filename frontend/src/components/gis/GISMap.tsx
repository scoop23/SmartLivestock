'use client';

import React, { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { FeatureCollection } from 'geojson';
import padreGarciaGeojson from '@/data/padre-garcia-barangays.json';
import {
  BarangayGISData,
  MapLayer,
  MovementRecord,
  SimulatedBarangayState,
} from './types';
import 'leaflet/dist/leaflet.css';

// Dynamic SSR-safe imports for Leaflet components
const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import('react-leaflet').then((m) => m.GeoJSON),
  { ssr: false }
);
const Polyline = dynamic(
  () => import('react-leaflet').then((m) => m.Polyline),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then((m) => m.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), {
  ssr: false,
});
const Tooltip = dynamic(() => import('react-leaflet').then((m) => m.Tooltip), {
  ssr: false,
});

interface FitBoundsProps {
  resetTrigger: number;
}

// Client-only component to control Leaflet camera bounds dynamically
const FitBoundsComponent = dynamic(
  () =>
    import('react-leaflet').then((m) => {
      const FitBounds = ({ resetTrigger }: FitBoundsProps) => {
        const { useMap } = m;
        const map = useMap();

        useEffect(() => {
          import('leaflet').then((L) => {
            const geoJsonLayer = L.geoJSON(padreGarciaGeojson as any);
            const bounds = geoJsonLayer.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [24, 24] });
            }
          });
        }, [map, resetTrigger]);

        return null;
      };
      return FitBounds;
    }),
  { ssr: false }
);

interface GISMapProps {
  barangaysByName: Record<string, BarangayGISData>;
  movements: MovementRecord[];
  activeLayer: MapLayer;
  selectedBarangay: BarangayGISData | null;
  onSelectBarangay: (b: BarangayGISData) => void;
  resetTrigger: number;
  simulationMode: boolean;
  simulatedStates?: Record<string, SimulatedBarangayState>;
}

export function GISMap({
  barangaysByName,
  movements,
  activeLayer,
  selectedBarangay,
  onSelectBarangay,
  resetTrigger,
  simulationMode,
  simulatedStates,
}: GISMapProps) {
  const centerPosition: [number, number] = [13.8741, 121.2529];

  // Layer choropleth color generators
  const getCattleColor = (cattle: number): string => {
    if (cattle > 35) return '#1a3d15';
    if (cattle > 25) return '#2D5A27';
    if (cattle > 15) return '#5A8F4F';
    if (cattle > 5) return '#8AB877';
    if (cattle > 0) return '#C5E0A8';
    return '#EAF3E4';
  };

  const getDiseaseColor = (
    bName: string,
    risk: 'low' | 'medium' | 'high'
  ): string => {
    if (simulationMode && simulatedStates?.[bName]) {
      const simRisk = simulatedStates[bName].risk;
      if (simRisk === 'critical') return '#991b1b';
      if (simRisk === 'high') return '#dc2626';
      if (simRisk === 'medium') return '#f59e0b';
      return '#10b981';
    }
    if (risk === 'high') return '#D32F2F';
    if (risk === 'medium') return '#FFA726';
    return '#66BB6A';
  };

  const getMilkColor = (milk: number): string => {
    if (milk > 10000) return '#0c4a6e';
    if (milk > 1000) return '#0284c7';
    if (milk > 0) return '#38bdf8';
    return '#e0f2fe';
  };

  const getMeatColor = (meat: number): string => {
    if (meat > 500) return '#7c1d00';
    if (meat > 100) return '#dc2626';
    if (meat > 0) return '#f87171';
    return '#fecaca';
  };

  const getLayerColor = (data: BarangayGISData): string => {
    switch (activeLayer) {
      case 'cattle':
        return getCattleColor(data.cattle);
      case 'disease':
        return getDiseaseColor(data.name, data.disease_risk);
      case 'milk':
        return getMilkColor(data.milk);
      case 'meat':
        return getMeatColor(data.meat);
      case 'movement':
        return data.movement_out > 0 ? '#fee2e2' : '#f1f5f9';
      default:
        return '#cbd5e1';
    }
  };

  const getGeoJSONStyle = (feature: any) => {
    const name = feature?.properties?.name;
    const data = name ? barangaysByName[name] : null;
    const isSelected = selectedBarangay?.name === name;

    if (!data) {
      return {
        fillColor: '#cbd5e1',
        color: '#94a3b8',
        weight: 1.5,
        fillOpacity: 0.5,
      };
    }

    return {
      fillColor: getLayerColor(data),
      fillOpacity: isSelected ? 0.92 : 0.72,
      color: isSelected ? '#ffffff' : '#1e3a1e',
      weight: isSelected ? 3.5 : 1.8,
      dashArray: isSelected ? '' : '',
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const name = feature.properties?.name;
    const data = barangaysByName[name];
    if (!data) return;

    // Tooltip showing live demographic data on hover
    let tooltipMetric = `${data.cattle} cattle`;
    if (activeLayer === 'disease') {
      const risk =
        simulationMode && simulatedStates?.[name]
          ? `${simulatedStates[name].cases} sim cases (${simulatedStates[name].risk.toUpperCase()})`
          : `${data.active_cases} active cases (${data.disease_risk.toUpperCase()})`;
      tooltipMetric = risk;
    } else if (activeLayer === 'milk') {
      tooltipMetric = `${data.milk.toLocaleString()} L milk`;
    } else if (activeLayer === 'meat') {
      tooltipMetric = data.meat > 0 ? `${data.meat} kg meat` : 'No slaughter data';
    } else if (activeLayer === 'movement') {
      tooltipMetric = `${data.movement_out} heads moved`;
    }

    layer.bindTooltip(
      `<strong>${name}</strong><br/><span style="font-size: 10px; opacity: 0.9">${tooltipMetric}</span>`,
      {
        permanent: false,
        direction: 'center',
        className: 'barangay-tooltip',
      }
    );

    layer.on({
      mouseover: (e: any) => {
        e.target.setStyle({
          weight: 3.5,
          fillOpacity: 0.92,
          color: '#ffffff',
        });
        e.target.bringToFront();
      },
      mouseout: (e: any) => {
        e.target.setStyle(getGeoJSONStyle(feature));
      },
      click: () => {
        onSelectBarangay(data);
      },
    });
  };

  return (
    <div className="relative w-full h-full">
      <style>{`
        .barangay-tooltip {
          background: rgba(15, 41, 15, 0.92) !important;
          border: none !important;
          border-radius: 6px !important;
          color: white !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          padding: 4px 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
          text-align: center !important;
        }
        .barangay-tooltip::before { display: none !important; }
        .leaflet-container {
          background-color: #f1f5f9 !important;
          font-family: inherit !important;
        }
      `}</style>

      <MapContainer
        center={centerPosition}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <FitBoundsComponent resetTrigger={resetTrigger} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <GeoJSON
          key={`geojson-${activeLayer}-${simulationMode ? 'sim' : 'real'}-${selectedBarangay?.name || 'none'}`}
          data={padreGarciaGeojson as unknown as FeatureCollection}
          style={getGeoJSONStyle}
          onEachFeature={onEachFeature}
        />

        {/* Live Cow Movement Arcs & External Destination Markers */}
        {activeLayer === 'movement' &&
          movements.map((move) => (
            <React.Fragment key={move.id}>
              {/* Arc from Origin Barangay to Destination */}
              <Polyline
                positions={[move.from, move.to]}
                pathOptions={{
                  color: move.type === 'export' ? '#dc2626' : '#2563eb',
                  weight: 3.5,
                  dashArray: '8, 8',
                  opacity: 0.75,
                }}
              >
                <Popup>
                  <div className="p-2 space-y-1 text-xs">
                    <p className="font-black text-slate-900">
                      {move.type === 'export' ? '📤 Outbound Livestock Transport' : '📥 Inbound Transport'}
                    </p>
                    <p className="font-bold text-emerald-800">
                      {move.heads} {move.species} ({move.purpose})
                    </p>
                    <p className="text-[11px] text-slate-600">
                      From: {move.origin}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      To: {move.destination}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Date: {move.date} • Shipper: {move.shipper_name}
                    </p>
                  </div>
                </Popup>
              </Polyline>

              {/* Destination Pin */}
              <CircleMarker
                center={move.to}
                radius={6}
                pathOptions={{
                  fillColor: move.type === 'export' ? '#ef4444' : '#3b82f6',
                  color: '#ffffff',
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Tooltip permanent direction="top" className="barangay-tooltip">
                  {move.destination.split(',')[0]}
                </Tooltip>
              </CircleMarker>

              {/* Origin Marker */}
              <CircleMarker
                center={move.from}
                radius={4}
                pathOptions={{
                  fillColor: '#1E4D2B',
                  color: '#ffffff',
                  fillOpacity: 1,
                  weight: 1.5,
                }}
              />
            </React.Fragment>
          ))}
      </MapContainer>
    </div>
  );
}
