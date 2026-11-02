'use client';

/**
 * ============================================================================
 * Spatial Report-Alert Monitor & Scenario Sandbox (`haversine.tsx`)
 * Municipality of Padre Garcia, Batangas — Municipal Agriculture Office (MAO)
 * ============================================================================
 *
 * SPATIAL RISK CLASSIFICATION RULES:
 * ----------------------------------------------------------------------------
 * 1. Host Barangay with >= 1 recent approved report requiring follow-up -> RED (Report Alert)
 *    This is a precautionary map flag for field verification, not a clinical diagnosis
 *    or a declaration that an outbreak is confirmed.
 *
 * 2. Nearby Barangays within Haversine Monitoring Radius -> ORANGE (Precautionary Zone)
 *    e.g., Barangay Manggas when a recent approved report alert is mapped in Bawi.
 *    Manggas has no local report alert, but is within the 3.5 km precautionary
 *    monitoring radius. Proximity does not prove exposure or infection.
 *
 * 3. Barangays outside the report-alert radius -> GREEN (No mapped alert)
 *    This does not establish that disease is absent.
 *
 * 4. Suspected but Unvalidated Reports:
 *    Unapproved field submissions do NOT trigger the approved-report alert layer.
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

// Helper component to auto-resize and fit Leaflet canvas when opened in tabs, modals, or resized
function MapAutoFitAndResize() {
  const map = useMap();

  useEffect(() => {
    // Immediate and staged invalidations to catch tab mounts and CSS transitions
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 60);
    const t2 = setTimeout(() => map.invalidateSize(), 200);
    const t3 = setTimeout(() => map.invalidateSize(), 500);

    const container = map.getContainer();
    if (!container) return;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        map.invalidateSize();
      });
      ro.observe(container);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (ro) ro.disconnect();
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
  const { data: fetchedGisData } = useQuery<GISTelemetryResponse>({
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
      // Recent approved reports requiring follow-up; this source does not prove clinical confirmation.
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

  // Barangays with recent approved report alerts in the current state
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
        // RULE 1: >= 1 recent approved report requiring follow-up -> RED precautionary report alert.
        profiles[name] = {
          name,
          confirmedCases: confirmed,
          suspectedCases: suspected,
          cattle,
          category: 'confirmed_outbreak',
          categoryLabel: 'Recent approved report; follow-up needed',
          distanceToOutbreakKm: 0,
          nearestOutbreakSource: name,
          color: RISK_COLORS.confirmed_outbreak.hex,
          fillOpacity: 0.78,
        };
      } else {
        // Calculate distance to the closest report-alert location.
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
          // RULE 2: No local report alert but within radius -> ORANGE (precautionary monitoring).
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
          // RULE 3: Outside the radius -> GREEN (no mapped report alert; not proof of no disease).
          profiles[name] = {
            name,
            confirmedCases: 0,
            suspectedCases: suspected,
            cattle,
            category: 'safe',
            categoryLabel: 'Outside Report-Alert Monitoring Radius',
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

  // Direct GeoJSON vector feature styling function (synchronous on mount & updates)
  const getFeatureStyle = useCallback((feature?: Feature) => {
    const name: string = feature?.properties?.name;
    const profile = riskProfiles[name];
    if (!profile) {
      return {
        fillColor: '#10b981',
        fillOpacity: 0.32,
        color: '#047857',
        weight: 1.5,
      };
    }
    return {
      fillColor: profile.color,
      fillOpacity: profile.fillOpacity,
      color: profile.category === 'confirmed_outbreak' ? '#b91c1c' : profile.category === 'monitoring_radius' ? '#c2410c' : '#047857',
      weight: profile.name === selectedBarangayForDetail ? 3.5 : profile.category === 'confirmed_outbreak' ? 2.5 : 1.5,
      dashArray: profile.category === 'monitoring_radius' ? '4, 4' : undefined,
    };
  }, [riskProfiles, selectedBarangayForDetail]);

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
             ⚠️ ${profile.suspectedCases} report${profile.suspectedCases > 1 ? 's are' : ' is'} waiting for review
           </div>`
        : '';

      const statusDescription = profile.category === 'confirmed_outbreak'
        ? `<div style="color:#dc2626;font-weight:bold">🚨 Recent approved disease report; needs follow-up</div>`
        : profile.category === 'monitoring_radius'
        ? `<div style="color:#d97706;font-weight:bold">🟠 Near a report (${profile.distanceToOutbreakKm?.toFixed(2)} km from ${profile.nearestOutbreakSource})</div>
           <div style="font-size:10.5px;color:#4b5563">Extra monitoring suggested; distance does not mean animals are infected.</div>`
        : `<div style="color:#16a34a;font-weight:bold">✅ No recent report shown</div>`;

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
              <div>🦠 <b>Reports needing follow-up:</b> ${profile.confirmedCases}</div>
            </div>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:6px 0"/>
            <div style="font-size:10px;color:#64748b">
              ${profile.nearestOutbreakSource
                ? `Approx. distance between barangay centers (Brgy. ${name} and ${profile.nearestOutbreakSource}): <b>${profile.distanceToOutbreakKm?.toFixed(2)} km</b>`
                : 'No recent report is shown on this map; this does not mean there is no disease'}
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
    if (dayIndex === 0) return 'Example starts';
    if (dayIndex <= 3) return 'Days 1-3: Starting area';
    if (dayIndex <= 8) return 'Days 4-8: Nearby areas';
    if (dayIndex <= 14) return 'Days 9-14: Wider area';
    if (dayIndex <= 21) return 'Days 15-21: Example checks';
    return 'Days 22-30: Example ends';
  }, [dayIndex]);

  if (!isMounted) return null;

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* 1. Sleek Compact Subheader & Mode Selector Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5 pb-0.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-rose-600 animate-pulse" />
            <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Activity className="size-4 text-rose-600" />
              Disease Report Map
            </span>
          </div>
          {gisData && (
            <span aria-live="polite" className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${activeScenario === 'live' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-300'}`}>
              <Database className="size-3 text-emerald-600" />
              {activeScenario === 'live'
                ? `Current data · ${totalCattleCount.toLocaleString()} animals`
                : 'Example mode · live records unchanged'}
            </span>
          )}
          <span className="hidden md:inline text-[11px] text-slate-400 font-mono">
            Report locations &middot; extra monitoring within {monitoringRadiusKm.toFixed(1)} km
          </span>
        </div>

        {/* Mode Selector */}
        <div className="flex flex-wrap items-center gap-1">
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
              Current Data
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
              Try a Map Example
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
              30-Day Example
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveScenario('manggas-scenario');
                setSelectedOutbreakSite('Bawi');
                setSelectedBarangayForDetail('Manggas');
                setHasSuspectedCaseInManggas(true);
                setDayIndex(0);
                setIsPlaying(false);
              }}
              aria-pressed={activeScenario === 'manggas-scenario'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeScenario === 'manggas-scenario'
                  ? 'bg-amber-600 text-white shadow-xs border border-amber-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className={`size-3.5 ${activeScenario === 'manggas-scenario' ? 'text-amber-100' : 'text-amber-600'}`} />
              Load Manggas Example
            </button>
          </div>
        </div>
      </div>

      {/* 2. Executive Spatial KPIs (Outside Map Canvas) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {/* KPI 1: Recent Report Alerts (Red) */}
        <div className="bg-white border border-rose-200/90 rounded-2xl p-3.5 shadow-2xs hover:border-rose-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-600 shrink-0" />
              Recent Reports Needing Follow-up
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-900">
              Red
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1">
            {outbreakCount} <span className="text-xs font-normal text-rose-900">barangay{outbreakCount !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            One recent approved report can trigger this map alert. It does not confirm disease.
          </p>
        </div>

        {/* KPI 2: Monitoring Radius (Orange) */}
        <div className="bg-white border border-amber-200/90 rounded-2xl p-3.5 shadow-2xs hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500 shrink-0" />
              Nearby Report Areas
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
              Orange
            </span>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {monitoringCount} <span className="text-xs font-normal text-amber-900">barangays</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            Within {monitoringRadiusKm} km of a report location
          </p>
        </div>

        {/* KPI 3: Outside Radius (Green) */}
        <div className="bg-white border border-emerald-200/90 rounded-2xl p-3.5 shadow-2xs hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              No Nearby Report Shown
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
              Green
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {safeCount} <span className="text-xs font-normal text-emerald-900">barangays</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            This does not mean disease is absent
          </p>
        </div>

        {/* KPI 4: Buffer Perimeter (Haversine) */}
        <div className="bg-white border border-indigo-200/90 rounded-2xl p-3.5 shadow-2xs hover:border-indigo-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
              <Radio className="size-3 text-indigo-600 shrink-0" />
              Extra Monitoring Distance
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900">
              Straight-line estimate
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-1">
            {monitoringRadiusKm.toFixed(1)} <span className="text-xs font-normal text-indigo-900">km</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            Estimated distance between barangay centers
          </p>
        </div>
      </div>

      {/* 3. Full-Width Interactive Map Canvas with Overlayed In-Map Controls HUD */}
      <div className="w-full bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
        <div className="bg-slate-900 px-4 py-2.5 flex flex-wrap items-center justify-between text-white text-xs gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-bold tracking-tight">
              Padre Garcia &middot; Disease Report Map
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Extra monitoring distance slider */}
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-lg">
              <Sliders className="size-3 text-amber-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-300">Nearby area:</span>
              <input
                type="range"
                min="1.5"
                max="5.5"
                step="0.5"
                value={monitoringRadiusKm}
                onChange={(e) => setMonitoringRadiusKm(parseFloat(e.target.value))}
                className="w-20 sm:w-28 accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
              />
              <span className="font-mono font-black text-amber-300 text-[11px] min-w-[42px] text-right">
                {monitoringRadiusKm.toFixed(1)} km
              </span>
            </div>

            <span className="hidden sm:inline font-mono text-[11px] text-slate-400">
              {activeScenario === 'simulation'
                ? `Day ${dayIndex}/30 · Starting point: Brgy. ${selectedOutbreakSite}`
                : activeScenario === 'live'
                ? `${confirmedSites.length} Report Areas`
                : `Starting point: Brgy. ${selectedOutbreakSite}`}
            </span>
          </div>
        </div>

        <div className="relative w-full h-[520px] sm:h-[600px] lg:h-[640px] bg-slate-100">
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
              style={getFeatureStyle}
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
                    interactive={false}
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
                  interactive={false}
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

          {/* In-Map Interactive Controls HUD (Overlayed directly on canvas) */}
          <div className="absolute top-2 sm:top-3 left-12 sm:left-14 right-2 sm:right-3 z-[900] pointer-events-none">
            {/* Case A: 30-Day Spread Simulation HUD */}
            {activeScenario === 'simulation' && (
              <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-amber-300/90 rounded-xl p-2.5 sm:p-3 shadow-xl space-y-2 text-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Radio className="size-3.5 text-amber-600 animate-pulse shrink-0" />
                    <span className="text-xs font-bold text-slate-900">30-Day Spread Simulation</span>
                    <span className="text-[10px] sm:text-[11px] font-mono font-bold text-amber-800 bg-amber-100/80 border border-amber-300/70 px-2 py-0.5 rounded-md">
                      {timelinePhaseLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-semibold text-slate-600 text-[11px]">Starting point:</span>
                    <select
                      value={selectedOutbreakSite}
                      onChange={(e) => {
                        setSelectedOutbreakSite(e.target.value);
                        setDayIndex(0);
                        setIsPlaying(false);
                      }}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 shadow-2xs cursor-pointer focus:ring-2 focus:ring-amber-500/20"
                    >
                      {BARANGAY_NAMES.map(name => (
                        <option key={name} value={name}>Brgy. {name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Timeline Scrubber */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <span className="flex items-center gap-1 text-amber-800">
                      <Clock className="size-3.5" />
                      Day <span className="text-sm font-black text-slate-900">{dayIndex}</span> of 30
                    </span>
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                      Report locations: <b className="text-rose-600">{outbreakCount}</b> &middot; Nearby: <b className="text-amber-600">{monitoringCount}</b> &middot; No report shown: <b className="text-emerald-600">{safeCount}</b>
                    </span>
                  </div>

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

                  <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5 select-none">
                    <span>Start</span>
                    <span>Day 5</span>
                    <span>Day 10</span>
                    <span>Day 15</span>
                    <span>Day 22</span>
                    <span>Day 30</span>
                  </div>
                </div>

                {/* Playback Controls & Speed Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsPlaying(p => !p)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                      className="p-1 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
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
                      className="p-1 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
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
                      className="flex items-center gap-1 px-2 py-1 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer text-xs"
                      title="Reset simulation to Day 0"
                    >
                      <RotateCcw className="size-3" /> Reset
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-semibold">Speed:</span>
                    <button
                      type="button"
                      onClick={() => setPlaybackSpeed(600)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        playbackSpeed === 600 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      1x
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaybackSpeed(300)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        playbackSpeed === 300 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      2x
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Case B: Custom Click Sandbox HUD */}
            {activeScenario === 'custom-click' && (
              <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-indigo-200/90 rounded-xl p-2.5 sm:p-3 shadow-xl space-y-1.5 text-indigo-950">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <MousePointerClick className="size-4 text-indigo-600 shrink-0" />
                    <span className="font-bold">
                      Click a barangay on the map to set the example starting point
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600 text-[11px]">Or select:</span>
                    <select
                      value={selectedOutbreakSite}
                      onChange={(e) => {
                        setSelectedOutbreakSite(e.target.value);
                        setSelectedBarangayForDetail(e.target.value);
                      }}
                      className="bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                      {BARANGAY_NAMES.map(name => (
                        <option key={name} value={name}>
                          Brgy. {name} ({realBarangayData.cattleMap[name] ?? CATTLE_HEADS[name]} heads)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-indigo-800/80">
                  Example starting point: <strong className="text-indigo-950">Brgy. {selectedOutbreakSite}</strong> &middot; The map measures distance to nearby barangays.
                </p>
              </div>
            )}

            {/* Case C: Live Telemetry HUD */}
            {activeScenario === 'live' && (
              <div className={`pointer-events-auto backdrop-blur-md border rounded-xl p-2.5 sm:p-3 shadow-xl text-xs flex flex-wrap items-center justify-between gap-2.5 ${
                realBarangayData.hasRealConfirmedOutbreaks
                  ? 'bg-rose-50/95 border-rose-200 text-rose-950'
                  : 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              }`}>
                <div className="flex items-center gap-2">
                  {realBarangayData.hasRealConfirmedOutbreaks ? (
                    <ShieldAlert className="size-4 text-rose-600 shrink-0" />
                  ) : (
                    <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">
                      {realBarangayData.hasRealConfirmedOutbreaks
                        ? `${confirmedSites.length} barangay(s) have recent approved reports needing follow-up`
                        : 'No recent approved reports needing follow-up are shown on this map'}
                    </span>
                    <span className="text-[11px] opacity-80 ml-2 hidden md:inline">
                      {realBarangayData.hasRealConfirmedOutbreaks
                        ? `(${confirmedSites.slice(0, 4).join(', ')}${confirmedSites.length > 4 ? ` +${confirmedSites.length - 4} more` : ''}) · nearby areas are marked Orange`
                        : 'The map only shows reports entered in the system; no marker does not mean no disease.'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveScenario('custom-click');
                      setSelectedOutbreakSite('Bawi');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-50 transition-colors cursor-pointer text-xs shadow-2xs"
                  >
                    🎯 Click-to-Test &rarr;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveScenario('simulation');
                      setDayIndex(0);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors cursor-pointer text-xs shadow-2xs"
                  >
                    ▶ 30-Day Spread &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* Case D: Manggas Case Study HUD */}
            {activeScenario === 'manggas-scenario' && (
              <div className="pointer-events-auto bg-amber-50/95 backdrop-blur-md border border-amber-200 rounded-xl p-2.5 sm:p-3 shadow-xl text-xs flex flex-wrap items-center justify-between gap-2.5 text-amber-950">
                <div>
                  <p className="font-bold">Sample scenario loaded</p>
                  <p className="mt-0.5 text-[11px]">Bawi has the example report alert. Manggas {hasSuspectedCaseInManggas ? 'shows' : 'can show'} one unreviewed report.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-600 shrink-0" />
                  <label htmlFor="suspected-manggas-toggle" className="font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="suspected-manggas-toggle"
                      checked={hasSuspectedCaseInManggas}
                      onChange={(e) => setHasSuspectedCaseInManggas(e.target.checked)}
                      className="size-3.5 rounded accent-amber-600 cursor-pointer mr-2 align-middle"
                    />
                    Include 1 <strong>unreviewed report</strong> in Brgy. Manggas
                  </label>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300/60 font-bold">
                  Reports waiting for review are shown separately. Approval does not confirm disease.
                </span>
              </div>
            )}
          </div>

          {/* Floating Dynamic Map Legend (bottom-left) */}
          <div className="absolute bottom-3 left-3 z-[900] bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-2.5 shadow-md text-xs space-y-1.5 max-w-[220px]">
            <span className="font-black text-[10px] uppercase text-slate-500 tracking-wider block">
              Map Colors
            </span>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-red-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-800">
                Red &mdash; Recent approved report needs follow-up
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-amber-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-800">
                Orange &mdash; Within {monitoringRadiusKm} km of a report
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-emerald-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-800">
                Green &mdash; No recent report shown
              </span>
            </div>
          </div>
        </div>
      </div>

        {/* 4. Report Locations and Nearby Barangays */}
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
                  <span className="text-slate-400 text-[10px] block">Distance from report</span>
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
                  Why is Brgy. {selectedProfile.name} shown in {selectedProfile.category === 'confirmed_outbreak' ? 'Red' : selectedProfile.category === 'monitoring_radius' ? 'Orange' : 'Green'}?
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {selectedProfile.category === 'confirmed_outbreak' && (
                    <>The map found <strong>{selectedProfile.confirmedCases} recent approved disease report{selectedProfile.confirmedCases > 1 ? 's' : ''} needing follow-up</strong>. This does not confirm that animals have the disease.</>
                  )}
                  {selectedProfile.category === 'monitoring_radius' && (
                    <>
                      Brgy. {selectedProfile.name} is {selectedProfile.distanceToOutbreakKm?.toFixed(2)} km from a recent report in {selectedProfile.nearestOutbreakSource}. Orange means field staff should keep an extra watch; being nearby does not mean animals are infected.
                    </>
                  )}
                  {selectedProfile.category === 'safe' && (
                    <>
                      {selectedProfile.nearestOutbreakSource
                        ? `${selectedProfile.distanceToOutbreakKm?.toFixed(2)} km from Brgy. ${selectedProfile.nearestOutbreakSource}; no recent report is shown for this barangay. Green does not mean disease is absent.`
                        : 'No recent report is shown for this barangay. Green does not mean disease is absent.'}
                    </>
                  )}
                </p>
              </div>

              {selectedProfile.suspectedCases > 0 && (
                <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-600/40 text-[11px] text-amber-200 mt-2">
                  ⚠️ <strong>{selectedProfile.suspectedCases} report(s) are still waiting for review.</strong> They do not trigger the Red map alert until approved by field staff or MAO.
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
                <Radio className="size-3.5" /> Use Brgy. {selectedProfile.name} as the example starting point
              </button>
            )}
          </div>
        </div>

        {/* All Barangays Distance Matrix Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-800 uppercase tracking-tight text-xs">
                Nearby Barangays ({BARANGAY_NAMES.length})
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono font-semibold">
                {confirmedSites.length > 0 ? `Near recent reports` : `From ${selectedOutbreakSite}`}
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
                          Starting point
                        </span>
                      )}
                      {row.name === 'Manggas' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-900 font-bold">
                          Farmer
                        </span>
                      )}
                      {row.suspectedCases > 0 && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                          Waiting for review
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500">
                      <span>
                        {row.distanceToOutbreakKm !== null
                          ? `${row.distanceToOutbreakKm.toFixed(2)} km from report`
                          : 'Report location'}
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
            About this map
          </h4>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 text-slate-700">
          <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full bg-amber-500" />
              Why is Manggas Orange when no disease is confirmed there?
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              In this example, Manggas is {HAVERSINE_DISTANCES['Bawi']?.['Manggas']?.toFixed(2)} km from the report location in Bawi. Orange asks field staff to keep an extra watch; it does not mean animals there are infected.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full bg-rose-600" />
              Why does one approved report turn a barangay Red?
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              One approved report from the last 90 days can turn the barangay Red if it is still open or has no outcome recorded. This tells field staff to follow up; approval alone does <strong>not</strong> confirm disease or start a quarantine.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <AlertCircle className="size-3 text-amber-600" />
              What happens to a report that is still waiting for review?
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Reports still waiting for review are kept separate from this map. An approved report can still need follow-up; approval does <strong>not</strong> mean the disease has been confirmed.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <Navigation className="size-3 text-indigo-600" />
              How does the map measure distance?
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              It estimates the distance between barangay centers while accounting for the Earth&apos;s curve. Barangays whose centers are within {monitoringRadiusKm} km of a report barangay are marked Orange for extra monitoring. This does not mean animals are infected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
