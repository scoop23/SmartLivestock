"use client";

import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Cpu,
  Flame,
  LineChart as LineChartIcon,
  RefreshCw,
  Scale,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Table as TableIcon,
  TrendingUp,
} from "lucide-react";
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

export interface SlaughterRecordData {
  id: number;
  livestock_type: number;
  livestock_type_name: string;
  quantity: number;
  carcass_weight: string | null;
  record_date: string;
  barangay: number | null;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";
  review_remarks: string;
  created_by_name: string;
  can_edit: boolean;
  condemned_heads?: number;
  condemned_weight_kg?: string;
  condemnation_reason?: string;
  condemnation_type?: string;
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

// Light Futuristic Mission Control Tooltip
function FuturisticMissionTooltip({ active, payload, label, unit }: FuturisticMissionTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-rose-200 bg-white/95 p-3 text-xs text-slate-900 shadow-xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5 font-mono">
        <span className="font-bold text-rose-700">{label}</span>
        {unit && <span className="text-[10px] tracking-wider text-slate-500 uppercase">{unit}</span>}
      </div>
      <div className="space-y-1.5">
        {payload.map((item, index) => {
          if (item.value == null) return null;
          return (
            <div key={`${item.dataKey || item.name}-${index}`} className="flex items-center justify-between gap-4 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: item.color || "#E11D48" }} />
                <span className="text-slate-600">{item.name}</span>
              </div>
              <span className="font-black text-slate-950">
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

interface SlaughterDescriptiveAnalyticsProps {
  records: SlaughterRecordData[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function SlaughterDescriptiveAnalytics({
  records,
  isLoading = false,
  onRefresh,
}: SlaughterDescriptiveAnalyticsProps) {
  const [selectedDomain, setSelectedDomain] = useState<"throughput" | "species" | "yields" | "condemnations">("throughput");
  const [showTableView, setShowTableView] = useState(false);

  // ---------------------------------------------------------------------------
  // DESCRIPTIVE METRIC AGGREGATIONS
  // ---------------------------------------------------------------------------

  const metrics = useMemo(() => {
    // Only approved records represent verified official abattoir output
    const approved = records.filter((r) => r.status === "APPROVED");
    const workingSet = approved.length > 0 ? approved : records;

    let totalHeads = 0;
    let totalCarcassKg = 0;
    let weighedHeads = 0;
    let totalCondemnedHeads = 0;
    let totalCondemnedKg = 0;

    // Species Breakdown
    const speciesMap: Record<string, { heads: number; carcassKg: number; weighedHeads: number; condemnedHeads: number }> = {};

    // Daily Breakdown
    const dailyMap: Record<string, { heads: number; carcassKg: number; condemnedHeads: number }> = {};

    // Condemnation Findings Breakdown
    const condemnationReasonMap: Record<string, { heads: number; weightKg: number }> = {};

    workingSet.forEach((rec) => {
      const heads = rec.quantity || 0;
      const kg = rec.carcass_weight ? parseFloat(rec.carcass_weight) || 0 : 0;
      const cHeads = rec.condemned_heads || 0;
      const cKg = rec.condemned_weight_kg ? parseFloat(rec.condemned_weight_kg) || 0 : 0;
      const reason = (rec.condemnation_reason || "").trim() || "Unspecified inspection finding";

      totalHeads += heads;
      totalCarcassKg += kg;
      if (kg > 0) weighedHeads += heads;

      totalCondemnedHeads += cHeads;
      totalCondemnedKg += cKg;

      if (cHeads > 0 || cKg > 0) {
        if (!condemnationReasonMap[reason]) {
          condemnationReasonMap[reason] = { heads: 0, weightKg: 0 };
        }
        condemnationReasonMap[reason].heads += cHeads;
        condemnationReasonMap[reason].weightKg += cKg;
      }

      // Group by species
      const sName = rec.livestock_type_name || "Unknown";
      if (!speciesMap[sName]) {
        speciesMap[sName] = { heads: 0, carcassKg: 0, weighedHeads: 0, condemnedHeads: 0 };
      }
      speciesMap[sName].heads += heads;
      speciesMap[sName].carcassKg += kg;
      if (kg > 0) speciesMap[sName].weighedHeads += heads;
      speciesMap[sName].condemnedHeads += cHeads;

      // Group by date
      const dKey = rec.record_date || "Unknown";
      if (!dailyMap[dKey]) {
        dailyMap[dKey] = { heads: 0, carcassKg: 0, condemnedHeads: 0 };
      }
      dailyMap[dKey].heads += heads;
      dailyMap[dKey].carcassKg += kg;
      dailyMap[dKey].condemnedHeads += cHeads;
    });

    const averageYieldPerHead = weighedHeads > 0 ? Math.round(totalCarcassKg / weighedHeads) : 0;
    const condemnationRate = totalHeads > 0 ? Number(((totalCondemnedHeads / totalHeads) * 100).toFixed(2)) : 0;

    // Sort timeline (most recent 14 recorded dates)
    const timeline = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, d]) => ({
        date: date.slice(5), // MM-DD
        fullDate: date,
        heads: d.heads,
        carcassKg: Math.round(d.carcassKg),
        condemnedHeads: d.condemnedHeads,
      }));

    // Species array
    const speciesData = Object.entries(speciesMap).map(([name, d]) => ({
      name,
      heads: d.heads,
      carcassKg: Math.round(d.carcassKg),
      averageKgPerHead: d.weighedHeads > 0 ? Math.round(d.carcassKg / d.weighedHeads) : 0,
      condemnedHeads: d.condemnedHeads,
    }));

    // Condemnation findings list
    const condemnationList = Object.entries(condemnationReasonMap).map(([reason, val]) => ({
      reason,
      heads: val.heads,
      weightKg: Math.round(val.weightKg * 10) / 10,
    }));

    return {
      totalHeads,
      totalCarcassKg: Math.round(totalCarcassKg),
      weighedHeads,
      averageYieldPerHead,
      totalCondemnedHeads,
      totalCondemnedKg: Math.round(totalCondemnedKg * 10) / 10,
      condemnationRate,
      timeline,
      speciesData,
      condemnationList,
    };
  }, [records]);

  // Bright, high-contrast palette for species
  const SPECIES_COLORS = ["#E11D48", "#D97706", "#0284C7", "#7C3AED", "#059669"];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-200/90 bg-gradient-to-br from-white via-rose-50/30 to-slate-50 p-4 sm:p-6 text-slate-900 shadow-sm backdrop-blur-md">
      {/* Subtle Micro-Grid Texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(#e11d48 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative z-10 space-y-6">
        {/* =================================================================== */}
        {/* HEADER & TELEMETRY BEACON                                           */}
        {/* =================================================================== */}
        <div className="flex flex-col justify-between gap-4 border-b border-rose-100 pb-5 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-rose-600" />
              </div>
              <span className="font-mono text-[11px] font-bold tracking-widest text-rose-700 uppercase bg-rose-100/70 border border-rose-200/70 px-2.5 py-0.5 rounded-full">
                Padre Garcia Abattoir · Descriptive Analytics
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              Slaughter Throughput, Carcass Weights & Condemnations
            </h2>
            <p className="text-xs text-slate-600 font-mono">
              Padre Garcia Municipal Slaughterhouse · Live meat inspection & post-mortem yield diagnostics
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTableView(!showTableView)}
              className="border-rose-200 bg-white text-xs font-mono text-rose-800 hover:bg-rose-50 hover:text-rose-950 shadow-xs"
            >
              {showTableView ? (
                <>
                  <LineChartIcon className="mr-1.5 size-3.5" />
                  HUD Charts
                </>
              ) : (
                <>
                  <TableIcon className="mr-1.5 size-3.5" />
                  Audit Register
                </>
              )}
            </Button>

            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="border-slate-200 bg-white text-xs font-mono text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                <RefreshCw className={`mr-1.5 size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Sync
              </Button>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* KPI MICRO-CAPSULES (CLEAN LIGHT HUD CARDS)                          */}
        {/* =================================================================== */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Card 1: Carcass Weights (Total Biomass) */}
          <div className="group relative overflow-hidden rounded-xl border border-rose-200/80 bg-white/95 p-3.5 shadow-xs transition-all hover:border-rose-400 hover:shadow-md">
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-mono text-[10px] font-bold tracking-wider text-rose-700 uppercase">
                Total Carcass Mass
              </span>
              <div className="rounded-lg bg-rose-50 p-1.5 text-rose-600">
                <Scale className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-slate-950">
                {metrics.totalCarcassKg.toLocaleString()}
              </span>
              <span className="font-mono text-xs font-bold text-rose-600">kg</span>
            </div>
            <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-slate-600">
              <TrendingUp className="size-3 text-emerald-600" />
              <span>Dressed meat biomass yield</span>
            </div>
          </div>

          {/* Card 2: Total Heads Slaughtered */}
          <div className="group relative overflow-hidden rounded-xl border border-amber-200/80 bg-white/95 p-3.5 shadow-xs transition-all hover:border-amber-400 hover:shadow-md">
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-mono text-[10px] font-bold tracking-wider text-amber-700 uppercase">
                Heads Slaughtered
              </span>
              <div className="rounded-lg bg-amber-50 p-1.5 text-amber-600">
                <Scissors className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-slate-950">
                {metrics.totalHeads.toLocaleString()}
              </span>
              <span className="font-mono text-xs font-bold text-amber-600">heads</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-600">
              Municipal abattoir throughput
            </div>
          </div>

          {/* Card 3: Average Yield Per Head */}
          <div className="group relative overflow-hidden rounded-xl border border-sky-200/80 bg-white/95 p-3.5 shadow-xs transition-all hover:border-sky-400 hover:shadow-md">
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-mono text-[10px] font-bold tracking-wider text-sky-700 uppercase">
                Avg Carcass Yield
              </span>
              <div className="rounded-lg bg-sky-50 p-1.5 text-sky-600">
                <Activity className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-slate-950">
                {metrics.averageYieldPerHead.toLocaleString()}
              </span>
              <span className="font-mono text-xs font-bold text-sky-600">kg/head</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-600">
              Weighted dressing yield per animal
            </div>
          </div>

          {/* Card 4: Condemnation Rate & Logs */}
          <div className="group relative overflow-hidden rounded-xl border border-red-200/80 bg-white/95 p-3.5 shadow-xs transition-all hover:border-red-400 hover:shadow-md">
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-mono text-[10px] font-bold tracking-wider text-red-700 uppercase">
                Condemnation Rate
              </span>
              <div className="rounded-lg bg-red-50 p-1.5 text-red-600">
                <ShieldAlert className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-slate-950">
                {metrics.condemnationRate}%
              </span>
              <span className="font-mono text-xs font-bold text-red-600">
                ({metrics.totalCondemnedHeads} hd)
              </span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-600">
              {metrics.totalCondemnedKg > 0 ? `${metrics.totalCondemnedKg} kg rejected` : "Food safety inspection findings"}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SUBSYSTEM NAVIGATION TABS                                           */}
        {/* =================================================================== */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/90 p-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => setSelectedDomain("throughput")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-all ${
              selectedDomain === "throughput"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <TrendingUp className="size-3.5" />
            Throughput & Biomass Yield
          </button>

          <button
            type="button"
            onClick={() => setSelectedDomain("species")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-all ${
              selectedDomain === "species"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <BarChart3 className="size-3.5" />
            Species Breakdown
          </button>

          <button
            type="button"
            onClick={() => setSelectedDomain("yields")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-all ${
              selectedDomain === "yields"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <Scale className="size-3.5" />
            Carcass Weight Benchmarks
          </button>

          <button
            type="button"
            onClick={() => setSelectedDomain("condemnations")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-all ${
              selectedDomain === "condemnations"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <ShieldAlert className="size-3.5" />
            Condemnation Logs ({metrics.totalCondemnedHeads})
          </button>
        </div>

        {/* =================================================================== */}
        {/* MAIN VISUALIZATION STAGE                                            */}
        {/* =================================================================== */}
        {!showTableView ? (
          <div className="space-y-5">
            {/* DOMAIN 1: THROUGHPUT & BIOMASS YIELD */}
            {selectedDomain === "throughput" && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-mono text-sm font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="size-4 text-rose-600" />
                      Daily Throughput & Carcass Weight Trajectory
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Dual-axis trajectory tracking total animal heads (Bars) vs dressed carcass mass in kg (Line)
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-sm bg-rose-600" />
                      <span className="text-slate-700 font-semibold">Heads</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-sm bg-amber-500" />
                      <span className="text-slate-700 font-semibold">Carcass kg</span>
                    </div>
                  </div>
                </div>

                {metrics.timeline.length > 0 ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={metrics.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="date"
                          stroke="#94A3B8"
                          tick={{ fill: "#64748B", fontSize: 11, fontFamily: "monospace" }}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#94A3B8"
                          tick={{ fill: "#64748B", fontSize: 11, fontFamily: "monospace" }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#94A3B8"
                          tick={{ fill: "#D97706", fontSize: 11, fontFamily: "monospace" }}
                        />
                        <Tooltip
                          content={
                            <FuturisticMissionTooltip unit="Daily Telemetry" />
                          }
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="heads"
                          name="Heads Slaughtered"
                          fill="#E11D48"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={36}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="carcassKg"
                          name="Carcass Mass (kg)"
                          stroke="#D97706"
                          strokeWidth={2.5}
                          dot={{ fill: "#D97706", r: 3 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-56 items-center justify-center font-mono text-xs text-slate-400">
                    No approved slaughter records recorded for this timeline.
                  </div>
                )}
              </div>
            )}

            {/* DOMAIN 2: SPECIES BREAKDOWN */}
            {selectedDomain === "species" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <h3 className="font-mono text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                    <BarChart3 className="size-4 text-rose-600" />
                    Heads Slaughtered by Species
                  </h3>
                  {metrics.speciesData.length > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metrics.speciesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis
                            dataKey="name"
                            stroke="#94A3B8"
                            tick={{ fill: "#64748B", fontSize: 11, fontFamily: "monospace" }}
                          />
                          <YAxis
                            stroke="#94A3B8"
                            tick={{ fill: "#64748B", fontSize: 11, fontFamily: "monospace" }}
                          />
                          <Tooltip content={<FuturisticMissionTooltip unit="Heads" />} />
                          <Bar dataKey="heads" name="Heads" radius={[4, 4, 0, 0]} maxBarSize={48}>
                            {metrics.speciesData.map((_, idx) => (
                              <Cell key={`cell-${idx}`} fill={SPECIES_COLORS[idx % SPECIES_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center font-mono text-xs text-slate-400">
                      No species data available.
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <h3 className="font-mono text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                    <Scale className="size-4 text-amber-600" />
                    Total Carcass Biomass Yield (kg) by Species
                  </h3>
                  {metrics.speciesData.length > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metrics.speciesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis
                            dataKey="name"
                            stroke="#94A3B8"
                            tick={{ fill: "#64748B", fontSize: 11, fontFamily: "monospace" }}
                          />
                          <YAxis
                            stroke="#94A3B8"
                            tick={{ fill: "#64748B", fontSize: 11, fontFamily: "monospace" }}
                          />
                          <Tooltip content={<FuturisticMissionTooltip unit="kg" />} />
                          <Bar dataKey="carcassKg" name="Carcass Mass (kg)" radius={[4, 4, 0, 0]} maxBarSize={48}>
                            {metrics.speciesData.map((_, idx) => (
                              <Cell key={`cell-kg-${idx}`} fill={SPECIES_COLORS[(idx + 1) % SPECIES_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center font-mono text-xs text-slate-400">
                      No carcass yield data available.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DOMAIN 3: CARCASS WEIGHT BENCHMARKS */}
            {selectedDomain === "yields" && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-mono text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Scale className="size-4 text-sky-600" />
                      Species Carcass Yield Benchmarks (kg/head)
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Average dressed carcass weight per head against Padre Garcia standards
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {metrics.speciesData.map((s) => (
                    <div
                      key={s.name}
                      className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 font-mono shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-950 text-sm">{s.name}</span>
                        <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-800 text-[10px]">
                          {s.heads} heads
                        </Badge>
                      </div>
                      <div className="text-2xl font-black text-sky-700">
                        {s.averageKgPerHead.toLocaleString()} <span className="text-xs text-slate-500">kg/head</span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Total dressed mass: <span className="text-slate-950 font-bold">{s.carcassKg.toLocaleString()} kg</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-sky-600"
                          style={{
                            width: `${Math.min(100, Math.max(10, (s.averageKgPerHead / 250) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DOMAIN 4: CONDEMNATION SURVEILLANCE & LOGS */}
            {selectedDomain === "condemnations" && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-mono text-sm font-bold text-slate-900 flex items-center gap-2">
                      <ShieldAlert className="size-4 text-red-600" />
                      Post-Mortem & Ante-Mortem Meat Condemnation Log Registry
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Inspection findings, organ/carcass rejections, and municipal food safety enforcement
                    </p>
                  </div>
                  <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800 font-mono text-xs">
                    {metrics.totalCondemnedHeads} Heads · {metrics.totalCondemnedKg} kg condemned
                  </Badge>
                </div>

                {metrics.condemnationList.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {metrics.condemnationList.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-red-200 bg-red-50/50 p-3.5 space-y-2 font-mono text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <AlertTriangle className="size-3.5 text-amber-600" />
                            {item.reason}
                          </span>
                          <span className="text-red-700 font-black">{item.heads} heads</span>
                        </div>
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>Rejected biomass:</span>
                          <span className="text-slate-950 font-bold">{item.weightKg} kg</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-6 text-center font-mono text-xs text-emerald-800">
                    <CheckCircle2 className="mx-auto size-6 mb-2 text-emerald-600" />
                    No condemned carcasses or organs recorded in filtered batch. Clean food safety inspection pass.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* =================================================================== */
          /* RAW AUDIT REGISTER TABLE (LIGHT VIEW)                               */
          /* =================================================================== */
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs font-mono text-xs">
            <Table>
              <TableHeader className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <TableRow className="border-slate-200 hover:bg-transparent">
                  <TableHead className="text-slate-700 font-bold">Date</TableHead>
                  <TableHead className="text-slate-700 font-bold">Species</TableHead>
                  <TableHead className="text-right text-slate-700 font-bold">Heads</TableHead>
                  <TableHead className="text-right text-slate-700 font-bold">Carcass (kg)</TableHead>
                  <TableHead className="text-right text-slate-700 font-bold">Avg (kg/hd)</TableHead>
                  <TableHead className="text-slate-700 font-bold">Condemnation Log</TableHead>
                  <TableHead className="text-slate-700 font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.slice(0, 15).map((row) => {
                  const kg = row.carcass_weight ? parseFloat(row.carcass_weight) : null;
                  const avg = kg && row.quantity > 0 ? (kg / row.quantity).toFixed(1) : null;
                  const cHeads = row.condemned_heads || 0;
                  const cReason = row.condemnation_reason;

                  return (
                    <TableRow key={row.id} className="border-slate-100 hover:bg-rose-50/30">
                      <TableCell className="font-bold text-slate-900">{row.record_date}</TableCell>
                      <TableCell className="text-rose-700 font-medium">{row.livestock_type_name}</TableCell>
                      <TableCell className="text-right font-black text-slate-950">{row.quantity}</TableCell>
                      <TableCell className="text-right font-bold text-amber-700">
                        {kg ? `${kg.toLocaleString()} kg` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sky-700">{avg ? `${avg} kg` : "—"}</TableCell>
                      <TableCell>
                        {cHeads > 0 || cReason ? (
                          <div className="flex items-center gap-1.5 text-red-600 font-medium">
                            <AlertTriangle className="size-3" />
                            <span>
                              {cHeads > 0 ? `${cHeads} hd` : ""} {cReason ? `(${cReason})` : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.status === "APPROVED"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border-amber-300 bg-amber-50 text-amber-800"
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
