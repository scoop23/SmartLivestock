'use client';

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

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import {
  GISTelemetryResponse,
  BarangayGISData,
  MapLayer,
  MunicipalSummary,
  ViewMode,
  DiseaseSubMode,
  SimulationParameters,
  MonthlyWindData,
} from './types';
import {
  precomputeSpatialMatrices,
  computeAnnualSimulationTrajectory,
  fetchPadreGarciaMonthlyWind,
  STATIC_MONTHLY_WIND,
  DEFAULT_SIMULATION_PARAMETERS,
  TIMELINE_MONTHS,
} from './simulation';
import { GISMap } from './GISMap';
import { GISControls } from './GISControls';
import { GISLegend } from './GISLegend';
import { GISTimeline } from './GISTimeline';
import { GISSidebar } from './GISSidebar';
import { GISFooter } from './GISFooter';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Info } from 'lucide-react';
import { useIsMobile } from '@/components/ui/use-mobile';

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

  // Telemetry state queried directly from Django REST Framework (`/api/analytics/gis/`)
  const [gisData, setGisData] = useState<GISTelemetryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active layer & perspective states
  const [activeLayer, setActiveLayer] = useState<MapLayer>('cattle');
  const [selectedLivestockType, setSelectedLivestockType] = useState<string>('Cattle');
  const [viewMode, setViewMode] = useState<ViewMode>('2D');
  const [diseaseSubMode, setDiseaseSubMode] = useState<DiseaseSubMode>('reported');
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayGISData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  // Open sidebar by default on desktop screens (>= 1024px)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, []);

  // Simulation timeline & environmental states (12-month Jan-Dec 2026 player)
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(3); // April 2026 baseline
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [simulationParams, setSimulationParams] = useState<SimulationParameters>(
    DEFAULT_SIMULATION_PARAMETERS
  );
  const [monthlyWindData, setMonthlyWindData] = useState<MonthlyWindData[]>(STATIC_MONTHLY_WIND);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * DATA FLOW STEP 1: Backend API Fetching
   * Fetches role-scoped GIS telemetry from PostgreSQL via Django REST Framework.
   */
  const fetchGISTelemetry = useCallback(async (isRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<GISTelemetryResponse>('/api/analytics/gis/');
      setGisData(response.data);

      // Align active layer if current layer is disallowed by user's role scope
      if (response.data.user_scope?.allowed_layers && response.data.user_scope.allowed_layers.length > 0) {
        if (!response.data.user_scope.allowed_layers.includes(activeLayer)) {
          setActiveLayer(response.data.user_scope.allowed_layers[0]);
        }
      }

      // If user has a single own/assigned barangay, automatically focus on it
      if (response.data.user_scope?.allowed_barangays?.length === 1) {
        const singleBName = response.data.user_scope.allowed_barangays[0];
        const match = response.data.barangays_dict?.[singleBName] || response.data.barangays?.find(b => b.name === singleBName);
        if (match) {
          setSelectedBarangay(match);
        }
      }

      if (isRefresh) {
        toast.success('GIS Telemetry synchronized with PostgreSQL database');
      }
    } catch (err: any) {
      console.error('Failed to fetch GIS telemetry:', err);
      setError('Unable to load real-time municipal telemetry from backend.');
      toast.error('Could not connect to GIS aggregation service');
    } finally {
      setIsLoading(false);
    }
  }, [activeLayer]);

  useEffect(() => {
    fetchGISTelemetry();
  }, [fetchGISTelemetry]);

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
  }, [gisData?.user_scope]);

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
  }, [gisData?.barangays, gisData?.user_scope?.can_use_simulation, spatialMatrices, monthlyWindData, simulationParams]);

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

  // Keep selectedBarangay reference synchronized with fresh data
  useEffect(() => {
    if (selectedBarangay && barangaysByName[selectedBarangay.name]) {
      setSelectedBarangay(barangaysByName[selectedBarangay.name]);
    }
  }, [barangaysByName, selectedBarangay]);

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

  const handleSelectBarangay = useCallback((b: BarangayGISData) => {
    setSelectedBarangay(b);
    setSidebarOpen(true);
  }, []);

  const handleClearSelectedBarangay = useCallback(() => {
    // If a restricted role (like Farmer) has only 1 allowed barangay, keep that barangay selected
    if (gisData?.user_scope?.allowed_barangays?.length === 1) {
      return;
    }
    setSelectedBarangay(null);
  }, [gisData?.user_scope]);

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

  const canUseSimulation = gisData?.user_scope?.can_use_simulation ?? true;

  return (
    <div className="relative w-full min-h-screen lg:h-dvh lg:max-h-dvh lg:overflow-hidden flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden selection:bg-emerald-500 selection:text-white">
      {/* 0. Mobile Back Button Header */}
      <button
        type="button"
        onClick={() => router.push(backRoute)}
        aria-label={backLabel}
        className="sm:hidden fixed top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] z-[1100] min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl text-slate-800 flex items-center justify-center gap-1.5 font-bold text-xs active:scale-95 transition-transform cursor-pointer pointer-events-auto"
      >
        <ArrowLeft className="size-4 text-emerald-800" />
        <span>{backLabel}</span>
      </button>

      {/* 1. Interactive GIS Map Container */}
      <div className="relative w-full h-[55dvh] sm:h-[60dvh] min-h-[420px] lg:h-full lg:flex-1 lg:min-h-0 shrink-0 overflow-hidden">
        <GISMap
          barangaysByName={barangaysByName}
          movements={gisData?.movements || []}
          activeLayer={activeLayer}
          viewMode={viewMode}
          diseaseSubMode={diseaseSubMode}
          selectedBarangay={selectedBarangay}
          onSelectBarangay={handleSelectBarangay}
          resetTrigger={resetTrigger}
          simulatedStates={activeSimulatedStates}
          selectedLivestockType={selectedLivestockType}
          userScope={gisData?.user_scope}
        />

        {/* 2. Floating Controls */}
        <div className="absolute top-16 sm:top-4 left-3 sm:left-4 z-[900] max-w-[calc(100vw-1.5rem)]">
          <GISControls
            currentLayer={activeLayer}
            onLayerChange={setActiveLayer}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            diseaseSubMode={diseaseSubMode}
            onDiseaseSubModeChange={handleDiseaseSubModeChange}
            onResetBounds={handleResetBounds}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            availableLivestockTypes={availableLivestockTypes}
            selectedLivestockType={selectedLivestockType}
            onLivestockTypeChange={setSelectedLivestockType}
            userScope={gisData?.user_scope}
          />
        </div>

        {/* 3. Floating Bottom-Left Dynamic Legend */}
        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-[900]">
          <GISLegend
            layer={activeLayer}
            viewMode={viewMode}
            diseaseSubMode={diseaseSubMode}
            selectedLivestockType={selectedLivestockType}
          />
        </div>

        {/* 4. Disease Simulation Timeline Player (Admin/MAO only) */}
        {canUseSimulation && activeLayer === 'disease' && diseaseSubMode === 'simulation' && (
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-[950] px-2 sm:px-4 w-full max-w-xl">
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
            />
          </div>
        )}

        {/* 5. Mobile Quick Jump Button to Telemetry Section */}
        <button
          type="button"
          onClick={() => {
            document.getElementById('mobile-gis-sidebar')?.scrollIntoView({ behavior: 'smooth' });
          }}
          aria-label="Scroll to GIS telemetry under map"
          className="lg:hidden absolute top-16 right-3 z-[900] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-lg text-emerald-900 hover:bg-emerald-50 hover:border-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer pointer-events-auto min-h-[36px]"
        >
          <Info className="size-3.5 text-emerald-800 shrink-0" />
          <span className="font-black tracking-tight">Telemetry ↓</span>
          {selectedBarangay && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 max-w-[70px] truncate">
              {selectedBarangay.name}
            </span>
          )}
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
        />

        {/* 7. Live Syncing Indicator */}
        {isLoading && (
          <div className="absolute top-4 right-1/2 translate-x-1/2 z-[1100] bg-emerald-950/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/30 text-xs flex items-center gap-2 shadow-xl animate-in fade-in">
            <Loader2 className="size-3.5 animate-spin text-emerald-400" />
            <span className="font-semibold tracking-wide">Syncing Telemetry...</span>
          </div>
        )}
      </div>

      {/* 8. Mobile GIS Sidebar Section: Under the map for mobile */}
      <GISSidebar
        renderMode="mobile-inline"
        isOpen={true}
        onClose={handleClearSelectedBarangay}
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
      />

      {/* 9. Metadata Footer */}
      <GISFooter userScope={gisData?.user_scope} />
    </div>
  );
}
