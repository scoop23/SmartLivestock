"use client";

import InspectionClassificationChart from "../components/inspection-classification-chart";
import type { InspectionRecord } from "../auction-inspections/auction-analytics";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart2,
  Calendar,
  Check,
  ClipboardCheck,
  Clock,
  Gavel,
  ListFilter,
  PieChart as PieChartIcon,
  RefreshCw,
  RotateCcw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Icons Matching Mockup ──────────────────────────────────────────────
const CattleIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-1.5-11 0-.2-.6-1.5-2-3-2C1 5 .5 6.5 1 8c.8 2.3 2.5 3.5 4 4 .2 3.5 2.5 6 7 6s6.8-2.5 7-6c1.5-.5 3.2-1.7 4-4 .5-1.5 0-3-1-3Z" />
    <path d="M7 15v4" />
    <path d="M17 15v4" />
    <path d="M9 18h6" />
    <circle cx="9" cy="11" r="1" fill="currentColor" />
    <circle cx="15" cy="11" r="1" fill="currentColor" />
  </svg>
);

const CoinStackIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
    <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
  </svg>
);

// ── Types ──────────────────────────────────────────────────────────────
type Transfer = {
  id: number;
  transfer_certificate_number?: string;
  livestock_tag?: string;
  livestock_type_name?: string;
  new_owner_name?: string;
  previous_owner_name?: string;
  transfer_date?: string;
  purchase_price?: string | null;
  status?: string;
  municipality?: string;
  province?: string;
  heads_count?: number;
  animal_description?: string;
};


function getTransferHeads(t: Transfer): number {
  if (t.heads_count) return t.heads_count;
  if (t.animal_description) {
    const match = t.animal_description.match(/^(\d+)\s+head/i);
    if (match) return parseInt(match[1], 10);
  }
  return 1;
}

