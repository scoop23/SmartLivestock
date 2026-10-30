'use client';

import type { Feature } from "geojson";
import type { GeoJSON as LeafletGeoJSON, Layer, LeafletMouseEvent, Path } from "leaflet";
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

import padreGarciaGeojson from '@/data/padre-garcia-barangays.json';
import type { FeatureCollection } from 'geojson';
import 'leaflet/dist/leaflet.css';
import dynamic from 'next/dynamic';
import React,{ useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react';
import { Giro3DBarangayView } from './Giro3DBarangayView';
import {
AdjacentDiseaseAlert,
BarangayGISData,
DiseaseSubMode,
GISUserScope,
MapLayer,
Movement3DDisplayMode,
MovementRecord,
SimulationColorMode,
SimulatedBarangayState,
ViewMode,
} from './types';

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
        const feature = (padreGarciaGeojson as FeatureCollection).features?.find(
          (f) => f.properties?.name?.toLowerCase() === targetBName.toLowerCase()
        );
        if (feature) {
          const featureLayer = L.geoJSON(feature);
          const fBounds = featureLayer.getBounds();
          if (fBounds.isValid()) {
            map.fitBounds(fBounds, { padding: isSmallScreen ? [24, 24] : [48, 48], maxZoom: 15, animate: false });
            return;
          }
        }
      }

      // Default: fit municipal boundary of Padre Garcia
      const geoJsonLayer = L.geoJSON(padreGarciaGeojson as FeatureCollection);
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: defaultPadding, animate: false });
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

// Ray-casting algorithm to test if a point [lng, lat] is inside a polygon ring
function isPointInRing(pt: [number, number], ring: number[][]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pseudoRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates visual random points distributed strictly inside an adjacent barangay's polygon boundary.
 * Purely visual representation for biosecurity awareness (no exact farm GPS coordinates required).
 * Deterministic PRNG ensures coordinates remain completely stable across zooms and re-renders.
 */
function getRandomVisualPointsInBarangay(
  bName: string,
  count: number,
  fallbackCentroid: [number, number]
): [number, number][] {
  const feature = (padreGarciaGeojson as FeatureCollection).features?.find(
    (f) => f.properties?.name?.toLowerCase() === bName.toLowerCase()
  );
  if (!feature || feature.geometry.type !== 'Polygon') {
    return Array.from({ length: count }, (_, i) => [
      fallbackCentroid[0] + (i === 0 ? 0.0018 : -0.0015 * i),
      fallbackCentroid[1] + (i === 0 ? -0.0018 : 0.0016 * i),
    ]);
  }

  const ring = (feature.geometry as { coordinates: number[][][] }).coordinates[0];
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  // 12% inward margin prevents points from touching the outer perimeter boundary
  const lngPad = (maxLng - minLng) * 0.12;
  const latPad = (maxLat - minLat) * 0.12;
  const safeMinLng = minLng + lngPad;
  const safeMaxLng = maxLng - lngPad;
  const safeMinLat = minLat + latPad;
  const safeMaxLat = maxLat - latPad;

  const rand = pseudoRandom(stringHash(bName) + 777);
  const points: [number, number][] = [];

  for (let c = 0; c < count; c++) {
    let found = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const lng = safeMinLng + rand() * (safeMaxLng - safeMinLng);
      const lat = safeMinLat + rand() * (safeMaxLat - safeMinLat);
      if (isPointInRing([lng, lat], ring)) {
        // Spacing: ensure each subsequent visual point has distance separation
        const tooClose = points.some((p) => Math.hypot(p[0] - lat, p[1] - lng) < 0.0012);
        if (!tooClose || attempt > 60) {
          points.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
          found = true;
          break;
        }
      }
    }
    if (!found) {
      const angle = (c * 2 * Math.PI) / Math.max(count, 1) + 0.6;
      const radius = 0.0022;
      points.push([
        Number((fallbackCentroid[0] + Math.sin(angle) * radius).toFixed(6)),
        Number((fallbackCentroid[1] + Math.cos(angle) * radius).toFixed(6)),
      ]);
    }
  }

  return points;
}

