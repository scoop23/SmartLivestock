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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MovementRecord } from './types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Truck,
  X,
} from 'lucide-react';

interface MovementTimelinePlayerProps {
  movements: MovementRecord[];
  activeDateIndex: number;
  onDateIndexChange: (idx: number | ((prev: number) => number)) => void;
  uniqueDates: string[];
  isAllDatesMode: boolean;
  onToggleAllDatesMode: () => void;
  onClose?: () => void;
}

export function MovementTimelinePlayer({
  movements,
  activeDateIndex,
  onDateIndexChange,
  uniqueDates,
  isAllDatesMode,
  onToggleAllDatesMode,
  onClose,
}: MovementTimelinePlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentDate = uniqueDates[activeDateIndex] || '';

  const activeMovementsCount = useMemo(() => {
    if (isAllDatesMode) return movements.length;
    return movements.filter((m) => m.date === currentDate).length;
  }, [movements, isAllDatesMode, currentDate]);

  const activeHeadsCount = useMemo(() => {
    if (isAllDatesMode) {
      return movements.reduce((acc, m) => acc + m.heads, 0);
    }
    return movements
      .filter((m) => m.date === currentDate)
      .reduce((acc, m) => acc + m.heads, 0);
  }, [movements, isAllDatesMode, currentDate]);

  // Playback timer
  useEffect(() => {
    if (isPlaying && !isAllDatesMode && uniqueDates.length > 1) {
      timerRef.current = setInterval(() => {
        onDateIndexChange((prev: number) => {
          if (prev >= uniqueDates.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isAllDatesMode, uniqueDates.length, onDateIndexChange]);

  const handlePrev = () => {
    if (activeDateIndex > 0) {
      onDateIndexChange(activeDateIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeDateIndex < uniqueDates.length - 1) {
      onDateIndexChange(activeDateIndex + 1);
    }
  };

  if (uniqueDates.length <= 1 && !isAllDatesMode) {
    return null;
  }

  const formattedCurrentDate = (() => {
    if (isAllDatesMode) return 'All Historical Permits';
    try {
      const d = new Date(currentDate);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return currentDate;
    }
  })();

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl p-3 sm:p-4 text-slate-800 space-y-2 pointer-events-auto">
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
            variant={isAllDatesMode ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleAllDatesMode}
            className={`text-[10px] font-bold h-7 px-2 cursor-pointer ${
              isAllDatesMode ? 'bg-blue-600 text-white' : 'text-slate-700'
            }`}
          >
            {isAllDatesMode ? 'Cumulative' : 'Single Date'}
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
      {!isAllDatesMode && uniqueDates.length > 1 && (
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
              onClick={() => setIsPlaying(!isPlaying)}
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
