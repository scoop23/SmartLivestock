"use client";

import { ValidationPagination } from "@/app/(admin)/data-validation/components/validation-pagination";
import { PageHeader } from "@/app/components/page-header";
import { Alert,AlertDescription,AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableSection } from "@/components/ui/data-table-section";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import { BarChart3,LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useMemo,useState } from "react";

type Example = {
  question: string; expected: string; actual: string; passed: boolean;
  expected_filters: Record<string, string | number | null>;
  explanation: string; parameter_mismatches: string[];
  normalized_question: string; tokens: string[]; decision: string;
};
type Evaluation = {
  engine: string; as_of: string; total: number; passed: number;
  outcome_accuracy: number; parameter_accuracy: number; parameter_checks: number;
  note: string; examples: Example[];
  per_intent: { intent: string; support: number; precision: number; recall: number; f1: number }[];
};
type Comparison = {
  baseline: Evaluation; hybrid: Evaluation;
  ml: { engine: string; outcome_accuracy: number; macro_f1: number; safe_rejection_rate: number; false_executable_predictions: number; incorrect_rejections: number };
  training: { fit: number; validation: number; test: number; seed: number };
  decision: string; limitations: string;
};
const label = (value: string) => value.replaceAll("_", " ");
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function NLPExamplesPage() {
  const { user } = useAuth();
  const authorized = ["MAO", "ADMIN"].includes(user?.role?.toUpperCase() ?? "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [compare, setCompare] = useState(false);
  // This is a read-only parser report. No approval, training, or database mutation.
  const query = useQuery({
    queryKey: ["analytics", "nlp-evaluation", user?.email],
    queryFn: async () => (await api.get<Evaluation>("analytics/nlp-evaluation/")).data,
    enabled: authorized, retry: false,
  });
  // Optional developer diagnostics; this never changes the live query strategy.
  const comparison = useQuery({
    queryKey: ["analytics", "nlp-comparison", user?.email],
    queryFn: async () => (await api.get<Comparison>("analytics/nlp-evaluation/?compare=1")).data,
    enabled: authorized && compare, retry: false,
  });
  const filtered = useMemo(() => (query.data?.examples ?? []).filter(row =>
    `${row.question} ${row.expected} ${row.actual}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [query.data, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  return <>
    <PageHeader title="NLP examples & evaluation" subtitle="Check question interpretation, not livestock-record approval" variant="admin" maxWidthClass="w-full" icon={<BarChart3 className="size-5 text-slate-800" />} />
    <main className="min-w-0 space-y-4 p-3 sm:p-5">
      <Button asChild variant="outline" size="sm"><Link href="/analytics">Back to Advanced Analytics</Link></Button>
      {!authorized ? <Alert><AlertTitle>MAO/Admin access required</AlertTitle><AlertDescription>This page contains the developer-maintained evaluation examples.</AlertDescription></Alert> : null}
      {authorized && query.isPending ? <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><LoaderCircle className="size-4 animate-spin" />Evaluating example questions…</p> : null}
      {query.isError ? <Alert variant="destructive"><AlertTitle>Could not load evaluation</AlertTitle><AlertDescription>Check your connection and that the backend includes the NLP evaluation endpoint.<Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching} className="ml-2">Retry</Button></AlertDescription></Alert> : null}
      {authorized ? <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-bold tracking-tight text-slate-900">Rules versus ML experiment</h2>
        <p className="text-xs font-medium text-slate-500">Compare the same questions using rules, raw classifier labels, and a rules-first shadow pipeline. This does not enable ML for user questions.</p>
        <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold" disabled={comparison.isFetching} onClick={() => { if (compare) void comparison.refetch(); else setCompare(true); }}>{comparison.isFetching ? "Evaluating…" : compare ? "Run comparison again" : "Run comparison"}</Button>
        {comparison.isError ? <Alert variant="destructive"><AlertDescription>Could not run the comparison. Check the backend connection and retry.</AlertDescription></Alert> : null}
        {comparison.data ? <>
          <p className="text-xs text-slate-500">{comparison.data.training.fit} fit / {comparison.data.training.validation} validation / {comparison.data.training.test} evaluation questions. Seed: {comparison.data.training.seed}.</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[11px] font-black uppercase">Approach</TableHead><TableHead className="text-[11px] font-black uppercase">Outcome accuracy</TableHead></TableRow></TableHeader><TableBody>
              {[comparison.data.baseline, comparison.data.ml, comparison.data.hybrid].map(row => <TableRow key={row.engine}><TableCell className="whitespace-normal text-xs font-medium">{row.engine}</TableCell><TableCell className="text-xs font-bold">{percent(row.outcome_accuracy)}</TableCell></TableRow>)}
            </TableBody></Table>
          </div>
          <p className="text-xs font-semibold text-slate-700">{comparison.data.decision}</p>
          <p className="text-xs leading-relaxed text-slate-500">{comparison.data.limitations}</p>
        </> : null}
      </div> : null}
      {authorized && query.data ? <>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-base font-bold tracking-tight text-slate-900">{query.data.engine}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard title="Matching examples" value={`${query.data.passed} / ${query.data.total}`} description="Expected outcome and filters" size="sm" variant="emerald" wrapText />
            <KpiCard title="Outcome accuracy" value={percent(query.data.outcome_accuracy)} description="Intent or safe handling" size="sm" wrapText />
            <KpiCard title="Filter accuracy" value={percent(query.data.parameter_accuracy)} description={`${query.data.parameter_checks} declared filter checks`} size="sm" wrapText />
          </div>
          <p className="text-xs leading-relaxed text-slate-500">{query.data.note}</p>
          <p className="text-xs text-slate-500">Fixed evaluation date: {query.data.as_of}. Filter checks: {query.data.parameter_checks}. The developer maintains these files with MAO metric guidance and SIBAT wording feedback; adding an example does not train the live parser.</p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-[11px] [&_th]:font-black [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-slate-500 [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:text-xs [&_td]:font-medium [&_td]:text-slate-700">
          <Table><TableHeader className="bg-slate-50/80"><TableRow><TableHead>Outcome / intent</TableHead><TableHead>Examples</TableHead><TableHead>Precision</TableHead><TableHead>Recall</TableHead><TableHead>F1</TableHead></TableRow></TableHeader>
            <TableBody>{query.data.per_intent.map(row => <TableRow key={row.intent}><TableCell className="capitalize">{label(row.intent)}</TableCell><TableCell>{row.support}</TableCell><TableCell>{percent(row.precision)}</TableCell><TableCell>{percent(row.recall)}</TableCell><TableCell>{percent(row.f1)}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <Label htmlFor="example-search">Find an example</Label>
          <Input id="example-search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Question or expected intent" />
          <DataTableSection className="border-0 bg-transparent p-0 shadow-none" footer={<ValidationPagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={value => { setPageSize(value); setPage(1); }} pageSizeOptions={[10, 25, 50]} />}>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-[11px] [&_th]:font-black [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-slate-500 [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:text-xs [&_td]:font-medium [&_td]:text-slate-700">
            <Table><TableHeader className="bg-slate-50/80"><TableRow><TableHead>Question and expected filters</TableHead><TableHead>Expected</TableHead><TableHead>Actual</TableHead><TableHead>Evaluation</TableHead></TableRow></TableHeader>
              <TableBody>{filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(row => <TableRow key={row.question}>
                <TableCell className="min-w-52 max-w-md whitespace-normal"><p className="font-semibold text-slate-800">{row.question}</p><p className="mt-1 text-xs text-slate-500">{Object.entries(row.expected_filters).map(([key, value]) => `${key}: ${value ?? "current snapshot"}`).join(" · ") || row.explanation}</p><details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer font-semibold">Language-processing steps</summary><p className="mt-1 break-words">Normalized: {row.normalized_question}</p><p className="mt-1 break-words">Tokens: {row.tokens.join(" / ")}</p></details></TableCell>
                <TableCell className="whitespace-normal capitalize">{label(row.expected)}</TableCell><TableCell className="whitespace-normal capitalize">{label(row.actual)}</TableCell>
                <TableCell><Badge variant="outline" className={row.passed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}>{row.passed ? "Matched" : "Mismatch"}</Badge></TableCell>
              </TableRow>)}{!filtered.length ? <TableRow><TableCell colSpan={4} className="py-10 text-center text-slate-500">No examples match your search.</TableCell></TableRow> : null}</TableBody>
            </Table>
          </div>
          </DataTableSection>
        </div>
      </> : null}
    </main>
  </>;
}