interface GISMapProps {
  barangaysByName: Record<string, BarangayGISData>;
  movements: MovementRecord[];
  activeLayer: MapLayer;
  viewMode: ViewMode;
  diseaseSubMode: DiseaseSubMode;
  simulationColorMode: SimulationColorMode;
  selectedBarangay: BarangayGISData | null;
  onSelectBarangay: (b: BarangayGISData) => void;
  resetTrigger: number;
  simulatedStates?: Record<string, SimulatedBarangayState>;
  selectedLivestockType?: string;
  userScope?: GISUserScope;
  selectedMovement?: MovementRecord | null;
  onSelectMovement?: (m: MovementRecord | null) => void;
  showMovementOverlay?: boolean;
  movementDisplayMode?: Movement3DDisplayMode;
  isTimelineActive?: boolean;
  adjacentDiseaseAlerts?: AdjacentDiseaseAlert[];
  showAdjacentDiseaseAlerts?: boolean;
  showAdjacentOutbreakColor?: boolean;
  showAdjacentOutbreakDots?: boolean;
}

export function GISMap({
  barangaysByName,
  movements,
  activeLayer,
  viewMode,
  diseaseSubMode,
  simulationColorMode = 'cases',
  selectedBarangay,
  onSelectBarangay,
  resetTrigger,
  simulatedStates,
  selectedLivestockType = 'Cattle',
  userScope,
  selectedMovement,
  onSelectMovement,
  showMovementOverlay = false,
  movementDisplayMode = 'both',
  isTimelineActive = false,
  adjacentDiseaseAlerts = [],
  showAdjacentDiseaseAlerts = true,
  showAdjacentOutbreakColor = true,
  showAdjacentOutbreakDots = true,
}: GISMapProps) {
  const centerPosition: [number, number] = [13.8741, 121.2529];
  const [leafletLib, setLeafletLib] = useState<typeof import('leaflet') | null>(null);
  const [heightScale, setHeightScale] = useState<number>(1);
  const [heightScaleDraft, setHeightScaleDraft] = useState<number>(1);
  const mapRootRef = useRef<HTMLDivElement>(null);
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null);
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
  const showAdjacentOutbreakColorRef = useRef(showAdjacentOutbreakColor && showAdjacentDiseaseAlerts);

  const showAdjacentOutbreakDotsRef = useRef(showAdjacentOutbreakDots && showAdjacentDiseaseAlerts);

  useLayoutEffect(() => {
    barangaysByNameRef.current = barangaysByName;
    activeLayerRef.current = activeLayer;
    diseaseSubModeRef.current = diseaseSubMode;
    selectedBarangayRef.current = selectedBarangay;
    simulatedStatesRef.current = simulatedStates;
    onSelectBarangayRef.current = onSelectBarangay;
    viewModeRef.current = viewMode;
    selectedLivestockTypeRef.current = selectedLivestockType;
    userScopeRef.current = userScope;
    showAdjacentOutbreakColorRef.current = showAdjacentOutbreakColor && showAdjacentDiseaseAlerts;
    showAdjacentOutbreakDotsRef.current = showAdjacentOutbreakDots && showAdjacentDiseaseAlerts;
  }, [barangaysByName, activeLayer, diseaseSubMode, selectedBarangay, simulatedStates, onSelectBarangay, viewMode, selectedLivestockType, userScope, showAdjacentOutbreakColor, showAdjacentOutbreakDots, showAdjacentDiseaseAlerts]);

  // Dynamically re-style all existing Leaflet polygon vector layers immediately upon data load or prop toggle
  // This eliminates the bug where colors only appeared on hover/mouseout
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer) return;
    layer.eachLayer((child) => {
      const sublayer = child as Path & { feature?: Feature };
      if (typeof sublayer.setStyle === 'function' && sublayer.feature) {
        sublayer.setStyle(getGeoJSONStyle(sublayer.feature));
      }
    });
  }, [
    barangaysByName,
    activeLayer,
    diseaseSubMode,
    showAdjacentOutbreakColor,
    showAdjacentOutbreakDots,
    showAdjacentDiseaseAlerts,
    selectedBarangay,
    selectedLivestockType,
    viewMode,
  ]);

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

  const getSimulationColor = (cases: number, pressure: number): string => {
    if (simulationColorMode === 'pressure') {
      if (pressure >= 0.70) return '#991b1b';
      if (pressure >= 0.40) return '#ea580c';
      if (pressure >= 0.20) return '#f59e0b';
      return '#10b981';
    }
    if (cases >= 6) return '#991b1b';
    if (cases >= 3) return '#ea580c';
    if (cases >= 1) return '#f59e0b';
    return '#10b981';
  };

  const getDiseaseColor = (
    bName: string,
    risk: 'low' | 'medium' | 'high'
  ): string => {
    if (diseaseSubMode === 'simulation' && simulatedStates?.[bName]) {
      const state = simulatedStates[bName];
      if (!state.hasLivestock && state.cases === 0) return '#94a3b8';
      return getSimulationColor(state.cases, state.transmissionPressure);
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
    if (diseaseSubMode === 'surveillance') {
      const data = barangaysByName[bName];
      const isConfirmed = (data?.active_cases ?? 0) > 0 || ((data?.fmd_active_cases ?? 0) > 0) || risk === 'high';
      const isMonitoring = !isConfirmed && (risk === 'medium' || Boolean(data?.is_in_monitoring_radius));
      if (isConfirmed) return '#ef4444'; // Red: Confirmed outbreak site (>= 1 case)
      if (isMonitoring) return '#f97316'; // Orange: Within monitoring radius (precautionary)
      return '#10b981'; // Green: Safe / outside monitoring radius
    }
    // Default 'reported' mode: only color barangays that actually have active reported cases, NO false radius colors
    const data = barangaysByName[bName];
    if ((data?.active_cases ?? 0) > 0) {
      return '#ef4444'; // Red: Active confirmed disease case
    }
    return '#f8fafc'; // Clean uncolored baseline
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

  /**
   * Thematic Movement / Livestock Inspection Clearance Choropleth Fill Colors (Indigo Palette)
   * Scaled by total inspection / clearance records filed for this origin barangay.
   */
  const getMovementColor = (recordCount: number): string => {
    if (recordCount >= 10) return '#312e81'; // 10+ records: Very High (indigo-900)
    if (recordCount >= 6) return '#4f46e5';  // 6–9 records: High (indigo-600)
    if (recordCount >= 3) return '#818cf8';  // 3–5 records: Moderate (indigo-400)
    if (recordCount >= 1) return '#c7d2fe';  // 1–2 records: Low (indigo-200)
    return '#f8fafc';                        // 0 records: Baseline (clean slate-50)
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
      case 'movement': {
        const recordCount = (data.inspections_count ?? 0) > 0
          ? data.inspections_count
          : (data.movement_out > 0 ? 1 : 0);
        return getMovementColor(recordCount);
      }
      default:
        return '#cbd5e1';
    }
  };

  const getGeoJSONStyle = (feature: Feature | undefined) => {
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
        fillOpacity: viewMode === '2D' ? 0.55 : 0.6,
      };
    }

    const isFarmerRole = (scope?.role || userScopeRef.current?.role || '').toUpperCase() === 'FARMER' || scope?.scope === 'OWN_BARANGAY';
    const isFarmer2D = isFarmerRole && viewMode === '2D';

    // 1. When on Disease Layer in 'surveillance' mode: Display full municipal Haversine risk triage
    // (Red = Outbreak, Orange = Within Monitoring Radius, Green = Safe / Clear) across all 18 barangays
    if (activeLayer === 'disease' && diseaseSubMode === 'surveillance') {
      const isOutbreakColorActive = showAdjacentOutbreakColor && showAdjacentDiseaseAlerts;
      const risk = data.disease_risk;
      const isConfirmed = (data.active_cases > 0) || ((data.fmd_active_cases ?? 0) > 0) || risk === 'high';
      const isMonitoring = !isConfirmed && (risk === 'medium' || Boolean(data.is_in_monitoring_radius));

      // If user toggles OFF the outbreak warning colors in surveillance mode:
      if (!isOutbreakColorActive && (isConfirmed || isMonitoring)) {
        return {
          fillColor: '#f8fafc',
          fillOpacity: 0.35,
          color: isSelected ? '#ffffff' : '#94a3b8',
          weight: isSelected ? 3.5 : isInScope ? 2.5 : 1.2,
          className: isInScope ? (isFarmerRole ? 'farmer-own-barangay' : 'assigned-barangay') : '',
        };
      }

      const fillColor = isConfirmed
        ? '#ef4444' // Red: Confirmed outbreak site (>= 1 case)
        : isMonitoring
        ? '#f97316' // Orange: Precautionary monitoring radius (0 cases)
        : '#10b981'; // Green: Safe / outside monitoring radius

      const borderColor = isSelected
        ? '#ffffff'
        : isInScope
        ? (isFarmerRole ? '#ffffff' : '#38bdf8') // Highlight own registered/assigned barangay
        : isConfirmed
        ? '#dc2626'
        : isMonitoring
        ? '#ea580c'
        : '#059669';

      return {
        fillColor,
        fillOpacity: isInScope ? 0.72 : isConfirmed ? 0.60 : isMonitoring ? 0.45 : 0.30,
        color: borderColor,
        weight: isSelected ? 3.5 : isInScope ? 3.0 : isConfirmed ? 2.2 : isMonitoring ? 1.8 : 1.2,
        dashArray: isMonitoring && !isInScope ? '4, 4' : undefined,
        className: isInScope ? (isFarmerRole ? 'farmer-own-barangay' : 'assigned-barangay') : '',
      };
    }

    // 2. Out-of-scope barangays:
    // When in simulation or trend submodes, all 18 barangays are rendered for municipal context
    const isMunicipalDiseaseModel = activeLayer === 'disease' && (diseaseSubMode === 'simulation' || diseaseSubMode === 'trend');
    if (!isInScope && !isMunicipalDiseaseModel) {
      if (isFarmer2D) {
        // Neighboring barangays stay visible, but darken to mark the jurisdiction boundary.
        return {
          fillColor: '#000000',
          fillOpacity: 0.55,
          color: '#334155',
          weight: 1,
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
    const fillOpacity = viewMode === '3D'
      ? isSelected ? 0.95 : 0.85
      : isSelected ? 0.7 : 0.55;

    const ownBorderColor = isFarmerRole
      ? (data.disease_risk === 'high' ? '#ef4444' : data.disease_risk === 'medium' ? '#f97316' : '#4ade80')
      : isMortality ? '#334155' : viewMode === '3D' ? '#0f290f' : '#1e3a1e';

    return {
      fillColor: getLayerColor(data),
      fillOpacity,
      color: isSelected ? '#ffffff' : ownBorderColor,
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

    if (!isInScope && !(layer === 'disease' && (subMode === 'surveillance' || subMode === 'simulation' || subMode === 'trend'))) {
      if (layer === 'disease' && subMode === 'surveillance') {
        const zone = data?.disease_zone;
        const dist = data?.nearest_outbreak_dist_km;
        const nearest = data?.nearest_outbreak;
        if (data?.disease_risk === 'high' || zone === 'outbreak') {
          return `<strong>Brgy. ${name}</strong><br/><span style="color: #ef4444; font-weight: bold;">🚨 Confirmed Outbreak Site</span><br/><span style="font-size: 9.5px; opacity: 0.9">${data?.active_cases || 1} active confirmed case(s)</span>`;
        } else if (data?.disease_risk === 'medium' || zone === 'monitoring_radius') {
          const distText = dist != null ? ` (${dist} km from Brgy. ${nearest})` : nearest ? ` (Near Brgy. ${nearest})` : '';
          return `<strong>Brgy. ${name}</strong><br/><span style="color: #f97316; font-weight: bold;">⚠️ Within Monitoring Radius${distText}</span><br/><span style="font-size: 9.5px; opacity: 0.9">Spatial buffer zone (Haversine 3.5km)</span>`;
        } else {
          return `<strong>Brgy. ${name}</strong><br/><span style="color: #10b981; font-weight: bold;">✅ Outside Monitoring Radius</span><br/><span style="font-size: 9.5px; opacity: 0.9">Safe / Outside 3.5km monitoring radius</span>`;
        }
      }
      if (showAdjacentOutbreakColorRef.current && data?.is_adjacent) {
        const hasDisease = (data.active_cases ?? 0) > 0 || (data.disease_cases ?? 0) > 0;
        const diseaseInfo = hasDisease
          ? `<span style="color: #f87171; font-weight: bold;">⚠️ ${data.active_cases} Approved Disease Report(s)</span><br/><span style="font-size: 9.5px; opacity: 0.9">${data.recent_diseases?.join(', ') || 'Active symptoms'}</span>`
          : '<span style="color: #4ade80; font-weight: 600;">✅ No active disease reports</span>';
        return `<strong>Brgy. ${name}</strong> <span style="font-size: 9px; opacity: 0.8">(Bordering your barangay)</span><br/>${diseaseInfo}`;
      }
      return `<strong>Brgy. ${name}</strong><br/><span style="font-size: 10px; opacity: 0.85">Jurisdiction restriction: outside your assigned barangay. View only; selection is disabled.</span>`;
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
        if (!simState.hasLivestock && simState.cases === 0) {
          tooltipMetric = 'Not modeled: no approved active cloven-hoofed livestock';
        } else {
          const caseLabel = simState.cases === 1 ? 'case' : 'cases';
          tooltipMetric = `${simState.cases} ${caseLabel} \u2022 modeled pressure: ${(simState.transmissionPressure * 100).toFixed(0)}% (${simState.risk.toUpperCase()})`;
        }
      } else if (subMode === 'trend') {
        const trendStatus =
          data.active_cases > 0
            ? 'ELEVATED ACTIVITY'
            : data.disease_cases > 0
            ? 'REPORTED ACTIVITY'
            : 'NO REPORTED ACTIVITY';
        tooltipMetric = `Surveillance: ${trendStatus} (${data.active_cases} recent reports (90 days), ${data.disease_cases} historical total)`;
      } else {
        const riskLabel =
          data.disease_risk === 'high'
            ? '🚨 CONFIRMED OUTBREAK (≥ 1 Case)'
            : data.disease_risk === 'medium'
            ? '⚠️ MONITORING RADIUS (Precautionary)'
            : '✅ SAFE / UNAFFECTED';
        const distInfo = data.disease_risk === 'medium' && data.nearest_outbreak
          ? ` • ${data.nearest_outbreak_dist_km ?? ''} km from ${data.nearest_outbreak}`
          : '';
        tooltipMetric = `${data.active_cases} confirmed • ${riskLabel}${distInfo}`;
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
      const recordCount = (data.inspections_count ?? 0) > 0
        ? data.inspections_count
        : (data.movement_out > 0 ? 1 : 0);
      tooltipMetric = recordCount > 0
        ? `${recordCount} inspection record${recordCount === 1 ? '' : 's'} (${data.movement_out} heads moved)`
        : 'No movement inspection records';
    }

    return `<strong>${name}</strong><br/><span style="font-size: 10px; opacity: 0.9">${tooltipMetric}</span>`;
  };

  // Bug A Fix: Attach hover and click listeners immediately on mount regardless of telemetry readiness.
  // Dynamic reads through refs ensure latest data is always accessible.
  const onEachFeature = (feature: Feature, layer: Layer) => {
    const name = feature.properties?.name;
    if (!name) return;

    layer.bindTooltip(buildTooltipText(name), {
      permanent: false,
      direction: 'center',
      className: 'barangay-hover-tooltip',
    });

    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        // Dynamically update tooltip content on hover
        layer.setTooltipContent(buildTooltipText(name));
        // Highlighting border on hover without overriding the underlying fill color
        e.target.setStyle({ weight: 3.5, color: '#ffffff' });
        e.target.bringToFront();
      },
      mouseout: (e: LeafletMouseEvent) => {
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

        if (curData) {
          onSelectBarangayRef.current(curData);
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

    const isFarmerRole = (userScope?.role || '').toUpperCase() === 'FARMER' || userScope?.scope === 'OWN_BARANGAY';
    const rawList = Object.values(sourceMap);
    const isSurveillance = activeLayer === 'disease' && diseaseSubMode === 'surveillance';

    return rawList.map((b) => {
      const scope = userScope;
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

      if (isSurveillance) {
        const risk = b.disease_risk;
        const isConfirmed = (b.active_cases > 0) || ((b.fmd_active_cases ?? 0) > 0) || risk === 'high';
        const isMonitoring = !isConfirmed && (risk === 'medium' || Boolean(b.is_in_monitoring_radius));
        statText = isConfirmed
          ? `🚨${b.active_cases > 0 ? b.active_cases : '1+'}`
          : isMonitoring
          ? '⚠️3.5km'
          : '✅Safe';
      } else if (!isInScope) {
        statText = '—';
      } else if (activeLayer === 'disease') {
        if (diseaseSubMode === 'simulation' && simulatedStates?.[b.name]) {
          const simState = simulatedStates[b.name];
          statText = !simState.hasLivestock && simState.cases === 0
            ? '— no livestock'
            : simulationColorMode === 'pressure'
            ? `⚡${(simState.transmissionPressure * 100).toFixed(0)}%`
            : `${simState.cases} case${simState.cases === 1 ? '' : 's'}`;
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
        const recordCount = (b.inspections_count ?? 0) > 0
          ? b.inspections_count
          : (b.movement_out > 0 ? 1 : 0);
        statText = recordCount > 0 ? `${recordCount}🚛` : '—';
      }

      const isGeographicallyRestricted = Boolean(scope && !scope.can_view_all_barangays);
      const isHighlightedScope = isGeographicallyRestricted && isInScope;
      const isSubtleOut = isGeographicallyRestricted && !isInScope && !isSurveillance;

      const risk = b.disease_risk;
      const isConfirmed = (b.active_cases > 0) || ((b.fmd_active_cases ?? 0) > 0) || risk === 'high';
      const isMonitoring = !isConfirmed && (risk === 'medium' || Boolean(b.is_in_monitoring_radius));

      const pillClass = isHighlightedScope
        ? 'permanent-centroid-pill highlight-own-farm'
        : isSurveillance && isConfirmed
        ? 'permanent-centroid-pill outbreak-site'
        : isSurveillance && isMonitoring
        ? 'permanent-centroid-pill monitoring-buffer'
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
  }, [leafletLib, barangaysByName, activeLayer, diseaseSubMode, simulatedStates, simulationColorMode, viewMode, selectedLivestockType, userScope]);

  const isFarmerRole = (userScope?.role || '').toUpperCase() === 'FARMER' || userScope?.scope === 'OWN_BARANGAY';

  // Fast signature of current simulation month state across all barangays so React-Leaflet GeoJSON updates on every playback frame
  const simStateKey = useMemo(() => {
    if (activeLayer !== 'disease' || diseaseSubMode !== 'simulation' || !simulatedStates) {
      return 'none';
    }
    return Object.entries(simulatedStates)
      .map(([k, v]) => `${k}:${v.cases}:${v.transmissionPressure?.toFixed(2) ?? 0}`)
      .join('|');
  }, [activeLayer, diseaseSubMode, simulatedStates]);

  const adjacentAlertList = useMemo(() => {
    if (!showAdjacentDiseaseAlerts) return [];
    if (isFarmerRole) {
      if (adjacentDiseaseAlerts && adjacentDiseaseAlerts.length > 0) {
        return adjacentDiseaseAlerts;
      }
      const adjSet = new Set(userScope?.adjacent_barangays || []);
      return Object.values(barangaysByName)
        .filter((b) => (b.is_adjacent || adjSet.has(b.name)) && (b.active_cases > 0 || (b.fmd_active_cases ?? 0) > 0 || b.disease_cases > 0))
        .map((b) => ({
          name: b.name,
          db_name: b.db_name,
          position: b.position,
          active_cases: b.active_cases,
          disease_cases: b.disease_cases,
          affected_heads: b.affected_heads,
          disease_risk: b.disease_risk,
          recent_diseases: b.recent_diseases || [],
        }));
    }
    // For municipal-wide roles (Admin, MAO, CBAT), display outbreak radar markers on active outbreak barangays
    return Object.values(barangaysByName)
      .filter((b) => (b.active_cases > 0 || (b.fmd_active_cases ?? 0) > 0 || b.disease_risk === 'high'))
      .map((b) => ({
        name: b.name,
        db_name: b.db_name,
        position: b.position,
        active_cases: b.active_cases,
        disease_cases: b.disease_cases,
        affected_heads: b.affected_heads,
        disease_risk: b.disease_risk,
        recent_diseases: b.recent_diseases || [],
      }));
  }, [isFarmerRole, showAdjacentDiseaseAlerts, adjacentDiseaseAlerts, barangaysByName, userScope?.adjacent_barangays]);

  // Generates visual pulsing dots randomly placed inside affected adjacent barangays
  const isSurveillanceMode = activeLayer === 'disease' && diseaseSubMode === 'surveillance';
  const adjacentPulsingDots = useMemo(() => {
    // Adjacent outbreak dots ONLY appear in surveillance mode
    if (!isSurveillanceMode || !showAdjacentDiseaseAlerts || !showAdjacentOutbreakDots) return [];
    const list: {
      key: string;
      position: [number, number];
      alert: AdjacentDiseaseAlert;
      dotIndex: number;
      totalDots: number;
    }[] = [];

    for (const alert of adjacentAlertList) {
      const caseCount = Math.max(alert.active_cases || alert.disease_cases || 1, 1);
      // Visual representation: 1 to 4 pulsing dots randomly distributed inside the barangay polygon
      const dotCount = Math.min(caseCount, 4);
      const visualPoints = getRandomVisualPointsInBarangay(alert.name, dotCount, alert.position);

      visualPoints.forEach((point, idx) => {
        list.push({
          key: `dot-${alert.name}-${idx}`,
          position: point,
          alert,
          dotIndex: idx,
          totalDots: dotCount,
        });
      });
    }
    return list;
  }, [isSurveillanceMode, showAdjacentDiseaseAlerts, showAdjacentOutbreakDots, adjacentAlertList]);

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
        .permanent-centroid-pill.outbreak-site {
          background: rgba(185, 28, 28, 0.95) !important;
          border: 1.5px solid rgba(248, 113, 113, 0.95) !important;
          box-shadow: 0 0 14px rgba(239, 68, 68, 0.6) !important;
        }
        .permanent-centroid-pill.monitoring-buffer {
          background: rgba(194, 65, 12, 0.92) !important;
          border: 1.5px solid rgba(251, 146, 60, 0.9) !important;
          box-shadow: 0 0 10px rgba(249, 115, 22, 0.5) !important;
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

        /* Compact High-Visibility Sonar Pulsing Dot for Adjacent Disease Outbreak */
        @keyframes sonar-wave {
          0% {
            transform: scale(0.6);
            opacity: 0.9;
          }
          50% {
            opacity: 0.45;
          }
          100% {
            transform: scale(2.8);
            opacity: 0;
          }
        }

        @keyframes core-glow-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 8px 2px rgba(239, 68, 68, 0.85), 0 0 2px #ffffff;
          }
          50% {
            transform: scale(1.22);
            box-shadow: 0 0 14px 4px rgba(239, 68, 68, 1), 0 0 3px #ffffff;
          }
        }

        .adjacent-disease-beacon-container {
          background: transparent !important;
          border: none !important;
          overflow: visible !important;
        }

        .adjacent-disease-pulse-beacon {
          position: relative;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          pointer-events: auto !important;
          transition: transform 0.2s ease;
        }

        .adjacent-disease-pulse-beacon:hover {
          transform: scale(1.25);
        }

        .adjacent-disease-pulse-beacon .beacon-ring-1 {
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background-color: rgba(239, 68, 68, 0.25);
          border: 1.5px solid rgba(239, 68, 68, 0.85);
          animation: sonar-wave 2.2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
          pointer-events: none;
        }

        .adjacent-disease-pulse-beacon .beacon-ring-2 {
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background-color: rgba(244, 63, 94, 0.2);
          border: 1.5px solid rgba(244, 63, 94, 0.75);
          animation: sonar-wave 2.2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite 0.7s;
          pointer-events: none;
        }

        .adjacent-disease-pulse-beacon .beacon-ring-3 {
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background-color: rgba(251, 113, 133, 0.15);
          border: 1px solid rgba(251, 113, 133, 0.6);
          animation: sonar-wave 2.2s cubic-bezier(0.1, 0.8, 0.3, 1) infinite 1.4s;
          pointer-events: none;
        }

        .adjacent-disease-pulse-beacon .beacon-core-dot {
          position: relative;
          width: 9px;
          height: 9px;
          border-radius: 9999px;
          background: radial-gradient(circle, #ff4d6d 0%, #ef4444 65%, #b91c1c 100%);
          border: 1.5px solid #ffffff;
          animation: core-glow-pulse 1.8s ease-in-out infinite;
          z-index: 10;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .adjacent-disease-pulse-beacon:hover .beacon-core-dot {
          box-shadow: 0 0 16px 5px rgba(239, 68, 68, 1), 0 0 4px #ffffff !important;
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
          key={`gis-3d-${simulationColorMode}`}
          barangaysByName={barangaysByName}
          activeLayer={activeLayer}
          diseaseSubMode={diseaseSubMode}
          selectedBarangay={selectedBarangay}
          onSelectBarangay={onSelectBarangay}
          resetTrigger={resetTrigger}
          simulatedStates={simulatedStates}
          simulationColorMode={simulationColorMode}
          selectedLivestockType={selectedLivestockType}
          userScope={userScope}
          heightScale={heightScale}
          suppressClickUntilRef={suppressClickUntilRef}
          movements={movements}
          selectedMovement={selectedMovement}
          onSelectMovement={onSelectMovement}
          showMovementOverlay={showMovementOverlay}
          movementDisplayMode={movementDisplayMode}
          isTimelineActive={isTimelineActive}
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

          {/* Choropleth Polygon Boundaries: Key includes dataCount, outbreak toggles, and simStateKey so layer remounts immediately on simulation playback */}
          <GeoJSON
            ref={geoJsonRef}
            key={`geojson-${activeLayer}-${selectedLivestockType || 'all'}-${diseaseSubMode}-${simulationColorMode}-${viewMode}-${selectedBarangay?.name || 'none'}-${dataCount}-${showAdjacentOutbreakColor && showAdjacentDiseaseAlerts ? 'col-on' : 'col-off'}-${simStateKey}`}
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

          {/* Pulsing Dots & Detailed Popups on Adjacent Outbreak Barangays (Active exclusively in Surveillance mode) */}
          {adjacentPulsingDots.map((dot) => {
              const beaconIcon = leafletLib
                ? leafletLib.divIcon({
                    className: 'adjacent-disease-beacon-container',
                    html: `
                      <div class="adjacent-disease-pulse-beacon" title="Biosecurity Warning: Active disease report in neighboring Brgy. ${dot.alert.name}">
                        <div class="beacon-ring-1"></div>
                        <div class="beacon-ring-2"></div>
                        <div class="beacon-ring-3"></div>
                        <div class="beacon-core-dot"></div>
                      </div>
                    `,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                  })
                : null;

              if (!beaconIcon) return null;

              return (
                <Marker
                  key={`adjacent-disease-beacon-${dot.key}`}
                  position={dot.position}
                  icon={beaconIcon}
                  zIndexOffset={3000}
                >
                  <Popup autoPan>
                    <div className="p-2.5 space-y-2 text-xs min-w-[210px] max-w-[270px]">
                      <div className="flex items-center gap-1.5 text-rose-600 font-black border-b border-rose-100 pb-1.5">
                        <span className="text-base animate-pulse">⚠️</span>
                        <span className="uppercase tracking-wider text-[10.5px]">Adjacent Biosecurity Alert</span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900 text-sm">Brgy. {dot.alert.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 uppercase font-mono">
                            {dot.alert.disease_risk || 'Alert'} Risk
                          </span>
                        </div>
                        <span className="text-[10.5px] text-amber-800 font-semibold block mt-0.5">
                          Bordering your registered barangay
                        </span>
                      </div>

                      <div className="space-y-1 text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Approved Reports:</span>
                          <span className="font-mono font-black text-rose-600">{dot.alert.active_cases} recent</span>
                        </div>
                        {dot.alert.affected_heads > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Affected Animals:</span>
                            <span className="font-mono font-bold text-slate-900">{dot.alert.affected_heads} head{dot.alert.affected_heads > 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {dot.alert.recent_diseases && dot.alert.recent_diseases.length > 0 && (
                          <div className="pt-1 border-t border-slate-200/60">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Reported Illness:</span>
                            <div className="flex flex-wrap gap-1">
                              {dot.alert.recent_diseases.map((dis, idx) => (
                                <span key={idx} className="bg-rose-50 text-rose-900 border border-rose-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
                                  {dis}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-2 text-[10px] text-amber-900 space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          🛡️ Biosecurity Action:
                        </div>
                        <p className="leading-tight">
                          Inspect your herd daily for symptoms and immediately report any lethargy or lesions to your local livestock officer.
                        </p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

          {/* Movement Layer Polyline Arcs & External Destination Pins */}
          {(activeLayer === 'movement' || showMovementOverlay) && (activeLayer !== 'movement' || movementDisplayMode !== 'density') &&
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
                      dashArray: isApproved ? '10, 10' : '6, 8',
                      opacity: isSelected ? 1 : 0.85,
                      className: isSelected ? 'movement-polyline-flow-selected' : 'movement-polyline-flow',
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
