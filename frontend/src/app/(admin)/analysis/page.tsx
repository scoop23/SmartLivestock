'use client';

import { useQuery } from '@tanstack/react-query';
import { AskSmartLivestock } from '@/app/components/ask-smartlivestock';
import { PageHeader } from '@/app/components/page-header';
import { AnalyticsNav } from '@/app/components/analytics/analytics-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/axios';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Beef,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  FileSearch,
  FileSpreadsheet,
  Info,
  Layers,
  Lightbulb,
  Map,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Workflow,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface DashboardSummaryResponse {
  surveillance_series?: Array<{ month: string; label: string; reported_heads: number; deaths: number }>;
  descriptive?: {
    period: { start: string; end: string };
    population: {
      total_heads: number;
      by_barangay: Array<{ barangay_id: number | null; barangay: string | null; heads: number; registered_farmers: number }>;
      by_species: Array<{ species_id: number; species: string; heads: number }>;
    };
    production: {
      records: number;
    };
    disease: {
      cases: number;
      affected_heads: number;
    };
    mortality: {
      records: number;
      deaths: number;
    };
  };
}

interface SurveillanceQuickResponse {
  as_of?: string;
  disease?: {
    alert?: { level: string; explanation: string };
  };
  mortality?: {
    alert?: { level: string; explanation: string };
  };
}

