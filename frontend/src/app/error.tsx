"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SmartLivestock Application Error]", error);
    try {
      localStorage.setItem(
        "smartlivestock_last_error",
        JSON.stringify({
          message: error.message,
          stack: error.stack,
          digest: error.digest,
          timestamp: new Date().toISOString(),
          url: typeof window !== "undefined" ? window.location.href : "",
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="size-7" />
      </div>
      <h2 className="text-xl font-black text-slate-900 dark:text-white">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md">
        {error.message || "An unexpected error occurred while loading this view."}
      </p>
      {error.digest && (
        <span className="mt-1 font-mono text-[11px] text-slate-400">
          Ref: {error.digest}
        </span>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          onClick={() => {
            if (/chunk|module factory/i.test(error.message)) window.location.reload();
            else reset();
          }}
          className="gap-2 bg-[#2D5A27] hover:bg-[#23471f] text-white"
        >
          <RefreshCw className="size-4" /> Try Again
        </Button>
        <Button asChild variant="outline">
          <Link href="/farmer" className="gap-2">
            <Home className="size-4" /> Return to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
