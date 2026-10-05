'use client';

/**
 * SmartLivestock GIS — Telemetry Sidebar (Desktop Right Overlay + Mobile Sheet)
 * ============================================================================
 * ARCHITECTURAL CONCEPTS & LEARNING GUIDE:
 * ============================================================================
 * 
 * 1. DUAL-MODE PRESENTATION:
 *    - Desktop (>= 1024px / lg): Renders as a floating frosted-glass card on the
 *      right edge of the map (`absolute right-4 top-4 bottom-4 w-96 z-[1000]`).
 *      It floats smoothly over the map without requiring the map canvas to reload.
 *    - Mobile (< 1024px): Renders as a bottom slide-up drawer via shadcn's `<Sheet side="bottom">`
 *      allowing users to swipe up to see telemetry and swipe down to see the map.
 * 
 * 2. SEPARATION OF CONCERNS:
 *    - If `selectedBarangay` is non-null: Renders `<BarangayDetails>` showing
 *      individual herd counts, disease alerts, milk/meat production, and simulation.
 *    - If `selectedBarangay` is null: Renders `<MunicipalOverview>` showing
 *      municipality-wide aggregates, alert queues, and top producer leaderboards.
 */

import React from 'react';
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
import { useIsMobile } from '@/components/ui/use-mobile';

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
}: GISSidebarProps) {
  const isMobile = useIsMobile();

  // Choose content based on selection
  const content = selectedBarangay ? (
    <BarangayDetails
      data={selectedBarangay}
      simulatedState={simulatedStates?.[selectedBarangay.name]}
      diseaseSubMode={diseaseSubMode}
      viewMode={viewMode}
      onClose={onClearSelectedBarangay}
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
    />
  );

  // Mobile View: Render in a bottom Sheet drawer for touch accessibility
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="p-0 max-h-[85vh] rounded-t-2xl overflow-hidden">
          <SheetTitle className="sr-only">
            {selectedBarangay ? `Barangay ${selectedBarangay.name} Telemetry` : 'Municipal GIS Overview'}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {selectedBarangay
              ? `Demographics, disease status, and production for Barangay ${selectedBarangay.name}`
              : 'Padre Garcia municipal overview and telemetry'}
          </SheetDescription>
          <div className="h-full overflow-hidden flex flex-col">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop View: Floating right overlay card
  if (!isOpen) return null;

  return (
    <aside
      aria-label="GIS Telemetry Sidebar"
      className="absolute right-4 top-4 bottom-4 w-96 z-[1000] rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden pointer-events-auto transition-all animate-in fade-in slide-in-from-right duration-200"
    >
      {content}
    </aside>
  );
}
