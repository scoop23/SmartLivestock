'use client';

import React from 'react';
import { MapLayer } from './types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Compass,
  Layers,
  Zap,
  RotateCcw,
  PanelRightClose,
  PanelRightOpen,
  MapPin,
} from 'lucide-react';

interface GISControlsProps {
  currentLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  simulationMode: boolean;
  onToggleSimulation: () => void;
  onResetBounds: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function GISControls({
  currentLayer,
  onLayerChange,
  simulationMode,
  onToggleSimulation,
  onResetBounds,
  sidebarOpen,
  onToggleSidebar,
}: GISControlsProps) {
  const layerOptions: { id: MapLayer; label: string; icon: string }[] = [
    { id: 'cattle', label: 'Cattle', icon: '🐄' },
    { id: 'disease', label: 'Disease', icon: '🩺' },
    { id: 'milk', label: 'Dairy Milk', icon: '🥛' },
    { id: 'meat', label: 'Meat Yield', icon: '🥩' },
    { id: 'movement', label: 'Movement', icon: '🚛' },
  ];

  return (
    <div className="flex flex-col gap-2 pointer-events-auto">
      {/* Title & Metadata Badge */}
      <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-lg flex items-center justify-between gap-3 max-w-fit">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-black shadow-2xs">
            <Compass className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xs text-slate-900 tracking-tight">
                SmartLivestock GIS
              </span>
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 font-mono border-emerald-300 text-emerald-800 bg-emerald-50 font-bold"
              >
                LIVE
              </Badge>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold block -mt-0.5">
              Padre Garcia, Batangas • MAO Telemetry
            </span>
          </div>
        </div>

        {/* Reset & Sidebar Toggle */}
        <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
          <Button
            variant="ghost"
            size="icon"
            onClick={onResetBounds}
            title="Reset to Full Extent"
            className="size-7 rounded-lg text-slate-600 hover:text-emerald-800 hover:bg-emerald-50"
          >
            <RotateCcw className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
            className="size-7 rounded-lg text-slate-600 hover:text-emerald-800 hover:bg-emerald-50"
          >
            {sidebarOpen ? (
              <PanelRightClose className="size-3.5" />
            ) : (
              <PanelRightOpen className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Layer Controls & Simulation Toggle */}
      <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/90 shadow-lg flex flex-wrap items-center gap-1 max-w-fit">
        <div className="flex items-center gap-1 px-1 text-slate-500">
          <Layers className="size-3.5 text-emerald-700" />
          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
            Layers:
          </span>
        </div>

        {layerOptions.map((opt) => {
          const isActive = currentLayer === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onLayerChange(opt.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}

        {/* Simulation Toggle Button */}
        <div className="pl-1 border-l border-slate-200 ml-0.5">
          <button
            type="button"
            onClick={onToggleSimulation}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              simulationMode
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400 ring-offset-1 animate-pulse'
                : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-800'
            }`}
          >
            <Zap className={`size-3 ${simulationMode ? 'fill-white text-white' : 'text-amber-600'}`} />
            <span>Simulation: {simulationMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
