'use client';

/**
 * ============================================================================
 * Haversine Epidemic Risk Classifier & Spatial Forecaster (`haversine.tsx`)
 * Municipality of Padre Garcia, Batangas — Municipal Agriculture Office (MAO)
 * ============================================================================
 *
 * SPATIAL RISK CLASSIFICATION RULES:
 * ----------------------------------------------------------------------------
 * 1. Host Barangay with >= 1 Confirmed FMD Case -> RED (Confirmed Outbreak Site)
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
import type { Feature, FeatureCollection } from "geojson";
import type { GeoJSON as LeafletGeoJSON, Path, LeafletMouseEvent } from "leaflet";
import 'leaflet/dist/leaflet.css';
import {
  Activity,
  AlertCircle,
  HelpCircle,
  Info,
  Navigation,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
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

// Approved active cattle inventory baseline per barangay
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

export default function PadreGarciaForecaster() {
  const isMounted = useClientReady();
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null);

  // Scenario selection:
  // - 'manggas-scenario': Case Study (1 confirmed in Bawi, Manggas within radius -> Orange, Far -> Green)
  // - 'custom-click': Click any barangay to place 1 confirmed case and see dynamic Haversine radius
  // - 'simulation': Multi-day aerosol epidemic progression
  const [activeScenario, setActiveScenario] = useState<'manggas-scenario' | 'custom-click' | 'simulation'>('manggas-scenario');
  const [monitoringRadiusKm, setMonitoringRadiusKm] = useState<number>(3.5);
  const [selectedOutbreakSite, setSelectedOutbreakSite] = useState<string>('Bawi');
  const [hasSuspectedCaseInManggas, setHasSuspectedCaseInManggas] = useState<boolean>(true);
  const [selectedBarangayForDetail, setSelectedBarangayForDetail] = useState<string>('Manggas');

  // Simulation day states
  const [dayIndex, setDayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const speed = 700;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Confirmed cases by barangay depending on active scenario
  const confirmedCasesMap: Record<string, number> = useMemo(() => {
    if (activeScenario === 'manggas-scenario') {
      return { [selectedOutbreakSite]: 1 };
    }
    if (activeScenario === 'custom-click') {
      return { [selectedOutbreakSite]: 1 };
    }
    // Simulation mode seed spread
    const seed: Record<string, number> = { 'Bawi': 1 };
    if (dayIndex > 5) seed['Pansol'] = Math.min(6, Math.floor(dayIndex * 0.4));
    if (dayIndex > 10) seed['Manggas'] = Math.min(4, Math.floor((dayIndex - 10) * 0.3));
    if (dayIndex > 15) seed['Banaba'] = Math.min(8, Math.floor((dayIndex - 15) * 0.5));
    return seed;
  }, [activeScenario, selectedOutbreakSite, dayIndex]);

  // Suspected cases (unvalidated field reports)
  const suspectedCasesMap: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    if (hasSuspectedCaseInManggas) {
      map['Manggas'] = 1;
    }
    return map;
  }, [hasSuspectedCaseInManggas]);

  // Spatial evaluation using Haversine Geodesic Distance
  const riskProfiles: Record<string, BarangayRiskProfile> = useMemo(() => {
    const profiles: Record<string, BarangayRiskProfile> = {};
    const confirmedSites = BARANGAY_NAMES.filter(name => (confirmedCasesMap[name] ?? 0) >= 1);

    for (const name of BARANGAY_NAMES) {
      const confirmed = confirmedCasesMap[name] ?? 0;
      const suspected = suspectedCasesMap[name] ?? 0;
      const cattle = CATTLE_HEADS[name] ?? 0;

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
            categoryLabel: 'Outside Monitoring Radius',
            distanceToOutbreakKm: Number.isFinite(minDistance) ? minDistance : null,
            nearestOutbreakSource: closestSite,
            color: RISK_COLORS.safe.hex,
            fillOpacity: 0.32,
          };
        }
      }
    }
    return profiles;
  }, [confirmedCasesMap, suspectedCasesMap, monitoringRadiusKm]);

  // Simulation play interval
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying && activeScenario === 'simulation') {
      intervalRef.current = setInterval(() => {
        setDayIndex(prev => {
          if (prev >= 30) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, activeScenario]);

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
             ⚠️ 1 Suspected Observation (Pending SIBAT/MAO Verification — NOT confirmed)
           </div>`
        : '';

      const statusDescription = profile.category === 'confirmed_outbreak'
        ? `<div style="color:#dc2626;font-weight:bold">🚨 Confirmed FMD Case Reported (Outbreak Site)</div>`
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
              Haversine geodesic dist to ${selectedOutbreakSite}: <b>${HAVERSINE_DISTANCES[selectedOutbreakSite]?.[name]?.toFixed(2)} km</b>
            </div>
          </div>
        </div>
      `);
    });
  }, [riskProfiles, selectedOutbreakSite, selectedBarangayForDetail]);

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

  const selectedProfile = riskProfiles[selectedBarangayForDetail] || riskProfiles['Manggas'];

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
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 mt-0.5">
            <Activity className="size-5 text-rose-600" />
            Foot-and-Mouth Disease (FMD) Spatial Risk Classifier
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Geodesic proximity buffer &middot; Precautionary monitoring &middot; Single-case outbreak trigger
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setActiveScenario('manggas-scenario');
                setSelectedOutbreakSite('Bawi');
                setIsPlaying(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeScenario === 'manggas-scenario'
                  ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Manggas Scenario
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveScenario('custom-click');
                setIsPlaying(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeScenario === 'custom-click'
                  ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Click-to-Test
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveScenario('simulation');
                setDayIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeScenario === 'simulation'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Timeline Spread
            </button>
          </div>

          {activeScenario === 'simulation' && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
              <button
                type="button"
                onClick={() => setIsPlaying(p => !p)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isPlaying ? 'bg-amber-100 text-amber-800' : 'bg-emerald-700 text-white'
                }`}
              >
                {isPlaying ? <><Pause className="size-3.5" /> Pause</> : <><Play className="size-3.5" /> Run</>}
              </button>
              <button
                type="button"
                onClick={() => { setIsPlaying(false); setDayIndex(0); }}
                className="p-1 text-slate-500 hover:bg-slate-200 rounded cursor-pointer"
                title="Reset simulation"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <span className="text-xs font-mono font-bold text-slate-700">Day {dayIndex}/30</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Interactive Radius & Scenario Controls Bar */}
      <div className="bg-gradient-to-r from-slate-50 via-white to-amber-50/40 border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Outbreak Source Selector */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Radio className="size-3.5 text-rose-600" />
              Confirmed Outbreak Site (Red):
            </span>
            <select
              value={selectedOutbreakSite}
              onChange={(e) => setSelectedOutbreakSite(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              {BARANGAY_NAMES.map(name => (
                <option key={name} value={name}>
                  Brgy. {name} ({CATTLE_HEADS[name]} cattle)
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500">
              (1 confirmed case flags this barangay)
            </span>
          </div>

          {/* Haversine Monitoring Radius Slider */}
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-700 flex items-center gap-1 shrink-0">
              <Sliders className="size-3.5 text-amber-600" />
              Haversine Monitoring Radius:
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
        </div>

        {/* Suspected Case in Manggas Toggle (Testing unvalidated rule) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="suspected-manggas-toggle"
              checked={hasSuspectedCaseInManggas}
              onChange={(e) => setHasSuspectedCaseInManggas(e.target.checked)}
              className="size-4 rounded accent-amber-600 cursor-pointer"
            />
            <label htmlFor="suspected-manggas-toggle" className="font-medium text-slate-700 cursor-pointer select-none">
              Include 1 <strong>Suspected (Unvalidated)</strong> Report in Brgy. Manggas
            </label>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300/60 font-semibold">
              Rule: Unvalidated ≠ Confirmed Outbreak
            </span>
          </div>

          <p className="text-[11px] text-slate-500 italic">
            Tip: Click any barangay polygon on the map to inspect its geodesic exposure and cattle heads.
          </p>
        </div>
      </div>

      {/* 3. Summary Triage Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-rose-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-600" />
              Confirmed Outbreak
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-900">
              Red
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1">
            {outbreakCount} <span className="text-xs font-normal text-rose-900">barangay</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            &ge; 1 confirmed case triggers immediate Red site flag
          </p>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500" />
              Monitoring Radius
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
              Orange
            </span>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-1">
            {monitoringCount} <span className="text-xs font-normal text-amber-900">barangays</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            &le; {monitoringRadiusKm} km from confirmed site; 0 confirmed cases
          </p>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              Outside Radius
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
              Green
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {safeCount} <span className="text-xs font-normal text-emerald-900">barangays</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            &gt; {monitoringRadiusKm} km from confirmed site; low exposure
          </p>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
              <Radio className="size-3.5 text-indigo-600" />
              Buffer Perimeter
            </span>
            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900">
              Haversine
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-1">
            {monitoringRadiusKm.toFixed(1)} <span className="text-xs font-normal text-indigo-900">km</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Geodesic spherical buffer radius (R = 6,371 km)
          </p>
        </div>
      </div>

      {/* 4. Map & Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Map Canvas */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col h-[380px] sm:h-[440px]">
          <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between text-white text-xs">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-rose-500 animate-ping" />
              <span className="font-bold tracking-tight">
                Padre Garcia GIS &middot; Haversine Spatial Risk Canvas
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              Outbreak: Brgy. {selectedOutbreakSite} &middot; Radius: {monitoringRadiusKm} km
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
              <TileLayer
                attribution='&copy; CARTO &copy; OpenStreetMap'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />

              <GeoJSON
                ref={geoJsonRef}
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
                      setSelectedBarangayForDetail(bName);
                      if (activeScenario === 'custom-click') {
                        setSelectedOutbreakSite(bName);
                      }
                    },
                    mouseover: (e: LeafletMouseEvent) => {
                      e.target.setStyle({ weight: 3.5, fillOpacity: 0.90 });
                    },
                    mouseout: (e: LeafletMouseEvent) => {
                      const prof = riskProfiles[bName];
                      if (prof) {
                        e.target.setStyle({
                          weight: bName === selectedBarangayForDetail ? 3.5 : prof.category === 'confirmed_outbreak' ? 2.5 : 1.5,
                          fillOpacity: prof.fillOpacity,
                        });
                      }
                    },
                  });
                }}
              />

              {/* Haversine Monitoring Radius Perimeter Buffer Circle */}
              {BARANGAY_CENTROIDS[selectedOutbreakSite] && (
                <Circle
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
              )}
            </MapContainer>

            {/* Floating Dynamic Map Legend */}
            <div className="absolute bottom-3 left-3 z-[900] bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-2.5 shadow-md text-xs space-y-1.5 max-w-[210px]">
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

        {/* Sidebar: Details & Sorted Barangay Table */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Selected Barangay Spotlight Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md border border-slate-800 space-y-3">
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
                className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: selectedProfile.color,
                  color: selectedProfile.category === 'monitoring_radius' ? '#7c2d12' : '#ffffff',
                }}
              >
                {selectedProfile.category.replaceAll('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/80 p-2.5 rounded-xl">
                <span className="text-slate-400 text-[10px] block">Cattle Count</span>
                <span className="text-base font-black text-white">{selectedProfile.cattle} heads</span>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-xl">
                <span className="text-slate-400 text-[10px] block">Haversine Distance</span>
                <span className="text-base font-black text-amber-300">
                  {selectedProfile.distanceToOutbreakKm !== null
                    ? `${selectedProfile.distanceToOutbreakKm.toFixed(2)} km`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Why is this barangay colored this way? Explanation */}
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs space-y-1">
              <span className="font-bold text-amber-400 flex items-center gap-1 text-[11px]">
                <HelpCircle className="size-3" />
                Why is Brgy. {selectedProfile.name} {selectedProfile.category === 'confirmed_outbreak' ? 'Red' : selectedProfile.category === 'monitoring_radius' ? 'Orange' : 'Green'}?
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {selectedProfile.category === 'confirmed_outbreak' && (
                  <>This barangay has <strong>1 confirmed FMD case</strong>. Per municipal surveillance protocol, any confirmed case flags the host barangay as <strong>Red (Outbreak Site)</strong> regardless of cattle count.</>
                )}
                {selectedProfile.category === 'monitoring_radius' && (
                  <>
                    Proximity exposure from the confirmed outbreak in Brgy. {selectedProfile.nearestOutbreakSource} ({selectedProfile.distanceToOutbreakKm?.toFixed(2)} km &le; {monitoringRadiusKm} km radius). <strong>Herds are potentially exposed, but there are zero confirmed infected animals in this barangay</strong> &mdash; classified as <strong>Orange (Precautionary Surveillance)</strong>.
                  </>
                )}
                {selectedProfile.category === 'safe' && (
                  <>
                    Outside the {monitoringRadiusKm} km surveillance perimeter ({selectedProfile.distanceToOutbreakKm?.toFixed(2)} km from Brgy. {selectedProfile.nearestOutbreakSource}) with 0 confirmed cases &mdash; classified as <strong>Green (Low Risk)</strong>.
                  </>
                )}
              </p>
            </div>

            {selectedProfile.suspectedCases > 0 && (
              <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-600/40 text-[11px] text-amber-200">
                ⚠️ <strong>1 Suspected unvalidated report</strong> on file. This remains in monitoring status and does NOT flag the entire barangay as Red until verified and approved by SIBAT and MAO.
              </div>
            )}
          </div>

          {/* All Barangays Distance Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex-1 flex flex-col">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-black text-slate-700 uppercase tracking-tight text-[11px]">
                Barangay Proximity Registry ({BARANGAY_NAMES.length})
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                From {selectedOutbreakSite}
              </span>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-[220px] sm:max-h-[280px]">
              {sortedBarangayList.map((row) => {
                const isSelected = row.name === selectedBarangayForDetail;
                return (
                  <button
                    key={row.name}
                    type="button"
                    onClick={() => setSelectedBarangayForDetail(row.name)}
                    className={`w-full text-left px-3.5 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected ? 'bg-amber-50/70 border-l-4 border-l-amber-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-800 truncate">
                          {row.name}
                        </span>
                        {row.name === 'Manggas' && (
                          <span className="text-[9px] px-1 rounded bg-indigo-100 text-indigo-900 font-bold">
                            Farmer
                          </span>
                        )}
                        {row.suspectedCases > 0 && (
                          <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-900 font-bold">
                            Suspect
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {row.distanceToOutbreakKm !== null
                          ? `${row.distanceToOutbreakKm.toFixed(2)} km away`
                          : 'Outbreak site'}
                        {' '}&middot; {row.cattle} cattle
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block"
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
      </div>

      {/* 5. Educational Methodology Rationale (English) */}
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
              Outbreak response protocol does not wait for dozens of cattle to show symptoms before flagging high risk. Even a <strong>single confirmed FMD case</strong> immediately triggers Red (Outbreak Site) status to activate municipal quarantine checkpoints, perimeter disinfection, and containment before widespread secondary spread occurs.
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