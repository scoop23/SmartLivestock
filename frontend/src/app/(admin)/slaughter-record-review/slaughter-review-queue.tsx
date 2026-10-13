"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, RotateCcw, Scissors } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTableSection } from "@/components/ui/data-table-section";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ReviewRecord = {
  id: number;
  livestock_type_name: string;
  quantity: number;
  carcass_weight: string | null;
  record_date: string;
  status: string;
  review_remarks: string;
  created_by_name: string;
};

export function SlaughterReviewQueue() {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const recordsQuery = useQuery({
    queryKey: ["slaughterhouse-review-records"],
    queryFn: async () => (await api.get<ReviewRecord[]>("/production/slaughterhouse/records/")).data,
  });
  const queue = (recordsQuery.data ?? []).filter(
    (row) => row.status === "PENDING" || row.status === "SUBJECT_TO_REVISION"
  );

  const review = async (row: ReviewRecord, status: "APPROVED" | "SUBJECT_TO_REVISION") => {
    const note = remarks[row.id]?.trim() ?? "";
    if (status === "SUBJECT_TO_REVISION" && !note) {
      toast.error("Add a remark before returning this record.");
      return;
    }
    setBusyId(row.id);
    try {
      await api.post(`/production/slaughterhouse/records/${row.id}/review/`, { status, remarks: note });
      toast.success(status === "APPROVED" ? "Slaughter record approved." : "Record returned for revision.");
      await queryClient.invalidateQueries({ queryKey: ["slaughterhouse-review-records"] });
    } catch (error) {
      const data = (error as { response?: { data?: { detail?: string } } })?.response?.data;
      toast.error(data?.detail ?? "Could not review the slaughter record.");
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (status: string) => status === "PENDING"
    ? "bg-amber-50 text-amber-700 border-amber-200/80"
    : "bg-orange-50 text-orange-700 border-orange-200/80";

  const emptyState = (
    <div className="flex flex-col items-center justify-center space-y-2 py-10">
      <CheckCircle2 className="size-10 text-green-500" />
      <p className="text-sm font-bold text-gray-800">Review queue is clear</p>
      <p className="text-xs font-medium text-gray-400">Pending slaughterhouse submissions will appear here.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-start gap-3 py-4">
          <Clock className="mt-0.5 size-5 text-amber-700" />
          <div>
            <p className="font-semibold">MAO review queue</p>
            <p className="text-sm text-muted-foreground">
              Approval makes the aggregate record available to official slaughter analytics. It does not change individual animal inventory.
            </p>
          </div>
        </CardContent>
      </Card>

      {recordsQuery.isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-600">
            Unable to load slaughter review records. <Button variant="link" onClick={() => void recordsQuery.refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : recordsQuery.isLoading ? (
        <div className="h-36 animate-pulse rounded-[2.5rem] border border-gray-100 bg-white" />
      ) : (
        <DataTableSection className="min-h-0 md:min-h-0 lg:min-h-0">
          <div className="hidden overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-100 bg-gray-50/50 transition-colors hover:bg-gray-50/50">
                    <TableHead className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Livestock / Date</TableHead>
                    <TableHead className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Submitted By</TableHead>
                    <TableHead className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">Head Count</TableHead>
                    <TableHead className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">Carcass Weight</TableHead>
                    <TableHead className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">Status</TableHead>
                    <TableHead className="min-w-[220px] px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Review Remarks</TableHead>
                    <TableHead className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-50">
                  {queue.length === 0 ? (
                    <TableRow className="border-none hover:bg-transparent">
                      <TableCell colSpan={7} className="px-8 py-5">{emptyState}</TableCell>
                    </TableRow>
                  ) : queue.map((row) => (
                    <TableRow key={row.id} className="group border-none transition-all hover:bg-gray-50/80">
                      <TableCell className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs"><Scissors size={19} /></div>
                          <div>
                            <p className="text-sm font-bold leading-snug text-gray-800">{row.livestock_type_name}</p>
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{row.record_date}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-8 py-5">
                        <p className="text-sm font-bold text-gray-700">{row.created_by_name}</p>
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Slaughterhouse Staff</span>
                      </TableCell>
                      <TableCell className="px-8 py-5 text-right">
                        <p className="text-sm font-black text-[#2D5A27]">{row.quantity.toLocaleString()} <span className="text-[10px] font-black uppercase text-gray-500">head(s)</span></p>
                      </TableCell>
                      <TableCell className="px-8 py-5 text-right">
                        <p className="text-sm font-black text-gray-800">{row.carcass_weight ? `${Number(row.carcass_weight).toLocaleString()} kg` : <span className="text-xs font-medium text-gray-400">Not recorded</span>}</p>
                      </TableCell>
                      <TableCell className="px-8 py-5 text-center">
                        <Badge variant="outline" className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${statusBadge(row.status)}`}>
                          <span className={`mr-1.5 size-1.5 rounded-full ${row.status === "PENDING" ? "animate-pulse bg-amber-500" : "bg-orange-500"}`} />
                          {row.status.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-8 py-5">
                        {row.status === "SUBJECT_TO_REVISION" && row.review_remarks ? <p className="mb-2 max-w-[220px] whitespace-normal text-xs text-amber-800">Previous: {row.review_remarks}</p> : null}
                        <Input aria-label={`Review remarks for record ${row.id}`} placeholder="Remarks (required to return)" value={remarks[row.id] ?? ""} onChange={(event) => setRemarks((current) => ({ ...current, [row.id]: event.target.value }))} className="h-9 min-w-[200px] rounded-xl border-gray-200 text-xs" />
                      </TableCell>
                      <TableCell className="px-8 py-5">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" disabled={busyId === row.id || !remarks[row.id]?.trim()} onClick={() => void review(row, "SUBJECT_TO_REVISION")} className="h-auto rounded-xl border-gray-200 px-2.5 py-2.5 text-xs font-bold text-gray-700"><RotateCcw size={15} />Return</Button>
                          <Button size="sm" disabled={busyId === row.id} className="h-auto rounded-xl bg-gray-900 px-2.5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-gray-800" onClick={() => void review(row, "APPROVED")}><CheckCircle2 size={15} />Approve</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {queue.length === 0 ? (
              <Card className="rounded-3xl border-gray-100 shadow-sm"><CardContent>{emptyState}</CardContent></Card>
            ) : queue.map((row) => (
              <div key={row.id} className="space-y-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs"><Scissors size={19} /></div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold leading-snug text-gray-800">{row.livestock_type_name}</p>
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{row.record_date}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${statusBadge(row.status)}`}>{row.status.replaceAll("_", " ")}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-2.5">
                    <div className="min-w-0"><span className="block text-[9px] font-black uppercase text-gray-400">Submitted By</span><span className="block truncate font-bold text-gray-700">{row.created_by_name}</span></div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-green-50/70 p-2.5">
                    <div className="min-w-0"><span className="block text-[9px] font-black uppercase text-green-700">Head Count</span><span className="block truncate font-black text-[#2D5A27]">{row.quantity.toLocaleString()} head(s)</span></div>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 rounded-xl bg-gray-50 p-2.5">
                    <div className="min-w-0"><span className="block text-[9px] font-black uppercase text-gray-400">Carcass Weight</span><span className="block truncate font-bold text-gray-700">{row.carcass_weight ? `${Number(row.carcass_weight).toLocaleString()} kg` : "Not recorded"}</span></div>
                  </div>
                </div>
                {row.status === "SUBJECT_TO_REVISION" && row.review_remarks ? <p className="text-xs text-amber-800">Previous remarks: {row.review_remarks}</p> : null}
                <Input aria-label={`Review remarks for record ${row.id}`} placeholder="Remarks (required to return)" value={remarks[row.id] ?? ""} onChange={(event) => setRemarks((current) => ({ ...current, [row.id]: event.target.value }))} className="h-10 rounded-xl border-gray-200 text-xs" />
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="outline" disabled={busyId === row.id || !remarks[row.id]?.trim()} onClick={() => void review(row, "SUBJECT_TO_REVISION")} className="h-auto flex-1 rounded-xl border-gray-200 py-2.5 text-xs font-bold text-gray-700"><RotateCcw size={15} /><span>Return</span></Button>
                  <Button size="sm" disabled={busyId === row.id} className="h-auto flex-1 rounded-xl bg-gray-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-gray-800" onClick={() => void review(row, "APPROVED")}><CheckCircle2 size={15} /><span>Approve</span></Button>
                </div>
              </div>
            ))}
          </div>
        </DataTableSection>
      )}
    </div>
  );
}