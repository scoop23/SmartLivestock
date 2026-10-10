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
 * 4. 2D vs. 3D MAP RENDERING:
 *    - 2D: Leaflet renders the interactive choropleth and movement overlays.
 *    - 3D: Giro3D converts the same barangay GeoJSON polygons into extruded meshes; their
 *      heights and colors represent the currently selected GIS metric.
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { FeatureCollection } from 'geojson';
import padreGarciaGeojson from '@/data/padre-garcia-barangays.json';
import { Giro3DBarangayView } from './Giro3DBarangayView';
import {
  BarangayGISData,
  MapLayer,
  MovementRecord,
  SimulatedBarangayState,
  ViewMode,
  DiseaseSubMode,
  GISUserScope,
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

import { useMap } from 'react-leaflet';

interface FitBoundsProps {
  resetTrigger: number;
  userScope?: GISUserScope;
  selectedBarangay?: BarangayGISData | null;
}

// Client component to control Leaflet camera bounds dynamically
function FitBounds({ resetTrigger, userScope, selectedBarangay }: FitBoundsProps) {
  const map = useMap();
  const previousResetTrigger = useRef(resetTrigger);

  useEffect(() => {
    import('leaflet').then((L) => {
      const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 640;
      const defaultPadding: [number, number] = isSmallScreen ? [12, 12] : [24, 24];
      const resetRequested = resetTrigger !== previousResetTrigger.current;
      previousResetTrigger.current = resetTrigger;

      // Focus the selected barangay for every role. Restricted users start on their
      // assigned barangay; unrestricted users focus the polygon they clicked.
      const isRestricted = userScope && !userScope.can_view_all_barangays && userScope.allowed_barangays?.length === 1;
      const targetBName = isRestricted ? userScope.allowed_barangays[0] : (selectedBarangay?.name ?? null);

      if (targetBName && !resetRequested) {
        const feature = (padreGarciaGeojson as any).features?.find(
          (f: any) => f.properties?.name?.toLowerCase() === targetBName.toLowerCase()
        );
        if (feature) {
          const featureLayer = L.geoJSON(feature);
          const fBounds = featureLayer.getBounds();
          if (fBounds.isValid()) {
            map.fitBounds(fBounds, { padding: isSmallScreen ? [24, 24] : [48, 48], maxZoom: 15 });
            return;
          }
        }
      }

      // Default: fit municipal boundary of Padre Garcia
      const geoJsonLayer = L.geoJSON(padreGarciaGeojson as any);
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: defaultPadding });
      }
    });
  }, [map, resetTrigger, userScope, selectedBarangay]);

  return null;
}

// Client resize handler with ResizeObserver to eliminate layout gaps and handle orientation change
function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);

    const onResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    let resizeObserver: ResizeObserver | null = null;
    try {
      const container = map.getContainer();
      if (container && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize();
        });
        resizeObserver.observe(container);
      }
    } catch {
      // ignore
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [map]);

  return null;
}

