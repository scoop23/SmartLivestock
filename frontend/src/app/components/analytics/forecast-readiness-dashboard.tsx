"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Compass,
  Database,
  FileCheck2,
  History,
  Info,
  Layers,
  LineChart as LineChartIcon,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  Sliders,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
  reason_code?: "EVALUATED" | "NOT_ENOUGH_APPROVED_HISTORY" | "GAPS_IN_APPROVED_HISTORY" | "INCOMPLETE_TEST_WINDOW" | "MISSING_AVAILABILITY_TIMESTAMPS" | "MODEL_FAILURE" | null;
  reason: string;
  test_periods?: string[];
  actual_values?: number[];
  predictions_by_model?: Record<string, number[]>;
}

export interface ApprovalStatusBreakdown {
  available: boolean;
  source_model: string | null;
  total_records: number | null;
  statuses: Array<{ status: string; label: string; count: number }>;
  scope_note: string;
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
    milk_diagnostics?: {
      usable_records: number;
      usable_production_days: number;
      records_with_approval_timestamp: number;
      records_with_availability_timestamp?: number;
      monthly_observations: number;
      months_with_records: number;
      months_without_records: number;
      missing_months: string[];
      days_with_one_session: number;
      days_with_two_sessions: number;
      days_with_three_sessions: number;
      days_with_unknown_or_conflicting_sessions: number;
      pending_records: number;
      returned_records: number;
      missing_approval_timestamp_records: number;
      excluded_duplicate_conflict_records: number;
      session_completeness_note: string;
      monthly_completeness_note: string;
    } | null;
    source_diagnostics?: (Record<string, number | string | boolean | null> & {
      source_record_type?: string;
      period_coverage_note?: string;
      availability_note?: string;
    }) | null;
    auction_diagnostics?: {
      approved_transfers: number;
      pending_transfers: number;
      verified_transfers: number;
      returned_transfers: number;
      approved_without_review_timestamp: number;
      synthetic_transfers: number;
      weekday_activity: Array<{
        weekday: string;
        transaction_count: number;
        heads_sold: number;
        sales_value_php: number;
        transactions_with_value: number;
        synthetic_transactions: number;
      }>;
      weekday_pattern_estimable: boolean;
      weekday_pattern_note: string;
      coverage_status: string;
      coverage_note: string;
      duplicate_detection_note: string;
    } | null;
    approval_status_breakdown?: ApprovalStatusBreakdown;
  };
  checklist: DiagnosticChecklistItem[];
  backtesting: {
    valid_cutoffs_count: number;
    total_attempted_cutoffs: number;
    minimum_required_windows: number;
    evaluation_horizon_months: number;
    evaluation_horizon_weeks?: number;
    cutoffs: CutoffDiagnosticEntry[];
    winning_model?: string | null;
    baseline_mae?: number | null;
    selected_mae?: number | null;
    models: Record<string, unknown>;
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
    metadata: Record<string, unknown>;
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
// HELPER BADGES & FORMATTERS
// ---------------------------------------------------------------------------

function formatReadableDate(value?: string | null) {
  if (!value) return null;
  try {
    const dateStr = value.includes("T") ? value : `${value}T00:00:00`;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function formatIsoDate(isoString?: string | null) {
  if (!isoString) return "Not recorded";
  try {
    return new Date(isoString).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "READY":
    case "VALIDATED":
    case "PASSED":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold gap-1 px-2.5 py-0.5 text-xs">
          <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
          <span>{status === "READY" ? "Ready & Validated" : status === "VALIDATED" ? "Validated" : "Passed"}</span>
        </Badge>
      );
    case "AVAILABLE_UNVALIDATED":
      return (
        <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-semibold gap-1 px-2.5 py-0.5 text-xs">
          <Sparkles className="size-3.5 text-amber-600 shrink-0" />
          <span>Unvalidated (Experimental)</span>
        </Badge>
      );
    case "NEEDS_ATTENTION":
    case "WARNING":
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold gap-1 px-2.5 py-0.5 text-xs">
          <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
          <span>{status === "NEEDS_ATTENTION" ? "Needs Attention" : "Review Warning"}</span>
        </Badge>
      );
    case "NOT_YET_VALIDATED":
      return (
        <Badge className="bg-sky-100 text-sky-800 border-sky-300 font-semibold gap-1 px-2.5 py-0.5 text-xs">
          <Clock className="size-3.5 text-sky-600 shrink-0" />
          <span>Pending Validation</span>
        </Badge>
      );
    case "INSUFFICIENT_DATA":
    case "BLOCKED":
      return (
        <Badge className="bg-slate-100 text-slate-800 border-slate-300 font-semibold gap-1 px-2.5 py-0.5 text-xs">
          <Database className="size-3.5 text-slate-500 shrink-0" />
          <span>{status === "INSUFFICIENT_DATA" ? "Insufficient Data" : "Prerequisite Blocked"}</span>
        </Badge>
      );
    case "ERROR":
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-semibold gap-1 px-2.5 py-0.5 text-xs">
          <ShieldAlert className="size-3.5 text-rose-600 shrink-0" />
          <span>Service Error</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-slate-600 text-xs">
          {status}
        </Badge>
      );
  }
}

const APPROVAL_COLORS: Record<string, string> = {
  RECORDED: "#0f766e",
  APPROVED: "#15803d",
  PENDING: "#d97706",
  VERIFIED: "#2563eb",
  SUBJECT_TO_REVISION: "#e11d48",
};

