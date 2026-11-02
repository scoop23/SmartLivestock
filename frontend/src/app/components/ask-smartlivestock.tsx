"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ResultRow = Record<string, string | number | null>;
type Visualization = {
  type: "kpi" | "bar" | "line" | "table";
  x_key: string | null;
  y_key: string | null;
  series_key?: string;
  label?: string;
  columns: { key: string; label: string }[];
};
type AskResponse = {
  status: "answered" | "clarification" | "unsupported" | "not_found" | "ambiguous" | "restricted";
  question: string;
  intent?: string;
  answer: string;
  interpreted?: {
    metric: string;
    group_by: string | null;
    filters: {
      barangay: string | null;
      livestock_type: string | null;
      production_type: string | null;
      farmer: string | null;
      approval_status: string | null;
    };
  };
  period?: { start: string; end: string; label: string } | null;
  visualization?: Visualization | null;
  results: ResultRow[];
  coverage_note?: string;
  suggestions?: { label: string; question: string }[];
  ai_explanation?: {
    status: "generated" | "unavailable" | "not_applicable";
    provider?: string;
    model?: string;
    prompt_version?: string;
    text: string | null;
    message?: string;
  };
  ai_interpretation?: {
    status: "used" | "rules_fallback" | "skipped" | "clarification" | "unsupported" | "unavailable";
    message: string;
  };
};

const EXAMPLES = [
  "How many approved active livestock heads are recorded across all species?",
  "Show approved active livestock heads by species.",
  "How many cattle are currently registered?",
  "Which barangays reported the most cattle diseases this quarter?",
  "Compare cattle mortality across barangays this quarter.",
  "Which submissions are waiting for MAO approval?",
  "Ilang baka ang registered ngayon?",
  "How many cattle does Farmer Juan Dela Cruz have?",
  "Ilan ang baka ni Farmer Juan Dela Cruz?",
];
const SPECIES_COLORS = [
  "#10b981", // Emerald Neon
  "#06b6d4", // Cyber Cyan
  "#3b82f6", // Electric Blue
  "#f59e0b", // Amber Glow
  "#8b5cf6", // Purple Pulse
  "#ec4899", // Laser Pink
  "#64748b", // Slate
];

const numberFormat = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

function displayValue(value: string | number | null | undefined) {
  return typeof value === "number" ? numberFormat.format(value) : value ?? "—";
}

function resultChartRows(response: AskResponse) {
  // Pivot server rows into chart series. Missing periods remain absent,
  // rather than being invented as zero values in the browser.
  const visualization = response.visualization;
  if (!visualization?.x_key || !visualization.y_key || !visualization.series_key) return response.results;
  const grouped = new Map<string, ResultRow>();
  for (const row of response.results) {
    const category = String(row[visualization.x_key] ?? "");
    const series = String(row[visualization.series_key] ?? "Other");
    const current = grouped.get(category) ?? { [visualization.x_key]: category };
    current[series] = row[visualization.y_key];
    grouped.set(category, current);
  }
  return [...grouped.values()];
}

