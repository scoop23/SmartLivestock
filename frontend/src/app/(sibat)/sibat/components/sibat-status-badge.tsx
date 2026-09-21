"use client";

import { CheckCircle2, Clock, Sparkles, AlertCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { UnifiedStatus } from "../sibat-analytics";

interface SibatStatusBadgeProps {
  status: UnifiedStatus | "FLAGGED" | "FALSE_ALARM" | string;
  className?: string;
  showSubtitle?: boolean;
}

export default function SibatStatusBadge({
  status,
  className = "",
  showSubtitle = false,
}: SibatStatusBadgeProps) {
  const normStatus = (status || "PENDING").toUpperCase();

  switch (normStatus) {
    case "PENDING":
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <Badge
            className={`bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100 font-bold text-xs rounded-lg px-2 py-0.5 shadow-2xs gap-1.5 ${className}`}
          >
            <Clock className="size-3 text-amber-600" />
            Needs Field Check
          </Badge>
          {showSubtitle && (
            <span className="text-[10px] text-amber-700 font-medium">
              Waiting for your on-farm visit
            </span>
          )}
        </div>
      );

    case "VERIFIED":
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <Badge
            className={`bg-sky-50 text-sky-800 border-sky-200/80 hover:bg-sky-100 font-bold text-xs rounded-lg px-2 py-0.5 shadow-2xs gap-1.5 ${className}`}
          >
            <Sparkles className="size-3 text-sky-600" />
            SIBAT Verified
          </Badge>
          {showSubtitle && (
            <span className="text-[10px] text-sky-700 font-medium">
              Forwarded to MAO for final approval
            </span>
          )}
        </div>
      );

    case "APPROVED":
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <Badge
            className={`bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100 font-bold text-xs rounded-lg px-2 py-0.5 shadow-2xs gap-1.5 ${className}`}
          >
            <CheckCircle2 className="size-3 text-emerald-600" />
            MAO Certified
          </Badge>
          {showSubtitle && (
            <span className="text-[10px] text-emerald-700 font-medium">
              Officially recorded in municipal database
            </span>
          )}
        </div>
      );

    case "REJECTED":
    case "FLAGGED":
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <Badge
            className={`bg-rose-50 text-rose-800 border-rose-200/80 hover:bg-rose-100 font-bold text-xs rounded-lg px-2 py-0.5 shadow-2xs gap-1.5 ${className}`}
          >
            <AlertCircle className="size-3 text-rose-600" />
            Needs Attention
          </Badge>
          {showSubtitle && (
            <span className="text-[10px] text-rose-700 font-medium">
              Returned or flagged for correction
            </span>
          )}
        </div>
      );

    default:
      return (
        <Badge
          className={`bg-slate-100 text-slate-700 border-slate-200 text-xs font-bold rounded-lg px-2 py-0.5 ${className}`}
        >
          {status}
        </Badge>
      );
  }
}
