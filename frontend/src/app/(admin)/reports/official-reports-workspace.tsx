"use client";

import { PADRE_GARCIA_BARANGAYS } from "@/app/(admin)/admin/admin-charts";
import {
  downloadOfficialReport,
  fetchOfficialReport,
  type OfficialReport,
  type ReportFilters,
  type ReportType,
} from "./report-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  ArrowLeftRight,
  BarChart3,
  Beef,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  MapPin,
  PawPrint,
  PieChart as PieIcon,
  RefreshCw,
  Scale,
  ShieldCheck,
  Weight,
} from "lucide-react";
import React, { useMemo, useState, type FormEvent } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface OfficialReportsWorkspaceProps {
  variant?: "admin" | "sibat";
  reportingScope?: string;
  isAllBarangays?: boolean;
}

const REPORT_OPTIONS: { value: ReportType; label: string; description: string; icon: typeof BarChart3 }[] = [
  {
    value: "inventory",
    label: "Livestock inventory",
    description: "Livestock population and inventory records.",
    icon: BarChart3,
  },
  {
    value: "production",
    label: "Production",
    description: "Approved production records.",
    icon: ClipboardCheck,
  },
  {
    value: "disease_mortality",
    label: "Disease and mortality",
    description: "Health and mortality records.",
    icon: HeartPulse,
  },
  {
    value: "slaughter",
    label: "Slaughter",
    description: "Approved slaughter records and totals.",
    icon: ShieldCheck,
  },
  {
    value: "movement",
    label: "Auction and movement",
    description: "Auction and movement records.",
    icon: ArrowLeftRight,
  },
  {
    value: "inspection",
    label: "Inspection and clearance",
    description: "Inspection and clearance activity records.",
    icon: FileSpreadsheet,
  },
];

const REPORT_SUMMARY_DESCRIPTIONS: Record<ReportType, string> = {
  slaughter: "Based on approved slaughter records from slaughterhouses.",
  inventory: "Based on approved livestock population and inventory records.",
  production: "Based on approved production records from local producers.",
  disease_mortality: "Based on approved disease surveillance and mortality records.",
  movement: "Based on approved auction and livestock movement records.",
  inspection: "Based on approved inspection and clearance activity records.",
};

const CHART_CONFIGS: Record<
  ReportType,
  {
    trendTitle: string;
    trendSubtitle: string;
    speciesTitle: string;
    speciesSubtitle: string;
    unit: string;
  }
> = {
  slaughter: {
    trendTitle: "Slaughter Trend",
    trendSubtitle: "Animals slaughtered per month.",
    speciesTitle: "Slaughter by Species",
    speciesSubtitle: "Approved animals slaughtered.",
    unit: "animals",
  },
  inventory: {
    trendTitle: "Inventory Trend",
    trendSubtitle: "Livestock recorded over time.",
    speciesTitle: "Inventory by Species",
    speciesSubtitle: "Approved registered livestock.",
    unit: "heads",
  },
  production: {
    trendTitle: "Production Trend",
    trendSubtitle: "Approved production output per month.",
    speciesTitle: "Production Distribution",
    speciesSubtitle: "Output by production type and species.",
    unit: "units",
  },
  disease_mortality: {
    trendTitle: "Surveillance Trend",
    trendSubtitle: "Reported disease and mortality events over time.",
    speciesTitle: "Cases by Species",
    speciesSubtitle: "Approved affected animals.",
    unit: "cases",
  },
  movement: {
    trendTitle: "Movement Trend",
    trendSubtitle: "Livestock movement lines per month.",
    speciesTitle: "Movement by Species",
    speciesSubtitle: "Approved movement volume.",
    unit: "heads",
  },
  inspection: {
    trendTitle: "Inspection Trend",
    trendSubtitle: "Approved inspections per month.",
    speciesTitle: "Inspections by Species",
    speciesSubtitle: "Approved animals inspected.",
    unit: "inspections",
  },
};

