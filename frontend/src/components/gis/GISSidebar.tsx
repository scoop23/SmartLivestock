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
  renderMode?: 'desktop' | 'mobile-sheet' | 'auto';
  userScope?: any;
  farmerStats?: any;
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
  userScope,
  farmerStats,
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
      userScope={userScope}
      farmerStats={farmerStats}
    />
  );

  // Mode 1: Mobile Bottom Sheet (< 1024px)
  if (renderMode === 'mobile-sheet') {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          className="h-[84dvh] max-h-[88dvh] rounded-t-3xl p-0 bg-white border-t border-slate-200 flex flex-col overflow-hidden shadow-2xl z-[1200]"
        >
          <SheetTitle className="sr-only">
            {selectedBarangay ? `Barangay ${selectedBarangay.name} Telemetry` : 'Municipal Telemetry Overview'}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detailed livestock, disease, and production records for Padre Garcia
          </SheetDescription>
          <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 shrink-0" />
          <div className="flex-1 overflow-y-auto">
            {content}
          </div>
        </SheetContent>
      </Sheet>
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

