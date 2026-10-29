"use client";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft,ClipboardList,Save } from "lucide-react";
import { useRouter,useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
    <div className="min-h-screen">
      <PageHeader
        title={
          submissionToRevise ? (
            <>
              <span className="hidden sm:inline">Correct Returned Census</span>
              <span className="sm:hidden">Revise Census</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">New Barangay Census Submission</span>
              <span className="sm:hidden">New Census</span>
            </>
          )
        }
        subtitle={
          <>
            <span className="hidden sm:inline">Record the quarterly livestock count and prepare it for municipal review.</span>
            <span className="sm:hidden">Record quarterly livestock counts.</span>
          </>
        }
        icon={<ClipboardList className="size-5 text-white" />}
        variant="farmer"
        hideIconOnMobile
        showTutorialToggle={false}
        mobileActionsInline
        maxWidthClass="w-full"
      />
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-4">
        <Button
          variant="outline"
          onClick={returnToCensus}
          className="gap-2 rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          Back to Records
        </Button>
      </div>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
    </div>
  );
}

export default function CensusSubmissionPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm font-bold text-slate-500">Opening census form...</div>}>
      <CensusSubmissionPageContent />
    </Suspense>
  );
}

