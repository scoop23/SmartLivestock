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

import React from 'react';
import { MovementRecord } from './types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Truck,
  MapPin,
  Calendar,
  User,
  FileCheck,
  ShieldCheck,
  Clock,
  ArrowRight,
  Info,
  X,
  Layers,
} from 'lucide-react';

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
    <div className="bg-white rounded-2xl flex flex-col h-full overflow-hidden text-slate-800">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white p-3.5 sm:p-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-9 rounded-xl bg-emerald-700 flex items-center justify-center text-white shrink-0 shadow-sm">
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
        {/* Origin to Destination Flow Card */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${directionColor}`}>
              {directionLabel}
            </span>
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Calendar className="size-3.5 text-slate-400" />
              {formattedDate}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Origin */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2.5 space-y-0.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-600 inline-block" />
                Origin Hub
              </div>
              <div className="font-black text-sm text-emerald-950 truncate">
                {movement.origin}
              </div>
              <div className="text-[10px] text-emerald-700">
                Coords: [{movement.from[0].toFixed(4)}, {movement.from[1].toFixed(4)}]
              </div>
            </div>

            {/* Destination */}
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-2.5 space-y-0.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1">
                <span className="size-2 rounded-full bg-blue-600 inline-block" />
                Destination Terminal
              </div>
              <div className="font-black text-sm text-blue-950 truncate">
                {movement.destination}
              </div>
              <div className="text-[10px] text-blue-700">
                Coords: [{movement.to[0].toFixed(4)}, {movement.to[1].toFixed(4)}]
              </div>
            </div>
          </div>
        </div>

        {/* Livestock Head Count & Species Summary */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
            <div className="text-2xl font-black font-mono text-emerald-950">
              {movement.heads}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              🐄 Cattle / Heads Moved
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
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
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Shipper / Handler:</span>
              <span className="font-bold text-slate-900">{movement.shipper_name || 'Registered Handler'}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Transport Purpose:</span>
              <span className="font-bold text-slate-900">{movement.purpose || 'Livestock Movement'}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Clearance Certificate:</span>
              <span className="font-bold font-mono text-emerald-900">{movement.control_number || 'N/A'}</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-500 font-medium">Official Status:</span>
              <span className="font-bold">
                {isApproved ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="size-3.5" /> MAO Approved
                  </span>
                ) : (
                  <span className="text-amber-700 flex items-center gap-1">
                    <Clock className="size-3.5" /> Under Inspection / Review
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
