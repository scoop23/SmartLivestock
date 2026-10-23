'use client';

/**
 * ============================================================================
 * SmartLivestock GIS — Movement Timeline Scrubber (`MovementTimelinePlayer.tsx`)
 * ============================================================================
 * 
 * ARCHITECTURAL DESIGN & CAPSTONE DEFENSE:
 * ----------------------------------------------------------------------------
 * Allows MAO, SIBAT, and livestock inspectors to explore recorded movements
 * chronologically over historical inspection dates.
 * 
 * Note: This is an event-based historical playback across recorded dates,
 * NOT a continuous real-time GPS simulation.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
ChevronLeft,
ChevronRight,
Pause,
Play,
Truck,
X
} from 'lucide-react';
import { useEffect,useMemo,useRef,useState } from 'react';
import { MovementRecord } from './types';

interface MovementTimelinePlayerProps {
  movements: MovementRecord[];
  activeDateIndex: number;
  onDateIndexChange: (idx: number | ((prev: number) => number)) => void;
  uniqueDates: string[];
  years: string[];
  selectedYear: string;
  onYearChange: (year: string) => void;
  timelineMode?: 'single' | 'cumulative' | 'all';
  onTimelineModeChange?: (mode: 'single' | 'cumulative' | 'all') => void;
  isAllDatesMode?: boolean;
  onToggleAllDatesMode?: () => void;
  onClose?: () => void;
}

export function MovementTimelinePlayer({
  movements,
  activeDateIndex,
  onDateIndexChange,
  uniqueDates,
  years,
  selectedYear,
  onYearChange,
  timelineMode,
  onTimelineModeChange,
  isAllDatesMode,
  onToggleAllDatesMode,
  onClose,
}: MovementTimelinePlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const mode = timelineMode ?? (isAllDatesMode ? 'all' : 'single');
  const currentDate = uniqueDates[activeDateIndex] || '';

  const activeIndexRef = useRef(activeDateIndex);
  activeIndexRef.current = activeDateIndex;
  const datesLengthRef = useRef(uniqueDates.length);
  datesLengthRef.current = uniqueDates.length;

  const activeMovementsCount = useMemo(() => {
    if (mode === 'all') return movements.length;
    if (mode === 'cumulative') {
      return movements.filter((m) => m.date && m.date <= currentDate).length;
    }
    return movements.filter((m) => m.date === currentDate).length;
  }, [movements, mode, currentDate]);

  const activeHeadsCount = useMemo(() => {
    if (mode === 'all') {
      return movements.reduce((acc, m) => acc + m.heads, 0);
    }
    if (mode === 'cumulative') {
      return movements
        .filter((m) => m.date && m.date <= currentDate)
        .reduce((acc, m) => acc + m.heads, 0);
    }
    return movements
      .filter((m) => m.date === currentDate)
      .reduce((acc, m) => acc + m.heads, 0);
  }, [movements, mode, currentDate]);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying || uniqueDates.length <= 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    timerRef.current = setInterval(() => {
      const maxIndex = datesLengthRef.current - 1;
      const current = activeIndexRef.current;
      if (current >= maxIndex) {
        setIsPlaying(false);
      } else {
        onDateIndexChange(current + 1);
      }
    }, 1200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isPlaying, uniqueDates.length, onDateIndexChange]);

  const handleTogglePlay = () => {
    if (mode === 'all') {
      onTimelineModeChange?.('single');
    }
    if (!isPlaying && activeDateIndex >= uniqueDates.length - 1) {
      onDateIndexChange(0);
    }
    setIsPlaying((prev) => !prev);
  };

  const handlePrev = () => {
    setIsPlaying(false);
    if (mode === 'all') {
      onTimelineModeChange?.('single');
    }
    if (activeDateIndex > 0) {
      onDateIndexChange(activeDateIndex - 1);
    }
  };

  const handleNext = () => {
    setIsPlaying(false);
    if (mode === 'all') {
      onTimelineModeChange?.('single');
    }
    if (activeDateIndex < uniqueDates.length - 1) {
      onDateIndexChange(activeDateIndex + 1);
    }
  };

  const handleToggleMode = () => {
    if (onTimelineModeChange) {
      if (mode === 'single') onTimelineModeChange('cumulative');
      else if (mode === 'cumulative') onTimelineModeChange('all');
      else onTimelineModeChange('single');
    } else if (onToggleAllDatesMode) {
      onToggleAllDatesMode();
    }
  };

  if (uniqueDates.length === 0) {
    return null;
  }

  const formattedCurrentDate = (() => {
    if (mode === 'all') return selectedYear === 'ALL' ? 'All-time permits' : `${selectedYear} all permits`;
    try {
      const d = new Date(currentDate);
      const str = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return mode === 'cumulative' ? `Up to ${str}` : str;
    } catch {
      return mode === 'cumulative' ? `Up to ${currentDate}` : currentDate;
    }
  })();

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl p-3 sm:p-4 text-slate-800 space-y-2 pointer-events-auto">
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter permits by year">
        <Button
          type="button"
          size="sm"
          variant={selectedYear === 'ALL' ? 'default' : 'outline'}
          aria-pressed={selectedYear === 'ALL'}
          onClick={() => {
            setIsPlaying(false);
            onYearChange('ALL');
          }}
          className="h-7 shrink-0 px-2.5 text-[10px]"
        >
          All time
        </Button>
        {years.map((year) => (
          <Button
            key={year}
            type="button"
            size="sm"
            variant={selectedYear === year ? 'default' : 'outline'}
            aria-pressed={selectedYear === year}
            onClick={() => {
              setIsPlaying(false);
              onYearChange(year);
            }}
            className="h-7 shrink-0 px-2.5 text-[10px]"
          >
            {year}
          </Button>
        ))}
      </div>

      {/* Header Info */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Truck className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-xs text-slate-900 truncate">
                {formattedCurrentDate}
              </span>
              <Badge variant="outline" className="text-[10px] font-bold border-blue-200 bg-blue-50 text-blue-900">
                {activeMovementsCount} permits • {activeHeadsCount} heads
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleMode}
            className="text-[10px] font-bold h-7 px-2.5 cursor-pointer bg-white border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 text-slate-800 shadow-2xs"
            title="Switch between Single date, Cumulative (growth over time), and All permits"
          >
            {mode === 'single' ? (
              <>
                <span className="size-1.5 rounded-full bg-blue-600 inline-block" />
                <span>Single date</span>
              </>
            ) : mode === 'cumulative' ? (
              <>
                <span className="size-1.5 rounded-full bg-emerald-600 inline-block" />
                <span>Cumulative</span>
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-slate-500 inline-block" />
                <span>All permits</span>
              </>
            )}
          </Button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrubber Controls */}
      {uniqueDates.length > 1 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={activeDateIndex === 0}
              className="size-7 p-0 rounded-lg cursor-pointer"
              aria-label="Previous date"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleTogglePlay}
              className="size-7 p-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play timeline'}
            >
              {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 ml-0.5" />}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={activeDateIndex === uniqueDates.length - 1}
              className="size-7 p-0 rounded-lg cursor-pointer"
              aria-label="Next date"
            >
              <ChevronRight className="size-4" />
            </Button>

            <input
              type="range"
              min={0}
              max={uniqueDates.length - 1}
              value={activeDateIndex}
              onChange={(e) => {
                setIsPlaying(false);
                if (mode === 'all') {
                  onTimelineModeChange?.('single');
                }
                onDateIndexChange(Number(e.target.value));
              }}
              className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />

            <span className="text-[10px] font-mono text-slate-500 shrink-0 font-bold">
              {activeDateIndex + 1}/{uniqueDates.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
