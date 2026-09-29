"use client";

import Link from "next/link";
import { Layers, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CohortBatchesBanner() {
  return (
    <div className="bg-gradient-to-r from-[#1E4D2B] via-emerald-900 to-[#163b21] text-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
          <Layers className="size-5 text-emerald-300" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
              Municipal Cohort Batches &amp; Livestock Drilldown
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-mono">
              99 Batches • 300 Heads
            </span>
          </div>
          <p className="text-xs text-emerald-100/90 font-medium mt-0.5">
            Inspect registered livestock batches and drill down into individual ear tag biometrics, vaccination history, and pen housing.
          </p>
        </div>
      </div>
      <Link href="/data-validation/batches" className="shrink-0">
        <Button
          size="sm"
          className="w-full sm:w-auto bg-white text-[#1E4D2B] hover:bg-emerald-50 font-bold text-xs rounded-xl shadow-xs gap-1.5 h-9"
        >
          <span>Inspect Batches &amp; Drilldown</span>
          <ChevronRight className="size-4" />
        </Button>
      </Link>
    </div>
  );
}