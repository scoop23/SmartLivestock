'use client';

import type { GISUserScope, FarmerPersonalStats } from "./types";
import styles from './GISSidebar.module.css';
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

import {
Sheet,
SheetContent,
SheetDescription,
SheetTitle,
} from '@/components/ui/sheet';
import { BarangayDetails } from './BarangayDetails';
import { MovementDetailsModal } from './MovementDetailsModal';
import { MunicipalOverview } from './MunicipalOverview';
import {
BarangayGISData,
DiseaseSubMode,
MapLayer,
MovementRecord,
MunicipalSummary,
SimulatedBarangayState,
ViewMode,
} from './types';
import { useRef,useState,type PointerEvent,type KeyboardEvent } from 'react';

type MobileSnapState = 'collapsed' | 'half' | 'expanded';

const mobileSnapPoints = (viewportHeight: number) => [
  { state: 'collapsed' as const, height: 116 },
  { state: 'half' as const, height: Math.round(viewportHeight * 0.54) },
  { state: 'expanded' as const, height: Math.round(viewportHeight * 0.89) },
];

const clampMobileHeight = (height: number, viewportHeight: number) =>
  Math.max(116, Math.min(Math.round(viewportHeight * 0.89), height));

const nearestMobileSnap = (height: number, viewportHeight: number): MobileSnapState =>
  mobileSnapPoints(viewportHeight).reduce((nearest, point) =>
    Math.abs(point.height - height) < Math.abs(nearest.height - height) ? point : nearest
  ).state;

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
  userScope?: GISUserScope;
  farmerStats?: FarmerPersonalStats | null;
  activeLayer?: MapLayer;
  selectedMovement?: MovementRecord | null;
  onSelectMovement?: (m: MovementRecord | null) => void;
  onClearSelectedMovement?: () => void;
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
  activeLayer,
  selectedMovement = null,
  onSelectMovement,
  onClearSelectedMovement,
}: GISSidebarProps) {
  const [desktopWidth, setDesktopWidth] = useState(384);
  const [mobileSnapState, setMobileSnapState] = useState<MobileSnapState>('half');
  const [mobileDragHeight, setMobileDragHeight] = useState<number | null>(null);
  const mobilePanelRef = useRef<HTMLDivElement | null>(null);
  const mobilePointerStartY = useRef<number | null>(null);
  const mobilePointerStartHeight = useRef(0);
  const mobilePointerDeltaY = useRef(0);
  const mobileDidDrag = useRef(false);
  const suppressMobileClickUntil = useRef(0);
  const getMaxDesktopWidth = () => Math.max(320, Math.min(720, window.innerWidth - 32));

  const resizeFromPointer = (clientX: number) => {
    const maxWidth = getMaxDesktopWidth();
    setDesktopWidth(Math.min(maxWidth, Math.max(320, window.innerWidth - clientX - 16)));
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const maxWidth = getMaxDesktopWidth();
    if (event.key === 'ArrowLeft') setDesktopWidth((width) => Math.min(maxWidth, width + 24));
    else if (event.key === 'ArrowRight') setDesktopWidth((width) => Math.max(320, width - 24));
    else if (event.key === 'Home') setDesktopWidth(320);
    else if (event.key === 'End') setDesktopWidth(maxWidth);
    else return;
    event.preventDefault();
  };

  const handleMobilePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    mobilePointerStartY.current = event.clientY;
    mobilePointerStartHeight.current = mobilePanelRef.current?.getBoundingClientRect().height ?? Math.round(window.innerHeight * 0.54);
    mobilePointerDeltaY.current = 0;
    mobileDidDrag.current = false;
    setMobileDragHeight(mobilePointerStartHeight.current);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMobilePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (mobilePointerStartY.current === null) return;
    mobilePointerDeltaY.current = event.clientY - mobilePointerStartY.current;
    if (Math.abs(mobilePointerDeltaY.current) > 8) mobileDidDrag.current = true;
    setMobileDragHeight(clampMobileHeight(
      mobilePointerStartHeight.current - mobilePointerDeltaY.current,
      window.innerHeight,
    ));
  };

  const finishMobileDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (mobilePointerStartY.current === null) return;
    const height = clampMobileHeight(
      mobilePointerStartHeight.current - mobilePointerDeltaY.current,
      window.innerHeight,
    );
    setMobileSnapState(nearestMobileSnap(height, window.innerHeight));
    setMobileDragHeight(null);
    if (mobileDidDrag.current) suppressMobileClickUntil.current = Date.now() + 400;
    mobilePointerStartY.current = null;
    mobilePointerDeltaY.current = 0;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleMobilePointerCancel = () => {
    if (mobilePointerStartY.current !== null) {
      const height = clampMobileHeight(
        mobilePointerStartHeight.current - mobilePointerDeltaY.current,
        window.innerHeight,
      );
      setMobileSnapState(nearestMobileSnap(height, window.innerHeight));
    }
    setMobileDragHeight(null);
    mobilePointerStartY.current = null;
    mobilePointerDeltaY.current = 0;
    mobileDidDrag.current = false;
  };

  const handleMobileKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const states: MobileSnapState[] = ['collapsed', 'half', 'expanded'];
    const currentIndex = states.indexOf(mobileSnapState);
    if (event.key === 'ArrowUp') setMobileSnapState(states[Math.min(states.length - 1, currentIndex + 1)]);
    else if (event.key === 'ArrowDown') setMobileSnapState(states[Math.max(0, currentIndex - 1)]);
    else if (event.key === 'Home') setMobileSnapState('collapsed');
    else if (event.key === 'End') setMobileSnapState('expanded');
    else return;
    event.preventDefault();
  };

  const mobileHeightClass = mobileSnapState === 'collapsed'
    ? 'h-[116px]'
    : mobileSnapState === 'half'
      ? 'h-[54dvh]'
      : 'h-[89dvh]';

  // Choose content based on selection priority:
  // 1. If an individual movement permit is selected -> show permit details sheet
  // 2. Else if a barangay is selected -> show barangay telemetry details
  // 3. Else -> show municipal telemetry / movement analysis overview
  const content = selectedMovement ? (
    <MovementDetailsModal
      key={selectedMovement.id}
      movement={selectedMovement}
      onClose={() => {
        if (onClearSelectedMovement) {
          onClearSelectedMovement();
        } else if (onSelectMovement) {
          onSelectMovement(null);
        }
      }}
    />
  ) : selectedBarangay ? (
    <BarangayDetails
      data={selectedBarangay}
      simulatedState={simulatedStates?.[selectedBarangay.name]}
      diseaseSubMode={diseaseSubMode}
      viewMode={viewMode}
      onClose={onClose}
      onBack={onClearSelectedBarangay}
      selectedLivestockType={selectedLivestockType}
      userScope={userScope}
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
      activeLayer={activeLayer}
      selectedMovement={selectedMovement}
      onSelectMovement={(m) => onSelectMovement?.(m)}
      onClearSelectedMovement={onClearSelectedMovement}
    />
  );

  // Mode 1: Mobile Bottom Sheet (< 1024px)
  if (renderMode === 'mobile-sheet') {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          ref={mobilePanelRef}
          style={mobileDragHeight === null ? undefined : { height: `${mobileDragHeight}px` }}
          className={`${styles.panel} ${mobileHeightClass} max-h-[89dvh] gap-0 rounded-t-3xl p-0 bg-white ${
            selectedMovement ? 'border-t-2 border-t-blue-500 ring-2 ring-blue-400/40 animate-sidebar-glow' : 'border-t border-slate-200'
          } flex flex-col overflow-hidden shadow-2xl z-[var(--z-dialog)] transition-[height] duration-300 data-[state=open]:duration-300 [&>button]:hidden ${mobileDragHeight === null ? '' : '!transition-none'}`}
        >
          <SheetTitle className="sr-only">
            {selectedBarangay ? `Barangay ${selectedBarangay.name} Telemetry` : 'Municipal Telemetry Overview'}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detailed livestock, disease, and production records for Padre Garcia
          </SheetDescription>
          <div className="shrink-0">
            <button
              type="button"
              aria-label={`GIS details panel is ${mobileSnapState}. Use arrow keys to resize.`}
              aria-expanded={mobileSnapState !== 'collapsed'}
              onPointerDown={handleMobilePointerDown}
              onPointerMove={handleMobilePointerMove}
              onPointerUp={finishMobileDrag}
              onPointerCancel={handleMobilePointerCancel}
              onKeyDown={handleMobileKeyDown}
              onClick={() => {
                if (Date.now() < suppressMobileClickUntil.current) return;
                setMobileSnapState((state) => state === 'collapsed' ? 'half' : state === 'half' ? 'expanded' : 'collapsed');
              }}
              className="group flex w-full shrink-0 touch-none flex-col items-center border-b border-slate-100 px-4 pb-2.5 pt-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
            >
              <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-slate-300 transition-colors group-hover:bg-blue-500" />
              <span className="mt-2 flex w-full items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-slate-700">
                  {selectedMovement ? `Permit #${selectedMovement.id}` : selectedBarangay ? `${selectedBarangay.name} telemetry` : 'GIS telemetry'}
                </span>
                <span className="shrink-0 text-[10px] text-slate-500">
                  {mobileSnapState === 'collapsed' ? 'Swipe up to expand' : mobileSnapState === 'expanded' ? 'Swipe down to close' : 'Drag to resize'}
                </span>
              </span>
            </button>
          </div>
          <div className={`min-h-0 flex-1 overflow-y-auto ${mobileSnapState === 'collapsed' && (mobileDragHeight ?? 0) < 150 ? 'hidden' : ''}`}>
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
      style={{ width: desktopWidth, minWidth: 320, maxWidth: 'min(45rem, calc(100vw - 2rem))' }}
      className={`${styles.panel} hidden lg:flex absolute right-4 top-4 bottom-4 max-h-[calc(100dvh-2rem)] z-[1000] rounded-2xl backdrop-blur-xl shadow-2xl border flex-col overflow-hidden pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-right duration-200 ${
        selectedMovement
          ? 'border-blue-400/90 ring-2 ring-blue-400/40 shadow-[0_0_35px_rgba(59,130,246,0.25)] animate-sidebar-glow'
          : 'border-slate-200/90'
      }`}
    >
      <div
        role="separator"
        aria-label="Resize GIS sidebar"
        aria-orientation="vertical"
        aria-valuemin={320}
        aria-valuemax={720}
        aria-valuenow={Math.round(desktopWidth)}
        aria-valuetext={`${Math.round(desktopWidth)} pixels wide`}
        aria-controls="gis-sidebar-content"
        tabIndex={0}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          resizeFromPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeFromPointer(event.clientX);
        }}
        onKeyDown={handleResizeKeyDown}
        className="absolute inset-y-0 left-0 z-10 flex w-3 touch-none cursor-ew-resize items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
      >
        <span aria-hidden="true" className="h-10 w-1 rounded-full bg-slate-300 transition-colors hover:bg-blue-500" />
      </div>
      <div id="gis-sidebar-content" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {content}
      </div>
    </aside>
  );
}

