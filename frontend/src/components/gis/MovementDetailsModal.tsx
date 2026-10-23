'use client';

/**
 * ============================================================================
 * SmartLivestock GIS — Movement Details Component (`MovementDetailsModal.tsx`)
 * ============================================================================
 * 
 * ARCHITECTURAL DESIGN & CAPSTONE DEFENSE CONCEPTS:
 * ----------------------------------------------------------------------------
 * 1. RECORD-BASED TRANSPORT VISUALIZATION (NOT LIVE GPS TRACKING):
 *    - SmartLivestock maps authorized livestock transport permits issued by the
 *      Municipal Agriculture Office (MAO) and inspection officers.
 *    - Origins and destinations represent verified barangay or municipal centroids.
 *    - This component presents the authoritative permit data without inventing
 *      unsubstantiated farm coordinates or road-level turn-by-turn tracks.
 * 
 * 2. AUTHORITATIVE CLEARANCE & LINE ITEM BREAKDOWN:
 *    - Displays the official inspection clearance control number.
 *    - Breaks down individual item rows (livestock species, head count, sex, classification).
 *    - Distinguishes APPROVED permits from PENDING/VERIFICATION stages.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
Calendar,
Clock,
Info,
Layers,
MapPin,
ShieldCheck,
Truck,
User,
X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { MovementRecord } from './types';

interface MovementDetailsModalProps {
  movement: MovementRecord;
  onClose: () => void;
  onFocusOnMap?: () => void;
  isMobileDrawer?: boolean;
}

export function MovementDetailsModal({
  movement,
  onClose,
  onFocusOnMap,
  isMobileDrawer = false,
}: MovementDetailsModalProps) {
  const [isHighlighted, setIsHighlighted] = useState(true);

  // Trigger highlight animation on mount or whenever the clicked line/movement changes
  useEffect(() => {
    setIsHighlighted(true);
    const timer = setTimeout(() => setIsHighlighted(false), 2200);
    return () => clearTimeout(timer);
  }, [movement.id]);

  const isApproved = movement.clearance_status?.toUpperCase() === 'APPROVED';
  const isPending = movement.clearance_status?.toUpperCase() === 'PENDING';
  const isVerified = movement.clearance_status?.toUpperCase() === 'VERIFIED';

  const directionLabel =
    movement.direction === 'OUTBOUND'
      ? 'Outbound from Padre Garcia'
      : movement.direction === 'INBOUND'
      ? 'Inbound to Padre Garcia'
      : movement.direction === 'INTERNAL'
      ? 'Local Intra-Municipal Transfer'
      : movement.type === 'export'
      ? 'Outbound Shipment'
      : 'Inbound Shipment';

  const directionColor =
    movement.direction === 'OUTBOUND'
      ? 'text-rose-700 bg-rose-50 border-rose-200'
      : movement.direction === 'INBOUND'
      ? 'text-blue-700 bg-blue-50 border-blue-200'
      : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  const formattedDate = (() => {
    try {
      const d = new Date(movement.date);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return movement.date;
    }
  })();

  return (
    <div className="bg-white rounded-2xl flex flex-col h-full overflow-hidden text-slate-800 transition-all duration-500 animate-in fade-in zoom-in-[0.98]">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white p-3.5 sm:p-4 shrink-0 flex items-center justify-between relative overflow-hidden">
        {/* Animated Top Sweep Glow */}
        {isHighlighted && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 animate-shimmer-sweep" />
        )}
        <div className="flex items-center gap-2 min-w-0">
          <div className={`size-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm transition-all duration-500 ${
            isHighlighted ? 'bg-blue-600 ring-2 ring-blue-400/60 scale-105' : 'bg-emerald-700'
          }`}>
            <Truck className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-black text-sm text-white truncate">
                Movement Permit #{movement.id}
              </h3>
              <Badge
                className={
                  isApproved
                    ? 'bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0'
                    : isPending
                    ? 'bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0'
                    : isVerified
                    ? 'bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0'
                    : 'bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0'
                }
              >
                {movement.clearance_status || 'RECORDED'}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-300 truncate font-mono">
              Control No: {movement.control_number || 'N/A'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close movement details"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1 text-slate-800 overscroll-contain">
        {/* Active Map Line Indicator Banner */}
        <div
          className={`p-2.5 rounded-xl border transition-all duration-500 flex items-center justify-between gap-2 ${
            isHighlighted
              ? 'bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border-blue-400/80 shadow-md ring-2 ring-blue-400/40'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex size-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2.5 bg-blue-600"></span>
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-black text-blue-950 flex items-center gap-1.5 truncate">
                <span>Map Line Selected</span>
                <span className="text-[10px] text-blue-700 font-mono bg-blue-100/80 px-1.5 py-0.2 rounded font-bold">
                  Permit #{movement.id}
                </span>
              </div>
              <div className="text-[10px] text-blue-700 font-medium truncate">
                Route: {movement.origin} → {movement.destination}
              </div>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-blue-300 text-blue-800 bg-white/90 text-[9px] font-mono shrink-0 px-1.5 py-0 shadow-2xs"
          >
            Transit Flow
          </Badge>
        </div>

        {/* Origin to Destination Flow Card (Counterpart to the Map Line) */}
        <div
          className={`rounded-xl p-3.5 space-y-3 min-w-0 overflow-hidden transition-all duration-500 border ${
            isHighlighted
              ? 'bg-gradient-to-b from-blue-50/90 to-white border-blue-400 ring-2 ring-blue-400/50 shadow-md animate-line-highlight'
              : 'bg-slate-50 border-slate-200/90 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${directionColor}`}>
              {directionLabel}
            </span>
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0">
              <Calendar className="size-3.5 text-slate-400" />
              {formattedDate}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Origin */}
            <div className={`border rounded-lg p-2.5 space-y-0.5 min-w-0 overflow-hidden transition-all duration-500 ${
              isHighlighted ? 'bg-emerald-50/90 border-emerald-300 shadow-2xs' : 'bg-emerald-50/70 border-emerald-200/80'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-600 inline-block shrink-0" />
                Origin Hub
              </div>
              <div className="font-black text-sm text-emerald-950 truncate" title={movement.origin}>
                {movement.origin}
              </div>
              <div className="text-[10px] text-emerald-700 font-mono truncate">
                Coords: [{movement.from[0].toFixed(4)}, {movement.from[1].toFixed(4)}]
              </div>
            </div>

            {/* Destination */}
            <div className={`border rounded-lg p-2.5 space-y-0.5 min-w-0 overflow-hidden transition-all duration-500 ${
              isHighlighted ? 'bg-blue-50/90 border-blue-300 shadow-2xs' : 'bg-blue-50/70 border-blue-200/80'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1">
                <span className="size-2 rounded-full bg-blue-600 inline-block shrink-0" />
                Destination Terminal
              </div>
              <div className="font-black text-sm text-blue-950 truncate" title={movement.destination}>
                {movement.destination}
              </div>
              <div className="text-[10px] text-blue-700 font-mono truncate">
                Coords: [{movement.to[0].toFixed(4)}, {movement.to[1].toFixed(4)}]
              </div>
            </div>
          </div>

          {/* Animated Transit Flow Indicator */}
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <div className="h-0.5 flex-1 bg-gradient-to-r from-emerald-500 to-blue-500" />
            <div className="flex items-center gap-1 text-[10px] font-black text-blue-700 px-2.5 py-0.5 rounded-full bg-blue-100/70 border border-blue-200 shrink-0">
              <Truck className={`size-3 text-blue-600 ${isHighlighted ? 'animate-bounce' : ''}`} />
              <span>Transit Line Arc</span>
            </div>
            <div className="h-0.5 flex-1 bg-gradient-to-r from-blue-500 to-blue-600" />
          </div>
        </div>

        {/* Livestock Head Count & Species Summary */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`bg-white border rounded-xl p-3 shadow-2xs transition-all duration-500 ${
            isHighlighted ? 'border-emerald-400/80 ring-1 ring-emerald-300/50 shadow-sm' : 'border-slate-200'
          }`}>
            <div className="text-2xl font-black font-mono text-emerald-950">
              {movement.heads}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              🐄 Cattle / Heads Moved
            </div>
          </div>

          <div className={`bg-white border rounded-xl p-3 shadow-2xs transition-all duration-500 ${
            isHighlighted ? 'border-blue-400/80 ring-1 ring-blue-300/50 shadow-sm' : 'border-slate-200'
          }`}>
            <div className="text-base font-black text-slate-900 truncate">
              {movement.species || 'Cattle'}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Species Type
            </div>
          </div>
        </div>

        {/* Shipper & Transport Purpose Details */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            <User className="size-3.5 text-slate-700" />
            Shipper & Clearance Particulars
          </h4>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-100 gap-2 min-w-0">
              <span className="text-slate-500 font-medium shrink-0">Shipper / Handler:</span>
              <span className="font-bold text-slate-900 truncate text-right min-w-0 max-w-[60%]" title={movement.shipper_name || undefined}>
                {movement.shipper_name || 'Registered Handler'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-100 gap-2 min-w-0">
              <span className="text-slate-500 font-medium shrink-0">Transport Purpose:</span>
              <span className="font-bold text-slate-900 truncate text-right min-w-0 max-w-[60%]" title={movement.purpose || undefined}>
                {movement.purpose || 'Livestock Movement'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-100 gap-2 min-w-0">
              <span className="text-slate-500 font-medium shrink-0">Clearance Certificate:</span>
              <span className="font-bold font-mono text-emerald-900 truncate text-right min-w-0 max-w-[60%]">
                {movement.control_number || 'N/A'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 gap-2 min-w-0">
              <span className="text-slate-500 font-medium shrink-0">Official Status:</span>
              <span className="font-bold shrink-0">
                {isApproved ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="size-3.5" /> MAO Approved
                  </span>
                ) : (
                  <span className="text-amber-700 flex items-center gap-1">
                    <Clock className="size-3.5" /> Under Inspection
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Line Items Breakdown (if available) */}
        {movement.items_breakdown && movement.items_breakdown.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="size-3.5 text-slate-700" />
              Livestock Breakdown ({movement.items_breakdown.length} line items)
            </h4>

            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden text-xs">
              {movement.items_breakdown.map((item, idx) => (
                <div key={idx} className="p-2 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <span className="font-bold text-slate-900">{item.quantity} × {item.species}</span>
                    <span className="text-[10px] text-slate-500 block">
                      {item.sex || 'Mixed'} • {item.classification || 'Standard'}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-slate-300">
                    {item.quantity} heads
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Centroid Geographic Disclaimer */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-blue-950">
            <Info className="size-3.5 text-blue-700 shrink-0" />
            Record-Based Geographic Reference
          </div>
          <p className="text-[11px] text-blue-800/90 leading-tight">
            This route is drawn between verified municipal or barangay centroids based on municipal permit records. It does not represent live GPS tracking or turn-by-turn road paths.
          </p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-2">
        {onFocusOnMap && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onFocusOnMap}
            className="text-xs font-bold text-slate-700 border-slate-300 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
          >
            <MapPin className="size-3.5 text-emerald-700" />
            Center on Map
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          onClick={onClose}
          className="ml-auto bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 cursor-pointer"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
