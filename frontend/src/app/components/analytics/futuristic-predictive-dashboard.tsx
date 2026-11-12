"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { PopulationForecastPanel, usePopulationForecast } from "./population-forecast-panel";
import { CattleProfilePrice } from "./cattle-profile-price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Cpu,
  Database,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  HelpCircle,
  History,
  Info,
  LineChart as LineChartIcon,
  Percent,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Table as TableIcon,
  TrendingDown,
  TrendingUp,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

// ---------------------------------------------------------------------------
// DATA CONTRACTS & TYPE DEFINITIONS
// ---------------------------------------------------------------------------

export interface ReadinessSummaryCard {
  id: string;
  label: string;
  domain: string;
  target: string;
  unit: string;
  transfer_source?: "REGISTERED" | "EXTERNAL" | null;
  reporting_type: string;
  frequency?: "MONTHLY" | "WEEKLY";
  observation_label?: string;
  description: string;
  forecast_status: "READY" | "AVAILABLE_UNVALIDATED" | "NEEDS_ATTENTION" | "INSUFFICIENT_DATA" | "ERROR";
  forecast_available: boolean;
  validation_status: "VALIDATED" | "NOT_YET_VALIDATED" | "INSUFFICIENT_DATA";
  readiness_status: string;
  usable_observations: number;
  older_covered_observations?: number;
  required_observations: number;
  observations_progress_pct: number;
  valid_cutoffs_count: number;
  total_cutoffs_count: number;
  blocker_summary: string;
  next_step: string;
  milestone_label: string;
  model_name: string | null;
  last_evaluated_at: string;
}

export interface DiagnosticChecklistItem {
  id: string;
  title: string;
  category: "DATA_COLLECTION" | "DATA_QUALITY" | "VALIDATION_INTEGRITY" | "MODEL_EXECUTION" | "FORECAST_DELIVERY";
  status: "PASSED" | "WARNING" | "BLOCKED" | "NOT_APPLICABLE";
  actual_value: string;
  expected_requirement: string;
  explanation: string;
  action_needed: string | null;
  resolution_type: string;
}

export interface CutoffDiagnosticEntry {
  forecast_month?: string;
  forecast_week?: string;
  cutoff_date: string;
  available_training_months?: number;
  available_training_weeks?: number;
  earliest_training_month?: string | null;
  latest_training_month?: string | null;
  status: "EVALUATED" | "SKIPPED" | "NOT_ENOUGH_APPROVED_HISTORY" | "GAPS_IN_APPROVED_HISTORY" | "INCOMPLETE_TEST_WINDOW" | "MODEL_FAILURE";
  reason: string;
}

export interface DiagnosticChartPoint {
  date: string;
  month_label: string;
  actual: number | null;
  forecast: number | null;
  confidence_lower?: number | null;
  confidence_upper?: number | null;
  is_future: boolean;
}

export interface TargetDiagnosticDetail {
  metric_id: string;
  domain: string;
  target: string;
  unit: string;
  transfer_source?: "REGISTERED" | "EXTERNAL" | null;
  label: string;
  source: string;
  expected_reporting: string;
  frequency?: "MONTHLY" | "WEEKLY";
  minimum_rule: string;
  forecast_status: "READY" | "AVAILABLE_UNVALIDATED" | "NEEDS_ATTENTION" | "INSUFFICIENT_DATA" | "ERROR";
  forecast_available: boolean;
  validation_status: "VALIDATED" | "NOT_YET_VALIDATED" | "INSUFFICIENT_DATA";
  validation_details: string;
  readiness_status: string;
  readiness_details: string;
  blocker_summary: string;
  next_step: string;
  progress: {
    usable_observations: number;
    required_observations: number;
    observations_progress_pct: number;
    quality_threshold: number;
    total_records: number;
    missing_month_count: number;
    missing_months: string[];
    missing_week_count?: number;
    missing_weeks?: string[];
    unmeasured_records: number;
    approval_reconstructable: boolean;
    valid_cutoffs_count: number;
    total_cutoffs_count: number;
    milestone_label: string;
    data_through_date?: string | null;
  };
  checklist: DiagnosticChecklistItem[];
  backtesting?: {
    valid_cutoffs_count: number;
    total_attempted_cutoffs: number;
    minimum_required_windows?: number;
    evaluation_horizon_months?: number;
    evaluation_horizon_weeks?: number;
    cutoffs: CutoffDiagnosticEntry[];
    cutoff_timeline?: CutoffDiagnosticEntry[];
    winning_model?: string | null;
    baseline_mae?: number | null;
    selected_mae?: number | null;
    models: Record<string, { mae: number | null; rmse?: number | null; r2?: number | null; name?: string }>;
    model_metrics?: Record<string, { mae: number | null; rmse?: number | null; r2?: number | null; name?: string }>;
  };
  evaluation?: {
    valid_cutoffs_count: number;
    total_attempted_cutoffs: number;
    winning_model: string | null;
    baseline_mae: number | null;
    selected_mae: number | null;
    model_metrics?: Record<string, { mae: number | null; rmse?: number | null; r2?: number | null }>;
    models?: Record<string, { mae: number | null; rmse?: number | null; r2?: number | null }>;
    cutoff_timeline?: CutoffDiagnosticEntry[];
    cutoffs?: CutoffDiagnosticEntry[];
  };
  forecast: {
    model_name: string | null;
    horizon_months: number;
    horizon_weeks?: number;
    forecast_points: Array<{
      date: string;
      month_label: string;
      predicted: number;
      confidence_lower?: number;
      confidence_upper?: number;
    }>;
    chart_data: DiagnosticChartPoint[];
    metadata: {
      last_historical_date?: string;
      recent_baseline_avg?: number;
      forecast_period_avg?: number;
      projected_change_pct?: number;
    };
  };
  last_evaluated_at: string;
}

export interface DiagnosticsApiResponse {
  status: string;
  last_checked_at: string;
  summary_cards: ReadinessSummaryCard[];
  diagnostics: Record<string, TargetDiagnosticDetail>;
}

type DiseaseBreakdownRow = {
  name: string;
  cases: number;
  affected_heads: number;
};

type DiseaseBreakdownResponse = {
  descriptive?: {
    disease?: {
      by_type?: DiseaseBreakdownRow[];
    };
  };
};

// ---------------------------------------------------------------------------
// HELPER FORMATTERS
// ---------------------------------------------------------------------------

