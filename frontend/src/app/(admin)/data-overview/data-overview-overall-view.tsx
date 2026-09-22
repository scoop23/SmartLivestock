"use client";

import React, { useState } from "react";
import {
  BarangaySummary,
  ActivityFeedItem,
  DataTab,
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
} from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";

interface DataOverviewOverallViewProps {
  barangaySummaries: BarangaySummary[];
  activityFeed: ActivityFeedItem[];
  isLoading?: boolean;
  onSelectBarangay: (barangay: string) => void;
  onNavigateTab: (tab: DataTab) => void;
}

export function DataOverviewOverallView({
  barangaySummaries,
  activityFeed,
  isLoading = false,
  onSelectBarangay,
  onNavigateTab,
}: DataOverviewOverallViewProps) {
  const [sortField, setSortField] = useState<keyof BarangaySummary>("totalLivestock");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: keyof BarangaySummary) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
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

  return (
    <div className="space-y-3.5">
      {/* ── Specie & Health Breakdown Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Cattle Breakdown */}
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-shadow">
          <CardContent className="p-3 sm:p-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                <Icon iconNode={cowHead} className="size-3.5" />
              </div>
              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-extrabold px-1.5 py-0.2">
                {Math.round((totalCattle / (totalHeads || 1)) * 100)}% of total
              </Badge>
            </div>
            <div className="mt-2">
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {totalCattle.toLocaleString()}
              </p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                Cattle (Bovine)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Carabao Breakdown */}
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-shadow">
          <CardContent className="p-3 sm:p-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-2">
              <div className="p-1.5 rounded-lg bg-sky-100 text-sky-800">
                <Layers className="size-3.5" />
              </div>
              <Badge className="bg-sky-50 text-sky-800 border-sky-200 text-[10px] font-extrabold px-1.5 py-0.2">
                {Math.round((totalCarabao / (totalHeads || 1)) * 100)}% of total
              </Badge>
            </div>
            <div className="mt-2">
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {totalCarabao.toLocaleString()}
              </p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                Carabaos (Water Buffalo)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Swine Breakdown */}
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-shadow">
          <CardContent className="p-3 sm:p-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                <Scale className="size-3.5" />
              </div>
              <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-extrabold px-1.5 py-0.2">
                {Math.round((totalSwine / (totalHeads || 1)) * 100)}% of total
              </Badge>
            </div>
            <div className="mt-2">
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {totalSwine.toLocaleString()}
              </p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                Swine (Pigs)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Goats & Small Ruminants */}
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-2xs hover:shadow-xs transition-shadow">
          <CardContent className="p-3 sm:p-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-2">
              <div className="p-1.5 rounded-lg bg-purple-100 text-purple-800">
                <ShieldCheck className="size-3.5" />
              </div>
              <Badge className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-extrabold px-1.5 py-0.2">
                {Math.round((totalGoats / (totalHeads || 1)) * 100)}% of total
              </Badge>
            </div>
            <div className="mt-2">
              <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {totalGoats.toLocaleString()}
              </p>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                Goats & Sheep
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Layout: Barangay Master Matrix (Left/Main) + Live Feed & Biosecurity (Right) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start">
        {/* Left 8 Cols: Barangay Master Matrix Table */}
        <div className="xl:col-span-8 space-y-3">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-slate-50/80 to-white">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#2D5A27]" />
                  Padre Garcia 18-Barangay Master Data Matrix
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Consolidated livestock headcount, dairy yields, and active surveillance across all sectors.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge className="bg-emerald-100 text-emerald-900 border-0 text-[10px] font-bold px-2 py-0.5">
                  18 Sectors Sync
                </Badge>
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
                            title="Active disease alert"
                          />
                        )}
                      </TableCell>

                      <TableCell className="px-3 py-2 text-right font-black text-xs text-slate-900">
                        {b.totalLivestock.toLocaleString()}
                      </TableCell>

                      <TableCell className="px-3 py-2 text-right font-semibold text-xs text-emerald-800">
                        {b.cattleCount.toLocaleString()}
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

            {/* Matrix Footer Totals */}
            <div className="p-3 bg-slate-50/90 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px]">
                Municipality Grand Totals:
              </div>
              <div className="flex flex-wrap items-center gap-3 font-black text-xs text-slate-900">
                <span>Total: {totalHeads.toLocaleString()} heads</span>
                <span>•</span>
                <span className="text-emerald-700">Cattle: {totalCattle.toLocaleString()}</span>
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

        {/* Right 4 Cols: Live Activity Feed & Biosecurity Scorecard */}
        <div className="xl:col-span-4 space-y-3.5">
          {/* Biosecurity & Sector Health Scorecard */}
          <Card className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
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
                  1 (Banaba Ibaba)
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
          <Card className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#2D5A27]" />
                Recent Municipal Activity Stream
              </h4>
              <div className="flex items-center gap-1.5">
                {!isLoading && activityFeed.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2">
                    {activityFeed.length} updates
                  </Badge>
                )}
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <Badge variant="outline" className="text-[9px] font-bold text-slate-500 px-1.5 py-0.2">
                  Live
                </Badge>
              </div>
            </div>

            <CardContent className="p-3 space-y-2 max-h-[460px] sm:max-h-[500px] overflow-y-auto pr-1.5 [scrollbar-width:thin] scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
              {isLoading ? (
                <div className="space-y-2.5 py-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg animate-pulse">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-slate-100 rounded w-3/4" />
                        <div className="h-2.5 bg-slate-50 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activityFeed.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Activity className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No recent activity found</p>
                  <p className="text-[10px] text-slate-400">
                    Live operational submissions and audits will stream here.
                  </p>
                </div>
              ) : (
                activityFeed.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => onNavigateTab(act.domain)}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50/80 transition-colors border border-transparent hover:border-slate-100 cursor-pointer group"
                    title={`View ${act.domain} records`}
                  >
                    <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 shrink-0 mt-0.5 group-hover:bg-slate-200 transition-colors">
                      {act.domain === "production" && <Milk className="w-3.5 h-3.5 text-sky-600" />}
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
                ))
              )}
            </CardContent>

            {!isLoading && activityFeed.length > 4 && (
              <div className="px-3.5 py-2 bg-slate-50/80 border-t border-slate-100/80 flex items-center justify-between text-[10px] text-slate-400 font-medium shrink-0">
                <span>Real-time cross-domain events</span>
                <span className="flex items-center gap-1 text-slate-500 font-semibold">
                  <span>Scroll for more</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </span>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
