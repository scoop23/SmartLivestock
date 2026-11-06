'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/app/components/page-header';
import { AnalyticsNav } from '@/app/components/analytics/analytics-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/auth-context';
import api from '@/lib/axios';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Lightbulb,
  ListFilter,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type RecommendationCategory = 'ALL' | 'DISEASE' | 'MORTALITY' | 'AUCTION' | 'SLAUGHTER' | 'PRICE' | 'DATA_QUALITY' | 'VACCINATION';
interface RecommendationItem {
  rule: string;
  category: string;
  category_key?: RecommendationCategory;
  responsible_role?: string;
  source?: string;
  action_link?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  reason: string;
  evidence: Record<string, string | number>;
  recommendation: string;
  action_type: string;
}


interface RecommendationRoute {
  href: string;
  label: string;
  badge: string;
}

function getRecommendationRoute(rec: RecommendationItem): RecommendationRoute {
  const rule = (rec.rule || "").toUpperCase();
  const cat = (rec.category_key || rec.category || "").toUpperCase();
  const source = (rec.source || "").toLowerCase();

  // If backend provided a specific action link with query params, enhance its label
  if (rec.action_link && rec.action_link.length > 1) {
    const link = rec.action_link;
    if (link.includes("predictive")) {
      if (link.includes("domain=auction") || cat.includes("PRICE") || cat.includes("AUCTION")) {
        return { href: link, label: "View Auction Forecasts", badge: "/analysis/predictive?domain=auction" };
      }
      if (link.includes("domain=slaughter") || cat.includes("SLAUGHTER")) {
        return { href: link, label: "View Slaughter Forecasts", badge: "/analysis/predictive?domain=slaughter" };
      }
      if (link.includes("domain=disease") || cat.includes("DISEASE")) {
        return { href: link, label: "View Disease Forecasts", badge: "/analysis/predictive?domain=disease" };
      }
      if (link.includes("domain=mortality") || cat.includes("MORTALITY")) {
        return { href: link, label: "View Mortality Forecasts", badge: "/analysis/predictive?domain=mortality" };
      }
      return { href: link, label: "Inspect Predictive Forecast", badge: link };
    }
    if (link.includes("disease")) {
      return { href: link, label: "Open Disease & Mortality", badge: "/disease-mortality" };
    }
    if (link.includes("gis")) {
      return { href: link, label: "Open Barangay GIS Map", badge: "/gis-map" };
    }
    return { href: link, label: "Open Assigned Module", badge: link };
  }

  // Domain & Rule Pattern Matching
  if (rule.includes("DISEASE") || cat.includes("DISEASE")) {
    if (source === "forecast") {
      return { href: "/analysis/predictive?domain=disease", label: "Open Disease Forecast Model", badge: "/analysis/predictive?domain=disease" };
    }
    return { href: "/disease-mortality", label: "Review Disease Reports & Cases", badge: "/disease-mortality" };
  }

  if (rule.includes("MORTALITY") || cat.includes("MORTALITY")) {
    if (source === "forecast") {
      return { href: "/analysis/predictive?domain=mortality", label: "Open Mortality Forecast Model", badge: "/analysis/predictive?domain=mortality" };
    }
    return { href: "/disease-mortality", label: "Review Mortality Registry", badge: "/disease-mortality" };
  }

  if (rule.includes("VACCINATION") || cat.includes("VACCINATION")) {
    return { href: "/gis-map", label: "Open Barangay Vaccination Map", badge: "/gis-map" };
  }

  if (cat.includes("PRICE") || rule.includes("PRICE")) {
    return { href: "/analysis/predictive?domain=auction", label: "Check Auction Price Models", badge: "/analysis/predictive?domain=auction" };
  }

  if (cat.includes("AUCTION") || rule.includes("AUCTION") || rule.includes("SALES")) {
    if (source === "forecast") {
      return { href: "/analysis/predictive?domain=auction", label: "Inspect Auction Sales Forecast", badge: "/analysis/predictive?domain=auction" };
    }
    return { href: "/ownership-transfers/registry", label: "Inspect Transfer Registry", badge: "/ownership-transfers/registry" };
  }

  if (cat.includes("SLAUGHTER") || rule.includes("SLAUGHTER")) {
    if (source === "forecast") {
      return { href: "/analysis/predictive?domain=slaughter", label: "Open Slaughter Demand Forecast", badge: "/analysis/predictive?domain=slaughter" };
    }
    return { href: "/slaughter-record-review", label: "Review Slaughter Records", badge: "/slaughter-record-review" };
  }

  if (cat.includes("DATA_QUALITY") || rule.includes("READINESS") || rule.includes("BASELINE")) {
    return { href: "/data-validation", label: "Audit Validation Submissions", badge: "/data-validation" };
  }

  return { href: "/analysis/surveillance-health", label: "Inspect Health Telemetry", badge: "/analysis/surveillance-health" };
}

