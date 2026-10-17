"use client";

import { Alert,AlertDescription,AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { LoaderCircle,Search } from "lucide-react";
import { useRef,useState,type FormEvent } from "react";
import { Bar,BarChart,CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from "recharts";

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

function ResultVisualization({ response }: { response: AskResponse }) {
  // The backend selects the presentation and supplies the real values.
  // The browser formats them; it does not calculate official analytics.
  const visualization = response.visualization;
  if (!visualization || !response.results.length) {
    return <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-2xs"><Search className="size-7 text-slate-300" aria-hidden="true" /><h3 className="text-base font-bold text-slate-800">No matching records</h3><p className="max-w-sm text-xs font-medium leading-relaxed text-slate-500">This does not prove there was no activity; submissions may be incomplete.</p></div>;
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
        <KpiCard title={visualization.label ?? "Result"} value={displayValue(rows[0][yKey])} description={rows[0].livestock_type ? String(rows[0].livestock_type) : undefined} variant="emerald" size="sm" wrapText />
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
        <div className="max-h-64 overflow-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-[11px] [&_th]:font-black [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-slate-500 [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:text-xs [&_td]:font-medium [&_td]:text-slate-700">
          <Table>
            <TableHeader><TableRow className="border-b border-slate-200/80 bg-slate-50/80 hover:bg-slate-50/80">{columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}</TableRow></TableHeader>
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
  // A ref changes immediately; React state alone cannot block same-tick clicks.
  const submitting = useRef(false);

  const ask = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || submitting.current) return;
    submitting.current = true;
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
      submitting.current = false;
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(question);
  };

  return (
    <section className="mx-auto min-w-0 w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5" aria-label="Ask SmartLivestock analytics assistant" aria-busy={loading}>
      <div className="mb-4 space-y-1">
        <h2 className="text-base font-bold tracking-tight text-slate-900">Ask SmartLivestock</h2>
        <p id="ask-help" className="text-xs font-medium leading-relaxed text-slate-500">Ask about recorded livestock data available to your account. Answers use approved records and current review queues.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <Label htmlFor="analytics-question" className="sr-only">Your analytics question</Label>
          <Input
            id="analytics-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            aria-label="Ask a livestock analytics question"
            aria-describedby="ask-help"
            placeholder="Ask about population, production, disease, mortality, or MAO queues…"
            className="h-11 rounded-xl"
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !question.trim()} className="h-11 shrink-0 rounded-xl bg-[#2D5A27] text-xs font-bold text-white hover:bg-[#244a20] sm:text-sm">
          {loading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Search className="mr-2 size-4" />}
          {loading ? "Checking records…" : "Ask"}
        </Button>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Example questions">
        <span className="mr-1 text-[11px] font-semibold text-slate-500">Try:</span>
        {EXAMPLES.filter((example) => user?.role?.toUpperCase() !== "SIBAT" || !example.includes("MAO approval")).map((example) => <Button key={example} type="button" variant="outline" size="sm" onClick={() => setQuestion(example)} disabled={loading} className="h-auto max-w-full whitespace-normal rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-600">{example}</Button>)}
      </div>
      {loading ? <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-600"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Checking authorized records…</p> : null}

      {error ? <Alert variant="destructive" className="mt-3"><AlertTitle>Could not get an analytics answer</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-2"><span>{error}</span><Button type="button" size="sm" variant="outline" onClick={() => void ask(question)} disabled={loading}>Retry</Button></AlertDescription></Alert> : null}

      {response ? (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3" aria-live="polite">
          {response.status === "answered" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">{response.intent?.replaceAll("_", " ")}</Badge>
                {response.period ? <Badge variant="outline" className="h-auto whitespace-normal text-left">{response.period.label}: {response.period.start} – {response.period.end}</Badge> : <Badge variant="outline">{response.intent === "pending_reviews" ? "Current queue snapshot" : "Current approved active inventory"}</Badge>}
                {response.interpreted?.filters.livestock_type ? <Badge variant="outline">{response.interpreted.filters.livestock_type}</Badge> : null}
                {response.interpreted?.filters.production_type ? <Badge variant="outline">{response.interpreted.filters.production_type}</Badge> : null}
                {response.interpreted?.filters.barangay ? <Badge variant="outline">{response.interpreted.filters.barangay}</Badge> : null}
              </div>
              <p className="text-sm font-semibold text-slate-900">{response.answer}</p>
              {response.interpreted ? <p className="text-xs text-slate-500">Metric: {response.interpreted.metric.replaceAll("_", " ")}{response.interpreted.group_by ? ` · Grouped by ${response.interpreted.group_by.replaceAll("_", " ")}` : ""}</p> : null}
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
