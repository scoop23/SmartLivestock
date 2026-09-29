"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, ClipboardList } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import CensusSubmissionForm from "../../census-submission-form";
import { useCensusSubmission } from "../../sibat-analytics";

function CensusSubmissionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const revisionId = searchParams.get("revise");
  const { data: censuses = [], isLoading } = useCensusSubmission();
  const submissionToRevise = revisionId
    ? censuses.find((record) => String(record.id) === revisionId) ?? null
    : null;

  const returnToCensus = () => router.push("/sibat?tab=census");

  if (revisionId && isLoading) {
    return <div className="p-10 text-center text-sm font-bold text-slate-500">Loading returned census...</div>;
  }

  if (revisionId && !submissionToRevise) {
    return (
      <div className="p-8 space-y-4 text-center">
        <p className="font-bold text-rose-700">The returned census could not be found.</p>
        <Button onClick={returnToCensus}>Return to Census Records</Button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb]">
      <PageHeader
        title={submissionToRevise ? "Correct Returned Census" : "New Barangay Census"}
        subtitle="Record the quarterly livestock count and prepare it for municipal review"
        icon={<ClipboardList className="size-5 text-white" />}
        variant="sibat"
        maxWidthClass="w-full"
        action={
          <Button
            variant="outline"
            onClick={returnToCensus}
            className="gap-2 rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back to Records</span>
            <span className="sm:hidden">Back</span>
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-white/80 px-4 py-3 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/70">
          <Save className="size-4 shrink-0 text-emerald-700" />
          Your draft saves automatically on this device while you work.
        </div>
      <CensusSubmissionForm
        open
        onOpenChange={(open) => {
          if (!open) returnToCensus();
        }}
        submissionToRevise={submissionToRevise}
        onSubmissionSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["census-submissions"] });
          returnToCensus();
        }}
      />
      </div>
    </main>
  );
}

export default function CensusSubmissionPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm font-bold text-slate-500">Opening census form...</div>}>
      <CensusSubmissionPageContent />
    </Suspense>
  );
}

