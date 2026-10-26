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
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { BarChart3,Check,LoaderCircle,X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect,useMemo,useState } from "react";

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
type Candidate = {
  example_id: string; utterance: string; intent: string; language: string; role: string;
  expected_behavior: string; difficulty: string; split: "train" | "validation" | "test";
  source_type: string; split_group: string; expected_filters: Record<string, unknown>;
  expected_query_handler: string | null; expected_clarification: string | null;
  review: { decision: "candidate" | "accepted" | "rejected"; utterance: string; intent: string;
    notes: string; reviewer: string | null; reviewed_at: string | null };
};
type CandidateDataset = {
  corpus_version: string; generation_method: string; production_training_file_changed: boolean;
  examples: Candidate[]; candidate_count: number; accepted_count: number; rejected_count: number;
  summary: Record<string, Record<string, number>>;
  evaluation: null | { version: number; evaluated_at: string | null; candidate_training_count: number;
    baseline_classifier_accuracy: number; baseline_classifier_macro_f1: number;
    candidate_classifier_accuracy: number; candidate_classifier_macro_f1: number;
    candidate_per_intent: { intent: string; support: number; precision: number; recall: number; f1: number }[];
    candidate_confidence: { multiclass_brier_score: number; expected_calibration_error_10_bins: number; warning: string };
    baseline_parser_accuracy: number; candidate_parser_accuracy: number; candidate_parser_macro_f1: number;
    entity_exact_match: Record<string, { exact_match_accuracy: number | null }>;
    production_model_changed: boolean; near_duplicate_flags: number; label_conflicts: number;
    near_duplicate_pairs: { left: string; right: string; similarity: number; cross_split: boolean; label_conflict: boolean }[];
    limitations: string };
};
type ReviewDecision = { decision: "accepted" | "rejected"; utterance?: string; intent?: string };
const label = (value: string) => value.replaceAll("_", " ");
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

