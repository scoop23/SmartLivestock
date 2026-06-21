'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Play, Pause, RotateCcw, ShieldAlert, Calendar,
  Navigation, Activity, Zap, Clock, Beef
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// --- Dynamic Leaflet imports (SSR-safe) ---
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer    = dynamic(() => import('react-leaflet').then(m => m.TileLayer),    { ssr: false });
const GeoJSON      = dynamic(() => import('react-leaflet').then(m => m.GeoJSON),      { ssr: false });
const Circle       = dynamic(() => import('react-leaflet').then(m => m.Circle),       { ssr: false });
const Tooltip      = dynamic(() => import('react-leaflet').then(m => m.Tooltip),      { ssr: false });

// --- Haversine ---
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Barangay data ---
const BARANGAY_CENTROIDS: Record<string, [number, number]> = {
  'Banaba':            [13.8870, 121.2395],
  'Banaybanay':        [13.8910, 121.2220],
  'Bawi':              [13.8860, 121.2510],
  'Bukal':             [13.8850, 121.2640],
  'Castillo':          [13.8810, 121.2210],
  'Cawongan':          [13.8960, 121.2000],
  'Manggas':           [13.9010, 121.2180],
  'Maugat East':       [13.8560, 121.2280],
  'Maugat West':       [13.8590, 121.2060],
  'Pansol':            [13.8785, 121.2438],
  'Payapa':            [13.8700, 121.2190],
  'Poblacion':         [13.8720, 121.2010],
  'Quilo-quilo North': [13.8800, 121.1930],
  'Quilo-quilo South': [13.8760, 121.1810],
  'San Felipe':        [13.8530, 121.2510],
  'San Miguel':        [13.8460, 121.2260],
  'Tamak':             [13.8510, 121.1940],
  'Tangob':            [13.8710, 121.1720],
};

const CATTLE: Record<string, number> = {
  'Banaba': 245, 'Banaybanay': 112, 'Bawi': 198, 'Bukal': 134,
  'Castillo': 143, 'Cawongan': 167, 'Manggas': 76, 'Maugat East': 88,
  'Maugat West': 121, 'Pansol': 156, 'Payapa': 99, 'Poblacion': 87,
  'Quilo-quilo North': 73, 'Quilo-quilo South': 59, 'San Felipe': 182,
  'San Miguel': 95, 'Tamak': 44, 'Tangob': 62,
};

const NAMES = Object.keys(BARANGAY_CENTROIDS);

// Pre-compute distance matrix (km)
const DIST: Record<string, Record<string, number>> = {};
for (const a of NAMES) {
  DIST[a] = {};
  for (const b of NAMES) {
    DIST[a][b] = a === b ? 0 : haversineKm(
      BARANGAY_CENTROIDS[a][0], BARANGAY_CENTROIDS[a][1],
      BARANGAY_CENTROIDS[b][0], BARANGAY_CENTROIDS[b][1],
    );
  }
}

// --- Spread model ---
const DECAY_KM    = 3.5;
const SPREAD_RATE = 0.18;
const CATTLE_W    = 0.004;
const MAX_CASES   = 30;

// Seed cases (FMD outbreak initial points)
const SEED: Record<string, number> = {
  'Bawi': 5, 'Pansol': 2, 'Castillo': 1, 'San Felipe': 1,
};

type Snapshot = Record<string, number>;
const safeNum = (v: any) => (Number.isFinite(v) ? v : 0);

function stepSpread(prev: Snapshot): Snapshot {
  const next = { ...prev };
  for (const tgt of NAMES) {
    if (safeNum(next[tgt]) >= MAX_CASES) continue;
    let pressure = 0;
    for (const src of NAMES) {
      if (src === tgt) continue;
      const srcCases = safeNum(prev[src]);
      if (srcCases === 0) continue;
      const d = DIST[src]?.[tgt];
      if (!Number.isFinite(d)) continue;
      const cattle = safeNum(CATTLE[tgt]);
      const part = Math.exp(-d / DECAY_KM) * Math.log1p(srcCases) * SPREAD_RATE * (1 + cattle * CATTLE_W);
      if (Number.isFinite(part)) pressure += part;
    }
    const current = safeNum(next[tgt]);
    const grow = Math.floor(pressure + (current > 0 ? current * 0.15 : 0));
    next[tgt] = Math.min(MAX_CASES, current + grow);
  }
  return next;
}

