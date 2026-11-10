"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BrainCircuit,
  Bug,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GitBranch,
  HelpCircle,
  Info,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/axios";

export type CategoryValue =
  | "SUSPECTED_INFECTIOUS"
  | "INJURY_ACCIDENT"
  | "REPRODUCTIVE_PERINATAL"
  | "OTHER_REPORTED_CAUSE"
  | "UNDETERMINED";

interface Category {
  value: CategoryValue;
  label: string;
  count: number;
}

interface Prediction {
  category: CategoryValue;
  label: string;
  decision_path: { term: string; matched: boolean }[];
}

interface ClassificationRecord {
  id: number;
  record_date: string | null;
  cause: string;
  farmer_reported_illness: string | null;
  death_count: number;
  species: string;
  inspection_signs: string[];
  current_category: CategoryValue | null;
  current_category_label: string | null;
  prediction: Prediction | null;
  prediction_status: "SUGGESTION_AVAILABLE" | "NOT_ENOUGH_INFORMATION" | null;
}

interface ClassificationDashboard {
  model: string;
  readiness_status: string;
  readiness_message: string;
  training_record_count: number;
  minimum_training_records: number;
  minimum_records_per_category: number;
  categories: Category[];
  cross_validation: { method: string; macro_f1: number; fold_scores: number[] } | null;
  review_queue_count: number;
  unlabelled_record_count: number;
  review_queue_limit: number;
  review_queue: ClassificationRecord[];
}

const CATEGORY_STYLES: Record<
  CategoryValue,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dot: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  SUSPECTED_INFECTIOUS: {
    label: "Suspected infectious",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    badgeBorder: "border-rose-200",
    dot: "bg-rose-500",
    icon: Bug,
  },
  INJURY_ACCIDENT: {
    label: "Injury or accident",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-200",
    dot: "bg-amber-500",
    icon: AlertTriangle,
  },
  REPRODUCTIVE_PERINATAL: {
    label: "Reproductive or perinatal",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    badgeBorder: "border-purple-200",
    dot: "bg-purple-500",
    icon: Activity,
  },
  OTHER_REPORTED_CAUSE: {
    label: "Other reported cause",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-200",
    dot: "bg-blue-500",
    icon: AlertCircle,
  },
  UNDETERMINED: {
    label: "Undetermined",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-700",
    badgeBorder: "border-slate-200",
    dot: "bg-slate-400",
    icon: HelpCircle,
  },
};

