'use client';

/**
 * SmartLivestock GIS — Telemetry Sidebar (Desktop Right Overlay + Mobile Sheet)
 * ============================================================================
 * ARCHITECTURAL CONCEPTS & LEARNING GUIDE:
 * ============================================================================
 * 
 * 1. DUAL-MODE PRESENTATION:
 *    - Desktop (>= 1024px / lg): Renders as a floating frosted-glass card on the
 *      right edge of the map (`absolute right-4 top-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] z-[1000]`).
 *      It floats smoothly over the map without requiring the map canvas to reload.
 *    - Mobile & Tablet (< 1024px): Renders as a responsive bottom sheet drawer
 *      via shadcn's `<Sheet side="bottom">`, with max-height 88dvh and safe area insets,
 *      allowing users to inspect telemetry on demand and swipe down to view the full map.
 * 
 * 2. SEPARATION OF CONCERNS & ACCESSIBILITY:
 *    - If `selectedBarangay` is non-null: Renders `<BarangayDetails>` showing
 *      individual herd counts, disease alerts, milk/meat production, and simulation.
 *      Includes an "Overview" back button and a dedicated close button.
 *    - If `selectedBarangay` is null: Renders `<MunicipalOverview>` showing
 *      municipality-wide aggregates, alert queues, and top producer leaderboards,
 *      complete with a dedicated close button.
 */

import React, { useState, useEffect } from 'react';
import {
  BarangayGISData,
  MunicipalSummary,
  MovementRecord,
  SimulatedBarangayState,
  DiseaseSubMode,
  ViewMode,
} from './types';
import { BarangayDetails } from './BarangayDetails';
import { MunicipalOverview } from './MunicipalOverview';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface GISSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBarangay: BarangayGISData | null;
  onClearSelectedBarangay: () => void;
  onSelectBarangay: (b: BarangayGISData) => void;
  summary: MunicipalSummary;
  movements: MovementRecord[];
  allBarangays: BarangayGISData[];
  onRefresh: () => void;
  isLoading: boolean;
  diseaseSubMode: DiseaseSubMode;
  viewMode: ViewMode;
  simulatedStates?: Record<string, SimulatedBarangayState>;
  selectedLivestockType?: string;
  renderMode?: 'desktop' | 'mobile-inline' | 'auto';
}

export function GISSidebar({
  isOpen,
  onClose,
  selectedBarangay,
  onClearSelectedBarangay,
  onSelectBarangay,
  summary,
  movements,
  allBarangays,
  onRefresh,
  isLoading,
  diseaseSubMode,
  viewMode,
  simulatedStates,
  selectedLivestockType,
  renderMode = 'auto',
}: GISSidebarProps) {
  // Choose content based on selection
  const content = selectedBarangay ? (
    <BarangayDetails
      data={selectedBarangay}
      simulatedState={simulatedStates?.[selectedBarangay.name]}
      diseaseSubMode={diseaseSubMode}
      viewMode={viewMode}
      onClose={onClose}
      onBack={onClearSelectedBarangay}
      selectedLivestockType={selectedLivestockType}
    />
  ) : (
    <MunicipalOverview
      summary={summary}
      movements={movements}
      allBarangays={allBarangays}
      onSelectBarangay={onSelectBarangay}
      onRefresh={onRefresh}
      isLoading={isLoading}
      simulationMode={diseaseSubMode === 'simulation'}
      onClose={onClose}
    />
  );

  // Mode 1: Mobile Inline View (< 1024px) rendered directly in the document flow under the map
  if (renderMode === 'mobile-inline') {
    return (
      <section
        id="mobile-gis-sidebar"
        aria-label="Mobile GIS Telemetry & Analytics"
        className="lg:hidden w-full bg-slate-900 border-t-2 border-emerald-800 flex flex-col shrink-0 shadow-2xl"
      >
        {/* Mobile Section Header with "Back to Map" button */}
        <div className="bg-emerald-950 px-4 py-2.5 text-white flex items-center justify-between border-b border-emerald-900 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-wider uppercase text-emerald-400">
              📊 {selectedBarangay ? `Brgy. ${selectedBarangay.name} Details` : 'Municipal Telemetry Overview'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="text-[11px] font-bold text-emerald-300 hover:text-white flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
            aria-label="Scroll back up to map"
          >
            <span>↑ Back to Map</span>
          </button>
        </div>

        {/* Telemetry Content with fixed container and smooth internal scrolling */}
        <div className="w-full max-h-[620px] overflow-hidden flex flex-col bg-white">
          {content}
        </div>
      </section>
    );
  }

  // Mode 2: Desktop Floating View (>= 1024px)
  if (!isOpen) return null;

  return (
    <aside
      aria-label="GIS Telemetry Sidebar"
      className="hidden lg:flex absolute right-4 top-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] z-[1000] rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200/90 flex-col overflow-hidden pointer-events-auto transition-all animate-in fade-in slide-in-from-right duration-200"
    >
      {content}
    </aside>
  );
}

