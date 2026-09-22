"use client";

import {
  Beef,
  CalendarDays,
  CheckCircle2,
  Clock,
  Egg,
  Info,
  Lock,
  MapPin,
  MessageSquareQuote,
  Milk,
  Package,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  PRODUCTION_TYPE_LABELS,
  PRODUCTION_TYPE_UNITS,
  formatRecordDate,
  formatQty,
  type ProductionRecordItem,
  type ProductionStatus,
} from "./production-analytics";

const statusClasses: Record<ProductionStatus, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  VERIFIED: "bg-sky-100 text-sky-800 border-sky-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
};

const typeMeta = {
  milk: { label: "Milk", icon: Milk, colorClass: "text-blue-700 bg-blue-100/80 border-blue-200" },
  meat: { label: "Meat & Carcass", icon: Beef, colorClass: "text-rose-700 bg-rose-100/80 border-rose-200" },
  eggs: { label: "Eggs", icon: Egg, colorClass: "text-amber-700 bg-amber-100/80 border-amber-200" },
  wool: { label: "Wool", icon: Package, colorClass: "text-sky-700 bg-sky-100/80 border-sky-200" },
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

interface ProductionApprovalCardProps {
  record: ProductionRecordItem | null;
  onDelete?: (record: ProductionRecordItem) => void;
  isDeleting?: boolean;
  totalApprovedCount?: number;
  totalRecordsCount?: number;
}

export default function ProductionApprovalCard({
  record,
  onDelete,
  isDeleting = false,
  totalApprovedCount,
  totalRecordsCount,
}: ProductionApprovalCardProps) {
  if (!record) {
    return (
      <Card className="rounded-2xl border-slate-200 shadow-sm bg-gradient-to-b from-slate-50/70 to-white overflow-hidden">
        <CardContent className="p-6 text-center space-y-4">
          <div className="mx-auto size-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shadow-sm">
            <ShieldCheck className="size-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Approval & Remark Details
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              Select any production record from the list to view its official approval verification, validator remarks, and yield logs.
            </p>
          </div>

          {(totalApprovedCount !== undefined || totalRecordsCount !== undefined) && (
            <div className="pt-2">
              <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                <div className="text-center p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Approved
                  </p>
                  <p className="text-lg font-black text-emerald-900 mt-0.5">
                    {totalApprovedCount ?? 0}
                  </p>
                </div>
                <div className="text-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Total Records
                  </p>
                  <p className="text-lg font-black text-slate-800 mt-0.5">
                    {totalRecordsCount ?? 0}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-left flex items-start gap-2.5">
            <Info className="size-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-normal">
              Records marked <span className="font-semibold text-emerald-800">APPROVED</span> have been inspected and confirmed by the local SIBAT officer.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isApproved = record.status === "APPROVED";
  const isVerified = record.status === "VERIFIED";
  const isPending = record.status === "PENDING";
  const isRejected = record.status === "REJECTED";

  const meta = typeMeta[record.productionType] ?? typeMeta.milk;
  const TypeIcon = meta.icon;

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white transition-all duration-300">
      {/* Header Band */}
      <div
        className={`px-5 py-4 text-white ${
          isApproved
            ? "bg-gradient-to-r from-[#2D5A27] via-[#356B2E] to-[#47873E]"
            : isVerified
            ? "bg-gradient-to-r from-sky-600 via-sky-600 to-sky-700"
            : isPending
            ? "bg-gradient-to-r from-amber-600 via-amber-600 to-amber-700"
            : "bg-gradient-to-r from-rose-600 via-rose-600 to-rose-700"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs shrink-0">
              <TypeIcon className="size-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/80 leading-none">
                Production #{record.id}
              </p>
              <h3 className="text-base font-black text-white truncate mt-0.5">
                {PRODUCTION_TYPE_LABELS[record.productionType]} Yield
              </h3>
            </div>
          </div>
          <Badge
            className={`shrink-0 uppercase font-extrabold tracking-wider text-[10px] px-2.5 py-0.5 shadow-xs ${
              isApproved
                ? "bg-white text-[#2D5A27] hover:bg-white"
                : isPending
                ? "bg-white text-amber-800 hover:bg-white"
                : "bg-white text-rose-800 hover:bg-white"
            }`}
          >
            {record.status}
          </Badge>
        </div>
      </div>

      <CardContent className="p-5 space-y-4">
        {/* Quantity & Output Callout */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Logged Quantity
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {formatQty(record.quantity)}
              </span>
              <span className="text-sm font-bold text-slate-600">
                {PRODUCTION_TYPE_UNITS[record.productionType] ?? record.unit}
              </span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Record Date
            </p>
            <p className="text-xs font-bold text-slate-800 flex items-center justify-end gap-1.5 mt-1">
              <CalendarDays className="size-3.5 text-slate-400" />
              {formatRecordDate(record.recordDate)}
            </p>
          </div>
        </div>

        {/* Status-specific Approval & Remark Section */}
        {isApproved && (
          <div className="space-y-3">
            {/* Approval Badge Card */}
            <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 flex items-start gap-3">
              <div className="size-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">
                    Validated & Approved
                  </h4>
                  <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 font-bold hover:bg-emerald-600">
                    Official Record
                  </Badge>
                </div>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  This production entry has been inspected, verified, and officially logged into the municipal database.
                </p>
              </div>
            </div>

            {/* Remark Details Box */}
            <div className="rounded-xl border border-emerald-200/90 bg-gradient-to-b from-white to-emerald-50/30 p-4 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <MessageSquareQuote className="size-4 text-emerald-700" />
                  <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Reviewer Remarks
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  SIBAT / MAO
                </span>
              </div>

              {record.reviewRemarks && record.reviewRemarks.trim() ? (
                <div className="p-3 rounded-lg bg-emerald-50/70 border-l-3 border-emerald-600">
                  <p className="text-xs font-medium text-emerald-950 italic leading-relaxed whitespace-pre-wrap">
                    &ldquo;{record.reviewRemarks}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60">
                  <p className="text-xs text-slate-500 italic">
                    Approved with standard validation. No additional remarks were noted by the reviewer.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {isVerified && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 flex items-start gap-3">
              <div className="size-8 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700 shrink-0 mt-0.5">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-xs font-black uppercase tracking-wider text-sky-900">
                    Verified by SIBAT Field Officer
                  </h4>
                  <Badge className="bg-sky-600 text-white text-[9px] px-1.5 py-0 font-bold hover:bg-sky-600">
                    Ready for MAO
                  </Badge>
                </div>
                <p className="text-xs text-sky-800 mt-1 leading-relaxed">
                  Your entry has been field-verified by SIBAT and is awaiting final MAO certification.
                </p>
              </div>
            </div>

            {record.reviewRemarks && (
              <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-sky-800">
                  <MessageSquareQuote className="size-4" />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    SIBAT Inspection Notes
                  </p>
                </div>
                <p className="text-xs text-sky-900 italic">
                  &ldquo;{record.reviewRemarks}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {isPending && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <div className="size-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
                <Clock className="size-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                  Awaiting Validation
                </h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Your submitted entry is currently queued for review by the barangay SIBAT officer.
                </p>
              </div>
            </div>

            {record.reviewRemarks && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-800">
                  <MessageSquareQuote className="size-4" />
                  <p className="text-xs font-bold uppercase tracking-wider">
                    Validator Notes
                  </p>
                </div>
                <p className="text-xs text-amber-900 italic">
                  &ldquo;{record.reviewRemarks}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {isRejected && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <div className="size-8 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0 mt-0.5">
                <ShieldAlert className="size-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                  Entry Rejected
                </h4>
                <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                  This production entry was flagged or rejected during data validation.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-rose-800">
                <MessageSquareQuote className="size-4" />
                <p className="text-xs font-bold uppercase tracking-wider">
                  Rejection Reason / Remarks
                </p>
              </div>
              <p className="text-xs text-rose-950 font-medium italic">
                {record.reviewRemarks
                  ? `"${record.reviewRemarks}"`
                  : "No rejection remarks were provided. Please contact your SIBAT officer."}
              </p>
            </div>
          </div>
        )}

        <Separator className="opacity-60" />

        {/* Specification Details Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Livestock
            </span>
            <span className="font-semibold text-slate-800 truncate block mt-0.5">
              {record.livestockTypeName ?? `Livestock #${record.livestockId}`}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Livestock ID
            </span>
            <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
              <Tag className="size-3 text-slate-400" />
              #{record.livestockId}
            </span>
          </div>

          {record.barangayName && (
            <div className="col-span-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Barangay / Location
              </span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <MapPin className="size-3 text-slate-400" />
                {record.barangayName}
              </span>
            </div>
          )}

          <div className="col-span-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Submitted At
            </span>
            <span className="font-medium text-slate-700 block mt-0.5">
              {formatDateTime(record.createdAt)}
            </span>
          </div>
        </div>

        {/* Farmer's Submission Notes */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Farmer Submission Notes
          </p>
          <p className="text-xs text-slate-700 italic">
            {record.notes ? `"${record.notes}"` : "No notes attached to this record."}
          </p>
        </div>

        {/* Footer Actions / Lock State */}
        <div className="pt-2">
          {isApproved ? (
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-2 text-emerald-800 text-xs font-semibold">
              <Lock className="size-3.5 shrink-0 text-emerald-700" />
              <span>Record is approved & locked against modifications.</span>
            </div>
          ) : (
            onDelete && (
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={() => onDelete(record)}
                className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 text-xs font-bold gap-1.5 h-9"
              >
                <Trash2 className="size-3.5" />
                Delete / Cancel Record
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
