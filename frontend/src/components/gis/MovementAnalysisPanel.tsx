'use client';

/**
 * ============================================================================
 * SmartLivestock GIS — Movement Analysis & Filter Panel (`MovementAnalysisPanel.tsx`)
 * ============================================================================
 * 
 * ARCHITECTURAL DESIGN & CAPSTONE CONCEPTS:
 * ----------------------------------------------------------------------------
 * 1. MULTI-DIMENSIONAL MOVEMENT FILTERING:
 *    - Allows MAO and veterinary officers to slice recorded livestock shipments
 *      by date preset (30d, 90d, this year, all time), permit status, movement direction,
 *      and origin/destination queries.
 * 
 * 2. SEPARATION OF CONCEPTS (DATA TRUST):
 *    - Clearly distinguishes movement-event counts (number of permits) from
 *      individual cattle head counts (total heads transported).
 *    - Approved permits are distinguished from pending applications.
 */

import React, { useState, useMemo } from 'react';
import { MovementRecord, MovementFilterState, MovementDatePreset } from './types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Truck,
  MapPin,
  Calendar,
  Filter,
  ArrowRight,
  ShieldCheck,
  Clock,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

interface MovementAnalysisPanelProps {
  movements: MovementRecord[];
  selectedMovement: MovementRecord | null;
  onSelectMovement: (m: MovementRecord) => void;
  onClearSelectedMovement: () => void;
  onClose?: () => void;
}