function formatDecisionTerms(decisionPath: { term: string; matched: boolean }[]): string {
  const matched = decisionPath
    .filter((d) => d.matched)
    .map((d) => {
      const t = d.term;
      if (t.startsWith("species_")) return `Species: ${t.replace("species_", "")}`;
      if (t.startsWith("farmer_reported_sick_case_")) {
        return `Prior case: ${t.replace("farmer_reported_sick_case_", "")}`;
      }
      if (t === "linked_prior_farmer_illness_yes") return "Linked preceding illness";
      if (t.startsWith("death_count_")) {
        return `Scale: ${t.replace("death_count_", "").replace(/_/g, " ")}`;
      }
      if (t.startsWith("month_")) return "";
      return t;
    })
    .filter(Boolean);

  return matched.length > 0 ? matched.slice(0, 4).join(" · ") : "Matched general profile";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Undated";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Review Queue Card
// ─────────────────────────────────────────────────────────────────────────────
function ReviewRecordCard({
  record,
  categories,
}: {
  record: ClassificationRecord;
  categories: Category[];
}) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<CategoryValue | "">(
    record.current_category ?? record.prediction?.category ?? ""
  );
  const [note, setNote] = useState("");

  const reviewMutation = useMutation({
    mutationFn: async (targetCategory?: CategoryValue | void) => {
      const finalCategory = targetCategory || category;
      if (!finalCategory) throw new Error("No category selected");
      await api.post("analytics/mortality-classification/", {
        mortality_record_id: record.id,
        category: finalCategory,
        note,
      });
    },
    onSuccess: async () => {
      toast.success(`Report #${record.id} classification saved.`);
      await queryClient.invalidateQueries({ queryKey: ["mortality-cause-classification"] });
    },
    onError: () => toast.error("Classification was not saved. Please try again."),
  });

  const handleApplySuggestion = () => {
    if (record.prediction?.category) {
      setCategory(record.prediction.category);
      toast.info(`Selected "${record.prediction.label}". Click Save to confirm.`);
    }
  };

  const handleQuickConfirm = () => {
    if (record.prediction?.category) {
      setCategory(record.prediction.category);
      reviewMutation.mutate(record.prediction.category);
    }
  };

  const isReviewed = Boolean(record.current_category);
  const currentStyle = record.current_category ? CATEGORY_STYLES[record.current_category] : null;

  return (
    <article
      className={`rounded-xl border p-3 sm:p-3.5 transition-all ${
        isReviewed
          ? "border-slate-200/90 bg-white hover:border-slate-300"
          : "border-indigo-100 bg-white shadow-2xs hover:border-indigo-200 hover:shadow-xs"
      }`}
    >
      <div className="flex flex-col gap-2.5">
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
              #{record.id}
            </span>
            <span className="text-[11px] font-semibold text-slate-600">
              {formatDate(record.record_date)}
            </span>
            <span className="text-slate-300 font-bold">•</span>
            <Badge
              variant="outline"
              className="border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-700 px-1.5 py-0"
            >
              {record.species}
            </Badge>
            <span className="text-[11px] font-medium text-slate-500">
              {record.death_count} {record.death_count === 1 ? "casualty" : "casualties"}
            </span>
          </div>

          <div>
            {isReviewed ? (
              <Badge
                variant="outline"
                className={`text-[10px] font-bold px-2 py-0.5 flex items-center gap-1 ${
                  currentStyle
                    ? `${currentStyle.badgeBg} ${currentStyle.badgeText} ${currentStyle.badgeBorder}`
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
              >
                <Check className="size-2.5" />
                {record.current_category_label || "Categorized"}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1"
              >
                <Clock className="size-2.5 text-amber-600" />
                Needs Classification
              </Badge>
            )}
          </div>
        </div>

        {/* Cause of Death & Evidence */}
        <div className="space-y-1.5">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Reported Cause of Death
            </span>
            <p className="text-xs sm:text-[13px] font-semibold text-slate-900 leading-snug">
              &ldquo;{record.cause}&rdquo;
            </p>
          </div>

          {/* Clinical Pre-Death Context */}
          {(record.farmer_reported_illness || record.inspection_signs.length > 0) && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {record.farmer_reported_illness && (
                <div className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50/70 px-2 py-0.5 text-[11px] text-indigo-900 font-medium">
                  <Stethoscope className="size-3 text-indigo-600 shrink-0" />
                  <span>Prior Sick Case: <strong>{record.farmer_reported_illness}</strong></span>
                </div>
              )}
              {record.inspection_signs.length > 0 && (
                <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                  <ShieldAlert className="size-3 text-slate-400 shrink-0" />
                  <span>Observed Signs: {record.inspection_signs.join(", ")}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Recommendation Banner (Visible if suggestion available) */}
        {record.prediction && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-indigo-200/80 bg-linear-to-r from-indigo-50/90 to-purple-50/50 px-3 py-1.5 shadow-2xs">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11px] font-bold text-indigo-950">AI Recommendation:</span>
                <span className="text-[11px] font-black text-indigo-700 underline decoration-indigo-300 underline-offset-2">
                  {record.prediction.label}
                </span>
              </div>
              {record.prediction.decision_path.length > 0 && (
                <p className="text-[10px] text-indigo-800/80 truncate">
                  Key indicators: {formatDecisionTerms(record.prediction.decision_path)}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleApplySuggestion}
                className="h-7 px-2 border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-50 text-[11px] font-bold shadow-2xs cursor-pointer"
              >
                Apply
              </Button>
              {!isReviewed && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleQuickConfirm}
                  disabled={reviewMutation.isPending}
                  className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-2xs cursor-pointer"
                >
                  {reviewMutation.isPending ? "Saving…" : "Accept & Save"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Classification Actions Form */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 pt-1.5 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
            <div className="space-y-0.5">
              <Label
                htmlFor={`mortality-cat-${record.id}`}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Official Category
              </Label>
              <Select
                value={category || undefined}
                onValueChange={(val) => setCategory(val as CategoryValue)}
              >
                <SelectTrigger
                  id={`mortality-cat-${record.id}`}
                  className="h-8 text-xs font-semibold bg-slate-50 border-slate-200 focus:bg-white"
                >
                  <SelectValue placeholder="Choose confirmed category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => {
                    const style = CATEGORY_STYLES[c.value];
                    return (
                      <SelectItem key={c.value} value={c.value} className="text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className={`size-1.5 rounded-full ${style.dot}`} />
                          <span>{c.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-0.5">
              <Label
                htmlFor={`mortality-note-${record.id}`}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                Staff Note <span className="font-normal text-slate-400">(Optional)</span>
              </Label>
              <Input
                id={`mortality-note-${record.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                className="h-8 text-xs bg-slate-50 border-slate-200 focus:bg-white"
                placeholder="Reason or source remarks..."
              />
            </div>
          </div>

          <div className="self-end lg:self-center shrink-0 pt-1 lg:pt-3.5">
            <Button
              type="button"
              size="sm"
              onClick={() => reviewMutation.mutate()}
              disabled={!category || reviewMutation.isPending}
              className={`h-8 px-3 text-xs font-bold transition-all cursor-pointer ${
                isReviewed
                  ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  : "bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs"
              }`}
            >
              {reviewMutation.isPending ? (
                "Saving…"
              ) : isReviewed ? (
                "Update Label"
              ) : (
                <>
                  <Check className="size-3 mr-1" />
                  Save Classification
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Mortality Classification Panel
// ─────────────────────────────────────────────────────────────────────────────
export function MortalityClassificationPanel() {
  const [statusFilter, setStatusFilter] = useState<"NEEDS_REVIEW" | "ALL" | "REVIEWED">("NEEDS_REVIEW");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | CategoryValue>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const query = useQuery({
    queryKey: ["mortality-cause-classification"],
    queryFn: async ({ signal }) => {
      const response = await api.get<ClassificationDashboard>("analytics/mortality-classification/", {
        signal,
      });
      return response.data;
    },
    staleTime: 30_000,
  });

  const data = query.data;

  // Filtered Review Queue
  const filteredRecords = useMemo(() => {
    if (!data?.review_queue) return [];
    return data.review_queue.filter((r) => {
      // 1. Status Filter
      if (statusFilter === "NEEDS_REVIEW" && r.current_category) return false;
      if (statusFilter === "REVIEWED" && !r.current_category) return false;

      // 2. Category Filter
      if (categoryFilter !== "ALL") {
        const matchesCategory =
          r.current_category === categoryFilter ||
          (!r.current_category && r.prediction?.category === categoryFilter);
        if (!matchesCategory) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = String(r.id).includes(q);
        const matchCause = (r.cause || "").toLowerCase().includes(q);
        const matchSpecies = (r.species || "").toLowerCase().includes(q);
        const matchIllness = (r.farmer_reported_illness || "").toLowerCase().includes(q);
        if (!matchId && !matchCause && !matchSpecies && !matchIllness) {
          return false;
        }
      }

      return true;
    });
  }, [data?.review_queue, statusFilter, categoryFilter, searchQuery]);

  // Reset to page 1 on filter or search change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  return (
    <div className="space-y-3">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. Header & Advisory Note (Clean, single container)                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
              <BrainCircuit className="size-4 text-purple-600" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Mortality Cause Classification
            </h3>
          </div>
          <p className="text-[11px] text-slate-600 max-w-2xl">
            Classify approved mortality records into standardized categories using explainable Decision Tree suggestions.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-center px-2.5 py-1 rounded-lg border border-amber-200/80 bg-amber-50/80 text-[10px] font-semibold text-amber-900 shadow-2xs">
          <Info className="size-3 text-amber-700 shrink-0" />
          <span>Decision support only • Human verified</span>
        </div>
      </div>

      {query.isPending && (
        <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-white">
          <p className="text-sm font-semibold text-slate-500 animate-pulse">
            Loading mortality classification queue…
          </p>
        </div>
      )}

      {query.isError && (
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold">
          Could not load the mortality classification workspace. Please check your permissions or refresh.
        </div>
      )}

      {data && (
        <>
          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 2. Key Metrics Bar (High-Level Summary)                           */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Metric 1: Pending */}
            <div className="rounded-xl border border-amber-200/80 bg-linear-to-b from-amber-50/60 to-white px-3 py-2 shadow-2xs space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Needs Review
                </span>
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              </div>
              <p className="text-lg font-black text-amber-950 tabular-nums">
                {data.unlabelled_record_count}
              </p>
              <p className="text-[10px] text-amber-700/90 font-medium truncate">
                Approved reports awaiting classification
              </p>
            </div>

            {/* Metric 2: Labeled */}
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-2xs space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Labeled Records
                </span>
                <CheckCircle2 className="size-3 text-emerald-600" />
              </div>
              <p className="text-lg font-black text-slate-900 tabular-nums">
                {data.training_record_count}
              </p>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                Verified training ground truth
              </p>
            </div>

            {/* Metric 3: AI Model */}
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-2xs space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Model Engine
                </span>
                <GitBranch className="size-3 text-indigo-600" />
              </div>
              <p className="text-sm font-black text-slate-900 mt-0.5">
                Decision Tree
              </p>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                Interpretable rule-based suggestions
              </p>
            </div>

            {/* Metric 4: Cross-Validation Accuracy */}
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-2xs space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Cross-Validation F1
                </span>
                <Activity className="size-3 text-emerald-600" />
              </div>
              <p className="text-lg font-black text-emerald-800 tabular-nums">
                {data.cross_validation
                  ? `${(data.cross_validation.macro_f1 * 100).toFixed(1)}%`
                  : "Ready"}
              </p>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                5-fold stratified validation score
              </p>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 3. Interactive Category Filter Chips                              */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-0.5">
              <span>Category Distribution</span>
              {categoryFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter("ALL")}
                  className="text-emerald-700 hover:text-emerald-800 text-[10px] font-bold cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setCategoryFilter("ALL")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                  categoryFilter === "ALL"
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>All Categories</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                  categoryFilter === "ALL" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {data.categories.reduce((acc, c) => acc + c.count, 0)}
                </span>
              </button>

              {data.categories.map((cat) => {
                const style = CATEGORY_STYLES[cat.value];
                const isSelected = categoryFilter === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategoryFilter(isSelected ? "ALL" : cat.value)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                        : `${style.badgeBg} ${style.badgeText} ${style.badgeBorder} hover:brightness-95`
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${isSelected ? "bg-white" : style.dot}`} />
                    <span>{cat.label}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? "bg-white/20 text-white" : "bg-white/60 text-slate-700"
                    }`}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 4. Queue Filter Toolbar & Search                                 */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            {/* Status Pills */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/70">
              <button
                type="button"
                onClick={() => setStatusFilter("NEEDS_REVIEW")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "NEEDS_REVIEW"
                    ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Clock className="size-3 text-amber-600" />
                <span>Needs Review ({data.unlabelled_record_count})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>All ({data.review_queue.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("REVIEWED")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "REVIEWED"
                    ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Check className="size-3 text-emerald-600" />
                <span>Labeled ({data.review_queue.filter((r) => r.current_category).length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
              <Input
                type="text"
                placeholder="Search report #, cause..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-7.5 pr-7 text-xs bg-white border-slate-200 rounded-lg"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 5. Review Cards Queue                                             */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 font-medium px-0.5">
              <div className="flex items-center gap-2">
                <span>
                  Showing{" "}
                  <strong className="text-slate-900 font-bold">
                    {filteredRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, filteredRecords.length)}
                  </strong>{" "}
                  of <strong className="text-slate-900 font-bold">{filteredRecords.length}</strong> reports
                  {filteredRecords.length !== data.review_queue.length && (
                    <span className="text-slate-400 ml-1">({data.review_queue.length} in queue)</span>
                  )}
                </span>

                <span className="text-slate-300">•</span>

                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-400">Per page:</span>
                  {[5, 10, 20].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setPageSize(sz)}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                        pageSize === sz
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {(statusFilter !== "NEEDS_REVIEW" || categoryFilter !== "ALL" || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("NEEDS_REVIEW");
                    setCategoryFilter("ALL");
                    setSearchQuery("");
                  }}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 text-xs font-bold cursor-pointer self-start sm:self-auto"
                >
                  <RotateCcw className="size-3" />
                  Reset filters
                </button>
              )}
            </div>

            {paginatedRecords.length > 0 ? (
              <div className="space-y-3">
                {paginatedRecords.map((record) => (
                  <ReviewRecordCard
                    key={record.id}
                    record={record}
                    categories={data.categories}
                  />
                ))}

                {/* Bottom Pagination Bar */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                      Page <strong className="text-slate-800 font-semibold">{currentPage}</strong> of{" "}
                      <strong className="text-slate-800 font-semibold">{totalPages}</strong>
                    </p>

                    <div className="flex items-center gap-1.5 self-center sm:self-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-2.5 text-xs font-semibold border-slate-200 bg-white cursor-pointer"
                      >
                        <ChevronLeft className="size-3.5 mr-1" />
                        Previous
                      </Button>

                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalPages }).map((_, idx) => {
                          const pageNum = idx + 1;
                          if (
                            totalPages > 6 &&
                            Math.abs(pageNum - currentPage) > 1 &&
                            pageNum !== 1 &&
                            pageNum !== totalPages
                          ) {
                            if (pageNum === 2 || pageNum === totalPages - 1) {
                              return (
                                <span key={pageNum} className="text-xs text-slate-400 px-0.5">
                                  …
                                </span>
                              );
                            }
                            return null;
                          }

                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setCurrentPage(pageNum)}
                              className={`size-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                currentPage === pageNum
                                  ? "bg-slate-900 text-white shadow-2xs font-extrabold"
                                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2.5 text-xs font-semibold border-slate-200 bg-white cursor-pointer"
                      >
                        Next
                        <ChevronRight className="size-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-white space-y-2">
                <CheckCircle2 className="size-8 text-emerald-600 mx-auto stroke-[1.5]" />
                <p className="text-sm font-bold text-slate-800">
                  {statusFilter === "NEEDS_REVIEW"
                    ? "No pending mortality reports to classify!"
                    : "No mortality reports match your filter criteria."}
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {statusFilter === "NEEDS_REVIEW"
                    ? "All eligible mortality reports in this active batch have been categorized."
                    : "Try adjusting your search terms or category filter above."}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
