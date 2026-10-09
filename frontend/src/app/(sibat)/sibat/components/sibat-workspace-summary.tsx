"use client";

import { useMemo } from "react";
import { CalendarDays, ClipboardCheck, QrCode, RefreshCw, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UnifiedSubmissionItem, CensusSubmissionRecord } from "../sibat-analytics";
import type { SibatValidationRecord } from "@/app/(sibat)/sibat-validation/sibat-inspection-dialog";

interface SibatWorkspaceSummaryProps {
  scopeLabel: string;
  submissions: UnifiedSubmissionItem[];
  healthRecords: SibatValidationRecord[];
  censuses: CensusSubmissionRecord[];
  isLoading: boolean;
  isRefreshing: boolean;
  onReviewRecords: () => void;
  onFindFarmer: () => void;
  onScan: () => void;
  onNewCensus: () => void;
  onRefresh: () => void;
}

const isReturned = (status: string) => ["SUBJECT_TO_REVISION", "SUBJECT_FOR_REVISION"].includes(status);

export function SibatWorkspaceSummary({
  scopeLabel,
  submissions,
  healthRecords,
  censuses,
  isLoading,
  isRefreshing,
  onReviewRecords,
  onFindFarmer,
  onScan,
  onNewCensus,
  onRefresh,
}: SibatWorkspaceSummaryProps) {
  const taskCounts = useMemo(() => {
    const all = [...submissions, ...healthRecords.map((record) => ({ farmerName: record.farmerName, status: record.status }))];
    const pending = all.filter((record) => record.status === "PENDING");
    return {
      farmers: new Set(pending.map((record) => record.farmerName.trim().toLocaleLowerCase()).filter(Boolean)).size,
      waiting: pending.length + censuses.filter((census) => census.status === "PENDING").length,
      sent: all.filter((record) => record.status === "VERIFIED").length + censuses.filter((census) => census.status === "VERIFIED").length,
      returned: all.filter((record) => isReturned(record.status)).length + censuses.filter((census) => isReturned(census.status)).length,
    };
  }, [submissions, healthRecords, censuses]);

  const recentActivities = useMemo(() => {
    const items = [
      ...submissions.map((item) => ({
        id: item.id,
        date: item.createdAt || item.recordDate,
        title: item.submissionTypeLabel,
        detail: `${item.farmerName} · ${item.barangayName}`,
        status: item.status,
      })),
      ...healthRecords.map((item) => ({
        id: item.id,
        date: item.reportedAt || item.reportedDate,
        title: item.reportType === "MORTALITY" ? "Mortality report" : "Health report",
        detail: `${item.farmerName} · ${item.barangayName}`,
        status: item.status,
      })),
      ...censuses.map((item) => ({
        id: `census-${item.id}`,
        date: item.submissionDate,
        title: `Census · Q${item.reportQuarter} ${item.reportYear}`,
        detail: `${item.barangay} · ${item.submittedBy}`,
        status: item.status,
      })),
    ];
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4);
  }, [submissions, healthRecords, censuses]);

  const tasks = [
    { label: "Farmers to assist", value: taskCounts.farmers, detail: "with records waiting for your check" },
    { label: "Waiting for review", value: taskCounts.waiting, detail: "across the visible queues" },
    { label: "Sent to MAO", value: taskCounts.sent, detail: "SIBAT-checked; municipal decision pending" },
    { label: "Needs correction", value: taskCounts.returned, detail: "review the remarks and next step" },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-semibold text-slate-500">Assigned review workspace · {scopeLabel}</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Today’s field work</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Compare the farmer’s report with what you confirm on site. A SIBAT check sends the record to MAO; MAO makes the final decision.
          </p>
          <p className="mt-2 text-xs text-slate-500">This account is in SIBAT review mode. Personal farm records require the separate Farmer account and are not shown here.</p>
        </div>
        <Button type="button" variant="outline" onClick={onRefresh} disabled={isRefreshing} className="min-h-11 shrink-0">
          <RefreshCw className={`mr-2 size-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh queues
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tasks.map((task) => (
          <div key={task.label} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <p className="text-xs font-semibold text-slate-600">{task.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{isLoading ? "—" : task.value}</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{task.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button type="button" onClick={onReviewRecords} className="min-h-12 justify-start gap-2 bg-[#1A365D] text-white hover:bg-[#142a4a]"><ClipboardCheck className="size-4" />Review records</Button>
        <Button type="button" variant="outline" onClick={onFindFarmer} className="min-h-12 justify-start gap-2"><Search className="size-4" />Find a farmer</Button>
        <Button type="button" variant="outline" onClick={onScan} className="min-h-12 justify-start gap-2"><QrCode className="size-4" />Scan livestock QR</Button>
        <Button type="button" variant="outline" onClick={onNewCensus} className="min-h-12 justify-start gap-2"><CalendarDays className="size-4" />Record census</Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <UsersRound className="size-4 text-slate-600" />
          <h2 className="text-sm font-bold text-slate-900">Recent field activity</h2>
        </div>
        {recentActivities.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No recent submissions are available in this review scope.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentActivities.map((activity) => (
              <li key={activity.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{activity.title}</p>
                  <p className="break-words text-xs text-slate-600">{activity.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                  <span>{Number.isNaN(new Date(activity.date).getTime()) ? "Date not recorded" : new Date(activity.date).toLocaleDateString()}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{activity.status.replaceAll("_", " ")}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
