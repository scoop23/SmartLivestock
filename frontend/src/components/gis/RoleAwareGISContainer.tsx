'use client';

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useClientReady } from "@/hooks/use-browser-state";
/**
 * ============================================================================
 * SmartLivestock GIS — Unified Role-Aware Container (`RoleAwareGISContainer.tsx`)
 * ============================================================================
 * 
 * ARCHITECTURAL DESIGN & CAPSTONE DEFENSE CONCEPTS:
 * ----------------------------------------------------------------------------
 * 1. ZERO CODE DUPLICATION:
 *    Instead of creating separate `FarmerGISMap.tsx`, `SibatGISMap.tsx`, and
 *    `AdminGISMap.tsx`, SmartLivestock adopts the Single Reusable GIS Engine pattern.
 *    The exact same high-performance Leaflet canvas, GeoJSON polygon renderer,
 *    permanent centroid labels, collapsible control bar, dynamic legend, and
 *    inspection sidebar are shared across all roles.
 * 
 * 2. SERVER-DRIVEN ROLE AWARENESS:
 *    The component queries `GET /api/analytics/gis/` with the user's active session.
 *    The Django backend returns:
 *      - `user_scope`: Allowed layers, allowed view modes, whether simulation is permitted,
 *        and the list of authorized barangays (`allowed_barangays`).
 *      - `farmer_stats`: Personal verified stats (e.g. My Cattle, My Dairy Yield)
 *        for farmers to compare their farm with community aggregates.
 *      - Out-of-scope barangays have their counts zeroed on the server, guaranteeing
 *        security even if someone inspects the network payload.
 * 
 * 3. GRACEFUL FEATURE DEGRADATION:
 *    - Admin / MAO: God's-Eye view, all 18 barangays, 2D/3D, epidemic simulation timeline.
 *    - SIBAT / CBAT: Field monitoring of assigned barangays, all production/disease/mortality
 *      layers, simulation disabled.
 *    - Farmer: Focused on their registered barangay with safe aggregate metrics and
 *      their own farm totals. Out-of-scope barangays rendered muted and non-clickable.
 *    - Auction / Slaughterhouse: Operational movement tracking and carcass yields.
 */

