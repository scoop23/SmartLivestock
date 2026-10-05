'use client';

/**
 * ============================================================================
 * SmartLivestock GIS — Municipal Aggregate Overview (`MunicipalOverview.tsx`)
 * ============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * ----------------------------------------------------------------------------
 * When no individual barangay polygon is selected on the map, the right telemetry
 * sidebar (`GISSidebar.tsx`) displays this municipal-wide executive summary.
 * It provides the MAO leadership with a single-pane-of-glass perspective:
 *   1. Key Municipal Aggregate Metrics:
 *      Total Livestock count, Registered Raisers/Farmers, Active Disease Outbreaks,
 *      Total Milk Yield (L), Total Slaughter Meat (kg), and Recorded Mortality.
 *   2. Disease Outbreak Priority Queue:
 *      Alert list highlighting high-risk and medium-risk barangays with symptom tags.
 *      Clicking an alert navigates directly to that barangay's detailed profile.
 *   3. Leaderboards & Rankings:
 *      Top 5 Cattle Producer Barangays & Top 5 Dairy Yield Barangays with proportional progress bars.
 *   4. Inter-Barangay Livestock Movement Shipments:
 *      Live feed of animal transport events (Origin -> Destination, species count, clearance status).
 * 
 * CAPSTONE PRESENTATION / DEFENSE TALKING POINTS:
 * ----------------------------------------------------------------------------
 * - "Where do these aggregated metrics come from?"
 *   The backend `backend/analytics/services/gis.py` performs database aggregations
 *   (`Count()`, `Sum()`, `Q(status='APPROVED')`) across all records in PostgreSQL
 *   and returns a unified `summary` payload alongside the GeoJSON features.
 * - "How does clicking a leaderboard entry work?"
 *   Clicking any barangay in the Top 5 list invokes `handleBarangayClick(name)`,
 *   which finds the barangay object and calls `onSelectBarangay(found)`. This switches
 *   the sidebar from MunicipalOverview to BarangayDetails and highlights the polygon on the map.
 */

import React from 'react';
import {
  MunicipalSummary,
  MovementRecord,
  BarangayGISData,
  GISUserScope,
  FarmerPersonalStats,
} from './types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  TrendingUp,
  Milk,
  Beef,
  Skull,
  Truck,
  CheckCircle2,
  RefreshCw,
  MapPin,
  ChevronRight,
  ShieldAlert,
  X,
  UserCheck,
} from 'lucide-react';

interface MunicipalOverviewProps {
  summary: MunicipalSummary;
  movements: MovementRecord[];
  allBarangays: BarangayGISData[];
  onSelectBarangay: (b: BarangayGISData) => void;
  onRefresh: () => void;
  isLoading: boolean;
  simulationMode: boolean;
  onClose?: () => void;
  userScope?: GISUserScope;
  farmerStats?: FarmerPersonalStats | null;
}

