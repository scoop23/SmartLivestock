"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileCheck2,
  Info,
  Lightbulb,
  ListFilter,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  UserCheck,
  Workflow,
} from "lucide-react";

export type RecommendationCategory =
  | "ALL"
  | "DISEASE"
  | "MORTALITY"
  | "AUCTION"
  | "SLAUGHTER"
  | "PRICE"
  | "DATA_QUALITY"
  | "VACCINATION";

export type SeverityFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";

export interface RecommendationItem {
  rule: string;
  category: string;
  category_key?: RecommendationCategory;
  responsible_role?: string;
  source?: string;
  action_link?: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  reason: string;
  evidence: Record<string, string | number>;
  recommendation: string;
  action_type: string;
}

export interface PrescriptiveResponse {
  status: "ready" | "partial" | "error";
  rule_readiness?: {
    production?: "ready" | "unavailable";
    disease?: "ready" | "unavailable";
    vaccination_records?: "ready" | "unavailable";
  };
  target?: {
    production_type?: string;
    unit?: string;
  };
  forecast_status?: string;
  is_seeded?: boolean;
  total_recommendations: number;
  recommendations: RecommendationItem[];
}

function getSmartActionLink(rec: RecommendationItem): { href: string; label: string } {
  if (rec.action_link) {
    if (rec.action_link.includes("predictive")) {
      return { href: rec.action_link, label: "View Predictive Forecast" };
    }
    return { href: rec.action_link, label: "Open Supporting View" };
  }

  const cat = (rec.category_key || rec.category || "").toUpperCase();
  const rule = rec.rule.toUpperCase();

  if (cat.includes("DISEASE") || rule.includes("DISEASE")) {
    return { href: "/disease-mortality", label: "Review Health Incidents" };
  }
  if (cat.includes("MORTALITY") || rule.includes("MORTALITY")) {
    return { href: "/disease-mortality", label: "Review Mortality Records" };
  }
  if (cat.includes("AUCTION") || rule.includes("AUCTION") || rule.includes("SALES")) {
    return { href: "/auction-ownership-transfers/registry", label: "Inspect Transfer Registry" };
  }
  if (cat.includes("PRICE") || rule.includes("PRICE")) {
    return { href: "/analysis/predictive?domain=auction", label: "Check Price Forecast" };
  }
  if (cat.includes("SLAUGHTER") || rule.includes("SLAUGHTER")) {
    return { href: "/analysis/predictive?domain=slaughter", label: "Inspect Slaughter Forecast" };
  }
  if (cat.includes("VACCINATION") || rule.includes("VACCINATION")) {
    return { href: "/gis", label: "Check Barangay Coverage Map" };
  }
  if (cat.includes("DATA") || rule.includes("QUALITY") || rule.includes("READINESS")) {
    return { href: "/data-validation", label: "Review Pending Submissions" };
  }
  return { href: "/analysis/surveillance-health", label: "Surveillance & Health Overview" };
}