function CandidateReviewCard({ example, saving, onReview }: {
  example: Candidate; saving: boolean; onReview: (decision: ReviewDecision) => void;
}) {
  const [utterance, setUtterance] = useState(example.review.utterance || example.utterance);
  const [intent, setIntent] = useState(example.review.intent || example.intent);
  const editable = example.split === "train";
  const statusClass = example.review.decision === "accepted"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : example.review.decision === "rejected"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-3" aria-label={`${example.intent} ${example.language} ${example.split} candidate`}>
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <Badge variant="outline">{example.language}</Badge><Badge variant="outline">{label(example.expected_behavior)}</Badge>
      <Badge variant="outline">{example.role}</Badge><Badge variant="outline">{example.split}</Badge>
      <Badge variant="outline" className={statusClass}>{example.review.decision}</Badge>
      <span className="text-slate-500">{example.difficulty} · {example.example_id}</span>
    </div>
    {editable ? <Input aria-label="Edit candidate utterance" value={utterance} onChange={event => setUtterance(event.target.value)} maxLength={500} />
      : <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-800">{example.utterance}</p>}
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {editable ? <select aria-label="Edit candidate intent" value={intent} onChange={event => setIntent(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">
        {INTENTS.map(item => <option key={item} value={item}>{label(item)}</option>)}
      </select> : <span className="text-xs font-semibold text-slate-600">Expected: {label(example.intent)}</span>}
      {editable ? <div className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" className="h-8 border-rose-200 text-rose-700" disabled={saving} onClick={() => onReview({ decision: "rejected" })}><X className="mr-1 size-3.5" />Reject</Button>
        <Button size="sm" className="h-8 bg-emerald-800 hover:bg-emerald-900" disabled={saving || !utterance.trim()} onClick={() => onReview({ decision: "accepted", utterance, intent })}><Check className="mr-1 size-3.5" />Accept</Button>
      </div> : <span className="ml-auto text-[11px] text-slate-500">Frozen evaluation example</span>}
    </div>
    {example.expected_query_handler ? <p className="text-[11px] text-slate-500">Expected handler: <code>{example.expected_query_handler}</code> · approved records</p> : null}
    {example.review.reviewer ? <p className="text-[11px] text-slate-500">Last reviewed by {example.review.reviewer}{example.review.reviewed_at ? ` · ${new Date(example.review.reviewed_at).toLocaleString()}` : ""}{example.review.notes ? ` · ${example.review.notes}` : ""}</p> : null}
  </article>;
}

const INTENTS = ["population_summary", "production_trend", "production_breakdown", "disease_by_barangay", "mortality_comparison", "pending_reviews", "farmer_livestock_count", "clarification", "unsupported"];

export default function NLPExamplesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const authorized = user?.isNlpDeveloper === true;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [compare, setCompare] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateIntent, setCandidateIntent] = useState("all");
  const [candidateLanguage, setCandidateLanguage] = useState("all");
  const [candidateRole, setCandidateRole] = useState("all");
  const [candidateBehavior, setCandidateBehavior] = useState("all");
  const [candidateStatus, setCandidateStatus] = useState("all");
  const [candidateSplit, setCandidateSplit] = useState("all");
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidatePageSize, setCandidatePageSize] = useState(25);
  const queryClient = useQueryClient();
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
  const datasetQuery = useQuery({
    queryKey: ["analytics", "nlp-dataset", user?.email],
    queryFn: async () => (await api.get<CandidateDataset>("analytics/nlp-dataset/")).data,
    enabled: authorized, retry: false,
  });
  const reviewMutation = useMutation({
    mutationFn: async ({ exampleId, decision }: { exampleId: string; decision: ReviewDecision }) =>
      api.post(`analytics/nlp-dataset/${encodeURIComponent(exampleId)}/review/`, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["analytics", "nlp-dataset", user?.email] }),
  });
  const filtered = useMemo(() => (query.data?.examples ?? []).filter(row =>
    `${row.question} ${row.expected} ${row.actual}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [query.data, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const candidateFiltered = useMemo(() => (datasetQuery.data?.examples ?? []).filter(example => {
    const matches = `${example.utterance} ${example.intent} ${example.expected_query_handler ?? ""} ${example.split_group}`.toLowerCase().includes(candidateSearch.trim().toLowerCase());
    return matches && (candidateIntent === "all" || example.intent === candidateIntent)
      && (candidateLanguage === "all" || example.language === candidateLanguage)
      && (candidateRole === "all" || example.role === candidateRole)
      && (candidateBehavior === "all" || example.expected_behavior === candidateBehavior)
      && (candidateStatus === "all" || example.review.decision === candidateStatus)
      && (candidateSplit === "all" || example.split === candidateSplit);
  }), [datasetQuery.data, candidateSearch, candidateIntent, candidateLanguage, candidateRole, candidateBehavior, candidateStatus, candidateSplit]);
  const candidateTotalPages = Math.max(1, Math.ceil(candidateFiltered.length / candidatePageSize));
  const candidateCurrentPage = Math.min(candidatePage, candidateTotalPages);
  const candidatePageRows = candidateFiltered.slice((candidateCurrentPage - 1) * candidatePageSize, candidateCurrentPage * candidatePageSize);
  const candidateGroups = useMemo(() => INTENTS.map(intent => ({
    intent, rows: candidatePageRows.filter(example => example.intent === intent),
    total: candidateFiltered.filter(example => example.intent === intent).length,
  })).filter(group => group.total > 0), [candidatePageRows, candidateFiltered]);

  useEffect(() => {
    if (!isLoading && !authorized) router.replace("/analysis");
  }, [authorized, isLoading, router]);

  if (isLoading || !authorized) return null;

  return <>
    <PageHeader title="NLP examples & evaluation" subtitle="Check question interpretation, not livestock-record approval" variant="admin" maxWidthClass="w-full" icon={<BarChart3 className="size-5 text-slate-800" />} />
    <main className="min-w-0 space-y-4 p-3 sm:p-5">
      <Button asChild variant="outline" size="sm"><Link href="/analysis">Back to Analytics Overview</Link></Button>
      {query.isPending ? <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><LoaderCircle className="size-4 animate-spin" />Evaluating example questions…</p> : null}
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
      {authorized ? <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-base font-bold text-slate-900">Multilingual question dataset</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">Review candidate questions before they are considered for training. Accepting or rejecting records a reviewer decision; it does not retrain or replace the live query system. Validation and test examples are frozen.</p>
          </div>
          <Badge variant="outline">{datasetQuery.data?.corpus_version ?? "Loading dataset"}</Badge>
        </div>
        {datasetQuery.isPending ? <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><LoaderCircle className="size-4 animate-spin" />Loading candidate examples…</p> : null}
        {datasetQuery.isError ? <Alert variant="destructive"><AlertTitle>Could not load candidate dataset</AlertTitle><AlertDescription>Check the backend connection and retry.<Button variant="outline" size="sm" onClick={() => void datasetQuery.refetch()} disabled={datasetQuery.isFetching} className="ml-2">Retry</Button></AlertDescription></Alert> : null}
        {datasetQuery.data ? <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Examples" value={datasetQuery.data.examples.length} description={datasetQuery.data.generation_method} size="sm" wrapText />
            <KpiCard title="Accepted" value={datasetQuery.data.accepted_count} description="Human reviewed" size="sm" variant="emerald" wrapText />
            <KpiCard title="Rejected" value={datasetQuery.data.rejected_count} description="Human reviewed" size="sm" variant="rose" wrapText />
            <KpiCard title="Still candidates" value={datasetQuery.data.candidate_count} description="Not yet reviewed" size="sm" variant="amber" wrapText />
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">Splits: {datasetQuery.data.summary.split?.train ?? 0} train · {datasetQuery.data.summary.split?.validation ?? 0} validation · {datasetQuery.data.summary.split?.test ?? 0} frozen test. Languages: {datasetQuery.data.summary.language?.en ?? 0} English · {datasetQuery.data.summary.language?.tl ?? 0} Filipino · {datasetQuery.data.summary.language?.tl_en ?? 0} Taglish. The candidate is fit only by the offline evaluation command.</p>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input aria-label="Search candidate examples" value={candidateSearch} onChange={event => { setCandidateSearch(event.target.value); setCandidatePage(1); }} placeholder="Search question, intent, group…" />
            {[
              ["Intent", candidateIntent, setCandidateIntent, ["all", ...INTENTS]],
              ["Language", candidateLanguage, setCandidateLanguage, ["all", ...new Set(datasetQuery.data.examples.map(row => row.language))]],
              ["Role", candidateRole, setCandidateRole, ["all", ...new Set(datasetQuery.data.examples.map(row => row.role))]],
              ["Behavior", candidateBehavior, setCandidateBehavior, ["all", ...new Set(datasetQuery.data.examples.map(row => row.expected_behavior))]],
              ["Review", candidateStatus, setCandidateStatus, ["all", "candidate", "accepted", "rejected"]],
              ["Split", candidateSplit, setCandidateSplit, ["all", "train", "validation", "test"]],
            ].map(([title, value, setter, options]) => <label key={String(title)} className="space-y-1 text-xs font-semibold text-slate-600"><span>{String(title)}</span><select aria-label={`Filter by ${String(title.toLowerCase())}`} value={String(value)} onChange={event => { (setter as (value: string) => void)(event.target.value); setCandidatePage(1); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800">{(options as string[]).map(option => <option key={option} value={option}>{option === "all" ? "All" : label(option)}</option>)}</select></label>)}
          </div>
          {reviewMutation.isError ? <Alert variant="destructive"><AlertDescription>Review was not saved. Refresh the dataset and try again.</AlertDescription></Alert> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!datasetQuery.data} onClick={() => {
              if (!datasetQuery.data) return;
              const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), ...datasetQuery.data }, null, 2)], { type: "application/json" });
              const href = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = href; link.download = `ask-smartlivestock-nlp-audit-${datasetQuery.data.corpus_version}.json`;
              document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(href), 1000);
            }}>Download dataset audit JSON</Button>
            <span className="text-[11px] text-slate-500">Includes synthetic examples, review states, dataset counts, and available evaluation findings.</span>
          </div>
          {datasetQuery.data.evaluation ? <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-950">
            <div><strong>Offline comparison on the same held-out candidate questions:</strong> original classifier {percent(datasetQuery.data.evaluation.baseline_classifier_accuracy)} accuracy / {percent(datasetQuery.data.evaluation.baseline_classifier_macro_f1)} macro-F1; expanded candidate {percent(datasetQuery.data.evaluation.candidate_classifier_accuracy)} / {percent(datasetQuery.data.evaluation.candidate_classifier_macro_f1)} macro-F1. Candidate training size: {datasetQuery.data.evaluation.candidate_training_count}. Production model changed: no.
              <p className="mt-1 text-indigo-800">Candidate fit/evaluation: {datasetQuery.data.evaluation.evaluated_at ? new Date(datasetQuery.data.evaluation.evaluated_at).toLocaleString() : "timestamp unavailable"}. Near-duplicate review flags: {datasetQuery.data.evaluation.near_duplicate_flags}; conflicting labels: {datasetQuery.data.evaluation.label_conflicts}.</p>
            </div>
            <p>Rules parser intent/handler match on this candidate set: {percent(datasetQuery.data.evaluation.baseline_parser_accuracy)} before the vocabulary update, {percent(datasetQuery.data.evaluation.candidate_parser_accuracy)} now; macro-F1 {percent(datasetQuery.data.evaluation.candidate_parser_macro_f1)}. This is a static parser check, not database-value or authorization proof.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-indigo-800">{Object.entries(datasetQuery.data.evaluation.entity_exact_match).filter(([, metric]) => metric.exact_match_accuracy != null).map(([entity, metric]) => <span key={entity}>{label(entity)} exact match: {percent(metric.exact_match_accuracy ?? 0)}</span>)}<span>Calibration (exploratory): Brier {datasetQuery.data.evaluation.candidate_confidence.multiclass_brier_score.toFixed(3)} · ECE {datasetQuery.data.evaluation.candidate_confidence.expected_calibration_error_10_bins.toFixed(3)}</span></div>
            <p className="text-[11px] text-indigo-800">{datasetQuery.data.evaluation.candidate_confidence.warning}</p>
            <div className="overflow-x-auto rounded-lg border border-indigo-100 bg-white"><Table><TableHeader><TableRow><TableHead>Intent</TableHead><TableHead>Test n</TableHead><TableHead>Precision</TableHead><TableHead>Recall</TableHead><TableHead>F1</TableHead></TableRow></TableHeader><TableBody>{datasetQuery.data.evaluation.candidate_per_intent.map(row => <TableRow key={row.intent}><TableCell className="capitalize">{label(row.intent)}</TableCell><TableCell>{row.support}</TableCell><TableCell>{percent(row.precision)}</TableCell><TableCell>{percent(row.recall)}</TableCell><TableCell>{percent(row.f1)}</TableCell></TableRow>)}</TableBody></Table></div>
            {datasetQuery.data.evaluation.near_duplicate_pairs.length ? <details><summary className="cursor-pointer font-semibold">Inspect similar question pairs</summary><ul className="mt-2 space-y-2">{datasetQuery.data.evaluation.near_duplicate_pairs.map(pair => <li key={`${pair.left}:${pair.right}`} className="rounded-lg border border-indigo-100 bg-white p-2"><p>{pair.left} ↔ {pair.right}</p><p className="mt-1 text-indigo-700">Similarity {percent(pair.similarity)} · {pair.cross_split ? "cross-split" : "same split"}{pair.label_conflict ? " · conflicting labels" : " · same label"}</p></li>)}</ul></details> : null}
            <p className="text-indigo-800">{datasetQuery.data.evaluation.limitations}</p>
          </div> : <p className="text-xs text-slate-500">Run the documented offline evaluation command to attach classifier and entity results here. Candidate records are not used by the live parser.</p>}
          <DataTableSection className="border-0 bg-transparent p-0 shadow-none" footer={<ValidationPagination currentPage={candidateCurrentPage} totalPages={candidateTotalPages} totalItems={candidateFiltered.length} pageSize={candidatePageSize} onPageChange={setCandidatePage} onPageSizeChange={value => { setCandidatePageSize(value); setCandidatePage(1); }} pageSizeOptions={[25, 50, 100]} />}>
            <div className="space-y-3">
              {!candidateFiltered.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No candidate examples match these filters.</div> : candidateGroups.map(group => <details key={group.intent} open className="rounded-xl border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer font-bold capitalize text-slate-800">{label(group.intent)} <span className="ml-1 text-xs font-medium text-slate-500">{group.total} filtered examples</span></summary>
                <div className="mt-3 grid gap-3 xl:grid-cols-2">{group.rows.map(example => <CandidateReviewCard key={example.example_id} example={example} saving={reviewMutation.isPending} onReview={decision => reviewMutation.mutate({ exampleId: example.example_id, decision })} />)}</div>
              </details>)}
            </div>
          </DataTableSection>
        </> : null}
      </section> : null}
    </main>
  </>;
}
