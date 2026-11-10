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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
Activity,
Box,
ChevronDown,
ChevronUp,
Clock,
Compass,
Layers,
PanelRightClose,
PanelRightOpen,
Radio,
RotateCcw,
ShieldAlert,
Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DiseaseSubMode,GISUserScope,MapLayer,Movement3DDisplayMode,SimulationColorMode,ViewMode } from './types';

interface GISControlsProps {
  currentLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  diseaseSubMode: DiseaseSubMode;
  onDiseaseSubModeChange: (subMode: DiseaseSubMode) => void;
  simulationColorMode: SimulationColorMode;
  onSimulationColorModeChange: (mode: SimulationColorMode) => void;
  onResetBounds: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  availableLivestockTypes?: string[];
  selectedLivestockType?: string;
  onLivestockTypeChange?: (type: string) => void;
  defaultExpanded?: boolean;
  userScope?: GISUserScope;
  movementDisplayMode?: Movement3DDisplayMode;
  onMovementDisplayModeChange?: (mode: Movement3DDisplayMode) => void;
  showMovementTimeline?: boolean;
  onToggleMovementTimeline?: () => void;
  showAdjacentDiseaseAlerts?: boolean;
  onToggleAdjacentDiseaseAlerts?: () => void;
  showAdjacentOutbreakColor?: boolean;
  onToggleAdjacentOutbreakColor?: () => void;
  showAdjacentOutbreakDots?: boolean;
  onToggleAdjacentOutbreakDots?: () => void;
  adjacentDiseaseAlertsCount?: number;
  onOpenForecaster?: () => void;
  showHistoricalTimeline?: boolean;
  onToggleHistoricalTimeline?: () => void;
  reportAsOf?: string;
}

