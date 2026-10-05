'use client';

/**
 * ============================================================================
 * SmartLivestock GIS — Disease Simulation Timeline Player (`GISTimeline.tsx`)
 * ============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * ----------------------------------------------------------------------------
 * This component powers the time-series epidemiological simulation player.
 * Floating horizontally at the bottom center (`absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-[950]`),
 * it activates whenever `activeLayer === 'disease'` and `diseaseSubMode === 'simulation'`.
 * 
 * CORE CAPABILITIES:
 * ----------------------------------------------------------------------------
 * 1. 12-Month Scrubbing Slider (Jan to Dec 2026):
 *    - Allows instantaneous scrubbing across time. Because the full 12-month
 *      trajectory is precomputed in memory (`trajectory`), scrubbing is O(1)
 *      with zero lag or network requests.
 * 2. Playback Loop with Variable Speeds:
 *    - Play / Pause toggling.
 *    - 1x (1.2s per month), 2x (0.6s per month), and 4x (0.3s per month).
 *    - Auto-pause when reaching December 2026, with an instant Reset button.
 * 3. Live Environmental Conditions Badge:
 *    - Shows the active month's wind speed (km/h), compass direction (e.g. ENE, WSW),
 *      and meteorological drift vector toward Padre Garcia's neighbors.
 * 4. Collapsible Epidemiological Parameter Sliders:
 *    - Direct Contact Spread Scale (L_contact, default 2.5 km).
 *    - Airborne Wind-Drift Scale (L_wind, default 6.0 km).
 *    - Outbreak Alert Threshold (0.10 to 0.90 normalized pressure).
 * 5. Recharts Interactive Pressure Curve:
 *    - An expandable SVG area chart visualizing total transmission pressure over all 12 months,
 *      complete with a vertical reference line highlighting the currently scrubbed month.
 * 
 * CAPSTONE PRESENTATION / DEFENSE TALKING POINTS:
 * ----------------------------------------------------------------------------
 * - "Why doesn't the map lag when moving the month slider?"
 *   We avoid running expensive spatial loops on every frame. In `page.tsx`, `useMemo`
 *   runs the simulation model once for all 12 months whenever telemetry or parameters change.
 *   The slider simply selects an index `0..11`, achieving 60 FPS performance even on mobile.
 */

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Wind,
  Calendar,
  Sliders,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';
import {
  MonthlySimulationResult,
  MonthlyWindData,
  SimulationParameters,
  TimelineMonth,
} from './types';
import { TIMELINE_MONTHS } from './simulation';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';

interface GISTimelineProps {
  currentMonthIndex: number;
  onMonthChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  playbackSpeed: 1 | 2 | 4;
  onPlaybackSpeedChange: (speed: 1 | 2 | 4) => void;
  windData?: MonthlyWindData;
  parameters: SimulationParameters;
  onParametersChange: (params: SimulationParameters) => void;
  trajectory?: MonthlySimulationResult[];
}

