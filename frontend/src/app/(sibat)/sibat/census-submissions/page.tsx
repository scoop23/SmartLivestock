"use client";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import CensusDetailsDialog from "../census-details-dialog";
import { useCensusSubmission } from "../sibat-analytics";

function CensusSubmissionReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const censusId = searchParams.get("censusId");
  const { data: censuses = [], isLoading, isError, refetch } = useCensusSubmission();
  const submission = censuses.find((item) => String(item.id) === censusId) ?? null;
  const [focusedCensusId, setFocusedCensusId] = useState<string | null>(null);
  const highlightedCensusId = submission ? String(submission.id) : focusedCensusId;

  useEffect(() => {
    if (!highlightedCensusId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`census-submission-${highlightedCensusId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightedCensusId, censusId, censuses]);

  return (
    <>
      <PageHeader
        title={
          <>
            <span className="hidden sm:inline">Quarterly Census Submissions</span>
            <span className="sm:hidden">Census Submissions</span>
          </>
        }
        subtitle={
          <>
            <span className="hidden sm:inline">Review quarterly livestock census submissions from registered farmers.</span>
            <span className="sm:hidden">Review quarterly census submissions.</span>
          </>
        }
        variant="farmer"
        maxWidthClass="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        icon={<ClipboardList className="size-5 text-white" />}
        hideIconOnMobile
        showTutorialToggle={false}
        mobileActionsInline
        action={
          <button
            type="button"
            onClick={() => router.push("/sibat")}
            aria-label="Back to overview"
            title="Back to overview"
            className="relative shrink-0 flex items-center justify-center h-11 w-11 sm:w-auto sm:px-3.5 rounded-xl sm:rounded-2xl border border-white/20 bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-95 cursor-pointer backdrop-blur-xs shadow-xs gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to overview</span>
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Link href="/sibat" className="hover:text-slate-900 transition-colors">SmartLivestock</Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">Census Submissions</span>
        </div>
      {isLoading ? <p className="text-sm text-slate-600">Loading the selected submission…</p> : null}
      {isError ? <p role="alert" className="text-sm text-rose-700">The census submission could not be loaded. Please try again.</p> : null}
      {!isLoading && !submission && censusId ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          This census submission is unavailable in your review queue. It may have already been reviewed.
          <Button type="button" variant="link" onClick={() => void refetch()} className="ml-1">Refresh</Button>
        </section>
      ) : null}
      {!isLoading && !isError && censuses.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          No census submissions are available in your assigned barangay.
        </section>
      ) : null}
      <section aria-label="Census submission records" className="space-y-3">
        {censuses.map((record) => {
          const recordId = String(record.id);
          const isHighlighted = recordId === highlightedCensusId;
          return (
            <article
              key={recordId}
              id={`census-submission-${recordId}`}
              className={`rounded-xl border p-4 transition-colors sm:p-5 ${isHighlighted ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-300" : "border-slate-200 bg-white"}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-900">{record.barangay} · Q{record.reportQuarter} {record.reportYear}</h2>
                  <p className="mt-1 text-sm text-slate-600">{record.totalHeads} livestock heads · {record.totalFarmers} farmers</p>
                  <p className="mt-1 text-xs text-slate-500">Submitted by {record.submittedBy} · {record.status.replaceAll("_", " ")}</p>
                </div>
                <Button type="button" variant="outline" onClick={() => {
                  setFocusedCensusId(recordId);
                  router.push(`/sibat/census-submissions?censusId=${encodeURIComponent(recordId)}`, { scroll: false });
                }}>
                  View submission
                </Button>
              </div>
            </article>
          );
        })}
      </section>
      <CensusDetailsDialog
        submission={submission}
        open={submission !== null}
        onOpenChange={(open) => {
          if (!open) {
            if (submission) setFocusedCensusId(String(submission.id));
            router.replace("/sibat/census-submissions", { scroll: false });
          }
        }}
        onRevise={(item) => router.push(`/sibat/census/submit?revise=${item.id}`)}
      />
    </div>
    </>
  );
}

export default function CensusSubmissionReviewPage() {
  return <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading census submissions…</div>}><CensusSubmissionReviewContent /></Suspense>;
}