function formatReadableDate(value?: string | null) {
  if (!value) return null;
  try {
    const dateStr = value.includes("T") ? value : `${value}T00:00:00`;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function formatTargetUnit(unit: string) {
  const u = unit.toUpperCase();
  if (u === "LITERS") return "liters";
  if (u === "KILOGRAMS") return "kg";
  if (u === "HEADS") return "animals";
  if (u === "CASES") return "cases";
  if (u === "PHP_PER_HEAD") return "₱ per head";
  return unit;
}

function readableMethodName(name?: string | null) {
  return name?.trim() || "Not selected";
}

function readableDomain(domain: string) {
  const labels: Record<string, string> = {
    disease: "Disease",
    mortality: "Mortality",
    slaughter: "Slaughter",
    auction: "Livestock sales",
    production: "Production",
  };
  return labels[domain.toLowerCase()] || domain.replaceAll("_", " ");
}

function readableReportingType(type: string) {
  const labels: Record<string, string> = {
    MONTHLY_TOTAL: "Monthly total",
    EVENT_BASED: "Recorded events",
    TRANSFER_EVENT_BASED: "Livestock transfers",
    SALE_PRICE_BASED: "Recorded sale prices",
  };
  return labels[type] || type.replaceAll("_", " ").toLowerCase();
}

function readableCheckStatus(status: string) {
  const labels: Record<string, string> = {
    EVALUATED: "Completed",
    SKIPPED: "Not checked",
    NOT_ENOUGH_APPROVED_HISTORY: "Not enough approved records",
    GAPS_IN_APPROVED_HISTORY: "Missing past records",
    INCOMPLETE_TEST_WINDOW: "Not enough later records to compare",
    MODEL_FAILURE: "Could not complete the check",
  };
  return labels[status] || "Not checked";
}

function getTargetIcon(id: string) {
  switch (id) {
    case "livestock_sales":
      return ShoppingBag;
    case "registered_cattle_price":
    case "external_cattle_price":
      return Scale;
    case "slaughter_meat":
      return Scale;
    default:
      return Activity;
  }
}

// Custom crisp HUD tooltip for Recharts (Light & Green)
function MissionControlTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-emerald-300 bg-white/95 p-3 text-xs text-slate-900 shadow-xl backdrop-blur-md">
      <div className="border-b border-slate-100 pb-1.5 mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-emerald-800 font-bold">{label}</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{unit}</span>
      </div>
      <div className="space-y-1.5">
        {payload.map((item: any, index: number) => {
          if (item.value == null) return null;
          const isForecast = item.dataKey === "forecast";
          const isActual = item.dataKey === "actual";
          return (
            <div key={`${item.dataKey}-${item.name}-${index}`} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: item.color || (isForecast ? "#059669" : "#64748b") }}
                />
                <span className="text-slate-600 font-medium">
              {isForecast ? "Estimate" : isActual ? (unit === "₱ per head" ? "Recorded average price" : "Recorded amount") : item.name}
                </span>
              </div>
              <span className="font-mono font-bold text-slate-900">
                {Number(item.value).toLocaleString("en-PH", { maximumFractionDigits: 1 })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT: FuturisticPredictiveDashboard (Light & Green Municipal Intelligence)
// ---------------------------------------------------------------------------

function getTargetFromDomain(domain: string | null): string {
  if (!domain) return "disease_reports";
  const d = domain.toLowerCase();
  if (d === "slaughter") return "slaughter_meat";
  if (d === "auction" || d === "sales") return "livestock_sales";
  if (d === "mortality") return "mortality_deaths";
  if (d === "disease") return "disease_reports";
  return "disease_reports";
}

export function PredictiveLoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading forecast information"
      className="relative grid min-h-[420px] place-items-center overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-xs"
    >
      <div className="pointer-events-none absolute -right-12 -top-16 size-64 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 size-64 rounded-full bg-teal-400/10 blur-3xl" />
      <div className="relative w-full max-w-lg text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-700 shadow-sm">
          <BarChart3 className="size-7 animate-pulse" />
        </div>
        <p className="mt-5 text-xs font-mono font-bold uppercase tracking-[0.18em] text-emerald-800">
          Forecasts & Trends
        </p>
        <h2 className="mt-2 text-xl font-extrabold text-slate-900">Preparing your forecast view</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Checking approved records and getting the charts ready.
        </p>
        <div className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-4 py-2 text-xs font-semibold text-emerald-800">
          <RefreshCw className="size-3.5 animate-spin" />
          Loading forecast information
        </div>
        <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-emerald-100">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-emerald-600" />
        </div>
      </div>
    </div>
  );
}

export function FuturisticPredictiveDashboard({ selectedDomainProp }: { selectedDomainProp?: string }) {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const domainParam = selectedDomainProp || searchParams?.get("domain");
  const targetParam = searchParams?.get("target");
  const targetFromParam = targetParam || getTargetFromDomain(domainParam ?? null);

  const [selectedTargetId, setSelectedTargetId] = useState<string>(targetFromParam);

  useEffect(() => {
    if (targetFromParam) {
      setSelectedTargetId(targetFromParam);
    }
  }, [targetFromParam]);
  const [horizonMonths, setHorizonMonths] = useState<number>(6);
  const populationDomain = selectedDomainProp === "inventory" || selectedDomainProp === "barangay";
  const [populationSelected, setPopulationSelected] = useState(populationDomain);
  useEffect(() => { setPopulationSelected(populationDomain); }, [populationDomain]);
  const populationQuery = usePopulationForecast(horizonMonths);
  const [viewMode, setViewMode] = useState<"overview" | "backtest" | "models" | "checklist">("overview");
  const [cattlePriceView, setCattlePriceView] = useState<"trend" | "profile">("profile");
  const [showTableView, setShowTableView] = useState<boolean>(false);
  const [timelinePage, setTimelinePage] = useState(0);
  const [historyWindowMonths, setHistoryWindowMonths] = useState<number | "all">(12);
  const timelinePageSize = 10;

  // Fetch Authoritative Readiness Diagnostics from Backend
  const { data, isPending, isError, error, refetch, isFetching } = useQuery<DiagnosticsApiResponse>({
    queryKey: ["forecast-diagnostics", user?.email, user?.role, user?.accessScope, user?.assignedBarangayId, selectedDomainProp || "all", horizonMonths],
    enabled: Boolean(user) && !populationDomain,
    retry: 1,
    queryFn: async ({ signal }) => {
      const res = await api.get<DiagnosticsApiResponse>("analytics/predictive/diagnostics/", {
        params: { horizon: horizonMonths, category: selectedDomainProp },
        signal,
        timeout: 120_000,
      });
      return res.data;
    },
    staleTime: 60_000,
  });

  const summaryCards = (data?.summary_cards || []).filter(
    (card) => {
      if (card.domain.toLowerCase() === "production") return false;
      if (!selectedDomainProp) return true;
      if (populationDomain) return false;
      if (selectedDomainProp === "disease") return /disease|mortality|vaccination/i.test(card.domain + card.id);
      if (selectedDomainProp === "auction") return /auction|sales|price/i.test(card.domain + card.id);
      return /slaughter/i.test(card.domain + card.id);
    },
  );
  const registeredCattlePriceCard = summaryCards.find((card) => card.id === "registered_cattle_price");
  const externalCattlePriceCard = summaryCards.find((card) => card.id === "external_cattle_price");
  const hasCattlePriceSourceTabs = Boolean(registeredCattlePriceCard && externalCattlePriceCard);
  const displaySummaryCards = summaryCards.filter(
    (card) => !(hasCattlePriceSourceTabs && card.id === "external_cattle_price"),
  );
  const currentCard = summaryCards.find((c) => c.id === selectedTargetId) || summaryCards[0];
  const activeTargetId = currentCard?.id || selectedTargetId;
  const targetDetail: TargetDiagnosticDetail | undefined = data?.diagnostics?.[activeTargetId];
  const diseaseBreakdownQuery = useQuery({
    queryKey: [
      "predictive-disease-breakdown",
      user?.email,
      user?.accessScope,
      user?.assignedBarangayId,
    ],
    queryFn: async ({ signal }) => {
      const { data: dashboard } = await api.get<DiseaseBreakdownResponse>(
        "analytics/dashboard/",
        { signal },
      );
      return dashboard.descriptive?.disease?.by_type ?? [];
    },
    enabled: currentCard?.domain === "disease",
    staleTime: 60_000,
  });
  const TargetIcon = getTargetIcon(activeTargetId);

  // Chart Data preparation
  const rawChartTimeline = targetDetail?.forecast?.chart_data || [];
  const diseaseReportsTimeline = data?.diagnostics?.disease_reports?.forecast?.chart_data ?? [];
  const diseaseHeadsTimeline = data?.diagnostics?.disease_heads?.forecast?.chart_data ?? [];
  const diseaseSeriesOverlap =
    diseaseReportsTimeline.length > 0 &&
    diseaseReportsTimeline.length === diseaseHeadsTimeline.length &&
    diseaseReportsTimeline.every((point, index) => {
      const other = diseaseHeadsTimeline[index];
      return (
        point.date === other.date &&
        point.actual === other.actual &&
        point.forecast === other.forecast
      );
    });
  const isAuctionForecast = currentCard?.domain === "auction";
  const isCattlePriceForecast = currentCard?.unit === "PHP_PER_HEAD";
  const isRegisteredCattlePriceForecast = currentCard?.id === "registered_cattle_price";
  const cattlePriceSourceDescription = isRegisteredCattlePriceForecast
    ? "approved transfers linked to a registered cattle record"
    : "approved external cattle transfers recorded in SmartLivestock";
  const weeklyTargetSelected =
    currentCard?.frequency === "WEEKLY" ||
    ["livestock_sales", "registered_cattle_price", "external_cattle_price"].includes(activeTargetId);
  const horizonUnit = !populationSelected && weeklyTargetSelected ? "weeks" : "months";

  const historyOptions: Array<{ label: string; value: number | "all" }> = useMemo(() => {
    if (weeklyTargetSelected) {
      return [
        { label: "3 months", value: 3 },
        { label: "6 months", value: 6 },
        { label: "12 months", value: 12 },
        { label: "All records", value: "all" },
      ];
    }
    return [
      { label: "6 months", value: 6 },
      { label: "12 months", value: 12 },
      { label: "24 months", value: 24 },
      { label: "All records", value: "all" },
    ];
  }, [weeklyTargetSelected]);

  const activeHistoryWindow = historyOptions.some((opt) => opt.value === historyWindowMonths)
    ? historyWindowMonths
    : 12;

  const hasHistory = rawChartTimeline.some((point) => !point.is_future && point.actual != null);
  const chartTimeline = useMemo(() => {
    if (activeHistoryWindow === "all") return rawChartTimeline;

    const latestHistoricalPoint = [...rawChartTimeline]
      .reverse()
      .find((point) => !point.is_future && point.actual != null);
    if (!latestHistoricalPoint) return rawChartTimeline;

    const cutoff = new Date(`${latestHistoricalPoint.date}T00:00:00.000Z`);
    if (!Number.isFinite(cutoff.getTime())) return rawChartTimeline;
    cutoff.setUTCMonth(cutoff.getUTCMonth() - activeHistoryWindow);
    const cutoffTime = cutoff.getTime();

    return rawChartTimeline.filter((point) => {
      if (point.is_future) return true;
      const pointTime = Date.parse(`${point.date}T00:00:00.000Z`);
      return Number.isFinite(pointTime) && pointTime >= cutoffTime;
    });
  }, [rawChartTimeline, activeHistoryWindow]);
  const timelinePageCount = Math.max(1, Math.ceil(chartTimeline.length / timelinePageSize));
  const safeTimelinePage = Math.min(timelinePage, timelinePageCount - 1);
  const visibleTimeline = chartTimeline.slice(
    safeTimelinePage * timelinePageSize,
    (safeTimelinePage + 1) * timelinePageSize,
  );
  const forecastPoints = targetDetail?.forecast?.forecast_points || [];
  const metadata = targetDetail?.forecast?.metadata || {};
  const backtestInfo = targetDetail?.backtesting || targetDetail?.evaluation;
  const candidateModels = backtestInfo?.models || backtestInfo?.model_metrics || {};
  const cutoffTimeline = backtestInfo?.cutoffs || backtestInfo?.cutoff_timeline || [];

  // Next Period Forecast computation
  const nextForecast = forecastPoints[0];
  const lastHistoricalPoint = useMemo(() => {
    const historical = chartTimeline.filter((p) => p.actual != null && !p.is_future);
    return historical[historical.length - 1];
  }, [chartTimeline]);

  // Model Error metrics
  const winningModel = backtestInfo?.winning_model || targetDetail?.forecast?.model_name || "Naive Baseline";
  const selectedMae = backtestInfo?.selected_mae ?? null;
  const baselineMae = backtestInfo?.baseline_mae ?? null;
  const isBeatingBaseline =
    selectedMae != null && baselineMae != null && selectedMae < baselineMae;
  const baselineImprovementPct =
    isBeatingBaseline && baselineMae && baselineMae > 0
      ? Math.round(((baselineMae - selectedMae) / baselineMae) * 100)
      : null;

  // Validation Status derivation
  const isValidated = targetDetail?.validation_status === "VALIDATED";
  const isAvailableUnvalidated = targetDetail?.forecast_status === "AVAILABLE_UNVALIDATED";
  const isInsufficientData = targetDetail?.forecast_status === "INSUFFICIENT_DATA";

  // Last evaluated timestamp
  const lastEvaluatedFormatted = formatReadableDate(data?.last_checked_at);

  if (isError) {
    return (
      <Card className="rounded-2xl border border-rose-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Could not load forecast information
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                {error instanceof Error ? error.message : "Could not load forecast information. Please try again."}
              </p>
            </div>
          </div>
          <Button
            onClick={() => { void refetch(); void populationQuery.refetch(); }}
            disabled={isFetching}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (isPending && !data && !populationDomain) {
    return <PredictiveLoadingScreen />;
  }

  if (!isPending && summaryCards.length === 0 && !populationDomain) {
    return (
      <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">No forecast topics available</h3>
        <p className="mt-1 text-sm text-slate-600">
          Production forecasts are not shown here. No disease, mortality, slaughter, or livestock-sale records are available for this account.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* ----------------------------------------------------------------- */}
      {/* A. COMPACT PAGE HEADER & HORIZON BAR (Light Emerald Command Banner)*/}
      {/* ----------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/40 p-5 shadow-2xs">
        {/* Subtle decorative grid background glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 size-72 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              Predictive
            </h1>
          </div>

          {/* Horizon Selector and Refresh Button */}
          <div className={`flex flex-wrap items-center gap-3 shrink-0 ${!populationSelected && isCattlePriceForecast && cattlePriceView === "profile" ? "hidden" : ""}`}>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200 p-1 shadow-2xs">
              <span className="px-2 text-[11px] font-mono text-slate-500 uppercase tracking-wider">Forecast ahead:</span>
              {[1, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setHorizonMonths(m);
                    setTimelinePage(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    horizonMonths === m
                      ? "bg-emerald-700 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
                  }`}
                >
                  {m} {m === 1 ? (horizonUnit === "weeks" ? "week" : "month") : horizonUnit}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${isFetching ? "animate-spin text-emerald-600" : "text-slate-500"}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* B. FORECAST TARGET SELECTOR (Light Emerald Segmented Cards)       */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" onClickCapture={(event) => { if (!(event.target as HTMLElement).closest("[data-population-card]")) setPopulationSelected(false); }}>
        {(!selectedDomainProp || populationDomain) && (user?.role === "MAO" || user?.role === "ADMIN") && <button type="button" data-population-card aria-pressed={populationSelected} onClick={() => setPopulationSelected(true)} className={`rounded-2xl border p-4 text-left transition-colors ${populationSelected ? "border-2 border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
          <div className="mb-4 flex justify-between gap-3"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><TrendingUp className="size-5" /></span><span className="text-xs text-slate-500">{populationQuery.isError ? "Could not load" : populationQuery.isPending ? "Loading?" : populationQuery.data?.forecast_available ? "Balance estimate available" : "Current count available"}</span></div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Population ? Registered records</p><p className="mt-1 font-bold">Active Registered Livestock Population</p>
          <p className="mt-2 text-sm text-emerald-800">{populationQuery.data ? `${populationQuery.data.current_heads.toLocaleString()} active heads` : "Approved, active individual animals"}</p><p className="mt-2 text-xs text-slate-500">Registrations + births ? sales ? deaths ? other removals</p>
        </button>}
        {isPending
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl bg-white border border-slate-200" />
            ))
          : displaySummaryCards.map((card) => {
              if (card.id === "registered_cattle_price" && externalCattlePriceCard) {
                const selectedPriceCard = activeTargetId === "external_cattle_price"
                  ? externalCattlePriceCard
                  : card;
                const isSelected = !populationSelected && (activeTargetId === "registered_cattle_price"
                  || activeTargetId === "external_cattle_price");
                const isCardValidated = selectedPriceCard.validation_status === "VALIDATED";
                const isCardAvailable = selectedPriceCard.forecast_available;

                return (
                  <div
                    key="cattle_price"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setPopulationSelected(false);
                      setSelectedTargetId("registered_cattle_price");
                      setTimelinePage(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPopulationSelected(false);
                        setSelectedTargetId("registered_cattle_price");
                        setTimelinePage(0);
                      }
                    }}
                    className={`group relative flex flex-col justify-between rounded-2xl p-4 text-left transition-all duration-200 border cursor-pointer ${
                      isSelected
                        ? "border-2 border-emerald-600 bg-emerald-50/70 shadow-sm"
                        : "border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
                        isSelected ? "bg-emerald-600 text-white shadow-2xs" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                      }`}>
                        <Scale className="size-4.5" />
                      </div>
                      {isCardValidated ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-mono font-bold">
                          Cattle trend checked
                        </Badge>
                      ) : isCardAvailable ? (
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-mono font-bold">
                          Cattle trend not checked
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-mono">
                          Cattle trend unavailable
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                        {readableDomain(card.domain)} | {readableReportingType(card.reporting_type)}
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-slate-900">
                        Livestock Price per Head
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{formatTargetUnit(card.unit)}</span>
                        <span className="font-mono font-semibold text-emerald-700">
                          {selectedPriceCard.usable_observations} cattle weeks
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Livestock price source">
                      {[card, externalCattlePriceCard].map((sourceCard) => {
                        const isSourceSelected = !populationSelected && sourceCard.id === activeTargetId;
                        const sourceLabel = sourceCard.id === "registered_cattle_price" ? "Registered" : "External";
                        return (
                          <button
                            key={sourceCard.id}
                            type="button"
                            aria-pressed={isSourceSelected}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPopulationSelected(false);
                              setSelectedTargetId(sourceCard.id);
                              setTimelinePage(0);
                            }}
                            className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                              isSourceSelected
                                ? "bg-emerald-700 text-white shadow-2xs"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            {sourceLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const Icon = getTargetIcon(card.id);
              const isSelected = !populationSelected && card.id === activeTargetId;
              const isCardValidated = card.validation_status === "VALIDATED";
              const isCardAvailable = card.forecast_available;

              return (
                <button
                  key={card.id}
                  onClick={() => {
                    setSelectedTargetId(card.id);
                    setTimelinePage(0);
                  }}
                  className={`group relative flex flex-col justify-between rounded-2xl p-4 text-left transition-all duration-200 border cursor-pointer ${
                    isSelected
                      ? "border-2 border-emerald-600 bg-emerald-50/70 shadow-sm"
                      : "border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
                        isSelected
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                      }`}
                    >
                      <Icon className="size-4.5" />
                    </div>

                    {isCardValidated ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-mono font-bold">
                        Checked with past records
                      </Badge>
                    ) : isCardAvailable ? (
                      <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-mono font-bold">
                        Not checked yet
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-mono">
                        No estimate yet
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                      {readableDomain(card.domain)} • {readableReportingType(card.reporting_type)}
                    </div>
                    <div className={`text-sm font-bold transition-colors mt-0.5 ${
                      isSelected ? "text-emerald-950 font-bold" : "text-slate-800 group-hover:text-slate-900"
                    }`}>
                      {card.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>{formatTargetUnit(card.unit)}</span>
                      <span className="font-mono text-emerald-700 font-semibold">
                        {card.usable_observations} {card.frequency === "WEEKLY" ? "eligible weeks" : "eligible months"}
                      </span>
                    </div>
                  </div>

                  {(card.domain === "disease" || card.domain === "mortality") && !isCardAvailable && (
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      {!!card.older_covered_observations && <p>{card.older_covered_observations} older covered months exist before the latest gap.</p>}
                      <p>{card.blocker_summary}</p>
                      <p className="font-semibold text-emerald-700">Review Disease &amp; Mortality → Monthly Reporting Coverage.</p>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute -bottom-px left-4 right-4 h-0.5 bg-emerald-600 rounded-full" />
                  )}
                </button>
              );
            })}
      </div>

      {populationSelected && <PopulationForecastPanel horizon={horizonMonths} />}
      <div className={populationSelected ? "hidden" : "space-y-6"}>
      {/* ----------------------------------------------------------------- */}
      {/* C. MAIN FORECAST VISUALIZATION (THE MISSION CONTROL CENTERPIECE)  */}
      {/* ----------------------------------------------------------------- */}
      {isCattlePriceForecast && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Livestock price view">
          {([ ["trend", "Cattle Weekly Trend"], ["profile", "Livestock Price by Profile"] ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={cattlePriceView === value} onClick={() => setCattlePriceView(value)} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${cattlePriceView === value ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      {isCattlePriceForecast && cattlePriceView === "profile" ? (
        <CattleProfilePrice key={activeTargetId} source={isRegisteredCattlePriceForecast ? "REGISTERED" : "EXTERNAL"} />
      ) : (
      <>
      <Card className="overflow-hidden rounded-2xl border border-emerald-200/90 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                <TargetIcon className="size-4 text-emerald-700" />
              </div>
              <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                {(currentCard?.domain === "disease" || currentCard?.domain === "mortality") && !targetDetail?.forecast_available
                  ? `${currentCard?.label} - completed reporting months`
                  : isAuctionForecast && !isCattlePriceForecast
                  ? `Approved SmartLivestock transfers - estimate for the next ${horizonMonths} ${horizonUnit}`
                  : `${currentCard?.label} - estimate for the next ${horizonMonths} ${horizonUnit}`}
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span>Method: <strong className="font-mono text-emerald-800">{readableMethodName(winningModel)}</strong></span>
              <span>•</span>
              <span>Unit: <strong className="text-slate-700">{formatTargetUnit(currentCard?.unit || "")}</strong></span>
              <span>•</span>
              <span>Interval: <strong className="text-slate-700">{currentCard?.frequency === "WEEKLY" ? "Weekly" : "Monthly"}</strong></span>
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTableView((prev) => !prev)}
              className="h-8 border-slate-200 bg-white text-xs font-mono text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer"
            >
              {showTableView ? (
                <>
                  <LineChartIcon className="size-3.5 mr-1 text-emerald-600" />
                  Show Visual Chart
                </>
              ) : (
                <>
                  <TableIcon className="size-3.5 mr-1 text-emerald-600" />
                  Inspect Numbers
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {(currentCard?.domain === "disease" || currentCard?.domain === "mortality") && !targetDetail?.forecast_available && chartTimeline.length > 0 && (
            <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-slate-700">
              Completed reporting months are shown below. Months without confirmed complete coverage appear as gaps. A future estimate needs enough consecutive completed months through the latest reporting period.
            </p>
          )}
          {isAuctionForecast && isCattlePriceForecast && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-slate-700">
              <>
                <p>
                  <strong className="text-slate-900">Price basis:</strong> This is the weekly average recorded purchase price per head from {cattlePriceSourceDescription}. It is not a per-kilogram price and does not adjust for weight, breed, age, or sex.
                </p>
                <p className="mt-1">
                  {isRegisteredCattlePriceForecast
                    ? "Includes only transfers linked to a registered cattle record in SmartLivestock."
                    : "Includes only external cattle transfer records without a linked cattle record; other market activity may be missing."}
                </p>
              </>
            </div>
          )}
          {hasHistory && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-slate-800">Show past records</p>
                <p className="text-[11px] text-slate-500">
                  {hasHistory ? "The estimate stays visible." : "Available after records are added."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Past records time range">
                {historyOptions.map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    aria-pressed={activeHistoryWindow === option.value}
                    disabled={!hasHistory}
                    onClick={() => {
                      setHistoryWindowMonths(option.value);
                      setTimelinePage(0);
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                      activeHistoryWindow === option.value
                        ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 shadow-2xs font-bold"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isPending ? (
            <Skeleton className="h-80 w-full rounded-xl bg-slate-100" />
          ) : chartTimeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <AlertTriangle className="size-8 text-amber-500 mb-2" />
              <h3 className="text-base font-bold text-slate-900">Forecast Unavailable for {currentCard?.label}</h3>
              <p className="text-xs text-slate-600 max-w-md mt-1">
                {targetDetail?.blocker_summary || "There are not enough regular past records to make this estimate yet."}
              </p>
              <p className="text-xs text-emerald-700 mt-2 font-mono font-medium">
                {targetDetail?.next_step}
              </p>
            </div>
          ) : showTableView ? (
            /* Tabular Alternative for Precision & Accessibility */
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className="font-mono text-xs text-slate-600">Period</TableHead>
                      <TableHead className="font-mono text-xs text-slate-600">Record type</TableHead>
                      <TableHead className="font-mono text-xs text-slate-600 text-right">Recorded value</TableHead>
                      <TableHead className="font-mono text-xs text-slate-600 text-right">Estimate</TableHead>
                      <TableHead className="font-mono text-xs text-slate-600 text-right">Low estimate</TableHead>
                      <TableHead className="font-mono text-xs text-slate-600 text-right">High estimate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleTimeline.map((row) => (
                      <TableRow key={row.date} className="border-slate-100 hover:bg-slate-50/70">
                        <TableCell className="font-mono text-xs font-semibold text-slate-900">
                          {row.month_label || row.date}
                        </TableCell>
                        <TableCell>
                          {row.is_future ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono font-bold">
                              Forecast
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-600 border-slate-200 text-[10px] font-mono">
                              Historical
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right text-slate-700">
                          {row.actual != null ? row.actual.toLocaleString("en-PH") : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right font-bold text-emerald-700">
                          {row.forecast != null ? row.forecast.toLocaleString("en-PH") : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right text-slate-500">
                          {row.confidence_lower != null ? row.confidence_lower.toLocaleString("en-PH") : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right text-slate-500">
                          {row.confidence_upper != null ? row.confidence_upper.toLocaleString("en-PH") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="text-slate-600">
                  Showing {chartTimeline.length ? safeTimelinePage * timelinePageSize + 1 : 0}–{Math.min((safeTimelinePage + 1) * timelinePageSize, chartTimeline.length)} of {chartTimeline.length} periods
                </span>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTimelinePage(Math.max(0, safeTimelinePage - 1))}
                    disabled={safeTimelinePage === 0}
                    aria-label="Show previous forecast periods"
                  >
                    Previous
                  </Button>
                  <span className="min-w-16 text-center font-medium text-slate-600">
                    Page {safeTimelinePage + 1} of {timelinePageCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTimelinePage(Math.min(timelinePageCount - 1, safeTimelinePage + 1))}
                    disabled={safeTimelinePage >= timelinePageCount - 1}
                    aria-label="Show next forecast periods"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Light & Green Futuristic Composed Chart View */
            <div className="h-80 sm:h-96 w-full" role="img" aria-label="Futuristic Forecast Visualization Chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart key={activeTargetId} data={chartTimeline} margin={{ top: 15, right: 15, left: -10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="forecastAreaGlowLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month_label"
                    stroke="#94a3b8"
                    tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={{ stroke: "#e2e8f0" }}
                    angle={-40}
                    textAnchor="end"
                    height={weeklyTargetSelected ? 90 : 65}
                    tickMargin={10}
                    tickFormatter={(label: string) => weeklyTargetSelected ? label.replace(/^Week of /, "") : label}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: "#64748b", fontSize: 11, fontFamily: "monospace" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={{ stroke: "#e2e8f0" }}
                    tickFormatter={(v) => Number(v).toLocaleString("en-PH")}
                  />
                  <Tooltip
                    content={<MissionControlTooltip unit={formatTargetUnit(currentCard?.unit || "")} />}
                  />
                  <Legend
                    verticalAlign="top"
                    align="center"
                    wrapperStyle={{ paddingBottom: "16px", fontSize: "12px", lineHeight: "20px" }}
                    formatter={(val) => <span className="text-slate-700 font-medium">{val}</span>}
                  />

                  {/* Cutoff Reference Line marking Today / Projection boundary */}
                  {lastHistoricalPoint && (
                    <ReferenceLine
                      x={lastHistoricalPoint.month_label}
                      stroke="#d97706"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: "Estimate starts here",
                        fill: "#b45309",
                        fontSize: 10,
                        position: "top",
                        fontFamily: "monospace",
                      }}
                    />
                  )}

                  {/* Shaded Forecast Area Glow (Emerald) */}
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    name="Projected Trend"
                    stroke="none"
                    fill="url(#forecastAreaGlowLight)"
                    connectNulls
                    legendType="none"
                  />

                  {/* Historical Observed Solid Series (Slate) */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name={
                      currentCard?.id === "disease_reports"
                        ? "Approved disease reports"
                        : currentCard?.id === "disease_heads"
                        ? "Affected heads in approved reports"
                        : isCattlePriceForecast
                        ? "Recorded cattle price per head"
                        : isAuctionForecast
                        ? "Approved SmartLivestock transfers"
                        : "Observed Actuals"
                    }
                    stroke="#64748b"
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: "#94a3b8", stroke: "#ffffff", strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: "#475569" }}
                    connectNulls={!isCattlePriceForecast && currentCard?.domain !== "disease" && currentCard?.domain !== "mortality"}
                  />

                  {/* Future Forecast Vibrant Emerald Green Series */}
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name={
                      currentCard?.id === "disease_reports"
                        ? "Estimated disease reports"
                        : currentCard?.id === "disease_heads"
                        ? "Estimated affected heads"
                        : isCattlePriceForecast
                        ? "Estimated cattle price per head"
                        : isAuctionForecast
                        ? "Projected SmartLivestock transfers"
                        : "Future Projection"
                    }
                    stroke="#059669"
                    strokeWidth={2.5}
                    strokeDasharray="5 3"
                    dot={{ r: 4, fill: "#10b981", stroke: "#047857", strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: "#34d399", stroke: "#059669", strokeWidth: 2 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {currentCard?.domain === "disease" && (
        <div className="space-y-3">
          {diseaseSeriesOverlap && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-relaxed text-slate-700">
              <strong className="text-slate-900">Why the two graphs match:</strong> The monthly report counts and affected-head totals are the same in this data, so the lines overlap. Reports count records; affected heads sum the animals listed in those records.
            </div>
          )}

          <Card className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
              <CardTitle className="text-sm sm:text-base font-bold text-slate-900">
                Reports by recorded condition
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed text-slate-600">
                Aggregate counts from approved disease reports in the past 12 months.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {diseaseBreakdownQuery.isPending ? (
                <div role="status" className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : diseaseBreakdownQuery.isError ? (
                <p className="text-xs text-rose-700">
                  Could not load the disease breakdown. Try refreshing the page.
                </p>
              ) : diseaseBreakdownQuery.data?.length ? (
                <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="border-slate-200 hover:bg-transparent">
                        <TableHead className="text-xs font-semibold text-slate-700">Recorded condition</TableHead>
                        <TableHead className="text-right text-xs font-semibold text-slate-700">Reports</TableHead>
                        <TableHead className="text-right text-xs font-semibold text-slate-700">Affected heads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diseaseBreakdownQuery.data.map((row, index) => (
                        <TableRow key={`${row.name}-${index}`} className="border-slate-100">
                          <TableCell className="max-w-[min(60vw,32rem)] truncate text-xs font-medium text-slate-800" title={row.name}>
                            {row.name || "Unspecified"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-slate-700">
                            {row.cases.toLocaleString("en-PH")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-slate-700">
                            {row.affected_heads.toLocaleString("en-PH")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No approved disease reports in the past 12 months.</p>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                These are recorded report labels, not confirmed diagnoses. Affected-head totals may include repeat reports about the same animal.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* D. FORECAST SUMMARY CARDS (4 Executive Metrics - Light & Green)   */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Next Period Forecast */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-emerald-300 transition-all relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              {isCattlePriceForecast ? "Next Week Price Estimate" : "Next Period Forecast"}
            </span>
            <div className="size-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            {nextForecast ? (
              <>
                <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1.5">
                  <span>{nextForecast.predicted.toLocaleString("en-PH", { maximumFractionDigits: isCattlePriceForecast ? 2 : 1 })}</span>
                  <span className="text-xs font-sans text-emerald-700 font-bold">{formatTargetUnit(currentCard?.unit || "")}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Target: {nextForecast.month_label}</span>
                  {metadata.projected_change_pct != null && (
                    <span
                      className={`font-mono font-bold flex items-center ${
                        metadata.projected_change_pct >= 0 ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {metadata.projected_change_pct >= 0 ? (
                        <ArrowUp className="size-3 mr-0.5" />
                      ) : (
                        <ArrowDown className="size-3 mr-0.5" />
                      )}
                      {Math.abs(metadata.projected_change_pct)}% vs recent records
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm font-mono text-slate-400 py-1">Waiting for records</div>
            )}
          </div>
        </Card>

        {/* Card 2: Model Error (MAE) */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-teal-300 transition-all relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Typical difference from recorded values
            </span>
            <div className="size-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
              <Percent className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            {selectedMae != null ? (
              <>
                <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1.5">
                  <span>± {selectedMae.toLocaleString("en-PH", { maximumFractionDigits: 1 })}</span>
                  <span className="text-xs font-sans text-teal-800 font-bold">{formatTargetUnit(currentCard?.unit || "")}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                  Average difference between estimates and past recorded values.
                </p>
              </>
            ) : (
              <div className="text-sm font-mono text-slate-400 py-1">No past check yet</div>
            )}
          </div>
        </Card>

        {/* Card 3: Baseline Comparison */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-green-300 transition-all relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Compare with the baseline
            </span>
            <div className="size-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center text-green-800">
              <Scale className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            {baselineMae != null && selectedMae != null ? (
              <>
                <div className="text-xl font-mono font-extrabold text-slate-900 tracking-tight">
                  {isBeatingBaseline ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-bold">
                      <CheckCircle2 className="size-4 shrink-0" />
                      More accurate
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1 font-bold">
                      <Info className="size-4 shrink-0" />
                      Baseline did better
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                  {isBeatingBaseline
                    ? `${readableMethodName(winningModel)} had ${baselineImprovementPct}% less error than the baseline.`
                    : `The baseline had less error (${baselineMae.toFixed(1)} vs ${selectedMae.toFixed(1)}).`}
                </p>
              </>
            ) : (
              <div className="text-sm font-mono text-slate-400 py-1">No comparison available yet</div>
            )}
          </div>
        </Card>

        {/* Card 4: Validation Coverage */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-emerald-300 transition-all relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Past checks completed
            </span>
            <div className="size-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
              <FileCheck2 className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1">
              <span>{backtestInfo?.valid_cutoffs_count ?? targetDetail?.progress?.valid_cutoffs_count ?? currentCard?.valid_cutoffs_count ?? 0}</span>
              <span className="text-xs text-slate-500 font-sans">
                / {backtestInfo?.total_attempted_cutoffs ?? targetDetail?.progress?.total_cutoffs_count ?? currentCard?.total_cutoffs_count ?? 0} checks
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 leading-tight">
              {isValidated
                ? "Enough past periods were checked to rate this forecast."
                : "Not enough past periods could be checked yet."}
            </p>
          </div>
        </Card>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* E. FORECAST RELIABILITY & EVIDENCE STATUS (Light & Emerald Panel) */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                How well it has been checked:
              </span>
              {isValidated ? (
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold font-mono">
                  Checked against past records
                </Badge>
              ) : isAvailableUnvalidated ? (
                <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold font-mono">
                  Estimate available, not fully checked
                </Badge>
              ) : (
                <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold font-mono">
                  Past checks incomplete
                </Badge>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-700 max-w-3xl leading-relaxed">
              {targetDetail?.validation_details || currentCard?.blocker_summary || "Checking whether past records are complete..."}
            </p>
          </div>

          {/* Observations Progress Gauge */}
          <div className="min-w-[220px] rounded-xl bg-white border border-slate-200 p-3 shrink-0 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-500 font-mono">History for initial estimate:</span>
              <span className="font-mono font-bold text-emerald-800">
              {currentCard?.usable_observations} {currentCard?.frequency === "WEEKLY" ? "weeks" : "months"}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  currentCard?.observations_progress_pct >= 100
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : "bg-gradient-to-r from-amber-500 to-emerald-500"
                }`}
                style={{ width: `${Math.min(currentCard?.observations_progress_pct || 0, 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-1.5 text-right font-mono">
              Minimum: {currentCard?.required_observations} {currentCard?.frequency === "WEEKLY" ? "weeks" : "months"}. Past accuracy checks are assessed separately.
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* F. EXPANDABLE TECHNICAL DETAILS (Light & Green)                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-3">
        {/* Detail Navigation Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant={viewMode === "overview" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("overview")}
              className={`h-8 text-xs font-mono font-bold cursor-pointer ${
                viewMode === "overview"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              Overview
            </Button>
            <Button
              variant={viewMode === "models" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("models")}
              className={`h-8 text-xs font-mono font-bold cursor-pointer ${
                viewMode === "models"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              Compare estimates
            </Button>
            <Button
              variant={viewMode === "backtest" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("backtest")}
              className={`h-8 text-xs font-mono font-bold cursor-pointer ${
                viewMode === "backtest"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              Past comparisons
            </Button>
            <Button
              variant={viewMode === "checklist" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("checklist")}
              className={`h-8 text-xs font-mono font-bold cursor-pointer ${
                viewMode === "checklist"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              Data & records
            </Button>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            {viewMode === "overview" ? "Forecast summary and next steps" : "Supporting details"}
          </span>
        </div>

        {/* Tab Content 0: Executive Analytical Briefing (Summary View) */}
        {viewMode === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Target Profile Card */}
            <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
                    <TargetIcon className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">What is being estimated?</h3>
                    <p className="text-[11px] text-slate-500">Source and reporting details</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Measure:</span>
                    <span className="font-mono font-bold text-slate-800">{currentCard?.label}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Unit:</span>
                    <span className="font-mono text-slate-800">{formatTargetUnit(currentCard?.unit || "")}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Reported:</span>
                    <Badge variant="outline" className="text-[10px] font-mono border-slate-200">
                      {currentCard?.frequency === "WEEKLY" ? "Weekly" : "Monthly"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Records from:</span>
                    <span className="text-slate-700 font-medium truncate max-w-[180px]" title={targetDetail?.source}>
                      {targetDetail?.source || "Official SmartLivestock Logs"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500">Minimum past records needed:</span>
                    <span className="text-slate-700 font-medium text-right text-[11px] max-w-[180px]">
                  {targetDetail?.minimum_rule || "At least 12 recorded periods in a row"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* How the estimate was checked */}
            <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-teal-50 text-teal-800">
                    <Scale className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">How well did it match past records?</h3>
                    <p className="text-[11px] text-slate-500">Compared with the baseline</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-slate-600 leading-relaxed text-xs">
                    {isValidated
                      ? `The ${readableMethodName(winningModel)} method was checked against ${backtestInfo?.valid_cutoffs_count ?? 0} past periods and did better than the baseline.`
                      : isAvailableUnvalidated
                      ? "An estimate is available, but there are not enough past periods to check how well it matches recorded results."
                      : "There are not enough approved past records to make and check an estimate."}
                  </p>

                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Selected method:</span>
                      <strong className="font-mono text-emerald-800">{readableMethodName(winningModel)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Typical difference from records:</span>
                      <strong className="font-mono text-slate-800">
                        {selectedMae != null ? `± ${selectedMae.toFixed(1)} ${formatTargetUnit(currentCard?.unit || "")}` : "Not available yet"}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Compared with baseline:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {baselineImprovementPct != null
                          ? `${baselineImprovementPct}% less error`
                          : baselineMae != null
                          ? `Baseline difference: ${baselineMae.toFixed(1)}`
                          : "Waiting for enough past records to compare"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setViewMode("models")}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Compare estimates with past records</span>
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Operational Action & Diagnostics */}
            <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-800">
                    <Info className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Guidance and next steps</h3>
                    <p className="text-[11px] text-slate-500">For Padre Garcia Agriculture Office staff</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-slate-700 leading-relaxed text-xs">
                    <span className="font-bold text-slate-900 block mb-1">Current status:</span>
                    {targetDetail?.blocker_summary || currentCard?.blocker_summary || "Analyzing data continuity..."}
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-slate-700 leading-relaxed text-xs">
                    <span className="font-bold text-emerald-950 block mb-1">What to do next:</span>
                    {targetDetail?.next_step || currentCard?.next_step || "Continue recording monthly data."}
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      onClick={() => setViewMode("checklist")}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Review the data checklist</span>
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tab Content 1: Model Benchmarks Table */}
        {viewMode === "models" && (
          <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="size-4 text-emerald-700" />
                  Which estimates were closest?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  We compared earlier estimates for {currentCard?.label} with records saved later. The approach that was closest to those records is used for the current estimate.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200">
                      <TableHead className="font-mono text-xs text-slate-700">Approach</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Result</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700 text-right">Typical difference ({formatTargetUnit(currentCard?.unit || "")})</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700 text-right">Largest miss</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700 text-right">Tracks changes</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700 text-right">Selected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidateModels && Object.keys(candidateModels).length > 0 ? (
                      Object.entries(candidateModels).map(([name, m]: [string, any]) => {
                        const isWinner = name === winningModel;
                        return (
                          <TableRow key={name} className="border-slate-100 hover:bg-slate-50/70">
                            <TableCell className="font-bold text-xs text-slate-900 flex items-center gap-2">
                              {isWinner && <Award className="size-3.5 text-emerald-600 shrink-0" />}
                              <span>{readableMethodName(name)}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-mono border-slate-200 text-slate-600">
                                Checked
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-right font-bold text-emerald-800">
                              {m?.mae != null ? Number(m.mae).toFixed(2) : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-right text-slate-700">
                              {m?.rmse != null ? Number(m.rmse).toFixed(2) : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-right text-slate-700">
                              {m?.r2 != null ? Number(m.r2).toFixed(3) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {isWinner ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono font-bold">
                                  Selected
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-slate-500 font-mono">Other method</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-xs text-slate-500 font-mono">
                          No method comparisons are available for this measure yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Explanatory Technical Tooltips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-slate-600">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                  <span className="font-mono font-bold text-slate-900">Average difference:</span>
                  <p className="mt-0.5">How far estimates were from recorded values on average. Lower is better.</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                  <span className="font-mono font-bold text-slate-900">Large misses:</span>
                  <p className="mt-0.5">Gives extra weight to estimates that were far from recorded values. Lower is better.</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                  <span className="font-mono font-bold text-slate-900">Pattern match:</span>
                  <p className="mt-0.5">Shows how closely estimates followed changes in the records. Closer to 1 is better.</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Tab Content 2: Historical Performance (Backtesting Cutoffs) */}
        {viewMode === "backtest" && (
          <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="size-4 text-emerald-700" />
                  How past estimates compared
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  These checks recreate earlier forecasts using only records that were available at the time.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200">
                      <TableHead className="font-mono text-xs text-slate-700">Records available up to</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Period estimated</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Past periods used</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Check result</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cutoffTimeline && cutoffTimeline.length > 0 ? (
                      cutoffTimeline.map((entry: CutoffDiagnosticEntry, idx: number) => (
                        <TableRow key={idx} className="border-slate-100 hover:bg-slate-50/70">
                          <TableCell className="font-mono text-xs font-semibold text-slate-900">
                            {entry.cutoff_date}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-700">
                            {entry.forecast_month || entry.forecast_week || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">
                            {entry.available_training_months ?? entry.available_training_weeks ?? "—"}
                          </TableCell>
                          <TableCell>
                            {entry.status === "EVALUATED" ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono font-bold">
                                Check completed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-800 bg-amber-50 border-amber-300 text-[10px] font-mono">
                        {readableCheckStatus(entry.status)}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 max-w-sm truncate" title={entry.reason}>
                            {entry.reason}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-xs text-slate-500 font-mono">
                          No past forecast checks are available yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        )}

        {/* Tab Content 3: Data Quality Checklist */}
        {viewMode === "checklist" && (
          <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck2 className="size-4 text-emerald-700" />
                  Record coverage
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Checks for missing records and other issues that can affect estimates for {currentCard?.label}.
                </p>
              </div>

              <div className="space-y-2.5">
                {targetDetail?.checklist && targetDetail.checklist.length > 0 ? (
                  targetDetail.checklist.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.status === "PASSED" ? (
                            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                          ) : item.status === "WARNING" ? (
                            <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                          ) : (
                            <XCircle className="size-4 text-rose-500 shrink-0" />
                          )}
                          <span className="font-bold text-xs text-slate-900">{item.title}</span>
                          <Badge variant="outline" className="text-[10px] font-mono border-slate-200 text-slate-500">
                            {({
                              DATA_COLLECTION: "Record keeping",
                              DATA_QUALITY: "Record completeness",
                              VALIDATION_INTEGRITY: "Past forecast checks",
                              MODEL_EXECUTION: "Estimate setup",
                              FORECAST_DELIVERY: "Forecast availability",
                            } as Record<string, string>)[item.category] || item.category.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                          {item.explanation}
                        </p>
                      </div>

                      <div className="text-right shrink-0 pl-6 sm:pl-0">
                        <span className="font-mono text-xs font-bold text-emerald-800">
                          {item.actual_value}
                        </span>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Needed: {item.expected_requirement}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-500 font-mono">
                    Checklist items appear after the forecast information loads.
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
      </>
      )}
      </div>
    </div>
  );
}