export function GISControls({
  currentLayer,
  onLayerChange,
  viewMode,
  onViewModeChange,
  diseaseSubMode,
  onDiseaseSubModeChange,
  simulationColorMode,
  onSimulationColorModeChange,
  onResetBounds,
  sidebarOpen,
  onToggleSidebar,
  availableLivestockTypes = ['Cattle'],
  selectedLivestockType = 'Cattle',
  onLivestockTypeChange,
  defaultExpanded = false,
  userScope,
  movementDisplayMode = 'both',
  onMovementDisplayModeChange,
  showMovementTimeline = false,
  onToggleMovementTimeline,
  showAdjacentDiseaseAlerts = true,
  onToggleAdjacentDiseaseAlerts,
  showAdjacentOutbreakColor = true,
  onToggleAdjacentOutbreakColor,
  showAdjacentOutbreakDots = true,
  onToggleAdjacentOutbreakDots,
  adjacentDiseaseAlertsCount = 0,
  onOpenForecaster,
  showHistoricalTimeline = true,
  onToggleHistoricalTimeline,
  reportAsOf,
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

  const { user } = useAuth();
  const userRole = (user?.role || userScope?.role || '').toUpperCase();
  const isCbat = ['CBAT', 'SIBAT'].includes(userRole) || ['CBAT', 'SIBAT'].includes((userScope?.role || '').toUpperCase());
  const isFarmerRole = userRole === 'FARMER' || userScope?.scope === 'OWN_BARANGAY';

  const allLayerOptions: { id: MapLayer; label: string; icon: string }[] = useMemo(() => {
    const list: { id: MapLayer; label: string; icon: string }[] = [
      { id: 'cattle', label: livestockLabel, icon: '🐄' },
      { id: 'disease', label: 'Disease', icon: '🩺' },
      { id: 'mortality', label: 'Mortality', icon: '☠️' },
    ];
    if (!isCbat) {
      list.push(
        { id: 'milk', label: 'Recorded Milk (Farmer-reported)', icon: '🥛' },
        { id: 'farmer_meat', label: 'Recorded Meat Yield (Farmer-reported)', icon: '🥩' },
        { id: 'movement', label: 'Movement', icon: '🚛' },
      );
    }
    return list;
  }, [livestockLabel, isCbat]);

  // Filter layers according to user's authorized role scope
  const layerOptions = useMemo(() => {
    if (!userScope?.allowed_layers) {
      return allLayerOptions;
    }
    return allLayerOptions.filter(
      (opt) =>
        userScope.allowed_layers.includes(opt.id) &&
        (!isCbat || !['movement', 'milk', 'farmer_meat', 'slaughter_yield', 'meat'].includes(opt.id))
    );
  }, [allLayerOptions, userScope, isCbat]);

  const activeOption = layerOptions.find((opt) => opt.id === currentLayer) || layerOptions[0] || allLayerOptions[0];
  const canUse3D = !userScope || userScope.allowed_modes?.includes('3D');
  const canUseSim = Boolean(userScope?.can_use_simulation) && !isFarmerRole && !isCbat;
  const canUseSurveillance = true;
  const canUseHaversineForecaster = Boolean(onOpenForecaster);

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
              {userScope?.title || 'Padre Garcia • Map Data'}
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
          {/* 2D / 3D Segmented Control follows the role-scoped modes from the GIS API. */}
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
            title={sidebarOpen ? 'Hide Map Details' : 'Show Map Details'}
            aria-label={sidebarOpen ? 'Hide map details' : 'Show map details'}
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

      {/* Movement Layer Tools: 3D Display Switcher & View Timeline Button */}
      {currentLayer === 'movement' && (
        <div className="flex flex-wrap items-center gap-2 max-w-fit animate-in fade-in slide-in-from-top-1 duration-150">
          {viewMode === '3D' && (
            <div className="bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-200/90 shadow-md flex items-center gap-2 max-w-fit">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1 hidden sm:inline whitespace-nowrap">
                3D Display:
              </span>
              <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200/80 gap-0.5">
                <button
                  type="button"
                  onClick={() => onMovementDisplayModeChange?.('lines')}
                  title="Lines -> Destination: View livestock movement flow lines to destinations"
                  aria-label="Switch to 3D movement lines to destination"
                  className={`min-h-[28px] sm:min-h-[24px] px-2.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                    movementDisplayMode === 'lines'
                      ? 'bg-sky-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>🚛</span>
                  <span>Lines -&gt; Destination</span>
                </button>
                <button
                  type="button"
                  onClick={() => onMovementDisplayModeChange?.('density')}
                  title="Height Density Only: View 3D volumetric extrusion columns without transit lines"
                  aria-label="Switch to 3D height density only"
                  className={`min-h-[28px] sm:min-h-[24px] px-2.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                    movementDisplayMode === 'density'
                      ? 'bg-emerald-800 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>📊</span>
                  <span>Height Density</span>
                </button>
                <button
                  type="button"
                  onClick={() => onMovementDisplayModeChange?.('both')}
                  title="Both: View 3D height density columns with livestock movement lines"
                  aria-label="Switch to 3D height density with movement lines"
                  className={`min-h-[28px] sm:min-h-[24px] px-2.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                    movementDisplayMode === 'both'
                      ? 'bg-slate-900 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>🌐</span>
                  <span>Both</span>
                </button>
              </div>
            </div>
          )}

          {/* Dedicated "View Timeline" Toggle Button */}
          {onToggleMovementTimeline && (
            <button
              type="button"
              onClick={onToggleMovementTimeline}
              aria-pressed={showMovementTimeline}
              title={
                showMovementTimeline
                  ? 'Hide movement timeline and show all permits'
                  : 'View movement timeline player to scrub inspection dates'
              }
              className={`min-h-[34px] sm:min-h-[30px] px-3 py-1 rounded-xl border shadow-md flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer pointer-events-auto backdrop-blur-md ${
                showMovementTimeline
                  ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-400/40 shadow-blue-500/25 font-black'
                  : 'bg-white/95 text-slate-700 border-slate-200/90 hover:bg-blue-50 hover:text-blue-900 hover:border-blue-300'
              }`}
            >
              <Clock className={`size-3.5 ${showMovementTimeline ? 'text-white' : 'text-blue-600'}`} />
              <span>{showMovementTimeline ? 'Hide Timeline' : 'View Timeline'}</span>
              {showMovementTimeline && (
                <span className="relative flex size-2 ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-white" />
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Historical Date Timeline Button for Cattle and Mortality */}
      {(currentLayer === 'cattle' || currentLayer === 'mortality') && onToggleHistoricalTimeline && (
        <div className="flex flex-wrap items-center gap-2 max-w-fit animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            type="button"
            onClick={onToggleHistoricalTimeline}
            aria-pressed={showHistoricalTimeline}
            title={
              showHistoricalTimeline
                ? 'Hide timeline scrubber and view latest data'
                : 'Scrub historical dates to view past records'
            }
            className={`min-h-[34px] sm:min-h-[30px] px-3 py-1 rounded-xl border shadow-md flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer pointer-events-auto backdrop-blur-md ${
              showHistoricalTimeline
                ? 'bg-emerald-800 text-white border-emerald-900 ring-2 ring-emerald-400/40 shadow-emerald-500/25 font-black'
                : 'bg-white/95 text-slate-700 border-slate-200/90 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-300'
            }`}
          >
            <Clock className={`size-3.5 ${showHistoricalTimeline ? 'text-white' : 'text-emerald-700'}`} />
            <span>{showHistoricalTimeline ? 'Hide Timeline' : 'View Timeline'}</span>
            {reportAsOf && showHistoricalTimeline && (
              <span className="text-[10.5px] opacity-90 pl-1 border-l border-emerald-600 font-mono">
                {reportAsOf}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Collapsible Layer & Filter Panel (Drops down when expanded, leaving map 100% visible when closed) */}
      {isExpanded && (
        <div
          id="gis-control-panel"
          role="region"
          aria-label="GIS Map Layer and Filter Controls"
          className="-ml-[3.25rem] lg:ml-0 w-[calc(100vw-1.5rem)] sm:w-md sm:max-w-md max-h-[70dvh] overflow-y-auto bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl p-3 sm:p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150 text-slate-800"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-emerald-800" />
              <span className="font-black text-xs tracking-tight text-slate-900 uppercase">
                GIS Controls & Filters
              </span>
            </div>
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
                  <span>Disease Map Options</span>
                </span>
                {diseaseSectionOpen ? (
                  <ChevronUp className="size-3 text-slate-400" />
                ) : (
                  <ChevronDown className="size-3 text-slate-400" />
                )}
              </button>

              {diseaseSectionOpen && (
                <div className="flex flex-col gap-1.5 pt-0.5">
                  {(canUseSurveillance || canUseSim) && (
                    <div className={`grid grid-cols-2 gap-1.5 ${canUseSim ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
                      <button
                        type="button"
                        onClick={() => onDiseaseSubModeChange('reported')}
                        className={`min-h-[40px] sm:min-h-[30px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                          diseaseSubMode === 'reported'
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                        title="Approved reports are not proof that disease is confirmed"
                      >
                        <Activity className="size-3" />
                        <span>Disease Reports</span>
                      </button>

                      {canUseSurveillance && (
                        <button
                          type="button"
                          onClick={() => onDiseaseSubModeChange('surveillance')}
                          className={`min-h-[40px] sm:min-h-[30px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                            diseaseSubMode === 'surveillance'
                              ? 'bg-rose-700 text-white border-rose-800 shadow-2xs ring-2 ring-rose-400/50'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-800'
                          }`}
                          title="Map colors: Red (recent approved report), Orange (within 3.5 km), Green (no recent report shown)"
                        >
                          <ShieldAlert className="size-3" />
                          <span>Report Alerts</span>
                        </button>
                      )}

                      {canUseSim && (
                        <button
                          type="button"
                          onClick={() => onDiseaseSubModeChange('simulation')}
                          className={`min-h-[40px] sm:min-h-[30px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                            diseaseSubMode === 'simulation'
                              ? 'bg-amber-600 text-white border-amber-700 shadow-2xs ring-2 ring-amber-400/50'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-800'
                          }`}
                          title="Example: See how disease could spread over time"
                        >
                          <Zap className="size-3" />
                          <span>Example</span>
                        </button>
                      )}
                    </div>
                  )}

                  {diseaseSubMode === 'surveillance' && canUseSurveillance && (
                    <div className="bg-rose-50/90 px-2.5 py-1.5 rounded-lg border border-rose-200 text-[10.5px] text-rose-950 leading-tight space-y-0.5">
                      <span className="font-bold flex items-center gap-1 text-rose-900">
                        <span className="size-2 rounded-full bg-rose-600" />
                        How to read these map colors:
                      </span>
                      <p className="text-[10px] text-slate-600">
                        <strong>Red</strong> = A recent approved report needs follow-up. <strong>Orange</strong> = Barangay centers are within 3.5 km. <strong>Green</strong> = No recent report is shown here. Map colors do not prove whether disease is present or absent.
                      </p>
                    </div>
                  )}

                  {/* Adjacent Report-Alert Pulse Dots & Color Toggles (ONLY IN SURVEILLANCE MODE) */}
                  {diseaseSubMode === 'surveillance' && onToggleAdjacentDiseaseAlerts && (
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
                      {/* Master Report-Alert Toggle: Toggles both Color and Dots together */}
                      <button
                        type="button"
                        onClick={onToggleAdjacentDiseaseAlerts}
                        role="switch"
                        aria-checked={showAdjacentDiseaseAlerts}
                        className={`min-h-[40px] sm:min-h-[34px] px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                          showAdjacentDiseaseAlerts
                            ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-2xs ring-2 ring-rose-400/20'
                            : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base shrink-0">🚨</span>
                          <div className="min-w-0">
                            <span className="font-extrabold truncate block">Nearby Disease Reports</span>
                            <span className={`text-[9.5px] block truncate ${showAdjacentDiseaseAlerts ? 'text-rose-700 font-semibold' : 'text-slate-400'}`}>
                              {showAdjacentOutbreakColor && showAdjacentOutbreakDots
                                ? 'Markers and map colors are on'
                                : showAdjacentOutbreakColor
                                ? 'Map colors are on; markers are off'
                                : showAdjacentOutbreakDots
                                ? 'Markers are on; map colors are off'
                                : 'Click to show nearby disease reports'}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[10px] uppercase font-mono font-black px-1.5 py-0.5 rounded shrink-0 ml-1.5 ${
                          showAdjacentOutbreakColor && showAdjacentOutbreakDots
                            ? 'bg-rose-600 text-white'
                            : showAdjacentDiseaseAlerts
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {showAdjacentOutbreakColor && showAdjacentOutbreakDots
                            ? 'ON'
                            : showAdjacentDiseaseAlerts
                            ? 'PARTLY ON'
                            : 'OFF'}
                        </span>
                      </button>

                      {/* Sub-toggles: Separate Color & Dot Toggles */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={onToggleAdjacentOutbreakColor}
                          className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border flex items-center justify-between transition-all cursor-pointer ${
                            showAdjacentOutbreakColor
                              ? 'bg-rose-100/70 text-rose-900 border-rose-300 shadow-2xs'
                              : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Show or hide map colors for nearby reports"
                        >
                          <span className="flex items-center gap-1 truncate">
                            <span>🎨</span>
                            <span>Map Color</span>
                          </span>
                          <span className={`font-mono text-[9px] px-1 py-0.2 rounded font-black ${
                            showAdjacentOutbreakColor ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {showAdjacentOutbreakColor ? 'ON' : 'OFF'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={onToggleAdjacentOutbreakDots}
                          className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border flex items-center justify-between transition-all cursor-pointer ${
                            showAdjacentOutbreakDots
                              ? 'bg-rose-100/70 text-rose-900 border-rose-300 shadow-2xs'
                              : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Show or hide markers for nearby reports"
                        >
                          <span className="flex items-center gap-1 truncate">
                            <span>🔴</span>
                            <span>Markers</span>
                          </span>
                          <span className={`font-mono text-[9px] px-1 py-0.2 rounded font-black ${
                            showAdjacentOutbreakDots ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {showAdjacentOutbreakDots ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {canUseHaversineForecaster && (
                    <button
                      type="button"
                      onClick={onOpenForecaster}
                      className="min-h-[34px] sm:min-h-[28px] w-full px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-indigo-200 bg-indigo-50/90 text-indigo-800 hover:bg-indigo-100 shadow-2xs"
                      title="Open the disease report map"
                    >
                      <Radio className="size-3.5 text-indigo-600 animate-pulse" />
                      <span>Disease Report Map</span>
                    </button>
                  )}

                  {diseaseSubMode === 'simulation' && (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-1.5 border border-slate-200">
                      <span className="pl-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Show by</span>
                      <div className="flex rounded-md bg-slate-200/70 p-0.5" role="group" aria-label="Example map display option">
                        {(['cases', 'pressure'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => onSimulationColorModeChange(mode)}
                            aria-pressed={simulationColorMode === mode}
                            className={`min-h-[30px] px-3 py-1 rounded text-[11px] font-bold capitalize transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 ${
                              simulationColorMode === mode
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {mode === 'cases' ? 'Cases' : 'Possible spread'}
                          </button>
                        ))}
                      </div>
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
