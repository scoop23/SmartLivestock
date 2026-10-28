"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import api from "@/lib/axios";
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
  Droplets,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  HelpCircle,
  History,
  Info,
  Layers,
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
  reporting_type: string;
  frequency?: "MONTHLY" | "WEEKLY";
  observation_label?: string;
  description: string;
  forecast_status: "READY" | "AVAILABLE_UNVALIDATED" | "NEEDS_ATTENTION" | "INSUFFICIENT_DATA" | "ERROR";
  forecast_available: boolean;
  validation_status: "VALIDATED" | "NOT_YET_VALIDATED" | "INSUFFICIENT_DATA";
  readiness_status: string;
  usable_observations: number;
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
  if (u === "LITERS") return "Liters (L)";
  if (u === "KILOGRAMS") return "Kilograms (kg)";
  if (u === "HEADS") return "Heads (Animals)";
  if (u === "CASES") return "Clinical Cases";
  return unit;
}

function getTargetIcon(id: string) {
  switch (id) {
    case "milk":
      return Droplets;
    case "livestock_sales":
      return ShoppingBag;
    case "slaughter_meat":
      return Scale;
    case "farmer_meat":
      return Layers;
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
                  {isForecast ? "Projected Model Forecast" : isActual ? "Observed Historical Record" : item.name}
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

export function FuturisticPredictiveDashboard() {
  const [selectedTargetId, setSelectedTargetId] = useState<string>("slaughter_meat");
  const [horizonMonths, setHorizonMonths] = useState<number>(6);
  const [viewMode, setViewMode] = useState<"overview" | "backtest" | "models" | "checklist">("overview");
  const [showTableView, setShowTableView] = useState<boolean>(false);
  const [timelinePage, setTimelinePage] = useState(0);
  const timelinePageSize = 10;

  // Fetch Authoritative Readiness Diagnostics from Backend
  const { data, isPending, isError, error, refetch, isFetching } = useQuery<DiagnosticsApiResponse>({
    queryKey: ["futuristic-predictive-diagnostics", horizonMonths],
    queryFn: async () => {
      const res = await api.get<DiagnosticsApiResponse>("analytics/predictive/diagnostics/", {
        params: { horizon: horizonMonths },
      });
      return res.data;
    },
    staleTime: 60_000,
  });

  const summaryCards = data?.summary_cards || [];
  const currentCard = summaryCards.find((c) => c.id === selectedTargetId) || summaryCards[0];
  const activeTargetId = currentCard?.id || selectedTargetId;
  const targetDetail: TargetDiagnosticDetail | undefined = data?.diagnostics?.[activeTargetId];
  const TargetIcon = getTargetIcon(activeTargetId);

  // Chart Data preparation
  const chartTimeline = targetDetail?.forecast?.chart_data || [];
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
  const winningModel = backtestInfo?.winning_model || targetDetail?.forecast?.model_name || "Baseline";
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
                Unable to Load Predictive Readiness Diagnostics
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                {error instanceof Error ? error.message : "The predictive diagnostics service encountered an error while evaluating historical records."}
              </p>
            </div>
          </div>
          <Button
            onClick={() => void refetch()}
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
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-emerald-800">
                <Zap className="size-3.5 text-emerald-600 animate-pulse" />
                Municipal Intelligence Engine
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-600 font-medium">Padre Garcia Batangas</span>
              {lastEvaluatedFormatted && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="size-3 text-slate-400" />
                    Updated: {lastEvaluatedFormatted}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              Predictive Intelligence
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-mono font-bold">
                v2.4 Core
              </Badge>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Explore future livestock activity using historical records and evaluated forecasting models. Simple by default, detailed on demand.
            </p>
          </div>

          {/* Horizon Selector and Refresh Button */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200 p-1 shadow-2xs">
              <span className="px-2 text-[11px] font-mono text-slate-500 uppercase tracking-wider">Horizon:</span>
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
                  {m}M
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {isPending
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl bg-white border border-slate-200" />
            ))
          : summaryCards.map((card) => {
              const Icon = getTargetIcon(card.id);
              const isSelected = card.id === selectedTargetId;
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
                        Validated
                      </Badge>
                    ) : isCardAvailable ? (
                      <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-mono font-bold">
                        Unvalidated
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-mono">
                        No Forecast
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                      {card.domain} • {card.reporting_type.replace(/_/g, " ")}
                    </div>
                    <div className={`text-sm font-bold transition-colors mt-0.5 ${
                      isSelected ? "text-emerald-950 font-bold" : "text-slate-800 group-hover:text-slate-900"
                    }`}>
                      {card.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>{formatTargetUnit(card.unit)}</span>
                      <span className="font-mono text-emerald-700 font-semibold">
                        {card.usable_observations} {card.frequency === "WEEKLY" ? "wks" : "mos"}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute -bottom-px left-4 right-4 h-0.5 bg-emerald-600 rounded-full" />
                  )}
                </button>
              );
            })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* C. MAIN FORECAST VISUALIZATION (THE MISSION CONTROL CENTERPIECE)  */}
      {/* ----------------------------------------------------------------- */}
      <Card className="overflow-hidden rounded-2xl border border-emerald-200/90 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                <TargetIcon className="size-4 text-emerald-700" />
              </div>
              <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                {currentCard?.label} — {horizonMonths}-Month Projection Timeline
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span>Model: <strong className="font-mono text-emerald-800">{winningModel}</strong></span>
              <span>•</span>
              <span>Unit: <strong className="text-slate-700">{formatTargetUnit(currentCard?.unit || "")}</strong></span>
              <span>•</span>
              <span>Frequency: <strong className="text-slate-700">{currentCard?.frequency || "MONTHLY"}</strong></span>
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
          {isPending ? (
            <Skeleton className="h-80 w-full rounded-xl bg-slate-100" />
          ) : chartTimeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <AlertTriangle className="size-8 text-amber-500 mb-2" />
              <h3 className="text-base font-bold text-slate-900">Forecast Unavailable for {currentCard?.label}</h3>
              <p className="text-xs text-slate-600 max-w-md mt-1">
                {targetDetail?.blocker_summary || "The dataset does not yet meet minimum observation continuity requirements."}
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
                      <TableHead className="font-mono text-xs text-slate-600">Classification</TableHead>
                      <TableHead className="font-mono text-xs text-slate-600 text-right">Actual Observed</TableHead>
                      <TableHead className="font-mono text-xs text-slate-600 text-right">Model Projection</TableHead>
                      <TableHead className="font-mono text-xs text-slate-600 text-right">Lower Bound</TableHead>
                      <TableHead className="font-mono text-xs text-slate-600 text-right">Upper Bound</TableHead>
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
                <ComposedChart data={chartTimeline} margin={{ top: 15, right: 15, left: -10, bottom: 20 }}>
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
                    angle={-45}
                    textAnchor="end"
                    height={55}
                    interval="preserveStartEnd"
                    minTickGap={10}
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
                    wrapperStyle={{ paddingTop: "14px", fontSize: "12px" }}
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
                        value: "Historical Cutoff",
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
                    name="Observed Actuals"
                    stroke="#64748b"
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: "#94a3b8", stroke: "#ffffff", strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: "#475569" }}
                    connectNulls
                  />

                  {/* Future Forecast Vibrant Emerald Green Series */}
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Future Projection"
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

      {/* ----------------------------------------------------------------- */}
      {/* D. FORECAST SUMMARY CARDS (4 Executive Metrics - Light & Green)   */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Next Period Forecast */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-emerald-300 transition-all relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Next Period Forecast
            </span>
            <div className="size-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            {nextForecast ? (
              <>
                <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1.5">
                  <span>{nextForecast.predicted.toLocaleString("en-PH", { maximumFractionDigits: 1 })}</span>
                  <span className="text-xs font-sans text-emerald-700 font-bold">{currentCard?.unit}</span>
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
                      {Math.abs(metadata.projected_change_pct)}% vs baseline
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm font-mono text-slate-400 py-1">Awaiting Data</div>
            )}
          </div>
        </Card>

        {/* Card 2: Model Error (MAE) */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-teal-300 transition-all relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Model Error (MAE)
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
                  <span className="text-xs font-sans text-teal-800 font-bold">{currentCard?.unit}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                  Mean Absolute Error across valid evaluation holdouts.
                </p>
              </>
            ) : (
              <div className="text-sm font-mono text-slate-400 py-1">Unvalidated</div>
            )}
          </div>
        </Card>

        {/* Card 3: Baseline Comparison */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-green-300 transition-all relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Baseline Comparison
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
                      Beats Baseline
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1 font-bold">
                      <Info className="size-4 shrink-0" />
                      Baseline Best
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                  {isBeatingBaseline
                    ? `${winningModel} reduced error by ${baselineImprovementPct}% over naive.`
                    : `Naive baseline achieved lower error (${baselineMae.toFixed(1)} vs ${selectedMae.toFixed(1)}).`}
                </p>
              </>
            ) : (
              <div className="text-sm font-mono text-slate-400 py-1">No Comparison Available</div>
            )}
          </div>
        </Card>

        {/* Card 4: Validation Coverage */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-emerald-300 transition-all relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              Validation Coverage
            </span>
            <div className="size-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
              <FileCheck2 className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1">
              <span>{backtestInfo?.valid_cutoffs_count ?? targetDetail?.progress?.valid_cutoffs_count ?? currentCard?.valid_cutoffs_count ?? 0}</span>
              <span className="text-xs text-slate-500 font-sans">
                / {backtestInfo?.total_attempted_cutoffs ?? targetDetail?.progress?.total_cutoffs_count ?? currentCard?.total_cutoffs_count ?? 0} cutoffs
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 leading-tight">
              {isValidated
                ? "Meets minimum backtesting window requirement."
                : "Insufficient qualified chronological cutoffs."}
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
                Evaluation Evidence Status:
              </span>
              {isValidated ? (
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold font-mono">
                  Validated Forecast
                </Badge>
              ) : isAvailableUnvalidated ? (
                <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold font-mono">
                  Exploratory (Unvalidated)
                </Badge>
              ) : (
                <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold font-mono">
                  Insufficient History
                </Badge>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-700 max-w-3xl leading-relaxed">
              {targetDetail?.validation_details || currentCard?.blocker_summary || "Evaluating dataset continuity..."}
            </p>
          </div>

          {/* Observations Progress Gauge */}
          <div className="min-w-[220px] rounded-xl bg-white border border-slate-200 p-3 shrink-0 shadow-2xs">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-500 font-mono">Data Continuity:</span>
              <span className="font-mono font-bold text-emerald-800">
                {currentCard?.usable_observations} / {currentCard?.required_observations} {currentCard?.frequency === "WEEKLY" ? "wks" : "mos"}
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
              {currentCard?.milestone_label}
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
              Summary View
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
              Model Benchmarks
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
              Historical Performance
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
              Data Quality Checklist
            </Button>
          </div>

          <span className="text-xs text-slate-500 font-mono">
            {viewMode === "overview" ? "Executive Summary & Guidance" : "Detailed Analytical Mode"}
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
                    <h3 className="text-sm font-bold text-slate-900">Target & Domain Profile</h3>
                    <p className="text-[11px] text-slate-500">Official Municipal Commodity Source</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Commodity Target:</span>
                    <span className="font-mono font-bold text-slate-800">{currentCard?.label}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Measurement Unit:</span>
                    <span className="font-mono text-slate-800">{formatTargetUnit(currentCard?.unit || "")}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Reporting Frequency:</span>
                    <Badge variant="outline" className="text-[10px] font-mono border-slate-200">
                      {currentCard?.frequency || "MONTHLY"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Data Source:</span>
                    <span className="text-slate-700 font-medium truncate max-w-[180px]" title={targetDetail?.source}>
                      {targetDetail?.source || "Official SmartLivestock Logs"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500">Minimum Continuity Rule:</span>
                    <span className="text-slate-700 font-medium text-right text-[11px] max-w-[180px]">
                      {targetDetail?.minimum_rule || "At least 12 contiguous recorded periods"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Model & Holdout Validation Briefing */}
            <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-teal-50 text-teal-800">
                    <Scale className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Holdout Validation Logic</h3>
                    <p className="text-[11px] text-slate-500">Empirical Baseline Comparison</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-slate-600 leading-relaxed text-xs">
                    {isValidated
                      ? `Model "${winningModel}" was evaluated across ${backtestInfo?.valid_cutoffs_count ?? 0} valid rolling-origin cutoffs and outperformed naive persistence.`
                      : isAvailableUnvalidated
                      ? "A forward projection is available from current data. However, chronological backtesting was not fully established across past cutoff dates."
                      : targetDetail?.domain === "production"
                        ? "Insufficient contiguous eligible farmer production logs exist to establish empirical validation or projection."
                        : "Insufficient contiguous approved records exist to establish empirical validation or projection."}
                  </p>

                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Selected Model:</span>
                      <strong className="font-mono text-emerald-800">{winningModel}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Mean Absolute Error:</span>
                      <strong className="font-mono text-slate-800">
                        {selectedMae != null ? `± ${selectedMae.toFixed(1)} ${currentCard?.unit}` : "Uncalculated"}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Baseline Relative Score:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {baselineImprovementPct != null
                          ? `${baselineImprovementPct}% improvement over naive`
                          : baselineMae != null
                          ? `Naive baseline MAE: ${baselineMae.toFixed(1)}`
                          : "Awaiting valid holdout window"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setViewMode("models")}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Inspect Candidate Model Comparison Bench</span>
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
                    <h3 className="text-sm font-bold text-slate-900">Municipal Guidance & Next Steps</h3>
                    <p className="text-[11px] text-slate-500">Padre Garcia MAO Decision Guidance</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-slate-700 leading-relaxed text-xs">
                    <span className="font-bold text-slate-900 block mb-1">Current Operational Status:</span>
                    {targetDetail?.blocker_summary || currentCard?.blocker_summary || "Analyzing data continuity..."}
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-slate-700 leading-relaxed text-xs">
                    <span className="font-bold text-emerald-950 block mb-1">Recommended Next Action:</span>
                    {targetDetail?.next_step || currentCard?.next_step || "Continue recording monthly data."}
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      onClick={() => setViewMode("checklist")}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Review 12-point Data Quality Checklist</span>
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
                  Candidate Model Comparison Bench
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Models evaluated chronologically over holdout windows for {currentCard?.label}. The model with the lowest Mean Absolute Error (MAE) is selected for projections.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200">
                      <TableHead className="font-mono text-xs text-slate-700">Model Name</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Status</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700 text-right">MAE ({currentCard?.unit})</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700 text-right">RMSE</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700 text-right">R² Score</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700 text-right">Selection</TableHead>
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
                              <span>{name}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-mono border-slate-200 text-slate-600">
                                Evaluated
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
                                <span className="text-[11px] text-slate-500 font-mono">Candidate</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-xs text-slate-500 font-mono">
                          No comparative model metrics available for this target.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Explanatory Technical Tooltips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-slate-600">
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                  <span className="font-mono font-bold text-slate-900">MAE (Mean Absolute Error):</span>
                  <p className="mt-0.5">Average magnitude of errors in raw {currentCard?.unit}. Lower is better.</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                  <span className="font-mono font-bold text-slate-900">RMSE (Root Mean Squared Error):</span>
                  <p className="mt-0.5">Penalizes large outlier forecast errors more heavily than small ones.</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                  <span className="font-mono font-bold text-slate-900">R² (Coefficient of Determination):</span>
                  <p className="mt-0.5">Proportion of variance explained by the model (1.0 = perfect prediction).</p>
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
                  Historical Forecast Cutoffs & Backtest Log
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Simulated past forecast origins. Each cutoff strictly respects information availability at that historical point in time.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200">
                      <TableHead className="font-mono text-xs text-slate-700">Cutoff Date</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Target Period</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Training Samples</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Cutoff Status</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Audit Rationale</TableHead>
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
                                Evaluated
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-800 bg-amber-50 border-amber-300 text-[10px] font-mono">
                                {entry.status}
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
                          No historical backtest cutoff records available.
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
                  Data Readiness & Quality Diagnostic Checklist
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evaluated criteria across data collection, data quality, and model execution for {currentCard?.label}.
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
                            {item.category.replace(/_/g, " ")}
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
                          Req: {item.expected_requirement}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-500 font-mono">
                    Checklist items are computed when the dataset is loaded.
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