// Calculate a subtle curved arc between origin and destination to prevent overlapping routes
function computeCurvedArc(
  from: [number, number],
  to: [number, number],
  offsetMultiplier = 0.12,
  numPoints = 12
): [number, number][] {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;

  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);

  if (dist === 0) return [from, to];

  const normLat = -dLng / dist;
  const normLng = dLat / dist;

  const offset = Math.min(dist * offsetMultiplier, 0.05);

  const ctrlLat = midLat + normLat * offset;
  const ctrlLng = midLng + normLng * offset;

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const inv = 1 - t;
    const pLat = inv * inv * lat1 + 2 * inv * t * ctrlLat + t * t * lat2;
    const pLng = inv * inv * lng1 + 2 * inv * t * ctrlLng + t * t * lng2;
    points.push([pLat, pLng]);
  }
  return points;
}

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
  userScope?: GISUserScope;
  selectedMovement?: MovementRecord | null;
  onSelectMovement?: (m: MovementRecord | null) => void;
  showMovementOverlay?: boolean;
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
  userScope,
  selectedMovement,
  onSelectMovement,
  showMovementOverlay = false,
}: GISMapProps) {
  const centerPosition: [number, number] = [13.8741, 121.2529];
  const [leafletLib, setLeafletLib] = useState<any>(null);
  const [heightScale, setHeightScale] = useState<number>(1);
  const [heightScaleDraft, setHeightScaleDraft] = useState<number>(1);
  const mapRootRef = useRef<HTMLDivElement>(null);
  // Shared by the Leaflet and Giro3D click handlers so both modes treat drags the same way.
  const suppressClickUntilRef = useRef(0);

  // Sync refs so callbacks in Leaflet layers never suffer from stale closures (Bug A fix)
  const barangaysByNameRef = useRef(barangaysByName);
  const activeLayerRef = useRef(activeLayer);
  const diseaseSubModeRef = useRef(diseaseSubMode);
  const selectedBarangayRef = useRef(selectedBarangay);
  const simulatedStatesRef = useRef(simulatedStates);
  const onSelectBarangayRef = useRef(onSelectBarangay);
  const viewModeRef = useRef(viewMode);
  const selectedLivestockTypeRef = useRef(selectedLivestockType);
  const userScopeRef = useRef(userScope);

  barangaysByNameRef.current = barangaysByName;
  activeLayerRef.current = activeLayer;
  diseaseSubModeRef.current = diseaseSubMode;
  selectedBarangayRef.current = selectedBarangay;
  simulatedStatesRef.current = simulatedStates;
  onSelectBarangayRef.current = onSelectBarangay;
  viewModeRef.current = viewMode;
  selectedLivestockTypeRef.current = selectedLivestockType;
  userScopeRef.current = userScope;

  useEffect(() => {
    const root = mapRootRef.current;
    if (!root) return;

    // Remember where a map gesture began. A small movement is still a click; a larger one is a pan.
    let activePointer: { id: number; x: number; y: number; dragged: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.leaflet-container, canvas')) return;
      activePointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!activePointer || activePointer.id !== event.pointerId) return;
      // Ignore tiny hand jitter, but classify movement over 6 screen pixels as dragging.
      if (Math.hypot(event.clientX - activePointer.x, event.clientY - activePointer.y) > 6) {
        activePointer.dragged = true;
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!activePointer || activePointer.id !== event.pointerId) return;
      // Browsers emit click after pointerup, so keep a short suppression window for that follow-up event.
      if (activePointer.dragged) suppressClickUntilRef.current = performance.now() + 400;
      activePointer = null;
    };
    const onPointerCancel = () => {
      activePointer = null;
    };

    root.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
    return () => {
      root.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
    };
  }, []);

  const getLivestockHeads = (data: BarangayGISData, type?: string): number => {
    if (!data) return 0;
    if (!type || type.toLowerCase() === 'cattle') return data.cattle;
    if (type.toUpperCase() === 'ALL') return data.total_livestock;
    const match = data.species_breakdown?.find(
      (s) => s.species.toLowerCase() === type.toLowerCase()
    );
    return match?.heads || 0;
  };

  /**
   * Resolves recorded deaths for the selected livestock filter.
   * If 'ALL', returns total municipal recorded mortality for that barangay.
   * If a specific species (e.g. 'Cattle'), checks mortality_by_species.
   */
  const getMortalityDeaths = (data: BarangayGISData, type?: string): number => {
    if (!data) return 0;
    if (type?.toUpperCase() === 'ALL') return data.mortality;
    if (data.mortality_by_species && data.mortality_by_species.length > 0) {
      const targetSpecies = (!type || type.toLowerCase() === 'cattle') ? 'cattle' : type.toLowerCase();
      const match = data.mortality_by_species.find(
        (s) => s.species.toLowerCase() === targetSpecies
      );
      if (match) return match.heads;
      return 0;
    }
    // Fallback: Default all existing recorded mortality to Cattle focus if species breakdown is not yet split
    if (!type || type.toLowerCase() === 'cattle') return data.mortality;
    return 0;
  };

  // Lazy load leaflet instance on client for divIcons
  useEffect(() => {
    import('leaflet').then((L) => setLeafletLib(L));
  }, []);

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

  const getFarmerMeatColor = (meat: number): string => {
    if (meat > 500) return '#9a3412';
    if (meat > 100) return '#c2410c';
    if (meat > 0) return '#fb923c';
    return '#fff7ed';
  };

  const getSlaughterYieldColor = (yieldVal: number): string => {
    if (yieldVal > 500) return '#7c1d00';
    if (yieldVal > 100) return '#dc2626';
    if (yieldVal > 0) return '#f87171';
    return '#fecaca';
  };

  /**
   * Thematic Mortality Choropleth Fill Colors (Slate / Charcoal Palette)
   * Visually distinct from green cattle, traffic-light disease, and blue dairy.
   */
  const getMortalityColor = (deaths: number): string => {
    if (deaths >= 6) return '#0f172a'; // High mortality (slate-900 / dark charcoal)
    if (deaths >= 3) return '#475569'; // Moderate mortality (slate-600)
    if (deaths >= 1) return '#94a3b8'; // Low mortality (slate-400)
    return '#f8fafc'; // No recorded deaths (slate-50 clean background)
  };

  const getLayerColor = (data: BarangayGISData): string => {
    switch (activeLayer) {
      case 'cattle':
        return getCattleColor(getLivestockHeads(data, selectedLivestockTypeRef.current));
      case 'disease':
        return getDiseaseColor(data.name, data.disease_risk);
      case 'milk':
        return getMilkColor(data.milk);
      case 'farmer_meat':
        return getFarmerMeatColor(data.farmer_meat || 0);
      case 'slaughter_yield':
      case 'meat':
        return getSlaughterYieldColor(data.slaughter_yield ?? data.meat ?? 0);
      case 'mortality':
        return getMortalityColor(getMortalityDeaths(data, selectedLivestockTypeRef.current));
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
    const scope = userScopeRef.current;
    const isInScope = data?.is_in_scope ?? (!scope || scope.can_view_all_barangays || scope.allowed_barangays.includes(name));

    if (!data) {
      // Baseline placeholder styling before API response resolves
      return {
        fillColor: '#C5E0A8',
        color: '#2D5A27',
        weight: 1.5,
        fillOpacity: 0.6,
      };
    }

    const isFarmerRole = scope?.role === 'FARMER';

    // Out-of-scope barangays:
    if (!isInScope) {
      if (isFarmerRole) {
        // Farmers only see their own registered barangay; other areas are faint background
        return {
          fillColor: '#0f172a',
          fillOpacity: 0.10,
          color: '#1e293b',
          weight: 0.75,
          className: 'farmer-out-of-scope-polygon',
        };
      }
      return {
        fillColor: '#1e293b',
        fillOpacity: 0.25,
        color: '#475569',
        weight: 1.0,
        dashArray: '4, 4',
        className: 'out-of-scope-barangay',
      };
    }

    const isMortality = activeLayer === 'mortality';

    return {
      fillColor: getLayerColor(data),
      fillOpacity: isSelected ? 0.95 : viewMode === '3D' ? 0.85 : isMortality ? 0.82 : 0.80,
      color: isSelected ? '#ffffff' : isFarmerRole ? '#4ade80' : isMortality ? '#334155' : viewMode === '3D' ? '#0f290f' : '#1e3a1e',
      weight: isSelected ? 3.5 : isFarmerRole ? 3.0 : isMortality ? 2.0 : viewMode === '3D' ? 2.5 : 1.8,
      className: isFarmerRole ? 'farmer-own-barangay' : '',
    };
  };

  const buildTooltipText = (name: string): string => {
    const data = barangaysByNameRef.current[name];
    const layer = activeLayerRef.current;
    const subMode = diseaseSubModeRef.current;
    const simState = simulatedStatesRef.current?.[name];
    const scope = userScopeRef.current;
    const isInScope = data?.is_in_scope ?? (!scope || scope.can_view_all_barangays || scope.allowed_barangays.includes(name));

    if (!isInScope) {
      return `<strong>Brgy. ${name}</strong><br/><span style="font-size: 10px; opacity: 0.7">Outside your assigned jurisdiction</span>`;
    }

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
    } else if (layer === 'farmer_meat') {
      const fMeat = data.farmer_meat ?? 0;
      tooltipMetric = fMeat > 0 ? `${fMeat.toLocaleString()} kg farm meat` : 'No farm meat reported';
    } else if (layer === 'slaughter_yield' || layer === 'meat') {
      const sYield = data.slaughter_yield ?? data.meat ?? 0;
      const sHeads = data.slaughter_heads ?? 0;
      tooltipMetric = sYield > 0
        ? `${sYield.toLocaleString()} kg carcass yield (${sHeads} heads)`
        : 'No slaughter data';
    } else if (layer === 'mortality') {
      const deaths = getMortalityDeaths(data, lType);
      const typeLabel = !lType || lType.toLowerCase() === 'cattle' ? 'Cattle' : lType === 'ALL' ? 'Livestock' : lType;
      const causes = data.mortality_causes && data.mortality_causes.length > 0
        ? `Causes: ${data.mortality_causes.slice(0, 2).join(', ')}`
        : 'No specific causes flagged';
      tooltipMetric = deaths > 0
        ? `Recorded Mortality: ${deaths} ${typeLabel} deaths<br/><span style="font-size: 9.5px; opacity: 0.85">${causes}</span>`
        : `No recorded ${typeLabel.toLowerCase()} deaths`;
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

    const data = barangaysByNameRef.current[name];
    const scope = userScopeRef.current;
    const isInScope = data?.is_in_scope ?? (!scope || scope.can_view_all_barangays || scope.allowed_barangays.includes(name));

    // FARMER DATA ISOLATION: Farmers only interact with their own registered barangay
    if (scope?.role === 'FARMER' && !isInScope) {
      return;
    }

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
        const curData = barangaysByNameRef.current[name];
        const curScope = userScopeRef.current;
        const curInScope = curData?.is_in_scope ?? (!curScope || curScope.can_view_all_barangays || curScope.allowed_barangays.includes(name));

        // If user is restricted to own/assigned barangays, ignore clicks on out-of-scope polygons
        if (!curInScope) {
          return;
        }

        // Leaflet still reports a click after some drag gestures; skip selection during the guard window.
        if (performance.now() < suppressClickUntilRef.current) return;

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
            farmer_meat: 0,
            slaughter_yield: 0,
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
              farmer_meat: 0,
              slaughter_yield: 0,
              slaughter_heads: 0,
              mortality: 0,
              mortality_causes: [],
              movement_out: 0,
              movement_in: 0,
              inspections_count: 0,
            };
            return acc;
          }, {} as Record<string, BarangayGISData>));

    const isFarmerRole = userScopeRef.current?.role === 'FARMER';
    const farmerAllowed = userScopeRef.current?.allowed_barangays || [];
    const rawList = Object.values(sourceMap);

    // FARMER DATA ISOLATION: Farmers only see their own registered barangay!
    const targetList = isFarmerRole
      ? rawList.filter((b) => b.is_in_scope || farmerAllowed.includes(b.name))
      : rawList;

    return targetList.map((b) => {
      const scope = userScopeRef.current;
      const isInScope = b.is_in_scope ?? (!scope || scope.can_view_all_barangays || scope.allowed_barangays.includes(b.name));

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
      let statText = isInScope ? `${lHeads}${lIcon}` : '—';
      if (!isInScope) {
        statText = '—';
      } else if (activeLayer === 'disease') {
        if (diseaseSubMode === 'simulation' && simulatedStates?.[b.name]) {
          statText = `⚡${(simulatedStates[b.name].transmissionPressure * 100).toFixed(0)}%`;
        } else {
          statText = b.active_cases > 0 ? `⚠️${b.active_cases}` : '✅';
        }
      } else if (activeLayer === 'milk') {
        statText = b.milk > 0 ? `${(b.milk / 1000).toFixed(1)}k🥛` : '0🥛';
      } else if (activeLayer === 'farmer_meat') {
        const fm = b.farmer_meat ?? 0;
        statText = fm > 0 ? `${fm >= 1000 ? (fm / 1000).toFixed(1) + 'k' : fm}🥩` : '—';
      } else if (activeLayer === 'slaughter_yield' || activeLayer === 'meat') {
        const sy = b.slaughter_yield ?? b.meat ?? 0;
        statText = sy > 0 ? `${sy >= 1000 ? (sy / 1000).toFixed(1) + 'k' : sy}🔪` : '—';
      } else if (activeLayer === 'mortality') {
        const deaths = getMortalityDeaths(b, selectedLivestockType);
        statText = deaths > 0 ? `${deaths}☠️` : '0☠️';
      } else if (activeLayer === 'movement') {
        statText = b.movement_out > 0 ? `${b.movement_out}🚛` : '—';
      }

      const isGeographicallyRestricted = Boolean(scope && !scope.can_view_all_barangays);
      const isHighlightedScope = isGeographicallyRestricted && isInScope;
      const isSubtleOut = isGeographicallyRestricted && !isInScope;

      const pillClass = isHighlightedScope
        ? 'permanent-centroid-pill highlight-own-farm'
        : isSubtleOut
        ? 'permanent-centroid-pill subtle-out-of-scope'
        : 'permanent-centroid-pill';

      const pillContent = isSubtleOut
        ? `<span class="pill-name text-slate-400 font-bold">${b.name}</span>`
        : `
          <span class="pill-name">${isHighlightedScope ? `★ ${b.name}` : b.name}</span>
          <span class="pill-stat">${statText}</span>
        `;

      const customIcon = leafletLib.divIcon({
        className: 'permanent-centroid-label-container',
        html: `
          <div class="${pillClass}">
            ${pillContent}
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
  }, [leafletLib, barangaysByName, activeLayer, diseaseSubMode, simulatedStates, viewMode, selectedLivestockType]);

  const dataCount = Object.keys(barangaysByName).length;

  return (
    <div ref={mapRootRef} className="relative w-full h-full min-h-[380px] overflow-hidden bg-slate-900">
      <style>{`
        /* Hover tooltip */
        .barangay-hover-tooltip {
          background: rgba(15, 23, 42, 0.95) !important;
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
          background: rgba(15, 23, 42, 0.88);
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
        .permanent-centroid-pill.highlight-own-farm {
          background: rgba(6, 78, 59, 0.95) !important;
          border: 1.5px solid rgba(74, 222, 128, 0.9) !important;
          box-shadow: 0 0 14px rgba(74, 222, 128, 0.45) !important;
        }
        .permanent-centroid-pill.subtle-out-of-scope {
          background: rgba(15, 23, 42, 0.70) !important;
          border: 1px dashed rgba(148, 163, 184, 0.35) !important;
          opacity: 0.8;
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

        /* Movement Directional Arrow Badges & Arcs */
        .movement-direction-arrow-container {
          background: transparent !important;
          border: none !important;
        }
        .movement-arrow-badge {
          color: white;
          font-size: 10px;
          font-weight: 900;
          padding: 1.5px 5.5px;
          border-radius: 9999px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          border: 1.5px solid white;
          white-space: nowrap;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
        }
        .movement-arrow-badge:hover, .movement-arrow-badge.is-selected {
          transform: scale(1.18);
          box-shadow: 0 0 14px rgba(56, 189, 248, 0.9);
          border-color: #38bdf8;
        }

        .leaflet-container {
          background-color: #0f172a !important;
          font-family: inherit !important;
          height: 100% !important;
          width: 100% !important;
          min-height: 380px !important;
        }
      `}</style>

      {viewMode === '3D' ? (
        <Giro3DBarangayView
          barangaysByName={barangaysByName}
          activeLayer={activeLayer}
          diseaseSubMode={diseaseSubMode}
          selectedBarangay={selectedBarangay}
          onSelectBarangay={onSelectBarangay}
          resetTrigger={resetTrigger}
          simulatedStates={simulatedStates}
          selectedLivestockType={selectedLivestockType}
          userScope={userScope}
          heightScale={heightScale}
          suppressClickUntilRef={suppressClickUntilRef}
        />
      ) : (
      <div className="w-full h-full">
        <MapContainer
          center={centerPosition}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <FitBounds resetTrigger={resetTrigger} userScope={userScope} selectedBarangay={selectedBarangay} />
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
          {(activeLayer === 'movement' || showMovementOverlay) &&
            movements.map((move, moveIdx) => {
              const isSelected = selectedMovement?.id === move.id;
              const isApproved = move.clearance_status?.toUpperCase() === 'APPROVED';
              const arcOffset = 0.10 + ((moveIdx % 3) * 0.05);
              const arcPositions = computeCurvedArc(move.from, move.to, arcOffset);
              const midPoint = arcPositions[Math.floor(arcPositions.length / 2)];

              const pathColor = isSelected
                ? '#38bdf8'
                : isApproved
                ? move.direction === 'INBOUND'
                  ? '#2563eb'
                  : move.direction === 'INTERNAL'
                  ? '#10b981'
                  : '#ef4444'
                : '#f59e0b';

              const arrowIcon = leafletLib
                ? leafletLib.divIcon({
                    className: 'movement-direction-arrow-container',
                    html: `
                      <div class="movement-arrow-badge ${isSelected ? 'is-selected' : ''}" style="background-color: ${pathColor};">
                        <span>${move.direction === 'INBOUND' ? '📥' : move.direction === 'INTERNAL' ? '🔄' : '📤'} ${move.heads}</span>
                      </div>
                    `,
                    iconSize: [46, 20],
                    iconAnchor: [23, 10],
                  })
                : null;

              return (
                <React.Fragment key={`move-${move.id}-${moveIdx}`}>
                  {/* Curved Path */}
                  <Polyline
                    positions={arcPositions}
                    pathOptions={{
                      color: pathColor,
                      weight: isSelected ? 5.5 : 3.5,
                      dashArray: isApproved ? '7, 7' : '3, 6',
                      opacity: isSelected ? 1 : 0.85,
                    }}
                    eventHandlers={{
                      click: () => {
                        onSelectMovement?.(move);
                      },
                    }}
                  >
                    <Popup>
                      <div className="p-2 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
                          <p className="font-black text-slate-900">
                            {move.direction === 'INBOUND'
                              ? '📥 Inbound Transport'
                              : move.direction === 'INTERNAL'
                              ? '🔄 Local Intra-Municipal'
                              : '📤 Outbound Transport'}
                          </p>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {move.clearance_status || 'RECORDED'}
                          </span>
                        </div>
                        <p className="font-bold text-emerald-800">
                          {move.heads} {move.species} ({move.purpose})
                        </p>
                        <p className="text-[11px] text-slate-600">
                          From: <strong>{move.origin}</strong>
                        </p>
                        <p className="text-[11px] text-slate-600">
                          To: <strong>{move.destination}</strong>
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Date: {move.date} • Permit: {move.control_number || `#${move.id}`}
                        </p>
                        <button
                          type="button"
                          onClick={() => onSelectMovement?.(move)}
                          className="w-full mt-1 bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          View Full Permit Details →
                        </button>
                      </div>
                    </Popup>
                  </Polyline>

                  {/* Midpoint Directional Badge Marker */}
                  {arrowIcon && (
                    <Marker
                      position={midPoint}
                      icon={arrowIcon}
                      eventHandlers={{
                        click: () => {
                          onSelectMovement?.(move);
                        },
                      }}
                    />
                  )}

                  {/* Destination Terminal Marker */}
                  <CircleMarker
                    center={move.to}
                    radius={isSelected ? 8 : 6}
                    pathOptions={{
                      fillColor: move.type === 'export' ? '#ef4444' : '#3b82f6',
                      color: isSelected ? '#38bdf8' : '#ffffff',
                      fillOpacity: 1,
                      weight: isSelected ? 3 : 2,
                    }}
                    eventHandlers={{
                      click: () => {
                        onSelectMovement?.(move);
                      },
                    }}
                  >
                    <Tooltip permanent direction="top" className="barangay-hover-tooltip">
                      {move.destination.split(',')[0]}
                    </Tooltip>
                  </CircleMarker>

                  {/* Origin Hub Marker */}
                  <CircleMarker
                    center={move.from}
                    radius={isSelected ? 6 : 4.5}
                    pathOptions={{
                      fillColor: '#1E4D2B',
                      color: isSelected ? '#38bdf8' : '#ffffff',
                      fillOpacity: 1,
                      weight: isSelected ? 2.5 : 1.5,
                    }}
                    eventHandlers={{
                      click: () => {
                        onSelectMovement?.(move);
                      },
                    }}
                  >
                    <Tooltip direction="bottom" className="barangay-hover-tooltip">
                      Origin: {move.origin.split(',')[0]}
                    </Tooltip>
                  </CircleMarker>
                </React.Fragment>
              );
            })}
        </MapContainer>
      </div>
      )}

      {/* Height exaggeration controls thematic extrusion, not real terrain elevation. */}
      {viewMode === '3D' && (
        <div className="absolute top-20 right-4 z-[900] bg-white/95 backdrop-blur-md p-2 rounded-xl border border-slate-200 shadow-xl flex items-center gap-2 pointer-events-auto">
          <span className="text-[10px] font-black uppercase text-emerald-950">
            Height scale: {heightScaleDraft.toFixed(1)}x
          </span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={heightScaleDraft}
            // Apply each input step immediately so the label and 3D shapes move with the slider.
            onChange={(e) => {
              const nextScale = Number(e.target.value);
              setHeightScaleDraft(nextScale);
              setHeightScale(nextScale);
            }}
            className="w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
          />
        </div>
      )}
    </div>
  );
}