interface PrescriptiveResponse {
  status: 'ready' | 'partial' | 'error';
  rule_readiness: {
    disease: 'ready' | 'unavailable';
    vaccination_records: 'ready' | 'unavailable';
  };
  total_recommendations: number;
  recommendations: RecommendationItem[];
}

function PrescriptiveLandingContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const domainParam = searchParams?.get('domain');

  const initialCat = useMemo<RecommendationCategory>(() => {
    if (!domainParam) return 'ALL';
    const d = domainParam.toLowerCase();
    if (d === 'disease') return 'DISEASE';
    if (d === 'mortality') return 'MORTALITY';
    if (d === 'auction') return 'AUCTION';
    if (d === 'slaughter') return 'SLAUGHTER';
    if (d === 'inventory' || d === 'barangay') return 'VACCINATION';
    return 'ALL';
  }, [domainParam]);

  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [categorySelection, setCategorySelection] = useState<{ domain: string | null; category: RecommendationCategory } | null>(null);
  const selectedCategory = categorySelection?.domain === domainParam ? categorySelection.category : initialCat;
  const setSelectedCategory = (category: RecommendationCategory) => setCategorySelection({ domain: domainParam, category });

  const [showTableView, setShowTableView] = useState(false);

  const { data, isPending: loading, isError, refetch, isFetching } = useQuery<PrescriptiveResponse>({
    queryKey: ['prescriptive-landing', user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: async ({ signal }) => {
      const res = await api.get<PrescriptiveResponse>('analytics/prescriptive/', { signal, timeout: 180_000 });
      return res.data;
    },
    staleTime: 60_000,
  });

  const allRecommendations = useMemo(() => data?.recommendations ?? [], [data]);

  const filteredRecommendations = useMemo(() => {
    if (selectedCategory === 'ALL') return allRecommendations;
    return allRecommendations.filter((r) => (r.category_key || (r.rule === 'DISEASE_SURVEILLANCE_PRESSURE' ? 'DISEASE' : r.rule === 'LOW_VACCINATION_COVERAGE' ? 'VACCINATION' : 'DATA_QUALITY')) === selectedCategory);
  }, [allRecommendations, selectedCategory]);

  const highPriorityCount = allRecommendations.filter((r) => r.severity === 'HIGH').length;
  const mediumPriorityCount = allRecommendations.filter((r) => r.severity === 'MEDIUM').length;

  const toggleExpand = (ruleId: string) => {
    setExpandedRule((prev) => (prev === ruleId ? null : ruleId));
  };

  return (
    <>
      <PageHeader
        title="Prescriptive Intelligence"
        subtitle="Use recorded evidence and available forecasts to plan staff follow-up and municipal activities."
        variant="admin"
        maxWidthClass="w-full"
        icon={<Lightbulb className="size-5 text-amber-800" />}
      />

      <div className="p-3 sm:p-4 md:p-6 w-full space-y-6 pb-20 sm:pb-8">
        <AnalyticsNav currentSection="prescriptive" />

        {/* ----------------------------------------------------------------- */}
        {/* A. COMMAND BANNER (Futuristic Warm Amber Header)                  */}
        {/* ----------------------------------------------------------------- */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 p-5 shadow-2xs">
          {/* Subtle decorative grid background glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 size-72 rounded-full bg-orange-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-amber-900">
                  <Workflow className="size-3.5 text-amber-700 animate-pulse" />
                  Municipal Decision Support Engine
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-600 font-medium">Padre Garcia Batangas</span>
                <span className="text-slate-300">•</span>
                <Badge variant="outline" className="bg-amber-100/60 text-amber-900 border-amber-300 text-[10px] font-mono font-bold">
                  Advisory Protocol
                </Badge>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                Prescriptive Intelligence
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[11px] font-mono font-bold">
                  v2.4 Rules
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                Evidence-based administrative guidance derived from verified records. All triggers are advisory recommendations and never silently alter official registers.
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
                <Link href="/analysis/decision-support">
                  <Workflow className="size-3.5 mr-1.5 text-amber-700" />
                  Decision Support Workspace
                </Link>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer"
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${isFetching ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* B. INTERACTIVE RULE CATEGORY SELECTOR (4 Segmented Cards)         */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {([
            { id: 'ALL', label: 'All Recommendations', category: 'Combined', icon: Sparkles },
            { id: 'DISEASE', label: 'Disease Follow-up', category: 'Health reports', icon: ShieldAlert },
            { id: 'MORTALITY', label: 'Mortality Follow-up', category: 'Recorded deaths', icon: ShieldAlert },
            { id: 'AUCTION', label: 'Auction Workload', category: 'Recorded sales', icon: Workflow },
            { id: 'SLAUGHTER', label: 'Slaughter Planning', category: 'Carcass weight', icon: Scale },
            { id: 'PRICE', label: 'Cattle-price Monitoring', category: 'Recorded prices', icon: Scale },
            { id: 'DATA_QUALITY', label: 'Forecast Readiness', category: 'Data follow-up', icon: FileCheck2 },
            { id: 'VACCINATION', label: 'Vaccination Records', category: 'Record coverage', icon: ShieldCheck },
          ] as const).map(item => {
            const count = item.id === 'ALL' ? allRecommendations.length : allRecommendations.filter(rec => rec.category_key === item.id).length;
            return { ...item, status: `${count} recommendations`, badge: `${count} items`, ready: count > 0 };
          }).map((card) => {
            const isSelected = selectedCategory === card.id;
            const Icon = card.icon;

            return (
              <button
                key={card.id}
                onClick={() => setSelectedCategory(card.id)}
                className={`group relative flex flex-col justify-between rounded-2xl p-4 text-left transition-all duration-200 border cursor-pointer ${
                  isSelected
                    ? 'border-2 border-amber-600 bg-amber-50/70 shadow-sm'
                    : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`flex size-9 items-center justify-center rounded-xl transition-colors ${
                      isSelected
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="size-4.5" />
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono font-bold ${
                      card.ready
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                  >
                    {card.badge}
                  </Badge>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                    {card.category} • Rule Engine
                  </div>
                  <div className={`text-sm font-bold transition-colors mt-0.5 ${
                    isSelected ? 'text-amber-950 font-bold' : 'text-slate-800 group-hover:text-slate-900'
                  }`}>
                    {card.label}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span className="font-mono text-amber-800 font-semibold">{card.status}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">
                      {isSelected ? 'Active Filter' : 'Inspect'}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute -bottom-px left-4 right-4 h-0.5 bg-amber-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* C. EXECUTIVE DECISION METRICS (Continuous Scoreboard Ribbon)      */}
        {/* ----------------------------------------------------------------- */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Evaluated Rule Telemetry • Municipal Metric Readout
            </span>
            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
              Non-interactive Summary
            </span>
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/85 text-slate-100 divide-y sm:divide-y-0 sm:divide-x divide-slate-700/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 select-none cursor-default overflow-hidden shadow-xs backdrop-blur-xs">
            <div className="p-3.5 sm:p-4 bg-slate-800/60">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="size-1.5 rounded-full bg-amber-400 shrink-0 shadow-xs" />
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-slate-300 truncate">
                  Active Recommendations
                </span>
              </div>
              <div className="mt-2">
                <div className="text-2xl sm:text-3xl font-mono font-black text-white tracking-tight">
                  {allRecommendations.length}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">
                  Quantitative threshold triggers evaluated
                </p>
              </div>
            </div>

            <div className="p-3.5 sm:p-4 bg-slate-800/60">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="size-1.5 rounded-full bg-rose-400 shrink-0 shadow-xs" />
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-slate-300 truncate">
                  High Priority Alerts
                </span>
              </div>
              <div className="mt-2">
                <div className="text-2xl sm:text-3xl font-mono font-black text-white tracking-tight">
                  {highPriorityCount}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">
                  Requires immediate veterinary action
                </p>
              </div>
            </div>

            <div className="p-3.5 sm:p-4 bg-slate-800/60">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="size-1.5 rounded-full bg-teal-400 shrink-0 shadow-xs" />
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-slate-300 truncate">
                  Medium Priority Triggers
                </span>
              </div>
              <div className="mt-2">
                <div className="text-2xl sm:text-3xl font-mono font-black text-white tracking-tight">
                  {mediumPriorityCount}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">
                  Operational improvements and farm-level alerts
                </p>
              </div>
            </div>

            <div className="p-3.5 sm:p-4 bg-slate-800/60">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="size-1.5 rounded-full bg-emerald-400 shrink-0 shadow-xs" />
                <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-slate-300 truncate">
                  Municipal Governance
                </span>
              </div>
              <div className="mt-2">
                <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 tracking-tight">
                  100% Advisory
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">
                  Zero automated mutations; officer discretion enforced
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* D. MISSION CONTROL CENTERPIECE RECOMMENDATION MATRIX              */}
        {/* ----------------------------------------------------------------- */}
        <Card className="overflow-hidden rounded-2xl border border-amber-200/90 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                  <Workflow className="size-4 text-amber-700" />
                </div>
                <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                  Triggered Administrative &amp; Veterinary Recommendations ({filteredRecommendations.length})
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                <span>Filter: <strong className="font-mono text-amber-800">{selectedCategory}</strong></span>
                <span>•</span>
                <span>Evidence: <strong className="text-slate-700">Quantitative Observation Triggers</strong></span>
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
                    <ListFilter className="size-3.5 mr-1 text-amber-600" />
                    Interactive Cards Feed
                  </>
                ) : (
                  <>
                    <TableIcon className="size-3.5 mr-1 text-amber-600" />
                    Audit Matrix Table
                  </>
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <p className="text-xs text-slate-500">Forecast planning evidence is cached for up to five minutes. The first evaluation may take longer while models are checked. Recommendations support staff review and do not perform actions automatically.</p>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-rose-200 rounded-xl bg-rose-50/50">
                <AlertCircle className="size-8 text-rose-500 mb-2" />
                <h3 className="text-base font-bold text-slate-900">Unable to Load Prescriptive Recommendations</h3>
                <p className="text-xs text-slate-600 max-w-md mt-1">
                  The rule evaluation service encountered an error or is unreachable.
                </p>
                <Button onClick={() => void refetch()} size="sm" className="mt-3 bg-amber-700 text-white font-bold text-xs">
                  Retry Evaluation
                </Button>
              </div>
            ) : filteredRecommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <CheckCircle2 className="size-8 text-emerald-600 mb-2" />
                <h3 className="text-base font-bold text-slate-900">No recommendations in this category</h3>
                <p className="text-xs text-slate-600 max-w-md mt-1">
                  No recommendations match this category. Available evidence may be limited; this does not establish normal conditions or complete reporting.
                </p>
              </div>
            ) : showTableView ? (
              /* Tabular Audit Matrix View */
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200">
                      <TableHead className="font-mono text-xs text-slate-700">Severity</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Category</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Recommendation Title</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Responsible staff</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700">Action Type</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700 text-right">Evidence Items</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700 text-right">Route & Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecommendations.map((rec) => (
                      <TableRow key={rec.rule} className="border-slate-100 hover:bg-slate-50/70">
                        <TableCell>
                          {rec.severity === 'HIGH' ? (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-mono font-bold">
                              HIGH
                            </Badge>
                          ) : rec.severity === 'MEDIUM' ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-mono font-bold">
                              MEDIUM
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] font-mono font-bold">
                              INFO
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">{rec.category}</TableCell>
                        <TableCell className="font-bold text-xs text-slate-900">{rec.title}</TableCell>
                        <TableCell className="text-xs text-slate-600">{rec.responsible_role || "MAO"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono text-slate-600 border-slate-200">
                            {rec.action_type || 'ADVISORY'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right font-bold text-amber-800">
                          {Object.keys(rec.evidence).length} points
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const routeInfo = getRecommendationRoute(rec);
                            return (
                              <div className="flex flex-col items-end gap-1">
                                <Button
                                  asChild
                                  size="sm"
                                  className="bg-[#0F5A38] hover:bg-[#0c482d] text-white font-bold text-xs h-7.5 px-3 rounded-lg shadow-2xs gap-1 shrink-0 active:scale-95 transition-all"
                                >
                                  <Link href={routeInfo.href}>
                                    <span>{routeInfo.label}</span>
                                    <ArrowRight className="size-3" />
                                  </Link>
                                </Button>
                                <code className="text-[10px] font-mono text-slate-400">
                                  {routeInfo.badge}
                                </code>
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* Futuristic Interactive Cards Feed */
              <div className="space-y-3">
                {filteredRecommendations.map((rec) => {
                  const isExpanded = expandedRule === rec.rule;
                  return (
                    <Card
                      key={rec.rule}
                      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:border-amber-300 transition-all"
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {rec.severity === 'HIGH' ? (
                                <Badge className="bg-rose-600 text-white font-bold text-xs flex items-center gap-1">
                                  <span className="size-1.5 rounded-full bg-white animate-pulse" />
                                  High Priority Action
                                </Badge>
                              ) : rec.severity === 'MEDIUM' ? (
                                <Badge className="bg-amber-500 text-white font-bold text-xs">
                                  Medium Priority
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-600 text-white font-bold text-xs">
                                  Informational
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px] font-mono border-slate-200 text-slate-500 uppercase tracking-wider">
                                {rec.category}
                              </Badge>
                              {rec.action_type && (
                                <span className="text-[11px] font-mono text-slate-400">
                                  Type: <strong className="text-slate-600">{rec.action_type}</strong>
                                </span>
                              )}
                            </div>

                            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                              {rec.title}
                            </h3>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              {rec.responsible_role && <span><strong>Responsible:</strong> {rec.responsible_role}</span>}
                              <Badge variant="outline" className="text-[10px]">{rec.source === 'forecast' ? 'Forecast-based planning' : 'Recorded-data review'}</Badge>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed pt-0.5">
                              {rec.recommendation}
                            </p>
                            {(() => {
                              const routeInfo = getRecommendationRoute(rec);
                              return (
                                <div className="mt-3 pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 p-2.5 sm:px-3 sm:py-2">
                                  <div className="flex items-center gap-1.5 text-xs text-slate-700 min-w-0">
                                    <span className="font-bold text-emerald-950 shrink-0">Action Route:</span>
                                    <code className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 font-mono text-[11px] text-emerald-900 font-bold truncate">
                                      {routeInfo.badge}
                                    </code>
                                  </div>
                                  <Button
                                    asChild
                                    size="sm"
                                    className="bg-[#0F5A38] hover:bg-[#0c482d] text-white font-bold text-xs h-8 px-3.5 rounded-xl shadow-xs gap-1.5 shrink-0 active:scale-95 hover:-translate-y-0.5 transition-all duration-150"
                                  >
                                    <Link href={routeInfo.href}>
                                      <span>{routeInfo.label}</span>
                                      <ArrowRight className="size-3.5" />
                                    </Link>
                                  </Button>
                                </div>
                              );
                            })()}
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(rec.rule)}
                            className="shrink-0 text-xs font-mono font-bold text-slate-700 hover:bg-slate-100 gap-1.5 self-start cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                <span>Hide Evidence</span>
                                <ChevronUp className="size-3.5" />
                              </>
                            ) : (
                              <>
                                <span>Inspect Evidence</span>
                                <ChevronDown className="size-3.5" />
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Expandable Supporting Evidence Drawer */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 bg-slate-50/70 p-3.5 rounded-xl">
                            <div>
                              <span className="text-xs font-bold text-slate-700">Trigger Audit Rationale:</span>
                              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{rec.reason}</p>
                            </div>

                            <div>
                              <span className="text-xs font-bold text-slate-700">Quantitative Observation Evidence:</span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                {Object.entries(rec.evidence).map(([key, val]) => (
                                  <div key={key} className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs shadow-2xs">
                                    <div className="text-[10px] uppercase font-mono font-bold text-slate-400 truncate">
                                      {key.replace(/_/g, ' ')}
                                    </div>
                                    <div className="font-mono font-extrabold text-slate-900 mt-0.5">
                                      {typeof val === 'number' ? val.toLocaleString('en-PH') : String(val)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* E. CALL TO ACTION FOR DECISION SUPPORT WORKSPACE                  */}
        {/* ----------------------------------------------------------------- */}
        <div className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1.5 text-center sm:text-left">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Need comprehensive rule parameters and municipal workflow integration?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Inspect the dedicated Decision Support workspace to review commodity-specific thresholds, trigger logs, and operational action paths.
            </p>
          </div>

          <Button asChild size="lg" className="bg-amber-700 hover:bg-amber-800 text-white font-bold shrink-0 gap-2 cursor-pointer">
            <Link href="/analysis/decision-support">
              <Workflow className="size-4.5" />
              <span>Launch Decision Support</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}

export default function PrescriptiveAnalyticsLandingPage() {
  return (
    <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-2xl bg-slate-100" />}>
      <PrescriptiveLandingContent />
    </Suspense>
  );
}