import { useIsMobile } from '@/components/ui/use-mobile';
import api from '@/lib/axios';
import { ArrowLeft,Info,Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { GISControls } from './GISControls';
import { GISLegend } from './GISLegend';
import { GISMap } from './GISMap';
import { GISSidebar } from './GISSidebar';
import { GISTimeline } from './GISTimeline';
import { MovementTimelinePlayer } from './MovementTimelinePlayer';
import {
computeAnnualSimulationTrajectory,
DEFAULT_SIMULATION_PARAMETERS,
fetchPadreGarciaMonthlyWind,
precomputeSpatialMatrices,
STATIC_MONTHLY_WIND,
TIMELINE_MONTHS,
} from './simulation';
import {
BarangayGISData,
DiseaseSubMode,
GISTelemetryResponse,
MapLayer,
MonthlyWindData,
MovementRecord,
Movement3DDisplayMode,
MunicipalSummary,
SimulationParameters,
ViewMode,
} from './types';

const DEFAULT_SUMMARY: MunicipalSummary = {
  total_livestock: 0,
  total_cattle: 0,
  total_milk: 0,
  total_meat: 0,
  total_farmer_meat: 0,
  total_slaughter_yield: 0,
  total_slaughter_heads: 0,
  total_disease_cases: 0,
  active_disease_cases: 0,
  total_mortality: 0,
  total_farmers: 0,
  total_movements: 0,
  top_cattle: [],
  top_milk: [],
  top_farmer_meat: [],
  top_slaughter_yield: [],
  alert_barangays: [],
};

interface RoleAwareGISContainerProps {
  backRoute?: string;
  backLabel?: string;
}

export function RoleAwareGISContainer({
  backRoute = '/admin',
  backLabel = 'Back',
}: RoleAwareGISContainerProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const { user } = useAuth();
  const ready = useClientReady();
  const scopeKey = JSON.stringify([user?.email, user?.role, user?.accessScope, user?.assignedBarangayId]);
  const telemetry = useQuery({
    queryKey: ["gis-telemetry", scopeKey],
    enabled: Boolean(user),
    queryFn: async ({ signal }) => (await api.get<GISTelemetryResponse>('/api/analytics/gis/', { signal })).data,
  });
  const gisData = telemetry.data ?? null;
  const isLoading = telemetry.isPending || telemetry.isFetching;
  const [showInitialLoadingScreen, setShowInitialLoadingScreen] = useState(true);
  const loadingScreenPortalRoot = ready ? document.body : null;

  // Active layer & perspective states
  const [requestedLayer, setActiveLayer] = useState<MapLayer>('cattle');
  const allowedLayers = gisData?.user_scope?.allowed_layers;
  const activeLayer = allowedLayers?.length && !allowedLayers.includes(requestedLayer) ? allowedLayers[0] : requestedLayer;
  const [selectedLivestockType, setSelectedLivestockType] = useState<string>('Cattle');
  const [viewMode, setViewMode] = useState<ViewMode>('2D');
  const [diseaseSubMode, setDiseaseSubMode] = useState<DiseaseSubMode>('reported');
  const [barangaySelection, setBarangaySelection] = useState<{ scope: string; name: string | null } | null>(null);
  const initialName = gisData?.user_scope?.allowed_barangays?.length === 1 ? gisData.user_scope.allowed_barangays[0] : null;
  const selectedName = barangaySelection?.scope === scopeKey ? barangaySelection.name : initialName;
  const selectedBarangay = selectedName ? gisData?.barangays_dict?.[selectedName] ?? gisData?.barangays?.find(b => b.name === selectedName) ?? null : null;
  const setSelectedBarangay = useCallback((value: BarangayGISData | null) => {
    setBarangaySelection({ scope: scopeKey, name: value?.name ?? null });
  }, [scopeKey]);
  const [selectedMovement, setSelectedMovement] = useState<MovementRecord | null>(null);
  const [showMovementOverlay, setShowMovementOverlay] = useState<boolean>(false);
  const [movementDisplayMode, setMovementDisplayMode] = useState<Movement3DDisplayMode>('both');
  const [sidebarChoice, setSidebarOpen] = useState<boolean | null>(null);
  const sidebarOpen = sidebarChoice ?? !isMobile;
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // Movement timeline player states
  const [showMovementTimeline, setShowMovementTimeline] = useState<boolean>(false);
  const [movementDateIndex, setMovementDateIndex] = useState<number>(0);
  const [movementTimelineMode, setMovementTimelineMode] = useState<'single' | 'cumulative' | 'all'>('single');
  const [selectedMovementYear, setSelectedMovementYear] = useState<string>('ALL');

  // Simulation timeline & environmental states (12-month Jan-Dec 2026 player)
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(3); // April 2026 baseline
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [simulationParams, setSimulationParams] = useState<SimulationParameters>(
    DEFAULT_SIMULATION_PARAMETERS
  );
  const [monthlyWindData, setMonthlyWindData] = useState<MonthlyWindData[]>(STATIC_MONTHLY_WIND);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchGISTelemetry = async (isRefresh = false) => {
    const result = await telemetry.refetch();
    if (result.isError) toast.error('Could not connect to GIS aggregation service');
    else if (isRefresh) toast.success('GIS telemetry refreshed');
  };

  // Keep the first-load screen mounted briefly after the request ends so its opacity can fade out.
  // Later refreshes keep using the small syncing indicator and do not cover the interactive map.
  useEffect(() => {
    if (isLoading || !showInitialLoadingScreen) return;
    const timeout = window.setTimeout(() => setShowInitialLoadingScreen(false), 700);
    return () => window.clearTimeout(timeout);
  }, [isLoading, showInitialLoadingScreen]);

  /**
   * DATA FLOW STEP 2: Meteorological Wind Data Integration
   * Only active for roles that have simulation permissions (Admin/MAO)
   */
  useEffect(() => {
    if (gisData?.user_scope && !gisData.user_scope.can_use_simulation) {
      return;
    }
    let isMounted = true;
    fetchPadreGarciaMonthlyWind()
      .then((data) => {
        if (isMounted && data && data.length === 12) {
          setMonthlyWindData(data);
        }
      })
      .catch((err) => console.warn('Open-Meteo wind load error:', err));

    return () => {
      isMounted = false;
    };
  }, [gisData?.user_scope, setSelectedBarangay]);

  // Fast O(1) dictionary join for GeoJSON features
  const barangaysByName = useMemo(() => {
    if (gisData?.barangays_dict) {
      return gisData.barangays_dict;
    }
    const map: Record<string, BarangayGISData> = {};
    if (gisData?.barangays) {
      for (const b of gisData.barangays) {
        map[b.name] = b;
      }
    }
    return map;
  }, [gisData]);

  // Spatial distance matrix precomputation
  const spatialMatrices = useMemo(() => {
    return precomputeSpatialMatrices(gisData?.barangays || []);
  }, [gisData?.barangays]);

  // High-performance simulation trajectory precomputation (Admin/MAO only)
  const simulationTrajectory = useMemo(() => {
    if (!gisData?.user_scope?.can_use_simulation) return [];
    if (!gisData?.barangays || gisData.barangays.length === 0) return [];
    return computeAnnualSimulationTrajectory(
      gisData.barangays,
      spatialMatrices,
      monthlyWindData,
      simulationParams
    );
  }, [gisData, spatialMatrices, monthlyWindData, simulationParams]);

  // Active simulated states
  const activeSimulatedStates = useMemo(() => {
    if (!gisData?.user_scope?.can_use_simulation) return undefined;
    if (activeLayer !== 'disease' || diseaseSubMode !== 'simulation') {
      return undefined;
    }
    return simulationTrajectory[currentMonthIndex]?.states || {};
  }, [gisData?.user_scope?.can_use_simulation, activeLayer, diseaseSubMode, simulationTrajectory, currentMonthIndex]);

  // Active wind data for the current month
  const currentMonthWind = useMemo(() => {
    return monthlyWindData[currentMonthIndex] || STATIC_MONTHLY_WIND[currentMonthIndex] || STATIC_MONTHLY_WIND[0];
  }, [monthlyWindData, currentMonthIndex]);

  // Simulation Player Playback Loop
  useEffect(() => {
    if (isPlaying) {
      const stepDurationMs = Math.round(1200 / playbackSpeed);
      timerRef.current = setInterval(() => {
        setCurrentMonthIndex((prev) => {
          if (prev >= TIMELINE_MONTHS.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, stepDurationMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  const movementYears = useMemo(() => {
    if (!gisData?.movements) return [];
    const set = new Set<string>();
    for (const m of gisData.movements) {
      if (m.date) set.add(m.date.slice(0, 4));
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [gisData]);

  const activeMovementYear = selectedMovementYear === 'ALL' || movementYears.includes(selectedMovementYear)
    ? selectedMovementYear
    : 'ALL';
  const periodMovements = useMemo(() => {
    const allMoves = gisData?.movements || [];
    return activeMovementYear === 'ALL'
      ? allMoves
      : allMoves.filter((movement) => movement.date?.startsWith(`${activeMovementYear}-`));
  }, [gisData?.movements, activeMovementYear]);

  const uniqueMovementDates = useMemo(() => {
    const set = new Set<string>();
    for (const m of periodMovements) {
      if (m.date) set.add(m.date);
    }
    return Array.from(set).sort();
  }, [periodMovements]);

  const activeDisplayMovements = useMemo(() => {
    const allMoves = periodMovements.length > 0 ? periodMovements : (gisData?.movements || []);
    if (!showMovementTimeline || uniqueMovementDates.length === 0 || movementTimelineMode === 'all') {
      return allMoves;
    }
    const targetDate = uniqueMovementDates[movementDateIndex];
    if (!targetDate) return allMoves;

    if (movementTimelineMode === 'cumulative') {
      return allMoves.filter((m) => m.date && m.date <= targetDate);
    }
    return allMoves.filter((m) => m.date === targetDate);
  }, [periodMovements, gisData?.movements, showMovementTimeline, uniqueMovementDates, movementDateIndex, movementTimelineMode]);

  // Clear selected movement permit if it leaves the visible timeline date window
  useEffect(() => {
    if (!selectedMovement) return;
    const isStillVisible = activeDisplayMovements.some((m) => m.id === selectedMovement.id);
    if (!isStillVisible) {
      setSelectedMovement(null);
    }
  }, [activeDisplayMovements, selectedMovement]);

  const handleMovementYearChange = useCallback((year: string) => {
    setSelectedMovementYear(year);
    setMovementDateIndex(0);
  }, []);

  const handleSelectBarangay = useCallback((b: BarangayGISData) => {
    setSelectedMovement(null);
    setSelectedBarangay(b);
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    } else {
      setMobileDrawerOpen(true);
    }
  }, [setSelectedBarangay]);

  const handleSelectMovement = useCallback((m: MovementRecord | null) => {
    setSelectedMovement(m);
    if (m) {
      setSelectedBarangay(null);
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setMobileDrawerOpen(true);
      }
    }
  }, [setSelectedBarangay]);

  const handleClearSelectedMovement = useCallback(() => {
    setSelectedMovement(null);
  }, []);

  const handleClearSelectedBarangay = useCallback(() => {
    // If a restricted role (like Farmer) has only 1 allowed barangay, keep that barangay selected
    if (gisData?.user_scope?.allowed_barangays?.length === 1) {
      return;
    }
    setSelectedBarangay(null);
  }, [gisData?.user_scope, setSelectedBarangay]);

  const handleResetBounds = useCallback(() => {
    setResetTrigger((prev) => prev + 1);
    toast.info('Map viewport refit to Padre Garcia boundary', { duration: 1500 });
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleResetTimeline = useCallback(() => {
    setIsPlaying(false);
    setCurrentMonthIndex(0);
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  const handleDiseaseSubModeChange = useCallback((subMode: DiseaseSubMode) => {
    setDiseaseSubMode(subMode);
    if (subMode !== 'simulation') {
      setIsPlaying(false);
    }
  }, []);

  const availableLivestockTypes: string[] = useMemo(() => {
    if (gisData?.summary?.available_livestock_types && gisData.summary.available_livestock_types.length > 0) {
      return gisData.summary.available_livestock_types;
    }
    return ['Cattle'];
  }, [gisData]);

  const canUseSimulation = gisData?.user_scope?.can_use_simulation ?? false;

  return (
    <div className="relative w-full h-full max-h-full min-h-0 overflow-hidden flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {telemetry.isError && <p role="alert" className="z-[1000] bg-red-950 p-3 text-sm text-white">Map data could not be loaded. Use Refresh to retry.</p>}
      {/* 0. Mobile Back Button Header */}
      <button
        type="button"
        onClick={() => router.push(backRoute)}
        aria-label={backLabel}
        className="sm:hidden fixed top-[calc(0.75rem+env(safe-area-inset-top,0px))] left-[calc(0.75rem+env(safe-area-inset-left,0px))] z-[950] min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl text-slate-800 flex items-center justify-center gap-1.5 font-bold text-xs active:scale-95 transition-transform cursor-pointer pointer-events-auto"
      >
        <ArrowLeft className="size-4 text-emerald-800" />
        <span>{backLabel}</span>
      </button>

      {/* 1. Full Viewport Interactive GIS Map Container */}
      <div className="relative w-full h-full flex-1 min-h-0 overflow-hidden">
        <GISMap
          barangaysByName={barangaysByName}
          movements={activeDisplayMovements}
          activeLayer={activeLayer}
          viewMode={viewMode}
          diseaseSubMode={diseaseSubMode}
          selectedBarangay={selectedBarangay}
          onSelectBarangay={handleSelectBarangay}
          resetTrigger={resetTrigger}
          simulatedStates={activeSimulatedStates}
          selectedLivestockType={selectedLivestockType}
          userScope={gisData?.user_scope}
          selectedMovement={selectedMovement}
          onSelectMovement={handleSelectMovement}
          showMovementOverlay={showMovementOverlay}
          movementDisplayMode={movementDisplayMode}
          isTimelineActive={showMovementTimeline && movementTimelineMode !== 'all'}
        />

        {/* 2. Floating Controls */}
        <div className="absolute top-[calc(0.75rem+env(safe-area-inset-top,0px))] left-[calc(4.75rem+env(safe-area-inset-left,0px))] sm:left-4 sm:top-4 z-[850] max-w-[calc(100vw-5.5rem)] sm:max-w-[calc(100vw-1.5rem)]">
          <GISControls
            currentLayer={activeLayer}
            onLayerChange={(layer) => {
              setActiveLayer(layer);
              setSelectedMovement(null);
              if (layer !== 'movement') {
                setShowMovementTimeline(false);
              } else {
                setMovementDateIndex(0);
              }
            }}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            diseaseSubMode={diseaseSubMode}
            onDiseaseSubModeChange={handleDiseaseSubModeChange}
            onResetBounds={handleResetBounds}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => {
              if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                setSidebarOpen((prev) => !prev);
              } else {
                setMobileDrawerOpen(true);
              }
            }}
            availableLivestockTypes={availableLivestockTypes}
            selectedLivestockType={selectedLivestockType}
            onLivestockTypeChange={setSelectedLivestockType}
            userScope={gisData?.user_scope}
            movementDisplayMode={movementDisplayMode}
            onMovementDisplayModeChange={setMovementDisplayMode}
            showMovementTimeline={showMovementTimeline}
            onToggleMovementTimeline={() => setShowMovementTimeline((prev) => !prev)}
          />
        </div>

        {/* 3. Floating Bottom-Left Dynamic Legend */}
        <div className="absolute bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-[calc(0.75rem+env(safe-area-inset-left,0px))] sm:bottom-4 sm:left-4 z-[850]">
          <GISLegend
            layer={activeLayer}
            viewMode={viewMode}
            diseaseSubMode={diseaseSubMode}
            selectedLivestockType={selectedLivestockType}
          />
        </div>

        {/* 4. Disease Simulation Timeline Player (Admin/MAO only) */}
        {canUseSimulation && activeLayer === 'disease' && diseaseSubMode === 'simulation' && (
          <div className="absolute bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-4 left-1/2 -translate-x-1/2 z-[900] px-2 sm:px-4 w-full max-w-xl">
            <GISTimeline
              currentMonthIndex={currentMonthIndex}
              onMonthChange={setCurrentMonthIndex}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onReset={handleResetTimeline}
              playbackSpeed={playbackSpeed}
              onPlaybackSpeedChange={setPlaybackSpeed}
              windData={currentMonthWind}
              parameters={simulationParams}
              onParametersChange={setSimulationParams}
              trajectory={simulationTrajectory}
              unsupportedActiveDiseaseCases={gisData?.summary?.unsupported_active_disease_cases ?? 0}
              unmappedFmdCases={gisData?.summary?.unmapped_recent_fmd_cases ?? 0}
            />
          </div>
        )}

        {/* 4b. Movement Historical Timeline Scrubber (When in Movement Layer AND timeline opened) */}
        {activeLayer === 'movement' && showMovementTimeline && movementYears.length > 0 && (
          <div className="absolute bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-4 left-1/2 -translate-x-1/2 z-[900] px-2 sm:px-4 w-full max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <MovementTimelinePlayer
              movements={periodMovements}
              activeDateIndex={movementDateIndex}
              onDateIndexChange={setMovementDateIndex}
              uniqueDates={uniqueMovementDates}
              years={movementYears}
              selectedYear={activeMovementYear}
              onYearChange={handleMovementYearChange}
              timelineMode={movementTimelineMode}
              onTimelineModeChange={setMovementTimelineMode}
              isAllDatesMode={movementTimelineMode === 'all'}
              onToggleAllDatesMode={() => {
                setMovementTimelineMode((prev) =>
                  prev === 'single' ? 'cumulative' : prev === 'cumulative' ? 'all' : 'single'
                );
              }}
              onClose={() => setShowMovementTimeline(false)}
            />
          </div>
        )}

        {/* 5. Mobile Quick Action Button to Open Telemetry Bottom Sheet (Left side under map layers) */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Open GIS telemetry drawer"
          className="lg:hidden absolute top-[calc(3.75rem+env(safe-area-inset-top,0px))] left-[calc(0.75rem+env(safe-area-inset-left,0px))] z-[800] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-lg text-emerald-900 hover:bg-emerald-50 hover:border-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer pointer-events-auto min-h-[38px]"
        >
          <Info className="size-4 text-emerald-800 shrink-0" />
          <span className="font-black tracking-tight">Telemetry</span>
          {selectedMovement ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-900 max-w-[80px] truncate">
              Permit #{selectedMovement.id}
            </span>
          ) : selectedBarangay ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 max-w-[70px] truncate">
              {selectedBarangay.name}
            </span>
          ) : null}
        </button>

        {/* 6. Desktop Floating Right Sidebar */}
        <GISSidebar
          renderMode="desktop"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          selectedBarangay={selectedBarangay}
          onClearSelectedBarangay={handleClearSelectedBarangay}
          onSelectBarangay={handleSelectBarangay}
          summary={gisData?.summary || DEFAULT_SUMMARY}
          movements={gisData?.movements || []}
          allBarangays={gisData?.barangays || []}
          onRefresh={() => fetchGISTelemetry(true)}
          isLoading={isLoading}
          diseaseSubMode={diseaseSubMode}
          viewMode={viewMode}
          simulatedStates={activeSimulatedStates}
          selectedLivestockType={selectedLivestockType}
          userScope={gisData?.user_scope}
          farmerStats={gisData?.farmer_stats}
          activeLayer={activeLayer}
          selectedMovement={selectedMovement}
          onSelectMovement={handleSelectMovement}
          onClearSelectedMovement={handleClearSelectedMovement}
        />

        {/* 7. Mobile Bottom Sheet Drawer (< 1024px) */}
        <GISSidebar
          renderMode="mobile-sheet"
          isOpen={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          selectedBarangay={selectedBarangay}
          onClearSelectedBarangay={handleClearSelectedBarangay}
          onSelectBarangay={handleSelectBarangay}
          summary={gisData?.summary || DEFAULT_SUMMARY}
          movements={gisData?.movements || []}
          allBarangays={gisData?.barangays || []}
          onRefresh={() => fetchGISTelemetry(true)}
          isLoading={isLoading}
          diseaseSubMode={diseaseSubMode}
          viewMode={viewMode}
          simulatedStates={activeSimulatedStates}
          selectedLivestockType={selectedLivestockType}
          userScope={gisData?.user_scope}
          farmerStats={gisData?.farmer_stats}
          activeLayer={activeLayer}
          selectedMovement={selectedMovement}
          onSelectMovement={handleSelectMovement}
          onClearSelectedMovement={handleClearSelectedMovement}
        />

        {/* 8. Live Syncing Indicator */}
        {isLoading && (
          <div className="absolute top-4 right-1/2 translate-x-1/2 z-[1100] bg-emerald-950/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/30 text-xs flex items-center gap-2 shadow-xl animate-in fade-in">
            <Loader2 className="size-3.5 animate-spin text-emerald-400" />
            <span className="font-semibold tracking-wide">Syncing Telemetry...</span>
          </div>
        )}
      </div>
      {showInitialLoadingScreen && loadingScreenPortalRoot
        ? createPortal(
            <div
              role="status"
              aria-live="polite"
              style={{ zIndex: 2_147_483_647 }}
              className={`fixed inset-0 flex items-center justify-center bg-slate-950 text-white transition-opacity duration-700 ease-out ${isLoading ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <div className="flex flex-col items-center gap-4 px-6 text-center">
                <div className="relative flex size-16 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 shadow-[0_0_48px_rgba(16,185,129,0.18)]">
                  <Loader2 className="size-8 animate-spin text-emerald-300" />
                </div>
                <div>
                  <p className="text-lg font-black tracking-wide">Loading GIS map</p>
                  <p className="mt-1 text-sm text-slate-300">Preparing barangay boundaries and map data…</p>
                </div>
                <div className="h-1 w-44 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-2/5 animate-pulse rounded-full bg-emerald-400" />
                </div>
              </div>
            </div>,
            loadingScreenPortalRoot,
          )
        : null}
    </div>
  );
}