export default function AnalysisOverviewPage() {
  const { user } = useAuth();
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);

  // Fetch verified summary telemetry for real-data overview
  const dashboardQuery = useQuery<DashboardSummaryResponse>({
    queryKey: ['analytics-overview-telemetry', user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<DashboardSummaryResponse>('analytics/dashboard/', { signal });
      return data;
    },
    staleTime: 60_000,
  });

  const surveillanceQuery = useQuery<SurveillanceQuickResponse>({
    queryKey: ['analytics-overview-surveillance', user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: async ({ signal }) => {
      const { data } = await api.get<SurveillanceQuickResponse>('analytics/surveillance/', { signal });
      return data;
    },
    staleTime: 60_000,
  });

  const descriptive = dashboardQuery.data?.descriptive;
  const surveillance = surveillanceQuery.data;

  const periodEndFormatted = descriptive?.period?.end
    ? new Date(`${descriptive.period.end}T00:00:00`).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const periodStartFormatted = descriptive?.period?.start
    ? new Date(`${descriptive.period.start}T00:00:00`).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const isFetching = dashboardQuery.isFetching || surveillanceQuery.isFetching;

  return (
    <>
      <PageHeader
        title="Analytics & Insights"
        subtitle="Municipal livestock intelligence, empirical forecasting, and evidence-based decision guidance for Padre Garcia"
        variant="admin"
        maxWidthClass="w-full"
        icon={<BarChart3 className="size-5 text-emerald-800" />}
      />

      <div className="p-3 sm:p-4 md:p-6 w-full space-y-6 pb-20 sm:pb-8 max-w-7xl mx-auto">
        {/* Navigation Bar */}
        <AnalyticsNav currentSection="overview" />

        {/* ----------------------------------------------------------------- */}
        {/* A. COMMAND BANNER (Futuristic Municipal Intelligence Header)      */}
        {/* ----------------------------------------------------------------- */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/80 via-white to-cyan-50/40 p-5 shadow-2xs">
          {/* Subtle decorative radial blurs */}
          <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 size-72 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-emerald-800">
                  <Activity className="size-3.5 text-emerald-600 animate-pulse" />
                  Municipal Intelligence Hub
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-600 font-medium">Padre Garcia Batangas</span>
                {periodEndFormatted && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="size-3 text-slate-400" />
                      Data Active: {periodStartFormatted} – {periodEndFormatted}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                Analytics &amp; Intelligence Overview
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-mono font-bold">
                  v2.4 Core
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                Authoritative command portal connecting descriptive census records, empirical time-series forecasts, deterministic decision rules, and active biosurveillance across Padre Garcia.
              </p>
            </div>

            {/* Header Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer"
              >
                <Link href={user?.role?.toUpperCase() === "SIBAT" || user?.role?.toUpperCase() === "CBAT" ? "/sibat-monitoring" : "/gis-map"}>
                  <Map className="size-3.5 mr-1.5 text-teal-600" />
                  Municipal GIS Map
                </Link>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void dashboardQuery.refetch();
                  void surveillanceQuery.refetch();
                }}
                disabled={isFetching}
                className="border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer"
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${isFetching ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* B. 4 EXECUTIVE METRIC HUD CARDS                                   */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Total Active Livestock */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Active Livestock
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Beef className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {dashboardQuery.isPending ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <span className="text-2xl font-mono font-black text-slate-900">
                  {descriptive?.population.total_heads?.toLocaleString('en-PH') ?? '0'}
                </span>
              )}
              <span className="text-xs font-semibold text-emerald-700">heads</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Approved census snapshot</span>
              <span className="font-mono font-bold text-slate-700">{descriptive?.population.by_species?.length ?? 0} species</span>
            </div>
          </div>

          {/* Metric 2: Active Barangays */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Barangay Coverage
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                <MapPin className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {dashboardQuery.isPending ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <span className="text-2xl font-mono font-black text-slate-900">
                  {descriptive?.population.by_barangay.filter((b) => b.barangay_id !== null).length ?? '0'}
                  <span className="text-base font-normal text-slate-400"> / 18</span>
                </span>
              )}
              <span className="text-xs font-semibold text-cyan-700">reporting</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Barangays with registered farms</span>
              <span className="font-mono font-bold text-slate-700">Padre Garcia</span>
            </div>
          </div>

          {/* Metric 3: Verified Production Records */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Verified Production
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <Layers className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {dashboardQuery.isPending ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <span className="text-2xl font-mono font-black text-slate-900">
                  {descriptive?.production.records?.toLocaleString('en-PH') ?? '0'}
                </span>
              )}
              <span className="text-xs font-semibold text-amber-700">records</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Milk, meat, honey, and eggs</span>
              <span className="font-mono font-bold text-slate-700">Approved</span>
            </div>
          </div>

          {/* Metric 4: Health Surveillance Status */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Biosurveillance Status
              </span>
              <div className="flex size-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                <Activity className="size-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {dashboardQuery.isPending ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <span className="text-2xl font-mono font-black text-slate-900">
                  {descriptive?.disease.cases ?? 0}
                </span>
              )}
              <span className="text-xs font-semibold text-rose-700">cases</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Mortality in period:</span>
              <span className="font-mono font-bold text-slate-700">{descriptive?.mortality.deaths ?? 0} deaths</span>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* C. THE 4 CORE ANALYTICS PILLARS (Segmented Quadrant Cards)        */}
        {/* ----------------------------------------------------------------- */}
        <section aria-label="Four Core Analytics Pillars" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Municipal Intelligence Pillars
              </h2>
              <p className="text-xs text-slate-500">
                Select an analytical framework aligned with your administrative, forecasting, or veterinary goals.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-mono font-bold text-slate-600 bg-slate-50">
              4 Disciplines
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Descriptive Intelligence */}
            <Link
              href="/analysis/descriptive"
              className="group relative flex flex-col justify-between rounded-2xl border-2 border-slate-200/90 bg-white p-5 hover:border-emerald-600 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shadow-2xs group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <BarChart3 className="size-5 shrink-0" />
                  </div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold text-[11px]">
                    What Happened
                  </Badge>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-950 transition-colors">
                    Descriptive Intelligence
                  </h3>
                  <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                    Census &amp; Historical Records
                  </p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Verified head counts, monthly commodity yields, registered livestock trade, and barangay population distributions.
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                    <span>Official active inventory census</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                    <span>Monthly milk, meat, and egg yields</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-800">
                <span>Enter Descriptive HUD</span>
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 2. Predictive Analytics */}
            <Link
              href="/analysis/predictive"
              className="group relative flex flex-col justify-between rounded-2xl border-2 border-slate-200/90 bg-white p-5 hover:border-cyan-600 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 shadow-2xs group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                    <TrendingUp className="size-5 shrink-0" />
                  </div>
                  <Badge variant="outline" className="bg-cyan-50 text-cyan-800 border-cyan-300 font-bold text-[11px]">
                    What May Happen
                  </Badge>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-cyan-950 transition-colors">
                    Predictive Analytics
                  </h3>
                  <p className="text-xs font-semibold text-cyan-800 mt-0.5">
                    Empirical Time-Series Forecasts
                  </p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    1–6 month commodity and trade projections rigorously evaluated against historical backtesting and naive baselines.
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-cyan-600 shrink-0" />
                    <span>Multi-model bench (ARIMA, Holt-Winters)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-cyan-600 shrink-0" />
                    <span>Out-of-sample MAE &amp; RMSE cutoffs</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-cyan-800">
                <span>Enter Forecast Bench</span>
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 3. Prescriptive Guidance */}
            <Link
              href="/analysis/prescriptive"
              className="group relative flex flex-col justify-between rounded-2xl border-2 border-slate-200/90 bg-white p-5 hover:border-amber-600 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shadow-2xs group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <Workflow className="size-5 shrink-0" />
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-[11px]">
                    What Actions to Take
                  </Badge>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-950 transition-colors">
                    Prescriptive Guidance
                  </h3>
                  <p className="text-xs font-semibold text-amber-800 mt-0.5">
                    Deterministic Decision Rules
                  </p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Quantitative threshold triggers advising feed reserves, quarantine buffers, and veterinary technician dispatches.
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-amber-600 shrink-0" />
                    <span>Transparent trigger formulas &amp; evidence</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-amber-600 shrink-0" />
                    <span>Actionable administrative steps</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-800">
                <span>Enter Decision Support</span>
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 4. Surveillance & Health */}
            <Link
              href="/analysis/surveillance-health"
              className="group relative flex flex-col justify-between rounded-2xl border-2 border-slate-200/90 bg-white p-5 hover:border-rose-600 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-rose-100 text-rose-800 shadow-2xs group-hover:bg-rose-600 group-hover:text-white transition-colors">
                    <ShieldAlert className="size-5 shrink-0" />
                  </div>
                  <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-300 font-bold text-[11px]">
                    Clinical Alerts
                  </Badge>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-rose-950 transition-colors">
                    Surveillance &amp; Health
                  </h3>
                  <p className="text-xs font-semibold text-rose-800 mt-0.5">
                    Biosurveillance &amp; Mortalities
                  </p>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    Real-time approved disease reports, weekly comparison alert levels, and 30-day temporal herd contagion tracking.
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-rose-600 shrink-0" />
                    <span>Preceding disease-mortality links</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 text-rose-600 shrink-0" />
                    <span>Barangay outbreak distribution donut</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-800">
                <span>Enter Biosurveillance</span>
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* D. MISSION CONTROL CENTERPIECE: NATURAL LANGUAGE ASSISTANT        */}
        {/* ----------------------------------------------------------------- */}
        <section
          aria-label="Natural Language Query Assistant"
          className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 border-b border-slate-100">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200/60 shadow-2xs">
                <Sparkles className="size-5 text-emerald-700" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Ask Municipal Data Assistant
                  </h2>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold">
                    Rule-Based NLP
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                  Ask natural language questions in English or Tagalog about head counts, monthly commodity yields, disease alerts, or pending approvals.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {user?.isNlpDeveloper ? (
                <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <Link href="/admin/analytics/nlp-example-review">
                    <FileSearch className="mr-1.5 size-3.5 text-slate-500" />
                    NLP Examples
                  </Link>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAssistantOpen((prev) => !prev)}
                className={`h-8 text-xs font-bold transition-colors cursor-pointer ${
                  isAssistantOpen
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
                aria-expanded={isAssistantOpen}
                aria-controls="ask-smartlivestock-content"
              >
                {isAssistantOpen ? (
                  <>
                    <span>Hide Assistant</span>
                    <ChevronUp className="ml-1.5 size-3.5" />
                  </>
                ) : (
                  <>
                    <span>Open Assistant</span>
                    <ChevronDown className="ml-1.5 size-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {isAssistantOpen && (
            <div id="ask-smartlivestock-content" className="p-4 sm:p-5 bg-white space-y-4">
              <AskSmartLivestock />
            </div>
          )}
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* E. SPECIALIZED WORKSPACES & WORKBENCHES                           */}
        {/* ----------------------------------------------------------------- */}
        <section aria-label="Explore Dedicated Analytics Workspaces" className="space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Dedicated Analysis Workspaces</h2>
            <p className="text-xs text-slate-500">
              Direct access to full-screen analytics workbenches, diagnostics, and municipal reporting tools.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Workspace 1: Municipal Records */}
            <Link
              href="/analysis/municipal-records"
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-emerald-500 hover:bg-emerald-50/20 hover:shadow-2xs transition-all group cursor-pointer"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200 transition-colors">
                    <FileSpreadsheet className="size-4.5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                    Descriptive
                  </Badge>
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-950 transition-colors">
                  Municipal Records Matrix
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  Historical and current approved records, production trends, and barangay matrices.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-800">
                <span>Open Matrix</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Workspace 2: Evaluated Forecasts */}
            <Link
              href="/analysis/evaluated-forecasts"
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-cyan-500 hover:bg-cyan-50/20 hover:shadow-2xs transition-all group cursor-pointer"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-cyan-100 text-cyan-800 group-hover:bg-cyan-200 transition-colors">
                    <Cpu className="size-4.5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                    Predictive
                  </Badge>
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-cyan-950 transition-colors">
                  Evaluated Forecasts Bench
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  Out-of-sample projections, validation cutoffs, model benchmarks, and diagnostics.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-cyan-800">
                <span>View Projections</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Workspace 3: Decision Support */}
            <Link
              href="/analysis/decision-support"
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-500 hover:bg-amber-50/20 hover:shadow-2xs transition-all group cursor-pointer"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-800 group-hover:bg-amber-200 transition-colors">
                    <Workflow className="size-4.5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                    Prescriptive
                  </Badge>
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-950 transition-colors">
                  Decision Support Workspace
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  Rule-based evidence triggers, intervention suggestions, and follow-up guidance.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-800">
                <span>Inspect Rules</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Workspace 4: Spatial GIS Map */}
            <Link
              href={user?.role?.toUpperCase() === "SIBAT" || user?.role?.toUpperCase() === "CBAT" ? "/sibat-monitoring" : "/gis-map"}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-rose-500 hover:bg-rose-50/20 hover:shadow-2xs transition-all group cursor-pointer"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-rose-100 text-rose-800 group-hover:bg-rose-200 transition-colors">
                    <Map className="size-4.5" />
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                    GIS &amp; Spatial
                  </Badge>
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-rose-950 transition-colors">
                  Spatial GIS Surveillance
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  Interactive barangay maps, registered livestock pens, and quarantine buffer zones.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-800">
                <span>Open GIS Map</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* F. DATA GOVERNANCE & LEGAL AUDIT STATEMENT                        */}
        {/* ----------------------------------------------------------------- */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <ShieldCheck className="size-4.5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  Authoritative Municipal Data Scope
                </span>
                <Badge variant="outline" className="bg-white text-emerald-800 border-emerald-300 text-[10px] font-bold">
                  Approved Records Only
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                All analytics, forecasts, and decision-support rules derive strictly from verified records reviewed and approved by MAO officers and certified field inspectors.
              </p>
            </div>
          </div>

          <span className="text-xs text-slate-400 font-mono shrink-0">
            SmartLivestock v2.4 Core
          </span>
        </div>
      </div>
    </>
  );
}
