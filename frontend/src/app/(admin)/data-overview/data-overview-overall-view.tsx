"use client";

import React, { useState } from "react";
import {
  BarangaySummary,
  ActivityFeedItem,
  DataTab,
  BatchRecord,
} from "./data-overview-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MapPin,
  Sparkles,
  Layers,
  Milk,
  Scale,
  AlertTriangle,
  Users,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronDown,
  Calendar,
  Boxes,
  LayoutDashboard,
  Eye,
  Building2,
  ExternalLink,
} from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import Link from "next/link";

interface DataOverviewOverallViewProps {
  barangaySummaries: BarangaySummary[];
  activityFeed: ActivityFeedItem[];
  batchList?: BatchRecord[];
  totalBatches?: number;
  isLoading?: boolean;
  onSelectBarangay: (barangay: string) => void;
  onNavigateTab: (tab: DataTab) => void;
}

type FocusMode = "combined" | "matrix" | "batches" | "activity";

export function DataOverviewOverallView({
  barangaySummaries,
  activityFeed,
  batchList = [],
  totalBatches,
  isLoading = false,
  onSelectBarangay,
  onNavigateTab,
}: DataOverviewOverallViewProps) {
  const [focusMode, setFocusMode] = useState<FocusMode>("combined");
  const [sortField, setSortField] = useState<keyof BarangaySummary>("totalLivestock");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: keyof BarangaySummary) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
    }
  };

  const sortedSummaries = [...barangaySummaries].sort((a, b) => {
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

  // Calculate totals
  const totalHeads = barangaySummaries.reduce((sum, b) => sum + b.totalLivestock, 0);
  const totalCattle = barangaySummaries.reduce((sum, b) => sum + b.cattleCount, 0);
  const totalCarabao = barangaySummaries.reduce((sum, b) => sum + b.carabaoCount, 0);
  const totalSwine = barangaySummaries.reduce((sum, b) => sum + b.swineCount, 0);
  const totalGoats = barangaySummaries.reduce((sum, b) => sum + b.goatCount, 0);
  const totalMilk = barangaySummaries.reduce((sum, b) => sum + b.monthlyMilkLiters, 0);
  const totalMeat = barangaySummaries.reduce((sum, b) => sum + b.monthlyMeatKg, 0);
  const totalIncidents = barangaySummaries.reduce((sum, b) => sum + b.activeIncidents, 0);
  const totalFarmers = barangaySummaries.reduce((sum, b) => sum + b.registeredFarmers, 0);

  const totalBatchesCount =
    totalBatches ??
    batchList.length ??
    barangaySummaries.reduce((sum, b) => sum + (b.batchCount || 0), 0);
  const totalBatchAnimals = batchList.reduce((sum, b) => sum + (b.totalAnimals || 0), 0);

  return (
    <div className="space-y-3.5">
      {/* ── Sub-View Mode Selector ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-0.5">
        <div className="w-full md:w-auto overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-2xs w-max md:w-auto">
            <button
              type="button"
              onClick={() => setFocusMode("combined")}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 border ${
                focusMode === "combined"
                  ? "bg-[#2D5A27] text-white border-[#2D5A27] shadow-xs font-black ring-2 ring-[#2D5A27]/20"
                  : "bg-white/80 text-slate-700 border-slate-200/70 hover:bg-white hover:text-slate-900"
              }`}
            >
              <span className="text-sm shrink-0">📊</span>
              <span>Full Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setFocusMode("matrix")}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 border ${
                focusMode === "matrix"
                  ? "bg-emerald-700 text-white border-emerald-700 shadow-xs font-black ring-2 ring-emerald-700/20"
                  : "bg-white/80 text-slate-700 border-slate-200/70 hover:bg-white hover:text-slate-900"
              }`}
            >
              <span className="text-sm shrink-0">🗺️</span>
              <span>Barangay Matrix</span>
              <Badge
                variant="secondary"
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border-0 transition-colors ${
                  focusMode === "matrix"
                    ? "bg-white/25 text-white font-black"
                    : "bg-slate-200/80 text-slate-700"
                }`}
              >
                {barangaySummaries.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setFocusMode("batches")}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 border ${
                focusMode === "batches"
                  ? "bg-[#2D5A27] text-white border-[#2D5A27] shadow-xs font-black ring-2 ring-[#2D5A27]/20"
                  : "bg-white/80 text-slate-700 border-slate-200/70 hover:bg-white hover:text-slate-900"
              }`}
            >
              <span className="text-sm shrink-0">📦</span>
              <span>Cohort Batches</span>
              <Badge
                variant="secondary"
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border-0 transition-colors ${
                  focusMode === "batches"
                    ? "bg-white/25 text-white font-black"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {totalBatchesCount}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setFocusMode("activity")}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 border ${
                focusMode === "activity"
                  ? "bg-rose-700 text-white border-rose-700 shadow-xs font-black ring-2 ring-rose-700/20"
                  : "bg-white/80 text-slate-700 border-slate-200/70 hover:bg-white hover:text-slate-900"
              }`}
            >
              <span className="text-sm shrink-0">⚡</span>
              <span>Live Surveillance</span>
              {totalIncidents > 0 && (
                <span className="size-2 rounded-full bg-rose-400 animate-ping" />
              )}
            </button>
          </div>
        </div>

        <div className="hidden md:flex text-xs text-slate-600 font-semibold items-center gap-1.5 shrink-0">
          <Building2 className="size-3.5 text-slate-500" />
          <span>Padre Garcia Municipal Agriculture Office</span>
        </div>
      </div>

      {/* ── Specie & Cohort Breakdown Grid (Visible in Combined, Matrix, and Batches) ── */}
      {focusMode !== "activity" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {/* 1. Cattle Breakdown */}
          <Card
            onClick={() => onNavigateTab("livestock")}
            className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-all cursor-pointer group hover:border-emerald-300"
          >
            <CardContent className="p-3 sm:p-3.5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200 transition-colors">
                  <Icon iconNode={cowHead} className="size-3.5" />
                </div>
                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-extrabold px-1.5 py-0.2">
                  {Math.round((totalCattle / (totalHeads || 1)) * 100)}% of total
                </Badge>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                  {totalCattle.toLocaleString()}
                </p>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 flex items-center justify-between">
                  <span>Cattle (Bovine)</span>
                  <ChevronRight className="size-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 2. Carabao Breakdown */}
          <Card
            onClick={() => onNavigateTab("livestock")}
            className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-all cursor-pointer group hover:border-blue-300"
          >
            <CardContent className="p-3 sm:p-3.5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-800 group-hover:bg-blue-200 transition-colors">
                  <Layers className="size-3.5" />
                </div>
                <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-extrabold px-1.5 py-0.2">
                  {Math.round((totalCarabao / (totalHeads || 1)) * 100)}% of total
                </Badge>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-blue-700 transition-colors">
                  {totalCarabao.toLocaleString()}
                </p>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 flex items-center justify-between">
                  <span>Carabao (Bubaline)</span>
                  <ChevronRight className="size-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3. Swine Breakdown */}
          <Card
            onClick={() => onNavigateTab("livestock")}
            className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-all cursor-pointer group hover:border-amber-300"
          >
            <CardContent className="p-3 sm:p-3.5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-2">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 group-hover:bg-amber-200 transition-colors">
                  <Scale className="size-3.5" />
                </div>
                <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-extrabold px-1.5 py-0.2">
                  {Math.round((totalSwine / (totalHeads || 1)) * 100)}% of total
                </Badge>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-amber-700 transition-colors">
                  {totalSwine.toLocaleString()}
                </p>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 flex items-center justify-between">
                  <span>Swine (Porcine)</span>
                  <ChevronRight className="size-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 4. Goat & Small Ruminants */}
          <Card
            onClick={() => onNavigateTab("livestock")}
            className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-all cursor-pointer group hover:border-emerald-300"
          >
            <CardContent className="p-3 sm:p-3.5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200 transition-colors">
                  <Users className="size-3.5" />
                </div>
                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-extrabold px-1.5 py-0.2">
                  {Math.round((totalGoats / (totalHeads || 1)) * 100)}% of total
                </Badge>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                  {totalGoats.toLocaleString()}
                </p>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 flex items-center justify-between">
                  <span>Goat & Sheep</span>
                  <ChevronRight className="size-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 5. Cohort Batches & Pens */}
          <Card
            onClick={() => onNavigateTab("batches")}
            className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 to-white shadow-2xs hover:shadow-xs transition-all cursor-pointer group hover:border-emerald-300"
          >
            <CardContent className="p-3 sm:p-3.5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200 transition-colors">
                  <Boxes className="size-3.5 text-[#2D5A27]" />
                </div>
                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-extrabold px-1.5 py-0.2 group-hover:bg-emerald-100 transition-colors">
                  {totalBatchAnimals > 0 ? `${totalBatchAnimals} heads` : "Active"}
                </Badge>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                  {totalBatchesCount.toLocaleString()}
                </p>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 flex items-center justify-between">
                  <span>Cohorts & Batches</span>
                  <ChevronRight className="size-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SECTION A: Barangay Master Matrix (Rendered in 'combined' or 'matrix' mode) ── */}
      {(focusMode === "combined" || focusMode === "matrix") && (
        <div
          className={
            focusMode === "combined"
              ? "grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start"
              : "w-full"
          }
        >
          {/* Main Matrix Table */}
          <div
            className={
              focusMode === "combined"
                ? "xl:col-span-8 space-y-3"
                : "w-full space-y-3"
            }
          >
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
              {/* Header */}
              <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-slate-50/80 to-white">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#2D5A27]" />
                    Padre Garcia 18-Barangay Master Data Matrix
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Consolidated livestock headcount, cohort batches, dairy yields, and active surveillance across all sectors.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="bg-emerald-100 text-emerald-900 border-0 text-[10px] font-bold px-2 py-0.5">
                    {barangaySummaries.length} Sectors Synchronized
                  </Badge>
                  {focusMode === "combined" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setFocusMode("matrix")}
                      className="h-7 px-2 text-xs font-bold text-slate-600 hover:text-slate-900 gap-1"
                      title="Focus on Matrix"
                    >
                      <Eye className="size-3" />
                      <span className="hidden sm:inline">Focus View</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70 border-b border-slate-200/60 hover:bg-slate-50/70">
                      <TableHead
                        className="px-3.5 py-2.5 text-[11px] font-black text-slate-600 uppercase tracking-wider cursor-pointer hover:text-slate-900"
                        onClick={() => handleSort("barangay")}
                      >
                        Barangay Sector
                      </TableHead>
                      <TableHead
                        className="px-3 py-2.5 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right cursor-pointer hover:text-slate-900"
                        onClick={() => handleSort("totalLivestock")}
                      >
                        Total Heads
                      </TableHead>
                      <TableHead
                        className="px-3 py-2.5 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right cursor-pointer hover:text-slate-900"
                        onClick={() => handleSort("cattleCount")}
                      >
                        Cattle
                      </TableHead>
                      <TableHead
                        className="px-3 py-2.5 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right cursor-pointer hover:text-slate-900"
                        onClick={() => handleSort("batchCount")}
                      >
                        Batches
                      </TableHead>
                      <TableHead
                        className="px-3 py-2.5 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right cursor-pointer hover:text-slate-900"
                        onClick={() => handleSort("monthlyMilkLiters")}
                      >
                        Milk (L/mo)
                      </TableHead>
                      <TableHead
                        className="px-3 py-2.5 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right cursor-pointer hover:text-slate-900"
                        onClick={() => handleSort("activeIncidents")}
                      >
                        Alerts
                      </TableHead>
                      <TableHead
                        className="px-3 py-2.5 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right cursor-pointer hover:text-slate-900"
                        onClick={() => handleSort("registeredFarmers")}
                      >
                        Raisers
                      </TableHead>
                      <TableHead className="px-3 py-2.5 text-[11px] font-black text-slate-600 uppercase tracking-wider text-center">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100">
                    {sortedSummaries.map((b) => (
                      <TableRow
                        key={b.barangay}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => onSelectBarangay(b.barangay)}
                      >
                        <TableCell className="px-3.5 py-2 font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#2D5A27] shrink-0" />
                          <span>Brgy. {b.barangay}</span>
                          {b.activeIncidents > 0 && (
                            <span
                              className="size-1.5 rounded-full bg-rose-500 shrink-0 animate-ping"
                              title="Active biosecurity alert"
                            />
                          )}
                        </TableCell>

                        <TableCell className="px-3 py-2 text-right font-black text-xs text-slate-900">
                          {b.totalLivestock.toLocaleString()}
                        </TableCell>

                        <TableCell className="px-3 py-2 text-right font-semibold text-xs text-emerald-800">
                          {b.cattleCount.toLocaleString()}
                        </TableCell>

                        {/* Batches in Sector */}
                        <TableCell className="px-3 py-2 text-right">
                          {(b.batchCount || 0) > 0 ? (
                            <Badge
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectBarangay(b.barangay);
                                onNavigateTab("batches");
                              }}
                              className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold px-1.5 py-0.2 hover:bg-emerald-100 cursor-pointer transition-colors"
                              title="View cohort batches in this sector"
                            >
                              {b.batchCount} {b.batchCount === 1 ? "batch" : "batches"}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs font-semibold">0</span>
                          )}
                        </TableCell>

                        <TableCell className="px-3 py-2 text-right font-semibold text-xs text-sky-800">
                          {b.monthlyMilkLiters.toLocaleString()} L
                        </TableCell>

                        <TableCell className="px-3 py-2 text-right">
                          {b.activeIncidents > 0 ? (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] font-bold px-1.5 py-0.2">
                              {b.activeIncidents} Active
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs font-semibold">0</span>
                          )}
                        </TableCell>

                        <TableCell className="px-3 py-2 text-right font-semibold text-xs text-slate-700">
                          {b.registeredFarmers}
                        </TableCell>

                        <TableCell className="px-3 py-2 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBarangay(b.barangay);
                              onNavigateTab("livestock");
                            }}
                            className="h-7 px-2 text-xs font-bold text-[#2D5A27] hover:bg-emerald-50 rounded-lg gap-0.5"
                          >
                            <span>Explore</span>
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Matrix Footer Grand Totals */}
              <div className="p-3 bg-slate-50/90 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">
                  Municipality Grand Totals:
                </div>
                <div className="flex flex-wrap items-center gap-3 font-black text-xs text-slate-900">
                  <span>Total: {totalHeads.toLocaleString()} heads</span>
                  <span>•</span>
                  <span className="text-emerald-700">Cattle: {totalCattle.toLocaleString()}</span>
                  <span>•</span>
                  <span className="text-emerald-800">Batches: {totalBatchesCount}</span>
                  <span>•</span>
                  <span className="text-sky-700">Milk: {totalMilk.toLocaleString()} L</span>
                  <span>•</span>
                  <span className="text-rose-700">Incidents: {totalIncidents}</span>
                  <span>•</span>
                  <span>Raisers: {totalFarmers}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right 4 Columns in Combined Mode */}
          {focusMode === "combined" && (
            <div className="xl:col-span-4 space-y-3.5">
              {/* Active Cohorts & Group Pens Snapshot */}
              {batchList && batchList.length > 0 && (
                <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/80 to-white">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                        <Boxes className="w-3.5 h-3.5 text-[#2D5A27]" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900">
                          Active Cohorts & Group Pens
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {batchList.length} monitored feeding cohorts in municipality
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onNavigateTab("batches")}
                      className="h-7 px-2 text-xs font-bold text-[#2D5A27] hover:bg-emerald-100 rounded-lg gap-0.5"
                    >
                      <span>All Batches</span>
                      <ChevronRight className="size-3" />
                    </Button>
                  </div>

                  <div className="p-3 space-y-2">
                    {batchList.slice(0, 4).map((batch) => (
                      <div
                        key={batch.id}
                        onClick={() => onNavigateTab("batches")}
                        className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all cursor-pointer group flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-800 transition-colors">
                            {batch.batchName || batch.batchCode}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-slate-700">
                              Brgy. {batch.barangay}
                            </span>
                            <span>•</span>
                            <span className="text-slate-400">
                              {batch.housingPen || "General Pen"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 gap-1">
                          <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] font-black px-1.5 py-0.2">
                            {batch.totalAnimals || 0} Heads
                          </Badge>
                          <span className="text-[10px] font-mono text-slate-400">
                            {batch.specie}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Biosecurity & Sector Health Scorecard */}
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
                <div className="p-3.5 sm:p-4 bg-gradient-to-br from-emerald-900 to-[#1E3D1A] text-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black tracking-widest uppercase text-emerald-200">
                      Municipal Biosecurity Status
                    </span>
                    <Badge className="bg-white/20 text-white border-white/20 text-[9px] px-1.5 py-0.2">
                      Live
                    </Badge>
                  </div>
                  <p className="text-xl font-black mt-1.5">98.4% Safe Index</p>
                  <p className="text-[11px] text-emerald-100/80 mt-0.5">
                    Padre Garcia Livestock Territory — Low Epidemic Risk
                  </p>
                </div>

                <CardContent className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700">
                        Vaccination Coverage
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-900">94.2%</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700">
                        Quarantined Sectors
                      </span>
                    </div>
                    <span className="text-xs font-black text-amber-700">
                      {totalIncidents > 0 ? `${totalIncidents} active` : "0 (Clear)"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700">
                        Slaughter Clearances
                      </span>
                    </div>
                    <span className="text-xs font-black text-sky-800">100% Inspected</span>
                  </div>
                </CardContent>
              </Card>

              {/* Cross-Domain Real-Time Activity Feed */}
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden flex flex-col">
                <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#2D5A27]" />
                    Recent Activity Stream
                  </h4>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <Badge variant="outline" className="text-[9px] font-bold text-slate-500 px-1.5 py-0.2">
                      Live
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-3 space-y-2 max-h-[460px] overflow-y-auto pr-1.5 [scrollbar-width:thin] scrollbar-thin scrollbar-thumb-slate-200">
                  {activityFeed.slice(0, 10).map((act) => (
                    <div
                      key={act.id}
                      onClick={() => onNavigateTab(act.domain)}
                      className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50/80 transition-colors border border-transparent hover:border-slate-100 cursor-pointer group"
                    >
                      <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5 group-hover:bg-slate-200 transition-colors">
                        {act.domain === "production" && <Milk className="w-3.5 h-3.5 text-sky-600" />}
                        {act.domain === "batches" && <Boxes className="w-3.5 h-3.5 text-[#2D5A27]" />}
                        {act.domain === "sales" && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />}
                        {act.domain === "disease" && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                        {act.domain === "mortality" && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                        {act.domain === "livestock" && <Icon iconNode={cowHead} className="w-3.5 h-3.5 text-emerald-700" />}
                        {act.domain === "slaughter" && <Scale className="w-3.5 h-3.5 text-amber-600" />}
                        {act.domain === "census" && <Layers className="w-3.5 h-3.5 text-indigo-600" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                            {act.title}
                          </p>
                          <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                            {act.timestamp}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {act.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-bold text-slate-400">
                            Brgy. {act.barangay}
                          </span>
                          <span className="text-slate-300">•</span>
                          <Badge
                            className={`text-[9px] font-extrabold px-1.5 py-0.2 border-0 ${
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
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION B: Cohort Batches Master Focus Mode ── */}
      {focusMode === "batches" && (
        <div className="space-y-3.5 animate-in fade-in-50 duration-200">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Boxes className="size-5 text-[#2D5A27]" />
                <span>Municipal Cohort Batches & Housing Pens Master</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Comprehensive directory of animal lots, pen allocations, vaccination clearances, and digital biosecurity passes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onNavigateTab("batches")}
                className="bg-[#2D5A27] hover:bg-[#205225] text-white font-bold text-xs rounded-xl h-8 px-3 gap-1.5"
              >
                <span>Open Batches Workspace</span>
                <ExternalLink className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {batchList.map((batch) => (
              <Card
                key={batch.id}
                onClick={() => onNavigateTab("batches")}
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

                  <div className="pt-2 flex items-center justify-between text-[11px] text-[#2D5A27] font-bold">
                    <span>Manage Cohort Roster</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 animate-in fade-in-50 duration-200 items-start">
          {/* Biosecurity Executive Scorecard (4 Cols) */}
          <div className="lg:col-span-4 space-y-3.5">
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
              <div className="p-4 bg-gradient-to-br from-emerald-950 via-[#1E3D1A] to-slate-900 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-widest uppercase text-emerald-300">
                    Municipal Biosecurity Status
                  </span>
                  <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[10px] font-bold px-2 py-0.5">
                    All Clear
                  </Badge>
                </div>
                <p className="text-2xl font-black mt-2">98.4% Safe Index</p>
                <p className="text-xs text-emerald-100/80 mt-0.5">
                  Padre Garcia Livestock Territory — Low Epidemic Risk
                </p>
              </div>

              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Vaccination Coverage
                      </span>
                      <span className="text-[10px] text-slate-400">FMD & Hemorrhagic</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-900">94.2%</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Quarantined Sectors
                      </span>
                      <span className="text-[10px] text-slate-400">Surveillance checkpoints</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-amber-700">
                    {totalIncidents > 0 ? `${totalIncidents} active` : "0 (Clear)"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="size-4 text-sky-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Slaughter Clearances
                      </span>
                      <span className="text-[10px] text-slate-400">Ante & post-mortem</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-sky-800">100% Inspected</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Expanded Activity Stream (8 Cols) */}
          <div className="lg:col-span-8">
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-[#2D5A27]">
                    <Activity className="size-4" />
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
                {activityFeed.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => onNavigateTab(act.domain)}
                    className="p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all cursor-pointer flex items-start gap-3 group"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0 group-hover:bg-emerald-100 group-hover:text-emerald-800 transition-colors">
                      {act.domain === "production" && <Milk className="size-4 text-sky-600" />}
                      {act.domain === "batches" && <Boxes className="size-4 text-[#2D5A27]" />}
                      {act.domain === "sales" && <ArrowUpRight className="size-4 text-emerald-600" />}
                      {act.domain === "disease" && <AlertTriangle className="size-4 text-rose-600" />}
                      {act.domain === "mortality" && <AlertTriangle className="size-4 text-rose-600" />}
                      {act.domain === "livestock" && <Icon iconNode={cowHead} className="size-4 text-emerald-700" />}
                      {act.domain === "slaughter" && <Scale className="size-4 text-amber-600" />}
                      {act.domain === "census" && <Layers className="size-4 text-indigo-600" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#2D5A27] transition-colors truncate">
                          {act.title}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {act.timestamp}
                        </span>
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
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