function buildTimeline(seed: Snapshot): Snapshot[] {
  const t: Snapshot[] = [{ ...seed }];
  for (let i = 1; i <= 30; i++) t.push(stepSpread(t[i - 1]));
  return t;
}

// --- Risk helpers ---
function riskOf(cases: number): 'none' | 'low' | 'medium' | 'high' | 'critical' {
  if (cases === 0) return 'none';
  if (cases <= 2)  return 'low';
  if (cases <= 6)  return 'medium';
  if (cases <= 15) return 'high';
  return 'critical';
}

const FILL: Record<string, string> = {
  none: '#d1fae5', low: '#6ee7b7', medium: '#fbbf24', high: '#f87171', critical: '#7f1d1d',
};
const RISK_BADGE: Record<string, string> = {
  none: 'bg-gray-100 text-gray-400',
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
  critical: 'bg-red-900 text-red-100',
};

// --- GeoJSON ---
const PADRE_GARCIA_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Banaba' }, geometry: { type: 'Polygon', coordinates: [[[121.2310,13.8920],[121.2480,13.8950],[121.2500,13.8830],[121.2380,13.8780],[121.2280,13.8800],[121.2260,13.8870],[121.2310,13.8920]]] } },
    { type: 'Feature', properties: { name: 'Banaybanay' }, geometry: { type: 'Polygon', coordinates: [[[121.2160,13.8950],[121.2260,13.8960],[121.2310,13.8920],[121.2260,13.8870],[121.2180,13.8850],[121.2120,13.8880],[121.2100,13.8930],[121.2160,13.8950]]] } },
    { type: 'Feature', properties: { name: 'Bawi' }, geometry: { type: 'Polygon', coordinates: [[[121.2480,13.8950],[121.2600,13.8940],[121.2620,13.8800],[121.2520,13.8750],[121.2430,13.8760],[121.2380,13.8780],[121.2500,13.8830],[121.2480,13.8950]]] } },
    { type: 'Feature', properties: { name: 'Bukal' }, geometry: { type: 'Polygon', coordinates: [[[121.2600,13.8940],[121.2720,13.8920],[121.2740,13.8780],[121.2620,13.8750],[121.2520,13.8750],[121.2620,13.8800],[121.2600,13.8940]]] } },
    { type: 'Feature', properties: { name: 'Castillo' }, geometry: { type: 'Polygon', coordinates: [[[121.2180,13.8850],[121.2260,13.8870],[121.2280,13.8800],[121.2220,13.8740],[121.2140,13.8750],[121.2120,13.8800],[121.2180,13.8850]]] } },
    { type: 'Feature', properties: { name: 'Cawongan' }, geometry: { type: 'Polygon', coordinates: [[[121.1900,13.9050],[121.2100,13.9060],[121.2120,13.8930],[121.2100,13.8930],[121.2120,13.8880],[121.2000,13.8850],[121.1880,13.8870],[121.1900,13.9050]]] } },
    { type: 'Feature', properties: { name: 'Manggas' }, geometry: { type: 'Polygon', coordinates: [[[121.2100,13.9060],[121.2260,13.9060],[121.2260,13.8960],[121.2160,13.8950],[121.2100,13.8930],[121.2120,13.8930],[121.2100,13.9060]]] } },
    { type: 'Feature', properties: { name: 'Maugat East' }, geometry: { type: 'Polygon', coordinates: [[[121.2220,13.8600],[121.2340,13.8620],[121.2380,13.8560],[121.2300,13.8490],[121.2200,13.8500],[121.2160,13.8560],[121.2220,13.8600]]] } },
    { type: 'Feature', properties: { name: 'Maugat West' }, geometry: { type: 'Polygon', coordinates: [[[121.2020,13.8650],[121.2140,13.8660],[121.2180,13.8600],[121.2120,13.8540],[121.2020,13.8530],[121.1940,13.8570],[121.1960,13.8640],[121.2020,13.8650]]] } },
    { type: 'Feature', properties: { name: 'Pansol' }, geometry: { type: 'Polygon', coordinates: [[[121.2380,13.8780],[121.2520,13.8750],[121.2540,13.8640],[121.2440,13.8580],[121.2340,13.8620],[121.2260,13.8680],[121.2280,13.8800],[121.2380,13.8780]]] } },
    { type: 'Feature', properties: { name: 'Payapa' }, geometry: { type: 'Polygon', coordinates: [[[121.2140,13.8750],[121.2220,13.8740],[121.2260,13.8680],[121.2180,13.8600],[121.2140,13.8660],[121.2060,13.8660],[121.2060,13.8720],[121.2140,13.8750]]] } },
    { type: 'Feature', properties: { name: 'Poblacion' }, geometry: { type: 'Polygon', coordinates: [[[121.2060,13.8720],[121.2060,13.8660],[121.1960,13.8640],[121.1940,13.8700],[121.1960,13.8760],[121.2040,13.8770],[121.2060,13.8720]]] } },
    { type: 'Feature', properties: { name: 'Quilo-quilo North' }, geometry: { type: 'Polygon', coordinates: [[[121.1880,13.8870],[121.2000,13.8850],[121.2000,13.8770],[121.1960,13.8760],[121.1940,13.8700],[121.1860,13.8720],[121.1840,13.8800],[121.1880,13.8870]]] } },
    { type: 'Feature', properties: { name: 'Quilo-quilo South' }, geometry: { type: 'Polygon', coordinates: [[[121.1840,13.8800],[121.1860,13.8720],[121.1780,13.8700],[121.1760,13.8780],[121.1800,13.8840],[121.1840,13.8800]]] } },
    { type: 'Feature', properties: { name: 'San Felipe' }, geometry: { type: 'Polygon', coordinates: [[[121.2440,13.8580],[121.2540,13.8640],[121.2620,13.8620],[121.2620,13.8500],[121.2520,13.8430],[121.2360,13.8430],[121.2300,13.8490],[121.2380,13.8560],[121.2440,13.8580]]] } },
    { type: 'Feature', properties: { name: 'San Miguel' }, geometry: { type: 'Polygon', coordinates: [[[121.2300,13.8490],[121.2360,13.8430],[121.2260,13.8390],[121.2160,13.8420],[121.2120,13.8490],[121.2160,13.8540],[121.2200,13.8500],[121.2300,13.8490]]] } },
    { type: 'Feature', properties: { name: 'Tamak' }, geometry: { type: 'Polygon', coordinates: [[[121.1940,13.8570],[121.2020,13.8530],[121.2020,13.8460],[121.1940,13.8440],[121.1860,13.8460],[121.1840,13.8540],[121.1880,13.8580],[121.1940,13.8570]]] } },
    { type: 'Feature', properties: { name: 'Tangob' }, geometry: { type: 'Polygon', coordinates: [[[121.1760,13.8780],[121.1780,13.8700],[121.1760,13.8620],[121.1680,13.8620],[121.1660,13.8720],[121.1700,13.8800],[121.1760,13.8780]]] } },
  ],
};