const SPECIES_CONFIG = [
  { name: "Cattle", color: "#0ea5e9", dotClass: "bg-sky-500" },
  { name: "Carabao", color: "#f97316", dotClass: "bg-orange-500" },
  { name: "Goat", color: "#10b981", dotClass: "bg-emerald-500" },
  { name: "Sheep", color: "#f59e0b", dotClass: "bg-amber-500" },
  { name: "Others", color: "#ef4444", dotClass: "bg-rose-500" },
];

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const dateValue = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const formatDate = (value: string) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
};

const EMPTY_FILTERS: ReportFilters = { species: "", barangay: "", purpose: "", direction: "" };

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const detail =
      responseData && typeof responseData === "object" && "detail" in responseData
        ? responseData.detail
        : undefined;
    if (error.response?.status === 401 || error.response?.status === 403) {
      return typeof detail === "string"
        ? detail
        : "You are not authorized to view this report. Check your reporting scope.";
    }
    if (error.response?.status === 400 || error.response?.status === 422) {
      return "Check the selected report dates and try again.";
    }
  }
  return "The report could not be loaded. Please try again.";
}

function deriveSummaryKpis(report: OfficialReport, reportType: ReportType) {
  const rows = report.rows ?? [];
  const summary = (report.summary as Record<string, number | string | null>) ?? {};

  const sumAmount = (key: string) =>
    rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);

  const countDistinct = (key: string) =>
    new Set(rows.map((r) => r[key]).filter((v) => v != null && v !== "")).size;

  switch (reportType) {
    case "slaughter": {
      const animals = Number(summary.animals_slaughtered ?? sumAmount("quantity"));
      const records = report.record_count ?? rows.length;
      const weight = rows.reduce((acc, r) => acc + (Number(r.carcass_weight_kg) || 0), 0);
      const species = countDistinct("species");
      return [
        {
          label: "Animals slaughtered",
          value: animals.toLocaleString(),
          detail: "heads",
          icon: Beef,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Slaughter records",
          value: records.toLocaleString(),
          detail: "approved records",
          icon: ClipboardCheck,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Total carcass weight",
          value: weight.toLocaleString(),
          detail: "kilograms (kg)",
          icon: Weight,
          bgClass: "bg-blue-100/70",
          textClass: "text-blue-700",
        },
        {
          label: "Species recorded",
          value: species.toLocaleString(),
          detail: "species",
          icon: PieIcon,
          bgClass: "bg-purple-100/70",
          textClass: "text-purple-700",
        },
      ];
    }
    case "inventory": {
      const heads = Number(summary.total_heads ?? sumAmount("quantity"));
      const records = report.record_count ?? rows.length;
      const species = countDistinct("species");
      const barangays = countDistinct("barangay");
      return [
        {
          label: "Registered livestock",
          value: heads.toLocaleString(),
          detail: "heads",
          icon: PawPrint,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Inventory records",
          value: records.toLocaleString(),
          detail: "approved records",
          icon: ClipboardCheck,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Species recorded",
          value: species.toLocaleString(),
          detail: "species",
          icon: Scale,
          bgClass: "bg-blue-100/70",
          textClass: "text-blue-700",
        },
        {
          label: "Barangays represented",
          value: barangays.toLocaleString(),
          detail: "barangays",
          icon: PieIcon,
          bgClass: "bg-purple-100/70",
          textClass: "text-purple-700",
        },
      ];
    }
    case "production": {
      const totalOutput = sumAmount("quantity");
      const records = report.record_count ?? rows.length;
      const farmers = Number(summary.contributing_farmers ?? countDistinct("farmer_name"));
      const types = countDistinct("production_type");
      return [
        {
          label: "Total production output",
          value: totalOutput.toLocaleString(),
          detail: "volume / items",
          icon: ClipboardCheck,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Production records",
          value: records.toLocaleString(),
          detail: "approved records",
          icon: FileText,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Contributing producers",
          value: farmers.toLocaleString(),
          detail: "farmers / producers",
          icon: Scale,
          bgClass: "bg-blue-100/70",
          textClass: "text-blue-700",
        },
        {
          label: "Production types",
          value: types.toLocaleString(),
          detail: "types recorded",
          icon: PieIcon,
          bgClass: "bg-purple-100/70",
          textClass: "text-purple-700",
        },
      ];
    }
    case "disease_mortality": {
      const diseases = rows.filter((r) => r.record_kind === "DISEASE");
      const deaths = rows.filter((r) => r.record_kind === "MORTALITY");
      const affected = rows.reduce((acc, r) => acc + (Number(r.affected_or_dead) || 0), 0);
      const conditions = countDistinct("condition_or_cause");
      return [
        {
          label: "Reported disease cases",
          value: diseases.length.toLocaleString(),
          detail: "cases",
          icon: HeartPulse,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Mortality records",
          value: deaths.length.toLocaleString(),
          detail: "approved records",
          icon: FileText,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Affected animals / deaths",
          value: affected.toLocaleString(),
          detail: "heads",
          icon: Scale,
          bgClass: "bg-blue-100/70",
          textClass: "text-blue-700",
        },
        {
          label: "Conditions recorded",
          value: conditions.toLocaleString(),
          detail: "conditions",
          icon: PieIcon,
          bgClass: "bg-purple-100/70",
          textClass: "text-purple-700",
        },
      ];
    }
    case "movement": {
      const auction = rows.filter((r) => r.record_kind === "AUCTION");
      const items = sumAmount("quantity");
      const species = countDistinct("species");
      return [
        {
          label: "Livestock processed",
          value: items.toLocaleString(),
          detail: "heads / items",
          icon: ArrowLeftRight,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Auction records",
          value: auction.length.toLocaleString(),
          detail: "approved records",
          icon: FileText,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Movement clearances",
          value: countDistinct("control_number").toLocaleString(),
          detail: "clearances",
          icon: Scale,
          bgClass: "bg-blue-100/70",
          textClass: "text-blue-700",
        },
        {
          label: "Species recorded",
          value: species.toLocaleString(),
          detail: "species",
          icon: PieIcon,
          bgClass: "bg-purple-100/70",
          textClass: "text-purple-700",
        },
      ];
    }
    case "inspection": {
      const count = countDistinct("control_number") || rows.length;
      const heads = sumAmount("quantity");
      const purposes = countDistinct("purpose");
      return [
        {
          label: "Approved inspections",
          value: count.toLocaleString(),
          detail: "inspections",
          icon: ShieldCheck,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Clearance records",
          value: (report.record_count ?? rows.length).toLocaleString(),
          detail: "approved records",
          icon: FileSpreadsheet,
          bgClass: "bg-emerald-100/70",
          textClass: "text-emerald-800",
        },
        {
          label: "Animals inspected",
          value: heads.toLocaleString(),
          detail: "heads",
          icon: Scale,
          bgClass: "bg-blue-100/70",
          textClass: "text-blue-700",
        },
        {
          label: "Clearance purposes",
          value: purposes.toLocaleString(),
          detail: "purposes recorded",
          icon: PieIcon,
          bgClass: "bg-purple-100/70",
          textClass: "text-purple-700",
        },
      ];
    }
  }
}

