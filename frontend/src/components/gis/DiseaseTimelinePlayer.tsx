'use client';

/**
 * ============================================================================
 * SmartLivestock GIS — Disease Timeline Player (`DiseaseTimelinePlayer.tsx`)
 * ============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * ----------------------------------------------------------------------------
 * Provides high-performance, day-by-day chronological playback and scrubbing
 * for 'Disease Reports' (PostgreSQL submissions) and 'Report Alerts' (3.5 km
 * surveillance monitoring radius), styled identically to the simulation player
 * (`GISTimeline.tsx`).
 * 
 * CAPSTONE ARCHITECTURE & 60 FPS PERFORMANCE:
 * ----------------------------------------------------------------------------
 * Instead of flooding the server with hundreds of HTTP requests during playback,
 * all approved disease incident records are provided in memory, allowing
 * instantaneous client-side evaluation of active cases, affected heads, and
 * 3.5 km Haversine alert perimeters for every single day.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarangayGISData, DiseaseRecord } from './types';

interface DiseaseTimelinePlayerProps {
  diseaseSubMode: 'reported' | 'surveillance';
  dates: string[];
  latestDate: string;
  currentDateIndex: number;
  onDateIndexChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: 1 | 2 | 4;
  onPlaybackSpeedChange: (speed: 1 | 2 | 4) => void;
  records: DiseaseRecord[];
  effectiveBarangays: Record<string, BarangayGISData>;
  onReset?: () => void;
}

export function DiseaseTimelinePlayer({
  diseaseSubMode,
  dates,
  latestDate,
  currentDateIndex,
  onDateIndexChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onPlaybackSpeedChange,
  records,
  effectiveBarangays,
  onReset,
}: DiseaseTimelinePlayerProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  const currentDate = currentDateIndex === -1 ? latestDate : dates[currentDateIndex] || latestDate;
  const windowStart = new Date(currentDate + 'T00:00:00Z');
  windowStart.setUTCDate(windowStart.getUTCDate() - 90);
  const windowLabel = Number.isNaN(windowStart.getTime()) ? '' : windowStart.toISOString().slice(0, 10);
  const isSurveillance = diseaseSubMode === 'surveillance';

  // Format date nicely (e.g. "Oct 30, 2026")
  const formattedDate = useMemo(() => {
    if (!currentDate) return '';
    try {
      const parts = currentDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {
      // fallback
    }
    return currentDate;
  }, [currentDate]);

  // Aggregate active municipal summary statistics for the active scrubbed day
  const dayStats = useMemo(() => {
    const barangayList = Object.values(effectiveBarangays);
    const totalCases = barangayList.reduce((acc, b) => acc + (b.disease_cases || 0), 0);
    const activeCases = barangayList.reduce((acc, b) => acc + (b.active_cases || 0), 0);
    const affectedHeads = barangayList.reduce((acc, b) => acc + (b.affected_heads || 0), 0);
    const alertBarangaysCount = barangayList.filter((b) => (b.active_cases || 0) > 0).length;
    const monitoringRadiusCount = barangayList.filter((b) => b.disease_risk === 'medium').length;

    return {
      totalCases,
      activeCases,
      affectedHeads,
      alertBarangaysCount,
      monitoringRadiusCount,
    };
  }, [effectiveBarangays]);

  // Minimized Floating Pill View
  if (isMinimized) {
    return (
      <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-200/90 shadow-2xl text-slate-800 pointer-events-auto flex items-center justify-between gap-2 max-w-sm mx-auto animate-in fade-in duration-150">
        <div className="flex items-center gap-1.5 min-w-0">
          <Badge
            className={`text-white text-[9px] font-black uppercase px-1.5 py-0.5 flex items-center gap-0.5 shrink-0 ${
              isSurveillance ? 'bg-rose-600' : 'bg-emerald-700'
            }`}
          >
            {isSurveillance ? (
              <ShieldAlert className="size-2.5 fill-white" />
            ) : (
              <Activity className="size-2.5" />
            )}
            {isSurveillance ? 'ALERTS' : 'REPORTS'}
          </Badge>
          <span className="text-xs font-black text-slate-900 truncate">
            {formattedDate}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pause timeline playback" : "Play daily timeline"}
            className={`min-h-[34px] min-w-[34px] p-0 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : isSurveillance
                ? 'bg-rose-700 hover:bg-rose-800 text-white'
                : 'bg-emerald-800 hover:bg-emerald-900 text-white'
            }`}
          >
            {isPlaying ? (
              <Pause className="size-3.5 fill-white" />
            ) : (
              <Play className="size-3.5 fill-white" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMinimized(false)}
            className="min-h-[34px] px-2 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-100"
          >
            Expand ↗
          </Button>
        </div>
      </div>
    );
  }

  // Full Expanded Player Card View
  return (
    <div className="bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xl text-slate-800 pointer-events-auto w-full max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Top Header & Live Telemetry Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
          <Badge
            className={`text-white text-[10px] font-black uppercase px-2 py-0.5 flex items-center gap-1 shadow-2xs ${
              isSurveillance ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-700 hover:bg-emerald-800'
            }`}
          >
            {isSurveillance ? (
              <ShieldAlert className="size-3 fill-white" />
            ) : (
              <Activity className="size-3" />
            )}
            {isSurveillance ? 'Report Alerts Timeline' : 'Disease Reports Timeline'}
          </Badge>

          {isSurveillance ? (
            <Badge
              variant="outline"
              className="bg-rose-50 text-rose-950 border-rose-300 text-[9px] font-bold"
            >
              {dayStats.alertBarangaysCount} Alert Barangay{dayStats.alertBarangaysCount === 1 ? '' : 's'} · {dayStats.monitoringRadiusCount} in 3.5 km Radius
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-950 border-emerald-300 text-[9px] font-bold"
            >
              {dayStats.activeCases} Not recovered or closed · {dayStats.totalCases} Reports in 90-day Window
            </Badge>
          )}

          <span className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1">
            <Calendar className="size-3.5 text-emerald-700" />
            {formattedDate}
          </span>
        </div>

        {/* Minimize Button */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            aria-label="Minimize daily timeline player"
            title="Minimize timeline player"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md text-xs cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      <p className="mb-2 text-xs font-semibold">90-day window: {windowLabel} ? {currentDate}</p>
      {/* Date Scrubber Slider */}
      <div className="mb-2">
        <input
          id="disease-daily-scrubber"
          type="range"
          min={0}
          max={Math.max(0, dates.length - 1)}
          value={currentDateIndex === -1 ? Math.max(0, dates.length - 1) : currentDateIndex}
          onChange={(e) => onDateIndexChange(Number(e.target.value))}
          className={`w-full cursor-pointer ${isSurveillance ? 'accent-rose-600' : 'accent-emerald-700'}`}
          aria-valuetext={currentDate}
          aria-label="Timeline day scrubber"
        />
        <div className="flex justify-between items-center text-[10px] text-slate-500 mt-0.5">
          <span className="font-mono">{dates[0] || 'Start'}</span>
          <span
            className={`font-semibold px-2 py-0.5 rounded border font-mono text-[11px] ${
              isSurveillance
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
            }`}
          >
            Change {currentDateIndex + 1}/{dates.length} · {currentDate}
          </span>
          <span className="font-mono">{dates[dates.length - 1] || 'Today'}</span>
        </div>
      </div>

      <details className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
        <summary className="cursor-pointer font-semibold">Map evidence: {dayStats.activeCases} reports not recovered or closed as of {currentDate || 'selected date'}</summary>
        <p className="mt-1 text-[10px] text-slate-600">The map and sidebar count reports marked Open or with no recorded outcome in the selected 90-day window. Recovery or closure has not been recorded for these reports. This does not confirm that the animals are still sick. Approved totals include all reports in that window.</p>
        <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
          {Object.values(effectiveBarangays).filter(b => (b.disease_cases || 0) > 0).sort((a, b) => (b.disease_cases || 0) - (a.disease_cases || 0)).map(b => (
            <div key={b.name} className="flex justify-between gap-2"><span>{b.name}</span><span>{b.disease_cases} approved in window; {b.active_cases || 0} not recovered or closed</span></div>
          ))}
          {dayStats.totalCases === 0 && <p>No mapped reports through this date.</p>}
        </div>
      </details>

      {/* Playback Controls & Quick Jump Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
        <div className="flex items-center gap-1">
          {/* Step Back 1 Day */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDateIndexChange(Math.max(0, currentDateIndex - 1))}
            title="Step backward 1 day"
            aria-label="Step backward 1 day"
            className="size-8 p-0 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <ChevronLeft className="size-4" />
          </Button>

          {/* Main Play / Pause Button */}
          <Button
            size="sm"
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pause playback" : "Start day-by-day animation"}
            className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-300'
                : isSurveillance
                ? 'bg-rose-700 hover:bg-rose-800 text-white'
                : 'bg-emerald-800 hover:bg-emerald-900 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="size-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </Button>

          {/* Step Forward 1 Day */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDateIndexChange(Math.min(dates.length - 1, currentDateIndex + 1))}
            title="Step forward 1 day"
            aria-label="Step forward 1 day"
            className="size-8 p-0 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <ChevronRight className="size-4" />
          </Button>

          {/* Speed Toggles: 1x, 2x, 4x */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 ml-1">
            {([1, 2, 4] as const).map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => onPlaybackSpeedChange(speed)}
                title={`Playback speed ${speed}x`}
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                  playbackSpeed === speed
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Quick Jump Presets */}
        <div className="flex items-center gap-1 text-[10.5px]">
          <button
            type="button"
            onClick={() => onDateIndexChange(0)}
            className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer transition-colors"
            title="Jump to timeline start"
          >
            Start
          </button>

          <button
            type="button"
            onClick={() => onDateIndexChange(-1)}
            className={`px-2.5 py-1 rounded-md border cursor-pointer transition-all ${
              currentDateIndex === dates.length - 1
                ? isSurveillance
                  ? 'bg-rose-700 text-white border-rose-800 font-bold'
                  : 'bg-emerald-800 text-white border-emerald-900 font-bold'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-semibold'
            }`}
            title="Jump to latest report date"
          >
            Latest 90 days
          </button>

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="p-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
              title="Reset timeline"
              aria-label="Reset timeline"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Explanatory Map Reading Helper */}
      <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 leading-tight flex items-center justify-between gap-2">
        <span>
          {isSurveillance ? (
            <>
              <strong className="text-rose-700">Red:</strong> Active open report ·{' '}
              <strong className="text-amber-600">Orange:</strong> 3.5 km radius ·{' '}
              <strong className="text-emerald-700">Green:</strong> No active report
            </>
          ) : (
            <>
              <strong className="text-rose-700">Red:</strong> Active report ·{' '}
              <strong className="text-amber-600">Amber:</strong> Historical case ·{' '}
              <strong className="text-emerald-700">Green:</strong> 0 cases
            </>
          )}
        </span>
        <span className="font-mono text-[9.5px] text-slate-400 shrink-0">
          {records.length} total event{records.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}
