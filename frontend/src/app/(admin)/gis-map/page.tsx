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
 *      polygon extrusion. Column height reflects concentration of the active metric
 *      (e.g. taller columns for high cattle density or active disease outbreaks).
 * 
 * 2. PERMANENT BARANGAY LABELS:
 *    - Every one of the 18 barangays has a permanent centroid-anchored badge
 *      displaying both its name and live micro-metric (e.g. "BANABA 5🐄").
 *    - Non-interactive (pointer-events: none) so it never blocks polygon click/hover.
 * 
 * 3. THREE DISEASE SURVEILLANCE STATES:
 *    - REPORTED: Verified live outbreak cases from PostgreSQL database.
 *    - SIMULATION: Spatial Haversine distance-decay epidemic spread with PAGASA
 *      directional wind drift and timeline scrub/playback.
 *    - FORECAST: Statistical surveillance trajectory distinguishing empirical
 *      modeling from scenario simulation.
 * 
 * 4. REAL BACKEND INTEGRATION:
 *    - Zero hardcoded statistical values. Telemetry is queried via `/api/analytics/gis/`
 *      and joined to GeoJSON polygons via `feature.properties.name`.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '@/lib/axios';
import {
  GISTelemetryResponse,
  BarangayGISData,
  MapLayer,
  MunicipalSummary,
  ViewMode,
  DiseaseSubMode,
  EnvironmentalWindInput,
} from '@/components/gis/types';
import {
  computeSimulatedSpread,
  DEFAULT_PAGASA_WIND,
  TIMELINE_MONTHS,
} from '@/components/gis/simulation';
import { GISMap } from '@/components/gis/GISMap';
import { GISControls } from '@/components/gis/GISControls';
import { GISLegend } from '@/components/gis/GISLegend';
import { GISTimeline } from '@/components/gis/GISTimeline';
import { GISSidebar } from '@/components/gis/GISSidebar';
import { GISFooter } from '@/components/gis/GISFooter';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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
  // Telemetry state from real Django backend
  const [gisData, setGisData] = useState<GISTelemetryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active layer & perspective states
  const [activeLayer, setActiveLayer] = useState<MapLayer>('cattle');
  const [viewMode, setViewMode] = useState<ViewMode>('2D');
  const [diseaseSubMode, setDiseaseSubMode] = useState<DiseaseSubMode>('reported');
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayGISData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  // Simulation timeline & environmental states
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(3); // April 2026 baseline
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [windInput, setWindInput] = useState<EnvironmentalWindInput>(DEFAULT_PAGASA_WIND);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetches municipal GIS telemetry from PostgreSQL via Django REST Framework
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

  // Fast dictionary lookup for joining GeoJSON features: name -> BarangayGISData
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

  // Compute simulated spread when in simulation sub-mode
  const simulatedStates = useMemo(() => {
    if (activeLayer !== 'disease' || diseaseSubMode !== 'simulation' || !gisData?.barangays) {
      return undefined;
    }
    return computeSimulatedSpread(gisData.barangays, currentMonthIndex, windInput);
  }, [activeLayer, diseaseSubMode, gisData?.barangays, currentMonthIndex, windInput]);

  // Keep selectedBarangay reference synchronized with fresh data
  useEffect(() => {
    if (selectedBarangay && barangaysByName[selectedBarangay.name]) {
      setSelectedBarangay(barangaysByName[selectedBarangay.name]);
    }
  }, [barangaysByName, selectedBarangay]);

  // Timeline Auto-Playback (Month-by-Month progression)
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentMonthIndex((prev) => {
          if (prev >= TIMELINE_MONTHS.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1400); // 1.4 seconds per monthly step
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  // Handlers
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
        description: 'Showing Haversine distance-decay & PAGASA wind drift timeline.',
      });
    } else if (subMode === 'forecast') {
      toast.info('📈 Predictive Forecast Activated', {
        description: 'Showing surveillance risk velocity based on historical trend.',
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
    <div className="relative w-full h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. Full-Screen Interactive GIS Map Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <GISMap
          barangaysByName={barangaysByName}
          movements={gisData?.movements || []}
          activeLayer={activeLayer}
          viewMode={viewMode}
          diseaseSubMode={diseaseSubMode}
          selectedBarangay={selectedBarangay}
          onSelectBarangay={handleSelectBarangay}
          resetTrigger={resetTrigger}
          simulatedStates={simulatedStates}
        />

        {/* 2. Floating Top-Left Controls (Title, 2D/3D switch, Layers, Disease sub-modes) */}
        <div className="absolute top-4 left-4 z-[900]">
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
          />
        </div>

        {/* 3. Floating Bottom-Left Dynamic Legend */}
        <div className="absolute bottom-4 left-4 z-[900]">
          <GISLegend
            layer={activeLayer}
            viewMode={viewMode}
            diseaseSubMode={diseaseSubMode}
          />
        </div>

        {/* 4. Disease Simulation Timeline Bar (Visible when in Simulation mode) */}
        {activeLayer === 'disease' && diseaseSubMode === 'simulation' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[950] px-4 w-full max-w-xl">
            <GISTimeline
              currentMonthIndex={currentMonthIndex}
              onMonthChange={setCurrentMonthIndex}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onReset={handleResetTimeline}
              windInput={windInput}
            />
          </div>
        )}

        {/* 5. Floating Right Sidebar (Desktop Overlay + Mobile Sheet) */}
        <GISSidebar
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
          simulatedStates={simulatedStates}
        />

        {/* 6. Live Syncing Pill Indicator */}
        {isLoading && (
          <div className="absolute top-4 right-1/2 translate-x-1/2 z-[1100] bg-emerald-950/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/30 text-xs flex items-center gap-2 shadow-xl animate-in fade-in">
            <Loader2 className="size-3.5 animate-spin text-emerald-400" />
            <span className="font-semibold tracking-wide">Syncing Telemetry...</span>
          </div>
        )}
      </div>

      {/* 7. Compact Metadata Footer (Requirement 23) */}
      <GISFooter />
    </div>
  );
}
