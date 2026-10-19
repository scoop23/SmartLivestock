"use client";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import SibatReviewDialog from "../components/sibat-review-dialog";
import SibatProductionQueue, { type SibatProdStatusFilter } from "../components/sibat-production-queue";
import { useSibatSubmissions, type UnifiedSubmissionItem } from "../sibat-analytics";

function ProductionRecordReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const reviewType = searchParams.get("reviewType");
  const reviewId = searchParams.get("reviewId");
  const { user, isLoading: isAuthLoading } = useAuth();
  const { submissions, isLoading, isError, refetch } = useSibatSubmissions();
  const allowedTypes = ["PRODUCTION", "SALE", "CALVING"];
  const hasAllBarangayAccess = user?.accessScope === "ALL_BARANGAYS";
  const assignedBarangay = (user?.assignedBarangayName || user?.barangay || "").trim().toLocaleLowerCase();
  const hasBarangayAssignment = hasAllBarangayAccess || assignedBarangay.length > 0;
  const productionSubmissions = submissions.filter((item) =>
    allowedTypes.includes(item.sourceType) &&
    (hasAllBarangayAccess || (
      assignedBarangay.length > 0 &&
      item.barangayName.trim().toLocaleLowerCase() === assignedBarangay
    )),
  );
  const pageIsLoading = isAuthLoading || isLoading;
  const submission = productionSubmissions.find(
    (item) => item.sourceType === reviewType && String(item.rawId) === reviewId,
  ) ?? null;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SibatProdStatusFilter>("all");
  const [prodTypeFilter, setProdTypeFilter] = useState("ALL");
  const [focusedRecordId, setFocusedRecordId] = useState<string | null>(null);

  const closeReview = () => {
    if (submission) setFocusedRecordId(submission.id);
    router.replace("/sibat/production-records", { scroll: false });
  };
  const openReview = (item: UnifiedSubmissionItem) => {
    setFocusedRecordId(item.id);
    router.push(`/sibat/production-records?reviewType=${item.sourceType}&reviewId=${item.rawId}`, { scroll: false });
  };

  return (
    <main className="w-full max-w-none space-y-4 p-4 sm:p-6">
      <Button type="button" variant="outline" onClick={() => router.push("/sibat")}>
        ← Back to Overview
      </Button>
      <PageHeader
        title="Production Records"
        subtitle={hasAllBarangayAccess
          ? "Review production, sales, and calving submissions across authorized barangays."
          : `Review production, sales, and calving submissions from ${user?.assignedBarangayName || "your assigned barangay"}.`}
      />
      <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5">
        <h2 className="font-bold text-emerald-950">Production review queue</h2>
        <p className="mt-1 text-sm text-emerald-900/80">
          Review production yields, livestock sales, and calving submissions. Select a record to inspect its details and submit your review.
        </p>
      </section>
      {isError ? (
        <section role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-rose-800">Some record categories could not be loaded. Refresh to try again.</p>
          <Button type="button" variant="outline" onClick={() => void refetch()} className="border-rose-300 text-rose-800">Refresh records</Button>
        </section>
      ) : null}
      {!isAuthLoading && !hasBarangayAssignment ? (
        <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No barangay is assigned to your account. Contact the MAO administrator to set your work area.
        </section>
      ) : null}
      {!pageIsLoading && !submission && reviewId ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This record is unavailable in your assigned barangay review queue. It may have already been reviewed, removed, or belong to another barangay.
          <Button type="button" variant="link" onClick={closeReview} className="ml-1 text-amber-900">Return to records</Button>
        </section>
      ) : null}
      <SibatProductionQueue
        submissions={productionSubmissions}
        isLoading={pageIsLoading}
        onReview={openReview}
        focusRecordId={submission?.id ?? focusedRecordId}
        scrollFocusKey={`${reviewId ?? "closed"}:${focusedRecordId ?? ""}`}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        prodTypeFilter={prodTypeFilter}
        onProdTypeFilterChange={setProdTypeFilter}
      />
      {submission ? (
        <SibatReviewDialog
          submission={submission}
          open
          onOpenChange={(open) => { if (!open) closeReview(); }}
          onReviewSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["sibat-production-records"] });
            void queryClient.invalidateQueries({ queryKey: ["sibat-sales-records"] });
            void queryClient.invalidateQueries({ queryKey: ["sibat-calving-records"] });
          }}
        />
      ) : null}
    </main>
  );
}

export default function ProductionRecordReviewPage() {
  return <Suspense fallback={<main className="p-6 text-sm text-slate-600">Loading production records…</main>}><ProductionRecordReviewContent /></Suspense>;
}
