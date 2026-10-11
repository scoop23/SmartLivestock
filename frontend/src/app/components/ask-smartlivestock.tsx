"use client";

import { useState, type FormEvent } from "react";
import { AxiosError } from "axios";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LoaderCircle, Search, Sparkles } from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/contexts/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  status: "answered" | "clarification" | "unsupported";
  question: string;
  intent?: string;
  answer: string;
  interpreted?: {
    metric: string;
    group_by: string | null;
    filters: { barangay: string | null; livestock_type: string | null; production_type: string | null };
  };
  period?: { start: string; end: string; label: string } | null;
  visualization?: Visualization | null;
  results: ResultRow[];
  coverage_note?: string;
};

const EXAMPLES = [
  "How many cattle are currently registered?",
  "Show monthly milk production for the last six months.",
  "Which barangays reported the most cattle diseases this quarter?",
  "Compare cattle mortality across barangays this quarter.",
  "Which submissions are waiting for MAO approval?",
  "Break down production by type.",
  "Ilang baka ang registered ngayon?",
];
const SPECIES_COLORS = ["#2d5a27", "#0f766e", "#2563eb", "#c2410c", "#7e22ce", "#be123c", "#475569"];
const numberFormat = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

function displayValue(value: string | number | null | undefined) {
  return typeof value === "number" ? numberFormat.format(value) : value ?? "—";
}

function resultChartRows(response: AskResponse) {
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

function ResultVisualization({ response }: { response: AskResponse }) {
  const visualization = response.visualization;
  if (!visualization || !response.results.length) {
    return <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-600">No matching records were returned. That does not prove there was no activity; submissions may be incomplete.</p>;
  }

  const columns = visualization.columns;
  const rows = response.results;
  const yKey = visualization.y_key;
  const xKey = visualization.x_key;
  const chartRows = resultChartRows(response);
  const seriesNames = visualization.series_key
    ? [...new Set(rows.map((row) => String(row[visualization.series_key!] ?? "Other")))]
    : [];

  return (
    <div className="space-y-3">
      {visualization.type === "kpi" && yKey ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">{visualization.label ?? "Result"}</p>
          <p className="mt-1 text-3xl font-black tabular-nums text-emerald-950">{displayValue(rows[0][yKey])}</p>
          {rows[0].livestock_type ? <p className="mt-1 text-sm text-emerald-900">{rows[0].livestock_type}</p> : null}
        </div>
      ) : null}

      {visualization.type === "bar" && xKey && yKey ? (
        <div className="h-64 w-full" role="img" aria-label="Ask SmartLivestock result bar chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#475569" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
              <Tooltip formatter={(value) => displayValue(typeof value === "number" ? value : null)} />
              <Bar dataKey={yKey} name={columns.find((column) => column.key === yKey)?.label ?? yKey} fill="#2d5a27" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {visualization.type === "line" && xKey && yKey ? (
        <div className="h-64 w-full" role="img" aria-label="Ask SmartLivestock result line chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart accessibilityLayer data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#475569" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip formatter={(value) => displayValue(typeof value === "number" ? value : null)} />
              {seriesNames.length > 1 ? <Legend /> : null}
              {visualization.series_key && seriesNames.length
                ? seriesNames.map((name, index) => <Line key={name} type="monotone" dataKey={name} name={name} stroke={SPECIES_COLORS[index % SPECIES_COLORS.length]} strokeWidth={2} dot={false} isAnimationActive={false} />)
                : <Line type="monotone" dataKey={yKey} name={columns.find((column) => column.key === yKey)?.label ?? yKey} stroke="#2d5a27" strokeWidth={2} dot={false} isAnimationActive={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {visualization.type !== "kpi" ? (
        <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{rows.map((row, index) => <TableRow key={`${String(row[xKey ?? columns[0]?.key] ?? "row")}-${index}`}>
              {columns.map((column) => <TableCell key={column.key} className="tabular-nums">{displayValue(row[column.key])}</TableCell>)}
            </TableRow>)}</TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

export function AskSmartLivestock() {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError("");
    setResponse(null);
    try {
      const result = await api.post<AskResponse>("analytics/nlp-query/", { question: trimmed });
      setResponse(result.data);
    } catch (caught) {
      const axiosError = caught as AxiosError<{ detail?: string; question?: string[] }>;
      setError(axiosError.response?.data?.detail ?? axiosError.response?.data?.question?.[0] ?? "Could not query analytics. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(question);
  };

  return (
    <section className="mx-auto w-full max-w-6xl rounded-xl border border-emerald-200 bg-white p-3 shadow-2xs sm:p-4" aria-label="Ask SmartLivestock analytics assistant">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-emerald-800" />
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            aria-label="Ask a livestock analytics question"
            placeholder="Ask about population, production, disease, mortality, or MAO queues…"
            className="h-11 pl-9"
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !question.trim()} className="h-11 shrink-0 bg-[#2D5A27] text-white hover:bg-[#244a20]">
          {loading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Search className="mr-2 size-4" />}
          {loading ? "Checking records…" : "Ask"}
        </Button>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Example questions">
        <span className="mr-1 text-[11px] font-semibold text-slate-500">Try:</span>
        {EXAMPLES.filter((example) => user?.role?.toUpperCase() !== "SIBAT" || !example.includes("MAO approval")).map((example) => <button key={example} type="button" onClick={() => setQuestion(example)} disabled={loading} className="max-w-full truncate rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 disabled:opacity-50">{example}</button>)}
      </div>

      {error ? <Alert variant="destructive" className="mt-3"><AlertTitle>Could not get an analytics answer</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-2"><span>{error}</span><Button type="button" size="sm" variant="outline" onClick={() => void ask(question)} disabled={loading}>Retry</Button></AlertDescription></Alert> : null}

      {response ? (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3" aria-live="polite">
          {response.status === "answered" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">{response.intent?.replaceAll("_", " ")}</Badge>
                {response.period ? <Badge variant="outline">{response.period.label}: {response.period.start} – {response.period.end}</Badge> : <Badge variant="outline">Current queue snapshot</Badge>}
                {response.interpreted?.filters.livestock_type ? <Badge variant="outline">{response.interpreted.filters.livestock_type}</Badge> : null}
                {response.interpreted?.filters.production_type ? <Badge variant="outline">{response.interpreted.filters.production_type}</Badge> : null}
                {response.interpreted?.filters.barangay ? <Badge variant="outline">{response.interpreted.filters.barangay}</Badge> : null}
              </div>
              <p className="text-sm font-semibold text-slate-900">{response.answer}</p>
              <ResultVisualization response={response} />
              {response.coverage_note ? <p className="text-xs leading-relaxed text-slate-500">{response.coverage_note}</p> : null}
            </>
          ) : (
            <Alert variant={response.status === "unsupported" ? "destructive" : "default"}>
              <AlertTitle>{response.status === "unsupported" ? "Unsupported question" : "Please clarify your question"}</AlertTitle>
              <AlertDescription>{response.answer}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}
    </section>
  );
}
