"use client";

import type { OverviewRecord } from "./data-overview-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cowHead } from "@lucide/lab";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Icon,
  Info,
  Layers,
  MapPin,
  Milk,
  Scale,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ActivityFeedItem,
  BarangaySummary,
  BatchRecord,
  DataTab,
} from "./data-overview-types";

interface DataOverviewOverallViewProps {
  barangaySummaries: BarangaySummary[];
  activityFeed: ActivityFeedItem[];
  batchList?: BatchRecord[];
  totalBatches?: number;
  isLoading?: boolean;
  onSelectBarangay: (barangay: string) => void;
  onNavigateTab: (tab: DataTab) => void;
  onSelectRecord?: (record: OverviewRecord, domain: DataTab) => void;
}

type FocusMode = "combined" | "matrix" | "batches" | "activity";

export function DataOverviewOverallView({
  barangaySummaries,
  activityFeed,
  batchList = [],
  totalBatches,
  onSelectBarangay,
  onNavigateTab,
  onSelectRecord,
}: DataOverviewOverallViewProps) {
  const router = useRouter();
  const [focusMode, setFocusMode] = useState<FocusMode>("combined");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // Sorting
  const [sortField, setSortField] = useState<keyof BarangaySummary>("totalLivestock");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: keyof BarangaySummary) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
    }
  };

  const sortedSummaries = useMemo(() => {
    return [...barangaySummaries].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [barangaySummaries, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedSummaries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedSummaries = sortedSummaries.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Totals calculations
  const totalHeads = barangaySummaries.reduce((sum, b) => sum + b.totalLivestock, 0);
  const totalCattle = barangaySummaries.reduce((sum, b) => sum + b.cattleCount, 0);
  const totalBatchesCount =
    totalBatches ??
    batchList.length ??
    barangaySummaries.reduce((sum, b) => sum + (b.batchCount || 0), 0);
  const totalMeat = barangaySummaries.reduce((sum, b) => sum + b.monthlyMeatKg, 0);
  const totalIncidents = barangaySummaries.reduce((sum, b) => sum + b.activeIncidents, 0);
  const totalFarmers = barangaySummaries.reduce((sum, b) => sum + b.registeredFarmers, 0);

  const handleActivityClick = (act: ActivityFeedItem) => {
    if (act.domain && act.domain !== "overall") {
      onNavigateTab(act.domain);
    }
    if (onSelectRecord) {
      const record = act.record || {
        id: act.id,
        cattleId: act.id,
        farmerName: act.actor,
        barangay: act.barangay,
        date: act.timestamp,
        title: act.title,
        notes: act.description,
        status: act.badge,
      };
      onSelectRecord(record, act.domain);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Sub-View Mode Selector ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-0.5 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
        <div className="w-full md:w-auto overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 p-1 bg-slate-50/90 rounded-full border border-slate-200/90 shadow-2xs w-max md:w-auto">
            {/* 1. Full Overview */}
            <button
              type="button"
              onClick={() => setFocusMode("combined")}
              className={`group px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 ease-out flex items-center gap-2 cursor-pointer shrink-0 border active:scale-95 select-none hover:-translate-y-0.5 hover:shadow-2xs ${
                focusMode === "combined"
                  ? "bg-[#0F4A2F] text-white border-[#0F4A2F] shadow-sm font-black ring-2 ring-[#0F4A2F]/20 scale-[1.02]"
                  : "bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <span className="text-sm shrink-0 transition-transform duration-200 group-hover:scale-120">📊</span>
              <span>Full Overview</span>
            </button>

            {/* 2. Barangay Matrix */}
            <button
              type="button"
              onClick={() => setFocusMode("matrix")}
              className={`group px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 ease-out flex items-center gap-2 cursor-pointer shrink-0 border active:scale-95 select-none hover:-translate-y-0.5 hover:shadow-2xs ${
                focusMode === "matrix"
                  ? "bg-[#0F4A2F] text-white border-[#0F4A2F] shadow-sm font-black ring-2 ring-[#0F4A2F]/20 scale-[1.02]"
                  : "bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <span className="text-sm shrink-0 transition-transform duration-200 group-hover:scale-120">🗺️</span>
              <span>Barangay Matrix</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-all duration-200 group-hover:scale-105 ${
                  focusMode === "matrix"
                    ? "bg-white/25 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {barangaySummaries.length}
              </span>
            </button>

            {/* 3. Herds */}
            <button
              type="button"
              onClick={() => setFocusMode("batches")}
              className={`group px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 ease-out flex items-center gap-2 cursor-pointer shrink-0 border active:scale-95 select-none hover:-translate-y-0.5 hover:shadow-2xs ${
                focusMode === "batches"
                  ? "bg-[#0F4A2F] text-white border-[#0F4A2F] shadow-sm font-black ring-2 ring-[#0F4A2F]/20 scale-[1.02]"
                  : "bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <span className="text-sm shrink-0 transition-transform duration-200 group-hover:scale-120">📦</span>
              <span>Herds</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-all duration-200 group-hover:scale-105 ${
                  focusMode === "batches"
                    ? "bg-white/25 text-white"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {totalBatchesCount}
              </span>
            </button>

            {/* 4. Live Surveillance */}
            <button
              type="button"
              onClick={() => setFocusMode("activity")}
              className={`group px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 ease-out flex items-center gap-2 cursor-pointer shrink-0 border active:scale-95 select-none hover:-translate-y-0.5 hover:shadow-2xs ${
                focusMode === "activity"
                  ? "bg-[#990024] text-white border-[#990024] shadow-sm font-black ring-2 ring-rose-700/25 scale-[1.02]"
                  : "bg-white text-rose-800 border-slate-200/90 hover:bg-rose-50 hover:text-rose-900 hover:border-rose-300"
              }`}
            >
              <span className="text-sm shrink-0 transition-transform duration-200 group-hover:scale-120">⚡</span>
              <span>Live Surveillance</span>
              {totalIncidents > 0 && (
                <span className="relative flex size-2">
                  <span className="size-full rounded-full bg-rose-400 animate-ping absolute opacity-75" />
                  <span className="size-full rounded-full bg-rose-500 relative inline-flex" />
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="hidden md:flex text-xs text-slate-600 font-semibold items-center gap-1.5 shrink-0">
          <Building2 className="size-3.5 text-slate-500" />
          <span>Padre Garcia Municipal Agriculture Office</span>
        </div>
      </div>

      {/* ── SECTION A: Combined (Full Overview) or Focused Matrix Mode ── */}
      {(focusMode === "combined" || focusMode === "matrix") && (
        <div key={`mode-${focusMode}`} className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both motion-reduce:animate-none">
        <div
          className={
            focusMode === "combined"
              ? "grid grid-cols-1 xl:grid-cols-12 gap-5 items-start"
              : "w-full space-y-4"
          }
        >
          {/* Main Matrix Table Column */}
          <div
            className={
              focusMode === "combined"
                ? "xl:col-span-8 space-y-4"
                : "w-full space-y-4"
            }
          >
            {/* Barangay Master Data Matrix Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xs transition-shadow duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both motion-reduce:animate-none">
              {/* Card Header */}
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-[#EAF5EC] border border-[#BEE1C6] flex items-center justify-center text-[#0F4A2F] shrink-0 transition-transform duration-300 hover:scale-110">
                    <MapPin className="size-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      Barangay Master Data Matrix
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Consolidated livestock headcount, herds, dairy yields, and active surveillance across all sectors.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EAF5EC] text-[#0F4A2F] border border-[#BEE1C6] hover:bg-[#d9eedd] transition-colors">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>✓ {barangaySummaries.length} Sectors Synchronized</span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/gis")}
                    className="h-8 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs gap-1.5 active:scale-95 transition-all duration-150 cursor-pointer"
                  >
                    <BookOpen className="size-3.5" />
                    <span>View Map</span>
                  </Button>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#EAF5EC] border-b border-[#BEE1C6]/80 hover:bg-[#EAF5EC]">
                      <TableHead
                        className="pl-4 py-2.5 text-[11px] font-black text-[#0F4A2F] uppercase tracking-wider cursor-pointer hover:underline select-none"
                        onClick={() => handleSort("barangay")}
                      >
                        BARANGAY SECTOR
                      </TableHead>
                      <TableHead
                        className="px-3 py-2.5 text-[11px] font-black text-[#0F4A2F] uppercase tracking-wider text-center cursor-pointer hover:underline select-none"
                        onClick={() => handleSort("totalLivestock")}
                      >
                        TOTAL HEADS
                      </TableHead>
                      <TableHead
                        className="px-3 py-2.5 text-[11px] font-black text-[#0F4A2F] uppercase tracking-wider text-center cursor-pointer hover:underline select-none"
                        onClick={() => handleSort("cattleCount")}
                      >
                        CATTLE
                      </TableHead>
                      <TableHead className="px-3 py-2.5 text-[11px] font-black text-[#0F4A2F] uppercase tracking-wider text-center select-none">
                        OTHER SPECIES
                      </TableHead>
                      <TableHead
                        className="px-3 py-2.5 text-[11px] font-black text-[#0F4A2F] uppercase tracking-wider text-center cursor-pointer hover:underline select-none"
                        onClick={() => handleSort("batchCount")}
                      >
                        BATCHES
                      </TableHead>
                      <TableHead className="px-3 py-2.5 text-[11px] font-black text-[#0F4A2F] uppercase tracking-wider text-center select-none">
                        FARMER MILK LOGS
                      </TableHead>
                      <TableHead className="pr-4 py-2.5 text-[11px] font-black text-[#0F4A2F] uppercase tracking-wider text-center select-none">
                        ACTIONS
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {paginatedSummaries.map((b) => (
                      <TableRow
                        key={b.barangay}
                        className="group hover:bg-emerald-50/40 transition-colors duration-200 cursor-default"
                      >
                        <TableCell className="pl-4 py-3 font-bold text-xs text-slate-900">
                          <div className="flex items-center gap-2">
                            <MapPin className="size-4 text-emerald-600 shrink-0 group-hover:scale-125 transition-transform duration-200" />
                            <span className="group-hover:text-emerald-950 transition-colors">Brgy. {b.barangay}</span>
                          </div>
                        </TableCell>

                        <TableCell className="px-3 py-3 text-center font-bold text-xs text-slate-900">
                          {b.totalLivestock.toLocaleString()}
                        </TableCell>

                        <TableCell className="px-3 py-3 text-center font-bold text-xs text-slate-900">
                          {b.cattleCount.toLocaleString()}
                        </TableCell>

                        <TableCell className="px-3 py-3 text-center text-xs text-slate-600 font-semibold">
                          {Math.max(0, b.totalLivestock - b.cattleCount).toLocaleString()}
                        </TableCell>

                        <TableCell className="px-3 py-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EAF5EC] text-[#0F4A2F] group-hover:bg-[#d9eedd] transition-colors">
                            {b.batchCount || 0} batches
                          </span>
                        </TableCell>

                        <TableCell className="px-3 py-3 text-center text-xs font-semibold text-[#1E6091]">
                          Private to farmer accounts
                        </TableCell>

                        <TableCell className="pr-4 py-3 text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onSelectBarangay(b.barangay);
                              onNavigateTab("livestock");
                            }}
                            className="h-7 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 shadow-2xs gap-1.5 active:scale-95 transition-all duration-150 cursor-pointer"
                          >
                            <Eye className="size-3.5 text-slate-500 group-hover:text-slate-700" />
                            <span>View</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Matrix Footer with Pagination */}
              <div className="p-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                <p className="text-xs text-slate-500 font-medium">
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedSummaries.length)} of {sortedSummaries.length} barangays
                </p>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="size-7 p-0 rounded-lg border-slate-200 active:scale-90 transition-transform duration-150 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setPage(pageNum)}
                          className={`size-7 rounded-lg text-xs font-bold transition-all duration-150 active:scale-90 cursor-pointer ${
                            currentPage === pageNum
                              ? "bg-[#0F4A2F] text-white shadow-2xs scale-105"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (
                      pageNum === currentPage - 2 ||
                      pageNum === currentPage + 2
                    ) {
                      return (
                        <span key={pageNum} className="text-xs text-slate-400 px-0.5">
                          …
                        </span>
                      );
                    }
                    return null;
                  })}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="size-7 p-0 rounded-lg border-slate-200 active:scale-90 transition-transform duration-150 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Municipality Grand Totals Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow duration-300 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-250 fill-mode-both motion-reduce:animate-none">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                <Info className="size-4 text-slate-500" />
                <span>Municipality Grand Totals</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                {/* 1. Total Heads */}
                <div className="group flex items-center gap-2.5 sm:px-2 pt-2 sm:pt-0 hover:bg-slate-50/80 rounded-xl p-1 transition-all duration-200 cursor-default">
                  <div className="size-8 rounded-lg bg-[#EAF5EC] border border-[#BEE1C6] text-[#0F4A2F] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                    <Icon iconNode={cowHead} className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">Total Heads</p>
                    <p className="text-base font-black text-slate-900 leading-tight">{totalHeads.toLocaleString()}</p>
                  </div>
                </div>

                {/* 2. Cattle */}
                <div className="group flex items-center gap-2.5 sm:px-2 pt-2 sm:pt-0 hover:bg-slate-50/80 rounded-xl p-1 transition-all duration-200 cursor-default">
                  <div className="size-8 rounded-lg bg-[#EAF5EC] border border-[#BEE1C6] text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                    <Icon iconNode={cowHead} className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">Cattle</p>
                    <p className="text-base font-black text-emerald-800 leading-tight">{totalCattle.toLocaleString()}</p>
                  </div>
                </div>

                {/* 3. Batches */}
                <div className="group flex items-center gap-2.5 sm:px-2 pt-2 sm:pt-0 hover:bg-slate-50/80 rounded-xl p-1 transition-all duration-200 cursor-default">
                  <div className="size-8 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                    <Layers className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">Batches</p>
                    <p className="text-base font-black text-sky-800 leading-tight">{totalBatchesCount.toLocaleString()}</p>
                  </div>
                </div>

                {/* 4. Farmer Milk Logs */}
                <div className="group flex items-center gap-2.5 sm:px-2 pt-2 sm:pt-0 hover:bg-slate-50/80 rounded-xl p-1 transition-all duration-200 cursor-default">
                  <div className="size-8 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                    <Milk className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">Farmer Milk Logs</p>
                    <p className="text-base font-black text-sky-700 leading-tight">Private</p>
                  </div>
                </div>

                {/* 5. Incidents */}
                <div className="group flex items-center gap-2.5 sm:px-2 pt-2 sm:pt-0 hover:bg-slate-50/80 rounded-xl p-1 transition-all duration-200 cursor-default">
                  <div className="size-8 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">Incidents</p>
                    <p className="text-base font-black text-rose-600 leading-tight">{totalIncidents.toLocaleString()}</p>
                  </div>
                </div>

                {/* 6. Raisers */}
                <div className="group flex items-center gap-2.5 sm:px-2 pt-2 sm:pt-0 hover:bg-slate-50/80 rounded-xl p-1 transition-all duration-200 cursor-default">
                  <div className="size-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200">
                    <Users className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">Raisers</p>
                    <p className="text-base font-black text-slate-900 leading-tight">{totalFarmers.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Rendered only in 'combined' mode) */}
          {focusMode === "combined" && (
            <div className="xl:col-span-4 space-y-4">
              {/* 1. Municipal Biosecurity Status */}
              <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-md transition-shadow duration-300 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both motion-reduce:animate-none">
                <div className="bg-[#0F4A2F] text-white p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-lg bg-white/10 text-emerald-300 flex items-center justify-center shrink-0">
                      <ShieldCheck className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-white leading-tight truncate">
                        Municipal Biosecurity Status
                      </h4>
                      <p className="text-[11px] text-emerald-100/90 mt-0.5 font-medium truncate">
                        Padre Garcia Livestock Territory — Disease reports awaiting review.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-emerald-200 border border-white/20 shrink-0">
                    <span className="relative flex size-2 shrink-0">
                      <span className="size-full rounded-full bg-emerald-400 animate-ping absolute opacity-75" />
                      <span className="size-full rounded-full bg-emerald-400 relative inline-flex" />
                    </span>
                    <span>Live</span>
                  </span>
                </div>

                <div className="p-4 space-y-3 divide-y divide-slate-100">
                  <div className="flex items-center justify-between pt-1 first:pt-0 hover:bg-slate-50/80 px-2 py-1 -mx-2 rounded-xl transition-colors duration-150">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      <span>Approved Raisers</span>
                    </div>
                    <span className="text-xs font-black text-slate-900">{totalFarmers.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between pt-3 hover:bg-slate-50/80 px-2 py-1 -mx-2 rounded-xl transition-colors duration-150">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                      <span>Reports Awaiting Review</span>
                    </div>
                    <span className="text-xs font-bold text-amber-600">
                      {totalIncidents > 0 ? `${totalIncidents} pending` : "0 pending"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 hover:bg-slate-50/80 px-2 py-1 -mx-2 rounded-xl transition-colors duration-150">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <ShieldCheck className="size-4 text-sky-600 shrink-0" />
                      <span>Approved Meat This Month</span>
                    </div>
                    <span className="text-xs font-bold text-sky-700">{totalMeat.toLocaleString()} kg</span>
                  </div>
                </div>
              </div>

              {/* 2. Active Herds & Group Pens */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:shadow-md transition-shadow duration-300 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both motion-reduce:animate-none">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-[#EAF5EC] border border-[#BEE1C6] text-[#0F4A2F] flex items-center justify-center shrink-0">
                      <Users className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 leading-tight">
                        Active Herds & Group Pens
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {totalBatchesCount} monitored feeding herds in municipality
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFocusMode("batches")}
                    className="group text-xs font-bold text-[#0F4A2F] hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
                  >
                    <span>All Batches</span>
                    <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
                  </button>
                </div>

                <div className="space-y-2">
                  {(batchList && batchList.length > 0
                    ? batchList.slice(0, 3)
                    : [
                        { id: "1", batchName: "Alexa", batchCode: "BAT-1", barangay: "Manggas", housingPen: "Pen 4", totalAnimals: 2 },
                        { id: "2", batchName: "Sheep Cohort #863", batchCode: "BAT-2", barangay: "Tangob", housingPen: "Pen 3", totalAnimals: 3 },
                        { id: "3", batchName: "Cattle Cohort #300", batchCode: "BAT-3", barangay: "Tangob", housingPen: "Pen 4", totalAnimals: 10 },
                      ]
                  ).map((batch) => (
                    <div
                      key={batch.id}
                      className="group p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-emerald-50/40 hover:border-emerald-200/80 hover:translate-x-1 hover:shadow-2xs transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-950 transition-colors">
                          {batch.batchName || batch.batchCode || `Herd #${batch.id}`}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Brgy. {batch.barangay} • {batch.housingPen || "General Pen"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EAF5EC] text-[#0F4A2F] group-hover:bg-[#d9eedd] transition-colors">
                          {batch.totalAnimals || 0} Heads
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateTab("batches");
                            if (onSelectRecord) onSelectRecord(batch as any, "batches");
                          }}
                          className="h-7 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 shadow-2xs gap-1 active:scale-95 transition-all duration-150 cursor-pointer"
                        >
                          <Eye className="size-3 text-slate-500" />
                          <span>View</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Recent Activity Stream */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:shadow-md transition-shadow duration-300 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400 fill-mode-both motion-reduce:animate-none">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Activity className="size-4 text-emerald-600" />
                    <span>Recent Activity Stream</span>
                  </h4>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                    <span className="relative flex size-2 shrink-0">
                      <span className="size-full rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
                      <span className="size-full rounded-full bg-emerald-500 relative inline-flex" />
                    </span>
                    <span>Live</span>
                  </span>
                </div>

                <div className="space-y-2.5">
                  {activityFeed.slice(0, 3).map((act) => (
                    <div
                      key={act.id}
                      onClick={() => handleActivityClick(act)}
                      className="group flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-emerald-50/40 hover:border-emerald-200/80 hover:translate-x-1 hover:shadow-2xs transition-all duration-200 cursor-pointer"
                    >
                      <div
                        className={`size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-200 ${
                          act.domain === "mortality" || act.domain === "disease"
                            ? "bg-rose-50 text-rose-600 border border-rose-200"
                            : act.domain === "slaughter"
                            ? "bg-amber-50 text-amber-600 border border-amber-200"
                            : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        }`}
                      >
                        {act.domain === "mortality" || act.domain === "disease" ? (
                          <AlertTriangle className="size-4" />
                        ) : act.domain === "slaughter" ? (
                          <Scale className="size-4" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-950 transition-colors">
                            {act.title}
                          </p>
                          <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                            {act.timestamp}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                          {act.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                          <span className="text-slate-500 font-medium">
                            Brgy. {act.barangay}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-bold transition-all ${
                              act.badgeVariant === "rose" ||
                              act.badge.toLowerCase().includes("pending") ||
                              act.badge.toLowerCase().includes("active")
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {act.badge}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {/* ── SECTION B: Herds Focus Mode ── */}
      {focusMode === "batches" && (
        <div className="space-y-4 animate-in fade-in-50 duration-200">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Boxes className="size-5 text-[#0F4A2F]" />
                <span>Municipal Herd Register & Housing Pens</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Comprehensive directory of animal lots, pen allocations, vaccination clearances, and digital biosecurity passes.
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => onNavigateTab("batches")}
              className="bg-[#0F4A2F] hover:bg-[#0B3D26] text-white font-bold text-xs rounded-xl h-8 px-3 gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
            >
              <span>Open Batches Workspace</span>
              <ExternalLink className="size-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {batchList.map((batch) => (
              <Card
                key={batch.id}
                onClick={() => {
                  onNavigateTab("batches");
                  if (onSelectRecord) onSelectRecord(batch, "batches");
                }}
                className="rounded-2xl border border-slate-200/90 bg-white hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer group overflow-hidden"
              >
                <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-white">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider block">
                      {batch.batchCode}
                    </span>
                    <h4 className="text-sm font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {batch.batchName || batch.batchCode}
                    </h4>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs font-black px-2 py-0.5">
                    {batch.totalAnimals} Heads
                  </Badge>
                </div>

                <CardContent className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Registered Raiser</span>
                    <span className="font-bold text-slate-800">{batch.farmerName}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Origin Sector</span>
                    <span className="font-bold text-emerald-800">Brgy. {batch.barangay}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Housing & Pen</span>
                    <span className="font-semibold text-slate-700">
                      {batch.housingPen || "General Pen"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-400">Specie</span>
                    <span className="font-mono font-black text-slate-700">{batch.specie}</span>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px] text-[#0F4A2F] font-bold">
                    <span>Manage Herd Roster</span>
                    <ChevronRight className="size-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION C: Live Activity & Biosecurity Full-Width Focus Mode ── */}
      {focusMode === "activity" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-in fade-in-50 duration-200 items-start">
          {/* Biosecurity Executive Scorecard (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
              <div className="p-4 bg-[#0F4A2F] text-white">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-widest uppercase text-emerald-300">
                    Municipal Biosecurity Status
                  </span>
                  <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[10px] font-bold px-2 py-0.5">
                    Review Queue
                  </Badge>
                </div>
                <p className="text-2xl font-black mt-2">{totalHeads.toLocaleString()} Current Heads</p>
                <p className="text-xs text-emerald-100/80 mt-0.5">
                  Padre Garcia Livestock Territory — Disease reports awaiting review
                </p>
              </div>

              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Approved Raisers
                      </span>
                      <span className="text-[10px] text-slate-400">Verified MAO farmers</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-900">{totalFarmers.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Pending Disease Audits
                      </span>
                      <span className="text-[10px] text-slate-400">Surveillance records</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-amber-700">
                    {totalIncidents > 0 ? `${totalIncidents} pending` : "None pending"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="size-4 text-sky-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Approved Meat Cleared
                      </span>
                      <span className="text-[10px] text-slate-400">Padre Garcia slaughterhouse</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-sky-800">{totalMeat.toLocaleString()} kg</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Full Activity Feed (8 Cols) */}
          <div className="lg:col-span-8">
            <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
                    <Activity className="size-4 text-[#0F4A2F]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Real-Time Operational Audit Feed
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Live submissions from farmers, inspectors, auctions, and health officers.
                    </p>
                  </div>
                </div>

                <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs font-mono font-bold">
                  {activityFeed.length} Events
                </Badge>
              </div>

              <CardContent className="p-4 space-y-2.5 max-h-[600px] overflow-y-auto pr-2">
                {activityFeed.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <Activity className="size-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No operational activities recorded yet</p>
                  </div>
                ) : (
                  activityFeed.map((act) => (
                    <div
                      key={act.id}
                      onClick={() => handleActivityClick(act)}
                      className="p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all cursor-pointer flex items-start gap-3 group shadow-2xs hover:shadow-xs"
                      title={`Inspect ${act.title} details`}
                    >
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0 group-hover:bg-emerald-100 group-hover:text-emerald-800 transition-colors">
                        {act.domain === "production" && <Milk className="size-4 text-sky-600" />}
                        {act.domain === "batches" && <Boxes className="size-4 text-[#0F4A2F]" />}
                        {act.domain === "sales" && <ArrowUpRight className="size-4 text-emerald-600" />}
                        {act.domain === "disease" && <AlertTriangle className="size-4 text-rose-600" />}
                        {act.domain === "mortality" && <AlertTriangle className="size-4 text-rose-600" />}
                        {act.domain === "livestock" && <Icon iconNode={cowHead} className="size-4 text-emerald-700" />}
                        {act.domain === "slaughter" && <Scale className="size-4 text-amber-600" />}
                        {act.domain === "census" && <Layers className="size-4 text-indigo-600" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#0F4A2F] transition-colors truncate">
                            {act.title}
                          </h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-mono text-slate-400">
                              {act.timestamp}
                            </span>
                            <Eye className="size-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{act.description}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs">
                          <span className="text-[11px] font-semibold text-slate-500">
                            Brgy. {act.barangay}
                          </span>
                          <span className="text-slate-300">•</span>
                          <Badge
                            className={`text-[10px] font-bold px-2 py-0.2 border-0 ${
                              act.badgeVariant === "emerald"
                                ? "bg-emerald-100 text-emerald-800"
                                : act.badgeVariant === "sky"
                                ? "bg-sky-100 text-sky-800"
                                : act.badgeVariant === "rose"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {act.badge}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
