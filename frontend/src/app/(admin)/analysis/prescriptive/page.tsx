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
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  FileCheck2,
  FileSpreadsheet,
  HelpCircle,
  Info,
  Layers,
  Lightbulb,
  ListFilter,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  Workflow,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';

interface RecommendationItem {
  rule: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  reason: string;
  evidence: Record<string, string | number>;
  recommendation: string;
  action_type: string;
}

interface PrescriptiveResponse {
  status: 'ready' | 'partial' | 'error';
  rule_readiness: {
    production: 'ready' | 'unavailable';
    disease: 'ready' | 'unavailable';
    vaccination_records: 'ready' | 'unavailable';
  };
  target: {
    production_type: string;
    unit: string;
  };
  total_recommendations: number;
  recommendations: RecommendationItem[];
}

export default function PrescriptiveAnalyticsLandingPage() {
  const { user } = useAuth();
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'PRODUCTION' | 'DISEASE' | 'VACCINATION'>('ALL');
  const [showTableView, setShowTableView] = useState(false);

  const { data, isPending: loading, isError, error, refetch, isFetching } = useQuery<PrescriptiveResponse>({
    queryKey: ['prescriptive-landing', user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: async ({ signal }) => {
      const res = await api.get<PrescriptiveResponse>('analytics/prescriptive/', { signal });
      return res.data;
    },
    staleTime: 60_000,
  });

  const allRecommendations = data?.recommendations ?? [];

  const filteredRecommendations = useMemo(() => {
    if (selectedCategory === 'ALL') return allRecommendations;
    return allRecommendations.filter((r) => r.category.toUpperCase() === selectedCategory);
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
        subtitle="Turn empirical evidence into practical administrative decisions and veterinary interventions for Padre Garcia"
        variant="admin"
        maxWidthClass="w-full"
        icon={<Lightbulb className="size-5 text-amber-800" />}
      />

      <div className="p-3 sm:p-4 md:p-6 w-full space-y-6 pb-20 sm:pb-8 max-w-7xl mx-auto">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: 'ALL' as const,
              label: 'All Active Triggers',
              category: 'Combined',
              status: `${allRecommendations.length} Triggers`,
              icon: Sparkles,
              badge: `${allRecommendations.length} Total`,
              ready: true,
            },
            {
              id: 'PRODUCTION' as const,
              label: 'Production Yield Deficits',
              category: 'Production',
              status: 'Yield & Feed Deficit',
              icon: Layers,
              badge: data?.rule_readiness.production === 'ready' ? 'Active' : 'Awaiting Data',
              ready: data?.rule_readiness.production === 'ready',
            },
            {
              id: 'DISEASE' as const,
              label: 'Biosecurity & Outbreaks',
              category: 'Health',
              status: 'Quarantine & Alert',
              icon: ShieldAlert,
              badge: data?.rule_readiness.disease === 'ready' ? 'Active' : 'Awaiting Data',
              ready: data?.rule_readiness.disease === 'ready',
            },
            {
              id: 'VACCINATION' as const,
              label: 'Herd Immunity Targets',
              category: 'Immunity',
              status: 'Coverage Target',
              icon: ShieldCheck,
              badge: data?.rule_readiness.vaccination_records === 'ready' ? 'Active' : 'Awaiting Data',
              ready: data?.rule_readiness.vaccination_records === 'ready',
            },
          ].map((card) => {
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
        {/* C. EXECUTIVE DECISION METRICS (4 Sleek Cards)                     */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-amber-300 transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                Active Recommendations
              </span>
              <div className="size-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
                <Lightbulb className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight">
                {allRecommendations.length}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                Quantitative threshold triggers evaluated
              </p>
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-rose-300 transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                High Priority Alerts
              </span>
              <div className="size-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-800">
                <ShieldAlert className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight">
                {highPriorityCount}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                Requires immediate veterinary / administrative action
              </p>
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-teal-300 transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                Medium Priority Triggers
              </span>
              <div className="size-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
                <Scale className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-mono font-extrabold text-slate-900 tracking-tight">
                {mediumPriorityCount}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                Operational improvements and farm-level alerts
              </p>
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-emerald-300 transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                Municipal Governance
              </span>
              <div className="size-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-mono font-extrabold text-emerald-800 tracking-tight">
                100% Advisory
              </div>
              <p className="mt-1 text-[11px] text-slate-500 leading-tight">
                Zero automated mutations; officer discretion enforced
              </p>
            </div>
          </Card>
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
                <h3 className="text-base font-bold text-slate-900">No Action Thresholds Currently Breached</h3>
                <p className="text-xs text-slate-600 max-w-md mt-1">
                  Current production yields, disease reports, and mortality rates are within normal operational baseline ranges in Padre Garcia.
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
                      <TableHead className="font-mono text-xs text-slate-700">Action Type</TableHead>
                      <TableHead className="font-mono text-xs text-slate-700 text-right">Evidence Items</TableHead>
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
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono text-slate-600 border-slate-200">
                            {rec.action_type || 'ADVISORY'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right font-bold text-amber-800">
                          {Object.keys(rec.evidence).length} points
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

                            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed pt-0.5">
                              {rec.recommendation}
                            </p>
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
