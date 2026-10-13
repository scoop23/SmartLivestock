"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, RotateCcw, Scissors } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ReviewRecord = {
  id: number; livestock_type_name: string; quantity: number; carcass_weight: string | null;
  record_date: string; status: string; review_remarks: string; created_by_name: string;
};

export default function SlaughterRecordReviewPage() {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const recordsQuery = useQuery({
    queryKey: ["slaughterhouse-review-records"],
    queryFn: async () => (await api.get<ReviewRecord[]>("/production/slaughterhouse/records/")).data,
  });
  const queue = (recordsQuery.data ?? []).filter((row) => row.status === "PENDING" || row.status === "SUBJECT_TO_REVISION");

  const review = async (row: ReviewRecord, status: "APPROVED" | "SUBJECT_TO_REVISION") => {
    const note = remarks[row.id]?.trim() ?? "";
    if (status === "SUBJECT_TO_REVISION" && !note) { toast.error("Add a remark before returning this record."); return; }
    setBusyId(row.id);
    try {
      await api.post(`/production/slaughterhouse/records/${row.id}/review/`, { status, remarks: note });
      toast.success(status === "APPROVED" ? "Slaughter record approved." : "Record returned for revision.");
      await queryClient.invalidateQueries({ queryKey: ["slaughterhouse-review-records"] });
    } catch (error) {
      const data = (error as { response?: { data?: { detail?: string } } })?.response?.data;
      toast.error(data?.detail ?? "Could not review the slaughter record.");
    } finally { setBusyId(null); }
  };

  return <>
    <PageHeader title="Slaughter Record Review" subtitle="Review submitted aggregate facility totals" variant="admin" icon={<Scissors className="size-5" />} />
    <div className="mx-auto w-full max-w-screen-2xl space-y-5 p-4 sm:p-6">
      <Card><CardContent className="flex items-start gap-3 py-4"><Clock className="mt-0.5 size-5 text-amber-700" /><div><p className="font-semibold">MAO review queue</p><p className="text-sm text-muted-foreground">Approval makes the aggregate record available to official slaughter analytics. It does not change individual animal inventory.</p></div></CardContent></Card>
      {recordsQuery.isError ? <Card><CardContent className="py-10 text-center text-sm text-slate-600">Unable to load slaughter review records. <Button variant="link" onClick={() => void recordsQuery.refetch()}>Retry</Button></CardContent></Card> : null}
      {recordsQuery.isLoading ? <div className="h-24 animate-pulse rounded-xl bg-slate-100" /> : queue.length ? <div className="grid gap-3 lg:grid-cols-2">{queue.map((row) => <Card key={row.id}><CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{row.livestock_type_name} · {row.record_date}</h2><p className="mt-1 text-sm text-muted-foreground">Submitted by {row.created_by_name}</p></div><Badge variant="outline" className={row.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-orange-200 bg-orange-50 text-orange-900"}>{row.status.replaceAll("_", " ")}</Badge></div>
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm"><div><p className="text-xs text-muted-foreground">Heads</p><p className="font-semibold">{row.quantity}</p></div><div><p className="text-xs text-muted-foreground">Recorded kilograms</p><p className="font-semibold">{row.carcass_weight ? `${Number(row.carcass_weight).toLocaleString()} kg` : "Not recorded"}</p></div></div>
        {row.status === "SUBJECT_TO_REVISION" && row.review_remarks ? <p className="text-sm text-amber-800">Previous remarks: {row.review_remarks}</p> : null}
        <Input aria-label={`Review remarks for record ${row.id}`} placeholder="Remarks (required to return)" value={remarks[row.id] ?? ""} onChange={(event) => setRemarks((current) => ({ ...current, [row.id]: event.target.value }))} />
        <div className="flex flex-col gap-2 min-[380px]:flex-row min-[380px]:justify-end"><Button variant="outline" disabled={busyId === row.id || !remarks[row.id]?.trim()} onClick={() => void review(row, "SUBJECT_TO_REVISION")}><RotateCcw className="mr-2 size-4" />Return for revision</Button><Button disabled={busyId === row.id} className="bg-emerald-700 hover:bg-emerald-800" onClick={() => void review(row, "APPROVED")}><CheckCircle2 className="mr-2 size-4" />Approve record</Button></div>
      </CardContent></Card>)}</div> : !recordsQuery.isError ? <Card><CardContent className="py-12 text-center"><CheckCircle2 className="mx-auto size-8 text-emerald-600" /><p className="mt-3 font-semibold">Review queue is clear</p><p className="mt-1 text-sm text-muted-foreground">Pending slaughterhouse submissions will appear here.</p></CardContent></Card> : null}
    </div>
  </>;
}
