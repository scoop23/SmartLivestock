"use client";

import { Badge } from "@/components/ui/badge";
import { AlertCircle,CheckCircle2,Clock } from "lucide-react";
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
            Waiting for review
          </Badge>
          {showSubtitle && (
            <span className="text-[10px] text-amber-700 font-medium">
              No SIBAT review decision has been recorded yet.
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
            <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                className="text-sky-600"
                d="M12 1.5 15.2 4l4.1-.2.8 4 3 3-1.4 3.8.7 4.1-3.8 1.5-2.4 3.3-4-.9-3.8 1.1-2.1-3.5-3.8-1.3.5-4.1-1.6-3.7 2.9-3.1.5-4.1 4.1.1L12 1.5Z"
              />
              <path
                d="m7.7 12.1 3 3 5.9-6.1"
                fill="none"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
            </svg>
            Checked by SIBAT
          </Badge>
          {showSubtitle && (
            <span className="text-[10px] text-sky-700 font-medium">
              Sent to MAO for the final municipal decision.
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
            Approved by MAO
          </Badge>
          {showSubtitle && (
            <span className="text-[10px] text-emerald-700 font-medium">
              The municipal review is complete.
            </span>
          )}
        </div>
      );

    case "SUBJECT_TO_REVISION":
    case "SUBJECT_FOR_REVISION":
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <Badge
            className={`bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 font-bold text-xs rounded-lg px-2 py-0.5 shadow-2xs gap-1.5 ${className}`}
          >
            <AlertCircle className="size-3 text-rose-600" />
            Needs correction
          </Badge>
          {showSubtitle && (
            <span className="text-[10px] text-rose-700 font-medium">
              Read the reviewer remarks and correct the record before resubmitting.
            </span>
          )}
        </div>
      );

    case "FLAGGED":
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <Badge className={`bg-amber-50 text-amber-900 border-amber-200 font-bold text-xs rounded-lg px-2 py-0.5 gap-1.5 ${className}`}>
            <AlertCircle className="size-3 text-amber-700" />
            Flagged for checking
          </Badge>
          {showSubtitle && <span className="text-[10px] text-amber-800 font-medium">A concern needs follow-up.</span>}
        </div>
      );

    case "REJECTED":
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <Badge className={`bg-rose-50 text-rose-800 border-rose-200 font-bold text-xs rounded-lg px-2 py-0.5 gap-1.5 ${className}`}>
            <AlertCircle className="size-3 text-rose-600" />
            Rejected
          </Badge>
          {showSubtitle && <span className="text-[10px] text-rose-700 font-medium">The current review is closed. Check the remarks.</span>}
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
