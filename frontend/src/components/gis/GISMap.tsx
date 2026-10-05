'use client';

/**
 * ============================================================================
 * SmartLivestock GIS — Interactive Map Canvas (`GISMap.tsx`)
 * ============================================================================
 * 
 * ARCHITECTURAL CONCEPTS & LEARNING GUIDE (For Student Defense / Presentation):
 * ----------------------------------------------------------------------------
 * 
 * 1. WHY DYNAMIC SSR-SAFE IMPORTS (`{ ssr: false }`) ARE MANDATORY:
 *    - Next.js uses Server-Side Rendering (SSR) in the App Router.
 *    - Leaflet directly accesses browser window globals (`window`, `document`, `navigator`).
 *    - If Leaflet or `react-leaflet` is imported at the top-level during SSR, Next.js
 *      will crash with `ReferenceError: window is not defined`.
 *    - Solution: We wrap all Leaflet components in `next/dynamic(..., { ssr: false })`
 *      so they only load on the client browser after HTML hydration.
 * 
 * 2. ROOT CAUSE & SOLUTION FOR BUG A (Polygon Click & Hover Inactivity):
 *    - Root Cause 1 (Stale Closures): Leaflet attaches DOM event listeners (`mouseover`,
 *      `click`) inside `onEachFeature`. In React, if these listeners capture state from
 *      the initial render, they get trapped in a stale closure and fail to read updated state.
 *      Fix: We mirror all reactive props (`activeLayer`, `selectedBarangay`, `diseaseSubMode`)
 *      into mutable React `useRef` containers (`activeLayerRef.current = activeLayer`).
 *      When an event fires, it reads `.current`, always accessing real-time state.
 *    - Root Cause 2 (Missing Remount Trigger): When the initial GeoJSON renders with empty
 *      data before the API finishes, Leaflet caches the uncolored features.
 *      Fix: We dynamically compute `<GeoJSON key={`${activeLayer}-${viewMode}-${dataCount}`} />`.
 *      As soon as PostgreSQL telemetry loads, the key changes, forcing React to remount
 *      the GeoJSON layer with fully-colored polygons immediately on first load.
 * 
 * 3. ROOT CAUSE & SOLUTION FOR BUG B (Empty Viewport Gap Below the Map):
 *    - Root Cause: Leaflet calculates pixel dimensions when first mounted. When the browser
 *      finishes flexing the layout or when mobile address bars hide/show, Leaflet's internal
 *      canvas buffer doesn't know the container grew.
 *    - Fix: `<MapResizeHandler>` listens to `window.resize` and `orientationchange` and calls
 *      `map.invalidateSize()`. Combined with `min-h-dvh flex flex-col` in `page.tsx`, this
 *      completely eliminates blank gaps on all desktop and mobile devices.
 * 
 * 4. 2D vs. 3D VOLUMETRIC EXTRUSION:
 *    - 2D: Orthogonal top-down map view.
 *    - 3D: Tilted perspective (`rotateX(42deg) rotateZ(-10deg)`) where polygon border depth
 *      and shadow elevation (`box-shadow`, `border-bottom-width`) extrude upwards based on
 *      the concentration of the active metric (cattle head count or epidemic pressure).
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { FeatureCollection } from 'geojson';
import padreGarciaGeojson from '@/data/padre-garcia-barangays.json';
import {
  BarangayGISData,
  MapLayer,
  MovementRecord,
  SimulatedBarangayState,
  ViewMode,
  DiseaseSubMode,
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
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), {
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

// Client-only resize handler to eliminate layout gaps and handle orientation change
const MapResizeHandler = dynamic(
  () =>
    import('react-leaflet').then((m) => {
      const ResizeHandler = () => {
        const { useMap } = m;
        const map = useMap();

        useEffect(() => {
          // Immediately invalidate and after layout settles
          map.invalidateSize();
          const t1 = setTimeout(() => map.invalidateSize(), 150);
          const t2 = setTimeout(() => map.invalidateSize(), 500);

          const onResize = () => {
            map.invalidateSize();
          };

          window.addEventListener('resize', onResize);
          window.addEventListener('orientationchange', onResize);

          return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
          };
        }, [map]);

        return null;
      };
      return ResizeHandler;
    }),
  { ssr: false }
);

interface GISMapProps {
  barangaysByName: Record<string, BarangayGISData>;
  movements: MovementRecord[];
  activeLayer: MapLayer;
  viewMode: ViewMode;
  diseaseSubMode: DiseaseSubMode;
  selectedBarangay: BarangayGISData | null;
  onSelectBarangay: (b: BarangayGISData) => void;
  resetTrigger: number;
  simulatedStates?: Record<string, SimulatedBarangayState>;
  selectedLivestockType?: string;
}

export function GISMap({
  barangaysByName,
  movements,
  activeLayer,
  viewMode,
  diseaseSubMode,
  selectedBarangay,
  onSelectBarangay,
  resetTrigger,
  simulatedStates,
  selectedLivestockType = 'Cattle',
}: GISMapProps) {
  const centerPosition: [number, number] = [13.8741, 121.2529];
  const [leafletLib, setLeafletLib] = useState<any>(null);
  const [tiltAngle, setTiltAngle] = useState<number>(42);

  // Sync refs so callbacks in Leaflet layers never suffer from stale closures (Bug A fix)
  const barangaysByNameRef = useRef(barangaysByName);
  const activeLayerRef = useRef(activeLayer);
  const diseaseSubModeRef = useRef(diseaseSubMode);
  const selectedBarangayRef = useRef(selectedBarangay);
  const simulatedStatesRef = useRef(simulatedStates);
  const onSelectBarangayRef = useRef(onSelectBarangay);
  const viewModeRef = useRef(viewMode);
  const selectedLivestockTypeRef = useRef(selectedLivestockType);

  barangaysByNameRef.current = barangaysByName;
  activeLayerRef.current = activeLayer;
  diseaseSubModeRef.current = diseaseSubMode;
  selectedBarangayRef.current = selectedBarangay;
  simulatedStatesRef.current = simulatedStates;
  onSelectBarangayRef.current = onSelectBarangay;
  viewModeRef.current = viewMode;
  selectedLivestockTypeRef.current = selectedLivestockType;

  const getLivestockHeads = (data: BarangayGISData, type?: string): number => {
    if (!data) return 0;
    if (!type || type.toLowerCase() === 'cattle') return data.cattle;
    if (type.toUpperCase() === 'ALL') return data.total_livestock;
    const match = data.species_breakdown?.find(
      (s) => s.species.toLowerCase() === type.toLowerCase()
    );
    return match?.heads || 0;
  };

  // Lazy load leaflet instance on client for divIcons
  useEffect(() => {
    import('leaflet').then((L) => setLeafletLib(L));
  }, []);

  // Calculate 3D column extrusion height (pixels) based on active metric
  const getExtrusionHeight = (bName: string): number => {
    const data = barangaysByName[bName];
    if (!data) return 4;

    if (activeLayer === 'cattle') {
      const heads = getLivestockHeads(data, selectedLivestockTypeRef.current);
      return Math.min(48, Math.max(4, Math.round(heads * 1.15)));
    }
    if (activeLayer === 'disease') {
      if (diseaseSubMode === 'simulation' && simulatedStates?.[bName]) {
        const pressure = simulatedStates[bName].transmissionPressure;
        return Math.min(52, Math.max(6, Math.round(pressure * 46) + 4));
      }
      return Math.min(50, Math.max(4, data.active_cases * 16 + (data.disease_cases > 0 ? 8 : 4)));
    }
    if (activeLayer === 'milk') {
      if (data.milk <= 0) return 4;
      return Math.min(48, Math.max(6, Math.round(Math.log10(data.milk + 1) * 10)));
    }
    if (activeLayer === 'meat') {
      return data.meat > 0 ? Math.min(45, Math.max(6, Math.round(data.meat * 0.15))) : 4;
    }
    if (activeLayer === 'movement') {
      return data.movement_out > 0 ? Math.min(45, Math.max(6, data.movement_out * 4)) : 4;
    }
    return 6;
  };

  // Thematic Choropleth Fill Colors
  const getCattleColor = (cattle: number): string => {
    if (cattle > 35) return '#1a3d15';
    if (cattle > 25) return '#2D5A27';
    if (cattle > 15) return '#5A8F4F';
    if (cattle > 5) return '#8AB877';
    if (cattle > 0) return '#C5E0A8';
    return '#EAF3E4';
  };

  const getPressureColor = (pressure: number): string => {
    if (pressure >= 0.70) return '#991b1b'; // Critical
    if (pressure >= 0.40) return '#ea580c'; // High
    if (pressure >= 0.20) return '#f59e0b'; // Moderate
    return '#10b981'; // Low baseline
  };

  const getDiseaseColor = (
    bName: string,
    risk: 'low' | 'medium' | 'high'
  ): string => {
    if (diseaseSubMode === 'simulation' && simulatedStates?.[bName]) {
      return getPressureColor(simulatedStates[bName].transmissionPressure);
    }
    if (diseaseSubMode === 'trend') {
      const data = barangaysByName[bName];
      // Surveillance Trend classification:
      // - Active confirmed cases -> Purple (Elevated Activity)
      // - Historical reported cases -> Blue (Reported Activity)
      // - Zero records -> Green (No Reported Activity)
      if (data?.active_cases > 0) return '#9333ea';
      if (data?.disease_cases > 0) return '#0284c7';
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
        return getCattleColor(getLivestockHeads(data, selectedLivestockTypeRef.current));
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
      // Baseline placeholder styling before API response resolves
      return {
        fillColor: '#C5E0A8',
        color: '#2D5A27',
        weight: 1.5,
        fillOpacity: 0.6,
      };
    }

    const extrusion = viewMode === '3D' ? getExtrusionHeight(name) : 0;

    return {
      fillColor: getLayerColor(data),
      fillOpacity: isSelected ? 0.95 : viewMode === '3D' ? 0.85 : 0.75,
      color: isSelected ? '#ffffff' : viewMode === '3D' ? '#0f290f' : '#1e3a1e',
      weight: isSelected ? 3.5 : viewMode === '3D' ? 2.5 : 1.8,
      className: viewMode === '3D' ? `extruded-polygon-h${Math.min(48, Math.round(extrusion / 8) * 8)}` : '',
    };
  };

  const buildTooltipText = (name: string): string => {
    const data = barangaysByNameRef.current[name];
    const layer = activeLayerRef.current;
    const subMode = diseaseSubModeRef.current;
    const simState = simulatedStatesRef.current?.[name];

    if (!data) {
      return `<strong>Brgy. ${name}</strong><br/><span style="font-size: 10px; opacity: 0.8">Padre Garcia</span>`;
    }

    const lType = selectedLivestockTypeRef.current;
    const lHeads = getLivestockHeads(data, lType);
    let tooltipMetric =
      !lType || lType.toLowerCase() === 'cattle'
        ? `${lHeads} cattle`
        : lType.toUpperCase() === 'ALL'
        ? `${lHeads} total livestock`
        : `${lHeads} ${lType.toLowerCase()}`;
    if (layer === 'disease') {
      if (subMode === 'simulation' && simState) {
        tooltipMetric = `Pressure: ${(simState.transmissionPressure * 100).toFixed(0)}% • ${simState.cases} cases (${simState.risk.toUpperCase()})`;
      } else if (subMode === 'trend') {
        const trendStatus =
          data.active_cases > 0
            ? 'ELEVATED ACTIVITY'
            : data.disease_cases > 0
            ? 'REPORTED ACTIVITY'
            : 'NO REPORTED ACTIVITY';
        tooltipMetric = `Surveillance: ${trendStatus} (${data.active_cases} active, ${data.disease_cases} total)`;
      } else {
        tooltipMetric = `${data.active_cases} active cases (${data.disease_risk.toUpperCase()})`;
      }
    } else if (layer === 'milk') {
      tooltipMetric = `${data.milk.toLocaleString()} L milk`;
    } else if (layer === 'meat') {
      tooltipMetric = data.meat > 0 ? `${data.meat} kg meat` : 'No slaughter data';
    } else if (layer === 'movement') {
      tooltipMetric = `${data.movement_out} heads moved`;
    }

    return `<strong>${name}</strong><br/><span style="font-size: 10px; opacity: 0.9">${tooltipMetric}</span>`;
  };

  // Bug A Fix: Attach hover and click listeners immediately on mount regardless of telemetry readiness.
  // Dynamic reads through refs ensure latest data is always accessible.
  const onEachFeature = (feature: any, layer: any) => {
    const name = feature.properties?.name;
    if (!name) return;

    layer.bindTooltip(buildTooltipText(name), {
      permanent: false,
      direction: 'center',
      className: 'barangay-hover-tooltip',
    });

    layer.on({
      mouseover: (e: any) => {
        // Dynamically update tooltip content on hover
        layer.setTooltipContent(buildTooltipText(name));
        e.target.setStyle({
          weight: 3.5,
          fillOpacity: 0.95,
          color: '#ffffff',
        });
        e.target.bringToFront();
      },
      mouseout: (e: any) => {
        e.target.setStyle(getGeoJSONStyle(feature));
      },
      click: () => {
        const data = barangaysByNameRef.current[name];
        if (data) {
          onSelectBarangayRef.current(data);
        } else {
          // Fallback baseline object if clicked before API responds
          onSelectBarangayRef.current({
            name,
            db_name: name,
            barangay_id: null,
            position: [13.8741, 121.2529],
            cattle: 0,
            total_livestock: 0,
            species_breakdown: [],
            farmers_count: 0,
            batches_count: 0,
            disease_cases: 0,
            active_cases: 0,
            affected_heads: 0,
            disease_risk: 'low',
            recent_diseases: [],
            milk: 0,
            meat: 0,
            slaughter_heads: 0,
            mortality: 0,
            mortality_causes: [],
            movement_out: 0,
            movement_in: 0,
            inspections_count: 0,
          });
        }
      },
    });
  };

  // Permanent Centroid Labels for all 18 barangays (responsive for mobile)
  const permanentLabels = useMemo(() => {
    if (!leafletLib) return [];
    const sourceMap =
      Object.keys(barangaysByName).length > 0
        ? barangaysByName
        : (padreGarciaGeojson.features.reduce((acc, f) => {
            const n = f.properties.name;
            acc[n] = {
              name: n,
              db_name: n,
              barangay_id: null,
              position: [13.8741, 121.2529],
              cattle: 0,
              total_livestock: 0,
              species_breakdown: [],
              farmers_count: 0,
              batches_count: 0,
              disease_cases: 0,
              active_cases: 0,
              affected_heads: 0,
              disease_risk: 'low',
              recent_diseases: [],
              milk: 0,
              meat: 0,
              slaughter_heads: 0,
              mortality: 0,
              mortality_causes: [],
              movement_out: 0,
              movement_in: 0,
              inspections_count: 0,
            };
            return acc;
          }, {} as Record<string, BarangayGISData>));

    return Object.values(sourceMap).map((b) => {
      const lHeads = getLivestockHeads(b, selectedLivestockType);
      const lIcon =
        selectedLivestockType?.toLowerCase() === 'sheep'
          ? '🐑'
          : selectedLivestockType?.toLowerCase() === 'swine'
          ? '🐖'
          : selectedLivestockType?.toLowerCase() === 'goat'
          ? '🐐'
          : selectedLivestockType === 'ALL'
          ? '🐾'
          : '🐄';
      let statText = `${lHeads}${lIcon}`;
      if (activeLayer === 'disease') {
        if (diseaseSubMode === 'simulation' && simulatedStates?.[b.name]) {
          statText = `⚡${(simulatedStates[b.name].transmissionPressure * 100).toFixed(0)}%`;
        } else {
          statText = b.active_cases > 0 ? `⚠️${b.active_cases}` : '✅';
        }
      } else if (activeLayer === 'milk') {
        statText = b.milk > 0 ? `${(b.milk / 1000).toFixed(1)}k🥛` : '0🥛';
      } else if (activeLayer === 'meat') {
        statText = b.meat > 0 ? `${b.meat}🥩` : '—';
      } else if (activeLayer === 'movement') {
        statText = b.movement_out > 0 ? `${b.movement_out}🚛` : '—';
      }

      const h = viewMode === '3D' ? getExtrusionHeight(b.name) : 0;

      const customIcon = leafletLib.divIcon({
        className: 'permanent-centroid-label-container',
        html: `
          <div class="permanent-centroid-pill" style="transform: translateY(-${h}px)">
            <span class="pill-name">${b.name}</span>
            <span class="pill-stat">${statText}</span>
          </div>
        `,
        iconSize: [68, 24],
        iconAnchor: [34, 12],
      });

      return {
        name: b.name,
        position: b.position,
        icon: customIcon,
      };
    });
  }, [leafletLib, barangaysByName, activeLayer, diseaseSubMode, simulatedStates, viewMode]);

  const dataCount = Object.keys(barangaysByName).length;

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      <style>{`
        /* Hover tooltip */
        .barangay-hover-tooltip {
          background: rgba(15, 41, 15, 0.95) !important;
          border: 1px solid rgba(74, 222, 128, 0.4) !important;
          border-radius: 8px !important;
          color: white !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          padding: 4px 8px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
          text-align: center !important;
          pointer-events: none !important;
        }
        .barangay-hover-tooltip::before { display: none !important; }

        /* Permanent Centroid Labels */
        .permanent-centroid-label-container {
          background: transparent !important;
          border: none !important;
          pointer-events: none !important;
        }
        .permanent-centroid-pill {
          pointer-events: none !important;
          background: rgba(10, 26, 12, 0.88);
          border: 1px solid rgba(134, 239, 172, 0.45);
          backdrop-filter: blur(4px);
          border-radius: 6px;
          padding: 1.5px 5px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.45);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .permanent-centroid-pill .pill-name {
          font-size: 9px;
          font-weight: 900;
          color: #ffffff;
          line-height: 1.1;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .permanent-centroid-pill .pill-stat {
          font-size: 7.5px;
          font-weight: 800;
          color: #86efac;
          line-height: 1;
        }

        @media (max-width: 640px) {
          .permanent-centroid-pill {
            padding: 1px 3px;
          }
          .permanent-centroid-pill .pill-name {
            font-size: 7.5px;
          }
          .permanent-centroid-pill .pill-stat {
            font-size: 6.5px;
          }
        }

        /* 3D Extruded Polygon Drop Shadows & Volumetric Depth */
        .extruded-polygon-h48 { filter: drop-shadow(0px 24px 8px rgba(0,0,0,0.55)); }
        .extruded-polygon-h40 { filter: drop-shadow(0px 20px 7px rgba(0,0,0,0.50)); }
        .extruded-polygon-h32 { filter: drop-shadow(0px 16px 6px rgba(0,0,0,0.45)); }
        .extruded-polygon-h24 { filter: drop-shadow(0px 12px 5px rgba(0,0,0,0.40)); }
        .extruded-polygon-h16 { filter: drop-shadow(0px 8px 4px rgba(0,0,0,0.35)); }
        .extruded-polygon-h8  { filter: drop-shadow(0px 4px 3px rgba(0,0,0,0.30)); }
        .extruded-polygon-h0  { filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.20)); }

        .leaflet-container {
          background-color: #0b1710 !important;
          font-family: inherit !important;
          height: 100% !important;
          width: 100% !important;
        }
      `}</style>

      {/* 2D / 3D Perspective Transformation Wrapper */}
      <div
        className="w-full h-full transition-transform duration-700 ease-out origin-center"
        style={
          viewMode === '3D'
            ? {
                perspective: '1200px',
                transform: `rotateX(${tiltAngle}deg) rotateZ(-10deg) scale(1.08)`,
                transformStyle: 'preserve-3d',
              }
            : {
                transform: 'none',
              }
        }
      >
        <MapContainer
          center={centerPosition}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <FitBoundsComponent resetTrigger={resetTrigger} />
          <MapResizeHandler />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Choropleth Polygon Boundaries: Key includes dataCount so layer remounts immediately when data arrives */}
          <GeoJSON
            key={`geojson-${activeLayer}-${selectedLivestockType || 'all'}-${diseaseSubMode}-${viewMode}-${selectedBarangay?.name || 'none'}-${dataCount}`}
            data={padreGarciaGeojson as unknown as FeatureCollection}
            style={getGeoJSONStyle}
            onEachFeature={onEachFeature}
          />

          {/* Permanent Centroid Labels for all 18 Barangays */}
          {permanentLabels.map((lbl) => (
            <Marker
              key={`label-${lbl.name}`}
              position={lbl.position}
              icon={lbl.icon}
              interactive={false}
            />
          ))}

          {/* Movement Layer Polyline Arcs & External Destination Pins */}
          {activeLayer === 'movement' &&
            movements.map((move) => (
              <React.Fragment key={move.id}>
                <Polyline
                  positions={[move.from, move.to]}
                  pathOptions={{
                    color: move.type === 'export' ? '#dc2626' : '#2563eb',
                    weight: 3.5,
                    dashArray: '8, 8',
                    opacity: 0.8,
                  }}
                >
                  <Popup>
                    <div className="p-2 space-y-1 text-xs">
                      <p className="font-black text-slate-900">
                        {move.type === 'export'
                          ? '📤 Outbound Livestock Transport'
                          : '📥 Inbound Transport'}
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
                  <Tooltip permanent direction="top" className="barangay-hover-tooltip">
                    {move.destination.split(',')[0]}
                  </Tooltip>
                </CircleMarker>

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

      {/* 3D Tilt Angle Adjustment Widget (when in 3D Mode) */}
      {viewMode === '3D' && (
        <div className="absolute top-20 right-4 z-[900] bg-white/95 backdrop-blur-md p-2 rounded-xl border border-slate-200 shadow-xl flex items-center gap-2 pointer-events-auto">
          <span className="text-[10px] font-black uppercase text-emerald-950">
            Tilt: {tiltAngle}°
          </span>
          <input
            type="range"
            min={25}
            max={55}
            value={tiltAngle}
            onChange={(e) => setTiltAngle(Number(e.target.value))}
            className="w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
          />
        </div>
      )}
    </div>
  );
}
