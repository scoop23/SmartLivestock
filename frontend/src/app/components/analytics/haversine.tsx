'use client';

/**
 * ============================================================================
 * Haversine Epidemic Risk Classifier & Spatial Forecaster (`haversine.tsx`)
 * Municipality of Padre Garcia, Batangas — Municipal Agriculture Office (MAO)
 * ============================================================================
 *
 * SPATIAL RISK CLASSIFICATION RULES:
 * ----------------------------------------------------------------------------
 * 1. Host Barangay with >= 1 Confirmed Case -> RED (Confirmed Outbreak Site)
 *    Municipal rule: A single confirmed case flags the host barangay immediately
 *    as an outbreak site to enable rapid veterinary intervention. High cattle
 *    case counts are NOT required before declaring Red status.
 *
 * 2. Nearby Barangays within Haversine Monitoring Radius -> ORANGE (Precautionary Zone)
 *    e.g., Barangay Manggas when neighboring Bawi has 1 confirmed case.
 *    Manggas has 0 confirmed cases, but its geodesic distance (2.37 km) is
 *    within the 3.5 km monitoring radius. It is potentially exposed, but
 *    has no confirmed infection.
 *
 * 3. Far Barangays outside Monitoring Radius -> GREEN (Safe / Low Risk)
 *    Barangays located beyond the monitoring buffer (> 3.5 km) with 0 confirmed
 *    cases remain Green.
 *
 * 4. Suspected but Unvalidated Reports:
 *    Unvalidated field submissions do NOT trigger automatic Red outbreak status.
 *    They display an Amber/Yellow badge ("Pending Verification") without
 *    placing the entire barangay or municipality under quarantine.
 */

import { useClientReady } from "@/hooks/use-browser-state";
import padreGarciaGeojson from '@/data/padre-garcia-barangays.json';
import api from '@/lib/axios';
import { useQuery } from '@tanstack/react-query';
import type { GISTelemetryResponse } from '@/components/gis/types';
import type { Feature, FeatureCollection } from "geojson";
import type { GeoJSON as LeafletGeoJSON, Path, LeafletMouseEvent } from "leaflet";
import 'leaflet/dist/leaflet.css';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  FastForward,
  HelpCircle,
  Info,
  MousePointerClick,
  Navigation,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sliders,
  Sparkles,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';

// --- Dynamic Leaflet imports (SSR-safe) ---
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(m => m.GeoJSON), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(m => m.Circle), { ssr: false });

// Helper component to auto-resize and fit Leaflet canvas when opened in modal dialogs or resized
function MapAutoFitAndResize() {
  const map = useMap();
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 450);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
}

// --- Haversine Geodesic Distance Formula (km) ---
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's mean radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Official Surveyed Barangay Centroids (Padre Garcia, Batangas) ---
// Coordinated directly with backend/analytics/services/gis.py and surveyed GIS boundaries
export const BARANGAY_CENTROIDS: Record<string, [number, number]> = {
  'Banaba': [13.885149, 121.221731],
  'Banaybanay': [13.893419, 121.216281],
  'Bawi': [13.886475, 121.232434],
  'Bukal': [13.863402, 121.258598],
  'Castillo': [13.875098, 121.266738],
  'Cawongan': [13.873038, 121.220908],
  'Manggas': [13.871999, 121.246593],
  'Maugat East': [13.864823, 121.302085],
  'Maugat West': [13.864623, 121.281764],
  'Pansol': [13.882793, 121.247123],
  'Payapa': [13.859442, 121.246674],
  'Poblacion': [13.87908, 121.212894],
  'Quilo-quilo North': [13.862076, 121.223498],
  'Quilo-quilo South': [13.851806, 121.243495],
  'San Felipe': [13.887528, 121.201211],
  'San Miguel': [13.873635, 121.199939],
  'Tamak': [13.876635, 121.229178],
  'Tangob': [13.881157, 121.259591],
};

// Official census baseline cattle inventory (fallback if backend telemetry is empty)
export const CATTLE_HEADS: Record<string, number> = {
  'Banaba': 245, 'Banaybanay': 112, 'Bawi': 198, 'Bukal': 134,
  'Castillo': 143, 'Cawongan': 167, 'Manggas': 76, 'Maugat East': 88,
  'Maugat West': 121, 'Pansol': 156, 'Payapa': 99, 'Poblacion': 87,
  'Quilo-quilo North': 73, 'Quilo-quilo South': 59, 'San Felipe': 182,
  'San Miguel': 95, 'Tamak': 44, 'Tangob': 62,
};

export const BARANGAY_NAMES = Object.keys(BARANGAY_CENTROIDS);

// Pre-computed 18x18 Haversine geodesic distance matrix (km)
export const HAVERSINE_DISTANCES: Record<string, Record<string, number>> = {};
for (const a of BARANGAY_NAMES) {
  HAVERSINE_DISTANCES[a] = {};
  for (const b of BARANGAY_NAMES) {
    HAVERSINE_DISTANCES[a][b] = a === b ? 0 : haversineKm(
      BARANGAY_CENTROIDS[a][0], BARANGAY_CENTROIDS[a][1],
      BARANGAY_CENTROIDS[b][0], BARANGAY_CENTROIDS[b][1]
    );
  }
}

// --- Multi-Tier Risk Types ---
export type SpatialRiskCategory = 'confirmed_outbreak' | 'monitoring_radius' | 'safe';

export interface BarangayRiskProfile {
  name: string;
  confirmedCases: number;
  suspectedCases: number;
  cattle: number;
  category: SpatialRiskCategory;
  categoryLabel: string;
  distanceToOutbreakKm: number | null;
  nearestOutbreakSource: string | null;
  color: string;
  fillOpacity: number;
}