function TrendChartComponent({
  rows,
  dateFrom,
  dateTo,
  unit,
}: {
  rows: OfficialReport["rows"];
  dateFrom: string;
  dateTo: string;
  unit: string;
}) {
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const date = String(row.record_date ?? "");
      if (!date) continue;
      const key = date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + (Number(row.quantity) || 1));
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month, value }));
  }, [rows]);

  const hasData = totals.length > 0 && totals.some((d) => d.value > 0);

  // Generate 7 coordinate ticks across the selected date range
  const emptyGridTicks = useMemo(() => {
    if (!dateFrom || !dateTo) {
      return [
        { name: "Oct 1", value: 0 },
        { name: "Oct 5", value: 0 },
        { name: "Oct 10", value: 0 },
        { name: "Oct 15", value: 0 },
        { name: "Oct 20", value: 0 },
        { name: "Oct 25", value: 0 },
        { name: "Oct 30", value: 0 },
      ];
    }
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);
    const span = Math.max(end.getTime() - start.getTime(), 86_400_000 * 6);
    const count = 7;
    const ticks: { name: string; value: number }[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(start.getTime() + (span / (count - 1)) * i);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      ticks.push({ name: label, value: 0 });
    }
    return ticks;
  }, [dateFrom, dateTo]);

  if (!hasData) {
    return (
      <div className="relative h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={emptyGridTicks} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={{ stroke: "#e2e8f0" }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 pb-6">
          <BarChart3 className="size-6 text-slate-400" />
          <p className="text-sm font-medium text-slate-500">No data available for the selected filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={totals} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} ${unit}`, "Total"]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#047857"
            strokeWidth={3}
            dot={{ r: 4, fill: "#047857" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SpeciesBreakdownComponent({
  rows,
}: {
  rows: OfficialReport["rows"];
}) {
  const { speciesStats, totalHeads } = useMemo(() => {
    let total = 0;
    const countMap: Record<string, number> = {
      Cattle: 0,
      Carabao: 0,
      Goat: 0,
      Sheep: 0,
      Others: 0,
    };

    for (const row of rows) {
      const sp = String(row.species ?? row.livestock_type ?? "").trim();
      const qty = Number(row.quantity) || 1;
      total += qty;
      if (/cattle/i.test(sp)) {
        countMap.Cattle += qty;
      } else if (/carabao/i.test(sp)) {
        countMap.Carabao += qty;
      } else if (/goat/i.test(sp)) {
        countMap.Goat += qty;
      } else if (/sheep/i.test(sp)) {
        countMap.Sheep += qty;
      } else {
        countMap.Others += qty;
      }
    }

    const stats = SPECIES_CONFIG.map((conf) => {
      const count = countMap[conf.name] ?? 0;
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        ...conf,
        count,
        percent,
      };
    });

    return { speciesStats: stats, totalHeads: total };
  }, [rows]);

  const hasData = totalHeads > 0;
  const pieData = speciesStats.filter((s) => s.count > 0);

  return (
    <div className="flex h-64 flex-col justify-between sm:flex-row sm:items-center">
      {/* Left side: Donut ring and Species legend */}
      <div className="flex items-center gap-6 px-2 py-4">
        {/* Donut ring */}
        <div className="relative size-32 shrink-0">
          {!hasData ? (
            <svg width="128" height="128" viewBox="0 0 128 128" className="size-full">
              <circle
                cx="64"
                cy="64"
                r="46"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="20"
              />
            </svg>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={36}
                  outerRadius={56}
                  paddingAngle={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => Number(v).toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {speciesStats.map((item) => (
            <div key={item.name} className="flex items-center gap-2.5 text-xs">
              <span className={`size-2.5 shrink-0 rounded-full ${item.dotClass}`} />
              <span className="w-16 font-medium text-slate-700">{item.name}</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {item.count} ({item.percent}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right side: divider and empty status or additional summary */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 border-t border-slate-100 py-6 sm:border-t-0 sm:border-l sm:py-0">
        <FileText className="size-8 stroke-[1.5] text-slate-400" />
        <p className="text-sm font-medium text-slate-500">
          {hasData ? "Approved records recorded." : "No data available for the selected filters."}
        </p>
      </div>
    </div>
  );
}

export function OfficialReportsWorkspace({
  variant = "sibat",
  reportingScope: initialScope,
  isAllBarangays: initialIsAllBarangays = false,
}: OfficialReportsWorkspaceProps) {
  const isBarangayWorkspace = variant === "sibat";
  const now = new Date();

  const [reportType, setReportType] = useState<ReportType>("slaughter");
  const [dateFrom, setDateFrom] = useState(
    dateValue(new Date(now.getFullYear(), now.getMonth(), 1))
  );
  const [dateTo, setDateTo] = useState(today());
  const [species, setSpecies] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState(
    isBarangayWorkspace ? initialScope ?? "" : ""
  );

  const [report, setReport] = useState<OfficialReport | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [error, setError] = useState("");

  const livestockTypesQuery = useQuery({
    queryKey: ["livestock-types"],
    queryFn: async () =>
      (await api.get<{ id: number; name: string }[]>("livestock/livestock_types/")).data,
    staleTime: 5 * 60 * 1000,
  });

  const livestockTypes = useMemo(
    () => [...(livestockTypesQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [livestockTypesQuery.data]
  );

  const effectiveReportingArea = isBarangayWorkspace
    ? initialScope || "Manggas"
    : selectedBarangay || (initialIsAllBarangays ? "All Barangays" : "Padre Garcia (All Barangays)");

  const filters: ReportFilters = useMemo(
    () => ({
      ...EMPTY_FILTERS,
      species,
      barangay: isBarangayWorkspace ? initialScope ?? "" : selectedBarangay,
    }),
    [species, isBarangayWorkspace, initialScope, selectedBarangay]
  );

  const currentKey = JSON.stringify([reportType, dateFrom, dateTo, filters, effectiveReportingArea]);
  const previewIsCurrent = Boolean(report && previewKey === currentKey);

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    setPreviewKey("");
    try {
      const data = await fetchOfficialReport(reportType, dateFrom, dateTo, filters);
      setReport(data);
      setPreviewKey(currentKey);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: "pdf" | "xlsx") => {
    if (!previewIsCurrent) return;
    setExporting(format);
    setError("");
    try {
      const response = await downloadOfficialReport(reportType, dateFrom, dateTo, filters, format);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      const scopeSlug = effectiveReportingArea.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      link.download = `${scopeSlug}_${reportType}_${dateFrom}_${dateTo}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setExporting(null);
    }
  };

  const selectedOption =
    REPORT_OPTIONS.find((opt) => opt.value === reportType) ?? REPORT_OPTIONS[3];

  const summaryKpis = useMemo(
    () => (report ? deriveSummaryKpis(report, reportType) : []),
    [report, reportType]
  );

  const chartConfig = CHART_CONFIGS[reportType];

  return (
    <main className="mx-auto w-full max-w-screen-2xl space-y-6 px-3.5 py-4 pb-14 sm:px-6 lg:px-8 lg:py-6">
      {/* 1. Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-100/70 text-emerald-800 sm:size-14">
            <FileText className="size-6 sm:size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Reports</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {isBarangayWorkspace
                ? "View and manage livestock reports in your assigned reporting area."
                : "View and manage livestock reports and official municipal records."}
            </p>
          </div>
        </div>

        {/* Location pill */}
        <div className="flex items-center gap-3 self-start rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 sm:self-auto">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800">
            <MapPin className="size-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">
              Reporting area:{" "}
              <span className="font-extrabold text-slate-950">{effectiveReportingArea}</span>{" "}
              <span className="text-xs font-semibold text-slate-500">
                ({isBarangayWorkspace ? "Fixed" : selectedBarangay ? "Filtered" : "All Barangays"})
              </span>
            </div>
            <div className="text-xs text-slate-500">
              {isBarangayWorkspace
                ? `You can view reports for ${effectiveReportingArea} only.`
                : "You can view reports across all barangays."}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Choose a Report Type */}
      <section aria-labelledby="choose-report-heading" className="space-y-3">
        <div>
          <h2 id="choose-report-heading" className="text-lg font-black text-slate-950">
            Choose a Report Type
          </h2>
          <p className="text-sm text-slate-500">Select a category to build and export a report.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {REPORT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = reportType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setReportType(option.value)}
                className={`group flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-50/30 ring-2 ring-emerald-100/60"
                    : "border-slate-200/90 bg-white hover:border-emerald-300 hover:bg-emerald-50/20"
                }`}
              >
                <div
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${
                    isSelected ? "bg-emerald-100 text-emerald-800" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 leading-tight">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-slate-500">
                    {option.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Set Report Filters */}
      <Card className="gap-0 rounded-2xl border-slate-200/90 bg-white py-0 shadow-xs">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-lg font-black text-slate-950">Set Report Filters</CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Choose a reporting period and optional livestock type.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div
              className={`grid gap-4 ${
                isBarangayWorkspace
                  ? "sm:grid-cols-2 lg:grid-cols-3"
                  : "sm:grid-cols-2 lg:grid-cols-4"
              }`}
            >
              <div className="space-y-1.5">
                <Label htmlFor="report-from" className="text-xs font-semibold text-slate-700">
                  From
                </Label>
                <Input
                  id="report-from"
                  type="date"
                  required
                  value={dateFrom}
                  max={dateTo}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-to" className="text-xs font-semibold text-slate-700">
                  To
                </Label>
                <Input
                  id="report-to"
                  type="date"
                  required
                  value={dateTo}
                  min={dateFrom}
                  max={today()}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-species" className="text-xs font-semibold text-slate-700">
                  Livestock type <span className="font-normal text-slate-400">(optional)</span>
                </Label>
                <Select
                  value={species || "ALL"}
                  onValueChange={(val) => setSpecies(val === "ALL" ? "" : val)}
                  disabled={livestockTypesQuery.isPending}
                >
                  <SelectTrigger id="report-species" className="h-11 rounded-xl">
                    <SelectValue placeholder="All livestock types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All livestock types</SelectItem>
                    {livestockTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isBarangayWorkspace && (
                <div className="space-y-1.5">
                  <Label htmlFor="report-barangay" className="text-xs font-semibold text-slate-700">
                    Barangay <span className="font-normal text-slate-400">(optional)</span>
                  </Label>
                  <Select
                    value={selectedBarangay || "ALL"}
                    onValueChange={(val) => setSelectedBarangay(val === "ALL" ? "" : val)}
                  >
                    <SelectTrigger id="report-barangay" className="h-11 rounded-xl">
                      <SelectValue placeholder="All barangays" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All barangays</SelectItem>
                      {PADRE_GARCIA_BARANGAYS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <CalendarDays className="size-4 text-slate-400" />
                <span>
                  {dateFrom ? formatDate(dateFrom) : "Choose start date"} –{" "}
                  {dateTo ? formatDate(dateTo) : "Choose end date"}
                </span>
              </div>
              <Button
                type="submit"
                disabled={loading || !dateFrom || !dateTo || dateFrom > dateTo}
                className="h-11 gap-2 rounded-xl bg-emerald-800 px-5 text-white hover:bg-emerald-900"
              >
                {loading ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" /> Preparing report…
                  </>
                ) : (
                  <>
                    <FileText className="size-4" /> Generate report
                  </>
                )}
              </Button>
            </div>
          </form>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 4. Report Summary & Content */}
      {previewIsCurrent && report ? (
        <section className="space-y-5" aria-labelledby="report-summary-heading">
          {/* Summary Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 id="report-summary-heading" className="text-xl font-black text-slate-950">
                  {selectedOption.label} Report - Summary
                </h2>
                <Badge className="rounded-full border-0 bg-emerald-100/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  Approved records only
                </Badge>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-600">
                {effectiveReportingArea} · {formatDate(report.period.date_from)} –{" "}
                {formatDate(report.period.date_to)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {REPORT_SUMMARY_DESCRIPTIONS[reportType]}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(exporting)}
                onClick={() => void exportReport("xlsx")}
                className="h-10 gap-2 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                {exporting === "xlsx" ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="size-4" />
                )}
                Download Excel
              </Button>
              <Button
                type="button"
                disabled={Boolean(exporting)}
                onClick={() => void exportReport("pdf")}
                className="h-10 gap-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900"
              >
                {exporting === "pdf" ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Download PDF
              </Button>
            </div>
          </div>

          {/* 4 KPI Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryKpis.map((kpi) => (
              <div
                key={kpi.label}
                className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs"
              >
                <div
                  className={`grid size-12 shrink-0 place-items-center rounded-2xl ${kpi.bgClass} ${kpi.textClass}`}
                >
                  <kpi.icon className="size-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-500">{kpi.label}</p>
                  <p className="text-2xl font-black tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                    {kpi.value}
                  </p>
                  <p className="truncate text-xs text-slate-500">{kpi.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 5. Charts Section */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Left Card: Trend */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <div className="mb-3">
                <h3 className="font-bold text-slate-950">{chartConfig.trendTitle}</h3>
                <p className="text-xs text-slate-500">{chartConfig.trendSubtitle}</p>
              </div>
              <TrendChartComponent
                rows={report.rows}
                dateFrom={report.period.date_from}
                dateTo={report.period.date_to}
                unit={chartConfig.unit}
              />
            </div>

            {/* Right Card: Species Breakdown */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <div className="mb-3">
                <h3 className="font-bold text-slate-950">{chartConfig.speciesTitle}</h3>
                <p className="text-xs text-slate-500">{chartConfig.speciesSubtitle}</p>
              </div>
              <SpeciesBreakdownComponent rows={report.rows} />
            </div>
          </div>

          {/* 6. Records Table Section */}
          <Card className="gap-0 overflow-hidden rounded-2xl border-slate-200/90 bg-white py-0 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
              <div>
                <h3 className="font-bold text-slate-900">Records for {effectiveReportingArea}</h3>
                <p className="text-xs text-slate-500">
                  List of approved {selectedOption.label.toLowerCase()} records in the selected period.
                </p>
              </div>
              <Badge
                variant="outline"
                className="rounded-full border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
              >
                Approved records
              </Badge>
            </div>

            {report.rows.length === 0 ? (
              <div className="flex items-center justify-center gap-3.5 px-4 py-10">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                  <FileText className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    No approved records found in this barangay for this period.
                  </p>
                  <p className="text-xs text-slate-500">
                    Choose a wider date range or another record category.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Mobile list view */}
                <div className="space-y-3 p-3 md:hidden">
                  {report.rows.map((row, index) => (
                    <article
                      key={`${index}-${String(row.control_number ?? row.tag_id ?? row.record_date ?? "row")}`}
                      className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs"
                    >
                      <dl className="grid grid-cols-1 gap-x-3 gap-y-2 min-[420px]:grid-cols-2">
                        {report.columns.map((column) => (
                          <div key={column.key} className="min-w-0">
                            <dt className="text-xs font-medium text-slate-500">{column.label}</dt>
                            <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">
                              {row[column.key] == null || row[column.key] === ""
                                ? "—"
                                : String(row[column.key])}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden max-h-[34rem] overflow-auto md:block">
                  <Table className="min-w-max">
                    <TableHeader className="sticky top-0 z-10 bg-slate-50">
                      <TableRow className="border-b border-slate-200">
                        {report.columns.map((column) => (
                          <TableHead
                            key={column.key}
                            className="px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-700"
                          >
                            {column.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.rows.map((row, index) => (
                        <TableRow
                          key={`${index}-${String(row.control_number ?? row.tag_id ?? row.record_date ?? "row")}`}
                          className="odd:bg-white even:bg-slate-50/60 hover:bg-slate-50"
                        >
                          {report.columns.map((column) => (
                            <TableCell
                              key={column.key}
                              className="max-w-72 whitespace-normal px-3 py-2.5 text-sm align-top text-slate-700"
                            >
                              {row[column.key] == null || row[column.key] === ""
                                ? "—"
                                : String(row[column.key])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </Card>
        </section>
      ) : (
        !loading && (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center sm:p-10">
            <FileText className="mx-auto size-8 text-slate-400" />
            <h2 className="mt-3 font-bold text-slate-900">Your report will appear here</h2>
            <p className="mt-1 text-sm text-slate-600">
              Select a record category and dates to review approved activity in {effectiveReportingArea}.
            </p>
          </section>
        )
      )}
    </main>
  );
}
