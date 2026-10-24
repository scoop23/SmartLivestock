"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/axios";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  Map,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Link from "next/link";

type PeriodTotals = {
  reports: number;
  affected_heads?: number;
  deaths?: number;
  distinct_identified_livestock: number;
  distinct_herds: number;
  farms: number;
  barangays: number;
};

type SurveillanceResponse = {
  as_of: string;
  periods: {
    latest_complete_week: { start: string; end: string };
    preceding_complete_week: { start: string; end: string };
    last_14_days: { start: string; end: string; is_partial: boolean };
    last_30_days: { start: string; end: string; is_partial: boolean };
  };
  disease: {
    latest_complete_week: PeriodTotals;
    preceding_complete_week: PeriodTotals;
    last_14_days: PeriodTotals;
    last_30_days: PeriodTotals;
    daily_last_14_days: { date: string; reports: number; value: number }[];
    weekly_reported_affected_heads: { start: string; end: string; reports: number; value: number }[];
    by_recorded_classification_30_days: { classification: string; reports: number; affected_heads: number }[];
    clinical_status_counts_30_days: Record<string, number>;
    alert: { level: "NORMAL" | "WATCH" | "ELEVATED" | "INSUFFICIENT_DATA"; explanation: string };
    undated_approved_reports_excluded: number;
  };
  mortality: {
    latest_complete_week: PeriodTotals;
    preceding_complete_week: PeriodTotals;
    last_14_days: PeriodTotals;
    last_30_days: PeriodTotals;
    daily_last_14_days: { date: string; reports: number; value: number }[];
    weekly_reported_deaths: { start: string; end: string; reports: number; value: number }[];
    by_recorded_cause_30_days: { cause: string; reports: number; deaths: number }[];
    identified_animals_last_30_days: number;
    population_denominator: number;
    rate_percent: number | null;
    rate_method: string;
    alert: { level: "NORMAL" | "WATCH" | "ELEVATED" | "INSUFFICIENT_DATA"; explanation: string };
    undated_approved_reports_excluded: number;
  };
  associations: {
    window_days: number;
    count_by_relationship: Record<string, number>;
    events: {
      mortality_record: string;
      mortality_date: string;
      recorded_cause: string;
      disease_record: string;
      disease_date: string;
      recorded_classification: string;
      days_between: number;
      relationship: string;
      disease_farmer?: string | null;
      mortality_farmer?: string | null;
      disease_barangay?: string | null;
      mortality_barangay?: string | null;
      interpretation: string;
    }[];
    truncated: boolean;
  };
  barangays_last_30_days: {
    barangay_id: number;
    barangay: string;
    disease_reports: number;
    affected_heads: number;
    mortality_reports: number;
    deaths: number;
  }[];
  herds_last_30_days: {
    batch_id: number;
    batch_code: string;
    disease_reports: number;
    affected_heads: number;
    mortality_reports: number;
    deaths: number;
  }[];
  data_quality: Record<string, string>;
  historical_backtest: { status: string; usable_evaluation_periods: number; reason: string };
  monthly_forecast_comparison: {
    status: string;
    baseline: string;
    enhanced_model_adopted: boolean;
    evaluation_periods: number;
    mae: number | null;
    rmse: number | null;
    prediction_coverage: number | null;
    reason: string;
  };
};

type ForecastMetric = { mae: number | null; rmse: number | null; prediction_coverage: number; periods: number };
type ForecastExperimentTarget = {
  target: string;
  unit: string;
  horizon_months: number;
  status: string;
  training_status: string;
  candidate_status: string;
  candidate_reason: string;
  baseline_candidate: string;
  simple_baseline_candidate: string;
  calendar_only_candidate: string;
  enhanced_candidate: string;
  training_sample_count: number;
  feature_training_sample_count: number;
  minimum_training_samples: number;
  candidate_forecast: number | null;
  candidate_forecast_month: string | null;
  candidate_quality_note: string | null;
  features_used: string[];
  imputed_features: string[];
  eligible_target_periods: number;
  valid_evaluation_periods: number;
  evaluation_periods: number;
  evaluation_start_month: string | null;
  evaluation_end_month: string | null;
  latest_eligible_target_period: string | null;
  excluded_period_counts: Record<string, number>;
  target_months_without_records_not_scored: number;
  current_partial_month_rows_excluded: number;
  target_rows_without_review_time_excluded_from_training: number;
  baseline: ForecastMetric;
  simple_baseline: ForecastMetric;
  calendar_linear_baseline: ForecastMetric;
  enhanced: ForecastMetric;
  comparison_conclusion: string;
  periods: {
    cutoff: string;
    target_month: string;
    target: string;
    unit: string;
    horizon_months: number;
    actual: number;
    baseline_model: string;
    baseline_prediction: number | null;
    simple_baseline_model: string;
    simple_baseline_prediction: number | null;
    calendar_linear_prediction: number | null;
    enhanced_prediction: number | null;
    enhanced_candidate_status: string;
    baseline_absolute_error: number | null;
    simple_baseline_absolute_error: number | null;
    calendar_linear_absolute_error: number | null;
    enhanced_absolute_error: number | null;
    baseline_squared_error: number | null;
    enhanced_squared_error: number | null;
    available_surveillance_features: string[];
  }[];
  enhanced_model_adopted: false;
  reporting_coverage: string;
};
type ForecastExperimentResponse = {
  status: string;
  evaluation_method: string;
  availability_rule: string;
  missing_data_rule: string;
  feature_rule: string;
  minimum_periods_for_directional_signal: number;
  enhanced_model_adopted: false;
  reason: string;
  targets: Record<string, ForecastExperimentTarget>;
};

const number = (value: number) => value.toLocaleString("en-PH");
const metric = (value: number | null) => value == null ? "Unavailable" : value.toLocaleString("en-PH", { maximumFractionDigits: 3 });
const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

const alertStyle: Record<string, string> = {
  NORMAL: "border-emerald-200 bg-emerald-50 text-emerald-950",
  WATCH: "border-amber-200 bg-amber-50 text-amber-950",
  ELEVATED: "border-rose-200 bg-rose-50 text-rose-950",
  INSUFFICIENT_DATA: "border-slate-200 bg-slate-50 text-slate-800",
};

