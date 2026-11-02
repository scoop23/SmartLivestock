"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import api from "@/lib/axios";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  FileSpreadsheet,
  HeartPulse,
  Inbox,
  Info,
  LineChart as LineChartIcon,
  Link2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Table as TableIcon,
  Target,
  TrendingUp,
  User,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import dynamic from "next/dynamic";

const PadreGarciaForecaster = dynamic(
  () => import("@/app/components/analytics/haversine"),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-slate-500">
        <Activity className="size-8 text-rose-600 animate-spin mb-2" />
        <p className="font-bold text-sm">Loading the disease report map...</p>
        <p className="text-xs text-slate-400 mt-1">Finding report locations and nearby barangays...</p>
      </div>
    ),
  }
);

function CattleSilhouetteSvg({ className = "w-24 h-16 text-emerald-800" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 65" fill="currentColor" className={className} aria-hidden="true">
      {/* Anatomically accurate bovine profile silhouette */}
      <path d="M95,24 C94,21 91,19 88,18 C87,16 85,14 83,14 C82,14 81,15 80,17 C77,17 75,19 73,21 C69,22 65,23 61,23 C57,23 53,22 49,23 C44,24 39,24 34,24 C29,24 25,26 22,29 C20,31 18,34 17,37 C16,39 15,42 15,44 C14,45 13,46 12,48 C11,50 12,52 13,53 C14,54 15,53 16,51 C17,48 18,46 19,45 L21,60 L24,60 L25,48 L30,48 L31,60 L34,60 L35,46 C39,47 44,47 49,47 C54,47 59,46 63,44 L65,60 L68,60 L69,47 L74,47 L75,60 L78,60 L79,41 C83,39 87,36 90,32 C93,29 95,27 95,24 Z" />
    </svg>
  );
}

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

type DailyTelemetryRow = {
  date: string;
  label: string;
  diseaseReports: number;
  affectedHeads: number;
  mortalityReports: number;
  deaths: number;
};

type WeeklyTelemetryRow = {
  start: string;
  end: string;
  label: string;
  diseaseReports: number;
  affectedHeads: number;
  mortalityReports: number;
  deaths: number;
};

const number = (value: number) => value.toLocaleString("en-PH");
const metric = (value: number | null) =>
  value == null ? "Unavailable" : value.toLocaleString("en-PH", { maximumFractionDigits: 3 });
const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

const alertMeta: Record<string, { badge: string; meaning: string; nextStep: string }> = {
  NORMAL: {
    badge: "Stable or Lower",
    meaning: "Recorded disease reports or deaths are stable or lower than the previous complete week.",
    nextStep: "Continue routine animal health checks and keep barangay records up to date.",
  },
  WATCH: {
    badge: "More Reports",
    meaning: "Disease reports or recorded deaths increased this week; verify the records.",
    nextStep: "Ask assigned field staff to check how animals are recovering and whether guidance is being followed.",
  },
  ELEVATED: {
    badge: "Large Increase",
    meaning: "There were at least twice as many records, and at least two more, than in the previous full week. This is a signal to check the reports, not proof of an outbreak.",
    nextStep: "Ask livestock inspectors to check these reports and visit the farms.",
  },
  INSUFFICIENT_DATA: {
    badge: "Not Enough Records",
    meaning: "No approved disease reports or recorded deaths were counted in either week. Check whether reports are still being reviewed.",
    nextStep: "Ask local staff whether reports are waiting for review.",
  },
};

