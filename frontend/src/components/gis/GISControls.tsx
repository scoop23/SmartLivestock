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

import React, { useState, useRef, useEffect } from 'react';
import { MapLayer, ViewMode, DiseaseSubMode, GISUserScope } from './types';
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
  ChevronDown,
  ChevronUp,
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
  defaultExpanded?: boolean;
  userScope?: GISUserScope;
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
  defaultExpanded = false,
  userScope,
}: GISControlsProps) {
  // Collapsible control panel state (collapsed by default for map-first view)
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  // Collapsible individual sections inside the panel
  const [layersSectionOpen, setLayersSectionOpen] = useState<boolean>(true);
  const [livestockSectionOpen, setLivestockSectionOpen] = useState<boolean>(true);
  const [diseaseSectionOpen, setDiseaseSectionOpen] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close panel on Escape key or when clicking outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        isExpanded &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const hasMultipleTypes = availableLivestockTypes.length > 1;
  const livestockLabel = hasMultipleTypes
    ? (selectedLivestockType === 'ALL' ? 'All Livestock' : selectedLivestockType || 'Livestock')
    : 'Cattle';

  const allLayerOptions: { id: MapLayer; label: string; icon: string }[] = [
    { id: 'cattle', label: livestockLabel, icon: '🐄' },
    { id: 'disease', label: 'Disease', icon: '🩺' },
    { id: 'milk', label: 'Dairy Milk', icon: '🥛' },
    { id: 'farmer_meat', label: 'Farmer Meat', icon: '🥩' },
    { id: 'slaughter_yield', label: 'Slaughter Yield', icon: '🔪' },
    { id: 'mortality', label: 'Mortality', icon: '☠️' },
    { id: 'movement', label: 'Movement', icon: '🚛' },
  ];

  // Filter layers according to user's authorized role scope
  const layerOptions = userScope?.allowed_layers
    ? allLayerOptions.filter(
        (opt) =>
          userScope.allowed_layers.includes(opt.id) ||
          (opt.id === 'slaughter_yield' && userScope.allowed_layers.includes('meat' as MapLayer))
      )
    : allLayerOptions;

  const activeOption = layerOptions.find((opt) => opt.id === currentLayer) || layerOptions[0] || allLayerOptions[0];
  const canUse3D = !userScope || userScope.allowed_modes?.includes('3D');
  const canUseSim = !userScope || userScope.can_use_simulation;

  return (
    <div ref={containerRef} className="flex flex-col gap-2 pointer-events-auto">
      {/* Top Floating Command Bar (Always compact, map-first, 100% responsive) */}
      <div className="bg-white/95 backdrop-blur-md px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200/90 shadow-lg flex items-center justify-between gap-2 sm:gap-3 max-w-fit">
        {/* Brand & Telemetry Badge */}
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-black shadow-2xs shrink-0">
            <Compass className="size-4" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs text-slate-900 tracking-tight whitespace-nowrap">
                SmartLivestock GIS
              </span>
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 font-mono border-emerald-300 text-emerald-800 bg-emerald-50 font-bold"
              >
                LIVE
              </Badge>
            </div>
            <span className="text-[9.5px] text-slate-500 font-semibold block -mt-0.5 whitespace-nowrap">
              {userScope?.title || 'Padre Garcia • GIS Telemetry'}
            </span>
          </div>
        </div>

        {/* Collapsible Layer Toggle Pill Button */}
        <div className="pl-1 sm:pl-2 border-l border-slate-200">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-controls="gis-control-panel"
            aria-label={isExpanded ? "Collapse GIS layer controls" : "Expand GIS layer controls"}
            className={`min-h-[34px] sm:min-h-[30px] px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
              isExpanded
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                : 'bg-emerald-50/80 text-emerald-900 border-emerald-200/90 hover:bg-emerald-100 hover:border-emerald-300'
            }`}
          >
            <Layers className={`size-3.5 shrink-0 ${isExpanded ? 'text-emerald-200' : 'text-emerald-700'}`} />
            <span className="hidden sm:inline font-bold">Layers:</span>
            <span className="flex items-center gap-1">
              <span>{activeOption.icon}</span>
              <span className="max-w-[85px] sm:max-w-none truncate">{activeOption.label}</span>
              {currentLayer === 'disease' && diseaseSubMode === 'simulation' && (
                <span className="text-[10px] opacity-90 hidden sm:inline">(Sim)</span>
              )}
            </span>
            {isExpanded ? (
              <ChevronUp className="size-3.5 opacity-80 shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 opacity-80 shrink-0" />
            )}
          </button>
        </div>

        {/* Quick Map Tools: 2D/3D Switcher, Camera Reset, Sidebar Toggle */}
        <div className="flex items-center gap-1 sm:gap-1.5 pl-1 sm:pl-2 border-l border-slate-200">
          {/* 2D / 3D Segmented Control (3D enabled only for authorized roles like Admin/MAO) */}
          {canUse3D ? (
            <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200">
              <button
                type="button"
                onClick={() => onViewModeChange('2D')}
                aria-label="Switch to 2D orthogonal map"
                className={`min-h-[30px] sm:min-h-[26px] px-2 sm:px-2 py-1 sm:py-0.5 rounded-md text-xs font-black transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
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
                aria-label="Switch to 3D extruded perspective"
                className={`min-h-[30px] sm:min-h-[26px] px-2 sm:px-2 py-1 sm:py-0.5 rounded-md text-xs font-black transition-all cursor-pointer flex items-center gap-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                  viewMode === '3D'
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Box className="size-2.5 inline" />
                <span>3D</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-600">
              2D
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onResetBounds}
            title="Reset Camera to Full Extent"
            aria-label="Reset camera bounds to Padre Garcia"
            className="size-8 sm:size-7 rounded-lg text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Hide Telemetry Sidebar' : 'Show Telemetry Sidebar'}
            aria-label={sidebarOpen ? 'Hide telemetry sidebar' : 'Show telemetry sidebar'}
            className="size-8 sm:size-7 rounded-lg text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer"
          >
            {sidebarOpen ? (
              <PanelRightClose className="size-3.5" />
            ) : (
              <PanelRightOpen className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Collapsible Layer & Filter Panel (Drops down when expanded, leaving map 100% visible when closed) */}
      {isExpanded && (
        <div
          id="gis-control-panel"
          role="region"
          aria-label="GIS Map Layer and Filter Controls"
          className="w-full max-w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[70dvh] overflow-y-auto bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl p-3 sm:p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-800"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-emerald-800" />
              <span className="font-black text-xs tracking-tight text-slate-900 uppercase">
                GIS Controls & Filters
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-label="Hide control panel"
              className="text-slate-500 hover:text-slate-800 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
            >
              <ChevronUp className="size-3.5" />
              <span>Hide Controls</span>
            </button>
          </div>

          {/* Section 1: Map Layers (Collapsible) */}
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setLayersSectionOpen((prev) => !prev)}
              aria-expanded={layersSectionOpen}
              className="flex items-center justify-between w-full text-[11px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-900 cursor-pointer py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded"
            >
              <span className="flex items-center gap-1.5">
                <span>Map Layers</span>
                <span className="text-[10px] lowercase font-normal text-slate-400">
                  (select visual overlay)
                </span>
              </span>
              {layersSectionOpen ? (
                <ChevronUp className="size-3 text-slate-400" />
              ) : (
                <ChevronDown className="size-3 text-slate-400" />
              )}
            </button>

            {layersSectionOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-0.5">
                {layerOptions.map((opt) => {
                  const isActive = currentLayer === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onLayerChange(opt.id)}
                      className={`min-h-[42px] sm:min-h-[34px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                        isActive
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-sm shrink-0">{opt.icon}</span>
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Livestock Types (Collapsible, active for Cattle & Mortality layers) */}
          {(currentLayer === 'cattle' || currentLayer === 'mortality') && hasMultipleTypes && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLivestockSectionOpen((prev) => !prev)}
                aria-expanded={livestockSectionOpen}
                className="flex items-center justify-between w-full text-[11px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-900 cursor-pointer py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded"
              >
                <span className="flex items-center gap-1.5">
                  <span>Livestock Species</span>
                  <span className="text-[10px] lowercase font-normal text-slate-400">
                    ({selectedLivestockType || 'All'})
                  </span>
                </span>
                {livestockSectionOpen ? (
                  <ChevronUp className="size-3 text-slate-400" />
                ) : (
                  <ChevronDown className="size-3 text-slate-400" />
                )}
              </button>

              {livestockSectionOpen && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onLivestockTypeChange?.('ALL')}
                    className={`min-h-[38px] sm:min-h-[28px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                      selectedLivestockType === 'ALL'
                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
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
                        className={`min-h-[38px] sm:min-h-[28px] px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                          isSelected
                            ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{icon}</span>
                        <span>{type}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Disease Surveillance Modes (Collapsible, active for Disease layer) */}
          {currentLayer === 'disease' && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDiseaseSectionOpen((prev) => !prev)}
                aria-expanded={diseaseSectionOpen}
                className="flex items-center justify-between w-full text-[11px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-900 cursor-pointer py-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded"
              >
                <span className="flex items-center gap-1.5">
                  <span>Disease Surveillance Mode</span>
                  <span className="text-[10px] lowercase font-normal text-slate-400">
                    ({diseaseSubMode})
                  </span>
                </span>
                {diseaseSectionOpen ? (
                  <ChevronUp className="size-3 text-slate-400" />
                ) : (
                  <ChevronDown className="size-3 text-slate-400" />
                )}
              </button>

              {diseaseSectionOpen && (
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDiseaseSubModeChange('reported')}
                      className={`min-h-[40px] sm:min-h-[30px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                        diseaseSubMode === 'reported'
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Activity className="size-3" />
                      <span>Reported Cases</span>
                    </button>

                    {canUseSim && (
                      <button
                        type="button"
                        onClick={() => onDiseaseSubModeChange('simulation')}
                        className={`min-h-[40px] sm:min-h-[30px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                          diseaseSubMode === 'simulation'
                            ? 'bg-amber-600 text-white border-amber-700 shadow-2xs ring-2 ring-amber-400/50'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-800'
                        }`}
                      >
                        <Zap className="size-3" />
                        <span>Simulation</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDiseaseSubModeChange('trend')}
                      className={`min-h-[40px] sm:min-h-[30px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                        diseaseSubMode === 'trend'
                          ? 'bg-purple-700 text-white border-purple-800 shadow-2xs ring-2 ring-purple-400/50'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-purple-50 hover:text-purple-800'
                      }`}
                    >
                      <TrendingUp className="size-3" />
                      <span>Trend</span>
                    </button>
                  </div>

                  {diseaseSubMode === 'trend' && (
                    <div className="bg-purple-50/80 px-2.5 py-1.5 rounded-lg border border-purple-200 text-[10.5px] text-purple-900 leading-tight">
                      Surveillance Trend displays current active disease status from field reports. For statistical forecasts, see{' '}
                      <a
                        href="/analytics"
                        className="font-bold underline underline-offset-2 hover:text-purple-950"
                      >
                        Predictive Analytics &rarr;
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick Collapse Footer */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              Esc to close • Map updates live
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-6 px-2 text-[10px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Done / Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
