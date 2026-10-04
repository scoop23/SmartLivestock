'use client';

import React from 'react';
import { MapLayer, ViewMode, DiseaseSubMode } from './types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Compass,
  Layers,
  Zap,
  RotateCcw,
  PanelRightClose,
  PanelRightOpen,
  Activity,
  TrendingUp,
  Box,
} from 'lucide-react';

interface GISControlsProps {
  currentLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  diseaseSubMode: DiseaseSubMode;
  onDiseaseSubModeChange: (subMode: DiseaseSubMode) => void;
  onResetBounds: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function GISControls({
  currentLayer,
  onLayerChange,
  viewMode,
  onViewModeChange,
  diseaseSubMode,
  onDiseaseSubModeChange,
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
      {/* Title & Metadata Top Banner */}
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

        {/* 2D / 3D Switcher & Controls */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          {/* 2D / 3D Segmented Control */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200">
            <button
              type="button"
              onClick={() => onViewModeChange('2D')}
              className={`px-2 py-0.5 rounded-md text-xs font-black transition-all cursor-pointer ${
                viewMode === '2D'
                  ? 'bg-white text-emerald-950 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              2D
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('3D')}
              className={`px-2 py-0.5 rounded-md text-xs font-black transition-all cursor-pointer flex items-center gap-0.5 ${
                viewMode === '3D'
                  ? 'bg-emerald-800 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Box className="size-2.5 inline" />
              <span>3D</span>
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onResetBounds}
            title="Reset to Full Extent"
            className="size-7 rounded-lg text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
            className="size-7 rounded-lg text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer"
          >
            {sidebarOpen ? (
              <PanelRightClose className="size-3.5" />
            ) : (
              <PanelRightOpen className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Layer Controls Pill Rail */}
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
      </div>

      {/* Disease Sub-Modes Rail: [ Reported ] [ Simulation ] [ Forecast ] */}
      {currentLayer === 'disease' && (
        <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/90 shadow-lg flex items-center gap-1 max-w-fit animate-in fade-in duration-150">
          <span className="text-[10px] font-black uppercase text-slate-500 px-1.5 tracking-wider">
            Mode:
          </span>

          <button
            type="button"
            onClick={() => onDiseaseSubModeChange('reported')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              diseaseSubMode === 'reported'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Activity className="size-3" />
            <span>Reported Cases</span>
          </button>

          <button
            type="button"
            onClick={() => onDiseaseSubModeChange('simulation')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              diseaseSubMode === 'simulation'
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400/50'
                : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-800'
            }`}
          >
            <Zap className="size-3" />
            <span>Epidemic Simulation</span>
          </button>

          <button
            type="button"
            onClick={() => onDiseaseSubModeChange('forecast')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              diseaseSubMode === 'forecast'
                ? 'bg-sky-700 text-white shadow-xs ring-2 ring-sky-400/50'
                : 'bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-800'
            }`}
          >
            <TrendingUp className="size-3" />
            <span>Predictive Forecast</span>
          </button>
        </div>
      )}
    </div>
  );
}
