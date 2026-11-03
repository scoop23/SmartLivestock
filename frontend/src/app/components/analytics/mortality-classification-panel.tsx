"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import api from "@/lib/axios";

type CategoryValue =
  | "SUSPECTED_INFECTIOUS"
  | "INJURY_ACCIDENT"
  | "REPRODUCTIVE_PERINATAL"
  | "OTHER_REPORTED_CAUSE"
  | "UNDETERMINED";

type Category = { value: CategoryValue; label: string; count: number };
type Prediction = {
  category: CategoryValue;
  label: string;
  decision_path: { term: string; matched: boolean }[];
};
type ClassificationRecord = {
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
};
type ClassificationDashboard = {
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
};

function ReviewRecord({ record, categories }: { record: ClassificationRecord; categories: Category[] }) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<CategoryValue | "">(
    record.current_category ?? record.prediction?.category ?? "",
  );
  const [note, setNote] = useState("");

  const reviewMutation = useMutation({
    mutationFn: async () => {
      await api.post("analytics/mortality-classification/", {
        mortality_record_id: record.id,
        category,
        note,
      });
    },
    onSuccess: async () => {
      toast.success("Staff classification saved.");
      await queryClient.invalidateQueries({ queryKey: ["mortality-cause-classification"] });
    },
    onError: () => toast.error("Classification was not saved. Refresh and try again."),
  });

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">Report #{record.id}</Badge>
            <span className="text-xs text-slate-500">{record.record_date || "Date not recorded"}</span>
            <span className="text-xs font-semibold text-slate-700">{record.species}</span>
            <span className="text-xs text-slate-500">{record.death_count} {record.death_count === 1 ? "death" : "deaths"}</span>
          </div>
          <p className="text-sm leading-5 text-slate-800"><span className="font-semibold">Reported cause:</span> {record.cause}</p>
          {record.farmer_reported_illness && (
            <p className="text-xs text-slate-600"><span className="font-semibold">Earlier farmer sick report:</span> {record.farmer_reported_illness}</p>
          )}
          {record.inspection_signs.length > 0 && (
            <p className="text-xs text-slate-500"><span className="font-semibold">CBAT field verification (not used as pre-death symptoms):</span> {record.inspection_signs.join(", ")}</p>
          )}
          {record.current_category_label && (
            <p className="text-xs text-emerald-800">Current staff label: <strong>{record.current_category_label}</strong></p>
          )}
          {record.prediction && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-950">
              <p><strong>Decision tree suggestion:</strong> {record.prediction.label}</p>
              {record.prediction.decision_path.length > 0 && (
                <p className="mt-1 text-indigo-800">
                  Tree terms: {record.prediction.decision_path.map((step) => `${step.term} (${step.matched ? "matched" : "below split"})`).join(" · ")}
                </p>
              )}
            </div>
          )}
          {record.prediction_status === "NOT_ENOUGH_INFORMATION" && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Not enough information to suggest a cause category. Add a meaningful farmer-reported cause or link an earlier sick report.
            </p>
          )}
        </div>

        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:w-[min(100%,640px)]">
          <div className="grid gap-2">
            <Label htmlFor={`mortality-category-${record.id}`} className="text-xs font-semibold text-slate-700">
              Staff-confirmed category
            </Label>
            <Select
              value={category || undefined}
              onValueChange={(value) => setCategory(value as CategoryValue)}
            >
              <SelectTrigger id={`mortality-category-${record.id}`} className="h-9 text-xs">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`mortality-note-${record.id}`} className="text-xs font-semibold text-slate-700">
              Review note (optional)
            </Label>
            <Input
              id={`mortality-note-${record.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1000}
              className="h-9 text-xs"
              placeholder="Short reason or source"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => reviewMutation.mutate()}
            disabled={!category || reviewMutation.isPending}
            className="h-9 w-full text-xs font-semibold sm:col-span-2 sm:ml-auto sm:w-auto"
          >
            {reviewMutation.isPending ? "Saving…" : record.current_category ? "Update label" : "Save label"}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function MortalityClassificationPanel() {
  const query = useQuery({
    queryKey: ["mortality-cause-classification"],
    queryFn: async ({ signal }) => {
      const response = await api.get<ClassificationDashboard>("analytics/mortality-classification/", { signal });
      return response.data;
    },
    retry: false,
  });
  const data = query.data;

  return (
    <Card className="overflow-hidden rounded-2xl border border-indigo-200/80 bg-white shadow-2xs">
      <CardHeader className="border-b border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-indigo-100 bg-white text-indigo-700">
            <GitBranch className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Mortality Cause Classification</CardTitle>
            <CardDescription className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
              An experimental DecisionTreeClassifier learns from staff-confirmed labels on approved reports. It uses the farmer-reported cause, a linked earlier farmer sick report, and species/date/death-count details. CBAT field findings are kept for verification and are not treated as pre-death symptoms. Staff choose or correct every label; suggestions never change a report or its approval.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        <Alert className="border-amber-200 bg-amber-50 text-amber-950 [&>svg]:text-amber-700">
          <Info />
          <AlertTitle className="text-amber-950">Decision support only</AlertTitle>
          <AlertDescription className="text-xs leading-5 text-amber-900">
            Categories are broad staff review labels, not veterinary diagnoses. A 30-record / 10-per-category pilot floor and cross-validation score do not establish clinical or production readiness.
          </AlertDescription>
        </Alert>

        {query.isPending && <p role="status" className="text-sm text-slate-500">Loading mortality classifications…</p>}
        {query.isError && <p role="alert" className="text-sm font-medium text-rose-700">The classification workspace could not load. Check MAO access or refresh the page.</p>}

        {data && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Model state</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {data.readiness_status === "EXPERIMENTAL"
                    ? "Experimental suggestions available"
                    : data.readiness_status === "NO_USABLE_REPORTED_INFORMATION"
                      ? "Need usable farmer-reported information"
                      : "Collecting staff labels"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{data.readiness_message}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Training labels</p>
                <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900">{data.training_record_count} <span className="text-xs font-semibold text-slate-500">/ {data.minimum_training_records} pilot minimum</span></p>
                <p className="text-xs text-slate-600">At least {data.minimum_records_per_category} labels in each category used.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Unlabelled approved reports</p>
                <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900">{data.unlabelled_record_count}</p>
                <p className="text-xs text-slate-600">Eligible real reports available for staff review.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">5-fold macro F1</p>
                <p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900">{data.cross_validation ? data.cross_validation.macro_f1.toFixed(3) : "—"}</p>
                <p className="text-xs text-slate-600">Experimental validation on reviewed labels.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2" aria-label="Reviewed label counts">
              {data.categories.map((category) => (
                <Badge key={category.value} variant="outline" className="border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                  {category.label}: {category.count}
                </Badge>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Staff review queue</h3>
                  <p className="text-xs text-slate-600">Review the reported cause and field evidence, then confirm or correct the category. Labels are saved as an audit trail.</p>
                </div>
                <span className="text-xs text-slate-500">Showing up to {data.review_queue_limit} of {data.review_queue_count} approved reports</span>
              </div>
              {data.review_queue.length ? (
                <div className="space-y-2.5">
                  {data.review_queue.map((record) => <ReviewRecord key={record.id} record={record} categories={data.categories} />)}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  No approved real mortality reports are available for classification.
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