// --- Component ---
export default function PadreGarciaForecaster() {
  const [mode, setMode]               = useState<'real' | 'simulation'>('real');
  const [targetDate, setTargetDate]   = useState('2026-05-15');
  const [isMounted, setIsMounted]     = useState(false);

  // Simulation state
  const [dayIndex, setDayIndex]       = useState(0);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [speed, setSpeed]             = useState(700); 
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geoJsonRef  = useRef<any>(null); 

  const START_DATE = useMemo(() => new Date('2026-04-26T00:00:00'), []);
  const timeline = useMemo(() => buildTimeline(SEED), []);

  useEffect(() => { setIsMounted(true); }, []);

  const activeSnapshot: Snapshot = useMemo(() => {
    if (mode === 'simulation') return timeline[dayIndex] ?? timeline[0];
    const diff = Math.round((new Date(targetDate + 'T00:00:00').getTime() - START_DATE.getTime()) / 86400000);
    const idx = Math.max(0, Math.min(29, diff));
    return timeline[idx] ?? timeline[0];
  }, [mode, dayIndex, targetDate, timeline, START_DATE]);

  const activeDate = useMemo(() => {
    const d = new Date(START_DATE);
    d.setDate(d.getDate() + (mode === 'simulation' ? dayIndex : Math.round(
      (new Date(targetDate + 'T00:00:00').getTime() - START_DATE.getTime()) / 86400000,
    )));
    return d.toISOString().slice(0, 10);
  }, [mode, dayIndex, targetDate, START_DATE]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying && mode === 'simulation') {
      intervalRef.current = setInterval(() => {
        setDayIndex(prev => {
          if (prev >= timeline.length - 1) { setIsPlaying(false); return prev; }
          return prev + 1;
        });
      }, speed);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed, mode, timeline.length]);

  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer) return;
    layer.eachLayer((sublayer: any) => {
      const name: string = sublayer.feature?.properties?.name;
      if (!name) return;
      const cases = activeSnapshot[name] ?? 0;
      const risk  = riskOf(cases);
      sublayer.setStyle({
        fillColor: FILL[risk],
        fillOpacity: cases === 0 ? 0.35 : 0.72,
        color: cases > 0 ? '#ffffff' : '#94a3b8',
        weight: cases > 0 ? 2 : 1,
      });
      sublayer.bindPopup(`
        <div style="font-family:sans-serif;min-width:160px;padding:4px">
          <div style="font-size:13px;font-weight:700;color:#1a3d15;margin-bottom:6px;
               border-bottom:2px solid #2D5A27;padding-bottom:4px;">${name}</div>
          <div style="font-size:12px;line-height:1.8;">
            <div>🐄 <b>Cattle Count:</b> ${CATTLE[name] ?? '—'} heads</div>
            <div>🦠 <b>FMD Cases:</b> ${cases}</div>
            <div>⚠️ <b>Risk Status:</b> <span style="color:${cases > 15 ? '#dc2626' : cases > 6 ? '#d97706' : '#16a34a'};font-weight:600">${risk.toUpperCase()}</span></div>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:5px 0"/>
            <div style="font-size:10px;color:#888">
              Haversine dist from Bawi: ${DIST['Bawi'][name]?.toFixed(2)} km
            </div>
          </div>
        </div>
      `);
    });
  }, [activeSnapshot, dayIndex, mode]);

  const reset = useCallback(() => { setIsPlaying(false); setDayIndex(0); }, []);

  const totalCases    = Object.values(activeSnapshot).reduce((s, v) => s + safeNum(v), 0);
  const affectedCount = Object.values(activeSnapshot).filter(v => v > 0).length;
  const criticalCount = Object.values(activeSnapshot).filter(v => riskOf(v) === 'critical').length;

  const sortedRows = useMemo(() =>
    NAMES.map(name => ({
      name, cases: safeNum(activeSnapshot[name]), cattle: CATTLE[name], distBawi: DIST['Bawi'][name], risk: riskOf(safeNum(activeSnapshot[name])),
    })).sort((a, b) => b.cases - a.cases),
  [activeSnapshot]);

  const getStyle = useCallback((feature: any) => {
    const cases = activeSnapshot[feature?.properties?.name] ?? 0;
    return { fillColor: FILL[riskOf(cases)], fillOpacity: cases === 0 ? 0.35 : 0.72, color: cases > 0 ? '#ffffff' : '#94a3b8', weight: cases > 0 ? 2 : 1 };
  }, [activeSnapshot]);

  if (!isMounted) return null;

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" />
            Foot-and-Mouth Disease (FMD) Outbreak Simulator
          </h2>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">
            Padre Garcia GIS · Haversine Proximity Decay · Cattle Density Weighting
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            <button onClick={() => { setMode('real'); reset(); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mode === 'real' ? 'bg-white shadow text-[#2D5A27]' : 'text-gray-400'}`}>Current Data</button>
            <button onClick={() => { setMode('simulation'); reset(); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mode === 'simulation' ? 'bg-[#2D5A27] text-white shadow' : 'text-gray-400'}`}>Simulation</button>
          </div>

          {mode === 'simulation' ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setIsPlaying(p => !p)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-bold transition-all border ${isPlaying ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-[#2D5A27] border-[#2D5A27] text-white'}`}>
                {isPlaying ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Run Outbreak</>}
              </button>
              <button onClick={reset} className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100"><RotateCcw className="w-4 h-4" /></button>
              <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 focus:outline-none">
                <option value={1400}>0.5×</option><option value={700}>1×</option><option value={350}>2×</option><option value={140}>5×</option>
              </select>
              <input type="range" min={0} max={30} value={dayIndex} onChange={e => { setIsPlaying(false); setDayIndex(Number(e.target.value)); }} className="w-28 accent-[#2D5A27]" />
              <span className="text-xs text-gray-500 font-mono whitespace-nowrap">Day {dayIndex}/30</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input type="date" value={targetDate} min="2026-04-26" max="2026-05-26" onChange={e => setTargetDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Forecast Date', value: activeDate, icon: <Clock className="w-4 h-4"/>, cls: 'text-[#2D5A27]', border: 'border-green-200' },
          { label: 'Total FMD Cases', value: totalCases, icon: <Activity className="w-4 h-4"/>, cls: 'text-red-600', border: 'border-red-200' },
          { label: 'Quarantine Zones', value: affectedCount, icon: <ShieldAlert className="w-4 h-4"/>, cls: 'text-amber-600', border: 'border-amber-200' },
          { label: 'Critical Outbreaks', value: criticalCount, icon: <Zap className="w-4 h-4"/>, cls: 'text-red-700', border: 'border-red-300' },
        ].map(k => (
          <div key={k.label} className={`bg-white border ${k.border} rounded-xl p-4 shadow-sm`}>
            <div className={`flex items-center gap-1.5 mb-1 ${k.cls} text-xs font-semibold`}>{k.icon}{k.label}</div>
            <div className={`text-2xl font-black ${k.cls}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden" style={{ height: 560 }}>
          <div className="bg-[#2D5A27] px-4 py-2 flex items-center justify-between">
            <span className="text-white text-sm font-semibold uppercase tracking-tight">
              {mode === 'simulation' ? `🎬 FMD Outbreak Simulation — Day ${dayIndex}` : `📡 Real-time FMD Surveillance`}
            </span>
          </div>

          <style>{`
            .risk-tooltip { background: rgba(26,61,21,.9); border:none; border-radius:4px; color:#fff; font-size:11px; font-weight:600; padding:3px 7px; }
            .risk-tooltip::before { display:none; }
          `}</style>

          <div style={{ height: 'calc(100% - 38px)' }}>
            <MapContainer center={[13.875, 121.215]} zoom={13} style={{ height:'100%', width:'100%' }}>
              <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              <GeoJSON ref={geoJsonRef} data={PADRE_GARCIA_GEOJSON as any} style={getStyle} onEachFeature={(f, l) => {
                l.bindTooltip(f.properties.name, { permanent: false, className: 'risk-tooltip', direction: 'center' });
                l.on({ mouseover: (e: any) => e.target.setStyle({ weight: 3, fillOpacity: 0.9 }), mouseout: (e: any) => e.target.setStyle({ weight: (activeSnapshot[f.properties.name] ?? 0) > 0 ? 2 : 1, fillOpacity: (activeSnapshot[f.properties.name] ?? 0) === 0 ? 0.35 : 0.72 }) });
              }} />
              {/* <Circle center={BARANGAY_CENTROIDS['Bawi']} radius={400} pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.25, weight: 2, dashArray: '6 4' }}>
                <Tooltip permanent direction="top" className="risk-tooltip">⚠ Initial Infection Site</Tooltip>
              </Circle> */}
            </MapContainer>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-gray-950 text-white rounded-2xl p-5 shadow-lg border border-gray-800">
            <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2 text-xs uppercase tracking-widest">
              <ShieldAlert className="w-4 h-4" /> Epidemic Risk Profile
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Livestock Exposure</span>
                <span className="font-black text-2xl text-red-400">{totalCases}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-500" style={{ width: `${Math.min(100, (totalCases / (NAMES.length * MAX_CASES)) * 100 * 4)}%` }} />
              </div>
              <p className="text-[10px] text-gray-500 italic leading-relaxed">
                Modelling based on FMD viral spread patterns. Vector-borne transmission (flies/ticks) is simulated through distance decay, while direct contact is weighted by livestock population density.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-1.5 text-[10px]">
              {Object.entries(FILL).map(([risk, color]) => (
                <div key={risk} className="flex items-center gap-1.5 text-gray-400 uppercase">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                  {risk}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-gray-400">Affected Livestock Registry</span>
              <Navigation className="w-3.5 h-3.5 text-gray-300" />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
              {sortedRows.map((row) => (
                <div key={row.name} className="px-4 py-3 border-b last:border-0 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{row.name}</p>
                    <p className="text-[10px] text-gray-400">{row.cattle} heads in barangay</p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className={`text-lg font-black ${row.cases === 0 ? 'text-gray-300' : row.cases > 15 ? 'text-red-600' : row.cases > 6 ? 'text-amber-600' : 'text-green-600'}`}>{row.cases}</p>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${RISK_BADGE[row.risk]}`}>{row.risk}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* footer */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-[10px] font-mono text-gray-400 leading-relaxed">
        <span className="text-gray-600 font-black"> FMD PATHOLOGY: </span>
        High-contagion aerosol model. Pressure = (Infected_Contact + Wind_Drift) × Population_Density.
        Simulation assumes total movement of cloven-hoofed animals.
      </div>
    </div>
  );
}