"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { formatCalendarDate, localCalendarDateToday } from "@/lib/livestock-age";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AlertCircle, History, Send } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

type EventType = "FARMER_UPDATE" | "RECOVERED" | "CLOSED";

interface FollowUpEvent {
  id: number;
  event_type: EventType;
  observed_on: string;
  notes: string;
  created_at: string;
  created_by_name: string;
  created_by_role: string;
}

interface CaseFollowUps {
  case_id: number;
  report_status: string;
  report_date: string | null;
  clinical_status: "NOT_RECORDED" | "OPEN" | "RECOVERED" | "CLOSED";
  can_submit_update: boolean;
  can_resolve: boolean;
  events: FollowUpEvent[];
}

const statusLabels: Record<string, string> = {
  NOT_RECORDED: "Resolution not recorded",
  OPEN: "Awaiting resolution",
  RECOVERED: "Recovered",
  CLOSED: "Closed",
};

function errorMessage(error: unknown): string {
  if (isAxiosError<Record<string, unknown>>(error) && error.response?.data) {
    for (const value of Object.values(error.response.data)) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }
  return "The case could not be updated. Please try again.";
}

/** Shared by Farmer, CBAT/SIBAT and municipal report dialogs. The API owns permissions. */
export function DiseaseCaseFollowUp({ caseId }: { caseId: string | number }) {
  const id = String(caseId).match(/\d+$/)?.[0];
  const fieldId = useId();
  const { user } = useAuth();
  const client = useQueryClient();
  const [observedOn, setObservedOn] = useState(localCalendarDateToday);
  const [notes, setNotes] = useState("");
  const [resolution, setResolution] = useState<"RECOVERED" | "CLOSED">("RECOVERED");

  const queryKey = [
    "disease-follow-ups",
    id,
    user?.email,
    user?.role,
    user?.accessScope,
    user?.assignedBarangayId,
  ];

  const query = useQuery({
    queryKey,
    enabled: Boolean(id && user),
    queryFn: async ({ signal }) =>
      (await api.get<CaseFollowUps>(`diseases/cases/${id}/follow-ups/`, { signal })).data,
  });

  const mutation = useMutation({
    mutationKey: ["disease-follow-up", id],
    mutationFn: async (eventType: EventType) =>
      (
        await api.post<CaseFollowUps>(`diseases/cases/${id}/follow-ups/`, {
          event_type: eventType,
          observed_on: observedOn,
          notes: notes.trim(),
        })
      ).data,
    onSuccess: async (data) => {
      client.setQueryData(queryKey, data);
      setNotes("");
      toast.success("Case history updated");
      await client.invalidateQueries({
        predicate: (entry) =>
          entry.queryKey.some(
            (part) =>
              typeof part === "string" &&
              /disease|health|clinical|analytics|gis|incident|notification/i.test(part)
          ),
      });
    },
  });

  if (!id) return <p role="alert">This report has no valid case identifier.</p>;
  if (query.isPending) return <Skeleton className="h-32 w-full rounded-2xl" />;
  if (query.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-xs text-rose-800 space-y-2">
        <p role="alert" className="font-bold">Follow-up history could not be loaded.</p>
        <Button size="sm" variant="outline" onClick={() => void query.refetch()} className="text-xs h-8 rounded-lg">
          Retry history
        </Button>
      </div>
    );
  }

  const data = query.data;
  const canAct = data.can_submit_update || data.can_resolve;
  const isResolved = data.clinical_status === "RECOVERED" || data.clinical_status === "CLOSED";

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 sm:p-5 space-y-4 print:break-inside-avoid">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 shadow-2xs">
              <AlertCircle className="size-4 text-amber-700" />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              Follow-up & case resolution
            </h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${
              data.clinical_status === "NOT_RECORDED"
                ? "border-amber-300 bg-amber-100 text-amber-900"
                : data.clinical_status === "RECOVERED"
                ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                : "border-slate-300 bg-slate-100 text-slate-800"
            }`}
          >
            {statusLabels[data.clinical_status] || data.clinical_status}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pl-0 sm:pl-10">
          Your observations request a follow-up. CBAT or MAO records the official outcome separately from report approval.
        </p>
      </div>

      {canAct ? (
        <form
          className="space-y-3.5 print:hidden pl-0 sm:pl-10"
          onSubmit={(event) => {
            event.preventDefault();
            if (!mutation.isPending) {
              mutation.mutate(data.can_submit_update ? "FARMER_UPDATE" : resolution);
            }
          }}
        >
          {data.can_resolve && (
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-outcome`} className="text-xs font-bold text-slate-700">
                Official outcome
              </Label>
              <Select
                value={resolution}
                onValueChange={(value: "RECOVERED" | "CLOSED") => setResolution(value)}
                disabled={mutation.isPending}
              >
                <SelectTrigger id={`${fieldId}-outcome`} className="w-full bg-white rounded-xl border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECOVERED">Recovered</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-date`} className="text-xs font-bold text-slate-700">
              {data.can_submit_update ? "Follow-up date" : "Resolution date"}
            </Label>
            <Input
              id={`${fieldId}-date`}
              type="date"
              required
              min={data.report_date ?? undefined}
              max={localCalendarDateToday()}
              value={observedOn}
              disabled={mutation.isPending}
              onChange={(event) => setObservedOn(event.target.value)}
              className="bg-white rounded-xl border-slate-200 h-10 text-xs sm:text-sm font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-notes`} className="text-xs font-bold text-slate-700">
              {data.can_submit_update ? "What changed or improved?" : "Resolution remarks"}
            </Label>
            <Textarea
              id={`${fieldId}-notes`}
              required
              maxLength={2000}
              rows={3}
              value={notes}
              disabled={mutation.isPending}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                data.can_submit_update
                  ? "Describe what you noticed and any follow-up you need..."
                  : "Record the assessment and reason for this outcome."
              }
              className="bg-white rounded-xl border-slate-200 text-xs sm:text-sm resize-y leading-relaxed"
            />
          </div>

          {mutation.isError && (
            <p role="alert" className="text-xs font-bold text-rose-700">
              {errorMessage(mutation.error)}
            </p>
          )}

          <Button
            type="submit"
            disabled={mutation.isPending || !notes.trim() || !observedOn}
            className="w-full h-11 rounded-xl bg-[#1A3D22] hover:bg-[#142f1a] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <Send className="size-4" />
            <span>
              {mutation.isPending
                ? "Saving…"
                : data.can_submit_update
                ? "Send follow-up to officers"
                : "Record official resolution"}
            </span>
          </Button>
        </form>
      ) : (
        <p className="text-xs sm:text-sm text-slate-500 pl-0 sm:pl-10 leading-relaxed">
          {data.report_status !== "APPROVED"
            ? "Follow-up and resolution become available after MAO approves the report."
            : isResolved
            ? "This case has an official outcome. Submit a new health report for a new concern."
            : "You can view the history. Official resolution is recorded by scoped CBAT or MAO."}
        </p>
      )}

      {/* Case Events History */}
      {data.events.length > 0 && (
        <div className="space-y-2.5 pt-3 border-t border-amber-200/60" aria-label="Case follow-up history">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <History className="size-3.5 text-slate-500" />
            Previous Updates ({data.events.length})
          </h4>
          <div className="space-y-2">
            {data.events.map((entry) => (
              <article
                key={entry.id}
                className="rounded-xl border border-amber-200/70 bg-white/90 p-3 text-xs space-y-1 shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded-md text-[10px]">
                    {entry.event_type === "FARMER_UPDATE" ? "Farmer follow-up" : statusLabels[entry.event_type]}
                  </span>
                  <time dateTime={entry.observed_on} className="text-slate-400 font-semibold text-[11px]">
                    {formatCalendarDate(entry.observed_on)}
                  </time>
                </div>
                <p className="font-bold text-slate-800 text-[11px]">
                  {entry.created_by_name} · <span className="text-slate-500 font-medium">{entry.created_by_role}</span>
                </p>
                <p className="text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                  {entry.notes}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
