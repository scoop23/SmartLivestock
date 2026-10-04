'use client';

import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Wind,
  Compass,
  Calendar,
} from 'lucide-react';
import {
  EnvironmentalWindInput,
  TimelineMonth,
} from './types';
import { TIMELINE_MONTHS } from './simulation';

interface GISTimelineProps {
  currentMonthIndex: number;
  onMonthChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  windInput: EnvironmentalWindInput;
}

export function GISTimeline({
  currentMonthIndex,
  onMonthChange,
  isPlaying,
  onTogglePlay,
  onReset,
  windInput,
}: GISTimelineProps) {
  const currentMonth = TIMELINE_MONTHS[currentMonthIndex] || TIMELINE_MONTHS[0];

  return (
    <div className="bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xl text-slate-800 pointer-events-auto w-full max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Top Status & Controls Bar */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase px-2 py-0.5 flex items-center gap-1 shadow-2xs">
            <Zap className="size-3 fill-white" />
            Epidemic Timeline
          </Badge>
          <span className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1">
            <Calendar className="size-3.5 text-emerald-700" />
            {currentMonth.monthName} {currentMonth.year}
          </span>
        </div>

        {/* Environmental Wind Display */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-sky-50 border border-sky-200/80 rounded-lg text-[10px] font-semibold text-sky-900">
          <Wind className="size-3.5 text-sky-600 animate-pulse" />
          <span className="font-bold">Wind: {windInput.cardinalDirection}</span>
          <span className="text-sky-700">({windInput.speedKmH} km/h)</span>
        </div>
      </div>

      {/* Timeline Range Slider with Labels */}
      <div className="space-y-1.5">
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

        {/* Month ticks */}
        <div className="flex justify-between text-[10px] font-bold text-slate-400 px-0.5">
          {TIMELINE_MONTHS.map((m, idx) => (
            <button
              key={m.label}
              type="button"
              onClick={() => onMonthChange(idx)}
              className={`hover:text-emerald-800 transition-colors cursor-pointer ${
                idx === currentMonthIndex
                  ? 'text-emerald-800 font-black scale-105'
                  : ''
              }`}
            >
              {m.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons & Environmental Source Footnote */}
      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onTogglePlay}
            className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer ${
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
                <span>Play Timeline</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="h-8 px-2.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>Reset</span>
          </Button>
        </div>

        <span className="text-[10px] text-slate-400 italic hidden sm:inline truncate max-w-[240px]">
          Source: {windInput.sourceAttribution}
        </span>
      </div>
    </div>
  );
}
