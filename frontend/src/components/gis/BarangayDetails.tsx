'use client';

/**
 * ============================================================================
 * SmartLivestock GIS — Barangay Deep-Dive Panel (`BarangayDetails.tsx`)
 * ============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * ----------------------------------------------------------------------------
 * When a user clicks or taps on any of Padre Garcia's 18 barangay polygons on
 * the GIS map, this component loads inside the right telemetry sidebar (`GISSidebar.tsx`).
 * It presents granular, verified agricultural statistics for that specific barangay:
 *   1. Livestock Population Breakdown:
 *      Cattle (Baka), Carabao (Kalabaw), Swine (Baboy), Goat (Kambing), Sheep (Tupa), and Poultry (Manok).
 *   2. Disease Surveillance & Epidemiology:
 *      Reported field cases, affected heads, illness symptoms, or live simulation risk scores.
 *   3. Production & Yield:
 *      Dairy milk production (Liters/month) and slaughterhouse meat yield (kg).
 *   4. Mortality & Cause Breakdown:
 *      Recorded fatalities and verified cause tags (e.g., Pneumonia, Heat Stress, Bloat).
 *   5. Transport Inspections & Outgoing Cattle:
 *      Movement clearance events leaving this barangay.
 * 
 * DATA SOURCE:
 * ----------------------------------------------------------------------------
 * Data comes from PostgreSQL database tables (`Livestock`, `DiseaseRecord`,
 * `ProductionRecord`, `MortalityRecord`, `InspectionRecord`) aggregated by Django
 * in `backend/analytics/services/gis.py` and passed down via `props.data`.
 * 
 * CAPSTONE PRESENTATION / DEFENSE TALKING POINTS:
 * ----------------------------------------------------------------------------
 * - "How does the map select a barangay?"
 *   When Leaflet triggers a click event on a GeoJSON polygon, `GISMap.tsx` matches
 *   the feature's `properties.name` against the backend data dictionary and calls
 *   `onSelectBarangay(data)`. This conditionally mounts `<BarangayDetails>` in the sidebar.
 */

import React from 'react';
import { BarangayGISData, SimulatedBarangayState, DiseaseSubMode, ViewMode } from './types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X,
  Activity,
  AlertTriangle,
  Milk,
  Beef,
  Skull,
  Truck,
  Users,
  CheckCircle2,
  TrendingUp,
  Zap,
  Wind,
  Box,
  ChevronLeft,
} from 'lucide-react';

interface BarangayDetailsProps {
  data: BarangayGISData;
  simulatedState?: SimulatedBarangayState;
  diseaseSubMode: DiseaseSubMode;
  viewMode: ViewMode;
  onClose: () => void;
  onBack?: () => void;
  selectedLivestockType?: string;
}

