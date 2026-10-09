"use client";

import { useState } from "react";
import { ClipboardList, RotateCw, Users, Boxes, FileCheck2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CensusAnalyticsCharts from "./census-analytics-charts";
import { useCensusAnalytics } from "./census-analytics";

export default function CensusAnalyticsPage() {
  // Undefined period = "let the backend pick the newest quarter with data".
  const [periodKey, setPeriodKey] = useState<string>("latest");

  const selected =
    periodKey === "latest" ? null : periodKey.split("-").map(Number);
  const { data, isLoading, isFetching, isError, refetch } = useCensusAnalytics(
    selected?.[0],
    selected?.[1]
  );

  const periodLabel = data?.period.label ?? "—";
  const hasSubmissions = (data?.totals.submissions ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Census Analytics"
        subtitle={`Padre Garcia Municipal Agriculture Office — Quarterly Livestock Census Coverage (${periodLabel})`}
        variant="admin"
        maxWidthClass="w-full"
        icon={<ClipboardList className="size-5 text-slate-800" />}
        action={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="w-10 h-10 rounded-xl bg-slate-900/[0.06] hover:bg-slate-900/10 border border-slate-200 text-slate-800 cursor-pointer shrink-0"
            title="Refresh census analytics"
          >
            <RotateCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5">
        {/* Period selector + provenance note */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#f0f7ee] text-[#2D5A27]">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 tracking-tight">
                Quarterly Census Reporting
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                Aggregated live from census submissions — no estimated figures
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={periodKey} onValueChange={setPeriodKey}>
              <SelectTrigger
                className="h-9 w-[170px] rounded-xl border-slate-200 text-xs font-bold"
                aria-label="Reporting quarter"
              >
                <SelectValue placeholder="Select quarter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest reported quarter</SelectItem>
                {(data?.available_periods ?? []).map((period) => (
                  <SelectItem
                    key={`${period.year}-${period.quarter}`}
                    value={`${period.year}-${period.quarter}`}
                  >
                    Q{period.quarter} {period.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <KpiCard key={index} title="Loading" value="—" isLoading />
            ))}
          </div>
        ) : isError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <h3 className="text-sm font-black text-red-800">
              Unable to load census analytics
            </h3>
            <p className="text-xs text-red-600 mt-1 font-medium">
              The census report could not be retrieved. Please try again.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-red-700 hover:bg-red-800 text-white rounded-xl gap-2 h-10 px-4 text-xs font-bold cursor-pointer"
              onClick={() => refetch()}
            >
              <RotateCw className="size-4" /> Retry
            </Button>
          </div>
        ) : data ? (
          <>
            {/* Coverage KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
              <KpiCard
                title="Heads Reported"
                value={data.totals.heads.toLocaleString()}
                icon={<Boxes className="w-4 h-4" />}
                description={periodLabel}
                variant="emerald"
              />
              <KpiCard
                title="Census Batches"
                value={data.totals.submissions.toLocaleString()}
                icon={<ClipboardList className="w-4 h-4" />}
                description="Submitted this quarter"
                variant="sky"
              />
              <KpiCard
                title="Farmers Counted"
                value={data.totals.farmers.toLocaleString()}
                icon={<Users className="w-4 h-4" />}
                description="Across all batches"
                variant="stone"
              />
              <KpiCard
                title="Barangay Coverage"
                value={`${data.coverage.submission_pct}%`}
                icon={<FileCheck2 className="w-4 h-4" />}
                description={`${data.coverage.submitted} of ${data.coverage.total_barangays} reported`}
                variant="orange"
              />
              <KpiCard
                title="Needs Revision"
                value={(
                  data.coverage.by_status.SUBJECT_TO_REVISION ?? 0
                ).toLocaleString()}
                icon={<AlertTriangle className="w-4 h-4" />}
                description="Returned to SIBAT"
                variant="rose"
              />
            </div>

            {hasSubmissions ? (
              <CensusAnalyticsCharts data={data} />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-12 text-center">
                <ClipboardList className="size-8 text-slate-300 mx-auto" />
                <h3 className="text-sm font-black text-slate-700 mt-2">
                  No census batches recorded for {periodLabel}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium max-w-md mx-auto">
                  Nothing has been submitted for this quarter yet. SIBAT creates a
                  census batch per barangay, and the charts populate as soon as
                  the first one is filed.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}
