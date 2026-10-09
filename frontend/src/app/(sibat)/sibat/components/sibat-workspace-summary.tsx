"use client";

import { useMemo } from "react";
import { CalendarDays, ClipboardCheck, Clock3, QrCode, RefreshCw, RotateCcw, Search, Send, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
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
  const allSubmissions = [
    ...submissions,
    ...healthRecords.map((record) => ({ farmerName: record.farmerName, status: record.status })),
  ];
  const pendingSubmissions = allSubmissions.filter((record) => record.status === "PENDING");
  const taskMetrics = [
    {
      title: "Farmers to assist",
      value: new Set(pendingSubmissions.map((record) => record.farmerName.trim().toLocaleLowerCase()).filter(Boolean)).size,
      badge: "Needs check",
      description: "Farmers with records waiting for a field check",
      icon: <UsersRound className="size-5" />,
      variant: "amber" as const,
    },
    {
      title: "Waiting for review",
      value: pendingSubmissions.length + censuses.filter((record) => record.status === "PENDING").length,
      badge: "Pending",
      description: "Submissions across your authorized queues",
      icon: <Clock3 className="size-5" />,
      variant: "default" as const,
    },
    {
      title: "Sent to MAO",
      value: allSubmissions.filter((record) => record.status === "VERIFIED").length + censuses.filter((record) => record.status === "VERIFIED").length,
      badge: "Verified",
      description: "Waiting for municipal decision",
      icon: <Send className="size-5" />,
      variant: "sky" as const,
    },
    {
      title: "Needs correction",
      value: allSubmissions.filter((record) => ["SUBJECT_TO_REVISION", "SUBJECT_FOR_REVISION"].includes(record.status)).length + censuses.filter((record) => ["SUBJECT_TO_REVISION", "SUBJECT_FOR_REVISION"].includes(record.status)).length,
      badge: "Returned",
      description: "Records needing updates before resubmission",
      icon: <RotateCcw className="size-5" />,
      variant: "rose" as const,
    },
  ];

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

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-stretch">
      <div className="min-w-0 space-y-4">
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

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {taskMetrics.map((metric) => (
          <KpiCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            badge={metric.badge}
            description={metric.description}
            icon={metric.icon}
            variant={metric.variant}
            isLoading={isLoading}
            wrapText
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button type="button" onClick={onReviewRecords} className="min-h-12 justify-start gap-2 bg-[#1A365D] text-white hover:bg-[#142a4a]"><ClipboardCheck className="size-4" />Review records</Button>
        <Button type="button" variant="outline" onClick={onFindFarmer} className="min-h-12 justify-start gap-2"><Search className="size-4" />Find a farmer</Button>
        <Button type="button" variant="outline" onClick={onScan} className="min-h-12 justify-start gap-2"><QrCode className="size-4" />Scan livestock QR</Button>
        <Button type="button" variant="outline" onClick={onNewCensus} className="min-h-12 justify-start gap-2"><CalendarDays className="size-4" />Record census</Button>
      </div>

      </div>

      <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 xl:h-full">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
          <UsersRound className="size-4 text-slate-600" />
          <h2 className="text-sm font-bold text-slate-900">Recent field activity</h2>
          </div>
          <span className="text-[11px] font-medium text-slate-500">Latest 4</span>
        </div>
        {isLoading ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Loading recent activity…</p>
        ) : recentActivities.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No recent submissions are available in this review scope.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentActivities.map((activity) => (
              <li key={activity.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{activity.title}</p>
                  <p className="break-words text-xs text-slate-600">{activity.detail}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{Number.isNaN(new Date(activity.date).getTime()) ? "Date not recorded" : new Date(activity.date).toLocaleDateString()}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{activity.status.replaceAll("_", " ")}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </section>
  );
}
