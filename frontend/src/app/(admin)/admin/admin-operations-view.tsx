"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { ClipboardCheck,RotateCw } from "lucide-react";
import { useState } from "react";
import { CENSUS_STATUS_META,useCensusAnalytics,useCensusCoverageHistory,type CensusCoverageTrendPoint } from "./census-analytics/census-analytics";
import { ReviewWorkloadPanel } from "./review-workload-panel";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  VERIFIED: "#0284c7",
  APPROVED: "#059669",
  SUBJECT_TO_REVISION: "#e11d48",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  VERIFIED: "Awaiting MAO",
  APPROVED: "Approved",
  SUBJECT_TO_REVISION: "Returned",
};

function CensusCoveragePanel() {
  const [periodKey, setPeriodKey] = useState("latest");
  const selected = periodKey === "latest" ? null : periodKey.split("-").map(Number);
  const { data, isLoading, isError, isFetching, refetch } = useCensusAnalytics(selected?.[0], selected?.[1]);
  const trendQueries = useCensusCoverageHistory(data?.period.year, data?.period.quarter, data);
  const trendPoints = trendQueries
    .map((query) => query.data)
    .filter((point): point is CensusCoverageTrendPoint => point !== undefined);
  const trendLoading = trendQueries.length > 0 && trendQueries.some((query) => query.isPending);
  const trendHasError = trendQueries.some((query) => query.isError);
  const trendChange = trendPoints.length === 4
    ? trendPoints[3].submission_pct - trendPoints[2].submission_pct
    : null;

  const barangayStatuses = new Map((data?.status_by_barangay ?? []).map((row) => [row.barangay, row.status]));
  const submittedBarangays = [...barangayStatuses.keys()];
  const barangayRows = [
    ...submittedBarangays.map((barangay) => ({ barangay, status: barangayStatuses.get(barangay) ?? "PENDING" })),
    ...(data?.coverage.missing_barangays ?? []).map((barangay) => ({ barangay, status: "NOT_SUBMITTED" })),
  ].sort((a, b) => a.barangay.localeCompare(b.barangay));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:p-4" aria-label="Quarterly census coverage">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-black tracking-tight text-slate-900">
            <ClipboardCheck className="size-4 text-[#2D5A27]" /> Census Coverage
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Barangay reporting and review status for the selected quarter.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Select value={periodKey} onValueChange={setPeriodKey}>
            <SelectTrigger className="h-8 w-[145px] text-xs font-bold" aria-label="Census reporting quarter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest quarter</SelectItem>
              {(data?.available_periods ?? []).map((period) => <SelectItem key={`${period.year}-${period.quarter}`} value={`${period.year}-${period.quarter}`}>Q{period.quarter} {period.year}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="Refresh census coverage" title="Refresh census coverage" onClick={() => refetch()} disabled={isFetching} className="size-8">
            <RotateCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading ? <p className="py-12 text-center text-sm text-slate-500">Loading census coverage…</p> : null}
      {isError ? <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-800">Census coverage could not be loaded.</p> : null}
      {data ? <div className="space-y-3">
        <section aria-labelledby="census-progress-heading" className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
          <h3 id="census-progress-heading" className="mb-2 text-xs font-bold text-slate-800">Reporting progress</h3>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-black text-slate-900">{data.coverage.submission_pct}%</p>
              <p className="text-xs font-semibold text-slate-500">{data.coverage.submitted} of {data.coverage.total_barangays} barangays reported · {data.period.label}</p>
            </div>
            <Badge variant="outline" className="border-slate-200 bg-white text-[11px] font-bold text-slate-600">{data.coverage.missing} missing</Badge>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label="Barangay census reporting coverage" aria-valuenow={data.coverage.submission_pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${data.coverage.submission_pct}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.coverage.by_status).map(([status, count]) => <Badge key={status} variant="outline" className="gap-1.5 border-slate-200 bg-white text-[11px] font-semibold text-slate-700">
              <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] ?? "#64748b" }} />
              {STATUS_LABEL[status] ?? CENSUS_STATUS_META[status]?.label ?? status}: {count}
            </Badge>)}
          </div>
        </section>

        <section aria-labelledby="census-barangay-heading" className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h3 id="census-barangay-heading" className="text-xs font-bold text-slate-800">Barangay status</h3>
              <p className="mt-0.5 text-[10px] text-slate-500">Submission and review state for {data.period.label}.</p>
            </div>
            <Badge variant="outline" className="shrink-0 border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600">{data.coverage.total_barangays} total</Badge>
          </div>
          <div className="max-h-[220px] space-y-1 overflow-y-auto border-t border-slate-100 pt-2" aria-label={`Barangay reporting status for ${data.period.label}`}>
            {barangayRows.map((row) => {
              const submitted = row.status !== "NOT_SUBMITTED";
              const color = submitted ? STATUS_COLOR[row.status] ?? "#64748b" : "#cbd5e1";
              return <div key={row.barangay} className="grid grid-cols-[minmax(0,1fr)_minmax(72px,1fr)_auto] items-center gap-2 py-1">
                <span className="truncate text-xs font-semibold text-slate-700">{row.barangay}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: submitted ? "100%" : "18%", backgroundColor: color }} /></span>
                <span className="min-w-[92px] text-right text-[11px] font-semibold" style={{ color }}>{submitted ? STATUS_LABEL[row.status] ?? row.status.replaceAll("_", " ") : "Not submitted"}</span>
              </div>;
            })}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Coverage counts any filed submission; only approved records are final.</p>
        </section>

        <section aria-labelledby="census-trend-heading" className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <h3 id="census-trend-heading" className="text-xs font-bold text-slate-800">Coverage trend</h3>
              <p className="mt-0.5 text-[10px] text-slate-500">Barangays that filed across four quarters through {data.period.label}.</p>
            </div>
            {trendChange !== null ? <Badge variant="outline" className={`shrink-0 text-[10px] font-bold ${trendChange > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : trendChange < 0 ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600"}`}>
              {trendChange > 0 ? "+" : ""}{trendChange} pts vs prior quarter
            </Badge> : null}
          </div>

          {trendLoading ? <p className="py-8 text-center text-xs text-slate-500">Loading quarterly trend…</p> : null}
          {!trendLoading && trendHasError ? <p role="status" className="py-6 text-center text-xs text-slate-500">Quarterly trend is temporarily unavailable.</p> : null}
          {!trendLoading && !trendHasError && trendPoints.length === 4 ? <div className="mt-3 grid grid-cols-4 gap-2.5" role="img" aria-label={`Barangay filing coverage for the four quarters through ${data.period.label}`}>
            {trendPoints.map((point, index) => <div key={`${point.period.year}-${point.period.quarter}`} className="flex min-w-0 flex-col items-center">
              <span className="mb-1 text-[10px] font-bold tabular-nums text-slate-700">{point.submission_pct}%</span>
              <div className="flex h-14 w-full items-end overflow-hidden rounded-t-md bg-white" title={`${point.submitted} of ${point.total_barangays} barangays reported in ${point.period.label}`}>
                <div className={`w-full rounded-t-md transition-[height] ${index === trendPoints.length - 1 ? "bg-emerald-600" : "bg-emerald-300"}`} style={{ height: `${point.submission_pct}%`, minHeight: point.submission_pct > 0 ? 3 : 0 }} />
              </div>
              <span className="mt-1 text-[10px] font-semibold text-slate-700">Q{point.period.quarter} {point.period.year}</span>
              <span className="text-[9px] tabular-nums text-slate-500">{point.submitted}/{point.total_barangays} reported</span>
            </div>)}
          </div> : null}
        </section>
      </div> : null}
    </section>
  );
}

export function AdminOperationsView() {
  return <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2"><ReviewWorkloadPanel /><CensusCoveragePanel /></div>;
}