export function MovementAnalysisPanel({
  movements,
  selectedMovement,
  onSelectMovement,
  onClearSelectedMovement,
  onClose,
}: MovementAnalysisPanelProps) {
  // Filter States
  const [datePreset, setDatePreset] = useState<MovementDatePreset>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Date Filtering Calculation
  const filteredMovements = useMemo(() => {
    const now = new Date();

    return movements.filter((m) => {
      // 1. Date filter
      if (datePreset !== 'all') {
        const mDate = new Date(m.date);
        if (isNaN(mDate.getTime())) return true;

        if (datePreset === '30d') {
          const past30 = new Date(now);
          past30.setDate(now.getDate() - 30);
          if (mDate < past30) return false;
        } else if (datePreset === '90d') {
          const past90 = new Date(now);
          past90.setDate(now.getDate() - 90);
          if (mDate < past90) return false;
        } else if (datePreset === 'this_year') {
          if (mDate.getFullYear() !== now.getFullYear()) return false;
        } else if (datePreset === 'last_year') {
          if (mDate.getFullYear() !== now.getFullYear() - 1) return false;
        }
      }

      // 2. Status filter
      if (statusFilter !== 'ALL') {
        const s = (m.clearance_status || '').toUpperCase();
        if (statusFilter === 'APPROVED' && s !== 'APPROVED') return false;
        if (statusFilter === 'PENDING' && s === 'APPROVED') return false;
      }

      // 3. Direction filter
      if (directionFilter !== 'ALL') {
        if (m.direction && m.direction !== directionFilter) return false;
      }

      // 4. Search query (origin, destination, shipper, species, control number)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesOrigin = m.origin.toLowerCase().includes(q);
        const matchesDest = m.destination.toLowerCase().includes(q);
        const matchesShipper = (m.shipper_name || '').toLowerCase().includes(q);
        const matchesSpecies = (m.species || '').toLowerCase().includes(q);
        const matchesControl = (m.control_number || '').toLowerCase().includes(q);
        if (!matchesOrigin && !matchesDest && !matchesShipper && !matchesSpecies && !matchesControl) {
          return false;
        }
      }

      return true;
    });
  }, [movements, datePreset, statusFilter, directionFilter, searchQuery]);

  // Derived Summary Metrics
  const summaryStats = useMemo(() => {
    let totalHeads = 0;
    let approvedCount = 0;
    let pendingCount = 0;
    let outboundHeads = 0;
    let inboundHeads = 0;
    let internalHeads = 0;

    const originMap: Record<string, { count: number; heads: number }> = {};
    const destMap: Record<string, { count: number; heads: number }> = {};

    for (const m of filteredMovements) {
      totalHeads += m.heads;
      if (m.clearance_status?.toUpperCase() === 'APPROVED') {
        approvedCount += 1;
      } else {
        pendingCount += 1;
      }

      if (m.direction === 'OUTBOUND') {
        outboundHeads += m.heads;
      } else if (m.direction === 'INBOUND') {
        inboundHeads += m.heads;
      } else {
        internalHeads += m.heads;
      }

      // Origin aggregation
      const oKey = m.origin.split(',')[0].trim();
      if (!originMap[oKey]) originMap[oKey] = { count: 0, heads: 0 };
      originMap[oKey].count += 1;
      originMap[oKey].heads += m.heads;

      // Destination aggregation
      const dKey = m.destination.split(',')[0].trim();
      if (!destMap[dKey]) destMap[dKey] = { count: 0, heads: 0 };
      destMap[dKey].count += 1;
      destMap[dKey].heads += m.heads;
    }

    const topOrigins = Object.entries(originMap)
      .map(([name, data]) => ({ name, count: data.count, heads: data.heads }))
      .sort((a, b) => b.heads - a.heads)
      .slice(0, 5);

    const topDestinations = Object.entries(destMap)
      .map(([name, data]) => ({ name, count: data.count, heads: data.heads }))
      .sort((a, b) => b.heads - a.heads)
      .slice(0, 5);

    return {
      totalMovements: filteredMovements.length,
      totalHeads,
      approvedCount,
      pendingCount,
      outboundHeads,
      inboundHeads,
      internalHeads,
      topOrigins,
      topDestinations,
    };
  }, [filteredMovements]);

  const maxOriginHeads = summaryStats.topOrigins[0]?.heads || 1;
  const maxDestHeads = summaryStats.topDestinations[0]?.heads || 1;

  const handleResetFilters = () => {
    setDatePreset('all');
    setStatusFilter('ALL');
    setDirectionFilter('ALL');
    setSearchQuery('');
  };

  const isFiltered =
    datePreset !== 'all' ||
    statusFilter !== 'ALL' ||
    directionFilter !== 'ALL' ||
    searchQuery.trim() !== '';

  return (
    <div className="space-y-4">
      {/* 1. Filter Control Section */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Filter className="size-3.5 text-blue-600" />
            Movement Filters & Scopes
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          )}
        </div>

        {/* Date Presets */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Time Horizon</span>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'all', label: 'All Time' },
              { id: '30d', label: 'Last 30d' },
              { id: '90d', label: 'Last 90d' },
              { id: 'this_year', label: '2026' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDatePreset(p.id as MovementDatePreset)}
                className={`text-[11px] font-bold py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center truncate ${
                  datePreset === p.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Flow Direction & Status Filters */}
        <div className="grid grid-cols-2 gap-2">
          {/* Direction */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Flow Direction</span>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Flows (All)</option>
              <option value="OUTBOUND">📤 Outbound</option>
              <option value="INBOUND">📥 Inbound</option>
              <option value="INTERNAL">🔄 Local Intra-Municipal</option>
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Permit Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">✅ Approved Permits</option>
              <option value="PENDING">⏳ Under Review</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Search origin, destination, shipper..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs bg-white border-slate-200 h-8"
          />
        </div>
      </div>

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-blue-50/90 border border-blue-200/80 rounded-xl p-2.5 space-y-0.5">
          <div className="text-xl font-black font-mono text-blue-950">
            {summaryStats.totalMovements}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
            🚛 Total Permits
          </div>
        </div>

        <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2.5 space-y-0.5">
          <div className="text-xl font-black font-mono text-emerald-950">
            {summaryStats.totalHeads.toLocaleString()}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            🐄 Heads Moved
          </div>
        </div>

        <div className="bg-rose-50/90 border border-rose-200/80 rounded-xl p-2.5 space-y-0.5">
          <div className="text-xl font-black font-mono text-rose-950">
            {summaryStats.outboundHeads.toLocaleString()}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
            📤 Outbound Heads
          </div>
        </div>

        <div className="bg-sky-50/90 border border-sky-200/80 rounded-xl p-2.5 space-y-0.5">
          <div className="text-xl font-black font-mono text-sky-950">
            {summaryStats.approvedCount}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-sky-800">
            ✅ Approved
          </div>
        </div>
      </div>

      {/* 3. Top Origins & Destinations Leaderboards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Top Origins */}
        {summaryStats.topOrigins.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
            <span className="font-black text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <span className="size-2 rounded-full bg-emerald-600 inline-block" />
              Top Origins (Centroids)
            </span>

            <div className="space-y-1.5 pt-0.5">
              {summaryStats.topOrigins.map((o, i) => (
                <div key={o.name} className="text-xs">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold text-slate-700 truncate max-w-[120px]">
                      {i + 1}. {o.name}
                    </span>
                    <span className="font-mono font-bold text-emerald-900">
                      {o.heads} heads
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.max(6, (o.heads / maxOriginHeads) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Destinations */}
        {summaryStats.topDestinations.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
            <span className="font-black text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <span className="size-2 rounded-full bg-blue-600 inline-block" />
              Top Destinations
            </span>

            <div className="space-y-1.5 pt-0.5">
              {summaryStats.topDestinations.map((d, i) => (
                <div key={d.name} className="text-xs">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold text-slate-700 truncate max-w-[120px]">
                      {i + 1}. {d.name}
                    </span>
                    <span className="font-mono font-bold text-blue-900">
                      {d.heads} heads
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.max(6, (d.heads / maxDestHeads) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Movement Permits Interactive Feed */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-black text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
            <Truck className="size-3.5 text-blue-600" />
            Permit Inspection Records ({filteredMovements.length})
          </span>
          <span className="text-[10px] text-slate-400 font-bold uppercase">
            Click to inspect route
          </span>
        </div>

        {filteredMovements.length > 0 ? (
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {filteredMovements.map((m) => {
              const isSelected = selectedMovement?.id === m.id;
              const isAppr = m.clearance_status?.toUpperCase() === 'APPROVED';

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMovement(m)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-500 shadow-md ring-1 ring-blue-500'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <div className="font-black text-xs text-slate-900">
                      {m.heads} {m.species || 'Cattle'}
                    </div>
                    <Badge
                      className={
                        isAppr
                          ? 'bg-emerald-600 text-white text-[9px] px-1.5 py-0 font-mono'
                          : 'bg-amber-500 text-white text-[9px] px-1.5 py-0 font-mono'
                      }
                    >
                      {m.clearance_status || 'RECORDED'}
                    </Badge>
                  </div>

                  <div className="text-[11px] text-slate-600 flex items-center gap-1 py-1">
                    <MapPin className="size-3 text-emerald-700 shrink-0" />
                    <span className="truncate max-w-[100px]">{m.origin}</span>
                    <span className="text-slate-400 font-bold">→</span>
                    <span className="font-bold text-slate-800 truncate max-w-[110px]">{m.destination}</span>
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-500 pt-0.5 border-t border-slate-200/50">
                    <span className="truncate max-w-[130px]">Shipper: {m.shipper_name || 'N/A'}</span>
                    <span className="font-mono text-slate-400">{m.date}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1.5">
            <AlertCircle className="size-6 text-slate-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No movement permits matched</p>
            <p className="text-[11px] text-slate-500">
              Try adjusting your date range, status, or search query.
            </p>
            {isFiltered && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="mt-2 text-xs font-bold"
              >
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