// Futuristic High-Tech Tooltip
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AskHudTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-emerald-500/40 bg-slate-950/95 p-3 text-xs text-white shadow-2xl backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">{label}</span>
        <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-400">TELEMETRY</span>
      </div>
      <div className="space-y-1">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((item: any) => {
          if (item.value == null) return null;
          return (
            <div key={item.name} className="flex items-center justify-between gap-4 font-mono">
              <span className="text-[11px] text-slate-300">{item.name}:</span>
              <span className="text-xs font-black text-emerald-300">{displayValue(item.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultVisualization({ response }: { response: AskResponse }) {
  // The backend selects the presentation and supplies the real values.
  // The browser formats them; it does not calculate official analytics.
  const visualization = response.visualization;
  if (!visualization || !response.results.length) {
    return (
      <div className="relative flex min-h-36 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <Search className="size-6 text-slate-400" aria-hidden="true" />
        </div>
        <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-800">No Matching Telemetry</h3>
        <p className="max-w-sm text-xs font-medium leading-relaxed text-slate-500">
          This does not indicate zero activity; submissions may still be pending review or filters may be too narrow.
        </p>
      </div>
    );
  }

  const columns = visualization.columns;
  const rows = response.results;
  const yKey = visualization.y_key;
  const xKey = visualization.x_key;
  const chartRows = resultChartRows(response);
  const seriesNames = visualization.series_key
    ? [...new Set(rows.map((row) => String(row[visualization.series_key!] ?? "Other")))]
    : [];
  const kpiScopeLabel = response.intent === "population_summary"
    ? response.interpreted?.filters.livestock_type
      ? `${response.interpreted.filters.livestock_type} only`
      : "All species"
    : rows[0].livestock_type
      ? String(rows[0].livestock_type)
      : null;

  return (
    <div className="space-y-3">
      {/* 1. Futuristic Holographic KPI Card */}
      {visualization.type === "kpi" && yKey ? (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/[0.04] via-emerald-500/[0.02] to-white p-5 shadow-xs">
          {/* Futuristic Cyber Corner Brackets */}
          <div className="pointer-events-none absolute left-2 top-2 size-2.5 border-l-2 border-t-2 border-emerald-500/60" />
          <div className="pointer-events-none absolute right-2 top-2 size-2.5 border-r-2 border-t-2 border-emerald-500/60" />
          <div className="pointer-events-none absolute bottom-2 left-2 size-2.5 border-b-2 border-l-2 border-emerald-500/60" />
          <div className="pointer-events-none absolute bottom-2 right-2 size-2.5 border-b-2 border-r-2 border-emerald-500/60" />

          {/* Subtle Ambient Radial Cyber Glow */}
          <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-emerald-500/10 blur-2xl" />

          <div className="relative flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-emerald-800">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                TELEMETRY READOUT // {visualization.label ?? "RESULT METRIC"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-emerald-900">
                <CheckCircle2 className="size-3 text-emerald-600" />
                100% POSTGRESQL VERIFIED
              </span>
            </div>

            <div className="my-1 flex items-baseline gap-3">
              <span className="font-mono text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                {displayValue(rows[0][yKey])}
              </span>
              {kpiScopeLabel ? (
                <span className="rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-slate-700">
                  {kpiScopeLabel}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
              <Database className="size-3.5 text-slate-400" />
              <span>Real-time aggregate snapshot derived from approved municipal datasets</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* 2. Futuristic Cyber Bar Chart */}
      {visualization.type === "bar" && xKey && yKey ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-4 shadow-2xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700">
              <BarChart3 className="size-3.5 text-emerald-600" />
              TELEMETRY DISTRIBUTION // {columns.find((col) => col.key === yKey)?.label ?? yKey}
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
              {rows.length} OBSERVATIONS
            </span>
          </div>
          <div className="h-64 w-full" role="img" aria-label="Ask SmartLivestock result bar chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart accessibilityLayer data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 12 }}>
                <defs>
                  <linearGradient id="cyberEmeraldBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#047857" stopOpacity={0.95} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#475569", fontFamily: "monospace" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "#64748b", fontFamily: "monospace" }} allowDecimals={false} />
                <Tooltip content={<AskHudTooltip />} />
                <Bar dataKey={yKey} name={columns.find((column) => column.key === yKey)?.label ?? yKey} fill="url(#cyberEmeraldBar)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {/* 3. Futuristic Cyber Line Chart */}
      {visualization.type === "line" && xKey && yKey ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-4 shadow-2xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700">
              <TrendingUp className="size-3.5 text-cyan-600" />
              TEMPORAL TELEMETRY // {columns.find((col) => col.key === yKey)?.label ?? yKey}
            </span>
            <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-800">
              CHRONOLOGICAL SERIES
            </span>
          </div>
          <div className="h-64 w-full" role="img" aria-label="Ask SmartLivestock result line chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart accessibilityLayer data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#475569", fontFamily: "monospace" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "#64748b", fontFamily: "monospace" }} />
                <Tooltip content={<AskHudTooltip />} />
                {seriesNames.length > 1 ? <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace" }} /> : null}
                {visualization.series_key && seriesNames.length
                  ? seriesNames.map((name, index) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        name={name}
                        stroke={SPECIES_COLORS[index % SPECIES_COLORS.length]}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: SPECIES_COLORS[index % SPECIES_COLORS.length] }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                      />
                    ))
                  : (
                      <Line
                        type="monotone"
                        dataKey={yKey}
                        name={columns.find((column) => column.key === yKey)?.label ?? yKey}
                        stroke="#059669"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#059669" }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                      />
                    )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {/* 4. Futuristic Data Matrix Table */}
      {visualization.type !== "kpi" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-white">
            <span className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              <Activity className="size-3 text-emerald-400" />
              TELEMETRY MATRIX // {rows.length} ROWS
            </span>
            <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-slate-400">
              POSTGRESQL AUDIT
            </span>
          </div>
          <div className="max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200/80 bg-slate-50/90 hover:bg-slate-50/90">
                  {columns.map((column) => (
                    <TableHead key={column.key} className="px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow
                    key={`${String(row[xKey ?? columns[0]?.key] ?? "row")}-${index}`}
                    className="border-b border-slate-100 transition-colors hover:bg-emerald-50/30"
                  >
                    {columns.map((column, colIdx) => (
                      <TableCell
                        key={column.key}
                        className={
                          colIdx === 0
                            ? "px-3.5 py-2 font-mono text-xs font-semibold text-slate-900"
                            : "px-3.5 py-2 font-mono text-xs text-slate-700 tabular-nums"
                        }
                      >
                        {displayValue(row[column.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface AskSmartLivestockProps {
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  floating?: boolean;
}

export function AskSmartLivestock({
  collapsible = true,
  defaultOpen = false,
  className = "",
  floating = false,
}: AskSmartLivestockProps = {}) {
  const { user } = useAuth();
  const examples = EXAMPLES;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [resultPopupOpen, setResultPopupOpen] = useState(true);
  const [isClosingResult, setIsClosingResult] = useState(false);
  const [isClosingAssistant, setIsClosingAssistant] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeAssistantTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCloseResult = useCallback(() => {
    if (isClosingResult || !resultPopupOpen) return;
    setIsClosingResult(true);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      setResultPopupOpen(false);
      setIsClosingResult(false);
    }, 250);
  }, [isClosingResult, resultPopupOpen]);

  const handleOpenResult = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIsClosingResult(false);
    setResultPopupOpen(true);
  }, []);

  const handleCloseAssistant = useCallback(() => {
    if (isClosingAssistant || !isOpen) return;
    setIsClosingAssistant(true);
    if (closeAssistantTimeoutRef.current) clearTimeout(closeAssistantTimeoutRef.current);
    closeAssistantTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsClosingAssistant(false);
      setResultPopupOpen(false);
      setIsClosingResult(false);
    }, 200);
  }, [isClosingAssistant, isOpen]);

  const handleOpenAssistant = useCallback(() => {
    if (closeAssistantTimeoutRef.current) clearTimeout(closeAssistantTimeoutRef.current);
    setIsClosingAssistant(false);
    setIsOpen(true);
    setTimeout(() => questionInput.current?.focus(), 100);
  }, []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [explainWithAI, setExplainWithAI] = useState(false);
  const [interpretWithAI, setInterpretWithAI] = useState(false);
  const questionInput = useRef<HTMLInputElement>(null);
  const panelContentId = useId();
  // A ref changes immediately; React state alone cannot block same-tick clicks.
  const submitting = useRef(false);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    const handleCustomOpen = () => {
      handleOpenAssistant();
    };
    window.addEventListener("smartlivestock:open", handleCustomOpen);
    return () => {
      window.removeEventListener("smartlivestock:open", handleCustomOpen);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      if (closeAssistantTimeoutRef.current) clearTimeout(closeAssistantTimeoutRef.current);
    };
  }, [handleOpenAssistant]);

  useEffect(() => {
    if (!floating || !isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (resultPopupOpen && response && !isClosingResult) {
          handleCloseResult();
        } else if (!isClosingAssistant) {
          handleCloseAssistant();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [floating, isOpen, resultPopupOpen, response, isClosingResult, handleCloseResult, isClosingAssistant, handleCloseAssistant]);

  const handleToggle = useCallback(() => {
    if (isOpen && !isClosingAssistant) {
      handleCloseAssistant();
    } else {
      handleOpenAssistant();
    }
  }, [isOpen, isClosingAssistant, handleCloseAssistant, handleOpenAssistant]);

  const role = user?.role?.toUpperCase();
  if (role !== "MAO" && role !== "ADMIN") return null;

  const ask = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || submitting.current) return;
    submitting.current = true;
    handleOpenAssistant();
    setLoading(true);
    setError("");
    setDraftNotice("");
    setResponse(null);
    try {
      const result = await api.post<AskResponse>("analytics/nlp-query/", {
        question: trimmed,
        explain: explainWithAI,
        interpret_with_ai: interpretWithAI,
      });
      setResponse(result.data);
      handleOpenResult();
    } catch (caught) {
      const axiosError = caught as AxiosError<{ detail?: string; question?: string[] }>;
      setError(axiosError.response?.data?.detail ?? axiosError.response?.data?.question?.[0] ?? "Could not query analytics. Check your connection and try again.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(question);
  };

  const renderQueryControls = () => (
    <div className="space-y-3">
      {/* Sentence-Wide Query Input Form */}
      <form onSubmit={handleSubmit} className="relative flex flex-col gap-2.5">
        <div className="relative w-full">
          <Label htmlFor="analytics-question" className="sr-only">Your analytics question</Label>
          <Terminal className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" />
          <Input
            ref={questionInput}
            id="analytics-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            aria-label="Ask a livestock analytics question"
            aria-describedby="ask-help"
            placeholder="Query livestock counts, disease, mortality, or MAO review workload…"
            className="h-12 w-full rounded-xl pl-10 pr-4 font-mono text-xs sm:text-sm focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
            disabled={loading}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-slate-400">
            Press <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Enter ↵</kbd> to query
          </span>
          <Button
            type="submit"
            disabled={loading || !question.trim()}
            className="h-10 shrink-0 rounded-xl bg-gradient-to-r from-[#2D5A27] to-[#1f3f1b] px-5 text-xs font-bold text-white shadow-xs hover:from-[#244a20] hover:to-[#183115] sm:text-sm cursor-pointer ml-auto"
          >
            {loading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4 text-emerald-300" />}
            {loading ? "Decoding Telemetry…" : "Query Intelligence"}
          </Button>
        </div>
      </form>

      {/* Groq Interpretation Toggle: exact question text may leave the application. */}
      <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-slate-600">
        <input
          type="checkbox"
          checked={interpretWithAI}
          onChange={(event) => setInterpretWithAI(event.target.checked)}
          disabled={loading}
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-[#2D5A27]"
        />
        <span>
          Use Groq to interpret this question. When used, the exact question and available species/barangay labels are sent to Groq. Avoid farmer names or IDs; server approval is also required.
        </span>
      </label>

      {/* AI Explanation Toggle */}
      <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-slate-600">
        <input
          type="checkbox"
          checked={explainWithAI}
          onChange={(event) => setExplainWithAI(event.target.checked)}
          disabled={loading}
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-[#2D5A27]"
        />
        <span>
          Request an explanation of the result. Only allowlisted aggregate analytics are forwarded; the question text is not included in this explanation request.
        </span>
      </label>

      {draftNotice ? <p role="status" className="mt-2 font-mono text-xs text-emerald-800">{draftNotice}</p> : null}

      {/* Futuristic Example Prompt Pills */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Example questions">
        <span className="mr-1 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <Zap className="size-3 text-amber-500" />
          QUICK QUERIES:
        </span>
        {examples.map((example) => (
          <Button
            key={example}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuestion(example)}
            disabled={loading}
            className="group h-auto max-w-full whitespace-normal rounded-lg border-slate-200/80 bg-slate-50/70 px-2.5 py-1 text-left font-mono text-[11px] font-medium text-slate-700 transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-950"
          >
            <ChevronRight className="mr-1 inline size-3 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
            {example}
          </Button>
        ))}
      </div>

      {loading ? (
        <div role="status" aria-live="polite" className="mt-4 flex items-center gap-3 overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 p-3.5 text-xs text-emerald-900 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span className="relative flex size-10 shrink-0 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-emerald-300/60 animate-ping-subtle motion-reduce:animate-none" aria-hidden="true" />
            <span className="relative flex size-9 items-center justify-center rounded-full border border-emerald-200 bg-white shadow-xs">
              <LoaderCircle className="size-5 animate-spin text-emerald-700 motion-reduce:animate-none" aria-hidden="true" />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 font-mono font-bold">
              <span>Querying authorized records</span>
              <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                <span className="size-1 rounded-full bg-emerald-600 animate-bounce motion-reduce:animate-none" />
                <span className="size-1 rounded-full bg-emerald-600 animate-bounce motion-reduce:animate-none [animation-delay:120ms]" />
                <span className="size-1 rounded-full bg-emerald-600 animate-bounce motion-reduce:animate-none [animation-delay:240ms]" />
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] font-medium text-slate-600">Parsing your question and checking records you are authorized to view…</span>
          </span>
          <span className="hidden shrink-0 rounded-md border border-emerald-200 bg-white/80 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-800 sm:inline-flex">Query active</span>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="mt-4 rounded-xl border-rose-300 bg-rose-50/90">
          <AlertTitle className="font-mono text-xs font-bold uppercase tracking-wider">Telemetry Query Failed</AlertTitle>
          <AlertDescription className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void ask(question)} disabled={loading} className="font-mono text-xs">
              Retry Query
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );

  const renderResultConsole = () => {
    if (!response) return null;
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-white via-slate-50/30 to-emerald-50/15 p-4 sm:p-5 shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
        {/* Subtle Cyber Glowing Background Orbs */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 size-56 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative z-10 space-y-4" aria-live="polite">
          {response.status === "answered" ? (
            <>
              {/* Telemetry Header HUD Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    QUERY INTERPRETED
                  </span>

                  <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-2xs">
                    {`INTENT // ${response.intent?.replaceAll("_", " ") ?? "GENERAL"}`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  <span>SERVER-VALIDATED ORM · NO GENERATED SQL</span>
                </div>
              </div>

              {/* Scoped Parameters / Telemetry Filters Matrix */}
              <div className="flex flex-wrap items-center gap-1.5">
                {response.period ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-700 shadow-2xs">
                    <Clock className="size-3 text-slate-400" />
                    <span className="font-semibold text-slate-900">{response.period.label}:</span> {response.period.start} → {response.period.end}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-700 shadow-2xs">
                    <Clock className="size-3 text-slate-400" />
                    {response.intent === "pending_reviews" ? "Current Review Queue" : "Active Approved Inventory"}
                  </span>
                )}

                {response.interpreted?.filters.livestock_type ? (
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-800">
                    SPECIES: {response.interpreted.filters.livestock_type}
                  </span>
                ) : null}

                {response.interpreted?.filters.barangay ? (
                  <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-blue-800">
                    LOCATION: {response.interpreted.filters.barangay}
                  </span>
                ) : null}

                {response.interpreted?.filters.farmer ? (
                  <span className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-violet-800">
                    FARMER: {response.interpreted.filters.farmer}
                  </span>
                ) : null}

                {response.interpreted?.filters.approval_status ? (
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-800">
                    QUEUE: {response.interpreted.filters.approval_status.replaceAll("_", " ")}
                  </span>
                ) : null}
              </div>

              {/* Holographic Synthesized Answer Card */}
              <div className="relative overflow-hidden rounded-xl border-l-4 border-l-emerald-600 border-y border-r border-slate-200/90 bg-white/95 p-4 sm:p-5 shadow-2xs backdrop-blur-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    <Terminal className="size-3.5 text-emerald-600" />
                    INTELLIGENCE SYNTHESIS OUTPUT
                  </span>
                  {response.interpreted ? (
                    <span className="font-mono text-[10px] text-slate-400">
                      METRIC: {response.interpreted.metric.replaceAll("_", " ").toUpperCase()}
                      {response.interpreted.group_by ? ` // BY ${response.interpreted.group_by.replaceAll("_", " ").toUpperCase()}` : ""}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm sm:text-base font-bold leading-relaxed text-slate-900">
                  {response.answer}
                </p>
              </div>

              {response.ai_interpretation ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs leading-relaxed text-slate-600" role="status">
                  {response.ai_interpretation.message}
                </p>
              ) : null}

              {/* Telemetry Visualization */}
              <ResultVisualization response={response} />

              {/* Data Coverage Note */}
              {response.coverage_note ? (
                <div className="flex items-start gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-slate-600">
                  <Database className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                  <span>{response.coverage_note}</span>
                </div>
              ) : null}

              {/* Futuristic Neural AI Explanation Node */}
              {response.ai_explanation?.status === "generated" && response.ai_explanation.text ? (
                <aside className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/[0.04] via-purple-950/[0.03] to-white p-4 shadow-2xs">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                      <Sparkles className="size-3.5 text-indigo-600" />
                      NEURAL COPILOT EXPLANATION
                    </span>
                    <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-800">
                      {`ENGINE: ${response.ai_explanation.provider ?? "SMARTLIVESTOCK-AI"} // MODEL: ${response.ai_explanation.model ?? "LLM-ASSIST"}`}
                    </span>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-700">
                    {response.ai_explanation.text}
                  </p>
                </aside>
              ) : null}

              {response.ai_explanation?.status === "unavailable" ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs leading-relaxed text-slate-500" role="status">
                  {response.ai_explanation.message ?? "The optional AI explanation is currently offline. The factual deterministic answer above remains verified."}
                </p>
              ) : null}

              {/* Cryptographic Provenance Badge */}
              <div className="flex items-center justify-between pt-1 font-mono text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  AUDIT SECURITY: ROLE-BASED ACCESS CONTROL ENFORCED
                </span>
                <span>PADRE GARCIA MUNICIPAL AGRICULTURE OFFICE</span>
              </div>
            </>
          ) : (
            /* Clarification / Unsupported High-Tech Diagnostics Panel */
            <div className="space-y-3">
              <Alert variant={response.status === "clarification" ? "default" : "destructive"} className="rounded-xl">
                <AlertTitle className="font-mono text-xs font-bold uppercase tracking-wider">
                  {response.status === "restricted"
                    ? "PRIVATE RECORDS"
                    : response.status === "unsupported"
                    ? "UNSUPPORTED QUERY SCHEMA"
                    : response.status === "not_found"
                      ? "ENTITY NOT FOUND IN POSTGRESQL"
                      : response.status === "ambiguous"
                        ? "AMBIGUOUS TARGET IDENTIFIER"
                        : "QUERY REFINEMENT REQUIRED"}
                </AlertTitle>
                <AlertDescription className="mt-1 text-xs sm:text-sm font-medium">{response.answer}</AlertDescription>
              </Alert>

              {response.ai_interpretation ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs leading-relaxed text-slate-600" role="status">
                  {response.ai_interpretation.message}
                </p>
              ) : null}

              {response.suggestions?.length ? (
                <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 to-white p-4 shadow-2xs">
                  <div className="mb-2 flex items-center gap-2">
                    <Zap className="size-4 text-emerald-700" />
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-950">
                      RECOMMENDED QUERY PATHWAYS
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-emerald-800">
                    Select a calibrated query template below, or refine your search parameters:
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {response.suggestions.map((suggestion) => (
                      <Button
                        key={suggestion.question}
                        type="button"
                        variant="outline"
                        disabled={loading}
                        className="group h-auto justify-start whitespace-normal rounded-xl border-slate-200/90 bg-white p-3 text-left transition-all hover:border-emerald-400 hover:bg-emerald-50/40"
                        onClick={() => {
                          setQuestion(suggestion.question);
                          setResponse(null);
                          setDraftNotice("Query template selected. Review parameters and execute.");
                          questionInput.current?.focus();
                          questionInput.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }}
                      >
                        <span className="flex items-start gap-2.5">
                          <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-emerald-600 transition-transform group-hover:translate-x-1" />
                          <span>
                            <span className="block font-mono text-xs font-bold text-emerald-950">{suggestion.label}</span>
                            <span className="mt-0.5 block font-mono text-[11px] text-slate-600">{suggestion.question}</span>
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => (
    <div className="space-y-5">
      {renderQueryControls()}
      {response ? renderResultConsole() : null}
    </div>
  );

  if (floating) {
    if (!isMounted) return null;

    const floatingContent = (
      <>
        {/* Backdrop for click-outside */}
        {(isOpen || isClosingAssistant) && (
          <div
            className={`fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[1px] transition-all ${
              isClosingAssistant
                ? "animate-out fade-out-0 duration-200 fill-mode-forwards pointer-events-none"
                : "animate-in fade-in duration-200"
            }`}
            onClick={handleCloseAssistant}
            aria-hidden="true"
          />
        )}

        {/* Floating Dual-Pane Container anchored to bottom-right */}
        {(isOpen || isClosingAssistant) && (
          <div className="fixed bottom-20 sm:bottom-22 right-3 sm:right-6 z-50 flex flex-row-reverse items-end gap-3 pointer-events-none [&>*]:pointer-events-auto max-w-[calc(100vw-1.5rem)]">
            {/* 1. Right Pane: AskSmartLivestock Query Console (Pinned directly above the FAB) */}
            <div
              id={panelContentId}
              role="dialog"
              aria-modal="false"
              aria-label="Ask SmartLivestock analytics assistant"
              className={`w-[calc(100vw-1.5rem)] sm:w-[540px] md:w-[600px] lg:w-[640px] max-h-[calc(100dvh-6.5rem)] flex flex-col rounded-3xl border border-emerald-300/80 bg-white shadow-2xl shadow-slate-950/30 overflow-hidden shrink-0 transition-all ${
                isClosingAssistant
                  ? "animate-out fade-out-0 zoom-out-95 slide-out-to-bottom-4 duration-200 ease-in fill-mode-forwards pointer-events-none"
                  : "animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200"
              }`}
            >
              {/* Ambient subtle glow accents */}
              <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-cyan-500/10 blur-3xl" />

              {/* Header */}
              <div className="relative border-b border-emerald-100 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white px-4 sm:px-5 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Sparkles className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                        Ask SmartLivestock
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-50/80 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-800">
                        MAO Intelligence
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      Natural language queries for livestock inventory, surveillance & approvals
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseAssistant}
                  className="size-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                  aria-label="Close Ask SmartLivestock assistant"
                >
                  <X className="size-4" />
                </Button>
              </div>

              {/* Scrollable Query Area */}
              <div className="overflow-y-auto p-4 sm:p-5 space-y-4 max-h-[calc(100dvh-12rem)] min-h-0 flex-1">
                {renderQueryControls()}

                {/* Status indicator linking to the left result slide pane on desktop */}
                {response && (
                  <div className="hidden lg:flex items-center justify-between p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/90 text-xs text-emerald-900 font-medium animate-in fade-in">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      Result slide pane active on left
                    </span>
                    {!resultPopupOpen && !isClosingResult && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleOpenResult}
                        className="h-7 text-[11px] font-bold border-emerald-300 bg-white hover:bg-emerald-100 cursor-pointer"
                      >
                        Slide Out Result ←
                      </Button>
                    )}
                  </div>
                )}

                {/* On mobile screens (< lg), display the result inside this popup */}
                {response && (
                  <div className="lg:hidden pt-2">
                    {renderResultConsole()}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Left Slide Pane: Result Pane (Appears on the left side of AskSmartLivestock with slide pane animation) */}
            {response && (resultPopupOpen || isClosingResult) && (
              <div
                id={`${panelContentId}-result`}
                role="dialog"
                aria-modal="false"
                aria-label="SmartLivestock query result slide pane"
                className={`hidden lg:flex w-[520px] xl:w-[600px] max-w-[calc(100vw-44rem)] max-h-[calc(100dvh-6.5rem)] flex-col rounded-3xl border border-emerald-300/80 bg-white shadow-2xl shadow-slate-950/30 overflow-hidden shrink-0 transition-all ${
                  (isClosingResult || isClosingAssistant)
                    ? "animate-out fade-out-0 slide-out-to-right-8 duration-200 ease-in fill-mode-forwards pointer-events-none"
                    : "animate-in fade-in slide-in-from-right-8 duration-300 ease-out fill-mode-both"
                }`}
              >
                {/* Ambient subtle glow accents */}
                <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-cyan-500/10 blur-3xl" />

                {/* Header */}
                <div className="relative border-b border-emerald-100 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white px-4 sm:px-5 py-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Sparkles className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                          Query Result
                        </h3>
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-50/80 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-800">
                          Telemetry HUD
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium truncate">
                        {response.question}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleCloseResult}
                    className="size-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                    aria-label="Close result slide pane"
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                {/* Scrollable Results Area */}
                <div className="overflow-y-auto p-4 sm:p-5 space-y-4 max-h-[calc(100dvh-12rem)] min-h-0 flex-1">
                  {renderResultConsole()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Floating Action Button (FAB) in the bottom right as usual */}
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen && !isClosingAssistant}
          aria-controls={panelContentId}
          aria-label={isOpen && !isClosingAssistant ? "Close Ask SmartLivestock assistant" : "Open Ask SmartLivestock assistant"}
          className={`fixed bottom-5 sm:bottom-6 right-4 sm:right-6 z-50 group flex items-center gap-2.5 rounded-full px-4 sm:px-4.5 py-3 text-white shadow-xl shadow-emerald-950/25 hover:shadow-2xl hover:shadow-emerald-700/35 hover:scale-[1.03] active:scale-95 transition-all duration-200 border-2 cursor-pointer ${
            isOpen && !isClosingAssistant
              ? "bg-slate-900 border-slate-700 hover:bg-slate-800"
              : "bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 border-emerald-300/40 ring-4 ring-emerald-500/15"
          }`}
        >
          <span className="relative flex size-5.5 items-center justify-center shrink-0">
            {isOpen && !isClosingAssistant ? (
              <X className="size-5 text-white" />
            ) : (
              <>
                <Sparkles className="size-5 text-emerald-100 group-hover:rotate-12 transition-transform duration-300" />
                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-teal-300 animate-ping" />
                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-teal-300" />
              </>
            )}
          </span>

          <span className="font-extrabold text-xs sm:text-sm tracking-tight pr-0.5 whitespace-nowrap">
            {isOpen && !isClosingAssistant ? "Close Assistant" : "Ask SmartLivestock"}
          </span>

        </button>
      </>
    );

    return createPortal(floatingContent, document.body);
  }

  return (
    <section
      className={`relative min-w-0 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-all duration-200 ${
        collapsible && !isOpen ? "p-3.5 sm:p-4" : "p-4 sm:p-6"
      } ${className}`}
      aria-label="Ask SmartLivestock analytics assistant"
      aria-busy={loading}
    >
      {/* Background Subtle Cyber Glow */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-cyan-500/5 blur-3xl" />

      {/* Header Bar */}
      <div
        className={`relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
          collapsible && !isOpen ? "" : "mb-4"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              <Cpu className="size-3 text-emerald-600" />
              QUICK DATA QUESTIONS
            </span>
            <span className="font-mono text-xs text-slate-400">{"APPROVED RECORDS"}</span>
          </div>
          <h2 className="mt-1 text-base font-black tracking-tight text-slate-900 sm:text-lg">Ask SmartLivestock</h2>
          <p id="ask-help" className="text-xs font-medium leading-relaxed text-slate-500">
            Ask about livestock totals, disease and death reports, or MAO reviews. Answers use records you are allowed to view.
          </p>
        </div>

        {collapsible && (
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggle}
              aria-expanded={isOpen}
              aria-controls={panelContentId}
              className={`h-9 shrink-0 gap-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                isOpen
                  ? "border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
                  : "border-emerald-300/90 bg-emerald-50/80 text-emerald-900 shadow-2xs hover:bg-emerald-100 hover:border-emerald-400"
              }`}
            >
              {isOpen ? (
                <>
                  <span>Hide Assistant</span>
                  <ChevronUp className="size-3.5 text-slate-500" />
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5 text-emerald-600" />
                  <span>Open Assistant</span>
                  <ChevronDown className="size-3.5 text-emerald-700" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {(!collapsible || isOpen) && (
        <div id={panelContentId} className="animate-in fade-in slide-in-from-top-1 duration-200">
          {renderContent()}
        </div>
      )}
    </section>
  );
}