export default function PrescriptiveAnalyticsView() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const domainParam = searchParams?.get("domain");

  const initialCategory = useMemo<RecommendationCategory>(() => {
    if (!domainParam) return "ALL";
    const d = domainParam.toLowerCase();
    if (d === "disease") return "DISEASE";
    if (d === "mortality") return "MORTALITY";
    if (d === "auction" || d === "sales") return "AUCTION";
    if (d === "slaughter") return "SLAUGHTER";
    if (d === "price" || d === "cattle-price") return "PRICE";
    if (d === "inventory" || d === "barangay" || d === "vaccination") return "VACCINATION";
    return "ALL";
  }, [domainParam]);

  const [selectedCategory, setSelectedCategory] = useState<RecommendationCategory>(initialCategory);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [showTableView, setShowTableView] = useState<boolean>(false);

  const { data, isPending: loading, isError, refetch, isFetching } = useQuery<PrescriptiveResponse>({
    queryKey: ["prescriptive-decision-workspace", user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: async ({ signal }) => {
      const res = await api.get<PrescriptiveResponse>("analytics/prescriptive/", { signal, timeout: 180_000 });
      return res.data;
    },
    staleTime: 60_000,
  });

  const allRecommendations = useMemo(() => data?.recommendations ?? [], [data]);

  const highPriorityCount = useMemo(
    () => allRecommendations.filter((r) => r.severity === "HIGH").length,
    [allRecommendations]
  );
  const mediumPriorityCount = useMemo(
    () => allRecommendations.filter((r) => r.severity === "MEDIUM").length,
    [allRecommendations]
  );

  const toggleExpand = (ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const filteredRecommendations = useMemo(() => {
    return allRecommendations.filter((rec) => {
      // Category filter
      if (selectedCategory !== "ALL") {
        const itemCat = rec.category_key || (
          rec.rule.includes("DISEASE")
            ? "DISEASE"
            : rec.rule.includes("MORTALITY")
            ? "MORTALITY"
            : rec.rule.includes("VACCINATION")
            ? "VACCINATION"
            : rec.rule.includes("AUCTION")
            ? "AUCTION"
            : rec.rule.includes("SLAUGHTER")
            ? "SLAUGHTER"
            : rec.rule.includes("PRICE")
            ? "PRICE"
            : "DATA_QUALITY"
        );
        if (itemCat !== selectedCategory) return false;
      }

      // Severity filter
      if (severityFilter !== "ALL" && rec.severity !== severityFilter) {
        return false;
      }

      // Keyword Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = rec.title.toLowerCase().includes(query);
        const matchesReason = rec.reason.toLowerCase().includes(query);
        const matchesRule = rec.rule.toLowerCase().includes(query);
        const matchesCategory = rec.category.toLowerCase().includes(query);
        const matchesRecommendation = rec.recommendation.toLowerCase().includes(query);
        if (!matchesTitle && !matchesReason && !matchesRule && !matchesCategory && !matchesRecommendation) {
          return false;
        }
      }

      return true;
    });
  }, [allRecommendations, selectedCategory, severityFilter, searchQuery]);

  const categoryItems: Array<{
    id: RecommendationCategory;
    label: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "ALL", label: "All Operations", subtitle: "All Rule Triggers", icon: Sparkles },
    { id: "DISEASE", label: "Disease Surveillance", subtitle: "Health Reports", icon: ShieldAlert },
    { id: "MORTALITY", label: "Mortality Follow-up", subtitle: "Recorded Deaths", icon: AlertTriangle },
    { id: "AUCTION", label: "Auction Operations", subtitle: "Transfer Volumes", icon: Workflow },
    { id: "SLAUGHTER", label: "Slaughterhouse", subtitle: "Carcass Inspection", icon: Scale },
    { id: "PRICE", label: "Cattle Prices", subtitle: "Market Rates", icon: Scale },
    { id: "VACCINATION", label: "Preventive Care", subtitle: "Vaccine Coverage", icon: ShieldCheck },
    { id: "DATA_QUALITY", label: "Model Readiness", subtitle: "Data Follow-up", icon: FileCheck2 },
  ];

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* 1. EXECUTIVE COMMAND BANNER                                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/50 p-5 sm:p-6 shadow-2xs">
        {/* Ambient atmospheric glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 size-80 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-amber-900">
                <Workflow className="size-3.5 text-amber-700 animate-pulse" />
                MUNICIPAL DECISION SUPPORT WORKSPACE
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-600 font-medium">Padre Garcia Batangas</span>
              <span className="text-slate-300">•</span>
              <Badge variant="outline" className="bg-amber-100/70 text-amber-900 border-amber-300 text-[10px] font-mono font-bold">
                Deterministic Advisory Rules
              </Badge>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
              Operations Action Queue &amp; Guidance
              <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[11px] font-mono font-bold">
                Live Protocols
              </Badge>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Continuous municipal rule evaluation translating verified registrations, mortality records, auction volumes, and predictive forecasts into prioritized administrative follow-up.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer"
            >
              <Link href="/analysis/prescriptive">
                <Lightbulb className="size-3.5 mr-1.5 text-amber-600" />
                Rule Intelligence
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${isFetching ? "animate-spin text-amber-600" : "text-slate-500"}`} />
              Re-evaluate
            </Button>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. OPERATIONAL SCOREBOARD RIBBON                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Evaluated Decision Telemetry • Municipal Metric Readout
          </span>
          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
            Non-interactive Summary
          </span>
        </div>

        <div className="rounded-2xl border border-slate-700/80 bg-slate-800/90 text-slate-100 divide-y sm:divide-y-0 sm:divide-x divide-slate-700/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 select-none cursor-default overflow-hidden shadow-xs backdrop-blur-xs">
          {/* Card 1: Total Queue */}
          <div className="p-4 bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="size-2 rounded-full bg-amber-400 shrink-0 shadow-xs" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 truncate">
                Active Operations Queue
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl sm:text-3xl font-mono font-black text-white tracking-tight">
                {allRecommendations.length}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">
                Quantitative advisory triggers tripped
              </p>
            </div>
          </div>

          {/* Card 2: High Priority */}
          <div className="p-4 bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="size-2 rounded-full bg-rose-400 shrink-0 shadow-xs animate-pulse" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 truncate">
                Immediate Escalations
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl sm:text-3xl font-mono font-black text-rose-400 tracking-tight">
                {highPriorityCount}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">
                Requires immediate on-site veterinary action
              </p>
            </div>
          </div>

          {/* Card 3: Medium Priority */}
          <div className="p-4 bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="size-2 rounded-full bg-amber-400 shrink-0 shadow-xs" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 truncate">
                Operational Follow-ups
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl sm:text-3xl font-mono font-black text-amber-300 tracking-tight">
                {mediumPriorityCount}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">
                Vaccination &amp; market oversight advisories
              </p>
            </div>
          </div>

          {/* Card 4: Governance */}
          <div className="p-4 bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="size-2 rounded-full bg-emerald-400 shrink-0 shadow-xs" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 truncate">
                Officer Discretion
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 tracking-tight">
                100% Advisory
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400 leading-tight">
                Zero automated edits; officer sign-off required
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. DEPARTMENTAL DOMAIN CATEGORY CARDS                             */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
        {categoryItems.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const Icon = cat.icon;
          const count =
            cat.id === "ALL"
              ? allRecommendations.length
              : allRecommendations.filter((r) => {
                  const itemKey =
                    r.category_key ||
                    (r.rule.includes("DISEASE")
                      ? "DISEASE"
                      : r.rule.includes("MORTALITY")
                      ? "MORTALITY"
                      : r.rule.includes("VACCINATION")
                      ? "VACCINATION"
                      : r.rule.includes("AUCTION")
                      ? "AUCTION"
                      : r.rule.includes("SLAUGHTER")
                      ? "SLAUGHTER"
                      : r.rule.includes("PRICE")
                      ? "PRICE"
                      : "DATA_QUALITY");
                  return itemKey === cat.id;
                }).length;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`group relative flex flex-col justify-between rounded-xl p-3 text-left transition-all duration-200 border cursor-pointer ${
                isSelected
                  ? "border-2 border-amber-600 bg-amber-50/80 shadow-xs ring-2 ring-amber-500/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <div
                  className={`flex size-7.5 items-center justify-center rounded-lg transition-colors ${
                    isSelected ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                  }`}
                >
                  <Icon className="size-4" />
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono font-bold px-1.5 py-0 ${
                    count > 0 ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold" : "bg-slate-50 text-slate-400 border-slate-200"
                  }`}
                >
                  {count}
                </Badge>
              </div>

              <div className="mt-2 min-w-0">
                <p
                  className={`text-xs font-bold leading-tight truncate ${
                    isSelected ? "text-amber-950 font-black" : "text-slate-800 group-hover:text-slate-900"
                  }`}
                  title={cat.label}
                >
                  {cat.label}
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{cat.subtitle}</p>
              </div>

              {isSelected && <div className="absolute -bottom-px left-3 right-3 h-0.5 bg-amber-600 rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 4. WORKSPACE CONTROLS & FILTER BAR                                */}
      {/* ----------------------------------------------------------------- */}
      <Card className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search action titles, rules, barangays, or reasons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus-visible:bg-white transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Severity Filter Buttons */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Severity Filter">
              {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    severityFilter === sev
                      ? sev === "HIGH"
                        ? "bg-rose-600 text-white font-bold shadow-2xs"
                        : sev === "MEDIUM"
                        ? "bg-amber-600 text-white font-bold shadow-2xs"
                        : sev === "LOW"
                        ? "bg-sky-600 text-white font-bold shadow-2xs"
                        : "bg-slate-900 text-white font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                  }`}
                >
                  {sev === "ALL" ? "All Priorities" : sev === "HIGH" ? "High" : sev === "MEDIUM" ? "Medium" : "Info"}
                </button>
              ))}
            </div>

            {/* Layout Switcher */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTableView((prev) => !prev)}
              className="h-9 border-slate-200 bg-white text-xs font-mono text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
            >
              {showTableView ? (
                <>
                  <ListFilter className="size-3.5 mr-1.5 text-amber-600" />
                  Cards Feed
                </>
              ) : (
                <>
                  <TableIcon className="size-3.5 mr-1.5 text-amber-600" />
                  Audit Table
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* 5. MAIN OPERATIONS QUEUE / TABLE VIEW                             */}
      {/* ----------------------------------------------------------------- */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-36 rounded-2xl bg-white border border-slate-200" />
          <Skeleton className="h-36 rounded-2xl bg-white border border-slate-200" />
          <Skeleton className="h-36 rounded-2xl bg-white border border-slate-200" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-rose-200 rounded-2xl bg-rose-50/60">
          <AlertCircle className="size-8 text-rose-500 mb-2" />
          <h3 className="text-base font-bold text-slate-900">Unable to load decision support recommendations</h3>
          <p className="text-xs text-slate-600 max-w-md mt-1">
            The municipal rule evaluation service is currently unavailable. Please refresh or try again shortly.
          </p>
          <Button onClick={() => void refetch()} size="sm" className="mt-3 bg-amber-700 text-white font-bold text-xs cursor-pointer">
            Retry Evaluation
          </Button>
        </div>
      ) : filteredRecommendations.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-200 rounded-2xl bg-white shadow-2xs">
          <CheckCircle2 className="size-8 text-emerald-600 mb-2" />
          <h3 className="text-base font-bold text-slate-900">No active operations matching current filters</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1">
            No threshold triggers tripped for this category and filter combination. Current records are within standard parameters.
          </p>
          {(selectedCategory !== "ALL" || severityFilter !== "ALL" || searchQuery) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedCategory("ALL");
                setSeverityFilter("ALL");
                setSearchQuery("");
              }}
              className="mt-3 text-xs font-semibold cursor-pointer"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : showTableView ? (
        /* Tabular Audit Matrix View */
        <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm sm:text-base font-bold text-slate-900">
                  Municipal Decision Audit Matrix ({filteredRecommendations.length} Operations)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Comprehensive spreadsheet-style view of triggered threshold rules and staff action assignments.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-200">
                  <TableHead className="font-mono text-xs text-slate-700">Priority</TableHead>
                  <TableHead className="font-mono text-xs text-slate-700">Domain</TableHead>
                  <TableHead className="font-mono text-xs text-slate-700">Action Title &amp; Directive</TableHead>
                  <TableHead className="font-mono text-xs text-slate-700">Assigned Staff</TableHead>
                  <TableHead className="font-mono text-xs text-slate-700">Action Type</TableHead>
                  <TableHead className="font-mono text-xs text-slate-700 text-right">Evidence Points</TableHead>
                  <TableHead className="font-mono text-xs text-slate-700 text-right">Execute</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecommendations.map((rec) => {
                  const actionLink = getSmartActionLink(rec);
                  return (
                    <TableRow key={rec.rule} className="border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <TableCell>
                        {rec.severity === "HIGH" ? (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] font-mono font-bold">
                            HIGH
                          </Badge>
                        ) : rec.severity === "MEDIUM" ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-mono font-bold">
                            MEDIUM
                          </Badge>
                        ) : (
                          <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-[10px] font-mono font-bold">
                            INFO
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">{rec.category}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-bold text-xs text-slate-900">{rec.title}</p>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{rec.recommendation}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 font-medium whitespace-nowrap">
                        {rec.responsible_role || "MAO Officer"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono text-slate-600 border-slate-200">
                          {rec.action_type || "ADVISORY"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right font-bold text-slate-700">
                        {Object.keys(rec.evidence || {}).length}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-emerald-800 hover:text-emerald-900 font-bold gap-1 cursor-pointer">
                          <Link href={actionLink.href}>
                            Action <ArrowRight className="size-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* Cards Feed View */
        <div className="space-y-4">
          {filteredRecommendations.map((rec) => {
            const isExpanded = expandedRules.has(rec.rule);
            const actionLink = getSmartActionLink(rec);
            const evidenceEntries = Object.entries(rec.evidence || {});

            return (
              <Card
                key={rec.rule}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200"
              >
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Card Header Ribbon */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {rec.severity === "HIGH" ? (
                          <Badge className="bg-rose-50 text-rose-800 border border-rose-200/90 font-bold text-xs inline-flex items-center gap-1.5 px-2.5 py-0.5 shadow-2xs">
                            <span className="size-1.5 rounded-full bg-rose-600 shrink-0" />
                            High Priority Directive
                          </Badge>
                        ) : rec.severity === "MEDIUM" ? (
                          <Badge className="bg-amber-50 text-amber-800 border border-amber-200/90 font-bold text-xs inline-flex items-center gap-1.5 px-2.5 py-0.5 shadow-2xs">
                            <span className="size-1.5 rounded-full bg-amber-600 shrink-0" />
                            Medium Priority Advisory
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs inline-flex items-center gap-1.5 px-2.5 py-0.5 shadow-2xs">
                            <span className="size-1.5 rounded-full bg-slate-500 shrink-0" />
                            Informational Notice
                          </Badge>
                        )}

                        <Badge variant="outline" className="text-[10px] font-mono border-slate-200 text-slate-600 uppercase tracking-wider bg-slate-50">
                          {rec.category}
                        </Badge>

                        {rec.action_type && (
                          <span className="text-[11px] font-mono text-slate-500">
                            Protocol: <strong className="text-slate-700">{rec.action_type}</strong>
                          </span>
                        )}
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-1">
                        {rec.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-0.5">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          <UserCheck className="size-3.5 text-emerald-700" />
                          <span>Responsible: <strong className="text-slate-900">{rec.responsible_role || "MAO Officer"}</strong></span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono text-[11px]">
                          Source: {rec.source === "forecast" ? "Evaluated Predictive Model" : "Verified Registration Data"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start shrink-0">
                      <Badge variant="outline" className="font-mono text-[10px] text-slate-500 bg-slate-50 border-slate-200">
                        Rule: {rec.rule}
                      </Badge>
                    </div>
                  </div>

                  {/* Recommendation Directive Callout */}
                  <div className="rounded-xl border border-emerald-200/90 bg-[#F4F8F5] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="size-8 rounded-lg bg-[#1E4D2B] text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                        <CheckCircle2 className="size-4.5 stroke-[2.5]" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                          Municipal Action Directive:
                        </span>
                        <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-semibold">
                          {rec.recommendation}
                        </p>
                      </div>
                    </div>

                    <Button asChild size="sm" className="bg-[#1E4D2B] hover:bg-[#163b21] text-white text-xs font-bold shrink-0 gap-1.5 shadow-2xs cursor-pointer rounded-xl h-9 px-4">
                      <Link href={actionLink.href}>
                        <span>{actionLink.label}</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>

                  {/* Quick Evidence Chips (Always Visible) */}
                  {evidenceEntries.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Eye className="size-3.5 text-indigo-600" />
                        Trigger Evidence Summary:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {evidenceEntries.slice(0, 4).map(([key, val]) => (
                          <div key={key} className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-2.5 shadow-2xs">
                            <span className="text-[10px] font-mono uppercase text-slate-400 block truncate">
                              {key.replace(/_/g, " ")}
                            </span>
                            <span className="font-mono font-extrabold text-xs text-slate-900 mt-0.5 block truncate">
                              {typeof val === "number" ? val.toLocaleString("en-PH") : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expand/Collapse Rationale & Complete Audit Evidence */}
                  <div className="pt-1 flex items-center justify-between border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => toggleExpand(rec.rule)}
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="size-3.5 text-amber-700" />
                          <span>Hide Rationale &amp; Complete Evidence</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-3.5 text-amber-700" />
                          <span>Inspect Rationale &amp; All {evidenceEntries.length} Evidence Parameters</span>
                        </>
                      )}
                    </button>

                    <span className="text-[11px] font-mono text-slate-400">
                      Advisory Notice • Municipal Discretion
                    </span>
                  </div>

                  {/* Collapsible Drawer */}
                  {isExpanded && (
                    <div className="rounded-xl bg-slate-50/90 border border-slate-200 p-4 space-y-3 animate-in fade-in duration-200">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Trigger Audit Rationale:</span>
                        <p className="text-xs text-slate-700 mt-1 leading-relaxed">{rec.reason}</p>
                      </div>

                      {evidenceEntries.length > 4 && (
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">Additional Evidence Parameters:</span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                            {evidenceEntries.slice(4).map(([key, val]) => (
                              <div key={key} className="rounded-lg bg-white border border-slate-200 p-2 shadow-2xs">
                                <span className="text-[10px] font-mono uppercase text-slate-400 block truncate">
                                  {key.replace(/_/g, " ")}
                                </span>
                                <span className="font-mono font-bold text-xs text-slate-900 mt-0.5 block truncate">
                                  {typeof val === "number" ? val.toLocaleString("en-PH") : String(val)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 6. MUNICIPAL GOVERNANCE & SOPS NOTICE                             */}
      {/* ----------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600 space-y-2 shadow-2xs">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-emerald-700 shrink-0" />
          <h4 className="font-bold text-slate-900 text-sm">
            Standard Operating Procedures (SOP) &amp; Decision Governance
          </h4>
        </div>
        <p className="leading-relaxed">
          All recommendations in this Decision Support Workspace are produced by deterministic, verifiable rule thresholds under Philippine Department of Agriculture (DA) guidelines and Padre Garcia Municipal Biosecurity protocols. The system assists agricultural officers and inspectors in scheduling follow-up; it does not replace statutory physical inspections, laboratory testing, or formal veterinary diagnosis.
        </p>
      </div>
    </div>
  );
}
