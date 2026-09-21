"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope } from "lucide-react";

export default function SibatValidationRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sibat?tab=health");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
      <div className="size-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center animate-pulse">
        <Stethoscope className="size-6" />
      </div>
      <p className="text-sm font-bold text-slate-700">Connecting to Unified Field Inspection Center...</p>
      <p className="text-xs text-slate-400">Redirecting to clinical health & mortality visits...</p>
    </div>
  );
}