const CUTOFF_LABELS: Record<string, string> = {
  EVALUATED: "Evaluated",
  NOT_ENOUGH_APPROVED_HISTORY: "Insufficient Approved History",
  GAPS_IN_APPROVED_HISTORY: "Gaps in Approved History",
  INCOMPLETE_TEST_WINDOW: "Incomplete Test Window",
  MISSING_AVAILABILITY_TIMESTAMPS: "Missing Availability Timestamps",
  MODEL_FAILURE: "Model Failure",
};

const PRODUCTION_CUTOFF_LABELS: Record<string, string> = {
  ...CUTOFF_LABELS,
  NOT_ENOUGH_APPROVED_HISTORY: "Insufficient Eligible History",
  GAPS_IN_APPROVED_HISTORY: "Gaps in Eligible History",
};

// ---------------------------------------------------------------------------
// MAIN COMPONENT: ForecastReadinessDashboard
// ---------------------------------------------------------------------------

interface ForecastReadinessDashboardProps {
  onSelectTargetForDeepAnalysis?: (domain: string, target: string, unit: string) => void;
}

export function ForecastReadinessDashboard({
  onSelectTargetForDeepAnalysis,
}: ForecastReadinessDashboardProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string>("milk");
  const [horizonMonths, setHorizonMonths] = useState<number>(6);
  const [activeTab, setActiveTab] = useState<"overview" | "checklist" | "timeline" | "data_quality">("overview");
  const [checklistFilter, setChecklistFilter] = useState<string>("ALL");

  // Fetch Authoritative Readiness Diagnostics from Backend
  const { data, isPending, isError, error, refetch, isFetching } = useQuery<DiagnosticsApiResponse>({
    queryKey: ["forecast-readiness-diagnostics", horizonMonths],
    queryFn: async () => {
      const res = await api.get<DiagnosticsApiResponse>("analytics/predictive/diagnostics/", {
        params: { horizon: horizonMonths },
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const summaryCards = data?.summary_cards || [];
  const activeTargetId = data?.diagnostics?.[selectedTargetId]
    ? selectedTargetId
    : summaryCards[0]?.id || selectedTargetId;
  const selectedDiagnostic = data?.diagnostics?.[activeTargetId];
  const isProductionTarget = selectedDiagnostic?.domain === "production";
  const observationLabel = selectedDiagnostic?.frequency === "WEEKLY" ? "week(s)" : "month(s)";
  const approvalBreakdown = selectedDiagnostic?.progress.approval_status_breakdown;
  const approvalRows = approvalBreakdown?.statuses || [];
  const approvalCount = (code: string) => approvalRows.find((row) => row.status === code)?.count || 0;
  const pendingCount = approvalCount("PENDING");
  const verifiedCount = approvalCount("VERIFIED");
  const returnedCount = approvalCount("SUBJECT_TO_REVISION");
  const evaluatedCount = selectedDiagnostic?.backtesting.valid_cutoffs_count || 0;
  const attemptedCount = selectedDiagnostic?.backtesting.total_attempted_cutoffs || 0;
  const requiredWindows = selectedDiagnostic?.backtesting.minimum_required_windows || 0;
  const readinessLabel = selectedDiagnostic?.forecast_status === "READY"
    ? "Forecast Available and Evaluated"
    : selectedDiagnostic?.forecast_available
      ? "Forecast Available, Validation Limited"
      : selectedDiagnostic?.forecast_status === "NEEDS_ATTENTION" || selectedDiagnostic?.forecast_status === "ERROR"
        ? "Forecast Needs Attention"
        : "Forecast Not Yet Available";

  const nextAction = !isProductionTarget && returnedCount > 0
    ? "Review returned records, correct them, and resubmit where appropriate."
    : !isProductionTarget && pendingCount + verifiedCount > 0
      ? selectedDiagnostic?.forecast_available
        ? "Review pending submissions when appropriate; they are not included in approved forecasting history."
        : "Review pending submissions and continue collecting approved history. Later approvals cannot change what was known at past cutoffs."
      : evaluatedCount < requiredWindows
        ? isProductionTarget
          ? "Continue recording complete production logs and inspect skipped cutoff reasons."
          : "Continue collecting complete, approved periods and inspect skipped cutoff reasons."
        : selectedDiagnostic?.next_step || "Refresh diagnostics after relevant data changes.";

  // Filter checklist items
  const filteredChecklist = useMemo(() => {
    if (!selectedDiagnostic?.checklist) return [];
    if (checklistFilter === "ALL") return selectedDiagnostic.checklist;
    return selectedDiagnostic.checklist.filter((item) => item.status === checklistFilter);
  }, [selectedDiagnostic, checklistFilter]);

  // Checklist counts
  const checklistCounts = useMemo(() => {
    const list = selectedDiagnostic?.checklist || [];
    return {
      total: list.length,
      passed: list.filter((i) => i.status === "PASSED").length,
      warning: list.filter((i) => i.status === "WARNING").length,
      blocked: list.filter((i) => i.status === "BLOCKED").length,
    };
  }, [selectedDiagnostic]);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* DASHBOARD HEADER & REFRESH ACTION */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-emerald-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                <Compass className="size-5" />
              </span>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                Municipal Forecast Readiness & Validation Engine
              </h2>
            </div>


            <p className="text-xs md:text-sm text-emerald-100/80 max-w-3xl leading-relaxed">
              Provides transparent, evidence-based verification for Padre Garcia agricultural forecasts.
              Inspect observation coverage, backtesting progress, and operational blockers before relying on forward projections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300">
              <Sliders className="size-3.5 text-emerald-400" />
              <span>Horizon:</span>
              <select
                aria-label="Forecast Horizon Months"
                value={horizonMonths}
                onChange={(e) => setHorizonMonths(Number(e.target.value))}
                className="bg-transparent text-emerald-300 font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value={3} className="bg-slate-900 text-white">3 Months</option>
                <option value={6} className="bg-slate-900 text-white">6 Months</option>
                <option value={9} className="bg-slate-900 text-white">9 Months</option>
                <option value={12} className="bg-slate-900 text-white">12 Months</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="bg-emerald-800/40 hover:bg-emerald-700/60 text-white border-emerald-600/50 text-xs font-semibold gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin text-emerald-300" : ""}`} />
              <span>{isFetching ? "Re-evaluating..." : "Re-evaluate Readiness"}</span>
            </Button>
          </div>
        </div>

        {/* Status banner with timestamp */}
        <div className="mt-4 pt-4 border-t border-emerald-800/50 flex flex-wrap items-center justify-between text-xs text-emerald-200/70 gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Real-time municipal review timestamps evaluated strictly chronologically (leakage-safe).</span>
          </div>
          {data?.last_checked_at && (
            <span>Last checked: {formatIsoDate(data.last_checked_at)}</span>
          )}
        </div>
      </div>



      {/* ------------------------------------------------------------------ */}
      {/* PHASE 2: 4 SUMMARY METRIC CARDS */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="size-4 text-emerald-700" />
              Core Municipal Forecast Targets
            </h3>
            <p className="text-xs text-slate-500">
              Select any target to view detailed requirements checklist, backtesting windows, and forward projections.
            </p>
          </div>
        </div>

        {isPending ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-10 w-full" />
              </Card>
            ))}
          </div>
        ) : isError ? (
          <Card className="p-6 border-rose-200 bg-rose-50/50 text-rose-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Failed to load forecast readiness diagnostics</h4>
                <p className="text-xs text-rose-700 mt-1">
                  {error instanceof Error ? error.message : "The analytics service encountered a database connectivity error."}
                </p>
                <Button size="sm" variant="outline" onClick={() => refetch()} className="mt-3 text-xs bg-white">
                  Retry Evaluation
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map((card) => {
              const isSelected = activeTargetId === card.id;
              const progressPct = card.observations_progress_pct;

              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedTargetId(card.id)}
                  className={`rounded-xl border p-4 transition-all cursor-pointer flex flex-col justify-between relative ${
                    isSelected
                      ? "bg-white border-emerald-600 shadow-md ring-2 ring-emerald-600/20"
                      : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-xs"
                  }`}
                >
                  {/* Top Bar: Target Label & Status */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 tracking-tight">
                          {card.label}
                        </h4>
                        <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
                          {card.domain} · {card.unit}
                        </span>
                      </div>
                      <StatusBadge status={card.forecast_status} />
                    </div>

                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-snug">
                      {card.description}
                    </p>

                    {/* Progress Bar & Observations */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700">Historical Coverage</span>
                        <span className="font-bold text-slate-900">
                          {card.usable_observations} / {card.required_observations} {card.observation_label || (card.frequency === "WEEKLY" ? "wk" : "mo")}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            progressPct >= 100
                              ? "bg-emerald-500"
                              : progressPct >= 50
                              ? "bg-amber-500"
                              : "bg-slate-400"
                          }`}
                          style={{ width: `${Math.min(100, progressPct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-2xs text-slate-500 mt-1">
                        <span>{card.milestone_label.split(":")[0]}</span>
                        <span>{progressPct}% of target</span>
                      </div>
                    </div>

                    {/* Backtesting Cutoffs Info */}
                    <div className="mt-2.5 flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <span className="text-slate-600 flex items-center gap-1">
                        <History className="size-3 text-slate-500" />
                        Valid Cutoffs:
                      </span>
                      <span className={`font-bold ${card.valid_cutoffs_count > 0 ? "text-emerald-700" : "text-slate-600"}`}>
                        {card.valid_cutoffs_count} of {card.total_cutoffs_count}
                      </span>
                    </div>

                    {/* Current Blocker / Status summary */}
                    <div className="mt-2.5 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Status: </span>
                      <span className="line-clamp-2 text-slate-600 leading-snug">
                        {card.blocker_summary}
                      </span>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-2xs text-slate-500">
                      Model: <span className="font-semibold text-slate-700">{card.model_name || "None"}</span>
                    </span>
                    <span className={`text-xs font-semibold flex items-center gap-1 ${isSelected ? "text-emerald-700" : "text-slate-600"}`}>
                      {isSelected ? "Inspecting" : "Inspect"}
                      <ArrowRight className="size-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedDiagnostic && <section aria-label="Source record status and forecast readiness" className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">{isProductionTarget ? "Production analytics eligibility" : "Record approval status"}</h4>
              <p className="mt-1 text-xs text-slate-600">{isProductionTarget ? "Only current RECORDED farmer logs qualify; historical approval-state rows are excluded." : "Counts are source records in this target’s authorized scope, not forecast periods or quantities."}</p>
            </div>
            {approvalBreakdown?.available && <Badge variant="outline">{approvalBreakdown.source_model}</Badge>}
          </div>
          {approvalBreakdown?.available ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                {(isProductionTarget
                  ? [["Farmer-recorded logs", approvalCount("RECORDED"), "RECORDED"], ["Eligible records", approvalBreakdown.total_records || 0, "TOTAL"]]
                  : [["Approved", approvalCount("APPROVED"), "APPROVED"], ["Pending review", pendingCount, "PENDING"], ["Verified", verifiedCount, "VERIFIED"], ["Returned for revision", returnedCount, "SUBJECT_TO_REVISION"], ["Total records", approvalBreakdown.total_records || 0, "TOTAL"]]
                ).map(([label, count, code]) => (
                  <div key={String(code)} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2" title={isProductionTarget ? "Status context only; routine farmer production logs do not require review." : code === "VERIFIED" ? "Field-verified; still not MAO-approved for forecasting." : `${label}: source record count`}>
                    <p className="text-[11px] text-slate-600">{label}</p>
                    <p className="text-lg font-bold text-slate-900">{Number(count).toLocaleString()}</p>
                          {code !== "TOTAL" && <p className="text-[10px] text-slate-500">{approvalBreakdown.total_records ? `${Math.round(Number(count) / approvalBreakdown.total_records * 100)}% of records` : "0% of records"}</p>}
                  </div>
                ))}
              </div>
              <div className="relative mx-auto h-36 w-36" role="img" aria-label={`${isProductionTarget ? "Production record status" : "Approval status"} chart for ${approvalBreakdown.total_records || 0} total records`}>
                {(approvalBreakdown.total_records || 0) > 0 ? <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={approvalRows.filter((row) => row.count > 0)} dataKey="count" nameKey="label" innerRadius={43} outerRadius={65} paddingAngle={2}>
                        {approvalRows.filter((row) => row.count > 0).map((row) => <Cell key={row.status} fill={APPROVAL_COLORS[row.status] || "#64748b"} />)}
                      </Pie>
                      <Tooltip formatter={(value, name) => {
                        const count = Number(value || 0);
                        const total = approvalBreakdown.total_records || 0;
                        return [`${count} (${total ? Math.round(count / total * 100) : 0}%)`, name];
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-slate-900">{approvalBreakdown.total_records}</span>
                    <span className="text-[10px] text-slate-500">records</span>
                  </div>
                </> : <div className="flex h-full items-center justify-center rounded-full border-4 border-slate-100 text-xs text-slate-500">No records</div>}
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Approval-status counts are not available for this source.</p>
          )}
          {approvalBreakdown?.scope_note && <p className="mt-2 text-[11px] text-slate-500">{approvalBreakdown.scope_note}</p>}
          {isProductionTarget && (pendingCount + verifiedCount + returnedCount > 0) && (
            <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
              Legacy pending, verified, or returned statuses are shown for historical context and are excluded from forecasting. Routine farmer production records do not wait for review.
            </div>
          )}
          {!isProductionTarget && (pendingCount + verifiedCount + returnedCount > 0) && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              {returnedCount > 0 && <p>There {returnedCount === 1 ? "is" : "are"} {returnedCount} record(s) returned for revision. Review the remarks, correct, and resubmit where appropriate.</p>}
              {(pendingCount + verifiedCount > 0) && <p className={returnedCount ? "mt-1" : ""}>{pendingCount + verifiedCount} record(s) are pending final approval and are excluded from approved forecasting history. Their later approval will not retroactively make them available at past backtest cutoffs.</p>}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-bold text-slate-900">{readinessLabel}</h4>
          <p className="mt-2 text-xs leading-relaxed text-slate-700">
            {selectedDiagnostic.forecast_available
              ? `${selectedDiagnostic.progress.usable_observations} usable ${observationLabel} are available. ${selectedDiagnostic.validation_details}`
              : selectedDiagnostic.readiness_details || selectedDiagnostic.blocker_summary}
          </p>
          <div className="mt-3 rounded-lg border border-white bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next action</p>
            <p className="mt-1 text-xs text-slate-800">{nextAction}</p>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Backtesting cutoffs: {evaluatedCount} evaluated of {attemptedCount} attempted · minimum {requiredWindows}. Validation criteria: {selectedDiagnostic.forecast_status === "READY" ? "satisfied" : "not yet satisfied"}. Approval counts are separate from cutoff counts.</p>
        </div>
      </section>}

      {/* ------------------------------------------------------------------ */}
      {/* DETAIL DIAGNOSTIC VIEW FOR SELECTED TARGET */}
      {/* ------------------------------------------------------------------ */}
      {selectedDiagnostic && (
        <Card className="border-slate-200 shadow-xs bg-white rounded-2xl overflow-hidden">
          {/* Detailed Header */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/70">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                    {selectedDiagnostic.label}
                  </h3>
                  <StatusBadge status={selectedDiagnostic.forecast_status} />
                  {selectedDiagnostic.forecast_available && (
                    <Badge variant="outline" className="text-xs bg-slate-100 font-medium">
                      Horizon: {selectedDiagnostic.frequency === "WEEKLY" ? selectedDiagnostic.forecast.horizon_weeks : selectedDiagnostic.forecast.horizon_months} {selectedDiagnostic.frequency === "WEEKLY" ? "Weeks" : "Months"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Source: <span className="font-medium text-slate-800">{selectedDiagnostic.source}</span> · Minimum Requirement:{" "}
                  <span className="font-medium text-slate-800">{selectedDiagnostic.minimum_rule}</span>
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {onSelectTargetForDeepAnalysis && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onSelectTargetForDeepAnalysis(
                        selectedDiagnostic.domain,
                        selectedDiagnostic.target,
                        selectedDiagnostic.unit
                      )
                    }
                    className="text-xs font-medium text-emerald-800 border-emerald-300 hover:bg-emerald-50 cursor-pointer"
                  >
                    <Compass className="size-3.5 mr-1 text-emerald-700" />
                    Benchmark All 6 Models
                  </Button>
                )}
              </div>
            </div>

            {/* Unvalidated Experimental Warning Banner (Phase 5) */}
            {selectedDiagnostic.forecast_status === "AVAILABLE_UNVALIDATED" && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950">
                    Unvalidated Forecast (Experimental Projection)
                  </p>
                  <p className="text-amber-800 leading-relaxed">
                    This forward projection was fitted on all {selectedDiagnostic.progress.usable_observations} observed {selectedDiagnostic.frequency === "WEEKLY" ? "weekly" : "monthly"} periods.
                    Historical validation is limited: {selectedDiagnostic.backtesting.valid_cutoffs_count} of {selectedDiagnostic.backtesting.total_attempted_cutoffs} attempted cutoffs produced an evaluation. Use this projection as decision support, not a proven accuracy claim.
                  </p>
                </div>
              </div>
            )}

            {/* Validated Banner */}
            {selectedDiagnostic.forecast_status === "READY" && (
              <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
                <Award className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-950">
                    Empirically Validated Against Historical Baseline
                  </p>
                  <p className="text-emerald-800 leading-relaxed">
                    {selectedDiagnostic.validation_details} Selected model (
                    <span className="font-semibold">{selectedDiagnostic.backtesting.winning_model || "Naive Baseline"}</span>
                    ) outperformed naive benchmarks on holdout tests.
                  </p>
                </div>
              </div>
            )}

            {/* Insufficient Data Banner */}
            {selectedDiagnostic.forecast_status === "INSUFFICIENT_DATA" && (
              <div className="mt-4 p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs flex items-start gap-3">
                <Database className="size-4 text-slate-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-slate-900">
                    Forecast Withheld: Insufficient Historical Observations
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    The municipal dataset currently contains {selectedDiagnostic.progress.usable_observations} observed {observationLabel}.
                    A minimum of {selectedDiagnostic.progress.required_observations} contiguous {observationLabel} is required to establish temporal lags without fabricating data.
                  </p>
                </div>
              </div>
            )}

            <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">Detailed source diagnostics</summary>
            {selectedDiagnostic.progress.milk_diagnostics && (
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900">Milk records behind this forecast</h4>
                  <span className="text-xs font-medium text-slate-600">
                    Records through {formatReadableDate(selectedDiagnostic.progress.data_through_date) || "no completed month yet"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Eligible records used", selectedDiagnostic.progress.milk_diagnostics.usable_records],
                    ["With availability timestamp", selectedDiagnostic.progress.milk_diagnostics.records_with_availability_timestamp ?? selectedDiagnostic.progress.milk_diagnostics.records_with_approval_timestamp],
                    ["Dates with records", selectedDiagnostic.progress.milk_diagnostics.usable_production_days],
                    ["Months with eligible records", selectedDiagnostic.progress.milk_diagnostics.months_with_records],
                    ["Months without eligible records", selectedDiagnostic.progress.milk_diagnostics.months_without_records],
                    ["Legacy pending", selectedDiagnostic.progress.milk_diagnostics.pending_records],
                    ["Legacy returned", selectedDiagnostic.progress.milk_diagnostics.returned_records],
                    ["Missing availability time", selectedDiagnostic.progress.milk_diagnostics.missing_approval_timestamp_records],
                    ["Duplicate-session conflicts excluded", selectedDiagnostic.progress.milk_diagnostics.excluded_duplicate_conflict_records],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-sky-100 bg-white px-3 py-2">
                      <p className="text-[11px] text-slate-600">{label}</p>
                      <p className="text-sm font-bold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-slate-700">
                  <p className="font-semibold">Session rows by recorded date</p>
                  <p className="mt-1">
                    One session: {selectedDiagnostic.progress.milk_diagnostics.days_with_one_session} · Two: {selectedDiagnostic.progress.milk_diagnostics.days_with_two_sessions} · Three: {selectedDiagnostic.progress.milk_diagnostics.days_with_three_sessions} · Unknown or conflicting: {selectedDiagnostic.progress.milk_diagnostics.days_with_unknown_or_conflicting_sessions}
                  </p>
                  <p className="mt-1">{selectedDiagnostic.progress.milk_diagnostics.session_completeness_note}</p>
                  <p className="mt-1">{selectedDiagnostic.progress.milk_diagnostics.monthly_completeness_note}</p>
                  <p className="mt-2">
                    Forecast generation: <b>{selectedDiagnostic.forecast_available ? "available" : "withheld"}</b>. Historical backtest: <b>{selectedDiagnostic.backtesting.valid_cutoffs_count} valid of {selectedDiagnostic.backtesting.total_attempted_cutoffs} attempted cutoffs</b>. Open “Cutoff Timeline” to see why each window was skipped.
                  </p>
                </div>
              </div>
            )}

            {selectedDiagnostic.progress.auction_diagnostics && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900">Auction activity recorded in SmartLivestock</h4>
                  <Badge variant="outline" className="border-amber-300 bg-white text-amber-900">Coverage unknown</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Approved transfers", selectedDiagnostic.progress.auction_diagnostics.approved_transfers],
                    ["Pending review", selectedDiagnostic.progress.auction_diagnostics.pending_transfers],
                    ["Returned for revision", selectedDiagnostic.progress.auction_diagnostics.returned_transfers],
                    ["Synthetic rows", selectedDiagnostic.progress.auction_diagnostics.synthetic_transfers],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-amber-100 bg-white px-3 py-2">
                      <p className="text-[11px] text-slate-600">{label}</p>
                      <p className="text-sm font-bold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-800">Recorded approved transfers by weekday</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {selectedDiagnostic.progress.auction_diagnostics.weekday_activity.map((day) => (
                      <div key={day.weekday} className={`rounded-lg border px-2.5 py-2 ${day.weekday === "Friday" ? "border-amber-400 bg-amber-100" : day.weekday === "Thursday" ? "border-orange-300 bg-orange-50" : "border-amber-100 bg-white"}`}>
                        <p className="text-[11px] font-semibold text-slate-700">{day.weekday}</p>
                        <p className="text-sm font-bold text-slate-900">{day.transaction_count} transfer(s)</p>
                        <p className="text-[10px] text-slate-600">{day.heads_sold} head(s)</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-700">{selectedDiagnostic.progress.auction_diagnostics.weekday_pattern_note}</p>
                  <p className="mt-1 text-xs text-slate-700">{selectedDiagnostic.progress.auction_diagnostics.duplicate_detection_note}</p>
                </div>
              </div>
            )}

            {selectedDiagnostic.progress.source_diagnostics && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-bold text-slate-900">Source record and measurement diagnostics</h4>
                <p className="mt-1 text-xs text-slate-600">{selectedDiagnostic.progress.source_diagnostics.source_record_type}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(selectedDiagnostic.progress.source_diagnostics)
                    .filter(([key, value]) => typeof value === "number" && !key.includes("synthetic"))
                    .map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[11px] text-slate-600">{key.replaceAll("_", " ")}</p>
                        <p className="text-sm font-bold text-slate-900">{value as number}</p>
                      </div>
                    ))}
                </div>
                <p className="mt-3 text-xs text-slate-700">{selectedDiagnostic.progress.source_diagnostics.period_coverage_note}</p>
                <p className="mt-1 text-xs text-slate-700">{selectedDiagnostic.progress.source_diagnostics.availability_note}</p>
              </div>
            )}
            </details>
          </div>

          {/* DIAGNOSTIC DETAIL TABS */}
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="bg-slate-100 p-1 rounded-xl mb-6 flex flex-wrap">
                <TabsTrigger value="overview" className="text-xs font-semibold px-4 py-2 rounded-lg">
                  <LineChartIcon className="size-3.5 mr-1.5" />
                  Projection & Trends
                </TabsTrigger>
                <TabsTrigger value="checklist" className="text-xs font-semibold px-4 py-2 rounded-lg">
                  <FileCheck2 className="size-3.5 mr-1.5" />
                  Readiness Checklist ({checklistCounts.passed}/{checklistCounts.total})
                </TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs font-semibold px-4 py-2 rounded-lg">
                  <History className="size-3.5 mr-1.5" />
                  Cutoff Timeline ({selectedDiagnostic.backtesting.valid_cutoffs_count} Valid)
                </TabsTrigger>
                <TabsTrigger value="data_quality" className="text-xs font-semibold px-4 py-2 rounded-lg">
                  <Database className="size-3.5 mr-1.5" />
                  Data Integrity & Coverage
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: OVERVIEW & PROJECTION CHART */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
                      Usable History
                    </span>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {selectedDiagnostic.progress.usable_observations}{" "}
                      <span className="text-xs font-normal text-slate-500">{observationLabel}</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Through {formatReadableDate(selectedDiagnostic.progress.data_through_date) || "latest recorded month"}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
                      Operational Model
                    </span>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {selectedDiagnostic.forecast.model_name || "None"}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {selectedDiagnostic.backtesting.selected_mae !== null && selectedDiagnostic.backtesting.selected_mae !== undefined
                        ? `Validation MAE: ${selectedDiagnostic.backtesting.selected_mae} ${selectedDiagnostic.unit}`
                        : "Experimental baseline fit"}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
                      Next Step / Action
                    </span>
                    <p className="text-xs font-medium text-slate-900 mt-1 leading-snug">
                      {selectedDiagnostic.next_step}
                    </p>
                  </div>
                </div>

                {/* Timeline Chart */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-white">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        Historical Observations vs Forward Horizon Projection
                      </h4>
                      <p className="text-xs text-slate-500">
                        Solid line represents {isProductionTarget ? "eligible farmer-recorded values" : "approved recorded values"}; dashed line shows {selectedDiagnostic.frequency === "WEEKLY" ? selectedDiagnostic.forecast.horizon_weeks : selectedDiagnostic.forecast.horizon_months}-{selectedDiagnostic.frequency === "WEEKLY" ? "week" : "month"} forward forecast.
                      </p>
                    </div>
                  </div>

                  <div className="h-72 w-full">
                    {selectedDiagnostic.forecast.chart_data?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={selectedDiagnostic.forecast.chart_data}
                          margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="month_label"
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            stroke="#cbd5e1"
                            angle={-45}
                            textAnchor="end"
                            height={55}
                            interval="preserveStartEnd"
                            minTickGap={10}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#64748b" }}
                            stroke="#cbd5e1"
                            unit={` ${selectedDiagnostic.unit.slice(0, 3)}`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0f172a",
                              borderColor: "#1e293b",
                              borderRadius: "0.75rem",
                              color: "#fff",
                              fontSize: "12px",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />

                          {/* Historical Actual line */}
                          <Line
                            type="monotone"
                            dataKey="actual"
                            name={`Actual Observed (${selectedDiagnostic.unit})`}
                            stroke="#0f766e"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: "#0f766e" }}
                            connectNulls={false}
                          />

                          {/* Forward Projection line */}
                          <Line
                            type="monotone"
                            dataKey="forecast"
                            name={`Forward Projection (${selectedDiagnostic.forecast.model_name || "Baseline"})`}
                            stroke="#d97706"
                            strokeWidth={2.5}
                            strokeDasharray="5 5"
                            dot={{ r: 4, fill: "#d97706" }}
                            connectNulls={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                        <Database className="size-10 text-slate-300 mb-2" />
                        <p className="text-sm font-semibold text-slate-700">No chart data available</p>
                        <p className="text-xs text-slate-500 max-w-sm mt-1">
                          Historical observations have not yet reached the minimum threshold to render a chart series.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: READINESS CHECKLIST (PHASE 3) */}
              <TabsContent value="checklist" className="space-y-4">
                {/* Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Filter checks:</span>
                    <button
                      onClick={() => setChecklistFilter("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        checklistFilter === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All ({checklistCounts.total})
                    </button>
                    <button
                      onClick={() => setChecklistFilter("PASSED")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        checklistFilter === "PASSED" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      Passed ({checklistCounts.passed})
                    </button>
                    <button
                      onClick={() => setChecklistFilter("WARNING")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        checklistFilter === "WARNING" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                      }`}
                    >
                      Warnings ({checklistCounts.warning})
                    </button>
                    <button
                      onClick={() => setChecklistFilter("BLOCKED")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        checklistFilter === "BLOCKED" ? "bg-rose-700 text-white" : "bg-rose-50 text-rose-800 hover:bg-rose-100"
                      }`}
                    >
                      Blocked ({checklistCounts.blocked})
                    </button>
                  </div>

                  <span className="text-2xs text-slate-500">
                    12 Authoritative Quality & Governance Checks
                  </span>
                </div>

                {/* Checklist items list */}
                <div className="space-y-3">
                  {filteredChecklist.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                            <h5 className="font-bold text-sm text-slate-900">{item.title}</h5>
                            <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {item.category.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                            {item.explanation}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>

                      {/* Actual vs Expected */}
                      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="font-semibold text-slate-500 text-2xs uppercase tracking-wider block">
                            System Finding / Actual:
                          </span>
                          <span className="font-bold text-slate-900 mt-0.5 block">
                            {item.actual_value}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="font-semibold text-slate-500 text-2xs uppercase tracking-wider block">
                            Standard Requirement:
                          </span>
                          <span className="font-medium text-slate-800 mt-0.5 block">
                            {item.expected_requirement}
                          </span>
                        </div>
                      </div>

                      {/* Action Needed */}
                      {item.action_needed && (
                        <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2">
                          <Compass className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Action Required: </span>
                            <span>{item.action_needed}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* TAB 3: CUTOFF TIMELINE (PHASE 4) */}
              <TabsContent value="timeline" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Evaluated", selectedDiagnostic.backtesting.valid_cutoffs_count],
                    ["Attempted", selectedDiagnostic.backtesting.total_attempted_cutoffs],
                    ["Minimum for validation", selectedDiagnostic.backtesting.minimum_required_windows],
                  ].map(([label, count]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-600">{label}</p><p className="text-lg font-bold text-slate-900">{count}</p>
                  </div>)}
                </div>
                <p className="text-xs text-slate-600">Validation criteria: <strong>{selectedDiagnostic.forecast_status === "READY" ? "satisfied" : "not yet satisfied"}</strong>. These are historical forecast windows; they are not the count of records awaiting approval.</p>
                <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-bold text-slate-900">How backtesting works</summary>
                  <div className="flex items-start gap-2.5">
                    <Info className="size-4 text-emerald-700 shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed text-slate-700">Backtesting asks how a model would have performed in the past: it uses only information available by a simulated cutoff, predicts a later period, then compares that prediction with the actual result. A cutoff is the model&apos;s knowledge date, not the production date. Example only (not live results): cutoff June 30, 2026 → predict July 2026 → train on eligible information available before the cutoff → compare with July&apos;s actual value.</p>
                  </div>
                </details>

                <h4 className="text-sm font-bold text-slate-900">Historical cutoff results</h4>
                {selectedDiagnostic.backtesting.cutoffs?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDiagnostic.backtesting.cutoffs.map((cutoff, cIdx) => {
                      const code = cutoff.reason_code || cutoff.status;
                      const isEvaluated = code === "EVALUATED";
                      return (
                        <details
                          key={cIdx}
                          className={`p-4 rounded-xl border transition-all ${
                            isEvaluated
                              ? "bg-white border-emerald-300 shadow-xs"
                              : "bg-slate-50/60 border-slate-200"
                          }`}
                        >
                          <summary className="list-none cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">
                                Predicting: {cutoff.forecast_week || cutoff.forecast_month || "period unavailable"}
                              </span>
                              <span className="text-2xs text-slate-500 font-medium">
                                · Cutoff {formatReadableDate(cutoff.cutoff_date) || cutoff.cutoff_date}
                              </span>
                            </div>
                            <Badge
                              className={`text-2xs px-2 py-0.5 ${
                                isEvaluated
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-slate-200 text-slate-700 border-slate-300"
                              }`}
                            >
                              {(isProductionTarget ? PRODUCTION_CUTOFF_LABELS[code] : CUTOFF_LABELS[code]) || cutoff.status}
                            </Badge>
                          </summary>

                          <div className="mt-2 text-xs text-slate-600 flex flex-wrap items-center gap-4">
                            <span>
                              Eligible training history:{" "}
                              <strong className="text-slate-900">{selectedDiagnostic.frequency === "WEEKLY" ? cutoff.available_training_weeks : cutoff.available_training_months} {selectedDiagnostic.frequency === "WEEKLY" ? "week(s)" : "month(s)"}</strong>
                            </span>
                            {cutoff.earliest_training_month && cutoff.latest_training_month && (
                              <span>
                                Period: <strong className="text-slate-900">{cutoff.earliest_training_month} to {cutoff.latest_training_month}</strong>
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 mt-2 bg-white/70 p-2 rounded-lg border border-slate-100">
                            <strong>{isEvaluated ? "Result" : "Why it was skipped"}:</strong> {cutoff.reason}
                          </p>
                          <p className="mt-2 text-[11px] text-slate-500">Backend status: {cutoff.status}{cutoff.reason_code ? ` · reason code: ${cutoff.reason_code}` : ""}</p>
                          {cutoff.actual_values && cutoff.test_periods && (
                            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                              <table className="w-full min-w-[420px] text-left text-xs">
                                <thead className="bg-slate-50 text-slate-600"><tr><th className="p-2">Period</th><th className="p-2">Actual</th>{Object.keys(cutoff.predictions_by_model || {}).map((model) => <th key={model} className="p-2">{model}</th>)}</tr></thead>
                                <tbody>{cutoff.test_periods.map((period, index) => <tr key={period} className="border-t"><td className="p-2">{period}</td><td className="p-2">{cutoff.actual_values?.[index] ?? "—"}</td>{Object.entries(cutoff.predictions_by_model || {}).map(([model, values]) => <td key={model} className="p-2">{values[index] ?? "—"}</td>)}</tr>)}</tbody>
                              </table>
                            </div>
                          )}
                        </details>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center p-8 bg-slate-50 rounded-xl border border-slate-200 text-slate-500">
                    <History className="size-8 text-slate-400 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700 text-sm">No historical cutoffs evaluated</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">No cutoff results were returned. Forecast availability and validation are separate: a forward projection may be generated without historical evaluation evidence.</p>
                  </div>
                )}
              </TabsContent>

              {/* TAB 4: DATA QUALITY & INTEGRITY (PHASE 8) */}
              <TabsContent value="data_quality" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Reporting Semantics Card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                    <h5 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Scale className="size-4 text-emerald-700" />
                      Target Reporting Semantics
                    </h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {selectedDiagnostic.expected_reporting}
                    </p>
                    <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                      <p>
                        • <strong>Domain:</strong> {selectedDiagnostic.domain.toUpperCase()}
                      </p>
                      <p>
                        • <strong>Target Metric:</strong> {selectedDiagnostic.target} ({selectedDiagnostic.unit})
                      </p>
                      <p>
                        • <strong>Aggregation Level:</strong> Municipal Monthly Total
                      </p>
                    </div>
                  </div>

                  {/* Quality Indicators */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                    <h5 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-700" />
                      Quality & Timestamp Integrity
                    </h5>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                        <span className="text-slate-600">Missing {selectedDiagnostic.frequency === "WEEKLY" ? "Calendar Weeks" : "Calendar Months"}:</span>
                        <span className="font-bold text-slate-900">
                          {selectedDiagnostic.frequency === "WEEKLY"
                            ? selectedDiagnostic.progress.missing_week_count ?? 0
                            : selectedDiagnostic.progress.missing_month_count}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                        <span className="text-slate-600">Unmeasured Target Records:</span>
                        <span className="font-bold text-slate-900">
                          {selectedDiagnostic.progress.unmeasured_records}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                        <span className="text-slate-600">{isProductionTarget ? "Availability Timestamps Reconstructable:" : "Approval Timestamps Reconstructable:"}</span>
                        <span className={`font-bold ${selectedDiagnostic.progress.approval_reconstructable ? "text-emerald-700" : "text-amber-700"}`}>
                          {selectedDiagnostic.progress.approval_reconstructable
                            ? (isProductionTarget ? "Yes (submission / review timestamps)" : "Yes (review timestamps)")
                            : (isProductionTarget ? "Some timestamps unavailable" : "Pending accumulating reviews")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </Card>
      )}
    </div>
  );
}
