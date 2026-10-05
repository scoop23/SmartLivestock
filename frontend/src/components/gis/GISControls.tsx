'use client';

/**
 * ============================================================================
 * SmartLivestock GIS — Interactive Map Controls (`GISControls.tsx`)
 * ============================================================================
 * 
 * WHAT THIS COMPONENT DOES:
 * ----------------------------------------------------------------------------
 * This is the primary interactive command center anchored to the top-left of
 * the GIS screen (`absolute top-16 sm:top-4 left-3 sm:left-4 z-[900]`).
 * It allows the user (MAO official, inspector, or researcher) to control:
 *   1. Metric Layers: Cattle, Disease, Dairy Milk, Meat Yield, and Transport Movement.
 *   2. Viewing Perspective: 2D Orthogonal Map vs. 3D Volumetric Extrusion.
 *   3. Disease Surveillance Sub-modes:
 *      - "Reported": Verified field cases from PostgreSQL database.
 *      - "Simulation": Spatial Haversine distance-decay epidemic model with environmental wind drift.
 *      - "Surveillance Trend": Current disease activity status derived from verified records (not ML forecast).
 *   4. Camera Reset: Instantly refits the map viewport to Padre Garcia's geographic bounds.
 *   5. Telemetry Sidebar Toggle: Opens/collapses the right-hand inspection drawer.
 * 
 * DATA & STATE FLOW:
 * ----------------------------------------------------------------------------
 * ┌───────────────┐     User clicks Layer / Mode Toggle
 * │  GISControls  │ ────────────────────────────────────────┐
 * └───────────────┘                                         │
 *         │                                                 │
 *         ▼ (Invokes Callbacks)                             ▼ (Propagates to Parent)
 *   onLayerChange() ──────────────────────────────► page.tsx (Active Layer State)
 *   onViewModeChange() ───────────────────────────► page.tsx (Perspective 2D / 3D)
 *   onDiseaseSubModeChange() ─────────────────────► page.tsx (Reported / Simulation / Trend)
 *   onResetBounds() ──────────────────────────────► page.tsx (Increments resetTrigger counter)
 *                                                           │
 *                                                           ├─► Updates GISMap.tsx (re-renders shaders & bounds)
 *                                                           ├─► Updates GISLegend.tsx (swaps color scales)
 *                                                           └─► Updates GISTimeline.tsx (activates timeline slider)
 * 
 * CAPSTONE PRESENTATION / DEFENSE TALKING POINTS:
 * ----------------------------------------------------------------------------
 * - "Why a floating overlay rather than a fixed navigation bar?"
 *   By floating controls over the map canvas with `z-[900]`, the map retains
 *   100% viewport dimensions (edge-to-edge), providing the 'God's-Eye View' experience.
 * - "How does the camera reset work?"
 *   Rather than hardcoding arbitrary zoom coordinates, `onResetBounds` signals
 *   Leaflet's `map.fitBounds(geojson.getBounds(), { padding: [24, 24] })`, automatically
 *   adapting to any screen aspect ratio (mobile vs desktop ultrawide).
 */

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
  availableLivestockTypes?: string[];
  selectedLivestockType?: string;
  onLivestockTypeChange?: (type: string) => void;
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
  availableLivestockTypes = ['Cattle'],
  selectedLivestockType = 'Cattle',
  onLivestockTypeChange,
}: GISControlsProps) {
  const hasMultipleTypes = availableLivestockTypes.length > 1;
  const livestockLabel = hasMultipleTypes
    ? (selectedLivestockType === 'ALL' ? 'All Livestock' : selectedLivestockType || 'Livestock')
    : 'Cattle';

  const layerOptions: { id: MapLayer; label: string; icon: string }[] = [
    { id: 'cattle', label: livestockLabel, icon: '🐄' },
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
        <div className="flex items-center gap-1.5 sm:gap-2 pl-2 border-l border-slate-200">
          {/* 2D / 3D Segmented Control */}
          <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200">
            <button
              type="button"
              onClick={() => onViewModeChange('2D')}
              className={`min-h-[38px] sm:min-h-[26px] px-2.5 sm:px-2 py-1 sm:py-0.5 rounded-md text-xs font-black transition-all cursor-pointer ${
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
              className={`min-h-[38px] sm:min-h-[26px] px-2.5 sm:px-2 py-1 sm:py-0.5 rounded-md text-xs font-black transition-all cursor-pointer flex items-center gap-0.5 ${
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
            className="min-h-[44px] min-w-[44px] sm:min-h-[28px] sm:min-w-[28px] size-9 sm:size-7 rounded-lg text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
            className="min-h-[44px] min-w-[44px] sm:min-h-[28px] sm:min-w-[28px] size-9 sm:size-7 rounded-lg text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer"
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
              className={`min-h-[44px] sm:min-h-[30px] px-3 sm:px-2.5 py-2 sm:py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
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

      {/* Livestock Type Sub-Rail (Active only when multiple livestock types genuinely exist in backend data) */}
      {currentLayer === 'cattle' && hasMultipleTypes && (
        <div className="flex flex-col gap-1.5 animate-in fade-in duration-150">
          <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/90 shadow-lg flex items-center gap-1 max-w-fit flex-wrap">
            <span className="text-[10px] font-black uppercase text-slate-500 px-1.5 tracking-wider">
              Livestock Type:
            </span>

            <button
              type="button"
              onClick={() => onLivestockTypeChange?.('ALL')}
              className={`min-h-[44px] sm:min-h-[28px] px-3 sm:px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedLivestockType === 'ALL'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>🐾 All Livestock</span>
            </button>

            {availableLivestockTypes.map((type) => {
              const isSelected = selectedLivestockType?.toLowerCase() === type.toLowerCase();
              const icon =
                type.toLowerCase() === 'cattle'
                  ? '🐄'
                  : type.toLowerCase() === 'sheep'
                  ? '🐑'
                  : type.toLowerCase() === 'swine'
                  ? '🐖'
                  : type.toLowerCase() === 'goat'
                  ? '🐐'
                  : '🐾';
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onLivestockTypeChange?.(type)}
                  className={`min-h-[44px] sm:min-h-[28px] px-3 sm:px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{type}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Disease Sub-Modes Rail: [ Reported ] [ Simulation ] [ Surveillance Trend ] */}
      {currentLayer === 'disease' && (
        <div className="flex flex-col gap-1.5 animate-in fade-in duration-150">
          <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/90 shadow-lg flex items-center gap-1 max-w-fit">
            <span className="text-[10px] font-black uppercase text-slate-500 px-1.5 tracking-wider">
              Mode:
            </span>

            <button
              type="button"
              onClick={() => onDiseaseSubModeChange('reported')}
              className={`min-h-[44px] sm:min-h-[28px] px-3 sm:px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
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
              className={`min-h-[44px] sm:min-h-[28px] px-3 sm:px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
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
              onClick={() => onDiseaseSubModeChange('trend')}
              className={`min-h-[44px] sm:min-h-[28px] px-3 sm:px-2.5 py-1.5 sm:py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                diseaseSubMode === 'trend'
                  ? 'bg-purple-700 text-white shadow-xs ring-2 ring-purple-400/50'
                  : 'bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-800'
              }`}
            >
              <TrendingUp className="size-3" />
              <span>Surveillance Trend</span>
            </button>
          </div>

          {/* Clarification note for users seeking future statistical forecasts */}
          {diseaseSubMode === 'trend' && (
            <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-purple-200 shadow-md max-w-sm text-[10.5px] text-slate-700 flex items-center justify-between gap-2">
              <span>
                Surveillance Trend displays current active disease status from reported records. For statistical 3/6/12-month future forecasts, open{' '}
                <a
                  href="/analytics"
                  className="font-bold text-purple-700 hover:text-purple-900 underline underline-offset-2"
                >
                  Predictive Analytics &rarr;
                </a>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
