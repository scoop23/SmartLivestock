"use client";

import ProductionValuation from "./production-valuation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Beef,CalendarDays,Egg,ExternalLink,Milk,Package,Pencil,Scissors,Trash2 } from "lucide-react";
import Link from "next/link";
import {
PRODUCTION_TYPE_UNITS,
formatQty,
formatRecordDate,
type ProductionRecordItem,
} from "./production-analytics";

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
  const canDelete = !record?.slaughterDetails;
  const canEdit = record?.slaughterDetails?.status !== "APPROVED";

  const meta = typeMeta[record?.productionType ?? "milk"];
  const TypeIcon = meta.icon;

  const livestockIdentifier = record?.livestockTagNumber || (record?.livestockId ? String(record.livestockId) : null);
  const livestockHref = livestockIdentifier ? `/livestock-inventory/${encodeURIComponent(livestockIdentifier)}` : null;
  const isMeat = record?.productionType === "meat";

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
                      {meta.label} • {record.livestockTypeName ?? "Livestock"}
                      {record.livestockTagNumber
                        ? ` (Tag #${record.livestockTagNumber})`
                        : record.livestockId
                        ? ` (ID #${record.livestockId})`
                        : record.batchCode
                        ? ` (Herd ${record.batchCode})`
                        : ""}
                    </DialogDescription>
                  </div>
                </div>
                <Badge className="shrink-0 uppercase tracking-wider bg-white text-emerald-800 border-0 hover:bg-white font-bold">
                  Recorded
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

              <ProductionValuation record={record} />

              {/* Multi-animal slaughter details */}
              {record.slaughterDetails && (
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3.5 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                      <Scissors className="size-4 text-amber-700" />
                      Slaughter Record: {record.slaughterDetails.quantity} animal(s)
                    </p>
                    {record.slaughterDetails.status && (
                      <Badge variant="outline" className="bg-amber-100/90 text-amber-900 border-amber-300 text-[10px] uppercase font-bold">
                        {record.slaughterDetails.status.replaceAll("_", " ")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-xs text-amber-800 font-medium">Slaughtered Animals:</span>
                    {record.slaughterDetails.animals.map((animal) => (
                      <Link
                        key={animal.id}
                        href={`/livestock-inventory/${animal.tag_number || animal.id}`}
                        onClick={() => onOpenChange(false)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-950 hover:bg-amber-100/80 hover:border-amber-400 transition-all shadow-2xs group"
                        title={`View ${animal.tag_number ? `Tag #${animal.tag_number}` : `Animal #${animal.id}`} record`}
                      >
                        <span>{animal.tag_number ? `#${animal.tag_number}` : `Animal #${animal.id}`}</span>
                        <ExternalLink className="size-3 text-amber-600 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    ))}
                  </div>
                  <p className="text-xs text-amber-800">
                    {record.slaughterDetails.inventory_reconciled_at
                      ? "Selected animals marked slaughtered after official approval."
                      : `Farmer-reported, unverified. Official slaughter status: ${record.slaughterDetails.status?.replaceAll("_", " ") || "PENDING"}. Inventory changes only after MAO approval.`}
                  </p>
                </div>
              )}

              {/* Individual meat-yield slaughtered animal callout */}
              {isMeat && !record.slaughterDetails && livestockHref && (
                <div className="rounded-xl border border-rose-200/90 bg-rose-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-950">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Scissors className="size-4 text-rose-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-rose-950 text-sm">
                        Slaughtered Animal: {record.livestockTypeName || "Livestock"}{" "}
                        {record.livestockTagNumber ? `· Tag #${record.livestockTagNumber}` : `· ID #${record.livestockId}`}
                      </p>
                      <p className="text-rose-800 mt-0.5 text-xs">
                        This older Farmer meat-yield log has no linked official slaughter notice. The log remains personal production history; inventory changes only after MAO approval of a linked notice.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={livestockHref}
                    onClick={() => onOpenChange(false)}
                    className="shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-300 font-bold text-rose-900 hover:bg-rose-100 hover:border-rose-400 transition-all shadow-2xs text-xs group"
                  >
                    <span>View Animal Record</span>
                    <ExternalLink className="size-3 text-rose-700 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {isMeat ? "Slaughtered Livestock" : "Livestock"}
                  </p>
                  {livestockHref ? (
                    <Link
                      href={livestockHref}
                      onClick={() => onOpenChange(false)}
                      className="group mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-800 hover:text-emerald-950 transition-colors"
                      title="View livestock profile"
                    >
                      <span className="underline underline-offset-2 break-words">
                        {record.livestockTypeName || "Livestock"}{" "}
                        {record.livestockTagNumber
                          ? `· #${record.livestockTagNumber}`
                          : record.livestockId
                          ? `· ID #${record.livestockId}`
                          : ""}
                      </span>
                      <ExternalLink className="size-3.5 shrink-0 text-emerald-600 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ) : record.batchCode ? (
                    <Link
                      href={`/livestock-inventory/batches?batchCode=${encodeURIComponent(record.batchCode)}`}
                      onClick={() => onOpenChange(false)}
                      className="group mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-teal-800 hover:text-teal-950 transition-colors"
                      title="View herd batch"
                    >
                      <span className="underline underline-offset-2 break-words">
                        {record.livestockTypeName || "Livestock"} · Herd {record.batchCode}
                      </span>
                      <ExternalLink className="size-3.5 shrink-0 text-teal-600 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-slate-900 mt-1 break-words">
                      {record.livestockTypeName ?? (record.livestockId ? `ID ${record.livestockId}` : "Unassigned")}
                    </p>
                  )}
                </div>
                <InfoCard label="Submitted" value={formatDateTime(record.createdAt)} />
                {record.productionType === "milk" && record.milkingSession && (
                  <InfoCard
                    label="Milking session"
                    value={`${record.milkingSession.charAt(0)}${record.milkingSession.slice(1).toLowerCase()}`}
                  />
                )}
                {record.approvedAt && <InfoCard label="Approved" value={formatDateTime(record.approvedAt)} />}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Notes
                </p>
                <p className="text-sm text-slate-600 mt-1 italic">
                  {record.notes ? `"${record.notes}"` : "No notes added"}
                </p>
              </div>

              {/* Saved in farm history callout */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 leading-relaxed">
                Saved in your farm history as a recorded production log.
                {record.anomalyDetected ? <p className="mt-1 font-medium">Unusual milk yield advisory: {record.anomalyReason}</p> : null}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 w-full">
                {canDelete && onDelete ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDeleting}
                    onClick={() => onDelete(record)}
                    className="w-full sm:w-auto border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Record
                  </Button>
                ) : null}
                {canEdit && onEdit ? (
                  <Button
                    type="button"
                    onClick={() => onEdit(record)}
                    className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white gap-2"
                  >
                    <Pencil className="w-4 h-4" /> Edit Record
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
