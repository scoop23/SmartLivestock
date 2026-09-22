"use client";

import { Beef, CalendarDays, Egg, Lock, Milk, Package, Pencil, Trash2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRODUCTION_TYPE_UNITS,
  formatRecordDate,
  formatQty,
  type ProductionRecordItem,
  type ProductionStatus,
} from "./production-analytics";

const statusClasses: Record<ProductionStatus, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200",
  VERIFIED: "bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200",
  PENDING: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200",
  REJECTED: "bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-300",
};

const DEFAULT_STATUS_CLASS =
  "bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200";

const typeMeta = {
  milk: { label: "Milk", icon: Milk },
  meat: { label: "Meat & Carcass", icon: Beef },
  eggs: { label: "Eggs", icon: Egg },
  wool: { label: "Wool", icon: Package },
} as const;

const formatDateTime = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50/60 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-900 mt-1 break-words">{value}</p>
    </div>
  );
}

export default function ProductionRecordDialog({
  record,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  isDeleting,
}: {
  record: ProductionRecordItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (record: ProductionRecordItem) => void;
  onDelete?: (record: ProductionRecordItem) => void;
  isDeleting?: boolean;
}) {
  const isApproved = record?.status === "APPROVED";

  const meta = typeMeta[record?.productionType ?? "milk"];
  const TypeIcon = meta.icon;

  return (
    <Dialog open={open && !!record} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl max-h-[90vh] overflow-y-auto [&>button]:text-white/70 [&>button]:hover:text-white">
        <DialogHeader className="hidden">
          <DialogTitle>Production Record</DialogTitle>
          <DialogDescription>Details of the submitted production record</DialogDescription>
        </DialogHeader>

        {record ? (
          <>
            {/* Header band */}
            <div className="relative bg-gradient-to-r from-[#2D5A27] to-[#3E7A36] text-white px-6 pt-6 pb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="shrink-0 p-3 rounded-2xl bg-white/15 backdrop-blur-sm">
                    <TypeIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-xl font-bold text-white leading-tight">
                      Production Record #{record.id}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-white/80 mt-1">
                      {meta.label} • {record.livestockTypeName ?? `Livestock ID ${record.livestockId}`}
                    </DialogDescription>
                  </div>
                </div>
                <Badge
                  className={`shrink-0 uppercase tracking-wider bg-white text-slate-800 border-0 hover:bg-white ${(statusClasses[record.status] ?? DEFAULT_STATUS_CLASS).split(" ")[0]}`}
                >
                  {record.status === "REJECTED" ? "Subject to Revision" : record.status}
                </Badge>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Quantity
                  </p>
                  <p className="text-4xl font-black text-slate-900 tracking-tight mt-0.5">
                    {formatQty(record.quantity)}
                    <span className="ml-1.5 text-lg font-bold text-slate-500">
                      {PRODUCTION_TYPE_UNITS[record.productionType] ?? record.unit}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Record Date
                  </p>
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900 mt-1 justify-end">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    {formatRecordDate(record.recordDate)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoCard
                  label="Livestock"
                  value={record.livestockTypeName ?? `ID ${record.livestockId}`}
                />
                <InfoCard label="Submitted" value={formatDateTime(record.createdAt)} />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Notes
                </p>
                <p className="text-sm text-slate-600 mt-1 italic">
                  {record.notes ? `"${record.notes}"` : "No notes added"}
                </p>
              </div>

              {/* Approval / Remarks Callouts */}
              {isApproved && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                      <Lock className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-900">
                        Validated & Approved
                      </p>
                      <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                        This production entry has been inspected, verified, and officially logged into municipal records.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/40 p-4 space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                      Reviewer Remarks
                    </p>
                    {record.reviewRemarks && record.reviewRemarks.trim() ? (
                      <p className="text-sm font-medium text-emerald-950 italic whitespace-pre-wrap">
                        &ldquo;{record.reviewRemarks}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        Approved with standard validation. No additional remarks noted by the reviewer.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {record.status === "PENDING" && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                  <p className="font-bold uppercase tracking-wider text-amber-800 mb-0.5">
                    Awaiting Validation
                  </p>
                  This record is awaiting review by your local SIBAT officer.
                </div>
              )}

              {record.status === "REJECTED" && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <RotateCcw className="size-3.5 text-amber-700" />
                    Revision Remarks & Required Corrections
                  </p>
                  <p className="text-sm text-amber-950 font-medium italic">
                    {record.reviewRemarks
                      ? `"${record.reviewRemarks}"`
                      : "Please review and correct the declared values according to reviewer instructions."}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              {isApproved ? (
                <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                  <Lock className="w-4 h-4 shrink-0" />
                  This record has been approved and can no longer be edited or deleted.
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 w-full">
                  {onDelete ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isDeleting}
                      onClick={() => onDelete(record)}
                      className="w-full sm:w-auto border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Delete / Cancel Record
                    </Button>
                  ) : null}
                  {onEdit ? (
                    <Button
                      type="button"
                      onClick={() => onEdit(record)}
                      className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white gap-2"
                    >
                      <Pencil className="w-4 h-4" /> Edit Record
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
