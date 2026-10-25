"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import api from "@/lib/axios";
import {
  Beef,
  Cpu,
  LineChart as LineChartIcon,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Table as TableIcon,
  TrendingUp,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchInspections,
  InspectionRecord,
} from "../auction-inspections/auction-analytics";

interface TransferRecord {
  id: number;
  livestock: number;
  livestock_tag: string;
  livestock_type_name: string;
  previous_owner_name: string;
  new_owner_name: string;
  transfer_certificate_number: string;
  transfer_date: string;
  purchase_price: string | null;
  status: string;
  municipality: string;
  province: string;
}

interface MissionTooltipItem {
  name: string;
  value?: number | string | null;
  color?: string;
  dataKey?: string;
}

interface FuturisticMissionTooltipProps {
  active?: boolean;
  payload?: MissionTooltipItem[];
  label?: string;
  unit?: string;
}

// Futuristic Mission Control Tooltip matching /analysis/descriptive
function FuturisticMissionTooltip({ active, payload, label, unit }: FuturisticMissionTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-purple-500/40 bg-slate-950/95 p-3 text-xs text-white shadow-2xl backdrop-blur-md">
      <div className="border-b border-slate-800 pb-1.5 mb-2 flex items-center justify-between gap-3 font-mono">
        <span className="font-bold text-purple-300">{label}</span>
        {unit && <span className="text-[10px] text-purple-400 uppercase tracking-widest">{unit}</span>}
      </div>
      <div className="space-y-1.5">
        {payload.map((item, index) => {
          if (item.value == null) return null;
          return (
            <div key={`${item.dataKey || item.name}-${index}`} className="flex items-center justify-between gap-4 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: item.color || "#A855F7" }} />
                <span className="text-slate-300">{item.name}</span>
              </div>
              <span className="font-black text-white">
                {typeof item.value === "number"
                  ? item.value.toLocaleString("en-PH")
                  : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AuctionDescriptiveAnalytics() {
  const [selectedDomain, setSelectedDomain] = useState<"sales" | "intake" | "species" | "origins">("sales");
  const [showTableView, setShowTableView] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  // 1. Fetch inspections for market movement & clearance telemetry
  const {
    data: inspections = [],
    isLoading: isInspectionsLoading,
    isRefetching: isInspectionsRefetching,
    refetch: refetchInspections,
  } = useQuery<InspectionRecord[]>({
    queryKey: ["inspections"],
    queryFn: () => fetchInspections(),
    staleTime: 30_000,
  });

  // 2. Fetch ownership transfers for trade commerce & valuation telemetry
  const {
    data: transfers = [],
    isLoading: isTransfersLoading,
    isRefetching: isTransfersRefetching,
    refetch: refetchTransfers,
  } = useQuery<TransferRecord[]>({
    queryKey: ["auction-ownership-transfer-registry"],
    queryFn: async () => (await api.get<TransferRecord[]>("livestock/ownership-transfers/")).data,
    staleTime: 30_000,
  });

  const isLoading = isInspectionsLoading || isTransfersLoading;
  const isRefetching = isInspectionsRefetching || isTransfersRefetching;

  const handleRefresh = () => {
    refetchInspections();
    refetchTransfers();
  };

  // ---------------------------------------------------------------------------
  // DESCRIPTIVE METRIC AGGREGATIONS
  // ---------------------------------------------------------------------------

  // A. Sales & Trade Valuation Analytics
  const salesMetrics = useMemo(() => {
    const totalTransfers = transfers.length;
    const completedTransfers = transfers.filter(
      (t) => (t.status || "").toUpperCase() === "APPROVED" || (t.status || "").toUpperCase() === "VERIFIED"
    ).length;

    let totalValuation = 0;
    let pricedCount = 0;

    transfers.forEach((t) => {
      if (t.purchase_price) {
        const p = parseFloat(t.purchase_price);
        if (!isNaN(p) && p > 0) {
          totalValuation += p;
          pricedCount += 1;
        }
      }
    });

    const averagePrice = pricedCount > 0 ? Math.round(totalValuation / pricedCount) : 0;
    const pricingRate = totalTransfers > 0 ? Math.round((pricedCount / totalTransfers) * 100) : 0;

    // Monthly Trend Aggregation
    const monthlyMap: Record<string, { label: string; count: number; value: number }> = {};
    const now = new Date();

    // Initialize previous 6 months for a continuous futuristic timeline
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
      monthlyMap[key] = { label, count: 0, value: 0 };
    }

    transfers.forEach((t) => {
      const dateStr = t.transfer_date || "";
      const monthKey = dateStr.slice(0, 7);
      if (monthlyMap[monthKey]) {
        monthlyMap[monthKey].count += 1;
        const p = parseFloat(t.purchase_price || "0");
        if (!isNaN(p)) monthlyMap[monthKey].value += p;
      }
    });

    const trend = Object.entries(monthlyMap).map(([month, val]) => ({
      month,
      label: val.label,
      transfers: val.count,
      valuationPhp: Math.round(val.value),
    }));

    return {
      totalTransfers,
      completedTransfers,
      totalValuation,
      averagePrice,
      pricedCount,
      pricingRate,
      trend,
    };
  }, [transfers]);

  // B. Market Intake & Clearance Velocity
  const intakeMetrics = useMemo(() => {
    const totalLogs = inspections.length;
    let totalHeads = 0;
    const purposeMap: Record<string, number> = {
      SLAUGHTER: 0,
      BREEDING: 0,
      FATTENING: 0,
      OTHER: 0,
    };

    inspections.forEach((insp) => {
      const heads = insp.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) ?? 1;
      totalHeads += heads;
      const p = (insp.purpose || "OTHER").toUpperCase();
      if (purposeMap[p] !== undefined) {
        purposeMap[p] += heads;
      } else {
        purposeMap.OTHER += heads;
      }
    });

    const approvedCount = inspections.filter((i) => i.status === "APPROVED").length;
    const submittedCount = inspections.filter((i) => i.status === "VERIFIED").length;
    const pendingCount = inspections.filter((i) => i.status === "PENDING").length;
    const revisionCount = inspections.filter(
      (i) => i.status === "SUBJECT_TO_REVISION" || i.status === "REJECTED"
    ).length;

    const clearanceRate = totalLogs > 0 ? Math.round((approvedCount / totalLogs) * 100) : 0;

    const purposeData = [
      { name: "Slaughter", heads: purposeMap.SLAUGHTER, color: "#EF4444" },
      { name: "Breeding", heads: purposeMap.BREEDING, color: "#8B5CF6" },
      { name: "Fattening", heads: purposeMap.FATTENING, color: "#06B6D4" },
      { name: "Other Trade", heads: purposeMap.OTHER, color: "#10B981" },
    ].filter((p) => p.heads > 0);

    return {
      totalLogs,
      totalHeads,
      approvedCount,
      submittedCount,
      pendingCount,
      revisionCount,
      clearanceRate,
      purposeData,
    };
  }, [inspections]);

  // C. Species Composition Breakdown
  const speciesMetrics = useMemo(() => {
    const speciesCountMap: Record<string, number> = {};

    inspections.forEach((insp) => {
      insp.items?.forEach((it) => {
        const name = it.livestock_type_name?.trim() || "Livestock";
        speciesCountMap[name] = (speciesCountMap[name] || 0) + (it.quantity || 1);
      });
    });

    // Also factor in transfers
    transfers.forEach((t) => {
      const name = t.livestock_type_name?.trim() || "Livestock";
      speciesCountMap[name] = (speciesCountMap[name] || 0) + 1;
    });

    const totalAnimals = Object.values(speciesCountMap).reduce((a, b) => a + b, 0) || 1;

    const colors = ["#A855F7", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#6366F1"];

    return Object.entries(speciesCountMap)
      .map(([species, heads], i) => ({
        species,
        heads,
        sharePct: Math.round((heads / totalAnimals) * 100),
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.heads - a.heads);
  }, [inspections, transfers]);

  // D. Origin Hotspots (Top Supplying Barangays & Municipalities)
  const originMetrics = useMemo(() => {
    const originMap: Record<string, number> = {};

    inspections.forEach((insp) => {
      const rawOrigin = insp.origin?.trim() || insp.shipper_address?.trim() || "Padre Garcia";
      const clean = rawOrigin.replace(/^Brgy\.?\s*/i, "").trim() || "Padre Garcia";
      const heads = insp.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) ?? 1;
      originMap[clean] = (originMap[clean] || 0) + heads;
    });

    const totalOrigins = Object.values(originMap).reduce((a, b) => a + b, 0) || 1;

    return Object.entries(originMap)
      .map(([origin, heads]) => ({
        origin,
        heads,
        sharePct: Math.round((heads / totalOrigins) * 100),
      }))
      .sort((a, b) => b.heads - a.heads)
      .slice(0, 6);
  }, [inspections]);

  return (
    <section className="space-y-4">
      {/* ═══ 1. FUTURISTIC MISSION CONTROL HERO BANNER ═══ */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-r from-slate-950 via-purple-950/60 to-slate-900 p-5 sm:p-6 shadow-2xl shadow-purple-950/30 text-white">
        {/* Cyber backdrop effects */}
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 size-80 rounded-full bg-purple-600/15 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute left-1/3 -bottom-20 size-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap font-mono text-[10px]">
              <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase tracking-widest font-black py-0.5 px-2.5">
                <span className="size-1.5 rounded-full bg-purple-400 animate-ping mr-1.5 inline-block" />
                Live Telemetry
              </Badge>
              <Badge className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase tracking-widest font-bold py-0.5 px-2">
                Padre Garcia Trading Center
              </Badge>
              <span className="text-purple-300/70 hidden sm:inline">
                Sync: Active · Real Municipal Ledger
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-purple-300">
              Auction Descriptive Analytics
            </h2>

            <p className="text-xs sm:text-sm text-purple-200/80 max-w-2xl font-medium leading-relaxed">
              Real-time trading volume, official transfer valuations, antemortem clearance rates,
              and livestock species telemetry verified across Padre Garcia checkpoint records.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefetching}
              className="h-9 rounded-xl border-purple-500/40 bg-purple-900/30 hover:bg-purple-900/60 text-purple-200 text-xs font-mono font-bold shadow-xs cursor-pointer gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin text-purple-400" : ""}`} />
              <span>{isRefetching ? "Syncing..." : "Sync Ledger"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCompact((prev) => !prev)}
              className="h-9 rounded-xl border-purple-500/40 bg-purple-900/30 hover:bg-purple-900/60 text-purple-200 text-xs font-mono font-bold shadow-xs cursor-pointer gap-1.5"
            >
              <Cpu className="size-3.5 text-purple-300" />
              <span>{isCompact ? "Expand Console" : "Compact View"}</span>
            </Button>
          </div>
        </div>

        {/* HUD Pulse Micro-Capsules */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-purple-500/20 font-mono">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <span className="text-[9px] uppercase tracking-wider text-purple-300 block">Total Headcount</span>
            <span className="text-base sm:text-lg font-black text-white tabular-nums">
              {isLoading ? "—" : intakeMetrics.totalHeads.toLocaleString("en-PH")}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <span className="text-[9px] uppercase tracking-wider text-cyan-300 block">Gross Trade Turnover</span>
            <span className="text-base sm:text-lg font-black text-cyan-300 tabular-nums">
              {isLoading
                ? "—"
                : salesMetrics.totalValuation > 0
                ? `₱${salesMetrics.totalValuation.toLocaleString("en-PH")}`
                : "Ledger Recorded"}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <span className="text-[9px] uppercase tracking-wider text-emerald-300 block">Clearance Pass Rate</span>
            <span className="text-base sm:text-lg font-black text-emerald-400 tabular-nums">
              {isLoading ? "—" : `${intakeMetrics.clearanceRate}%`}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <span className="text-[9px] uppercase tracking-wider text-amber-300 block">Active Species Tracked</span>
            <span className="text-base sm:text-lg font-black text-amber-300 tabular-nums">
              {isLoading ? "—" : speciesMetrics.length}
            </span>
          </div>
        </div>
      </div>

      {!isCompact && (
        <>
          {/* ═══ 2. INTERACTIVE DOMAIN SELECTOR (4 CYBERNETIC PODS) ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              {
                id: "sales" as const,
                label: "Market Trade & Valuation",
                domain: "COMMERCE",
                reporting: "APPROVED TRANSFERS",
                icon: ShoppingBag,
                metric: `${salesMetrics.totalTransfers} Records`,
                badge:
                  salesMetrics.totalValuation > 0
                    ? `₱${salesMetrics.totalValuation.toLocaleString("en-PH")}`
                    : `${salesMetrics.completedTransfers} Cleared`,
                color: "purple",
              },
              {
                id: "intake" as const,
                label: "Ingress & Clearance Flow",
                domain: "BIOSECURITY",
                reporting: "CHECKPOINT INTAKE",
                icon: ShieldCheck,
                metric: `${intakeMetrics.totalHeads} Heads Inspected`,
                badge: `${intakeMetrics.clearanceRate}% Pass Rate`,
                color: "emerald",
              },
              {
                id: "species" as const,
                label: "Species Composition",
                domain: "DYNAMICS",
                reporting: "LOT BREAKDOWN",
                icon: Beef,
                metric: `${speciesMetrics.length} Traded Species`,
                badge: `${speciesMetrics[0]?.species || "Cattle"} Dominant`,
                color: "cyan",
              },
              {
                id: "origins" as const,
                label: "Logistics & Origins",
                domain: "GEOGRAPHY",
                reporting: "SUPPLY HOTSPOTS",
                icon: MapPin,
                metric: `${originMetrics.length} Origin Hubs`,
                badge: originMetrics[0]?.origin || "Padre Garcia",
                color: "amber",
              },
            ].map((pod) => {
              const isSelected = selectedDomain === pod.id;
              const Icon = pod.icon;

              return (
                <button
                  key={pod.id}
                  type="button"
                  onClick={() => setSelectedDomain(pod.id)}
                  className={`group relative flex flex-col justify-between rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "border-2 border-purple-500 bg-gradient-to-br from-purple-950/20 via-purple-50/70 to-white shadow-md shadow-purple-500/10"
                      : "border border-slate-200 bg-white hover:border-purple-300 hover:bg-slate-50/70 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
                        isSelected
                          ? "bg-[#7C3AED] text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 group-hover:bg-purple-100 group-hover:text-purple-700"
                      }`}
                    >
                      <Icon className="size-4.5" />
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono font-bold ${
                        isSelected
                          ? "bg-purple-100 text-purple-900 border-purple-300"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {pod.badge}
                    </Badge>
                  </div>

                  <div className="mt-3">
                    <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      {pod.domain} • {pod.reporting}
                    </div>
                    <div
                      className={`text-sm font-bold transition-colors mt-0.5 ${
                        isSelected ? "text-purple-950 font-black" : "text-slate-800 group-hover:text-slate-900"
                      }`}
                    >
                      {pod.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center justify-between font-mono">
                      <span className="text-purple-800 font-bold">{pod.metric}</span>
                      <span className="text-[10px] text-slate-400 uppercase">Verified</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute -bottom-px left-4 right-4 h-0.5 bg-[#7C3AED] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ═══ 3. CENTERPIECE VISUALIZATION CONSOLE ═══ */}
          <Card className="overflow-hidden rounded-2xl border border-purple-200/80 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-100 text-[#7C3AED]">
                    {selectedDomain === "sales" && <TrendingUp className="size-4" />}
                    {selectedDomain === "intake" && <ShieldCheck className="size-4" />}
                    {selectedDomain === "species" && <Beef className="size-4" />}
                    {selectedDomain === "origins" && <MapPin className="size-4" />}
                  </div>
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                    {selectedDomain === "sales" && "Market Trade Volume & Valuation Trajectory"}
                    {selectedDomain === "intake" && "Ingress Clearance Rate & Purpose Dynamics"}
                    {selectedDomain === "species" && "Auction Intake Species Distribution"}
                    {selectedDomain === "origins" && "Origin Supply Hubs & Barangay Distribution"}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-500 flex flex-wrap items-center gap-2 font-medium">
                  <span>Scope: <strong className="font-mono text-purple-900">Padre Garcia Livestock Market</strong></span>
                  <span>•</span>
                  <span>Status: <strong className="text-slate-700">Official Municipal Checkpoint Records</strong></span>
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTableView((prev) => !prev)}
                  className="h-8 border-slate-200 bg-white text-xs font-mono text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer"
                >
                  {showTableView ? (
                    <>
                      <LineChartIcon className="size-3.5 mr-1 text-[#7C3AED]" />
                      <span>Visual HUD Chart</span>
                    </>
                  ) : (
                    <>
                      <TableIcon className="size-3.5 mr-1 text-[#7C3AED]" />
                      <span>Inspect Numbers</span>
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {isLoading ? (
                <Skeleton className="h-72 w-full rounded-xl bg-slate-100" />
              ) : showTableView ? (
                /* Tabular inspection mode */
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                  {selectedDomain === "sales" && (
                    <Table className="min-w-[500px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-mono text-xs text-slate-600">Month Period</TableHead>
                          <TableHead className="font-mono text-xs text-slate-600 text-right">Transactions</TableHead>
                          <TableHead className="font-mono text-xs text-slate-600 text-right">Recorded Valuation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesMetrics.trend.map((row) => (
                          <TableRow key={row.month} className="border-slate-100 hover:bg-slate-50/70">
                            <TableCell className="font-mono text-xs font-semibold text-slate-900">{row.label}</TableCell>
                            <TableCell className="font-mono text-xs text-right font-bold text-purple-900">
                              {row.transfers.toLocaleString("en-PH")}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-right text-emerald-700 font-bold">
                              {row.valuationPhp > 0 ? `₱${row.valuationPhp.toLocaleString("en-PH")}` : "Unpriced Entry"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {selectedDomain === "intake" && (
                    <Table className="min-w-[500px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-mono text-xs text-slate-600">Movement Purpose</TableHead>
                          <TableHead className="font-mono text-xs text-slate-600 text-right">Animals Inspected</TableHead>
                          <TableHead className="font-mono text-xs text-slate-600 text-right">Share of Intake</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {intakeMetrics.purposeData.map((row) => (
                          <TableRow key={row.name} className="border-slate-100 hover:bg-slate-50/70">
                            <TableCell className="font-mono text-xs font-semibold text-slate-900">{row.name}</TableCell>
                            <TableCell className="font-mono text-xs text-right font-bold text-slate-900">
                              {row.heads.toLocaleString("en-PH")} Heads
                            </TableCell>
                            <TableCell className="font-mono text-xs text-right font-bold text-purple-900">
                              {intakeMetrics.totalHeads > 0
                                ? `${Math.round((row.heads / intakeMetrics.totalHeads) * 100)}%`
                                : "0%"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {selectedDomain === "species" && (
                    <Table className="min-w-[500px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-mono text-xs text-slate-600">Species Category</TableHead>
                          <TableHead className="font-mono text-xs text-slate-600 text-right">Market Volume</TableHead>
                          <TableHead className="font-mono text-xs text-slate-600 text-right">Market Share</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {speciesMetrics.map((row) => (
                          <TableRow key={row.species} className="border-slate-100 hover:bg-slate-50/70">
                            <TableCell className="font-mono text-xs font-semibold text-slate-900">{row.species}</TableCell>
                            <TableCell className="font-mono text-xs text-right font-bold text-slate-900">
                              {row.heads.toLocaleString("en-PH")} Heads
                            </TableCell>
                            <TableCell className="font-mono text-xs text-right font-bold text-cyan-700">
                              {row.sharePct}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {selectedDomain === "origins" && (
                    <Table className="min-w-[500px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-mono text-xs text-slate-600">Origin Barangay / Source</TableHead>
                          <TableHead className="font-mono text-xs text-slate-600 text-right">Animals Supplied</TableHead>
                          <TableHead className="font-mono text-xs text-slate-600 text-right">Origin Contribution</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {originMetrics.map((row) => (
                          <TableRow key={row.origin} className="border-slate-100 hover:bg-slate-50/70">
                            <TableCell className="font-mono text-xs font-semibold text-slate-900">{row.origin}</TableCell>
                            <TableCell className="font-mono text-xs text-right font-bold text-slate-900">
                              {row.heads.toLocaleString("en-PH")} Heads
                            </TableCell>
                            <TableCell className="font-mono text-xs text-right font-bold text-amber-700">
                              {row.sharePct}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ) : (
                /* Futuristic visual HUD charts */
                <div className="space-y-4">
                  {selectedDomain === "sales" && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-slate-600 pb-2 border-b border-slate-100">
                        <span>
                          Transfers: <strong className="text-slate-900">{salesMetrics.totalTransfers}</strong>
                        </span>
                        <span>
                          Completed / Approved: <strong className="text-purple-900">{salesMetrics.completedTransfers}</strong>
                        </span>
                        <span>
                          Recorded Value:{" "}
                          <strong className="text-emerald-700 font-bold">
                            {salesMetrics.totalValuation > 0
                              ? `₱${salesMetrics.totalValuation.toLocaleString("en-PH")}`
                              : "Not recorded"}
                          </strong>
                        </span>
                        <span>
                          Avg. Price:{" "}
                          <strong className="text-slate-900">
                            {salesMetrics.averagePrice > 0 ? `₱${salesMetrics.averagePrice.toLocaleString("en-PH")}` : "—"}
                          </strong>
                        </span>
                      </div>

                      <div className="h-72 sm:h-80 w-full" role="img" aria-label="Monthly auction transfers trend">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={salesMetrics.trend} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
                            <defs>
                              <linearGradient id="purpleCyberGlow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>

                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                              dataKey="label"
                              stroke="#94a3b8"
                              tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                              axisLine={{ stroke: "#e2e8f0" }}
                              tickLine={{ stroke: "#e2e8f0" }}
                            />
                            <YAxis
                              stroke="#94a3b8"
                              tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                              axisLine={{ stroke: "#e2e8f0" }}
                              tickLine={{ stroke: "#e2e8f0" }}
                            />
                            <Tooltip content={<FuturisticMissionTooltip unit="Transfers" />} />
                            <Area
                              type="monotone"
                              dataKey="transfers"
                              name="Recorded Transfers"
                              stroke="#7C3AED"
                              strokeWidth={2.5}
                              fill="url(#purpleCyberGlow)"
                            />
                            <Line
                              type="monotone"
                              dataKey="transfers"
                              name="Transaction Velocity"
                              stroke="#A855F7"
                              strokeWidth={2}
                              dot={{ r: 4, fill: "#7C3AED", stroke: "#fff", strokeWidth: 2 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {selectedDomain === "intake" && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-slate-600 pb-2 border-b border-slate-100">
                        <span>Total Inspected: <strong className="text-slate-900">{intakeMetrics.totalHeads} heads</strong></span>
                        <span>Pass Rate: <strong className="text-emerald-700 font-bold">{intakeMetrics.clearanceRate}%</strong></span>
                        <span>Pending Check: <strong className="text-amber-700 font-bold">{intakeMetrics.pendingCount}</strong></span>
                        <span>Cleared by MAO: <strong className="text-sky-700 font-bold">{intakeMetrics.approvedCount}</strong></span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                        {/* Purpose Bar Chart */}
                        <div className="h-64 sm:h-72 w-full">
                          <p className="text-xs font-mono font-bold text-slate-500 mb-2">HEADS BY PURPOSE</p>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={intakeMetrics.purposeData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }} />
                              <YAxis stroke="#94a3b8" tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }} />
                              <Tooltip content={<FuturisticMissionTooltip unit="Heads" />} />
                              <Bar dataKey="heads" name="Inspected Animals" radius={[6, 6, 0, 0]}>
                                {intakeMetrics.purposeData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Workflow Pipeline Bars */}
                        <div className="space-y-3.5 flex flex-col justify-center bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                          <p className="text-xs font-mono font-bold text-slate-600">INSPECTION WORKFLOW VELOCITY</p>

                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-emerald-800 font-bold">Approved / Cleared</span>
                              <span className="font-black text-slate-900">{intakeMetrics.approvedCount} ({intakeMetrics.clearanceRate}%)</span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${intakeMetrics.clearanceRate}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-sky-800 font-bold">Submitted for Review</span>
                              <span className="font-black text-slate-900">{intakeMetrics.submittedCount}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-sky-500 rounded-full transition-all duration-500"
                                style={{
                                  width: `${
                                    intakeMetrics.totalLogs > 0
                                      ? Math.round((intakeMetrics.submittedCount / intakeMetrics.totalLogs) * 100)
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-amber-800 font-bold">Pending Review</span>
                              <span className="font-black text-slate-900">{intakeMetrics.pendingCount}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                style={{
                                  width: `${
                                    intakeMetrics.totalLogs > 0
                                      ? Math.round((intakeMetrics.pendingCount / intakeMetrics.totalLogs) * 100)
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedDomain === "species" && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-slate-600 pb-2 border-b border-slate-100">
                        <span>Total Cataloged: <strong className="text-slate-900">{speciesMetrics.length} Species</strong></span>
                        <span>Leading Lot: <strong className="text-purple-900">{speciesMetrics[0]?.species || "Cattle"} ({speciesMetrics[0]?.sharePct || 0}%)</strong></span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {speciesMetrics.map((item) => (
                          <div
                            key={item.species}
                            className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-purple-300 transition-colors shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                {item.species}
                              </span>
                              <span className="font-mono text-xs font-black text-purple-900">{item.sharePct}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${item.sharePct}%`, backgroundColor: item.color }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] font-mono text-slate-500">
                              <span>Volume Inspected</span>
                              <span className="font-bold text-slate-800">{item.heads.toLocaleString("en-PH")} Heads</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDomain === "origins" && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-slate-600 pb-2 border-b border-slate-100">
                        <span>Origin Hubs Mapped: <strong className="text-slate-900">{originMetrics.length}</strong></span>
                        <span>Primary Supplier: <strong className="text-amber-800">{originMetrics[0]?.origin || "Padre Garcia"}</strong></span>
                      </div>

                      <div className="space-y-3">
                        {originMetrics.map((item, idx) => (
                          <div
                            key={item.origin}
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="size-6 rounded-lg bg-amber-100 text-amber-900 font-mono text-xs font-black flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                  {item.origin}
                                </p>
                                <p className="text-[10px] font-mono text-slate-500">
                                  Verified municipal origin certificate
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0 font-mono">
                              <span className="text-xs sm:text-sm font-black text-slate-900 block">
                                {item.heads.toLocaleString("en-PH")} Heads
                              </span>
                              <span className="text-[10px] font-bold text-amber-700">
                                {item.sharePct}% of intake
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