export default function AuctionAnalyticsPage() {
  const [selectedQuarter, setSelectedQuarter] = useState<string>(() => {
    const today = new Date();
    return today.getFullYear() === 2026 ? `Q${Math.floor(today.getMonth() / 3) + 1} 2026` : "ALL";
  });

  // Live queries to Django REST backend endpoints
  const {
    data: transfers = [],
    isLoading: isLoadingTransfers,
    refetch: refetchTransfers,
    isFetching: isFetchingTransfers,
  } = useQuery<Transfer[]>({
    queryKey: ["auction-analytics-transfers"],
    queryFn: async () => (await api.get<Transfer[]>("livestock/ownership-transfers/")).data,
    staleTime: 30_000,
  });

  const {
    data: inspections = [],
    isError: isInspectionsError,
    isLoading: isLoadingInspections,
    refetch: refetchInspections,
    isFetching: isFetchingInspections,
  } = useQuery<InspectionRecord[]>({
    queryKey: ["auction-analytics-inspections"],
    queryFn: async () => (await api.get<InspectionRecord[]>("/inspections/")).data,
    staleTime: 30_000,
  });

  const isFetching = isFetchingTransfers || isFetchingInspections;
  const _isLoading = isLoadingTransfers || isLoadingInspections;
  void _isLoading;

  const handleRefresh = () => {
    void refetchTransfers();
    void refetchInspections();
  };

  // ── Filter Dynamically by Selected Period ─────────────────────────────
  const activeTransfers = useMemo(() => {
    if (transfers.length === 0) return [];
    if (selectedQuarter === "ALL") return transfers;
    if (selectedQuarter === "FULL 2026") {
      return transfers.filter((t) => t.transfer_date?.startsWith("2026"));
    }
    const [q] = selectedQuarter.split(" ");
    return transfers.filter((t) => {
      if (!t.transfer_date) return false;
      const month = parseInt(t.transfer_date.slice(5, 7), 10);
      if (q === "Q1") return month >= 1 && month <= 3;
      if (q === "Q2") return month >= 4 && month <= 6;
      if (q === "Q3") return month >= 7 && month <= 9;
      if (q === "Q4") return month >= 10 && month <= 12;
      return true;
    });
  }, [transfers, selectedQuarter]);

  // ── Derived KPI Metrics (100% Real Database Queries) ──────────────────
  const liveHeadsTotal = useMemo(() => {
    return activeTransfers.reduce((acc, t) => acc + getTransferHeads(t), 0);
  }, [activeTransfers]);

  const liveAuctionsCount = useMemo(() => {
    return activeTransfers.length;
  }, [activeTransfers]);

  const liveBuyersCount = useMemo(() => {
    return new Set(activeTransfers.map((t) => t.new_owner_name).filter(Boolean)).size;
  }, [activeTransfers]);

  const liveSalesValuation = useMemo(() => {
    const sum = activeTransfers.reduce((acc, t) => acc + (parseFloat(t.purchase_price || "0") || 0), 0);
    return `₱${Math.round(sum).toLocaleString("en-PH")}`;
  }, [activeTransfers]);

  // ── Monthly Volume Trend (Dynamically grouped by Month from Real Data) ──
  const volumeTrendData = useMemo(() => {
    const monthMap: Record<string, number> = {};
    const [q] = selectedQuarter.split(" ");

    // Initialize period months
    if (q === "Q3") {
      monthMap["Jul 2026"] = 0;
      monthMap["Aug 2026"] = 0;
      monthMap["Sep 2026"] = 0;
    } else if (q === "Q4") {
      monthMap["Oct 2026"] = 0;
      monthMap["Nov 2026"] = 0;
      monthMap["Dec 2026"] = 0;
    } else if (q === "Q2") {
      monthMap["Apr 2026"] = 0;
      monthMap["May 2026"] = 0;
      monthMap["Jun 2026"] = 0;
    } else if (q === "Q1") {
      monthMap["Jan 2026"] = 0;
      monthMap["Feb 2026"] = 0;
      monthMap["Mar 2026"] = 0;
    }

    activeTransfers.forEach((t) => {
      if (!t.transfer_date) return;
      const d = new Date(t.transfer_date);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      monthMap[label] = (monthMap[label] || 0) + getTransferHeads(t);
    });

    return Object.entries(monthMap).map(([month, heads]) => ({ month, heads }));
  }, [activeTransfers, selectedQuarter]);

  // Dynamic maximum heads for responsive Y-axis
  const maxVolumeHeads = useMemo(() => {
    const counts = volumeTrendData.map((d) => d.heads);
    const max = Math.max(0, ...counts);
    return max > 0 ? Math.ceil(max / 10) * 10 + 10 : 50;
  }, [volumeTrendData]);

  // ── Cattle by Destination Donut Breakdown (Purely from Real Database) ──
  const destinationData = useMemo(() => {
    const destMap: Record<string, number> = {};
    activeTransfers.forEach((t) => {
      const dest = t.municipality?.trim() || "Others";
      destMap[dest] = (destMap[dest] || 0) + getTransferHeads(t);
    });

    const entries = Object.entries(destMap);
    if (entries.length === 0) return [];

    const total = entries.reduce((acc, [, val]) => acc + val, 0);
    const palette = ["#1B5E20", "#2E7D32", "#4CAF50", "#81C784", "#A5D6A7", "#C8E6C9"];
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const top4 = sorted.slice(0, 4);
    const otherCount = sorted.slice(4).reduce((acc, [, val]) => acc + val, 0);

    const result = top4.map(([name, heads], idx) => ({
      name,
      heads,
      percentage: `${Math.round((heads / (total || 1)) * 100)}%`,
      color: palette[idx % palette.length],
    }));

    if (otherCount > 0) {
      result.push({
        name: "Others",
        heads: otherCount,
        percentage: `${Math.round((otherCount / (total || 1)) * 100)}%`,
        color: palette[4],
      });
    }
    return result;
  }, [activeTransfers]);

  // ── Transaction Status Counts (Purely from Real Database) ─────────────
  const transactionStatus = useMemo(() => {
    const completed = activeTransfers.filter(
      (t) => t.status === "APPROVED" || t.status === "COMPLETED"
    ).length;
    const forMovement = activeTransfers.filter(
      (t) => t.status === "PENDING" || t.status === "VERIFIED"
    ).length;
    const forReview = activeTransfers.filter(
      (t) => t.status === "SUBJECT_TO_REVISION" || t.status === "REJECTED"
    ).length;
    return { completed, forMovement, forReview };
  }, [activeTransfers]);

  // ── Recent Auction Activity List (Directly from Real Database Rows) ───
  const recentActivities = useMemo(() => {
    return activeTransfers.slice(0, 3).map((t) => {
      const isApproved = t.status === "APPROVED" || t.status === "COMPLETED";
      const dateObj = t.transfer_date ? new Date(t.transfer_date) : new Date();
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const heads = getTransferHeads(t);
      const price = t.purchase_price
        ? `₱${Math.round(Number(t.purchase_price)).toLocaleString("en-PH")}`
        : "₱0";
      const city = t.municipality || "Padre Garcia";

      return {
        id: t.id,
        code: t.transfer_certificate_number || `AUC-TX-${t.id}`,
        title: `Auction ${t.transfer_certificate_number || `AUC-TX-${t.id}`} ${
          isApproved ? "completed" : "for movement"
        }`,
        details: `${heads} head${heads > 1 ? "s" : ""} • ${price} • ${city}`,
        statusText: isApproved ? "Completed" : "For Movement",
        statusVariant: isApproved ? "completed" : "movement",
        date: formattedDate,
      };
    });
  }, [activeTransfers]);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-8 antialiased">
      <PageHeader
        title="Market Analytics"
        subtitle="Quarterly volume trends, commercial trade velocity, and destination breakdown"
        variant="auction"
        maxWidthClass="w-full"
      />

      <div className="w-full px-4 sm:px-6 lg:px-8 py-3.5 space-y-3.5">
        {/* ── Compact Filter & Telemetry Header ───────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
                Market Performance Overview
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE BACKEND
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                className="size-7 rounded-lg text-slate-400 hover:text-slate-700"
                title="Refresh live backend records"
              >
                <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Padre Garcia Livestock Trading Center • Certified commercial trade data
            </p>
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
              <SelectTrigger className="h-8.5 w-56 sm:w-60 bg-white border-slate-200 text-slate-800 text-xs font-bold rounded-lg shadow-2xs gap-2 px-3">
                <Calendar className="size-3.5 text-slate-500 shrink-0" />
                <SelectValue placeholder="Quarter" />
              </SelectTrigger>
              <SelectContent align="end" className="text-xs">
                <SelectItem value="Q3 2026">Q3 2026 (Jul - Sep)</SelectItem>
                <SelectItem value="Q4 2026">Q4 2026 (Oct - Dec)</SelectItem>
                <SelectItem value="Q2 2026">Q2 2026 (Apr - Jun)</SelectItem>
                <SelectItem value="Q1 2026">Q1 2026 (Jan - Mar)</SelectItem>
                <SelectItem value="FULL 2026">Full Year 2026</SelectItem>
                <SelectItem value="ALL">All Records (Cumulative)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── 1. Top Row: 4 Main KPI Cards (Compact & Readable) ────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Cattle Received */}
          <div className="rounded-xl sm:rounded-2xl border border-emerald-200/90 bg-white p-3 sm:p-3.5 shadow-2xs hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex items-center gap-3">
            <div className="size-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CattleIcon className="size-5.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 block leading-tight">
                Cattle Received
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">
                  {liveHeadsTotal.toLocaleString()}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 font-sans">
                  heads
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Auctions */}
          <div className="rounded-xl sm:rounded-2xl border border-sky-200/90 bg-white p-3 sm:p-3.5 shadow-2xs hover:border-sky-300 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex items-center gap-3">
            <div className="size-11 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <Gavel className="size-5.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 block leading-tight">
                Total Auctions
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">
                  {liveAuctionsCount.toLocaleString()}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 font-sans">
                  events
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Total Buyers */}
          <div className="rounded-xl sm:rounded-2xl border border-amber-200/90 bg-white p-3 sm:p-3.5 shadow-2xs hover:border-amber-300 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex items-center gap-3">
            <div className="size-11 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Users className="size-5.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 block leading-tight">
                Total Buyers
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight leading-none">
                  {liveBuyersCount.toLocaleString()}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 font-sans">
                  registered
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Total Sales Value */}
          <div className="rounded-xl sm:rounded-2xl border border-purple-200/90 bg-white p-3 sm:p-3.5 shadow-2xs hover:border-purple-300 transition-all flex items-center gap-3">
            <div className="size-11 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <CoinStackIcon className="size-5.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 block leading-tight">
                Total Sales Value
              </span>
              <div className="flex items-baseline mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight truncate leading-none">
                  {liveSalesValuation}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Middle Row: Volume Trends & Destination Donut ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Left: Auction Volume Trends (7 cols) */}
          <div className="lg:col-span-7 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="size-4.5 text-[#1B5E20]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Auction Volume Trends
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {selectedQuarter}
              </span>
            </div>

            <div className="h-48 sm:h-52 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={volumeTrendData}
                  margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="volumeTrendGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tick={{ fontSize: 10.5, fill: "#64748B", fontWeight: 600 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10.5, fill: "#64748B", fontWeight: 600 }}
                    label={{
                      value: "Heads",
                      angle: -90,
                      position: "insideLeft",
                      offset: 18,
                      fill: "#64748B",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                    domain={[0, maxVolumeHeads]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#064E3B",
                      color: "#fff",
                      borderRadius: "10px",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                    formatter={(val: any) => [`${val ?? 0} heads`, "Auctioned"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="heads"
                    stroke="#1B5E20"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#volumeTrendGreen)"
                    dot={{ r: 4, fill: "#1B5E20", stroke: "#FFFFFF", strokeWidth: 2 }}
                    activeDot={{ r: 5.5, fill: "#16A34A", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Cattle by Destination Donut (5 cols) */}
          <div className="lg:col-span-5 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <PieChartIcon className="size-4.5 text-[#1B5E20]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Cattle by Destination
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {liveHeadsTotal} total heads
              </span>
            </div>

            {destinationData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                No destination records found for this period.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 py-1">
                {/* Donut with center total */}
                <div className="sm:col-span-6 relative h-44 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={destinationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={68}
                        paddingAngle={2}
                        dataKey="heads"
                      >
                        {destinationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0F5A38",
                          color: "#fff",
                          borderRadius: "10px",
                          border: "none",
                          fontSize: "11px",
                        }}
                        formatter={(val: any) => [`${val ?? 0} heads`, "Cattle"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Center Text in Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-xl font-black text-slate-900 leading-none">
                      {liveHeadsTotal}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                      Heads
                    </span>
                  </div>
                </div>

                {/* Destination Legend breakdown list */}
                <div className="sm:col-span-6 space-y-1.5">
                  {destinationData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs py-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="size-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-slate-700 truncate text-[11px]">
                          {item.name}
                        </span>
                      </div>
                      <span className="font-bold text-slate-950 font-mono text-[11px] shrink-0 ml-1.5">
                        {item.heads}{" "}
                        <span className="text-slate-400 font-sans font-medium text-[10px]">
                          ({item.percentage})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 3. Bottom Row: Transaction Status & Recent Activity ───────── */}
        <InspectionClassificationChart inspections={inspections} period={selectedQuarter} loading={isLoadingInspections} error={isInspectionsError} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Left: Transaction Status (5 cols) */}
          <div className="lg:col-span-5 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4.5 text-[#1B5E20]" />
              <h3 className="text-sm font-bold text-slate-900">
                Transaction Status
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Completed */}
              <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/50 p-2.5 sm:p-3 flex flex-col items-center justify-center text-center space-y-1 shadow-2xs">
                <div className="size-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Check className="size-3.5 stroke-[3]" />
                </div>
                <span className="text-[11px] font-bold text-slate-700">Completed</span>
                <span className="text-xl font-black text-slate-950 font-mono leading-none">
                  {transactionStatus.completed}
                </span>
              </div>

              {/* For Movement */}
              <div className="rounded-xl border border-amber-200/90 bg-amber-50/50 p-2.5 sm:p-3 flex flex-col items-center justify-center text-center space-y-1 shadow-2xs">
                <div className="size-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock className="size-3.5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-bold text-slate-700">For Movement</span>
                <span className="text-xl font-black text-slate-950 font-mono leading-none">
                  {transactionStatus.forMovement}
                </span>
              </div>

              {/* For Review */}
              <div className="rounded-xl border border-rose-200/90 bg-rose-50/50 p-2.5 sm:p-3 flex flex-col items-center justify-center text-center space-y-1 shadow-2xs">
                <div className="size-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                  <RotateCcw className="size-3 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-bold text-slate-700">For Review</span>
                <span className="text-xl font-black text-slate-950 font-mono leading-none">
                  {transactionStatus.forReview}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Recent Auction Activity (7 cols) */}
          <div className="lg:col-span-7 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListFilter className="size-4.5 text-[#1B5E20]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Auction Activity
                </h3>
              </div>

              <Link
                href="/auction-ownership-transfers/registry"
                className="text-xs font-bold text-[#1B5E20] hover:text-[#0c482d] flex items-center gap-1 group transition-colors"
              >
                <span>View All</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            {recentActivities.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No recent auction records found for this period.
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivities.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-9 rounded-lg bg-emerald-100/70 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                        <CattleIcon className="size-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.title}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                          {item.details}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <Badge
                        variant="outline"
                        className={
                          item.statusVariant === "completed"
                            ? "bg-emerald-100/80 text-emerald-800 border-emerald-200 font-bold text-[10px] rounded-full px-2 py-0.5"
                            : "bg-amber-100/80 text-amber-800 border-amber-200 font-bold text-[10px] rounded-full px-2 py-0.5"
                        }
                      >
                        {item.statusText}
                      </Badge>
                      <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
                        {item.date}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
