'use client';

import React from 'react';
import {
  BarangayGISData,
  MunicipalSummary,
  MovementRecord,
  SimulatedBarangayState,
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
  simulationMode: boolean;
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
  simulationMode,
  simulatedStates,
}: GISSidebarProps) {
  const isMobile = useIsMobile();

  const content = selectedBarangay ? (
    <BarangayDetails
      data={selectedBarangay}
      simulatedState={simulatedStates?.[selectedBarangay.name]}
      simulationMode={simulationMode}
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
      simulationMode={simulationMode}
    />
  );

  // Mobile View: Render in a shadcn Sheet drawer
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="p-0 max-h-[85vh] rounded-t-2xl overflow-hidden">
          <SheetTitle className="sr-only">
            {selectedBarangay ? `Barangay ${selectedBarangay.name} Telemetry` : 'Municipal GIS Overview'}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {selectedBarangay
              ? `Livestock demographics, disease surveillance, and production for Barangay ${selectedBarangay.name}`
              : 'Padre Garcia municipal livestock and disease surveillance overview'}
          </SheetDescription>
          <div className="h-full overflow-hidden flex flex-col">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop View: Floating overlay card on the right
  if (!isOpen) return null;

  return (
    <div className="absolute right-4 top-4 bottom-4 w-96 z-[1000] rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden pointer-events-auto transition-all animate-in fade-in slide-in-from-right duration-200">
      {content}
    </div>
  );
}