export const RISK_COLORS: Record<SpatialRiskCategory, { hex: string; bg: string; text: string; border: string }> = {
  confirmed_outbreak: {
    hex: '#ef4444',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-300',
  },
  monitoring_radius: {
    hex: '#f97316',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
  },
  safe: {
    hex: '#10b981',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
};

export type ForecasterScenario = 'live' | 'custom-click' | 'simulation' | 'manggas-scenario';

export interface PadreGarciaForecasterProps {
  initialGisData?: GISTelemetryResponse | null;
}

export default function PadreGarciaForecaster({ initialGisData }: PadreGarciaForecasterProps = {}) {
  const isMounted = useClientReady();
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null);

  // Fetch live GIS telemetry from PostgreSQL if not passed as prop
  const { data: fetchedGisData, isLoading: isLoadingGis } = useQuery<GISTelemetryResponse>({
    queryKey: ['gis-telemetry'],
    queryFn: async ({ signal }) => (await api.get<GISTelemetryResponse>('/api/analytics/gis/', { signal })).data,
    enabled: !initialGisData,
    staleTime: 60_000,
  });

  const gisData = initialGisData ?? fetchedGisData ?? null;

  // Real data extracted from PostgreSQL database
  const realBarangayData = useMemo(() => {
    const list = gisData?.barangays || [];
    const hasLiveTelemetry = Boolean(gisData && list.length > 0);
    // When live PostgreSQL telemetry is connected, initialize with 0 for all barangays so mock fallbacks do not pollute real totals
    const cattleMap: Record<string, number> = hasLiveTelemetry
      ? Object.fromEntries(BARANGAY_NAMES.map(name => [name, 0]))
      : { ...CATTLE_HEADS };
    const confirmedCasesMap: Record<string, number> = {};
    const suspectedCasesMap: Record<string, number> = {};

    for (const b of list) {
      if (!b.name) continue;
      // Live heads count from database (total livestock inventory in barangay)
      const heads = (typeof b.total_livestock === 'number' && b.total_livestock >= 0)
        ? b.total_livestock
        : (typeof b.cattle === 'number' && b.cattle >= 0)
        ? b.cattle
        : 0;
      cattleMap[b.name] = heads;
      // Live active confirmed cases
      const active = (b.fmd_active_cases ?? 0) > 0 ? b.fmd_active_cases! : (b.active_cases ?? 0);
      if (active > 0) {
        confirmedCasesMap[b.name] = active;
      }
      // Live unvalidated / suspected cases
      if ((b.suspected_cases ?? 0) > 0) {
        suspectedCasesMap[b.name] = b.suspected_cases!;
      }
    }
    return {
      cattleMap,
      confirmedCasesMap,
      suspectedCasesMap,
      hasRealConfirmedOutbreaks: Object.keys(confirmedCasesMap).length > 0,
    };
  }, [gisData]);

  // Active scenario:
  // - 'live': Real PostgreSQL database status
  // - 'custom-click': Click any barangay to place a simulated outbreak epicenter
  // - 'simulation': Multi-day epidemic progression timeline
  // - 'manggas-scenario': Guided capstone validation case study
  const [activeScenario, setActiveScenario] = useState<ForecasterScenario>('live');
  const [monitoringRadiusKm, setMonitoringRadiusKm] = useState<number>(3.5);
  const [selectedOutbreakSite, setSelectedOutbreakSite] = useState<string>('Bawi');
  const [hasSuspectedCaseInManggas, setHasSuspectedCaseInManggas] = useState<boolean>(true);
  const [selectedBarangayForDetail, setSelectedBarangayForDetail] = useState<string>('Bawi');

  // Timeline simulation states
  const [dayIndex, setDayIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(600); // ms per day
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stale closure guards for Leaflet callbacks
  const activeScenarioRef = useRef(activeScenario);
  useEffect(() => {
    activeScenarioRef.current = activeScenario;
  }, [activeScenario]);

  const selectedBarangayRef = useRef(selectedBarangayForDetail);
  useEffect(() => {
    selectedBarangayRef.current = selectedBarangayForDetail;
  }, [selectedBarangayForDetail]);

  // Distance ranking from the selected outbreak epicenter
  const sortedNeighborsByDistance = useMemo(() => {
    return BARANGAY_NAMES
      .filter(name => name !== selectedOutbreakSite)
      .map(name => ({
        name,
        distance: HAVERSINE_DISTANCES[selectedOutbreakSite]?.[name] ?? 999,
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [selectedOutbreakSite]);

  // Confirmed cases per barangay based on active scenario
  const confirmedCasesMap: Record<string, number> = useMemo(() => {
    if (activeScenario === 'live') {
      return realBarangayData.confirmedCasesMap;
    }
    if (activeScenario === 'manggas-scenario') {
      return { 'Bawi': 1 };
    }
    if (activeScenario === 'custom-click') {
      return { [selectedOutbreakSite]: 1 };
    }
    // 'simulation' mode: dynamic Haversine geodesic diffusion from the selected epicenter
    const seedSite = selectedOutbreakSite || 'Bawi';
    const cases: Record<string, number> = {};

    // Epicenter starts with 1 case, gradually grows over 30 days
    cases[seedSite] = 1 + Math.floor(dayIndex * 0.4);

    // Neighbors within monitoring radius develop secondary cases progressively
    const withinBuffer = sortedNeighborsByDistance.filter(b => b.distance <= monitoringRadiusKm);

    if (withinBuffer.length > 0 && dayIndex >= 4) {
      // 1st closest neighbor infected on Day 4
      cases[withinBuffer[0].name] = Math.max(1, Math.floor((dayIndex - 4) * 0.35) + 1);
    }
    if (withinBuffer.length > 1 && dayIndex >= 9) {
      // 2nd closest neighbor infected on Day 9
      cases[withinBuffer[1].name] = Math.max(1, Math.floor((dayIndex - 9) * 0.3) + 1);
    }
    if (withinBuffer.length > 2 && dayIndex >= 15) {
      // 3rd closest neighbor infected on Day 15
      cases[withinBuffer[2].name] = Math.max(1, Math.floor((dayIndex - 15) * 0.25) + 1);
    }
    if (withinBuffer.length > 3 && dayIndex >= 22) {
      // 4th closest neighbor infected on Day 22
      cases[withinBuffer[3].name] = Math.max(1, Math.floor((dayIndex - 22) * 0.2) + 1);
    }

    return cases;
  }, [activeScenario, realBarangayData.confirmedCasesMap, selectedOutbreakSite, dayIndex, monitoringRadiusKm, sortedNeighborsByDistance]);

  // Suspected cases per barangay (unvalidated field reports)
  const suspectedCasesMap: Record<string, number> = useMemo(() => {
    if (activeScenario === 'live') {
      return realBarangayData.suspectedCasesMap;
    }
    const map: Record<string, number> = {};
    if (activeScenario === 'manggas-scenario' && hasSuspectedCaseInManggas) {
      map['Manggas'] = 1;
    }
    return map;
  }, [activeScenario, realBarangayData.suspectedCasesMap, hasSuspectedCaseInManggas]);

  // Active confirmed outbreak sites in the current state
  const confirmedSites = useMemo(() => {
    return BARANGAY_NAMES.filter(name => (confirmedCasesMap[name] ?? 0) >= 1);
  }, [confirmedCasesMap]);

  // Spatial evaluation using Haversine Geodesic Distance
  const riskProfiles: Record<string, BarangayRiskProfile> = useMemo(() => {
    const profiles: Record<string, BarangayRiskProfile> = {};

    for (const name of BARANGAY_NAMES) {
      const confirmed = confirmedCasesMap[name] ?? 0;
      const suspected = suspectedCasesMap[name] ?? 0;
      const cattle = realBarangayData.cattleMap[name] ?? CATTLE_HEADS[name] ?? 0;

      if (confirmed >= 1) {
        // RULE 1: >= 1 Confirmed Case -> RED (Confirmed Outbreak Site)
        profiles[name] = {
          name,
          confirmedCases: confirmed,
          suspectedCases: suspected,
          cattle,
          category: 'confirmed_outbreak',
          categoryLabel: 'Confirmed Outbreak Site',
          distanceToOutbreakKm: 0,
          nearestOutbreakSource: name,
          color: RISK_COLORS.confirmed_outbreak.hex,
          fillOpacity: 0.78,
        };
      } else {
        // Calculate geodesic distance to the closest confirmed outbreak site
        let minDistance = Infinity;
        let closestSite: string | null = null;

        for (const site of confirmedSites) {
          const d = HAVERSINE_DISTANCES[name]?.[site] ?? haversineKm(
            BARANGAY_CENTROIDS[name][0], BARANGAY_CENTROIDS[name][1],
            BARANGAY_CENTROIDS[site][0], BARANGAY_CENTROIDS[site][1]
          );
          if (d < minDistance) {
            minDistance = d;
            closestSite = site;
          }
        }

        if (minDistance <= monitoringRadiusKm && closestSite !== null) {
          // RULE 2: 0 Confirmed Cases but <= Monitoring Radius -> ORANGE (Precautionary Surveillance)
          profiles[name] = {
            name,
            confirmedCases: 0,
            suspectedCases: suspected,
            cattle,
            category: 'monitoring_radius',
            categoryLabel: `Within Monitoring Radius (${minDistance.toFixed(2)} km)`,
            distanceToOutbreakKm: minDistance,
            nearestOutbreakSource: closestSite,
            color: RISK_COLORS.monitoring_radius.hex,
            fillOpacity: 0.58,
          };
        } else {
          // RULE 3: > Monitoring Radius (or no confirmed outbreaks) -> GREEN (Safe / Low Risk)
          profiles[name] = {
            name,
            confirmedCases: 0,
            suspectedCases: suspected,
            cattle,
            category: 'safe',
            categoryLabel: 'Outside Monitoring Radius (Safe)',
            distanceToOutbreakKm: Number.isFinite(minDistance) ? minDistance : null,
            nearestOutbreakSource: closestSite,
            color: RISK_COLORS.safe.hex,
            fillOpacity: 0.32,
          };
        }
      }
    }
    return profiles;
  }, [confirmedCasesMap, suspectedCasesMap, realBarangayData.cattleMap, confirmedSites, monitoringRadiusKm]);

  // Stale closure guard for risk profiles in mouse handlers
  const riskProfilesRef = useRef(riskProfiles);
  useEffect(() => {
    riskProfilesRef.current = riskProfiles;
  }, [riskProfiles]);

  // Simulation playback loop
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isPlaying && activeScenario === 'simulation') {
      intervalRef.current = setInterval(() => {
        setDayIndex(prev => {
          if (prev >= 30) {
            setIsPlaying(false);
            return 30;
          }
          return prev + 1;
        });
      }, playbackSpeed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, activeScenario]);

  // Update Leaflet vector layer styles whenever riskProfiles update
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer) return;

    layer.eachLayer((child) => {
      const sublayer = child as Path & { feature?: Feature };
      if (typeof sublayer.setStyle !== 'function') return;
      const name: string = sublayer.feature?.properties?.name;
      if (!name) return;

      const profile = riskProfiles[name];
      if (!profile) return;

      sublayer.setStyle({
        fillColor: profile.color,
        fillOpacity: profile.fillOpacity,
        color: profile.category === 'confirmed_outbreak' ? '#b91c1c' : profile.category === 'monitoring_radius' ? '#c2410c' : '#047857',
        weight: profile.name === selectedBarangayForDetail ? 3.5 : profile.category === 'confirmed_outbreak' ? 2.5 : 1.5,
        dashArray: profile.category === 'monitoring_radius' ? '4, 4' : undefined,
      });

      const suspectedBadge = profile.suspectedCases > 0
        ? `<div style="margin-top:4px;padding:2px 6px;border-radius:4px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;font-size:10px;font-weight:700">
             ⚠️ ${profile.suspectedCases} Suspected Report${profile.suspectedCases > 1 ? 's' : ''} (Pending Field Verification)
           </div>`
        : '';

      const statusDescription = profile.category === 'confirmed_outbreak'
        ? `<div style="color:#dc2626;font-weight:bold">🚨 Confirmed Outbreak Site (&ge; 1 case)</div>`
        : profile.category === 'monitoring_radius'
        ? `<div style="color:#d97706;font-weight:bold">🟠 Precautionary Monitoring Zone (${profile.distanceToOutbreakKm?.toFixed(2)} km from ${profile.nearestOutbreakSource})</div>
           <div style="font-size:10.5px;color:#4b5563">Potentially exposed; 0 confirmed infected animals in this barangay.</div>`
        : `<div style="color:#16a34a;font-weight:bold">✅ Outside Monitoring Radius (Low Risk)</div>`;

      sublayer.bindPopup(`
        <div style="font-family:sans-serif;min-width:200px;padding:4px">
          <div style="font-size:14px;font-weight:800;color:#1e293b;border-bottom:2px solid #0f172a;padding-bottom:3px;margin-bottom:6px">
            Brgy. ${name}
          </div>
          <div style="font-size:12px;line-height:1.6">
            ${statusDescription}
            ${suspectedBadge}
            <div style="margin-top:6px;font-size:11px;color:#334155">
              <div>🐄 <b>Cattle Herd:</b> ${profile.cattle} heads</div>
              <div>🦠 <b>Confirmed Cases:</b> ${profile.confirmedCases}</div>
            </div>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0"/>
            <div style="font-size:10px;color:#64748b">
              ${profile.nearestOutbreakSource
                ? `Haversine distance to ${profile.nearestOutbreakSource}: <b>${profile.distanceToOutbreakKm?.toFixed(2)} km</b>`
                : 'No active confirmed outbreaks in municipality'}
            </div>
          </div>
        </div>
      `);
    });
  }, [riskProfiles, selectedBarangayForDetail]);

  // Click handler on polygon: works in Click-to-Test and general navigation
  const handleBarangayClick = useCallback((bName: string) => {
    setSelectedBarangayForDetail(bName);
    if (activeScenarioRef.current === 'custom-click') {
      setSelectedOutbreakSite(bName);
    }
  }, []);

  const sortedBarangayList = useMemo(() => {
    return Object.values(riskProfiles).sort((a, b) => {
      if (a.category === 'confirmed_outbreak') return -1;
      if (b.category === 'confirmed_outbreak') return 1;
      return (a.distanceToOutbreakKm ?? 99) - (b.distanceToOutbreakKm ?? 99);
    });
  }, [riskProfiles]);

  const outbreakCount = Object.values(riskProfiles).filter(p => p.category === 'confirmed_outbreak').length;
  const monitoringCount = Object.values(riskProfiles).filter(p => p.category === 'monitoring_radius').length;
  const safeCount = Object.values(riskProfiles).filter(p => p.category === 'safe').length;
  const totalCattleCount = useMemo(() => {
    return Object.values(realBarangayData.cattleMap).reduce((sum, count) => sum + count, 0);
  }, [realBarangayData.cattleMap]);

  const selectedProfile = riskProfiles[selectedBarangayForDetail] || riskProfiles[selectedOutbreakSite] || sortedBarangayList[0];

  // Phase description for the timeline spread simulation
  const timelinePhaseLabel = useMemo(() => {
    if (dayIndex === 0) return 'Phase 1: Index Case Detected';
    if (dayIndex <= 3) return 'Phase 1: Local Incubation Period';
    if (dayIndex <= 8) return 'Phase 2: Local Transmission in Haversine Buffer';
    if (dayIndex <= 14) return 'Phase 3: Secondary Cluster Expansion';
    if (dayIndex <= 21) return 'Phase 4: Municipal Quarantine Checkpoints Active';
    return 'Phase 5: Epidemic Diffusion Stabilized';
  }, [dayIndex]);

  if (!isMounted) return null;

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* 1. Header Bar with Scenario Selector & Controls */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-rose-600 animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-900">
              Haversine Geospatial Biosurveillance
            </span>
            {gisData && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Database className="size-3 text-emerald-600" />
                PostgreSQL Connected ({totalCattleCount.toLocaleString()} Heads)
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 mt-0.5">
            <Activity className="size-5 text-rose-600" />
            Epidemic Risk Forecaster &amp; Haversine Spatial Triage
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Spherical geodesic distance &middot; Precautionary biosecurity buffer &middot; Single-case outbreak declaration
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-xl bg-slate-100 p-1 border border-slate-200 gap-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveScenario('live');
                setIsPlaying(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeScenario === 'live'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="size-3.5" />
              Live Telemetry
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveScenario('custom-click');
                setIsPlaying(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeScenario === 'custom-click'
                  ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MousePointerClick className="size-3.5" />
              Click-to-Test
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveScenario('simulation');
                setDayIndex(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeScenario === 'simulation'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FastForward className="size-3.5" />
              Timeline Spread
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveScenario('manggas-scenario');
                setSelectedOutbreakSite('Bawi');
                setIsPlaying(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeScenario === 'manggas-scenario'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="size-3.5 text-amber-600" />
              Manggas Case Study
            </button>
          </div>
        </div>
      </div>

      {/* 2. Scenario-Specific Context Banner & Controls */}
      {activeScenario === 'live' && (
        <div className={`rounded-2xl border p-3.5 sm:p-4 text-xs flex flex-wrap items-center justify-between gap-3 ${
          realBarangayData.hasRealConfirmedOutbreaks
            ? 'bg-rose-50/80 border-rose-200 text-rose-950'
            : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
        }`}>
          <div className="flex items-center gap-2.5">
            {realBarangayData.hasRealConfirmedOutbreaks ? (
              <ShieldAlert className="size-5 text-rose-600 shrink-0" />
            ) : (
              <ShieldCheck className="size-5 text-emerald-600 shrink-0" />
            )}
            <div>
              <span className="font-bold">
                {realBarangayData.hasRealConfirmedOutbreaks
                  ? `Active Outbreak Declared: ${confirmedSites.length} barangay(s) in Red status (${confirmedSites.join(', ')}).`
                  : 'Live Database Status: Zero Active Outbreaks Recorded across Padre Garcia.'}
              </span>
              <p className="text-[11px] opacity-85 mt-0.5">
                {realBarangayData.hasRealConfirmedOutbreaks
                  ? 'Neighboring barangays within Haversine 3.5 km buffer are in Orange Precautionary Zone.'
                  : 'All 18 barangays are in Safe (Green) status. Real cattle inventory totals are aggregated from PostgreSQL.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveScenario('custom-click');
                setSelectedOutbreakSite('Bawi');
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
            >
              🎯 Click-to-Test Sandbox &rarr;
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveScenario('simulation');
                setDayIndex(0);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
            >
              ▶ Run 30-Day Timeline Spread &rarr;
            </button>
          </div>
        </div>
      )}

      {activeScenario === 'custom-click' && (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3.5 sm:p-4 text-xs space-y-2 text-indigo-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MousePointerClick className="size-4 text-indigo-600 shrink-0" />
              <span className="font-bold">
                Interactive Click-to-Test Active: Click any barangay polygon on the map to place an outbreak epicenter.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-indigo-800">Or select from list:</span>
              <select
                value={selectedOutbreakSite}
                onChange={(e) => {
                  setSelectedOutbreakSite(e.target.value);
                  setSelectedBarangayForDetail(e.target.value);
                }}
                className="bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-indigo-500/20"
              >
                {BARANGAY_NAMES.map(name => (
                  <option key={name} value={name}>
                    Brgy. {name} ({realBarangayData.cattleMap[name] ?? CATTLE_HEADS[name]} cattle)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-indigo-800/80">
            Current simulated epicenter: <strong className="text-indigo-950">Brgy. {selectedOutbreakSite}</strong>. Notice how the {monitoringRadiusKm} km Haversine buffer instantly shifts and recalculates geodesic distances across all other 17 barangays.
          </p>
        </div>
      )}

      {activeScenario === 'simulation' && (
        <div className="bg-gradient-to-r from-amber-50/90 via-white to-slate-50 border border-amber-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-amber-600 shrink-0 animate-pulse" />
              <div className="text-xs">
                <span className="font-bold text-slate-900">30-Day Haversine Epidemic Spread Simulation</span>
                <span className="text-[11px] text-amber-800 ml-2 font-mono font-bold">
                  &middot; {timelinePhaseLabel}
                </span>
              </div>
            </div>

            {/* Seed Epicenter Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700">Outbreak Origin:</span>
              <select
                value={selectedOutbreakSite}
                onChange={(e) => {
                  setSelectedOutbreakSite(e.target.value);
                  setDayIndex(0);
                  setIsPlaying(false);
                }}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 shadow-2xs"
              >
                {BARANGAY_NAMES.map(name => (
                  <option key={name} value={name}>Brgy. {name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Timeline Scrubber (0 to 30 Days) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-700">
              <span className="flex items-center gap-1 text-amber-700">
                <Clock className="size-3.5" />
                Simulation Day: <span className="text-sm font-black text-slate-900">Day {dayIndex}</span> of 30
              </span>
              <span className="text-[11px] text-slate-500">
                Active Outbreak Sites: <b className="text-rose-600">{outbreakCount}</b> &middot; Precautionary Buffer: <b className="text-amber-600">{monitoringCount}</b>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={dayIndex}
                onChange={(e) => {
                  setDayIndex(parseInt(e.target.value, 10));
                  setIsPlaying(false);
                }}
                className="w-full accent-amber-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
            </div>

            {/* Timeline Tick Labels */}
            <div className="flex justify-between text-[10px] font-mono text-slate-600 px-0.5 select-none">
              <span>Day 0 (Index)</span>
              <span>Day 5 (Buffer)</span>
              <span>Day 10 (Secondary)</span>
              <span>Day 15 (Cluster)</span>
              <span>Day 22 (Quarantine)</span>
              <span>Day 30 (Stabilized)</span>
            </div>
          </div>

          {/* Playback Controls & Speed Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying(p => !p)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isPlaying ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                }`}
              >
                {isPlaying ? <><Pause className="size-3.5" /> Pause</> : <><Play className="size-3.5" /> Play Spread</>}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setDayIndex(prev => Math.max(0, prev - 1));
                }}
                className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                title="Step backward 1 day"
              >
                <SkipBack className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setDayIndex(prev => Math.min(30, prev + 1));
                }}
                className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                title="Step forward 1 day"
              >
                <SkipForward className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setDayIndex(0);
                }}
                className="flex items-center gap-1 px-2 py-1 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer text-xs"
                title="Reset simulation to Day 0"
              >
                <RotateCcw className="size-3.5" /> Reset
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Speed:</span>
              <button
                type="button"
                onClick={() => setPlaybackSpeed(600)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  playbackSpeed === 600 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                1x
              </button>
              <button
                type="button"
                onClick={() => setPlaybackSpeed(300)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  playbackSpeed === 300 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                2x
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Interactive Radius & Scenario Controls Bar */}
      <div className="bg-gradient-to-r from-slate-50 via-white to-amber-50/40 border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Haversine Monitoring Radius Slider */}
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-700 flex items-center gap-1 shrink-0">
              <Sliders className="size-3.5 text-amber-600" />
              Haversine Biosecurity Radius:
            </span>
            <input
              type="range"
              min="1.5"
              max="5.5"
              step="0.5"
              value={monitoringRadiusKm}
              onChange={(e) => setMonitoringRadiusKm(parseFloat(e.target.value))}
              className="w-28 sm:w-36 accent-amber-600 cursor-pointer"
            />
            <span className="font-mono font-black text-amber-700 bg-amber-100/70 border border-amber-300/60 px-2 py-0.5 rounded-md text-xs shrink-0">
              {monitoringRadiusKm.toFixed(1)} km
            </span>
          </div>

          {/* Manggas Suspected Observation Toggle (Case Study Mode) */}
          {activeScenario === 'manggas-scenario' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="suspected-manggas-toggle"
                checked={hasSuspectedCaseInManggas}
                onChange={(e) => setHasSuspectedCaseInManggas(e.target.checked)}
                className="size-4 rounded accent-amber-600 cursor-pointer"
              />
              <label htmlFor="suspected-manggas-toggle" className="font-medium text-slate-700 cursor-pointer select-none">
                Include 1 <strong>Suspected (Unvalidated)</strong> Observation in Brgy. Manggas
              </label>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300/60 font-semibold">
                Rule: Unvalidated &ne; Confirmed Outbreak
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Full-Width Interactive Map Canvas with Overlayed Telemetry HUD (4 KPIs) */}
      <div className="w-full bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col h-[500px] sm:h-[580px] lg:h-[640px]">
        <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-bold tracking-tight">
              Padre Garcia GIS &middot; Haversine Spatial Risk Canvas
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            {activeScenario === 'simulation'
              ? `Day ${dayIndex}/30 · Origin: Brgy. ${selectedOutbreakSite} · Buffer: ${monitoringRadiusKm} km`
              : activeScenario === 'live'
              ? `Live Status · ${confirmedSites.length} Outbreak Site(s) · Buffer: ${monitoringRadiusKm} km`
              : `Epicenter: Brgy. ${selectedOutbreakSite} · Buffer: ${monitoringRadiusKm} km`}
          </span>
        </div>

        <style>{`
          .risk-tooltip {
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 8px;
          }
          .risk-tooltip::before { display: none; }
        `}</style>

        <div className="flex-1 relative h-full w-full">
          <MapContainer
            center={[13.8741, 121.238]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <MapAutoFitAndResize />

            {/* Standard Watermark-Free OpenStreetMap Basemap Layer */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <GeoJSON
              ref={geoJsonRef}
              key={`haversine-geojson-${activeScenario}-${activeScenario === 'custom-click' ? selectedOutbreakSite : ''}`}
              data={padreGarciaGeojson as unknown as FeatureCollection}
              onEachFeature={(feature, leafletLayer) => {
                const bName: string = feature.properties?.name;
                leafletLayer.bindTooltip(bName, {
                  permanent: false,
                  className: 'risk-tooltip',
                  direction: 'center',
                });

                leafletLayer.on({
                  click: () => {
                    handleBarangayClick(bName);
                  },
                  mouseover: (e: LeafletMouseEvent) => {
                    e.target.setStyle({ weight: 3.5, fillOpacity: 0.90 });
                  },
                  mouseout: (e: LeafletMouseEvent) => {
                    const prof = riskProfilesRef.current[bName];
                    if (prof) {
                      e.target.setStyle({
                        weight: bName === selectedBarangayRef.current ? 3.5 : prof.category === 'confirmed_outbreak' ? 2.5 : 1.5,
                        fillOpacity: prof.fillOpacity,
                      });
                    }
                  },
                });
              }}
            />

            {/* Multi-Outbreak Haversine Monitoring Radius Perimeter Buffer Circles */}
            {confirmedSites.length > 0 ? (
              confirmedSites.map((siteName) => {
                const centroid = BARANGAY_CENTROIDS[siteName];
                if (!centroid) return null;
                const isEpicenter = siteName === selectedOutbreakSite;
                return (
                  <Circle
                    key={`buffer-${siteName}-${monitoringRadiusKm}`}
                    center={centroid}
                    radius={monitoringRadiusKm * 1000}
                    pathOptions={{
                      color: isEpicenter ? '#ea580c' : '#f97316',
                      fillColor: '#f97316',
                      fillOpacity: 0.09,
                      weight: isEpicenter ? 2.5 : 1.5,
                      dashArray: '6, 6',
                    }}
                  />
                );
              })
            ) : (
              /* Fallback buffer circle in sandbox / case-study if zero active DB outbreaks */
              BARANGAY_CENTROIDS[selectedOutbreakSite] && (
                <Circle
                  key={`buffer-single-${selectedOutbreakSite}-${monitoringRadiusKm}`}
                  center={BARANGAY_CENTROIDS[selectedOutbreakSite]}
                  radius={monitoringRadiusKm * 1000}
                  pathOptions={{
                    color: '#ea580c',
                    fillColor: '#f97316',
                    fillOpacity: 0.10,
                    weight: 2,
                    dashArray: '6, 6',
                  }}
                />
              )
            )}
          </MapContainer>

          {/* 4 KPIs Floating Directly On Map Canvas (Telemetry HUD) */}
          <div className="absolute top-2 sm:top-3 left-12 sm:left-14 right-2 sm:right-3 z-[900] pointer-events-none">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
              {/* KPI 1: Confirmed Outbreak (Red) */}
              <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-rose-200/90 rounded-xl p-2.5 sm:p-3 shadow-md hover:border-rose-400 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-rose-800 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-rose-600 shrink-0" />
                    Confirmed Outbreak
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-900">
                    Red
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1">
                  {outbreakCount} <span className="text-[11px] font-normal text-rose-900">barangay{outbreakCount !== 1 ? 's' : ''}</span>
                </div>
                <p className="text-[9.5px] text-slate-500 mt-0.5 hidden sm:block truncate">
                  &ge; 1 confirmed case triggers Red site flag
                </p>
              </div>

              {/* KPI 2: Monitoring Radius (Orange) */}
              <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-amber-200/90 rounded-xl p-2.5 sm:p-3 shadow-md hover:border-amber-400 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                    Monitoring Radius
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                    Orange
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
                  {monitoringCount} <span className="text-[11px] font-normal text-amber-900">barangays</span>
                </div>
                <p className="text-[9.5px] text-slate-500 mt-0.5 hidden sm:block truncate">
                  &le; {monitoringRadiusKm} km from confirmed site
                </p>
              </div>

              {/* KPI 3: Outside Radius (Green) */}
              <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-emerald-200/90 rounded-xl p-2.5 sm:p-3 shadow-md hover:border-emerald-400 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    Outside Radius
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
                    Green
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
                  {safeCount} <span className="text-[11px] font-normal text-emerald-900">barangays</span>
                </div>
                <p className="text-[9.5px] text-slate-500 mt-0.5 hidden sm:block truncate">
                  &gt; {monitoringRadiusKm} km from confirmed site (safe)
                </p>
              </div>

              {/* KPI 4: Buffer Perimeter (Haversine) */}
              <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-indigo-200/90 rounded-xl p-2.5 sm:p-3 shadow-md hover:border-indigo-400 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                    <Radio className="size-3 text-indigo-600 shrink-0" />
                    Buffer Perimeter
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900">
                    Haversine
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-1">
                  {monitoringRadiusKm.toFixed(1)} <span className="text-[11px] font-normal text-indigo-900">km</span>
                </div>
                <p className="text-[9.5px] text-slate-500 mt-0.5 hidden sm:block truncate">
                  Geodesic spherical buffer (R = 6,371 km)
                </p>
              </div>
            </div>
          </div>

          {/* Floating Dynamic Map Legend (bottom-left) */}
          <div className="absolute bottom-3 left-3 z-[900] bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-2.5 shadow-md text-xs space-y-1.5 max-w-[220px]">
            <span className="font-black text-[10px] uppercase text-slate-500 tracking-wider block">
              Spatial Risk Legend
            </span>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-red-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-800">
                Red &mdash; Confirmed Outbreak (&ge;1)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-amber-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-800">
                Orange &mdash; Within Radius (&le;{monitoringRadiusKm}km)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-emerald-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-800">
                Green &mdash; Outside Radius (Safe)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Inspection & Proximity Registry (Placed UNDER the Full-Width Map) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Selected Barangay Spotlight Card */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md border border-slate-800 space-y-3 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Inspected Barangay
                  </span>
                  <h3 className="text-base font-black text-white">
                    Brgy. {selectedProfile.name}
                  </h3>
                </div>
                <span
                  className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: selectedProfile.color,
                    color: selectedProfile.category === 'monitoring_radius' ? '#7c2d12' : '#ffffff',
                  }}
                >
                  {selectedProfile.category.replaceAll('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                <div className="bg-slate-800/80 p-2.5 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Cattle Count</span>
                  <span className="text-base font-black text-white">{selectedProfile.cattle} heads</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Geodesic Distance</span>
                  <span className="text-base font-black text-amber-300">
                    {selectedProfile.distanceToOutbreakKm !== null
                      ? `${selectedProfile.distanceToOutbreakKm.toFixed(2)} km`
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Why is this barangay colored this way? Explanation */}
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs space-y-1 mt-3">
                <span className="font-bold text-amber-400 flex items-center gap-1 text-[11px]">
                  <HelpCircle className="size-3" />
                  Why is Brgy. {selectedProfile.name} {selectedProfile.category === 'confirmed_outbreak' ? 'Red' : selectedProfile.category === 'monitoring_radius' ? 'Orange' : 'Green'}?
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {selectedProfile.category === 'confirmed_outbreak' && (
                    <>This barangay has <strong>{selectedProfile.confirmedCases} confirmed case{selectedProfile.confirmedCases > 1 ? 's' : ''}</strong>. Per municipal surveillance protocol, any confirmed case flags the host barangay as <strong>Red (Outbreak Site)</strong> immediately.</>
                  )}
                  {selectedProfile.category === 'monitoring_radius' && (
                    <>
                      Proximity exposure from confirmed outbreak in Brgy. {selectedProfile.nearestOutbreakSource} ({selectedProfile.distanceToOutbreakKm?.toFixed(2)} km &le; {monitoringRadiusKm} km radius). <strong>Herds are potentially exposed, but there are zero confirmed infected animals in this barangay</strong> &mdash; classified as <strong>Orange (Precautionary Surveillance)</strong>.
                    </>
                  )}
                  {selectedProfile.category === 'safe' && (
                    <>
                      {selectedProfile.nearestOutbreakSource
                        ? `Outside the ${monitoringRadiusKm} km surveillance perimeter (${selectedProfile.distanceToOutbreakKm?.toFixed(2)} km from Brgy. ${selectedProfile.nearestOutbreakSource}) with 0 confirmed cases — classified as Green (Safe / Low Risk).`
                        : 'No confirmed outbreaks currently reported in Padre Garcia — classified as Green (Safe).'}
                    </>
                  )}
                </p>
              </div>

              {selectedProfile.suspectedCases > 0 && (
                <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-600/40 text-[11px] text-amber-200 mt-2">
                  ⚠️ <strong>{selectedProfile.suspectedCases} Suspected observation(s)</strong> on file. Remains in monitoring status and does NOT flag the barangay Red until verified by SIBAT/MAO.
                </div>
              )}
            </div>

            {/* Quick action button in Click-to-Test mode */}
            {activeScenario === 'custom-click' && selectedProfile.name !== selectedOutbreakSite && (
              <button
                type="button"
                onClick={() => setSelectedOutbreakSite(selectedProfile.name)}
                className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs mt-3"
              >
                <Radio className="size-3.5" /> Set Brgy. {selectedProfile.name} as Outbreak Epicenter
              </button>
            )}
          </div>
        </div>

        {/* All Barangays Distance Matrix Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-800 uppercase tracking-tight text-xs">
                Barangay Proximity Registry ({BARANGAY_NAMES.length})
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono font-semibold">
                {confirmedSites.length > 0 ? `Near Outbreaks` : `From ${selectedOutbreakSite}`}
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Click any barangay to inspect
            </span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-[360px]">
            {sortedBarangayList.map((row) => {
              const isSelected = row.name === selectedBarangayForDetail;
              return (
                <button
                  key={row.name}
                  type="button"
                  onClick={() => {
                    setSelectedBarangayForDetail(row.name);
                    if (activeScenario === 'custom-click') {
                      setSelectedOutbreakSite(row.name);
                    }
                  }}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected ? 'bg-amber-50/80 border-l-4 border-l-amber-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 pr-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {row.name}
                      </span>
                      {row.name === selectedOutbreakSite && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold border border-rose-200">
                          Epicenter
                        </span>
                      )}
                      {row.name === 'Manggas' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-900 font-bold">
                          Farmer
                        </span>
                      )}
                      {row.suspectedCases > 0 && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                          Suspect
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                      <span>
                        {row.distanceToOutbreakKm !== null
                          ? `${row.distanceToOutbreakKm.toFixed(2)} km away`
                          : 'Outbreak site'}
                      </span>
                      <span>&middot;</span>
                      <span>{row.cattle} cattle heads</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full inline-block"
                      style={{
                        backgroundColor: row.color,
                        color: row.category === 'monitoring_radius' ? '#7c2d12' : '#ffffff',
                      }}
                    >
                      {row.category === 'confirmed_outbreak' ? 'Red' : row.category === 'monitoring_radius' ? 'Orange' : 'Green'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Educational Methodology Rationale */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5 shadow-2xs space-y-3 text-xs leading-relaxed text-amber-950">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-amber-700 shrink-0" />
          <h4 className="font-bold text-amber-950 text-sm">
            SmartLivestock Biosurveillance &amp; Haversine Spatial Risk Methodology
          </h4>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-slate-700">
          <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full bg-amber-500" />
              Why is Manggas classified as Orange when it has zero infected cattle?
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Barangay Manggas is geographically close to the confirmed outbreak site in neighboring Barangay A (Bawi) ({HAVERSINE_DISTANCES['Bawi']?.['Manggas']?.toFixed(2)} km &le; {monitoringRadiusKm} km buffer). Livestock herds are potentially exposed due to proximity and airborne transmission risk, but <strong>this does not mean Manggas is infected</strong>. It is placed under an Orange precautionary monitoring perimeter so biosecurity can be tightened early.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full bg-rose-600" />
              Why does a barangay turn Red immediately with just 1 confirmed case?
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Outbreak response protocol does not wait for dozens of cattle to show symptoms before flagging high risk. Even a <strong>single confirmed case</strong> immediately triggers Red (Outbreak Site) status to activate municipal quarantine checkpoints, perimeter disinfection, and containment before widespread secondary spread occurs.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <AlertCircle className="size-3 text-amber-600" />
              What happens with a Suspected (Unvalidated) Field Report?
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Reports that are <em>suspected but not yet clinically validated</em> do not trigger a confirmed outbreak. The system flags the observation with an Amber caution badge for priority SIBAT/CBAT ground inspection, but <strong>never turns the entire barangay Red</strong> prematurely, preventing unnecessary market panics and false quarantines.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <Navigation className="size-3 text-indigo-600" />
              How does the Haversine Great-Circle Algorithm work?
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              The Haversine formula computes the exact geodesic distance across the spherical Earth surface between GPS centroids of each barangay. Whenever the calculated distance from a confirmed outbreak falls within the biosecurity buffer (&le; {monitoringRadiusKm} km), the barangay automatically transitions into the Orange Precautionary Zone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
