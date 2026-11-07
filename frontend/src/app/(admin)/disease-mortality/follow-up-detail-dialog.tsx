"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileText, UserRound } from "lucide-react";
import type { ValidationIncidentItem } from "../data-validation/validation-analytics";

interface FollowUpEvent {
  id: number;
  event_type: string;
  observed_on: string;
  notes: string;
  created_at: string;
  created_by_name: string;
  created_by_role: string;
}

interface FollowUpResponse {
  case_id: number;
  events: FollowUpEvent[];
}

interface DiseaseFollowUpDetailDialogProps {
  record: ValidationIncidentItem | null;
  followUpId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDate = (value: string, includeTime = false) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-PH", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
};

export function DiseaseFollowUpDetailDialog({
  record,
  followUpId,
  open,
  onOpenChange,
}: DiseaseFollowUpDetailDialogProps) {
  const caseId = String(record?.id ?? "").replace(/^dis-/i, "");
  const validCaseId = /^\d+$/.test(caseId);
  const { data, isLoading, isError } = useQuery<FollowUpResponse>({
    queryKey: ["disease-case-follow-ups", caseId],
    queryFn: async () => {
      const response = await api.get<FollowUpResponse>(`diseases/cases/${caseId}/follow-ups/`);
      return response.data;
    },
    enabled: open && validCaseId,
  });

  const farmerEvents = (data?.events ?? []).filter((event) => event.event_type === "FARMER_UPDATE");
  const selectedEvent = followUpId && followUpId !== "latest"
    ? farmerEvents.find((event) => String(event.id) === followUpId)
    : farmerEvents[farmerEvents.length - 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>Farmer Follow-up Observation</DialogTitle>
            <Badge className="border border-amber-200 bg-amber-50 text-amber-800">Needs Review</Badge>
          </div>
          <DialogDescription>
            Disease report DIS-{caseId}. This observation is separate from the original disease report review.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">Loading follow-up observation…</p>
        ) : isError ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            Could not load this follow-up observation. Close the dialog and try again.
          </p>
        ) : !selectedEvent ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            No farmer follow-up observation was found for this report.
          </p>
        ) : (
          <div className="space-y-4">
            <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 size-4 text-slate-500" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Observed on</p>
                  <p className="text-sm font-semibold text-slate-900">{formatDate(selectedEvent.observed_on)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <UserRound className="mt-0.5 size-4 text-slate-500" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Submitted by</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedEvent.created_by_name}</p>
                  <p className="text-xs text-slate-500">{selectedEvent.created_by_role}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 sm:col-span-2">
                <FileText className="mt-0.5 size-4 text-slate-500" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Submitted</p>
                  <p className="text-sm font-semibold text-slate-900">{formatDate(selectedEvent.created_at, true)}</p>
                </div>
              </div>
            </section>

            <section className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <h3 className="text-xs font-black uppercase tracking-wide text-emerald-950">Farmer observation</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{selectedEvent.notes}</p>
            </section>

            {record && (
              <section className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                <h3 className="text-xs font-black uppercase tracking-wide text-sky-950">
                  {record.sibatInspection?.verifiedRole || "CBAT"} Field Verification Findings
                </h3>
                <p className="text-sm text-slate-800">
                  Inspecting officer: <strong>{record.sibatInspection?.verifiedBy || "Not recorded"}</strong>
                </p>
                {record.sibatInspection?.remarks && (
                  <p className="text-sm italic leading-relaxed text-slate-700">“{record.sibatInspection.remarks}”</p>
                )}
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
