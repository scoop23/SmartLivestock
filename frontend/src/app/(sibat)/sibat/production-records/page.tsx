"use client";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Milk } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import SibatReviewDialog from "../components/sibat-review-dialog";
import SibatProductionQueue, { type SibatProdStatusFilter } from "../components/sibat-production-queue";
import { useSibatSubmissions, type UnifiedSubmissionItem } from "../sibat-analytics";

function exportSubmissionsToCsv(items: UnifiedSubmissionItem[]) {
  const headers = ["ID", "Category", "Farmer", "Barangay", "Enterprise", "Yield / Quantity", "Date", "Status", "Notes"];
  const rows = items.map((i) => [
    i.id,
    i.submissionTypeLabel,
    `"${(i.farmerName || "").replace(/"/g, '""')}"`,
    `"${(i.barangayName || "").replace(/"/g, '""')}"`,
    `"${(i.livestockTypeName || "").replace(/"/g, '""')}"`,
    `"${(i.quantityDisplay || "").replace(/"/g, '""')}"`,
    i.recordDate || i.createdAt,
    i.status,
    `"${(i.notes || i.salePurpose || "").replace(/"/g, '""')}"`,
  ]);
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `production_logs_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

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

  const handleExport = () => {
    exportSubmissionsToCsv(productionSubmissions);
  };

  return (
    <>
      <PageHeader
        title={
          <>
            <span className="hidden sm:inline">Production, Sales & Calving Logs</span>
            <span className="sm:hidden">Production Logs</span>
          </>
        }
        subtitle={
          <>
            <span className="hidden sm:inline">
              {hasAllBarangayAccess
                ? "Review production measurements, live animal sales, and newborn calf birth records across authorized barangays."
                : `Review production measurements, live animal sales, and newborn calf birth records from ${user?.assignedBarangayName || "your assigned barangay"}.`}
            </span>
            <span className="sm:hidden">
              {hasAllBarangayAccess
                ? "Review and validate barangay production logs."
                : `Validate production logs for ${user?.assignedBarangayName || "assigned barangay"}.`}
            </span>
          </>
        }
        variant="farmer"
        maxWidthClass="w-full"
        icon={<Milk className="size-5 text-white" />}
        hideIconOnMobile
        showTutorialToggle={false}
        mobileActionsInline
        action={
          <button
            type="button"
            onClick={handleExport}
            aria-label="Export logs to CSV"
            title="Export logs to CSV"
            className="relative shrink-0 flex items-center justify-center h-11 w-11 sm:w-auto sm:px-3.5 rounded-xl sm:rounded-2xl border border-white/20 bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-95 cursor-pointer backdrop-blur-xs shadow-xs gap-2"
          >
            <FileText className="w-5 h-5" />
            <span className="hidden sm:inline">Export logs</span>
          </button>
        }
      />

      <main className="mx-auto w-full min-w-0 space-y-4 px-3.5 py-4 sm:p-6 lg:px-8">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Link href="/sibat" className="hover:text-slate-900 transition-colors">SmartLivestock</Link>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Data validation</span>
          </div>

          <Link
            href="/sibat"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to Field Review Hub
          </Link>
        </div>

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
          onExport={handleExport}
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
    </>
  );
}

export default function ProductionRecordReviewPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-slate-600">Loading production records…</main>}>
      <ProductionRecordReviewContent />
    </Suspense>
  );
}