export function GISTimeline({
  currentMonthIndex,
  onMonthChange,
  isPlaying,
  onTogglePlay,
  onReset,
  playbackSpeed,
  onPlaybackSpeedChange,
  windData,
  parameters,
  onParametersChange,
  trajectory = [],
}: GISTimelineProps) {
  const [paramsOpen, setParamsOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  const currentMonth = TIMELINE_MONTHS[currentMonthIndex] || TIMELINE_MONTHS[0];

  // Prepare chart series from precomputed 12-month trajectory
  const chartData = useMemo(() => {
    if (!trajectory || trajectory.length === 0) return [];
    return trajectory.map((res) => ({
      month: res.month.label.split(' ')[0],
      pressure: res.totalPressure,
      infected: res.totalInfected,
    }));
  }, [trajectory]);

  const activeMonthAbbr = currentMonth.label.split(' ')[0];

  return (
    <div className="bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xl text-slate-800 pointer-events-auto w-full max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Top Header & Environmental Status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase px-2 py-0.5 flex items-center gap-1 shadow-2xs">
            <Zap className="size-3 fill-white" />
            Epidemic Player
          </Badge>
          {trajectory[0]?.isDemoScenario && (
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] font-bold">
              Hypothetical Demo Scenario
            </Badge>
          )}
          <span className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1">
            <Calendar className="size-3.5 text-emerald-700" />
            {currentMonth.monthName} {currentMonth.year}
          </span>
        </div>

        {/* Environmental Wind Display */}
        <div className="flex items-center gap-1 px-2 py-1 bg-sky-50 border border-sky-200/80 rounded-lg text-[10px] font-semibold text-sky-900">
          <Wind className="size-3 text-sky-600 animate-pulse" />
          <span className="font-bold">Wind: {windData?.cardinal || 'WNW'}</span>
          <span className="text-sky-700">({windData?.speedKmH || 17} km/h)</span>
        </div>
      </div>

      {/* Mini Epidemiological Trajectory Chart (Recharts) */}
      {chartOpen && chartData.length > 0 && (
        <div className="mb-2 p-2 bg-slate-50 border border-slate-200/80 rounded-xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1 px-1">
            <span className="flex items-center gap-1 text-emerald-800">
              <Activity className="size-3" />
              Total Municipal Transmission Pressure
            </span>
            <span className="text-slate-400">Jan – Dec 2026</span>
          </div>
          <div className="h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="pressureGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" hide />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-md border border-slate-700">
                          <p className="font-bold">{payload[0].payload.month} 2026</p>
                          <p className="text-amber-400 font-mono">
                            Pressure: {Number(payload[0].value).toFixed(2)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="pressure"
                  stroke="#d97706"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#pressureGradient)"
                />
                <ReferenceLine x={activeMonthAbbr} stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 12-Month Scrubbing Slider */}
      <div className="space-y-1">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={TIMELINE_MONTHS.length - 1}
            value={currentMonthIndex}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* 12 Month Ticks */}
        <div className="flex justify-between text-[9.5px] sm:text-[10px] font-bold text-slate-400 px-0.5">
          {TIMELINE_MONTHS.map((m, idx) => (
            <button
              key={m.label}
              type="button"
              onClick={() => onMonthChange(idx)}
              className={`hover:text-emerald-800 transition-colors cursor-pointer ${
                idx === currentMonthIndex ? 'text-emerald-800 font-black scale-110' : ''
              }`}
            >
              {m.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Controls Bar: Play/Pause, Speed Control, Reset, Toggle Parameters & Chart */}
      <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Play/Pause Button */}
          <Button
            size="sm"
            onClick={onTogglePlay}
            className={`min-h-[38px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400/50'
                : 'bg-emerald-800 hover:bg-emerald-900 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="size-3.5 fill-white" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-white" />
                <span>Play</span>
              </>
            )}
          </Button>

          {/* Speed Control (1x / 2x / 4x) */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200">
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onPlaybackSpeedChange(spd)}
                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-white text-emerald-900 shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            title="Reset Simulation to Month 1"
            className="min-h-[38px] px-2 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>

        {/* Action Toggles for Parameters & Curve */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChartOpen((prev) => !prev)}
            className={`min-h-[36px] px-2 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${
              chartOpen ? 'bg-amber-50 text-amber-900 border-amber-200' : 'text-slate-600 border-slate-200'
            }`}
          >
            <Activity className="size-3 text-amber-600" />
            <span className="hidden sm:inline">Curve</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setParamsOpen((prev) => !prev)}
            className={`min-h-[36px] px-2 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${
              paramsOpen ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'text-slate-600 border-slate-200'
            }`}
          >
            <Sliders className="size-3 text-emerald-700" />
            <span>Parameters</span>
            {paramsOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </Button>
        </div>
      </div>

      {/* Collapsible Model Parameters Panel */}
      {paramsOpen && (
        <div className="mt-2 pt-2.5 border-t border-slate-200/80 space-y-2.5 animate-in fade-in duration-150 text-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span className="flex items-center gap-1 text-emerald-900">
              <Sliders className="size-3 text-emerald-700" />
              Epidemic Model Parameters
            </span>
            <span className="text-[10px] text-slate-400 italic">Spatial decay & wind weighting</span>
          </div>

          {/* L_contact Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-600">
              <span>Contact Transmission Distance (L_contact):</span>
              <span className="font-mono text-emerald-800">{parameters.L_contact.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={8.0}
              step={0.5}
              value={parameters.L_contact}
              onChange={(e) =>
                onParametersChange({ ...parameters, L_contact: Number(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
            />
          </div>

          {/* L_wind Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-600">
              <span>Aerosol Wind Drift Distance (L_wind):</span>
              <span className="font-mono text-sky-800">{parameters.L_wind.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={12.0}
              step={0.5}
              value={parameters.L_wind}
              onChange={(e) =>
                onParametersChange({ ...parameters, L_wind: Number(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-700"
            />
          </div>

          {/* Infection Threshold Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-600">
              <span>Epidemic Pressure Threshold (Spread Trigger):</span>
              <span className="font-mono text-amber-800">
                {(parameters.threshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0.15}
              max={0.85}
              step={0.05}
              value={parameters.threshold}
              onChange={(e) =>
                onParametersChange({ ...parameters, threshold: Number(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />
          </div>
        </div>
      )}
    </div>
  );
}