export function MunicipalOverview({
  summary,
  movements,
  allBarangays,
  onSelectBarangay,
  onRefresh,
  isLoading,
  simulationMode,
  onClose,
  userScope,
  farmerStats,
}: MunicipalOverviewProps) {
  const maxCattle = summary.top_cattle[0]?.cattle || 1;
  const maxMilk = summary.top_milk[0]?.milk || 1;

  const isFarmer = userScope?.role === 'FARMER';
  const isAuction = userScope?.role === 'AUCTION';
  const isSlaughter = userScope?.role === 'SLAUGHTERHOUSESTAFF';
  const isSibat = userScope?.role === 'SIBAT';

  const overviewTitle =
    userScope?.title ||
    (isFarmer
      ? 'My Barangay Overview'
      : isSibat
      ? 'Field Monitoring Overview'
      : isAuction
      ? 'Movement & Trade Overview'
      : isSlaughter
      ? 'Origin & Slaughter Overview'
      : 'Padre Garcia Overview');

  const handleBarangayClick = (bName: string) => {
    const found = allBarangays.find((b) => b.name === bName);
    if (found) onSelectBarangay(found);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-emerald-950 text-white flex items-center justify-between shrink-0">
        <div className="min-w-0 pr-2">
          <span className="text-[10px] font-black tracking-widest uppercase text-emerald-400 block truncate">
            {isFarmer ? 'Local Barangay Context' : isSibat ? 'Jurisdiction Telemetry' : "God's-Eye Telemetry"}
          </span>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5 truncate">
            {overviewTitle}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-7 px-2 sm:px-2.5 rounded-lg flex items-center gap-1 cursor-pointer"
            aria-label="Refresh telemetry data"
          >
            <RefreshCw className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline sm:inline">Sync</span>
          </Button>

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full size-7 sm:size-8 cursor-pointer"
              aria-label="Close overview"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1 text-slate-800 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] overscroll-contain">
        {/* FARMER LOCAL CONTEXT CARD (Shows Farmer's Own Heads vs. Community Aggregate) */}
        {isFarmer && farmerStats && (
          <div className="bg-emerald-900 text-white rounded-2xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <UserCheck className="size-4 text-emerald-300" />
                My Verified Farm Records
              </span>
              <Badge variant="outline" className="text-[10px] font-bold border-emerald-400 text-emerald-200 bg-emerald-800/60">
                {farmerStats.my_barangay}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-emerald-950/70 border border-emerald-700/50 rounded-xl p-2.5">
                <div className="text-2xl font-black font-mono text-emerald-200">
                  {farmerStats.my_cattle}
                </div>
                <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  🐄 My Cattle Heads
                </div>
              </div>
              <div className="bg-emerald-950/70 border border-emerald-700/50 rounded-xl p-2.5">
                <div className="text-2xl font-black font-mono text-sky-200">
                  {farmerStats.my_milk.toLocaleString()} L
                </div>
                <div className="text-[10px] font-bold text-sky-300 uppercase tracking-wider">
                  🥛 My Dairy Yield
                </div>
              </div>
            </div>

            <p className="text-[11px] text-emerald-200/90 leading-tight">
              Below are the total community aggregates for <strong>Brgy. {farmerStats.my_barangay}</strong>. Individual neighbor records are kept private.
            </p>
          </div>
        )}
        {/* KPI Mini Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2.5">
            <div className="text-xl font-black text-emerald-950 font-mono">
              {summary.total_cattle.toLocaleString()}
            </div>
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              🐄 Cattle Heads
            </div>
          </div>

          <div className="bg-sky-50/90 border border-sky-200/80 rounded-xl p-2.5">
            <div className="text-xl font-black text-sky-950 font-mono">
              {(summary.total_milk / 1000).toFixed(1)}k L
            </div>
            <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">
              🥛 Dairy Yield
            </div>
          </div>

          <div
            className={`rounded-xl p-2.5 border ${
              summary.active_disease_cases > 0
                ? 'bg-rose-50/90 border-rose-200/80 text-rose-950'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="text-xl font-black font-mono">
              {summary.active_disease_cases}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider">
              🚨 Active Alerts
            </div>
          </div>

          <div className="bg-blue-50/90 border border-blue-200/80 rounded-xl p-2.5">
            <div className="text-xl font-black text-blue-950 font-mono">
              {summary.total_movements}
            </div>
            <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
              🚛 Live Movement
            </div>
          </div>

          <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-2.5">
            <div className="text-xl font-black text-rose-950 font-mono">
              {summary.total_meat > 0 ? `${Math.round(summary.total_meat).toLocaleString()} kg` : '0 kg'}
            </div>
            <div className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
              🥩 Katay Yield
            </div>
          </div>

          <div className="bg-slate-100/90 border border-slate-200/80 rounded-xl p-2.5">
            <div className="text-xl font-black text-slate-950 font-mono">
              {summary.total_mortality}
            </div>
            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Skull className="size-3 text-slate-600 inline" /> Recorded Deaths
            </div>
          </div>
        </div>

        {/* Recorded Mortality Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <Skull className="size-3.5 text-slate-700" />
              Recorded Mortality Overview
            </span>
            <Badge
              variant="outline"
              className={
                summary.total_mortality > 0
                  ? 'border-slate-300 text-slate-800 bg-slate-50 text-[10px] font-bold'
                  : 'border-emerald-300 text-emerald-800 bg-emerald-50 text-[10px] font-bold'
              }
            >
              {summary.total_mortality > 0
                ? `${summary.total_mortality} Deaths Recorded`
                : 'Zero Recorded'}
            </Badge>
          </div>

          {summary.total_mortality > 0 ? (
            <div className="space-y-2 pt-1 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Affected Barangays</span>
                  <span className="text-base font-black font-mono text-slate-900">
                    {summary.mortality?.affected_barangays ?? 0} <span className="text-[10px] font-normal text-slate-500">/ 18</span>
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Recent (90 Days)</span>
                  <span className="text-base font-black font-mono text-slate-900">
                    {summary.mortality?.recent_deaths ?? 0}
                  </span>
                </div>
              </div>

              {summary.mortality?.top_barangays && summary.mortality.top_barangays.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Top Mortality Hotspots:
                  </span>
                  <div className="space-y-1">
                    {summary.mortality.top_barangays.slice(0, 3).map((b) => (
                      <button
                        key={b.name}
                        type="button"
                        onClick={() => handleBarangayClick(b.name)}
                        className="w-full text-left p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <span className="font-semibold text-xs text-slate-800 group-hover:text-slate-950">
                          Brgy. {b.name}
                        </span>
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {b.deaths} head{b.deaths !== 1 ? 's' : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-center">
              <p className="text-xs font-semibold text-slate-700">No recorded livestock deaths across Padre Garcia</p>
              <p className="text-[10px] text-slate-500">Mortality declarations require MAO approval to be officially reflected.</p>
            </div>
          )}
        </div>

        {/* Disease Alerts Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <AlertTriangle className="size-3.5 text-rose-600" />
              Disease Surveillance Alerts
            </span>
            <Badge
              variant="outline"
              className={
                summary.alert_barangays.length > 0
                  ? 'border-rose-300 text-rose-800 bg-rose-50 text-[10px] font-black'
                  : 'border-emerald-300 text-emerald-800 bg-emerald-50 text-[10px] font-bold'
              }
            >
              {summary.alert_barangays.length > 0
                ? `${summary.alert_barangays.length} Flagged`
                : 'All Clear'}
            </Badge>
          </div>

          {summary.alert_barangays.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              {summary.alert_barangays.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleBarangayClick(a.name)}
                  className="w-full text-left p-2 rounded-lg bg-rose-50/80 hover:bg-rose-100/80 border border-rose-200/70 transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-rose-950">
                        Brgy. {a.name}
                      </span>
                      <Badge className="bg-rose-600 text-white text-[9px] px-1 py-0 font-bold uppercase">
                        {a.disease_risk}
                      </Badge>
                    </div>
                    {a.recent_diseases?.length > 0 && (
                      <p className="text-[10px] text-rose-800 truncate mt-0.5">
                        {a.recent_diseases.join(', ')}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="size-3.5 text-rose-400 group-hover:text-rose-700 transition-transform group-hover:translate-x-0.5 shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg text-center">
              <CheckCircle2 className="size-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-xs font-bold text-emerald-900">No active disease outbreaks</p>
              <p className="text-[10px] text-emerald-700">All 18 barangays operating normally</p>
            </div>
          )}
        </div>

        {/* Top 5 Barangays by Cattle */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <TrendingUp className="size-3.5 text-emerald-700" />
              Top Barangays by Cattle
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Heads</span>
          </div>

          <div className="space-y-2 pt-1">
            {summary.top_cattle.map((b, i) => (
              <button
                key={b.name}
                type="button"
                onClick={() => handleBarangayClick(b.name)}
                className="w-full text-left group cursor-pointer"
              >
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold text-slate-700 group-hover:text-emerald-800 transition-colors flex items-center gap-1.5">
                    <span className="size-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                    {b.name}
                  </span>
                  <span className="font-bold font-mono text-emerald-950">
                    {b.cattle}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.max(5, (b.cattle / maxCattle) * 100)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Top 5 Barangays by Dairy Milk */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <Milk className="size-3.5 text-sky-600" />
              Top Barangays by Dairy Yield
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Liters</span>
          </div>

          <div className="space-y-2 pt-1">
            {summary.top_milk.filter(b => b.milk > 0).length > 0 ? (
              summary.top_milk.filter(b => b.milk > 0).map((b, i) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => handleBarangayClick(b.name)}
                  className="w-full text-left group cursor-pointer"
                >
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-slate-700 group-hover:text-sky-800 transition-colors flex items-center gap-1.5">
                      <span className="size-4 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black flex items-center justify-center">
                        {i + 1}
                      </span>
                      {b.name}
                    </span>
                    <span className="font-bold font-mono text-sky-950">
                      {b.milk.toLocaleString()} L
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-sky-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.max(5, (b.milk / maxMilk) * 100)}%` }}
                    />
                  </div>
                </button>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No milk production recorded yet</p>
            )}
          </div>
        </div>

        {/* Live Cow Movement Flows */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <Truck className="size-3.5 text-blue-600" />
              Live Transport Flows
            </span>
            <Badge variant="outline" className="border-blue-200 text-blue-800 text-[10px] font-bold">
              {movements.length} Active Shipments
            </Badge>
          </div>

          {movements.length > 0 ? (
            <div className="space-y-2 pt-1">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 text-xs space-y-1"
                >
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-blue-950">
                      {m.heads} {m.species}
                    </div>
                    <Badge
                      className={
                        m.clearance_status === 'APPROVED'
                          ? 'bg-emerald-600 text-white text-[9px] px-1 py-0'
                          : 'bg-amber-500 text-white text-[9px] px-1 py-0'
                      }
                    >
                      {m.clearance_status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center gap-1">
                    <MapPin className="size-3 text-slate-400" />
                    <span>{m.origin}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-semibold text-slate-800 truncate">{m.destination}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                    <span>Shipper: {m.shipper_name}</span>
                    <span>{m.purpose}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No movement inspections recorded</p>
          )}
        </div>
      </div>
    </div>
  );
}
