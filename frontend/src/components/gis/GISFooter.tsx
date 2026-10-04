'use client';

import React from 'react';
import { Database, MapPin, Wind, Sparkles } from 'lucide-react';

export function GISFooter() {
  return (
    <footer className="w-full bg-slate-950/85 backdrop-blur-md border-t border-white/10 text-white/70 py-1.5 px-4 text-[10px] flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pointer-events-auto z-[800]">
      <div className="flex items-center gap-2">
        <span className="font-bold text-white tracking-tight flex items-center gap-1">
          <Sparkles className="size-3 text-emerald-400" />
          SmartLivestock-Batangas
        </span>
        <span className="text-white/40">•</span>
        <span className="text-emerald-300 font-medium">
          Padre Garcia Municipal Agriculture Office (MAO)
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/60">
        <span className="flex items-center gap-1">
          <Database className="size-2.5 text-emerald-400" />
          GIS: PostgreSQL Database
        </span>
        <span className="text-white/30">•</span>
        <span className="flex items-center gap-1">
          <MapPin className="size-2.5 text-sky-400" />
          Geometry: Padre Garcia Barangay Boundaries (18)
        </span>
        <span className="text-white/30">•</span>
        <span className="flex items-center gap-1">
          <Wind className="size-2.5 text-amber-400" />
          Environment: PAGASA Climatology
        </span>
        <span className="text-white/30">•</span>
        <span className="font-mono text-white/50">v2.0</span>
      </div>
    </footer>
  );
}
