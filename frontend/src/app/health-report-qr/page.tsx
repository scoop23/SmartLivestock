"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function HealthReportQrRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  const recordType = searchParams.get("recordType")?.toUpperCase();
  const recordId = searchParams.get("recordId");
  const isValidReport = (recordType === "DISEASE" || recordType === "MORTALITY") &&
    !!recordId && /^\d+$/.test(recordId);
  const role = user?.role?.toUpperCase();
  const canViewReport = role === "ADMIN" || role === "MAO" || role === "SIBAT" || role === "CBAT" || role === "FARMER";

  useEffect(() => {
    if (!isValidReport || isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    const type = recordType as "DISEASE" | "MORTALITY";
    const id = recordId as string;
    if (role === "ADMIN" || role === "MAO") {
      router.replace(`/data-validation?domain=incidents&recordType=${type}&recordId=${id}`);
    } else if (role === "SIBAT" || role === "CBAT") {
      router.replace(`/sibat-alerts?recordType=${type}&recordId=${id}`);
    } else if (role === "FARMER") {
      const prefix = type === "DISEASE" ? "DIS" : "MOR";
      router.replace(`/report-observation?reportId=${prefix}-${id}`);
    }
  }, [isValidReport, isLoading, user, role, recordType, recordId, router]);

  if (!isValidReport) {
    return <main className="mx-auto max-w-lg p-8 text-center text-sm text-slate-600">This QR code does not contain a valid disease or mortality report reference.</main>;
  }
  if (!isLoading && user && !canViewReport) {
    return <main className="mx-auto max-w-lg p-8 text-center text-sm text-slate-600">Your account does not have a disease or mortality report view.</main>;
  }

  return (
    <main className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-slate-950 via-emerald-950 to-cyan-950 px-6 py-5 text-center text-white shadow-xl">
        <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
        <p className="text-sm font-bold">Opening health report</p>
        <p className="mt-1 text-xs text-cyan-100/80">Checking your SmartLivestock access…</p>
      </div>
    </main>
  );
}

export default function HealthReportQrPage() {
  return (
    <Suspense fallback={<main className="p-8 text-center text-sm text-slate-500">Loading report link…</main>}>
      <HealthReportQrRedirect />
    </Suspense>
  );
}
