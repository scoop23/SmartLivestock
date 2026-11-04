"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { reviewInspection, type InspectionRecord } from "@/app/(auction)/auction-inspections/auction-analytics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock, Eye, FileCheck2, FileText, MapPin, RefreshCw, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type InspectionStatusFilter = "PENDING" | "APPROVED" | "SUBJECT_TO_REVISION" | "ALL";

type MovementLivestockInspectionsTabProps = {
  inspections: InspectionRecord[];
  isLoading: boolean;
  isError: boolean;
};

function isAwaitingReview(status: InspectionRecord["status"]) {
  return status === "PENDING" || status === "VERIFIED";
}

function isReturned(status: InspectionRecord["status"]) {
  return status === "SUBJECT_TO_REVISION" || status === "REJECTED";
}

function inspectionStatusBadge(status: InspectionRecord["status"]) {
  if (status === "APPROVED") {
    return <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">MAO Approved</Badge>;
  }
  if (isReturned(status)) {
    return <Badge className="border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-50">Returned for Correction</Badge>;
  }
  return <Badge className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">Waiting for MAO</Badge>;
}

export function MovementLivestockInspectionsTab({
  inspections,
  isLoading,
  isError,
}: MovementLivestockInspectionsTabProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<InspectionStatusFilter>("PENDING");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<InspectionRecord | null>(null);
  const [revisionRemarks, setRevisionRemarks] = useState("");
  const [approveConfirmTarget, setApproveConfirmTarget] = useState<InspectionRecord | null>(null);
  const pageSize = 10;

  const deepLinkedInspectionRef = useRef<string | null>(null);

  // Deep-linking from notification ?inspectionId=123
  useEffect(() => {
    if (isLoading || !inspections.length || typeof window === "undefined") return;
    const inspectionId = new URLSearchParams(window.location.search).get("inspectionId");
    if (!inspectionId || deepLinkedInspectionRef.current === inspectionId) return;

    const found = inspections.find(
      (item) => String(item.id) === inspectionId || item.control_number === inspectionId
    );
    if (found) {
      deepLinkedInspectionRef.current = inspectionId;
      setStatusFilter("ALL");
      setSelectedInspection(found);
    }
  }, [inspections, isLoading]);

  const review = useMutation({
    mutationFn: ({
      id,
      status,
      remarks,
    }: {
      id: number;
      status: "APPROVED" | "SUBJECT_TO_REVISION";
      remarks?: string;
    }) => reviewInspection(id, { status, remarks }),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inspections"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "data-overview", "movement-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] }),
      ]);
      setSelectedInspection(null);
      setRevisionTarget(null);
      setRevisionRemarks("");
      setApproveConfirmTarget(null);
      toast.success(
        variables.status === "APPROVED"
          ? "Livestock inspection approved and clearance issued."
          : "Livestock inspection returned to Auction for correction."
      );
    },
    onError: () => toast.error("Could not update this livestock inspection. Refresh and try again."),
  });

  const counts = useMemo(() => {
    const pending = inspections.filter((record) => isAwaitingReview(record.status)).length;
    const approved = inspections.filter((record) => record.status === "APPROVED").length;
    const returned = inspections.filter((record) => isReturned(record.status)).length;
    return { pending, approved, returned, total: inspections.length };
  }, [inspections]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return inspections.filter((record) => {
      if (statusFilter === "PENDING" && !isAwaitingReview(record.status)) return false;
      if (statusFilter === "APPROVED" && record.status !== "APPROVED") return false;
      if (statusFilter === "SUBJECT_TO_REVISION" && !isReturned(record.status)) return false;
      if (!query) return true;
      return [
        record.control_number,
        record.shipper_name,
        record.shipper_address,
        record.origin,
        record.destination,
        record.purpose,
        record.vehicle_plate_number,
        ...record.items.flatMap((item) => [item.livestock_type_name, item.inventory_tag, item.remarks]),
      ].some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [inspections, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage]
  );

  const setFilter = (filter: InspectionStatusFilter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const openRevisionDialog = (record: InspectionRecord) => {
    setSelectedInspection(null);
    setRevisionRemarks("");
    setRevisionTarget(record);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Waiting for MAO Review"
          variant="amber"
          icon={<Clock className="size-5" />}
          badge={counts.pending ? "NEEDS REVIEW" : "ALL CLEAR"}
          badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 tracking-wider"
          value={<div className="flex items-baseline gap-1.5"><span className="font-display text-2xl sm:text-3xl font-black text-slate-900">{counts.pending.toLocaleString()}</span><span className="text-xs font-mono font-bold text-amber-800">Records</span></div>}
          description="Movement inspections needing an MAO decision"
          isLoading={isLoading}
          wrapText
        />
        <KpiCard
          title="Approved Clearances"
          variant="emerald"
          icon={<CheckCircle2 className="size-5" />}
          badge="ISSUED BY MAO"
          badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 tracking-wider"
          value={<div className="flex items-baseline gap-1.5"><span className="font-display text-2xl sm:text-3xl font-black text-slate-900">{counts.approved.toLocaleString()}</span><span className="text-xs font-mono font-bold text-emerald-800">Approved</span></div>}
          description="Approved inspection records with clearances"
          isLoading={isLoading}
          wrapText
        />
        <KpiCard
          title="Returned for Correction"
          variant="rose"
          icon={<RotateCcw className="size-5" />}
          badge={counts.returned ? "ACTION NEEDED" : "NONE"}
          badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 tracking-wider"
          value={<div className="flex items-baseline gap-1.5"><span className="font-display text-2xl sm:text-3xl font-black text-slate-900">{counts.returned.toLocaleString()}</span><span className="text-xs font-mono font-bold text-rose-800">Returned</span></div>}
          description="Returned to Auction staff for updates"
          isLoading={isLoading}
          wrapText
        />
        <KpiCard
          title="Total Inspection Records"
          variant="sky"
          icon={<FileText className="size-5" />}
          badge="ALL RECORDS"
          badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-300 tracking-wider"
          value={<div className="flex items-baseline gap-1.5"><span className="font-display text-2xl sm:text-3xl font-black text-slate-900">{counts.total.toLocaleString()}</span><span className="text-xs font-mono font-bold text-sky-800">Total</span></div>}
          description="Auction movement and inspection submissions"
          isLoading={isLoading}
          wrapText
        />
      </div>

      <div className="flex flex-col gap-3.5 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ["PENDING", "Waiting for Review", counts.pending],
            ["APPROVED", "Approved", counts.approved],
            ["SUBJECT_TO_REVISION", "Returned", counts.returned],
            ["ALL", "All Records", counts.total],
          ] as const).map(([filter, label, count]) => {
            const selected = statusFilter === filter;
            const selectedClass = filter === "PENDING" ? "bg-amber-600" : filter === "APPROVED" ? "bg-emerald-700" : filter === "SUBJECT_TO_REVISION" ? "bg-rose-700" : "bg-slate-900";
            return (
              <button
                key={filter}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(filter)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${selected ? `${selectedClass} text-white shadow-xs` : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
              >
                {filter === "PENDING" ? <Clock className="size-3.5" /> : filter === "APPROVED" ? <Check className="size-3.5" /> : filter === "SUBJECT_TO_REVISION" ? <RotateCcw className="size-3.5" /> : null}
                <span>{label}</span>
                <span className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${selected ? "bg-white/20" : "bg-white"}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search control no., shipper, route, or animal"
            className="h-9 rounded-xl border-slate-200 bg-white pl-10 text-xs shadow-2xs"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2 text-emerald-800"><ClipboardCheck className="size-5" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {statusFilter === "PENDING" ? `Movement / Livestock Inspections Waiting for Review (${filtered.length})` : statusFilter === "APPROVED" ? `Approved Inspections (${filtered.length})` : statusFilter === "SUBJECT_TO_REVISION" ? `Inspections Returned for Correction (${filtered.length})` : `All Movement / Livestock Inspections (${filtered.length})`}
              </h2>
              <p className="text-[11px] text-slate-500">Review auction movement submissions and issue a clearance only after approval.</p>
            </div>
          </div>
          <span className="font-mono text-xs text-slate-500">
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
          </span>
        </div>

        {isError ? (
          <div role="alert" className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Could not load movement and livestock inspection records. Refresh the queue and try again.</div>
        ) : null}
        {isLoading && !isError ? (
          <div className="space-y-2 p-12 text-center text-xs text-slate-500"><Activity className="mx-auto size-6 animate-pulse text-emerald-700" /><p>Loading movement and livestock inspections…</p></div>
        ) : null}
        {!isLoading && !isError && filtered.length === 0 ? (
          <div className="space-y-2 p-12 text-center">
            <ClipboardCheck className="mx-auto size-8 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">{statusFilter === "PENDING" ? "No movement or livestock inspections are waiting for review." : "No inspection records match these filters."}</p>
            <p className="text-xs text-slate-500">Auction movement submissions will appear here for MAO review.</p>
          </div>
        ) : null}

        {!isLoading && !isError && filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-slate-100 bg-slate-50/80">
                <TableRow>
                  <TableHead className="py-3.5 pl-5 text-xs font-bold uppercase tracking-wider text-slate-600">Control # &amp; Shipper</TableHead>
                  <TableHead className="py-3.5 text-xs font-bold uppercase tracking-wider text-slate-600">Route</TableHead>
                  <TableHead className="py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Purpose / Heads</TableHead>
                  <TableHead className="py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Inspection Date</TableHead>
                  <TableHead className="py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Status</TableHead>
                  <TableHead className="py-3.5 pr-5 text-right text-xs font-bold uppercase tracking-wider text-slate-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {paginated.map((record) => {
                  const headCount = record.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                  const canReview = isAwaitingReview(record.status);
                  return (
                    <TableRow key={record.id} className={canReview ? "bg-amber-50/[0.25] hover:bg-amber-50/50" : "hover:bg-slate-50/70"}>
                      <TableCell className="py-3.5 pl-5">
                        <div className="font-mono text-xs font-bold text-slate-900">{record.control_number || `INS-${record.id}`}</div>
                        <div className="mt-0.5 text-xs font-semibold text-slate-800">{record.shipper_name}</div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex items-start gap-1.5 text-xs font-semibold text-slate-800"><MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" /><span>{record.origin || "Origin not recorded"}<span className="block text-[11px] font-normal text-slate-500">to {record.destination || "Destination not recorded"}</span></span></div>
                      </TableCell>
                      <TableCell className="py-3.5 text-center">
                        <span className="text-xs font-bold text-slate-800">{record.purpose.replaceAll("_", " ")}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-slate-500">{headCount} head</span>
                      </TableCell>
                      <TableCell className="py-3.5 text-center text-xs font-medium text-slate-700">{record.inspection_date}</TableCell>
                      <TableCell className="py-3.5 text-center">{inspectionStatusBadge(record.status)}</TableCell>
                      <TableCell className="py-3.5 pr-5 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {canReview ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                disabled={review.isPending}
                                onClick={() => setApproveConfirmTarget(record)}
                                className="h-8 gap-1 rounded-lg bg-[#1E4D2B] px-2.5 text-xs font-bold text-white hover:bg-[#163b21] shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-98"
                              >
                                <Check className="size-3.5" /><span>Approve</span>
                              </Button>
                              <Button type="button" size="sm" variant="outline" disabled={review.isPending} onClick={() => openRevisionDialog(record)} className="h-8 gap-1 rounded-lg border-rose-200 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                                <RotateCcw className="size-3.5" /><span>Return</span>
                              </Button>
                            </>
                          ) : null}
                          <Button type="button" size="sm" variant="outline" onClick={() => setSelectedInspection(record)} className="h-8 gap-1 rounded-lg border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            <Eye className="size-3.5" /><span>Details</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {!isLoading && !isError && filtered.length > 0 && totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-600">
            <span>Page {safePage} of {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <Button type="button" size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="size-8 rounded-lg p-0"><ChevronLeft className="size-4" /></Button>
              <Button type="button" size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="size-8 rounded-lg p-0"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-50/60 via-white to-emerald-50/40 p-4 text-xs text-slate-700 shadow-2xs sm:p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-900"><Activity className="size-4 text-emerald-700" /><span>About Movement / Livestock Inspections</span></div>
        <p className="leading-relaxed">Auction staff record animal movement and submit the inspection for MAO review. Approval issues the official clearance; returned records go back to Auction for correction.</p>
      </div>

      <Dialog open={Boolean(selectedInspection)} onOpenChange={(open) => !open && setSelectedInspection(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-h-[90vh] max-w-none overflow-x-hidden overflow-y-auto rounded-3xl border border-slate-200 p-5 shadow-xl sm:max-w-3xl sm:p-7">
          {selectedInspection ? (
            <div className="space-y-5">
              <DialogHeader className="border-b border-slate-100 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className="font-mono text-xs">{selectedInspection.control_number || `INS-${selectedInspection.id}`}</Badge>
                  {inspectionStatusBadge(selectedInspection.status)}
                </div>
                <DialogTitle className="mt-2 text-xl font-black text-slate-900">Movement/Livestock Inspection</DialogTitle>
                <DialogDescription>Submitted by {selectedInspection.shipper_name || "Auction staff"} for MAO review.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs sm:grid-cols-2">
                <p><span className="block text-slate-500">Origin</span><strong>{selectedInspection.origin || "Not recorded"}</strong></p>
                <p><span className="block text-slate-500">Destination</span><strong>{selectedInspection.destination || "Not recorded"}</strong></p>
                <p><span className="block text-slate-500">Purpose</span><strong>{selectedInspection.purpose.replaceAll("_", " ")}</strong></p>
                <p><span className="block text-slate-500">Inspection date</span><strong>{selectedInspection.inspection_date}</strong></p>
                <p><span className="block text-slate-500">Vehicle plate</span><strong>{selectedInspection.vehicle_plate_number || "Not recorded"}</strong></p>
                <p><span className="block text-slate-500">Handler license</span><strong>{selectedInspection.livestock_handler_license_no || "Not recorded"}</strong></p>
                <p className="sm:col-span-2"><span className="block text-slate-500">Shipper address</span><strong>{selectedInspection.shipper_address || "Not recorded"}</strong></p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800">Animals listed</div>
                {selectedInspection.items.length ? selectedInspection.items.map((item, index) => (
                  <div key={item.id ?? `${item.livestock_type}-${index}`} className="grid min-w-0 gap-1 border-b border-slate-100 px-4 py-3 text-xs last:border-b-0 sm:grid-cols-[1.3fr_0.7fr_0.7fr_1.3fr] sm:items-center">
                    <span className="font-bold text-slate-900">{item.livestock_type_name || "Livestock"}</span>
                    <span className="text-slate-600">{item.quantity} head</span>
                    <span className="text-slate-600">{item.sex.toLocaleLowerCase()}</span>
                    <span className="min-w-0 break-words text-slate-500">{item.inventory_tag || item.remarks || "No tag or note"}</span>
                  </div>
                )) : <p className="p-4 text-xs text-slate-500">No animal lines were recorded.</p>}
              </div>
              {selectedInspection.review_remarks ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong>Previous MAO notes:</strong> {selectedInspection.review_remarks}</div> : null}
              <DialogFooter className="grid w-full min-w-0 grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[0.8fr_1.15fr_1.45fr]">
                <Button type="button" variant="outline" onClick={() => setSelectedInspection(null)} className="h-auto min-h-10 w-full min-w-0 whitespace-normal px-3">Close</Button>
                {isAwaitingReview(selectedInspection.status) ? (
                  <>
                    <Button type="button" variant="outline" disabled={review.isPending} onClick={() => openRevisionDialog(selectedInspection)} className="h-auto min-h-10 w-full min-w-0 whitespace-normal border-rose-200 px-3 text-rose-700 hover:bg-rose-50"><RotateCcw className="mr-1 size-3.5 shrink-0" /><span>Return for Correction</span></Button>
                    <Button
                      type="button"
                      disabled={review.isPending}
                      onClick={() => setApproveConfirmTarget(selectedInspection)}
                      className="h-auto min-h-10 w-full min-w-0 whitespace-normal bg-[#1E4D2B] px-3 text-white hover:bg-[#163b21] font-bold shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-98"
                    >
                      <Check className="mr-1 size-3.5 shrink-0" />
                      <span>Approve &amp; Issue Clearance</span>
                    </Button>
                  </>
                ) : null}
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revisionTarget)} onOpenChange={(open) => !open && setRevisionTarget(null)}>
        <DialogContent className="max-w-md rounded-3xl border border-slate-200 p-6 shadow-xl">
          {revisionTarget ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldAlert className="size-5 text-rose-600" />Return for Correction</DialogTitle>
                <DialogDescription>{revisionTarget.control_number || `INS-${revisionTarget.id}`} · {revisionTarget.shipper_name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <label htmlFor="inspection-revision-remarks" className="block text-xs font-semibold text-slate-700">Notes for Auction staff <span className="text-rose-600">*</span></label>
                <Textarea id="inspection-revision-remarks" value={revisionRemarks} onChange={(event) => setRevisionRemarks(event.target.value)} placeholder="Explain which movement or animal details need correction." maxLength={2000} rows={4} className="rounded-xl text-xs" />
                <p className="text-right text-[10px] text-slate-400">{revisionRemarks.length} / 2000</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={review.isPending} onClick={() => setRevisionTarget(null)}>Cancel</Button>
                <Button type="button" variant="destructive" disabled={review.isPending || !revisionRemarks.trim()} onClick={() => review.mutate({ id: revisionTarget.id, status: "SUBJECT_TO_REVISION", remarks: revisionRemarks.trim() })}>Return to Auction</Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MAO APPROVAL CONFIRMATION DIALOG (Green Primary & Animations)       */}
      {/* =================================================================== */}
      <Dialog
        open={Boolean(approveConfirmTarget)}
        onOpenChange={(open) => {
          if (!open && !review.isPending) setApproveConfirmTarget(null);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-6 border border-emerald-200/90 bg-white shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
          {approveConfirmTarget && (
            <div className="space-y-5">
              {/* Animated Top Icon Banner */}
              <div className="flex flex-col items-center text-center pt-2">
                <div className="relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200/80 border-2 border-emerald-400 text-[#1E4D2B] shadow-md shadow-emerald-900/10 mb-3 animate-in zoom-in-75 duration-300">
                  <span className="absolute inset-0 rounded-2xl bg-emerald-400/25 animate-ping [animation-duration:2s]" aria-hidden="true" />
                  <FileCheck2 className="size-8 text-[#1E4D2B] stroke-[2.2] animate-in zoom-in-50 duration-300" />
                </div>
                <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
                  Are you sure?
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-xs leading-relaxed font-normal">
                  You are about to officially approve this movement inspection and issue the municipal livestock clearance.
                </DialogDescription>
              </div>

              {/* Inspection Details Card */}
              <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-slate-50/50 to-white p-4 space-y-3 text-xs shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                    {approveConfirmTarget.control_number || `INS-${approveConfirmTarget.id}`}
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-mono text-[10px] font-bold">
                    Official MAO Action
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Shipper / Handler</span>
                    <span className="font-bold text-slate-900 truncate block">
                      {approveConfirmTarget.shipper_name || "Auction Handler"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Purpose</span>
                    <span className="font-semibold text-slate-800 block capitalize">
                      {approveConfirmTarget.purpose.replaceAll("_", " ").toLowerCase()}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-100/70 flex items-center justify-between gap-2 text-[11px]">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Origin</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {approveConfirmTarget.origin || "Origin not set"}
                    </span>
                  </div>
                  <div className="text-emerald-700 shrink-0 font-black px-1.5">➔</div>
                  <div className="min-w-0 text-right">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">Destination</span>
                    <span className="font-bold text-emerald-900 truncate block">
                      {approveConfirmTarget.destination || "Destination not set"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-100/70 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                  <span>Total Head:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {approveConfirmTarget.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} head ({approveConfirmTarget.items.length} line items)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  disabled={review.isPending}
                  onClick={() => setApproveConfirmTarget(null)}
                  className="w-full sm:w-auto h-10 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate({ id: approveConfirmTarget.id, status: "APPROVED" })
                  }
                  className="w-full sm:flex-1 h-10 rounded-xl text-xs font-bold bg-[#1E4D2B] hover:bg-[#163b21] text-white shadow-md shadow-emerald-900/20 gap-1.5 cursor-pointer transition-all hover:scale-[1.02] active:scale-98"
                >
                  {review.isPending ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Issuing Clearance…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-300" />
                      <span>Yes, Approve &amp; Issue Clearance</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
