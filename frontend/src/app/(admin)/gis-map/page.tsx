'use client';

/**
 * SmartLivestock GIS — God's-Eye View Command Center
 * Municipality of Padre Garcia, Batangas
 * 
 * Educational Architecture Note for Student Developer:
 * ====================================================
 * This module implements a full-screen, map-first GIS command center inspired
 * by modern spatial data dashboards (e.g. dynasty-tracker.bettergov.ph).
 * 
 * Architecture Flow:
 * 1. Geometry Layer (padre-garcia-barangays.json):
 *    Contains authentic administrative polygons for all 18 barangays of Padre Garcia.
 *    This file is the single source of truth for geographic shapes and centroids.
 * 
 * 2. Data Layer (PostgreSQL -> Django API -> Next.js):
 *    Instead of hardcoding statistical values, real livestock inventories,
 *    disease cases, milk production, and inspection movements are queried
 *    directly from PostgreSQL via the `/api/analytics/gis/` endpoint.
 * 
 * 3. Spatial Joining:
 *    The Leaflet GeoJSON layer iterates through each polygon and matches its
 *    `feature.properties.name` to `barangaysByName[name]`.
 * 
 * 4. Dual-Mode Surveillance (Reported vs. Simulated):
 *    - REPORTED: Live ground-truth observations verified in the database.
 *    - SIMULATED: Epidemiological projection calculating spatial pathogen
 *      spread using the Haversine formula and herd density weights.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/axios';
import {
  GISTelemetryResponse,
  BarangayGISData,
  MapLayer,
  MunicipalSummary,
  MovementRecord,
} from '@/components/gis/types';
import { computeSimulatedSpread } from '@/components/gis/simulation';
import { GISMap } from '@/components/gis/GISMap';
import { GISControls } from '@/components/gis/GISControls';
import { GISLegend } from '@/components/gis/GISLegend';
import { GISSidebar } from '@/components/gis/GISSidebar';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Default empty municipal summary to avoid undefined rendering while loading
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

  // Active map layer & user selections
  const [activeLayer, setActiveLayer] = useState<MapLayer>('cattle');
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayGISData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  // Simulation mode (Haversine epidemic projection)
  const [simulationMode, setSimulationMode] = useState<boolean>(false);
  const [simulationStep, setSimulationStep] = useState<number>(7);

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
        toast.success('GIS Telemetry updated from database');
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

  // Compute simulated spread when simulation mode is toggled ON
  const simulatedStates = useMemo(() => {
    if (!simulationMode || !gisData?.barangays) return undefined;
    return computeSimulatedSpread(gisData.barangays, simulationStep);
  }, [simulationMode, gisData?.barangays, simulationStep]);

  // Keep selectedBarangay reference synchronized with fresh data
  useEffect(() => {
    if (selectedBarangay && barangaysByName[selectedBarangay.name]) {
      setSelectedBarangay(barangaysByName[selectedBarangay.name]);
    }
  }, [barangaysByName, selectedBarangay]);

  // Handlers
  const handleSelectBarangay = (b: BarangayGISData) => {
    setSelectedBarangay(b);
    setSidebarOpen(true);
  };

  const handleClearSelectedBarangay = () => {
    setSelectedBarangay(null);
  };

  const handleToggleSimulation = () => {
    setSimulationMode((prev) => {
      const next = !prev;
      if (next) {
        toast.info('⚡ Simulation Mode Activated', {
          description: 'Showing Haversine distance-decay pathogen spread projections.',
        });
        setActiveLayer('disease');
      } else {
        toast.success('Real Reported Data Restored');
      }
      return next;
    });
  };

  const handleResetBounds = () => {
    setResetTrigger((prev) => prev + 1);
    toast.info('Camera reset to Padre Garcia municipal extent');
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. Full-Screen Interactive GIS Map */}
      <GISMap
        barangaysByName={barangaysByName}
        movements={gisData?.movements || []}
        activeLayer={activeLayer}
        selectedBarangay={selectedBarangay}
        onSelectBarangay={handleSelectBarangay}
        resetTrigger={resetTrigger}
        simulationMode={simulationMode}
        simulatedStates={simulatedStates}
      />

      {/* 2. Floating Top-Left Controls & Layer Switcher */}
      <div className="absolute top-4 left-4 z-[900]">
        <GISControls
          currentLayer={activeLayer}
          onLayerChange={setActiveLayer}
          simulationMode={simulationMode}
          onToggleSimulation={handleToggleSimulation}
          onResetBounds={handleResetBounds}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
      </div>

      {/* 3. Floating Bottom-Left Dynamic Legend */}
      <div className="absolute bottom-4 left-4 z-[900]">
        <GISLegend layer={activeLayer} simulationMode={simulationMode} />
      </div>

      {/* 4. Floating Right Sidebar (Desktop Overlay + Mobile Sheet) */}
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
        simulationMode={simulationMode}
        simulatedStates={simulatedStates}
      />

      {/* 5. Loading Pill Indicator */}
      {isLoading && (
        <div className="absolute top-4 right-1/2 translate-x-1/2 z-[1100] bg-emerald-950/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/30 text-xs flex items-center gap-2 shadow-xl animate-in fade-in">
          <Loader2 className="size-3.5 animate-spin text-emerald-400" />
          <span className="font-semibold tracking-wide">Syncing Telemetry...</span>
        </div>
      )}
    </div>
  );
}