// Crisp Mission Control Tooltip matching futuristic design
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MissionControlTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-rose-300 bg-white/95 p-3 text-xs text-slate-900 shadow-xl backdrop-blur-md">
      <div className="border-b border-slate-100 pb-1.5 mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-rose-800 font-bold">{label}</span>
        {unit && <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{unit}</span>}
      </div>
      <div className="space-y-1.5">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((item: any) => {
          if (item.value == null) return null;
          return (
            <div key={item.dataKey || item.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: item.color || "#e11d48" }} />
                <span className="text-slate-600 font-medium">{item.name}</span>
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

function AlertPanel({
  title,
  subtitle,
  alert,
  period,
  variant = "rose",
  metricsSummary,
}: {
  title: string;
  subtitle?: string;
  alert: SurveillanceResponse["disease"]["alert"];
  period: { start: string; end: string };
  variant?: "rose" | "emerald";
  metricsSummary?: { current: number; previous: number; unit: string };
}) {
  const meta = alertMeta[alert.level] || alertMeta.NORMAL;
  const isElevated = alert.level === "ELEVATED";
  const isRose = variant === "rose";

  // Derive theme tokens to eliminate color clashes (clean uniform card borders, no border-top or border-left bars)
  const theme = isRose
    ? isElevated
      ? {
          cardBg: "bg-gradient-to-br from-rose-50 via-white to-rose-50 border-rose-200/90",
          iconBg: "bg-rose-100 text-rose-700 border-rose-200/80",
          iconPulse: true,
          badgeBg: "bg-rose-600 text-white shadow-xs",
          badgeDot: "bg-white",
          calloutBg: "border-rose-200/90 bg-rose-50 text-rose-950",
          calloutHeader: "text-rose-950",
          calloutTag: "bg-rose-200 text-rose-800",
          tagText: "CHECK SOON",
          ruleTag: "Large weekly increase",
        }
      : {
          cardBg: "bg-gradient-to-br from-amber-50 via-white to-amber-50 border-amber-200/90",
          iconBg: "bg-amber-100 text-amber-700 border-amber-200/80",
          iconPulse: false,
          badgeBg: "bg-amber-500 text-white shadow-xs",
          badgeDot: "bg-white",
          calloutBg: "border-amber-200/90 bg-amber-50 text-amber-950",
          calloutHeader: "text-amber-950",
          calloutTag: "bg-amber-200 text-amber-800",
          tagText: "CHECK RECORDS",
          ruleTag: "More records this week",
        }
    : alert.level === "INSUFFICIENT_DATA"
    ? {
        cardBg: "bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-emerald-200/80",
        iconBg: "bg-emerald-100/80 text-emerald-700 border-emerald-200/80",
        iconPulse: false,
        badgeBg: "bg-emerald-100 text-emerald-800 border border-emerald-300/80",
        badgeDot: "bg-emerald-600",
        calloutBg: "border-emerald-200/90 bg-emerald-50 text-emerald-950",
        calloutHeader: "text-emerald-950",
        calloutTag: "bg-emerald-200 text-emerald-800",
        tagText: "ROUTINE REVIEW",
        ruleTag: "No records to compare",
      }
    : {
        cardBg: "bg-gradient-to-br from-teal-50 via-white to-slate-50 border-teal-200/80",
        iconBg: "bg-teal-100 text-teal-700 border-teal-200/80",
        iconPulse: false,
        badgeBg: "bg-teal-600 text-white shadow-xs",
        badgeDot: "bg-white",
        calloutBg: "border-teal-200/90 bg-teal-50 text-teal-950",
        calloutHeader: "text-teal-950",
        calloutTag: "bg-teal-200 text-teal-800",
        tagText: "STABLE",
        ruleTag: "No increase this week",
      };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-4.5 shadow-2xs transition-all duration-200 ${theme.cardBg}`}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`relative size-10 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${theme.iconBg}`}
          >
            {isRose ? (
              <AlertTriangle className={`size-5 ${theme.iconPulse ? "animate-pulse" : ""}`} />
            ) : alert.level === "INSUFFICIENT_DATA" ? (
              <ShieldCheck className="size-5" />
            ) : (
              <Activity className="size-5" />
            )}
            {theme.iconPulse && (
              <span className="absolute -top-1 -right-1 flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-rose-600" />
              </span>
            )}
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
              {subtitle || (isRose ? "Disease Reports" : "Recorded Deaths")}
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight mt-0.5">
              {title}
            </h3>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-tight shrink-0 ${theme.badgeBg}`}
        >
          <span className={`size-1.5 rounded-full ${theme.badgeDot} ${theme.iconPulse ? "animate-pulse" : ""}`} />
          <span>{meta.badge}</span>
        </span>
      </div>

      {/* Telemetry Explanation & Stat Strip */}
      <div className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-700 font-medium">
        {alert.explanation}
      </div>

      {/* Metrics Mini-strip */}
      {metricsSummary && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200/90 px-2.5 py-1 rounded-lg shadow-2xs text-slate-600">
            <span className="text-slate-400">Current Week:</span>
            <strong className="text-slate-900 font-black">{metricsSummary.current} {metricsSummary.unit}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200/90 px-2.5 py-1 rounded-lg shadow-2xs text-slate-600">
            <span className="text-slate-400">Prior Week:</span>
            <strong className="text-slate-900 font-black">{metricsSummary.previous} {metricsSummary.unit}</strong>
          </span>
          {metricsSummary.current > metricsSummary.previous && (
            <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 border border-rose-200/70 px-2 py-0.5 rounded-md">
              <TrendingUp className="size-3" />
              <span>+{metricsSummary.current - metricsSummary.previous} net change</span>
            </span>
          )}
        </div>
      )}

      {/* Harmonized Recommended Action Protocol (Clean uniform card, no border-left) */}
      <div className={`mt-3 rounded-xl border p-3 sm:p-3.5 space-y-1.5 ${theme.calloutBg}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
            {isRose ? (
              <AlertCircle className="size-3.5 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="size-3.5 text-emerald-700 shrink-0" />
            )}
            <span className={theme.calloutHeader}>Recommended Action</span>
          </div>
          <span className={`text-[9.5px] font-mono font-black px-1.5 py-0.5 rounded ${theme.calloutTag}`}>
            {theme.tagText}
          </span>
        </div>
        <p className="text-xs sm:text-[12.5px] leading-relaxed font-semibold">
          {meta.nextStep}
        </p>
      </div>

      {/* Footer Metadata */}
      <div className="mt-3 border-t border-slate-200/70 pt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5 text-slate-400 shrink-0" />
          <span>
            {formatDate(period.start)} – {formatDate(period.end)}
          </span>
        </div>
        <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
          {theme.ruleTag}
        </span>
      </div>
    </div>
  );
}

function RecordedLabel({ value }: { value: string }) {
  const isDemo = /^DEMO ONLY:\s*/i.test(value);
  const label = value.replace(/^DEMO ONLY:\s*/i, "");
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {label}
      {isDemo && (
        <Badge variant="outline" className="border-violet-200 bg-violet-50 px-1.5 py-0 text-xs text-violet-800">
          Sample
        </Badge>
      )}
    </span>
  );
}

function getRelationshipMeta(relationship: string) {
  if (relationship === "explicit_source_disease_case" || relationship === "same_livestock") {
    return {
      label: "Same Animal",
      tag: "Same Animal",
      description: "The same identified animal was reported sick and later recorded dead within 30 days. Timing alone does not prove the disease caused the death.",
      actionText: "Check the animal's treatment and health records.",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dotClass: "bg-emerald-500",
      cardBorder: "border-emerald-200/80 hover:border-emerald-300",
    };
  }
  if (relationship === "same_herd") {
    return {
      label: "Disease Report and Death in Same Herd",
      tag: "Same Herd",
      description: "A death was recorded in the same herd within 30 days of a disease report. The timing alone does not prove the two are connected.",
      actionText: "Review both records and ask field staff whether other animals need attention.",
      badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
      dotClass: "bg-indigo-500",
      cardBorder: "border-indigo-200/80 hover:border-indigo-300",
    };
  }
  return {
    label: "Disease Report and Death in Same Barangay",
    tag: "Same Barangay",
    description: "An animal died in this barangay within 30 days of a disease report on a nearby farm. This timing alone does not prove a connection.",
    actionText: "Review both records and ask field staff to check the nearby farms.",
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
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          <Badge variant="outline" className={`gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-bold rounded-full shrink-0 ${meta.badgeClass}`}>
            <span className={`size-1.5 sm:size-2 rounded-full ${meta.dotClass}`} />
            {meta.label}
          </Badge>
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200/80 rounded-md px-2 py-0.5 sm:px-2.5 sm:py-1 shrink-0">
            <Clock className="size-3.5 text-slate-500 shrink-0" />
            <span>
              {number(event.days_between)} {event.days_between === 1 ? "day" : "days"} elapsed
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs min-w-0">
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

      {/* Chronological Flow Grid */}
      <div className="mt-3.5 grid grid-cols-1 2xl:grid-cols-[1fr_auto_1fr] items-stretch gap-2.5 sm:gap-3 min-w-0">
        {/* Step 1: Preceding Disease Observation */}
        <div className="flex flex-col justify-between rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 via-amber-50/20 to-white p-3 sm:p-3.5 shadow-2xs min-w-0">
          <div className="space-y-1 sm:space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900 shrink-0">
                <Stethoscope className="size-3.5 sm:size-4 text-amber-700 shrink-0" />
                1. Disease Report
              </span>
              <span className="font-mono text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-2xs shrink-0">
                {event.disease_record}
              </span>
            </div>
            <div className="pt-0.5 sm:pt-1 min-w-0">
              <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug break-words">
                <RecordedLabel value={event.recorded_classification} />
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Calendar className="size-3.5 text-slate-400 shrink-0" />
                <span>Recorded: {formatDate(event.disease_date)}</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 border-t border-amber-200/60 pt-2 text-xs text-slate-600 space-y-1 min-w-0">
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
            <span className="text-xs font-black text-slate-500 uppercase tracking-tight whitespace-nowrap bg-slate-100 rounded-full px-2 py-0.5">
              +{event.days_between}d
            </span>
            <div className="h-5 w-px bg-slate-200" />
          </div>
        </div>

        {/* Transition Connector (Vertical Flow for standard/compact viewports) */}
        <div className="flex 2xl:hidden items-center justify-center -my-0.5 py-0.5 z-10">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 bg-rose-50/95 border border-rose-200 shadow-2xs rounded-full px-3 py-1">
            <Clock className="size-3.5 text-rose-500 shrink-0" />
            <span>+{event.days_between} {event.days_between === 1 ? "day" : "days"} later</span>
            <ArrowDown className="size-3.5 text-rose-600 shrink-0" />
          </div>
        </div>

        {/* Step 2: Mortality Record */}
        <div className="flex flex-col justify-between rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50/60 via-rose-50/20 to-white p-3 sm:p-3.5 shadow-2xs min-w-0">
          <div className="space-y-1 sm:space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-900 shrink-0">
                <AlertTriangle className="size-3.5 sm:size-4 text-rose-700 shrink-0" />
                2. Mortality Event
              </span>
              <span className="font-mono text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-2xs shrink-0">
                {event.mortality_record}
              </span>
            </div>
            <div className="pt-0.5 sm:pt-1 min-w-0">
              <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug break-words">
                <RecordedLabel value={event.recorded_cause} />
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Calendar className="size-3.5 text-slate-400 shrink-0" />
                <span>Recorded: {formatDate(event.mortality_date)}</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 border-t border-rose-200/60 pt-2 text-xs text-slate-600 space-y-1 min-w-0">
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
      <div className="mt-3 rounded-xl bg-slate-50/90 border border-slate-200/70 p-2.5 sm:p-3 text-xs leading-relaxed text-slate-700 space-y-2 min-w-0">
        <div className="flex items-start gap-2 min-w-0">
          <Info className="size-4 text-rose-700 shrink-0 mt-0.5" />
          <div className="min-w-0 break-words">
            <span className="font-bold text-slate-900">{meta.tag}: </span>
            {meta.description}
          </div>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-1.5 text-xs font-semibold text-rose-950 bg-rose-50/90 border border-rose-200/60 rounded-lg px-2.5 py-1.5 min-w-0">
          <span className="font-bold uppercase tracking-wider text-[10px] font-mono text-rose-700 shrink-0">Field Action:</span>
          <span className="min-w-0 break-words">{meta.actionText}</span>
        </div>
      </div>
    </article>
  );
}

const BARANGAY_CHART_COLORS = ["#e11d48", "#0d9488", "#4f46e5", "#d97706", "#2563eb", "#059669", "#7c3aed"];

const clinicalStatusLabel: Record<string, string> = {
  NOT_RECORDED: "Resolution not recorded",
  OPEN: "Awaiting follow-up",
  RECOVERED: "Recovered",
  CLOSED: "Closed",
};

export default function SurveillanceAnalytics() {
  const { user } = useAuth();
  const [selectedFocus, setSelectedFocus] = useState<"all" | "disease" | "mortality" | "associations">("all");
  const [centerpieceTab, setCenterpieceTab] = useState<"timeline" | "telemetry" | "diagnostics" | "sandbox">("timeline");
  const [showTableView, setShowTableView] = useState(false);

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

  const data = query.data;
  const isFetching = query.isFetching;

  // Unified Daily Telemetry Series for ComposedChart & Precision Audit Table
  const combinedDailyData: DailyTelemetryRow[] = useMemo(() => {
    if (!data) return [];
    const map = new globalThis.Map<string, DailyTelemetryRow>();

    for (const d of data.disease.daily_last_14_days) {
      map.set(d.date, {
        date: d.date,
        label: formatDate(d.date).replace(/, \d{4}$/, ""),
        diseaseReports: d.reports,
        affectedHeads: d.value,
        mortalityReports: 0,
        deaths: 0,
      });
    }

    for (const m of data.mortality.daily_last_14_days) {
      const existing = map.get(m.date);
      if (existing) {
        existing.mortalityReports = m.reports;
        existing.deaths = m.value;
      } else {
        map.set(m.date, {
          date: m.date,
          label: formatDate(m.date).replace(/, \d{4}$/, ""),
          diseaseReports: 0,
          affectedHeads: 0,
          mortalityReports: m.reports,
          deaths: m.value,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Unified Weekly 12-Week Telemetry Series
  const combinedWeeklyData: WeeklyTelemetryRow[] = useMemo(() => {
    if (!data) return [];
    const map = new globalThis.Map<string, WeeklyTelemetryRow>();

    for (const w of data.disease.weekly_reported_affected_heads) {
      map.set(w.start, {
        start: w.start,
        end: w.end,
        label: formatDate(w.start).replace(/, \d{4}$/, ""),
        diseaseReports: w.reports,
        affectedHeads: w.value,
        mortalityReports: 0,
        deaths: 0,
      });
    }

    for (const w of data.mortality.weekly_reported_deaths) {
      const existing = map.get(w.start);
      if (existing) {
        existing.mortalityReports = w.reports;
        existing.deaths = w.value;
      } else {
        map.set(w.start, {
          start: w.start,
          end: w.end,
          label: formatDate(w.start).replace(/, \d{4}$/, ""),
          diseaseReports: 0,
          affectedHeads: 0,
          mortalityReports: w.reports,
          deaths: w.value,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.start.localeCompare(b.start));
  }, [data]);

  if (query.isPending) {
    return (
      <div role="status" aria-label="Loading disease and mortality surveillance" className="space-y-6">
        <Skeleton className="h-32 rounded-2xl w-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-80 rounded-2xl w-full" />
      </div>
    );
  }

  if (query.isError || !data) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50/80 p-8 text-center space-y-3">
        <AlertTriangle className="mx-auto size-10 text-rose-600" />
        <h3 className="text-lg font-bold text-rose-900">Could Not Load Disease and Death Reports</h3>
        <p className="text-xs sm:text-sm text-rose-800 max-w-md mx-auto">
          Check your internet connection or ask an administrator to check your access.
        </p>
        <Button className="mt-2 cursor-pointer font-bold" variant="outline" onClick={() => void query.refetch()}>
          <RefreshCw className="mr-2 size-4" />
          Try Again
        </Button>
      </div>
    );
  }

  const week = data.periods.latest_complete_week;
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
    <div className="space-y-3 sm:space-y-3.5">
      {/* ----------------------------------------------------------------- */}
      {/* A. COMMAND BANNER (Lush Mint & Emerald Surveillance Header)        */}
      {/* ----------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-100 via-teal-50 to-emerald-50 p-3.5 sm:p-4 shadow-2xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="size-10 sm:size-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
              <Plus className="size-5.5 stroke-[3]" />
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Padre Garcia Animal Health
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                Disease Reports &amp; Deaths
              </h1>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                Approved disease reports, death trends, weekly changes, and related animal records across Padre Garcia.
              </p>
            </div>
          </div>

          {/* Header Action Buttons & Date Badge */}
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-start md:items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200/80 rounded-full px-3 py-1 shadow-2xs">
              <Calendar className="size-3 text-slate-400" />
              <span>
                {formatDate(week.start)} – {formatDate(week.end)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs rounded-full px-3.5 cursor-pointer"
              >
                <Link href={user?.role?.toUpperCase() === "SIBAT" || user?.role?.toUpperCase() === "CBAT" ? "/sibat-monitoring" : "/gis-map"}>
                  <MapPin className="size-3.5 mr-1.5 text-emerald-600" />
                  Role-Scoped GIS Map
                </Link>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void query.refetch()}
                disabled={isFetching}
                className="h-8 border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs rounded-full px-3 cursor-pointer"
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${isFetching ? "animate-spin text-emerald-600" : "text-slate-500"}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* B. 4 COLORFUL PASTEL KPI CARDS                                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Disease Report Activity (Rose) */}
        <button
          type="button"
          onClick={() => {
            setSelectedFocus("disease");
            setCenterpieceTab("sandbox");
          }}
          className={`group relative flex flex-col justify-between rounded-2xl p-3.5 sm:p-4 text-left transition-all duration-200 border border-rose-200/80 bg-gradient-to-br from-rose-50 via-rose-50 to-white shadow-2xs hover:shadow-xs cursor-pointer overflow-hidden ${
            selectedFocus === "disease" && centerpieceTab === "sandbox" ? "ring-2 ring-rose-400" : ""
          }`}
        >
          <AlertTriangle className="absolute -right-3 -bottom-3 size-24 text-rose-500/[0.07] pointer-events-none" />
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="size-8.5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm shrink-0">
                  <HeartPulse className="size-4.5" />
                </div>
                <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                  {number(data.disease.latest_complete_week.reports ?? 0)}
                </span>
              </div>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                {formatDate(week.end)}
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-rose-900 transition-colors">
                Disease Report Activity
              </h3>
              <p className="text-[11px] text-rose-700 font-semibold mt-0.5">
                Latest complete week
              </p>
            </div>
          </div>
          <div className="mt-2.5 pt-1.5 border-t border-rose-100 flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 group-hover:text-rose-800 transition-colors flex items-center gap-1">
              View Details →
            </span>
          </div>
        </button>

        {/* Card 2: Active Disease Cases (Sky) */}
        <button
          type="button"
          onClick={() => {
            setSelectedFocus("disease");
            setCenterpieceTab("telemetry");
          }}
          className={`group relative flex flex-col justify-between rounded-2xl p-3.5 sm:p-4 text-left transition-all duration-200 border border-sky-200/80 bg-gradient-to-br from-sky-50 via-sky-50 to-white shadow-2xs hover:shadow-xs cursor-pointer overflow-hidden ${
            selectedFocus === "disease" && centerpieceTab === "telemetry" ? "ring-2 ring-sky-400" : ""
          }`}
        >
          <div className="absolute -right-2 -bottom-2 pointer-events-none opacity-10">
            <CattleSilhouetteSvg className="w-24 h-16 text-sky-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="size-8.5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-sm shrink-0">
                <Stethoscope className="size-4.5" />
              </div>
              <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                {number(data.disease.last_30_days.reports)}
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-sky-900 transition-colors">
                Active Disease Cases
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Across all barangays
              </p>
            </div>
          </div>
          <div className="mt-2.5 pt-1.5 border-t border-sky-100 flex items-center justify-between">
            <span className="text-xs font-bold text-sky-600 group-hover:text-sky-800 transition-colors flex items-center gap-1">
              View Cases →
            </span>
          </div>
        </button>

        {/* Card 3: Fatality Reports (Amber) */}
        <button
          type="button"
          onClick={() => {
            setSelectedFocus("mortality");
            setCenterpieceTab("diagnostics");
          }}
          className={`group relative flex flex-col justify-between rounded-2xl p-3.5 sm:p-4 text-left transition-all duration-200 border border-amber-200/80 bg-gradient-to-br from-amber-50 via-amber-50 to-white shadow-2xs hover:shadow-xs cursor-pointer overflow-hidden ${
            selectedFocus === "mortality" ? "ring-2 ring-amber-400" : ""
          }`}
        >
          <Plus className="absolute -right-3 -bottom-3 size-24 text-amber-500/[0.08] pointer-events-none" />
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="size-8.5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm shrink-0">
                  <AlertTriangle className="size-4.5" />
                </div>
                <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                  {number(data.mortality.latest_complete_week.reports ?? 0)}
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-mono">
                {data.mortality.rate_percent === null ? "0% rate" : `${data.mortality.rate_percent}% rate`}
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-amber-900 transition-colors">
                Fatality Reports
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {data.mortality.last_30_days.deaths ?? 0} deaths (30d) · Stable
              </p>
            </div>
          </div>
          <div className="mt-2.5 pt-1.5 border-t border-amber-100 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 group-hover:text-amber-800 transition-colors flex items-center gap-1">
              View Records →
            </span>
          </div>
        </button>

        {/* Card 4: Linked Pairs (Purple) */}
        <button
          type="button"
          onClick={() => {
            setSelectedFocus("associations");
            setCenterpieceTab("timeline");
          }}
          className={`group relative flex flex-col justify-between rounded-2xl p-3.5 sm:p-4 text-left transition-all duration-200 border border-purple-200/80 bg-gradient-to-br from-purple-50 via-purple-50 to-white shadow-2xs hover:shadow-xs cursor-pointer overflow-hidden ${
            selectedFocus === "associations" ? "ring-2 ring-purple-400" : ""
          }`}
        >
          <Link2 className="absolute -right-3 -bottom-3 size-24 text-purple-500/[0.07] pointer-events-none" />
          <div>
            <div className="flex items-center gap-2">
              <div className="size-8.5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm shrink-0">
                <Link2 className="size-4.5" />
              </div>
              <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                {number(data.associations.events.length)}
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-purple-900 transition-colors">
                Linked Pairs
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                With associated records
              </p>
            </div>
          </div>
          <div className="mt-2.5 pt-1.5 border-t border-purple-100 flex items-center justify-between">
            <span className="text-xs font-bold text-purple-600 group-hover:text-purple-800 transition-colors flex items-center gap-1">
              View Details →
            </span>
          </div>
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* C. DUAL EARLY-WARNING ALERT PANELS                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-3 sm:gap-3.5 lg:grid-cols-2">
        <AlertPanel
          title="Disease Report Change This Week"
          subtitle="Weekly report changes"
          alert={data.disease.alert}
          period={week}
          variant="rose"
          metricsSummary={{
            current: data.disease.latest_complete_week.reports,
            previous: data.disease.preceding_complete_week.reports,
            unit: "reports",
          }}
        />
        <AlertPanel
          title="Death Reports This Week"
          subtitle="Weekly death report changes"
          alert={data.mortality.alert}
          period={week}
          variant="emerald"
          metricsSummary={{
            current: data.mortality.latest_complete_week.reports,
            previous: data.mortality.preceding_complete_week.reports,
            unit: "reports",
          }}
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* E. MISSION CONTROL CENTERPIECE CARD                               */}
      {/* ----------------------------------------------------------------- */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden gap-0">
        <CardHeader className="border-b border-slate-100 px-4 py-2.5 sm:px-4.5 sm:py-3 [.border-b]:pb-2.5 sm:[.border-b]:pb-3">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
                <Target className="size-4.5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                  Report Summary
                </h2>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-none">
                  Weekly report updates
                </p>
              </div>
            </div>

            {/* View Switcher Cluster */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setCenterpieceTab("timeline")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    centerpieceTab === "timeline"
                      ? "bg-slate-900 text-white shadow-xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <AlertTriangle className="size-3.5 text-amber-400" />
                  Report Follow-up
                </button>
                <button
                  type="button"
                  onClick={() => setCenterpieceTab("telemetry")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    centerpieceTab === "telemetry"
                      ? "bg-slate-900 text-white shadow-xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LineChartIcon className="size-3.5" />
                  Report Trends
                </button>
                <button
                  type="button"
                  onClick={() => setCenterpieceTab("diagnostics")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    centerpieceTab === "diagnostics"
                      ? "bg-slate-900 text-white shadow-xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FileSpreadsheet className="size-3.5" />
                  Report Types and Causes
                </button>
                <button
                  type="button"
                  onClick={() => setCenterpieceTab("sandbox")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    centerpieceTab === "sandbox"
                      ? "bg-slate-900 text-white shadow-xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <MapPin className="size-3.5 text-rose-400" />
                  Map Example
                </button>
              </div>

              {centerpieceTab === "telemetry" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTableView(!showTableView)}
                  className="border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                >
                  {showTableView ? (
                    <>
                      <LineChartIcon className="size-3.5 mr-1 text-rose-600" />
                      Visual Charts
                    </>
                  ) : (
                    <>
                      <TableIcon className="size-3.5 mr-1 text-slate-600" />
                      Audit Table
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className={centerpieceTab === "sandbox" ? "p-3 sm:p-3.5 space-y-2.5" : "p-3 sm:p-3.5 space-y-3 sm:space-y-3.5"}>
          {/* TAB 1: INVESTIGATION FLOW & TIMELINE */}
          {centerpieceTab === "timeline" && (
            <div className="space-y-3 sm:space-y-3.5">
              {/* Stepper & MAO Field Guide Top Row */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
                {/* Left: 4-Step Investigation Stepper */}
                <div className="space-y-1.5 shrink-0">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                    Disease Reports and Related Deaths
                  </h3>
                  <div className="flex items-center gap-2 sm:gap-3.5 text-xs overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="flex size-5.5 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-[11px] shadow-xs">
                        1
                      </span>
                      <span className="font-bold text-slate-900 text-xs">Investigate</span>
                    </div>
                    <ArrowRight className="size-3 text-slate-400 shrink-0" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="flex size-5.5 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
                        2
                      </span>
                      <span className="font-medium text-slate-600 text-xs">Check Animal Records</span>
                    </div>
                    <ArrowRight className="size-3 text-slate-400 shrink-0" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="flex size-5.5 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
                        3
                      </span>
                      <span className="font-medium text-slate-600 text-xs">Check Movement</span>
                    </div>
                    <ArrowRight className="size-3 text-slate-400 shrink-0" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="flex size-5.5 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
                        4
                      </span>
                      <span className="font-medium text-slate-600 text-xs">Take Action</span>
                    </div>
                  </div>
                </div>

                {/* Right: MAO Field Guide with High-Definition Cattle Portrait (Longer Layout) */}
                <div className="flex-1 min-w-0 flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/90 shadow-2xs">
                  <div className="space-y-1.5 text-xs flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-emerald-950 flex items-center gap-1.5 text-xs sm:text-[13px] leading-tight">
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                        <span>Reviewing reports and deaths within 30 days</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById("mao-operational-guide");
                          el?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-0.5 shrink-0 ml-1.5 cursor-pointer whitespace-nowrap"
                      >
                        View Guide →
                      </button>
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-slate-700">
                      <li className="flex items-center gap-1.5">
                        <Check className="size-3 text-emerald-600 shrink-0" />
                        <span>Check animal movement and herd connections.</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="size-3 text-emerald-600 shrink-0" />
                        <span>Review recent treatments and biosecurity measures.</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="size-3 text-emerald-600 shrink-0" />
                        <span>Coordinate with local MAO for field verification.</span>
                      </li>
                    </ul>
                  </div>
                  <div className="relative size-18 sm:size-20 shrink-0 rounded-xl overflow-hidden border border-emerald-300/80 shadow-2xs">
                    <Image
                      src="/images/cattle-portrait.jpg"
                      alt="Cattle Inspection Portrait"
                      width={160}
                      height={160}
                      className="object-cover w-full h-full"
                      quality={95}
                      priority
                    />
                  </div>
                </div>
              </div>

              {/* Main Split: Left Column Timeline & Right Column Barangay/Herd */}
              <div className="grid gap-3.5 xl:grid-cols-12 items-start min-w-0">
                {/* Left 7 Columns: Association Events */}
                <div className="min-w-0 xl:col-span-7 space-y-3">
                  {/* Filter Tabs & Quick Search */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap no-scrollbar">
                      <button
                        type="button"
                        onClick={() => {
                          setAssociationFilter("ALL");
                          setAssociationPage(1);
                        }}
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
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
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
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
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          associationFilter === "same_barangay"
                            ? "bg-slate-700 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <span className="size-1.5 rounded-full bg-slate-400" />
                        Same Barangay ({number(barangayCount)})
                      </button>
                    </div>

                    <div className="relative w-full sm:w-52 shrink-0">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="Search barangay, farmer..."
                        value={associationSearch}
                        onChange={(e) => {
                          setAssociationSearch(e.target.value);
                          setAssociationPage(1);
                        }}
                        className="h-8 pl-7.5 pr-7 text-xs bg-white border-slate-200 focus-visible:ring-rose-500/20"
                      />
                      {associationSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setAssociationSearch("");
                            setAssociationPage(1);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                          title="Clear search"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Results List */}
                  {data.associations.events.length === 0 ? (
                    <div className="rounded-xl border border-sky-100 bg-gradient-to-b from-sky-50/40 via-white to-emerald-50/20 p-4 sm:p-5 text-center relative overflow-hidden flex flex-col justify-between shadow-2xs">
                      <div className="pt-2 space-y-1.5 max-w-sm mx-auto">
                        <div className="size-9 rounded-full bg-white border border-teal-200/70 shadow-2xs flex items-center justify-center text-teal-600 mx-auto">
                          <Search className="size-4 text-teal-600" />
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          No preceding disease-mortality pairs found
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          No approved disease reports preceding any mortality records within {data.associations.window_days} days.
                        </p>
                      </div>

                      <div className="pt-3 -mx-5 -mb-5 overflow-hidden">
                        <Image
                          src="/images/pasture-cows-illustration.png"
                          alt="Cattle grazing in pasture"
                          width={1376}
                          height={360}
                          className="w-full h-auto object-cover object-bottom"
                          quality={95}
                          priority
                        />
                      </div>
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
                        className="text-xs font-semibold cursor-pointer"
                      >
                        Reset all filters
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500 font-mono">
                        <span>
                          Showing {number((currentAssociationPage - 1) * associationPageSize + 1)}–
                          {number(Math.min(currentAssociationPage * associationPageSize, filteredAssociations.length))} of{" "}
                          {number(filteredAssociations.length)} pairs
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
                        <nav aria-label="Association pagination" className="flex items-center justify-between border-t border-slate-100 pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={currentAssociationPage === 1}
                            onClick={() => setAssociationPage(currentAssociationPage - 1)}
                            className="h-8 px-3 text-xs font-bold cursor-pointer"
                          >
                            Previous
                          </Button>
                          <span className="text-xs font-mono font-medium text-slate-600">
                            Page {currentAssociationPage} of {associationPageCount}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={currentAssociationPage === associationPageCount}
                            onClick={() => setAssociationPage(currentAssociationPage + 1)}
                            className="h-8 px-3 text-xs font-bold cursor-pointer"
                          >
                            Next
                          </Button>
                        </nav>
                      )}
                    </div>
                  )}
                </div>

                {/* Right 5 Columns: Barangay Risk & Linked Herds */}
                <div className="min-w-0 xl:col-span-5 space-y-3">
                  {/* Barangay Distribution Card */}
                  <Card className="rounded-xl border border-slate-200/80 bg-white shadow-2xs gap-0">
                    <CardHeader className="p-3 pb-2 [.border-b]:pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-xs sm:text-sm font-bold text-slate-900">Records by Barangay (30d)</CardTitle>
                        <Badge variant="outline" className="text-[10px] font-mono font-bold">
                          {barangayPieData.length} active areas
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      {barangayPieData.length && barangayDiseaseTotal > 0 ? (
                        <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center gap-3">
                          <div
                            className="relative h-36 w-36 shrink-0 min-w-0 mx-auto"
                            role="img"
                            aria-label={`Pie chart showing ${number(barangayDiseaseTotal)} disease reports by barangay`}
                          >
                            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
                              <span className="text-lg font-mono font-black text-slate-900">{number(barangayDiseaseTotal)}</span>
                              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500">cases</span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart accessibilityLayer>
                                <Pie
                                  data={barangayPieData}
                                  dataKey="disease_reports"
                                  nameKey="barangay"
                                  innerRadius={40}
                                  outerRadius={58}
                                  paddingAngle={2}
                                  stroke="white"
                                  strokeWidth={2}
                                >
                                  {barangayPieData.map((row, index) => (
                                    <Cell
                                      key={row.barangay_id}
                                      fill={BARANGAY_CHART_COLORS[index % BARANGAY_CHART_COLORS.length]}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value) => [`${number(Number(value))} reports`, "Disease reports"]}
                                  contentStyle={{ borderRadius: "10px", border: "1px solid #fda4af", fontSize: "11px", padding: "6px 10px" }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <ul className="w-full space-y-1 max-h-48 overflow-y-auto pr-1">
                            {barangayPieData.map((row, index) => (
                              <li key={row.barangay_id} className="flex items-start gap-1.5 text-xs">
                                <span
                                  aria-hidden="true"
                                  className="mt-1 size-2 shrink-0 rounded-sm"
                                  style={{ backgroundColor: BARANGAY_CHART_COLORS[index % BARANGAY_CHART_COLORS.length] }}
                                />
                                <div className="min-w-0 flex-1">
                                  <strong className="text-slate-900 truncate block text-xs">{row.barangay}</strong>
                                  <span className="block text-[10.5px] text-slate-500 font-mono">
                                    {number(row.disease_reports)} rep · {number(row.affected_heads)} heads · {number(row.deaths)} deaths
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="py-4 text-center text-xs text-slate-500">No approved disease reports recorded in this period.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Linked Herd Batches Card */}
                  <Card className="rounded-xl border border-slate-200/80 bg-white shadow-2xs gap-0">
                    <CardHeader className="p-3 pb-2 [.border-b]:pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-xs sm:text-sm font-bold text-slate-900">Linked Herd Batches (30d)</CardTitle>
                        <Badge variant="outline" className="text-[10px] font-mono font-bold">
                          {data.herds_last_30_days.length} batches
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      {data.herds_last_30_days.length ? (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {data.herds_last_30_days.map((herd) => (
                            <div
                              key={herd.batch_id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-xs"
                            >
                              <span className="font-mono font-bold text-slate-800 text-xs">{herd.batch_code}</span>
                              <span className="font-mono font-semibold text-slate-600 text-[11px]">
                                {number(herd.disease_reports)} rep · {number(herd.deaths)} death{herd.deaths === 1 ? "" : "s"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="py-4 text-center text-xs text-slate-500">No approved event records linked to a herd batch.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DAILY & WEEKLY TELEMETRY */}
          {centerpieceTab === "telemetry" && (
            <div className="space-y-6">
              {showTableView ? (
                /* Precision Audit Table Mode */
                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold font-mono text-slate-800 uppercase">
                        Daily Activity (Last 14 Days)
                      </span>
                      <span className="text-xs text-slate-500 font-mono">14 observations</span>
                    </div>
                    <Table>
                      <TableHeader className="bg-slate-100/60">
                        <TableRow>
                          <TableHead className="font-mono text-xs">Date</TableHead>
                          <TableHead className="font-mono text-xs text-right">Disease Reports</TableHead>
                          <TableHead className="font-mono text-xs text-right">Affected Heads</TableHead>
                          <TableHead className="font-mono text-xs text-right">Mortality Reports</TableHead>
                          <TableHead className="font-mono text-xs text-right">Deaths</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {combinedDailyData.map((row) => (
                          <TableRow key={row.date} className="hover:bg-slate-50 font-mono text-xs">
                            <TableCell className="font-semibold text-slate-900">{formatDate(row.date)}</TableCell>
                            <TableCell className="text-right text-rose-700 font-bold">{number(row.diseaseReports)}</TableCell>
                            <TableCell className="text-right text-rose-900">{number(row.affectedHeads)}</TableCell>
                            <TableCell className="text-right text-amber-700 font-bold">{number(row.mortalityReports)}</TableCell>
                            <TableCell className="text-right text-amber-900">{number(row.deaths)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold font-mono text-slate-800 uppercase">
                        Weekly Report Counts (12 Complete Weeks)
                      </span>
                      <span className="text-xs text-slate-500 font-mono">12 weeks</span>
                    </div>
                    <Table>
                      <TableHeader className="bg-slate-100/60">
                        <TableRow>
                          <TableHead className="font-mono text-xs">Week Window</TableHead>
                          <TableHead className="font-mono text-xs text-right">Disease Reports</TableHead>
                          <TableHead className="font-mono text-xs text-right">Reported Affected Heads</TableHead>
                          <TableHead className="font-mono text-xs text-right">Mortality Reports</TableHead>
                          <TableHead className="font-mono text-xs text-right">Reported Deaths</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {combinedWeeklyData.map((w) => (
                          <TableRow key={w.start} className="hover:bg-slate-50 font-mono text-xs">
                            <TableCell className="font-semibold text-slate-900">
                              {formatDate(w.start)} – {formatDate(w.end)}
                            </TableCell>
                            <TableCell className="text-right text-rose-700 font-bold">{number(w.diseaseReports)}</TableCell>
                            <TableCell className="text-right text-rose-900">{number(w.affectedHeads)}</TableCell>
                            <TableCell className="text-right text-amber-700 font-bold">{number(w.mortalityReports)}</TableCell>
                            <TableCell className="text-right text-amber-900">{number(w.deaths)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                /* Visual Recharts Charts Mode */
                <div className="space-y-6">
                  {/* Daily 14-Day Composed Chart */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                          <Activity className="size-4 text-rose-600" />
                          Daily Disease and Death Reports (Last 14 Days)
                        </h4>
                        <p className="text-xs text-slate-500">
                          Approved disease reports and recorded deaths each day across Padre Garcia
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="flex items-center gap-1.5 text-rose-700">
                          <span className="size-2 rounded-full bg-rose-500" />
                          Affected Heads
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-700">
                          <span className="size-2 rounded-full bg-amber-500" />
                          Deaths
                        </span>
                      </div>
                    </div>

                    <div className="h-64 sm:h-72 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={combinedDailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="roseArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                          <Tooltip content={<MissionControlTooltip unit="heads / deaths" />} />
                          <Area type="monotone" dataKey="affectedHeads" name="Affected Heads" stroke="#e11d48" strokeWidth={2} fill="url(#roseArea)" />
                          <Bar dataKey="deaths" name="Deaths" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Weekly 12-Week Composed Chart */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                          <TrendingUp className="size-4 text-teal-600" />
                        Weekly Report Counts (12 Complete Weeks)
                        </h4>
                        <p className="text-xs text-slate-500">
                          Weekly aggregate comparison of approved cases and fatal occurrences
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="flex items-center gap-1.5 text-rose-700">
                          <span className="size-2 rounded-full bg-rose-500" />
                          Weekly Heads
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-700">
                          <span className="size-2 rounded-full bg-amber-500" />
                          Weekly Deaths
                        </span>
                      </div>
                    </div>

                    <div className="h-64 sm:h-72 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={combinedWeeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                          <Tooltip content={<MissionControlTooltip unit="heads / deaths" />} />
                          <Bar dataKey="affectedHeads" name="Weekly Affected Heads" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={24} />
                          <Bar dataKey="deaths" name="Weekly Deaths" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={24} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REPORT TYPES & CAUSES */}
          {centerpieceTab === "diagnostics" && (() => {
            const diseaseRows = data.disease.by_recorded_classification_30_days;
            const mortalityRows = data.mortality.by_recorded_cause_30_days;

            const totalDiseaseReports = diseaseRows.reduce((acc, r) => acc + (r.reports || 0), 0);
            const totalDiseaseHeads = diseaseRows.reduce((acc, r) => acc + (r.affected_heads || 0), 0);

            const totalMortalityReports = mortalityRows.reduce((acc, r) => acc + (r.reports || 0), 0);
            const totalMortalityDeaths = mortalityRows.reduce((acc, r) => acc + (r.deaths || 0), 0);

            return (
              <div className="grid gap-6 xl:grid-cols-2">
                {/* Recorded Disease Classifications */}
                <Card className="rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                  <CardHeader className="p-4 sm:p-5 pb-4 border-b border-slate-100 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-700 flex items-center justify-center shrink-0">
                          <Stethoscope className="size-4.5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm sm:text-base font-bold text-slate-900">
                            Disease Reports by Type
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500 mt-0.5">
                            Report types recorded by agricultural staff on approved reports.
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="self-start sm:self-auto shrink-0 border-amber-200 bg-amber-50/80 px-2.5 py-1 text-xs font-bold text-amber-900"
                      >
                        {number(totalDiseaseReports)} {totalDiseaseReports === 1 ? "report" : "reports"} · {number(totalDiseaseHeads)} {totalDiseaseHeads === 1 ? "head" : "heads"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 space-y-4">
                    {diseaseRows.length ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
                        <Table className="min-w-full">
                          <TableHeader className="bg-slate-50/80">
                            <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                              <TableHead className="py-2.5 px-3.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                                Report Type / Condition
                              </TableHead>
                              <TableHead className="py-2.5 px-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600 w-28">
                                Reports
                              </TableHead>
                              <TableHead className="py-2.5 px-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600 w-32">
                                Affected
                              </TableHead>
                              <TableHead className="py-2.5 px-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600 w-24">
                                Share
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-slate-100 text-xs">
                            {diseaseRows.map((row) => {
                              const share = totalDiseaseHeads > 0 ? Math.round((row.affected_heads / totalDiseaseHeads) * 100) : 0;
                              return (
                                <TableRow key={row.classification} className="hover:bg-slate-50/70 transition-colors odd:bg-white even:bg-slate-50/30">
                                  <TableCell className="py-3 px-3.5 align-middle">
                                    <div className="font-semibold text-slate-900 leading-snug">
                                      <RecordedLabel value={row.classification} />
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-3 px-3 text-center align-middle whitespace-nowrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] tabular-nums">
                                      {number(row.reports)} {row.reports === 1 ? "report" : "reports"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-3 px-3 text-right align-middle whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 font-bold text-rose-800 bg-rose-50 border border-rose-200/60 px-2.5 py-1 rounded-lg tabular-nums text-xs">
                                      <span className="size-1.5 rounded-full bg-rose-500" />
                                      {number(row.affected_heads)} {row.affected_heads === 1 ? "head" : "heads"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-3 px-3 text-right align-middle whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <span className="font-mono font-semibold text-slate-600 text-[11px] tabular-nums">
                                        {share}%
                                      </span>
                                      <div className="h-1.5 w-10 bg-slate-100 rounded-full overflow-hidden shrink-0 hidden sm:block">
                                        <div
                                          className="h-full bg-rose-500 rounded-full"
                                          style={{ width: `${Math.min(share, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-500 rounded-xl border border-dashed border-slate-200">
                        <Inbox className="size-8 text-slate-300 stroke-[1.5]" />
                        <p className="text-xs font-semibold">No approved disease reports in this period.</p>
                      </div>
                    )}

                    {/* Follow-up status summary */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Activity className="size-3.5 text-slate-600" />
                          Follow-up Status
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">30-day active statuses</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {Object.entries(data.disease.clinical_status_counts_30_days).length > 0 ? (
                          Object.entries(data.disease.clinical_status_counts_30_days).map(([status, count]) => (
                            <span
                              key={status}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 shadow-2xs"
                            >
                              <span className="size-1.5 rounded-full bg-amber-500" />
                              <span className="text-slate-600">
                                {clinicalStatusLabel[status] ?? status.replaceAll("_", " ")}:
                              </span>
                              <strong className="font-bold text-slate-900 tabular-nums">{number(count)}</strong>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 italic">No active reports recorded</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recorded Death Causes */}
                <Card className="rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                  <CardHeader className="p-4 sm:p-5 pb-4 border-b border-slate-100 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-rose-50 border border-rose-200/60 text-rose-700 flex items-center justify-center shrink-0">
                          <AlertTriangle className="size-4.5" />
                        </div>
                        <div>
                          <CardTitle className="text-sm sm:text-base font-bold text-slate-900">
                            Mortality: Recorded Causes
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500 mt-0.5">
                            Primary cause descriptions recorded on verified mortality forms by technicians and inspectors.
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="self-start sm:self-auto shrink-0 border-rose-200 bg-rose-50/80 px-2.5 py-1 text-xs font-bold text-rose-900"
                      >
                        {number(totalMortalityReports)} {totalMortalityReports === 1 ? "report" : "reports"} · {number(totalMortalityDeaths)} {totalMortalityDeaths === 1 ? "death" : "deaths"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5 space-y-4">
                    {mortalityRows.length ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
                        <Table className="min-w-full">
                          <TableHeader className="bg-slate-50/80">
                            <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                              <TableHead className="py-2.5 px-3.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                                Recorded Cause Description
                              </TableHead>
                              <TableHead className="py-2.5 px-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600 w-28">
                                Reports
                              </TableHead>
                              <TableHead className="py-2.5 px-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600 w-32">
                                Deaths
                              </TableHead>
                              <TableHead className="py-2.5 px-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600 w-24">
                                Share
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-slate-100 text-xs">
                            {mortalityRows.map((row) => {
                              const share = totalMortalityDeaths > 0 ? Math.round((row.deaths / totalMortalityDeaths) * 100) : 0;
                              return (
                                <TableRow key={row.cause} className="hover:bg-slate-50/70 transition-colors odd:bg-white even:bg-slate-50/30">
                                  <TableCell className="py-3 px-3.5 align-middle">
                                    <div className="font-semibold text-slate-900 leading-snug">
                                      <RecordedLabel value={row.cause} />
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-3 px-3 text-center align-middle whitespace-nowrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] tabular-nums">
                                      {number(row.reports)} {row.reports === 1 ? "report" : "reports"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-3 px-3 text-right align-middle whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-lg tabular-nums text-xs">
                                      <span className="size-1.5 rounded-full bg-amber-500" />
                                      {number(row.deaths)} {row.deaths === 1 ? "death" : "deaths"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-3 px-3 text-right align-middle whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <span className="font-mono font-semibold text-slate-600 text-[11px] tabular-nums">
                                        {share}%
                                      </span>
                                      <div className="h-1.5 w-10 bg-slate-100 rounded-full overflow-hidden shrink-0 hidden sm:block">
                                        <div
                                          className="h-full bg-amber-500 rounded-full"
                                          style={{ width: `${Math.min(share, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-500 rounded-xl border border-dashed border-slate-200">
                        <Inbox className="size-8 text-slate-300 stroke-[1.5]" />
                        <p className="text-xs font-semibold">No approved mortality reports in this period.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* TAB 4: REPORT-BASED SPATIAL SCENARIO SANDBOX */}
          {centerpieceTab === "sandbox" && (
            <PadreGarciaForecaster />
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* F. OFFICIAL MAO OPERATIONAL GUIDELINES                            */}
      {/* ----------------------------------------------------------------- */}
      <Card id="mao-operational-guide" className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden gap-0">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 px-4 py-2.5 sm:px-4.5 sm:py-3 [.border-b]:pb-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Sparkles className="size-4 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-xs sm:text-sm font-extrabold text-slate-900 leading-none">
                  Official MAO Guide
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500 mt-0.5 leading-none">
                  How to read these reports
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] font-bold text-slate-700 hover:text-slate-900 border-slate-200 bg-white rounded-full px-3 self-start sm:self-auto cursor-pointer"
              onClick={() => alert("Full Field Biosecurity Manual available at Municipal Agriculture Office (MAO) Padre Garcia.")}
            >
              Open Full Guide →
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-3.5">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200/80 p-2.5 bg-slate-50/50 space-y-0.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                Only Approved Records Count
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                All numbers reflect officially approved reports. Pending field data do not trigger municipal alerts.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 p-2.5 bg-slate-50/50 space-y-0.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                Zero Means No Submitted Records
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Zero records indicate absence of approved submissions, not verified absence of cases.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 p-2.5 bg-slate-50/50 space-y-0.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <MapPin className="size-3.5 text-rose-600 shrink-0" />
                Where reports were recorded
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                The map helps staff decide which barangays to check first.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 p-2.5 bg-slate-50/50 space-y-0.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <TrendingUp className="size-3.5 text-indigo-600 shrink-0" />
                Herd Visibility Context
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Use linked records to understand current herd activity and movement.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* G. TECHNICAL AUDIT: MACHINE LEARNING FORECAST & ALERT VALIDATION  */}
      {/* ----------------------------------------------------------------- */}
      <details className="group rounded-2xl border border-slate-200/80 bg-white transition-colors shadow-2xs overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-slate-700 outline-none hover:bg-slate-50/80 select-none">
          <span className="flex items-center gap-2">
            <Zap className="size-4 text-rose-600 shrink-0" />
            <span className="font-extrabold text-slate-900">How Alerts and Forecasts Are Checked</span>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] font-mono font-bold text-slate-600">
              Technical details
            </Badge>
          </span>
          <span className="text-xs font-semibold text-slate-500 group-open:hidden">+ Show details</span>
          <span className="hidden text-xs font-semibold text-slate-500 group-open:inline">− Hide details</span>
        </summary>
        <div className="border-t border-slate-200 p-3.5 sm:p-4 bg-white rounded-b-2xl space-y-2.5 text-xs leading-relaxed text-slate-700">
          <p>
            <strong>Note for MAO Officers:</strong> Surveillance indicators display real, observed municipal records. Monthly production forecasts use the established municipal time-series models independently.
          </p>
          <div className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600 font-mono">
            <p>
              <strong>Past alert check:</strong> {data.historical_backtest.status.replaceAll("_", " ")} · {number(data.historical_backtest.usable_evaluation_periods)} periods checked. {data.historical_backtest.reason}
            </p>
            <p>
              <strong>Current monthly forecast method:</strong> {data.monthly_forecast_comparison.baseline}
            </p>
            <p>
              <strong>Test forecast method:</strong> for comparison only; it does not replace the current forecast.
            </p>
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRunForecastExperiment(true)}
              disabled={experimentQuery.isFetching}
              className="h-7 text-xs font-bold cursor-pointer"
            >
              {experimentQuery.isFetching
                ? "Checking past records..."
                : experimentQuery.data
                ? "Refresh comparison"
                : "Compare forecast methods"}
            </Button>
          </div>

          {experimentQuery.isError && (
            <p role="alert" className="text-rose-700 text-xs font-semibold">
              The comparison could not be completed. Check your access or try again later.
            </p>
          )}

          {experimentQuery.isPending && runForecastExperiment && (
            <p role="status" className="text-xs text-slate-500">
              Comparing one-month forecasts using approved records. This can take a moment.
            </p>
          )}

          {experimentQuery.data && (
            <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs font-mono">
              <p>
                <strong>Result:</strong> {experimentQuery.data.status.replaceAll("_", " ")}. {experimentQuery.data.reason}
              </p>
              <p className="text-slate-600">
                {experimentQuery.data.evaluation_method} The test method will not replace the current forecast automatically.
              </p>
              <div className="grid gap-2.5 lg:grid-cols-3 pt-1">
                {Object.values(experimentQuery.data.targets).map((target) => (
                  <div key={target.target} className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1">
                    <p className="font-bold text-slate-900">
                      {target.target.replaceAll("_", " ")} ({target.unit}; {target.horizon_months} months ahead)
                    </p>
                    <p className="text-slate-600">
                      Records used: {target.training_status.replaceAll("_", " ")} ({target.training_sample_count}/
                      {target.minimum_training_samples} samples)
                    </p>
                    <p className="text-slate-600">Test method: {target.candidate_status.replaceAll("_", " ")}</p>
                    <p className="text-slate-800 font-semibold">
                      Test forecast:{" "}
                      {target.candidate_forecast == null ? "Unavailable" : `${metric(target.candidate_forecast)} ${target.unit}`}
                    </p>
                    <p className="text-slate-600">
                      Average error (lower is better): current {metric(target.baseline.mae)} | test {metric(target.enhanced.mae)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>

      {/* ----------------------------------------------------------------- */}
      {/* H. SPATIAL BIOSURVEILLANCE WORKSPACE CALLOUT                      */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50/70 via-white to-rose-50/30 px-4 py-3 sm:px-4.5 sm:py-3.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-rose-600" />
            <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-rose-700">
              FULL-SCREEN MUNICIPAL GIS
            </span>
          </div>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            Open the dedicated 2D/3D GIS workspace to inspect cattle inventories, farmer registries, transport clearances, and livestock densities across all 18 barangays.
          </p>
        </div>
        <Button
          asChild
          className="h-8.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full px-4.5 shadow-xs shrink-0 cursor-pointer"
        >
          <Link href={user?.role?.toUpperCase() === "SIBAT" || user?.role?.toUpperCase() === "CBAT" ? "/sibat-monitoring" : "/gis-map"}>
            <MapPin className="size-3.5 mr-1.5" />
            Launch Municipal GIS Map →
          </Link>
        </Button>
      </div>
    </div>
  );
}