export function BarangayDetails({
  data,
  simulatedState,
  diseaseSubMode,
  viewMode,
  onClose,
  onBack,
  selectedLivestockType = 'Cattle',
}: BarangayDetailsProps) {
  const isHighRisk = data.disease_risk === 'high';
  const isMedRisk = data.disease_risk === 'medium';
  const isSim = diseaseSubMode === 'simulation';
  const isTrend = diseaseSubMode === 'trend';

  const displayHeads = React.useMemo(() => {
    if (!selectedLivestockType || selectedLivestockType.toLowerCase() === 'cattle') {
      return data.cattle;
    }
    if (selectedLivestockType === 'ALL') {
      return data.total_livestock;
    }
    const match = data.species_breakdown?.find(
      (s) => s.species.toLowerCase() === selectedLivestockType.toLowerCase()
    );
    return match?.heads || 0;
  }, [data, selectedLivestockType]);

  const displayIcon =
    selectedLivestockType?.toLowerCase() === 'sheep'
      ? '🐑'
      : selectedLivestockType?.toLowerCase() === 'swine'
      ? '🐖'
      : selectedLivestockType?.toLowerCase() === 'goat'
      ? '🐐'
      : selectedLivestockType === 'ALL'
      ? '🐾'
      : '🐄';

  const displayLabel =
    selectedLivestockType === 'ALL'
      ? 'All Livestock'
      : `${selectedLivestockType || 'Cattle'} Heads`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-emerald-950 text-white flex items-center justify-between shrink-0">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="text-[10px] font-bold text-emerald-300 hover:text-white flex items-center gap-0.5 cursor-pointer mr-1 transition-colors"
                aria-label="Back to Municipal Overview"
              >
                <ChevronLeft className="size-3" /> Overview
              </button>
            )}
            <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-400">
              Barangay
            </span>
            {isSim && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] uppercase font-mono px-1.5 py-0 flex items-center gap-0.5">
                <Zap className="size-2.5" /> Sim
              </Badge>
            )}
            {isTrend && (
              <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[9px] uppercase font-mono px-1.5 py-0 flex items-center gap-0.5">
                <TrendingUp className="size-2.5" /> Trend
              </Badge>
            )}
            {viewMode === '3D' && (
              <Badge className="bg-emerald-700 text-white text-[9px] uppercase font-mono px-1.5 py-0 flex items-center gap-0.5">
                <Box className="size-2.5" /> 3D
              </Badge>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-white mt-0.5 truncate">
            Brgy. {data.name}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close sidebar"
          className="text-white/80 hover:text-white hover:bg-white/10 rounded-full size-7 sm:size-8 cursor-pointer shrink-0"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Content scroll area */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1 text-slate-800 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] overscroll-contain">
        {/* Quick Highlights Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-2.5 text-center">
            <div className="text-2xl font-black text-emerald-900 font-mono">
              {displayHeads}
            </div>
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center justify-center gap-1">
              {displayIcon} {displayLabel}
            </div>
          </div>

          <div
            className={`rounded-xl p-2.5 text-center border ${
              isSim
                ? simulatedState?.risk === 'critical' || simulatedState?.risk === 'high'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
                : isTrend
                ? data.active_cases > 0
                  ? 'bg-purple-50 border-purple-200 text-purple-800'
                  : data.disease_cases > 0
                  ? 'bg-sky-50 border-sky-200 text-sky-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : isHighRisk
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : isMedRisk
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="text-xl font-black uppercase tracking-tight font-mono">
              {isSim
                ? (simulatedState?.risk || 'LOW').toUpperCase()
                : isTrend
                ? data.active_cases > 0
                  ? 'ELEVATED'
                  : data.disease_cases > 0
                  ? 'REPORTED'
                  : 'STABLE'
                : data.disease_risk.toUpperCase()}
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wide">
              {isSim
                ? '⚡ Simulated Risk'
                : isTrend
                ? '🩺 Surveillance Status'
                : '🩺 Reported Risk'}
            </div>
          </div>
        </div>

        {/* Demographics & Herds */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Users className="size-3.5 text-emerald-700" />
              Registered Farmers
            </span>
            <span className="font-mono font-bold text-slate-900">
              {data.farmers_count > 0 ? `${data.farmers_count} farmers` : 'None registered'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-emerald-700" />
              Active Herds / Batches
            </span>
            <span className="font-mono font-bold text-slate-900">
              {data.batches_count} active
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Species Breakdown
            </span>
            {data.species_breakdown.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {data.species_breakdown.map((s, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="bg-slate-100 text-slate-800 text-xs px-2 py-0.5 border border-slate-200 font-semibold"
                  >
                    {s.species}: {s.heads}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No livestock recorded yet</p>
            )}
          </div>
        </div>

        {/* Disease Surveillance Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <Activity className="size-3.5 text-rose-600" />
              Disease Surveillance
            </span>
            {data.active_cases > 0 ? (
              <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] font-black px-1.5 py-0">
                {data.active_cases} Active Outbreak{data.active_cases > 1 ? 's' : ''}
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold px-1.5 py-0">
                Healthy
              </Badge>
            )}
          </div>

          {/* If Simulation Mode is Active */}
          {isSim && simulatedState && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-2.5 text-xs space-y-1.5">
              <div className="flex justify-between font-bold text-amber-950">
                <span>⚡ Simulated Transmission Pressure:</span>
                <span className="font-mono">{simulatedState.transmissionPressure}</span>
              </div>
              <div className="flex justify-between text-amber-900 text-[11px]">
                <span className="flex items-center gap-1">
                  <Wind className="size-3 text-sky-600" /> Wind Exposure Factor:
                </span>
                <span className="font-mono font-bold">
                  {simulatedState.windExposureFactor > 0
                    ? `+${simulatedState.windExposureFactor} (Downwind)`
                    : 'Neutral / Shielded'}
                </span>
              </div>
              <div className="flex justify-between text-amber-900 text-[11px] pt-1 border-t border-amber-200/60">
                <span>Projected Case Load:</span>
                <span className="font-bold">{simulatedState.cases} head{simulatedState.cases !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}

          {/* If Surveillance Trend Mode is Active */}
          {isTrend && (
            <div className="bg-purple-50/90 border border-purple-200 rounded-lg p-2.5 text-xs space-y-1">
              <div className="flex justify-between font-bold text-purple-950">
                <span>🩺 Current Surveillance Status:</span>
                <span className="font-mono">
                  {data.active_cases > 0
                    ? 'ELEVATED'
                    : data.disease_cases > 0
                    ? 'REPORTED'
                    : 'STABLE'}
                </span>
              </div>
              <p className="text-[10.5px] text-purple-800 leading-relaxed">
                Reflects verified active and past outbreak records in this barangay. For temporal 3/6/12-month statistical forecasts, visit Predictive Analytics.
              </p>
            </div>
          )}

          <div className="text-xs space-y-1 pt-1">
            <div className="flex justify-between text-slate-600">
              <span>Reported Disease Cases:</span>
              <span className="font-bold font-mono text-slate-900">{data.disease_cases}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Affected Animal Heads:</span>
              <span className="font-bold font-mono text-slate-900">{data.affected_heads}</span>
            </div>
          </div>

          {data.recent_diseases.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block mb-1">
                Reported Illness Symptoms:
              </span>
              <ul className="text-xs text-rose-900 space-y-0.5 list-disc list-inside">
                {data.recent_diseases.map((d, i) => (
                  <li key={i} className="truncate">{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Production Metrics */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-3">
          <div className="space-y-1.5">
            <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <Milk className="size-3.5 text-sky-600" />
              On-Farm Production
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between p-2 bg-sky-50/70 border border-sky-100 rounded-lg">
                <span className="font-semibold text-sky-900 flex items-center gap-1.5">
                  🥛 Dairy Milk
                </span>
                <span className="font-bold font-mono text-sky-900">
                  {data.milk > 0 ? `${data.milk.toLocaleString()} L` : '0 L (No records)'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-amber-50/70 border border-amber-100 rounded-lg">
                <span className="font-semibold text-amber-950 flex items-center gap-1.5">
                  🥩 Farmer Meat Production
                </span>
                <span className="font-bold font-mono text-amber-950">
                  {(data.farmer_meat ?? 0) > 0
                    ? `${(data.farmer_meat ?? 0).toLocaleString()} kg`
                    : '0 kg (No records)'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <Beef className="size-3.5 text-rose-700" />
              Slaughterhouse Operations
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between p-2 bg-rose-50/70 border border-rose-100 rounded-lg">
                <span className="font-semibold text-rose-900 flex items-center gap-1.5">
                  🔪 Carcass Yield
                </span>
                <span className="font-bold font-mono text-rose-900">
                  {(data.slaughter_yield ?? data.meat ?? 0) > 0
                    ? `${(data.slaughter_yield ?? data.meat ?? 0).toLocaleString()} kg`
                    : 'No slaughter data available'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-rose-50/40 border border-rose-100/60 rounded-lg">
                <span className="font-semibold text-rose-800 flex items-center gap-1.5">
                  🐂 Slaughtered Cattle
                </span>
                <span className="font-bold font-mono text-rose-800">
                  {(data.slaughter_heads ?? 0) > 0
                    ? `${(data.slaughter_heads ?? 0).toLocaleString()} heads`
                    : '0 heads'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Mortality Records */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <Skull className="size-3.5 text-slate-700" />
              Recorded Mortality
            </span>
            <span className="font-mono font-bold text-xs text-slate-900">
              {data.mortality} head{data.mortality !== 1 ? 's' : ''}
            </span>
          </div>

          {data.mortality > 0 ? (
            <div className="text-xs space-y-1.5 pt-1 border-t border-slate-100">
              {/* Species Breakdown if multi-species data exists */}
              {data.mortality_by_species && data.mortality_by_species.length > 0 && (
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>Species Breakdown:</span>
                  <div className="flex gap-1">
                    {data.mortality_by_species.map((sp, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 bg-slate-50 font-mono">
                        {sp.species}: {sp.heads}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Deaths in Surveillance Window */}
              {data.recent_mortality !== undefined && data.recent_mortality > 0 && (
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>Recent Deaths (90-day window):</span>
                  <span className="font-bold font-mono text-slate-900">{data.recent_mortality}</span>
                </div>
              )}

              {/* Recorded Causes */}
              {data.mortality_causes.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                    Recorded Causes:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {data.mortality_causes.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 border-slate-300">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-emerald-700 flex items-center gap-1 pt-1 border-t border-slate-100">
              <CheckCircle2 className="size-3 text-emerald-600" /> No recorded livestock deaths
            </p>
          )}
        </div>

        {/* Live Movement & Inspections */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <Truck className="size-3.5 text-blue-600" />
              Movement & Transport
            </span>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-blue-300 text-blue-800">
              {data.inspections_count} Inspections
            </Badge>
          </div>

          <div className="text-xs space-y-1 text-slate-600">
            <div className="flex justify-between">
              <span>Outgoing Live Cattle:</span>
              <span className="font-bold font-mono text-slate-900">{data.movement_out} heads</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
