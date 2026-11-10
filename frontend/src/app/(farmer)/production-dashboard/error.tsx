"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ProductionDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SmartLivestock Production Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="size-7" />
      </div>
      <h2 className="text-xl font-black text-slate-900">
        Unable to load production form
      </h2>
      <p className="mt-2 text-sm text-slate-600 max-w-md">
        {error.message || "An issue occurred while opening the recording form."}
      </p>
      {error.digest && (
        <span className="mt-1 font-mono text-[11px] text-slate-400">
          Ref: {error.digest}
        </span>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          onClick={() => reset()}
          className="gap-2 bg-[#2D5A27] hover:bg-[#23471f] text-white"
        >
          <RefreshCw className="size-4" /> Try Again
        </Button>
        <Button asChild variant="outline">
          <Link href="/production-dashboard" className="gap-2">
            <ArrowLeft className="size-4" /> All Activities
          </Link>
        </Button>
      </div>
    </div>
  );
}
