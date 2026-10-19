"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { formatCalendarDate,localCalendarDateToday } from "@/lib/livestock-age";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useId,useState } from "react";
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

const statusLabels = {
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
  const queryKey = ["disease-follow-ups", id, user?.email, user?.role, user?.accessScope, user?.assignedBarangayId];
  const query = useQuery({
    queryKey,
    enabled: Boolean(id && user),
    queryFn: async ({ signal }) => (
      await api.get<CaseFollowUps>(`diseases/cases/${id}/follow-ups/`, { signal })
    ).data,
  });
  const mutation = useMutation({
    mutationKey: ["disease-follow-up", id],
    mutationFn: async (eventType: EventType) => (
      await api.post<CaseFollowUps>(`diseases/cases/${id}/follow-ups/`, {
        event_type: eventType, observed_on: observedOn, notes: notes.trim(),
      })
    ).data,
    onSuccess: async (data) => {
      client.setQueryData(queryKey, data);
      setNotes("");
      toast.success("Case history updated");
      await client.invalidateQueries({
        predicate: (entry) => entry.queryKey.some(
          (part) => typeof part === "string" && /disease|health|clinical|analytics|gis|incident|notification/i.test(part)
        ),
      });
    },
  });

  if (!id) return <p role="alert">This report has no valid case identifier.</p>;
  if (query.isPending) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (query.isError) return (
    <Card><CardContent className="space-y-2 pt-5">
      <p role="alert" className="text-sm text-destructive">Follow-up history could not be loaded.</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Retry history</Button>
    </CardContent></Card>
  );
  const data = query.data;
  const canAct = data.can_submit_update || data.can_resolve;
  const isResolved = data.clinical_status === "RECOVERED" || data.clinical_status === "CLOSED";

  return (
    <Card className="min-w-0 border-emerald-200 print:break-inside-avoid">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Follow-up and case resolution</CardTitle>
        <Badge
          variant="outline"
          className={`w-fit ${data.clinical_status === "NOT_RECORDED" ? "border-rose-300 bg-rose-50 text-rose-800 font-bold" : ""}`}
        >
          {statusLabels[data.clinical_status]}
        </Badge>
        <p className="text-sm text-muted-foreground">
          Farmer observations request follow-up. CBAT or MAO records the official outcome separately from report approval.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {canAct ? (
          <form className="space-y-3 print:hidden" onSubmit={(event) => {
            event.preventDefault();
            if (!mutation.isPending) mutation.mutate(data.can_submit_update ? "FARMER_UPDATE" : resolution);
          }}>
            {data.can_resolve && <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-outcome`}>Official outcome</Label>
              <Select value={resolution} onValueChange={(value: "RECOVERED" | "CLOSED") => setResolution(value)} disabled={mutation.isPending}>
                <SelectTrigger id={`${fieldId}-outcome`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="RECOVERED">Recovered</SelectItem><SelectItem value="CLOSED">Closed</SelectItem></SelectContent>
              </Select>
            </div>}
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-date`}>{data.can_submit_update ? "Observation date" : "Resolution date"}</Label>
              <Input id={`${fieldId}-date`} type="date" required min={data.report_date ?? undefined}
                max={localCalendarDateToday()} value={observedOn} disabled={mutation.isPending}
                onChange={(event) => setObservedOn(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-notes`}>{data.can_submit_update ? "What changed or improved?" : "Resolution remarks"}</Label>
              <Textarea id={`${fieldId}-notes`} required maxLength={2000} rows={3}
                value={notes} disabled={mutation.isPending} onChange={(event) => setNotes(event.target.value)}
                placeholder={data.can_submit_update ? "Describe what you noticed and any follow-up you need." : "Record the assessment and reason for this outcome."} />
            </div>
            {mutation.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(mutation.error)}</p>}
            <Button type="submit" disabled={mutation.isPending || !notes.trim() || !observedOn} className="w-full sm:w-auto">
              {mutation.isPending ? "Saving…" : data.can_submit_update ? "Send follow-up to officers" : "Record official resolution"}
            </Button>
          </form>
        ) : <p className="text-sm text-muted-foreground">
          {data.report_status !== "APPROVED" ? "Follow-up and resolution become available after MAO approves the report."
            : isResolved ? "This case has an official outcome. Submit a new health report for a new concern."
              : "You can view the history. Official resolution is recorded by scoped CBAT or MAO."}
        </p>}
        <div className="space-y-3" aria-label="Case follow-up history">
          <h4 className="text-sm font-semibold">Case history</h4>
          {data.events.length === 0 && <p className="text-sm text-muted-foreground">No follow-up observations or resolutions recorded yet.</p>}
          {data.events.map((entry) => <article key={entry.id} className="space-y-1 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="secondary">{entry.event_type === "FARMER_UPDATE" ? "Farmer follow-up" : statusLabels[entry.event_type]}</Badge>
              <time dateTime={entry.observed_on}>{formatCalendarDate(entry.observed_on)}</time>
            </div>
            <p className="font-medium">{entry.created_by_name} · {entry.created_by_role}</p>
            <p className="whitespace-pre-wrap break-words">{entry.notes}</p>
            <p className="text-xs text-muted-foreground">Recorded {new Date(entry.created_at).toLocaleString("en-PH")}</p>
          </article>)}
        </div>
      </CardContent>
    </Card>
  );
}