const alertMeta: Record<string, { badge: string; meaning: string; nextStep: string }> = {
  NORMAL: {
    badge: "Normal Activity",
    meaning: "Reported cases are stable or lower than the previous week.",
    nextStep: "Continue routine animal health monitoring and census records collection.",
  },
  WATCH: {
    badge: "Watch Level",
    meaning: "New or increased disease/mortality reports were recorded this week.",
    nextStep: "Notify assigned SIBAT/CBAT technicians to verify clinical recovery or isolation.",
  },
  ELEVATED: {
    badge: "Elevated Alert",
    meaning: "Substantial increase: Approved reports doubled compared to the preceding week.",
    nextStep: "Immediate Field Priority: Dispatch livestock inspectors to verify cases and inspect farm biosecurity.",
  },
  INSUFFICIENT_DATA: {
    badge: "No Recent Records",
    meaning: "Zero approved disease or mortality reports in both comparison weeks.",
    nextStep: "Check with local encoders to confirm whether field submissions are pending approval.",
  },
};

function AlertPanel({ title, alert, period }: {
  title: string;
  alert: SurveillanceResponse["disease"]["alert"];
  period: { start: string; end: string };
}) {
  const meta = alertMeta[alert.level] || alertMeta.NORMAL;
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-[0_12px_40px_-24px_rgba(0,0,0,.8)] ${alertStyle[alert.level]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <AlertTriangle className="size-4 shrink-0" />
          {title}
        </h3>
        <Badge variant="outline" className="border-current/30 bg-white/70 text-current font-bold text-xs sm:text-sm">
          {meta.badge}
        </Badge>
      </div>
      <p className="mt-2.5 text-sm sm:text-base leading-relaxed opacity-95 font-medium">{alert.explanation}</p>
      <div className="mt-3 rounded-xl bg-white/70 border border-current/20 p-2.5 sm:p-3 text-xs sm:text-sm space-y-1">
        <p className="font-bold text-current uppercase tracking-wider text-xs">Recommended MAO Action:</p>
        <p className="opacity-90 leading-relaxed">{meta.nextStep}</p>
      </div>
      <p className="mt-3 border-t border-current/15 pt-2 text-xs sm:text-sm font-semibold opacity-70">
        OFFICIAL COMPARISON PERIOD · {formatDate(period.start)} – {formatDate(period.end)}
      </p>
    </div>
  );
}

function MetricCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card className="rounded-2xl border-cyan-100 bg-white/90 text-slate-900 shadow-[0_12px_35px_-24px_rgba(8,145,178,.35)]">
      <CardContent className="p-4 sm:p-5">
        <p className="text-xs sm:text-sm font-bold uppercase tracking-[.18em] text-cyan-800/75">{title}</p>
        <p className="mt-2 text-3xl font-black tabular-nums tracking-tight text-slate-950">{value}</p>
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">{detail}</p>
      </CardContent>
    </Card>
  );
}

function RecordedLabel({ value }: { value: string }) {
  const isDemo = /^DEMO ONLY:\s*/i.test(value);
  const label = value.replace(/^DEMO ONLY:\s*/i, "");
  return <span className="inline-flex flex-wrap items-center gap-1.5">{label}{isDemo && <Badge variant="outline" className="border-violet-200 bg-violet-50 px-1.5 py-0 text-xs sm:text-sm text-violet-800">Sample</Badge>}</span>;
}

function getRelationshipMeta(relationship: string) {
  if (relationship === "explicit_source_disease_case" || relationship === "same_livestock") {
    return {
      label: "Direct Animal Link",
      tag: "Same Animal",
      description: "The exact same tagged/identified animal was reported sick and later recorded deceased within 30 days.",
      actionText: "Direct Fatal Complication: Verify treatment history and close out medical incident log.",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dotClass: "bg-emerald-500",
      cardBorder: "border-emerald-200/80 hover:border-emerald-300",
    };
  }
  if (relationship === "same_herd") {
    return {
      label: "Same Herd Outbreak",
      tag: "Same Herd",
      description: "A death occurred in the same herd batch within 30 days of a reported disease on this farm.",
      actionText: "Farm-Level Contagion Risk: Inspect the herd pen, advise isolation, and monitor remaining heads.",
      badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
      dotClass: "bg-indigo-500",
      cardBorder: "border-indigo-200/80 hover:border-indigo-300",
    };
  }
  return {
    label: "Barangay Co-occurrence",
    tag: "Same Barangay",
    description: "An animal died in this barangay within 30 days of a reported disease on a neighboring farm.",
    actionText: "Community Exposure Signal: Check neighboring holdings for shared grazing, water runoff, or roaming contact.",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    dotClass: "bg-slate-400",
    cardBorder: "border-slate-200/80 hover:border-slate-300",
  };
}

