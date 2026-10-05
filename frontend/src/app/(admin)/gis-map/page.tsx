'use client';

/**
 * SmartLivestock GIS — God's-Eye View V2
 * Municipality of Padre Garcia, Batangas
 * 
 * ============================================================================
 * ARCHITECTURAL FLOW & METHODOLOGY (For Student Developer Defense / Presentation)
 * ============================================================================
 * 
 * 1. PERSPECTIVE MODES (2D vs. 3D):
 *    - 2D Mode: Traditional orthogonal top-down GIS layer rendering.
 *    - 3D Mode: Tilted perspective (rotateX 42deg, rotateZ -10deg) with volumetric
 *      polygon extrusion. Column height reflects concentration of the active metric.
 * 
 * 2. PERMANENT BARANGAY LABELS:
 *    - Every one of the 18 barangays has a permanent centroid-anchored badge
 *      displaying both its name and live micro-metric (e.g. "BANABA 5🐄").
 *    - Non-interactive (pointer-events: none) so it never blocks polygon click/hover.
 * 
 * 3. THREE DISEASE SURVEILLANCE MODES:
 *    - REPORTED: Actual confirmed disease records currently in PostgreSQL ("What has been reported?").
 *    - SURVEILLANCE TREND: Current disease activity status derived from verified records
 *      ("Where is disease activity currently elevated?"). NOT a machine-learning future forecast.
 *    - SIMULATION: Spatial scenario modeling using Haversine distance, host livestock density,
 *      and historical environmental wind baseline ("What could spatial pressure look like?").
 * 
 * 4. SEPARATION OF CONCERNS: GIS vs. PREDICTIVE ANALYTICS:
 *    - GIS owns spatial visualization and spatial scenario simulation.
 *    - Predictive Analytics (`/analytics` & `/api/analytics/predictive/forecast/`) owns temporal
 *      statistical forecasting (Holt-Winters, ARIMA, Random Forest, Linear Regression).
 *    - GIS does NOT perform ML forecasting to avoid unvalidated barangay-level spatiotemporal claims.
 * 
 * 5. REAL BACKEND INTEGRATION:
 *    - Telemetry is queried via `/api/analytics/gis/` and joined to GeoJSON polygons via `feature.properties.name`.
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
} from '@/components/gis/types';
import {
  precomputeSpatialMatrices,
  computeAnnualSimulationTrajectory,
  fetchPadreGarciaMonthlyWind,
  STATIC_MONTHLY_WIND,
  DEFAULT_SIMULATION_PARAMETERS,
  TIMELINE_MONTHS,
} from '@/components/gis/simulation';
import { GISMap } from '@/components/gis/GISMap';
import { GISControls } from '@/components/gis/GISControls';
import { GISLegend } from '@/components/gis/GISLegend';
import { GISTimeline } from '@/components/gis/GISTimeline';
import { GISSidebar } from '@/components/gis/GISSidebar';
import { GISFooter } from '@/components/gis/GISFooter';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Info } from 'lucide-react';
import { useIsMobile } from '@/components/ui/use-mobile';

const DEFAULT_SUMMARY: MunicipalSummary = {
  total_livestock: 0,
  total_cattle: 0,
  total_milk: 0,
  total_meat: 0,
  total_disease_cases: 0,
  active_disease_cases: 0,
  total_mortality: 0,
  total_farmers: 0,
  total_movements: 0,
  top_cattle: [],
  top_milk: [],
  alert_barangays: [],
};

export default function GISMapPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  // ═════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT: Telemetry, Layering, Simulation, and Inspection
  // ═════════════════════════════════════════════════════════════════════════

  // Telemetry state queried directly from Django REST Framework (`/api/analytics/gis/`)
  const [gisData, setGisData] = useState<GISTelemetryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active layer & perspective states (default active layer 'cattle' on mount for immediate chloropleth color)
  const [activeLayer, setActiveLayer] = useState<MapLayer>('cattle');
  const [selectedLivestockType, setSelectedLivestockType] = useState<string>('Cattle');
  const [viewMode, setViewMode] = useState<ViewMode>('2D');
  const [diseaseSubMode, setDiseaseSubMode] = useState<DiseaseSubMode>('reported');
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayGISData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  // Open sidebar by default on desktop screens (>= 1024px) for side-by-side telemetry
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, []);

  // Extract distinct livestock types genuinely available in backend data
  const availableLivestockTypes: string[] = useMemo(() => {
    if (gisData?.summary?.available_livestock_types && gisData.summary.available_livestock_types.length > 0) {
      return gisData.summary.available_livestock_types;
    }
    const typesSet = new Set<string>();
    gisData?.barangays?.forEach((b) => {
      b.species_breakdown?.forEach((s) => {
        if (s.species && s.heads > 0) typesSet.add(s.species);
      });
    });
    const list = Array.from(typesSet);
    return list.length > 0 ? list : ['Cattle'];
  }, [gisData]);

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
   * Fetches real municipal GIS telemetry from PostgreSQL via Django REST Framework.
   * Joins real livestock registries, verified disease reports, milk/meat yields, and movement permits.
   */
  const fetchGISTelemetry = useCallback(async (isRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<GISTelemetryResponse>('/api/analytics/gis/');
      setGisData(response.data);
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
  }, []);

  useEffect(() => {
    fetchGISTelemetry();
  }, [fetchGISTelemetry]);

  /**
   * DATA FLOW STEP 2: Meteorological Wind Data Integration
   * Fetches Open-Meteo archive API for Padre Garcia (13.88N, 121.22E).
   * Vector-averages monthly wind speeds (m/s) and meteorological drift bearings.
   * If offline or API fails, gracefully falls back to the static monthly climate table.
   */
  useEffect(() => {
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
  }, []);

  /**
   * DATA FLOW STEP 3: O(1) Fast Dictionary Join
   * Creates a constant-time lookup map (name -> BarangayGISData) so Leaflet's
   * `onEachFeature` can instantly join GeoJSON feature properties without linear searches.
   */
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

  /**
   * DATA FLOW STEP 4: Spatial Distance & Bearing Matrix Precomputation
   * Precomputes the 18x18 Haversine spherical distance matrix and geographic bearing matrix once.
   * Memoized with `useMemo` so it only recalculates if the barangay coordinate dataset changes.
   */
  const spatialMatrices = useMemo(() => {
    return precomputeSpatialMatrices(gisData?.barangays || []);
  }, [gisData?.barangays]);

  /**
   * DATA FLOW STEP 5: High-Performance Simulation Trajectory Precomputation
   * Computes the entire 12-month epidemic spread progression in advance.
   * Because all 12 monthly states are memoized in memory, the user can drag
   * the timeline slider with instantaneous O(1) scrubbing and zero rendering stutter.
   */
  const simulationTrajectory = useMemo(() => {
    if (!gisData?.barangays || gisData.barangays.length === 0) return [];
    return computeAnnualSimulationTrajectory(
      gisData.barangays,
      spatialMatrices,
      monthlyWindData,
      simulationParams
    );
  }, [gisData?.barangays, spatialMatrices, monthlyWindData, simulationParams]);

  // Active simulated states for the currently selected month
  const activeSimulatedStates = useMemo(() => {
    if (activeLayer !== 'disease' || diseaseSubMode !== 'simulation') {
      return undefined;
    }
    return simulationTrajectory[currentMonthIndex]?.states || {};
  }, [activeLayer, diseaseSubMode, simulationTrajectory, currentMonthIndex]);

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

  /**
   * DATA FLOW STEP 6: Simulation Player Playback Loop
   * Advances the month index sequentially at user-selected speeds:
   * 1x = 1200ms per month, 2x = 600ms per month, 4x = 300ms per month.
   */
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
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  // Mobile Back Button Handler (Bug C fix)
  // If detail sheet or sidebar is open, back closes it first. Otherwise router.back() with fallback to /admin.
  const handleBack = useCallback(() => {
    if (selectedBarangay) {
      setSelectedBarangay(null);
      return;
    }
    if (sidebarOpen && isMobile) {
      setSidebarOpen(false);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/admin');
    }
  }, [selectedBarangay, sidebarOpen, isMobile, router]);

  // Event Handlers
  const handleSelectBarangay = (b: BarangayGISData) => {
    setSelectedBarangay(b);
    setSidebarOpen(true);
  };

  const handleClearSelectedBarangay = () => {
    setSelectedBarangay(null);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === '3D') {
      toast.info('Tilted 3D Perspective Activated', {
        description: 'Barangay polygons extruded according to current metric density.',
      });
    }
  };

  const handleDiseaseSubModeChange = (subMode: DiseaseSubMode) => {
    setDiseaseSubMode(subMode);
    if (subMode === 'simulation') {
      toast.info('⚡ Epidemic Simulation Activated', {
        description: 'Showing Haversine distance-decay & Open-Meteo wind drift timeline.',
      });
    } else if (subMode === 'trend') {
      toast.info('🩺 Surveillance Trend Activated', {
        description: 'Highlights current disease activity and surveillance status based on reported records.',
      });
    } else {
      toast.success('Reported Database Records Restored');
    }
  };

  const handleResetBounds = () => {
    setResetTrigger((prev) => prev + 1);
    toast.info('Camera reset to Padre Garcia municipal extent');
  };

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleResetTimeline = () => {
    setIsPlaying(false);
    setCurrentMonthIndex(0); // Reset to Jan 2026
    toast.info('Simulation timeline reset to baseline (January 2026)');
  };

  return (
    // Responsive Layout: Full-height fixed on desktop (lg:h-dvh), naturally scrollable on mobile
    <div className="relative w-full min-h-screen lg:h-dvh lg:max-h-dvh lg:overflow-hidden flex flex-col bg-slate-950 font-sans select-none">
      {/* Mobile Floating Back Button (Bug C Fix: Always visible on mobile, safe-area offset) */}
      <button
        type="button"
        onClick={handleBack}
        aria-label="Back to Admin Dashboard"
        className="sm:hidden fixed top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] z-[1100] min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl text-slate-800 flex items-center justify-center gap-1.5 font-bold text-xs active:scale-95 transition-transform cursor-pointer pointer-events-auto"
      >
        <ArrowLeft className="size-4 text-emerald-800" />
        <span>Back</span>
      </button>

      {/* 1. Interactive GIS Map Container (Fixed height on mobile, flex-1 full-screen on desktop) */}
      <div className="relative w-full h-[54dvh] sm:h-[60dvh] min-h-[380px] lg:h-full lg:flex-1 lg:min-h-0 shrink-0 overflow-hidden">
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
        />

        {/* 2. Floating Controls: Desktop top-left; Mobile positioned below back button */}
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

        {/* 4. Disease Simulation Timeline Player (12 months, speed control, parameters, Recharts curve) */}
        {activeLayer === 'disease' && diseaseSubMode === 'simulation' && (
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

        {/* 6. Desktop Floating Right Sidebar (hidden on mobile, visible on desktop) */}
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
        />

        {/* 7. Live Syncing Indicator */}
        {isLoading && (
          <div className="absolute top-4 right-1/2 translate-x-1/2 z-[1100] bg-emerald-950/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/30 text-xs flex items-center gap-2 shadow-xl animate-in fade-in">
            <Loader2 className="size-3.5 animate-spin text-emerald-400" />
            <span className="font-semibold tracking-wide">Syncing Telemetry...</span>
          </div>
        )}
      </div>

      {/* 8. Mobile GIS Sidebar Section: Appears directly in the footer area under the map for 100% mobile visibility */}
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
      />

      {/* 9. Metadata Footer */}
      <GISFooter />
    </div>
  );
}