function AssociationEventCard({ event }: { event: SurveillanceResponse["associations"]["events"][number] }) {
  const meta = getRelationshipMeta(event.relationship);
  const diseaseBarangay = event.disease_barangay || "Unrecorded Barangay";
  const mortalityBarangay = event.mortality_barangay || "Unrecorded Barangay";
  const sameBarangay = diseaseBarangay === mortalityBarangay && diseaseBarangay !== "Unrecorded Barangay";
  const sameFarmer = event.disease_farmer && event.mortality_farmer && event.disease_farmer === event.mortality_farmer;

  return (
    <article className={`rounded-2xl border bg-white p-3.5 sm:p-4.5 transition-all duration-200 shadow-2xs hover:shadow-xs ${meta.cardBorder}`}>
      {/* Top Meta Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-2.5 pb-2.5 sm:pb-3 border-b border-slate-100 min-w-0">
        {/* Status & Elapsed days */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          <Badge variant="outline" className={`gap-1.5 px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-bold rounded-full shrink-0 ${meta.badgeClass}`}>
            <span className={`size-1.5 sm:size-2 rounded-full ${meta.dotClass}`} />
            {meta.label}
          </Badge>
          <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200/80 rounded-md px-2 py-0.5 sm:px-2.5 sm:py-1 shrink-0">
            <Clock className="size-3.5 text-slate-500 shrink-0" />
            <span>
              {number(event.days_between)} {event.days_between === 1 ? "day" : "days"} elapsed
            </span>
          </div>
        </div>

        {/* Location & Farmer tags */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm min-w-0">
          <span
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 sm:px-2.5 py-0.5 sm:py-1 font-medium text-slate-700 max-w-[200px] sm:max-w-xs truncate shrink-0"
            title={sameBarangay ? diseaseBarangay : `${diseaseBarangay} → ${mortalityBarangay}`}
          >
            <MapPin className="size-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{sameBarangay ? diseaseBarangay : `${diseaseBarangay} → ${mortalityBarangay}`}</span>
          </span>
          {(event.disease_farmer || event.mortality_farmer) && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 sm:px-2.5 py-0.5 sm:py-1 font-medium text-slate-700 max-w-[200px] sm:max-w-xs truncate shrink-0"
              title={
                sameFarmer
                  ? event.disease_farmer || undefined
                  : [event.disease_farmer, event.mortality_farmer].filter(Boolean).join(" / ")
              }
            >
              <User className="size-3.5 text-slate-500 shrink-0" />
              <span className="truncate">
                {sameFarmer
                  ? event.disease_farmer
                  : [event.disease_farmer, event.mortality_farmer].filter(Boolean).join(" / ")}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Chronological Flow Grid (Vertical flow on standard desktop columns to prevent badge clipping, side-by-side on 2xl) */}
      <div className="mt-3.5 grid grid-cols-1 2xl:grid-cols-[1fr_auto_1fr] items-stretch gap-2.5 sm:gap-3 min-w-0">
        {/* Step 1: Preceding Disease Observation */}
        <div className="flex flex-col justify-between rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 via-amber-50/20 to-white p-3 sm:p-3.5 shadow-2xs min-w-0">
          <div className="space-y-1 sm:space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-900 shrink-0">
                <Stethoscope className="size-3.5 sm:size-4 text-amber-700 shrink-0" />
                1. Disease Report
              </span>
              <span className="font-mono text-xs sm:text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-2xs shrink-0">
                {event.disease_record}
              </span>
            </div>
            <div className="pt-0.5 sm:pt-1 min-w-0">
              <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug break-words">
                <RecordedLabel value={event.recorded_classification} />
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500">
                <Calendar className="size-3.5 text-slate-400 shrink-0" />
                <span>Recorded: {formatDate(event.disease_date)}</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 border-t border-amber-200/60 pt-2 text-xs sm:text-sm text-slate-600 space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-slate-500 font-medium shrink-0">Barangay:</span>
              <span className="font-bold text-slate-800 truncate text-right min-w-0">{diseaseBarangay}</span>
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-slate-500 font-medium shrink-0">Farmer:</span>
              <span className="font-semibold text-slate-800 truncate text-right min-w-0">{event.disease_farmer || "Unlinked"}</span>
            </div>
          </div>
        </div>

        {/* Transition Connector (2xl Horizontal) */}
        <div className="hidden 2xl:flex flex-col items-center justify-center px-0.5">
          <div className="flex flex-col items-center gap-1">
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-2xs">
              <ArrowRight className="size-3.5 text-rose-600" />
            </div>
            <span className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-tight whitespace-nowrap bg-slate-100 rounded-full px-2 py-0.5">
              +{event.days_between}d
            </span>
            <div className="h-5 w-px bg-slate-200" />
          </div>
        </div>

        {/* Transition Connector (Vertical Flow for standard/compact viewports) */}
        <div className="flex 2xl:hidden items-center justify-center -my-0.5 py-0.5 z-10">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-rose-800 bg-rose-50/95 border border-rose-200 shadow-2xs rounded-full px-3 py-1">
            <Clock className="size-3.5 text-rose-500 shrink-0" />
            <span>+{event.days_between} {event.days_between === 1 ? "day" : "days"} later</span>
            <ArrowDown className="size-3.5 text-rose-600 shrink-0" />
          </div>
        </div>

        {/* Step 2: Mortality Record */}
        <div className="flex flex-col justify-between rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50/60 via-rose-50/20 to-white p-3 sm:p-3.5 shadow-2xs min-w-0">
          <div className="space-y-1 sm:space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-rose-900 shrink-0">
                <AlertTriangle className="size-3.5 sm:size-4 text-rose-700 shrink-0" />
                2. Mortality Event
              </span>
              <span className="font-mono text-xs sm:text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-2xs shrink-0">
                {event.mortality_record}
              </span>
            </div>
            <div className="pt-0.5 sm:pt-1 min-w-0">
              <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug break-words">
                <RecordedLabel value={event.recorded_cause} />
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500">
                <Calendar className="size-3.5 text-slate-400 shrink-0" />
                <span>Recorded: {formatDate(event.mortality_date)}</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 border-t border-rose-200/60 pt-2 text-xs sm:text-sm text-slate-600 space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-slate-500 font-medium shrink-0">Barangay:</span>
              <span className="font-bold text-slate-800 truncate text-right min-w-0">{mortalityBarangay}</span>
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-slate-500 font-medium shrink-0">Farmer:</span>
              <span className="font-semibold text-slate-800 truncate text-right min-w-0">{event.mortality_farmer || "Unlinked"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Epidemiological Takeaway & Field Action Footer */}
      <div className="mt-3 rounded-xl bg-slate-50/90 border border-slate-200/70 p-2.5 sm:p-3 text-xs sm:text-sm leading-relaxed text-slate-700 space-y-2 min-w-0">
        <div className="flex items-start gap-2 min-w-0">
          <Info className="size-4 text-cyan-700 shrink-0 mt-0.5" />
          <div className="min-w-0 break-words">
            <span className="font-bold text-slate-900">{meta.tag}: </span>
            {meta.description}
          </div>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-1.5 text-xs sm:text-sm font-semibold text-cyan-900 bg-cyan-50/90 border border-cyan-200/60 rounded-lg px-2.5 py-1.5 min-w-0">
          <span className="font-bold uppercase tracking-wider text-xs text-cyan-700 shrink-0">Field Action:</span>
          <span className="min-w-0 break-words">{meta.actionText}</span>
        </div>
      </div>
    </article>
  );
}

const BARANGAY_CHART_COLORS = ["#0891b2", "#059669", "#7c3aed", "#d97706", "#e11d48", "#2563eb", "#65a30d"];

const clinicalStatusLabel: Record<string, string> = {
  NOT_RECORDED: "Resolution not recorded",
  OPEN: "Awaiting follow-up",
  RECOVERED: "Recovered",
  CLOSED: "Closed",
};

function DailyRows({ title, rows, valueLabel }: {
  title: string;
  rows: { date: string; reports: number; value: number }[];
  valueLabel: string;
}) {
  const hasEvents = rows.some((row) => row.reports > 0);
  return (
    <Card className="rounded-2xl border-cyan-100 bg-white/90 text-slate-900 shadow-xs">
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {hasEvents ? (
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {rows.map((row) => (
              <div key={row.date} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm even:bg-cyan-50/70">
                <span className="text-slate-500">{formatDate(row.date)}</span>
                <span className="font-semibold tabular-nums text-slate-800">{number(row.reports)} report(s) · {number(row.value)} {valueLabel}</span>
              </div>
            ))}
          </div>
        ) : <p className="py-5 text-center text-sm text-slate-500">No approved event records in this 14-day window. Reporting completeness is not measured.</p>}
      </CardContent>
    </Card>
  );
}

function WeeklyRows({ title, rows, unit }: {
  title: string;
  rows: { start: string; end: string; reports: number; value: number }[];
  unit: string;
}) {
  const maximum = Math.max(...rows.map((row) => row.value), 1);
  return (
    <Card className="rounded-2xl border-cyan-100 bg-white/90 text-slate-900 shadow-xs">
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => <div key={row.start} className="grid grid-cols-[5.5rem_1fr_5.5rem] items-center gap-2 text-sm">
          <span className="text-slate-500">{formatDate(row.start).replace(/, \d{4}$/, "")}</span>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${number(row.value)} ${unit}`}>
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-[0_0_10px_rgba(6,182,212,.35)]" style={{ width: `${row.value ? Math.max((row.value / maximum) * 100, 3) : 0}%` }} />
          </div>
          <span className="text-right font-semibold tabular-nums text-slate-800">{number(row.value)} {unit}</span>
        </div>)}
        <p className="pt-1 text-sm text-slate-500">Bars show recorded {unit}; zero means no matching approved records, not proven zero activity.</p>
      </CardContent>
    </Card>
  );
}

export default function SurveillanceAnalytics() {
  const { user } = useAuth();
  const [associationPage, setAssociationPage] = useState(1);
  const [associationFilter, setAssociationFilter] = useState<"ALL" | "direct" | "same_herd" | "same_barangay">("ALL");
  const [associationSearch, setAssociationSearch] = useState("");
  const [runForecastExperiment, setRunForecastExperiment] = useState(false);
  const query = useQuery({
    queryKey: ["disease-mortality-surveillance", user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<SurveillanceResponse>("analytics/surveillance/", { signal });
      return data;
    },
    staleTime: 60_000,
  });
  const experimentQuery = useQuery({
    queryKey: ["surveillance-forecast-experiment", user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<ForecastExperimentResponse>("analytics/surveillance/forecast-experiment/", { signal });
      return data;
    },
    enabled: runForecastExperiment,
    retry: false,
  });

  if (query.isPending) {
    return <div role="status" aria-label="Loading disease and mortality surveillance" className="space-y-4">
      <Skeleton className="h-24 rounded-xl" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-64 rounded-xl" />
    </div>;
  }

  if (query.isError || !query.data) {
    return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-center">
      <p className="text-base font-bold text-rose-900">Surveillance data could not be loaded.</p>
      <p className="mt-1 text-sm text-rose-800">Check access and network connectivity, then retry.</p>
      <Button className="mt-3" variant="outline" onClick={() => void query.refetch()}><RefreshCw className="mr-2 size-4" />Retry</Button>
    </div>;
  }

  const data = query.data;
  const week = data.periods.latest_complete_week;
  const allEmpty = data.disease.last_30_days.reports === 0 && data.mortality.last_30_days.reports === 0;

  const directCount =
    (data.associations.count_by_relationship["explicit_source_disease_case"] || 0) +
    (data.associations.count_by_relationship["same_livestock"] || 0);
  const herdCount = data.associations.count_by_relationship["same_herd"] || 0;
  const barangayCount = data.associations.count_by_relationship["same_barangay"] || 0;

  const filteredAssociations = data.associations.events.filter((event) => {
    if (associationFilter === "direct") {
      if (event.relationship !== "explicit_source_disease_case" && event.relationship !== "same_livestock") {
        return false;
      }
    } else if (associationFilter === "same_herd") {
      if (event.relationship !== "same_herd") return false;
    } else if (associationFilter === "same_barangay") {
      if (event.relationship !== "same_barangay") return false;
    }

    if (associationSearch.trim()) {
      const q = associationSearch.toLowerCase().trim();
      const matchText = [
        event.disease_record,
        event.mortality_record,
        event.recorded_classification,
        event.recorded_cause,
        event.disease_barangay,
        event.mortality_barangay,
        event.disease_farmer,
        event.mortality_farmer,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!matchText.includes(q)) return false;
    }

    return true;
  });

  const associationPageSize = 4;
  const associationPageCount = Math.max(1, Math.ceil(filteredAssociations.length / associationPageSize));
  const currentAssociationPage = Math.min(associationPage, associationPageCount);
  const pageAssociations = filteredAssociations.slice(
    (currentAssociationPage - 1) * associationPageSize,
    currentAssociationPage * associationPageSize,
  );
  const barangayDiseaseTotal = data.barangays_last_30_days.reduce((total, row) => total + row.disease_reports, 0);
  const barangayPieData = data.barangays_last_30_days.filter((row) => row.disease_reports > 0);

  return (
    <section aria-label="Disease surveillance and mortality early warning" className="relative isolate space-y-5 overflow-hidden rounded-[2rem] bg-[#f1f8f8] p-3 text-slate-900 sm:p-5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(6,182,212,.12),transparent_38%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,.09),transparent_35%)]" />
      <Card className="overflow-hidden rounded-3xl border-cyan-200/80 bg-gradient-to-br from-white via-cyan-50/90 to-emerald-50/80 text-slate-900 shadow-[0_22px_70px_-35px_rgba(8,145,178,.28)]">
        <CardContent className="relative flex flex-wrap items-start justify-between gap-5 p-5 sm:p-7">
          <div className="max-w-3xl">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-[.2em] text-cyan-800/80">
              <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,.45)]" />
              MUNICIPAL SURVEILLANCE &amp; EARLY WARNING
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-200 bg-cyan-100/70 p-3">
                <ShieldAlert className="size-6 text-cyan-800" />
              </div>
              <h2 className="text-xl font-black tracking-tight sm:text-2xl text-slate-900">
                Disease &amp; Mortality Surveillance
              </h2>
            </div>
            <p className="mt-3 max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-600">
              Official municipal early-warning dashboard for MAO and administrators. Monitors approved disease cases and death reports across Padre Garcia to detect emerging outbreaks, identify contagion risks in herds, and guide field technician responses.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 border-cyan-300 bg-white/90 text-cyan-900 hover:bg-cyan-50 text-xs font-semibold shadow-2xs">
            <Link href={user?.role?.toUpperCase() === "SIBAT" || user?.role?.toUpperCase() === "CBAT" ? "/sibat-monitoring" : "/gis-map"}>
              <Map className="mr-2 size-4" />Open role-scoped GIS
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard title="Disease · last 30 days" value={number(data.disease.last_30_days.reports)} detail={`${number(data.disease.last_30_days.affected_heads ?? 0)} reported affected heads; ${number(data.disease.last_30_days.distinct_identified_livestock)} distinct linked animals.`} />
        <MetricCard title="Deaths · last 30 days" value={number(data.mortality.last_30_days.deaths ?? 0)} detail={`${number(data.mortality.last_30_days.reports)} approved mortality report(s); ${number(data.mortality.identified_animals_last_30_days)} distinct identified animals.`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AlertPanel title="Disease reports" alert={data.disease.alert} period={week} />
        <AlertPanel title="Reported deaths" alert={data.mortality.alert} period={week} />
      </div>

      <details className="group rounded-2xl border border-cyan-200 bg-white/80 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 text-base font-bold text-slate-800 outline-none hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-600 sm:px-5">
          <span>View detailed charts and records</span>
          <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-semibold text-cyan-900 group-open:hidden">Optional</span>
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 group-open:inline">Hide details</span>
        </summary>
        <div className="space-y-4 border-t border-slate-100 p-3 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard title="Disease reports · complete week" value={number(data.disease.latest_complete_week.reports)} detail={`${number(data.disease.latest_complete_week.affected_heads ?? 0)} affected heads reported; these are not distinct animals.`} />
        <MetricCard title="Estimated mortality rate · last 30 days" value={data.mortality.rate_percent === null ? "Unavailable" : `${data.mortality.rate_percent}%`} detail={`${number(data.mortality.population_denominator)} current approved active individual heads used as denominator.`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <DailyRows title="Daily disease activity · last 14 days (through today)" rows={data.disease.daily_last_14_days} valueLabel="affected heads reported" />
        <DailyRows title="Daily mortality activity · last 14 days (through today)" rows={data.mortality.daily_last_14_days} valueLabel="deaths reported" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <WeeklyRows title="Disease activity · 12 complete weeks" rows={data.disease.weekly_reported_affected_heads} unit="heads" />
        <WeeklyRows title="Mortality · 12 complete weeks" rows={data.mortality.weekly_reported_deaths} unit="deaths" />
      </div>

      {/* Optional Reference: Recorded Classifications & Recorded Death Causes */}
      <details className="group rounded-xl border border-slate-200 bg-slate-50/70 transition-colors">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 outline-none hover:bg-slate-100/80 rounded-xl select-none">
          <span className="flex items-center gap-2">
            <span>Recorded classifications &amp; death causes breakdown</span>
            <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-600 group-open:hidden">
              Optional reference
            </span>
          </span>
          <span className="text-xs sm:text-sm font-semibold text-slate-500 group-open:hidden">+ Show recorded labels</span>
          <span className="hidden text-xs sm:text-sm font-semibold text-slate-500 group-open:inline">− Hide recorded labels</span>
        </summary>
        <div className="border-t border-slate-200 p-3 sm:p-4 bg-white rounded-b-xl">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="rounded-xl border-slate-200 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base font-bold text-slate-900">Disease reports: what was recorded</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs sm:text-sm">
                <p className="text-xs sm:text-sm leading-relaxed text-slate-500">
                  These are the labels written on approved reports, not diagnoses made by this dashboard. “Heads” is the reported affected-animal count.
                </p>
                {data.disease.by_recorded_classification_30_days.length ? (
                  data.disease.by_recorded_classification_30_days.map((row) => (
                    <div key={row.classification} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 text-xs sm:text-sm">
                      <span><RecordedLabel value={row.classification} /></span>
                      <span className="font-semibold tabular-nums">{number(row.reports)} reports · {number(row.affected_heads)} heads</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs sm:text-sm text-slate-500">No approved disease reports in this period.</p>
                )}
                <p className="border-t pt-2 text-xs sm:text-sm leading-relaxed text-slate-500">
                  <strong>Case follow-up</strong> (separate from report approval):{" "}
                  {Object.entries(data.disease.clinical_status_counts_30_days)
                    .map(([status, count]) => `${clinicalStatusLabel[status] ?? status.replaceAll("_", " ")}: ${number(count)}`)
                    .join(" · ") || "no reports"}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-slate-200 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base font-bold text-slate-900">Deaths: recorded causes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs sm:text-sm">
                <p className="text-xs sm:text-sm leading-relaxed text-slate-500">
                  Cause descriptions are shown as recorded on approved mortality reports; they are not independently verified here.
                </p>
                {data.mortality.by_recorded_cause_30_days.length ? (
                  data.mortality.by_recorded_cause_30_days.map((row) => (
                    <div key={row.cause} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 text-xs sm:text-sm">
                      <span><RecordedLabel value={row.cause} /></span>
                      <span className="shrink-0 font-semibold tabular-nums">{number(row.reports)} reports · {number(row.deaths)} deaths</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs sm:text-sm text-slate-500">No approved mortality reports in this period.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </details>

      {allEmpty && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">No approved disease or mortality events were recorded in the last 30 days. This is a database record count, not proof that no events occurred.</div>}

      {/* Disease Reports Preceding Mortality & Other Surveillance Charts Side-by-Side */}
      <div className="grid gap-4 xl:grid-cols-12 items-start min-w-0">
        {/* Left Column: Disease Reports Preceding Mortality (Focused Width) */}
        <div className="min-w-0 xl:col-span-7">
          <Card className="rounded-3xl border-rose-200/90 bg-gradient-to-br from-white via-white to-rose-50/40 shadow-[0_16px_50px_-25px_rgba(225,29,72,.25)] overflow-hidden">
            <CardHeader className="border-b border-rose-100/80 bg-white/80 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 sm:gap-3.5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-100/70 text-rose-700 shadow-2xs">
                    <Activity className="size-4.5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <CardTitle className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                        Disease Reports Preceding Mortality
                      </CardTitle>
                      <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-800 font-bold text-xs sm:text-sm">
                        {number(data.associations.events.length)} pair{data.associations.events.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Temporal co-occurrence tracking within {data.associations.window_days} days to assist clinical review, case progression, and outbreak investigation.
                    </p>
                  </div>
                </div>
              </div>

              {/* Filter Tabs & Search Controls */}
              <div className="mt-3.5 flex flex-col gap-2.5 pt-1.5 sm:flex-row sm:items-center sm:justify-between min-w-0">
                {/* Relationship Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap no-scrollbar min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAssociationFilter("ALL");
                      setAssociationPage(1);
                    }}
                    className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      associationFilter === "ALL"
                        ? "bg-slate-900 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    All ({number(data.associations.events.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssociationFilter("direct");
                      setAssociationPage(1);
                    }}
                    className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      associationFilter === "direct"
                        ? "bg-emerald-700 text-white shadow-2xs"
                        : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60"
                    }`}
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Same Animal ({number(directCount)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssociationFilter("same_herd");
                      setAssociationPage(1);
                    }}
                    className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      associationFilter === "same_herd"
                        ? "bg-indigo-700 text-white shadow-2xs"
                        : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200/60"
                    }`}
                  >
                    <span className="size-1.5 rounded-full bg-indigo-500" />
                    Same Herd ({number(herdCount)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssociationFilter("same_barangay");
                      setAssociationPage(1);
                    }}
                    className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      associationFilter === "same_barangay"
                        ? "bg-slate-700 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span className="size-1.5 rounded-full bg-slate-400" />
                    Same Barangay ({number(barangayCount)})
                  </button>
                </div>

                {/* Quick Search */}
                <div className="relative w-full sm:w-52 lg:w-56 shrink-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search barangay, farmer..."
                    value={associationSearch}
                    onChange={(e) => {
                      setAssociationSearch(e.target.value);
                      setAssociationPage(1);
                    }}
                    className="h-8.5 sm:h-8 pl-8 pr-7 text-xs sm:text-sm bg-white border-slate-200 focus-visible:ring-rose-500/20"
                  />
                  {associationSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssociationSearch("");
                        setAssociationPage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                      title="Clear search"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3.5 sm:p-5 space-y-3.5">
              {/* MAO Field Investigation Guide */}
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-amber-50/60 to-white p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed text-amber-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-xs sm:text-sm">
                  <Info className="size-4.5 text-amber-700 shrink-0" />
                  <span>MAO Field Guide: Investigating {data.associations.window_days}-Day Linked Cases</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5 text-xs sm:text-sm text-amber-950 min-w-0">
                  <div className="rounded-xl bg-white/85 border border-emerald-200 p-2.5 sm:p-3 space-y-1 shadow-2xs min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-xs sm:text-sm">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      1. Same Animal
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      The <strong>exact animal</strong> died after being sick. Check medical logs to see if treatment failed or complication occurred.
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/85 border border-indigo-200 p-2.5 sm:p-3 space-y-1 shadow-2xs min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-800 text-xs sm:text-sm">
                      <span className="size-2 rounded-full bg-indigo-500" />
                      2. Same Herd
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      A death on the <strong>same farm</strong>. Indicates possible pen contagion. Inspect farm biosecurity and isolate exposed heads.
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/85 border border-slate-200 p-2.5 sm:p-3 space-y-1 shadow-2xs min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs sm:text-sm">
                      <span className="size-2 rounded-full bg-slate-400" />
                      3. Same Barangay
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      A death on a <strong>neighboring farm</strong>. Early warning for localized transmission across the barangay.
                    </p>
                  </div>
                </div>
              </div>

              {/* Results List */}
              {data.associations.events.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-8 text-center space-y-2">
                  <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
                  <h4 className="text-base font-bold text-slate-900">No preceding disease-mortality pairs found</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    No approved disease reports preceded any mortality records within {data.associations.window_days} days in the active database.
                  </p>
                </div>
              ) : filteredAssociations.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-8 text-center space-y-3">
                  <Search className="mx-auto size-8 text-slate-400" />
                  <h4 className="text-base font-bold text-slate-900">No record pairs match your filter</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    No record pairs matched &quot;{associationSearch}&quot; with filter &quot;{associationFilter}&quot;.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAssociationFilter("ALL");
                      setAssociationSearch("");
                      setAssociationPage(1);
                    }}
                    className="text-xs sm:text-sm font-semibold"
                  >
                    Reset all filters
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-semibold text-slate-500">
                    <span>
                      Showing {number((currentAssociationPage - 1) * associationPageSize + 1)}–
                      {number(Math.min(currentAssociationPage * associationPageSize, filteredAssociations.length))} of{" "}
                      {number(filteredAssociations.length)} matching pair{filteredAssociations.length === 1 ? "" : "s"}
                      {data.associations.truncated ? " (truncated to 100)" : ""}
                    </span>
                    <span>Page {currentAssociationPage} of {associationPageCount}</span>
                  </div>

                  <div className="space-y-3">
                    {pageAssociations.map((event) => (
                      <AssociationEventCard
                        key={`${event.mortality_record}-${event.disease_record}-${event.relationship}`}
                        event={event}
                      />
                    ))}
                  </div>

                  {associationPageCount > 1 && (
                    <nav
                      aria-label="Disease and mortality association pages"
                      className="flex items-center justify-between border-t border-slate-200 pt-3.5 sm:pt-4"
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentAssociationPage === 1}
                        onClick={() => setAssociationPage(currentAssociationPage - 1)}
                        className="h-8.5 sm:h-8 px-3 text-xs sm:text-sm font-semibold"
                      >
                        Previous
                      </Button>
                      <span aria-live="polite" className="text-xs sm:text-sm font-medium text-slate-600">
                        Page {currentAssociationPage} of {associationPageCount}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentAssociationPage === associationPageCount}
                        onClick={() => setAssociationPage(currentAssociationPage + 1)}
                        className="h-8.5 sm:h-8 px-3 text-xs sm:text-sm font-semibold"
                      >
                        Next
                      </Button>
                    </nav>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Other Charts Beside It */}
        <div className="min-w-0 xl:col-span-5 space-y-4">
          {/* Records by barangay · last 30 days */}
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <CardTitle className="text-base font-bold text-slate-900">Records by barangay · last 30 days</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              <p className="mb-3 text-xs sm:text-sm leading-relaxed text-slate-500">
                Share of approved disease reports by barangay, with affected heads and mortality counts.
              </p>
              {barangayPieData.length && barangayDiseaseTotal > 0 ? (
                <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center gap-3">
                  <div
                    className="relative h-44 w-44 shrink-0 min-w-0 mx-auto"
                    role="img"
                    aria-label={`Pie chart showing ${number(barangayDiseaseTotal)} disease reports by barangay`}
                  >
                    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                      <span className="text-xl font-black tabular-nums text-slate-900">{number(barangayDiseaseTotal)}</span>
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">reports</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart accessibilityLayer>
                        <Pie
                          data={barangayPieData}
                          dataKey="disease_reports"
                          nameKey="barangay"
                          innerRadius={46}
                          outerRadius={68}
                          paddingAngle={2}
                          stroke="white"
                          strokeWidth={2}
                        >
                          {barangayPieData.map((row, index) => (
                            <Cell key={row.barangay_id} fill={BARANGAY_CHART_COLORS[index % BARANGAY_CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${number(Number(value))} reports`, "Disease reports"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="w-full space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {barangayPieData.map((row, index) => (
                      <li key={row.barangay_id} className="flex items-start gap-2 text-xs sm:text-sm">
                        <span
                          aria-hidden="true"
                          className="mt-1 size-2 shrink-0 rounded-sm"
                          style={{ backgroundColor: BARANGAY_CHART_COLORS[index % BARANGAY_CHART_COLORS.length] }}
                        />
                        <div className="min-w-0 flex-1">
                          <strong className="text-slate-900 truncate block text-xs sm:text-sm">{row.barangay}</strong>
                          <span className="block text-xs sm:text-sm text-slate-500">
                            {number(row.disease_reports)} rep · {number(row.affected_heads)} heads · {number(row.deaths)} deaths
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="py-5 text-center text-xs sm:text-sm text-slate-500">No approved disease reports to chart in this period.</p>
              )}
            </CardContent>
          </Card>

          {/* Linked herd activity · last 30 days */}
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <CardTitle className="text-base font-bold text-slate-900">Linked herd activity · last 30 days</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-0">
              {data.herds_last_30_days.length ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {data.herds_last_30_days.map((herd) => (
                    <div
                      key={herd.batch_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs sm:text-sm last:border-b"
                    >
                      <span className="font-bold text-slate-800">{herd.batch_code}</span>
                      <span className="font-medium text-slate-600">
                        {number(herd.disease_reports)} report{herd.disease_reports === 1 ? "" : "s"} · {number(herd.deaths)} death{herd.deaths === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-5 text-center text-xs sm:text-sm text-slate-500">No approved event records linked to a herd in this period.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Official MAO Operational Guidelines */}
      <Card className="rounded-2xl border-cyan-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="bg-cyan-50/70 border-b border-cyan-100 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Info className="size-5 text-cyan-800" />
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
              Official MAO Guide: How to Read &amp; Act on Surveillance Data
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3 sm:p-4 bg-slate-50/50 space-y-1.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                Only Approved Records Count
              </span>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                All numbers on this dashboard come strictly from reports approved by authorized agricultural technologists. Draft or pending submissions do not alter alert levels.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 sm:p-4 bg-slate-50/50 space-y-1.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                Zero Means No Submitted Records
              </span>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                A count of zero means no approved records were entered for that period. It does not prove that zero disease occurred. Routine field inspections should continue as scheduled.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 sm:p-4 bg-slate-50/50 space-y-1.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                <MapPin className="size-4 text-cyan-600 shrink-0" />
                Barangay Risk Mapping
              </span>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Records are mapped to the farmer&apos;s registered barangay to guide localized municipal response, vaccination belts, and transport clearance advisories.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 sm:p-4 bg-slate-50/50 space-y-1.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                <Activity className="size-4 text-indigo-600 shrink-0" />
                Mortality Rate Context
              </span>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Estimated rate is calculated against current approved active inventory. Use this percentage to monitor municipal herd viability and identify severe mortality spikes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Audit: Forecast Validation & Disclaimers */}
      <details className="group rounded-xl border border-slate-200 bg-slate-50/60 transition-colors">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs sm:text-sm font-bold text-slate-700 outline-none hover:bg-slate-100/80 rounded-xl select-none">
          <span className="flex items-center gap-2">
            <span>Machine learning forecast &amp; alert validation notes</span>
            <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-600 group-open:hidden">
              Technical Audit
            </span>
          </span>
          <span className="text-xs sm:text-sm font-semibold text-slate-500 group-open:hidden">+ Show technical notes</span>
          <span className="hidden text-xs sm:text-sm font-semibold text-slate-500 group-open:inline">− Hide technical notes</span>
        </summary>
        <div className="border-t border-slate-200 p-4 bg-white rounded-b-xl space-y-2 text-xs sm:text-sm leading-relaxed text-slate-700">
          <p>
            <strong>Note for MAO Officers:</strong> Surveillance indicators display real, observed municipal records. Monthly production forecasts use the established municipal time-series models independently.
          </p>
          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs sm:text-sm text-slate-600">
            <p><strong>Alert backtest:</strong> {data.historical_backtest.status.replaceAll("_", " ")} · {number(data.historical_backtest.usable_evaluation_periods)} usable periods. {data.historical_backtest.reason}</p>
            <p><strong>Monthly baseline:</strong> {data.monthly_forecast_comparison.baseline}</p>
            <p><strong>Enhanced candidate:</strong> experimental only; it never changes production forecasts or model selection.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setRunForecastExperiment(true)} disabled={experimentQuery.isFetching} className="text-xs sm:text-sm font-semibold">
              {experimentQuery.isFetching ? "Evaluating historical cutoffs..." : experimentQuery.data ? "Refresh experimental comparison" : "Run experimental comparison"}
            </Button>
            {experimentQuery.isError && <p role="alert" className="text-rose-700 text-xs sm:text-sm">The experimental comparison could not be completed. Check access or server logs and retry.</p>}
            {experimentQuery.isPending && runForecastExperiment && <p role="status" className="text-xs sm:text-sm">Building cutoff-specific one-month forecasts from approved real records. This can take a short while.</p>}
            {experimentQuery.data && <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:text-sm">
              <p><strong>Result:</strong> {experimentQuery.data.status.replaceAll("_", " ")}. {experimentQuery.data.reason}</p>
              <p>{experimentQuery.data.evaluation_method} The enhanced candidate is never adopted automatically.</p>
              <div className="grid gap-3 lg:grid-cols-3">
                {Object.values(experimentQuery.data.targets).map((target) => <div key={target.target} className="rounded-md border bg-white p-3 text-xs sm:text-sm">
                  <p className="font-semibold">{target.target.replaceAll("_", " ")} ({target.unit}; {target.horizon_months}-month horizon)</p>
                  <p>Training readiness: {target.training_status.replaceAll("_", " ")} ({target.training_sample_count}/{target.minimum_training_samples} monthly samples); feature-bearing months: {target.feature_training_sample_count}.</p>
                  <p>Candidate: {target.candidate_status.replaceAll("_", " ")} · {target.enhanced_candidate}</p>
                  <p className="text-slate-600">{target.candidate_reason}</p>
                  <p>Next-month experimental candidate forecast: {target.candidate_forecast == null ? "Unavailable" : `${metric(target.candidate_forecast)} ${target.unit}`} {target.candidate_forecast_month ? `for ${target.candidate_forecast_month}` : ""}. This is not the production forecast.</p>
                  {target.candidate_quality_note && <p>{target.candidate_quality_note}</p>}
                  <p>Evaluation: {target.status.replaceAll("_", " ")} · {target.valid_evaluation_periods} shared valid periods from {target.eligible_target_periods} eligible target periods; {target.evaluation_start_month ?? "—"} to {target.evaluation_end_month ?? "—"}.</p>
                  <p>Existing selected model: MAE {metric(target.baseline.mae)}, RMSE {metric(target.baseline.rmse)}, coverage {Math.round(target.baseline.prediction_coverage * 100)}%.</p>
                  <p>Simple baseline: MAE {metric(target.simple_baseline.mae)}, RMSE {metric(target.simple_baseline.rmse)}.</p>
                  <p>Calendar-only linear control: MAE {metric(target.calendar_linear_baseline.mae)}, RMSE {metric(target.calendar_linear_baseline.rmse)}.</p>
                  <p>Enhanced candidate: MAE {metric(target.enhanced.mae)}, RMSE {metric(target.enhanced.rmse)}, coverage {Math.round(target.enhanced.prediction_coverage * 100)}%.</p>
                  <p>Comparison conclusion: {target.comparison_conclusion.replaceAll("_", " ")}.</p>
                  <p className="mt-1 text-slate-500">Latest eligible target month: {target.latest_eligible_target_period ?? "none"}; target months without reports not scored: {target.target_months_without_records_not_scored}; incomplete current-month rows excluded: {target.current_partial_month_rows_excluded}; records without review timestamps excluded from training: {target.target_rows_without_review_time_excluded_from_training}.</p>
                  <p className="text-slate-500">Excluded periods: {Object.entries(target.excluded_period_counts).map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`).join("; ")}.</p>
                  {target.periods.length > 0 && <details className="mt-2"><summary className="cursor-pointer font-medium text-xs sm:text-sm">Show per-month predictions and errors</summary>
                    <div className="mt-2 max-h-56 space-y-1 overflow-auto">{target.periods.map((period) => <p key={period.target_month} className="border-t pt-1 text-xs sm:text-sm">{period.target_month}: actual {metric(period.actual)}; existing {metric(period.baseline_prediction)} ({period.baseline_model}); simple {metric(period.simple_baseline_prediction)}; calendar-only {metric(period.calendar_linear_prediction)}; enhanced {metric(period.enhanced_prediction)} ({period.enhanced_candidate_status}); absolute errors {metric(period.baseline_absolute_error)} / {metric(period.enhanced_absolute_error)}.</p>)}</div>
                  </details>}
                </div>)}
              </div>
              <p className="text-slate-500 text-xs sm:text-sm">{experimentQuery.data.availability_rule} {experimentQuery.data.missing_data_rule} {experimentQuery.data.feature_rule} A directional signal requires {experimentQuery.data.minimum_periods_for_directional_signal} valid periods and is still experimental.</p>
            </div>}
          </div>
        </div>
      </details>
        </div>
      </details>
    </section>
  );
}
