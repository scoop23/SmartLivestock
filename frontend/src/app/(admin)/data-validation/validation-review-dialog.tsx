"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  Layers,
  MapPin,
  User,
  AlertCircle,
  FileCheck,
  Check,
} from "lucide-react";

export interface ReviewTargetItem {
  id: string | number;
  domain: "census" | "production" | "inventory" | "incidents";
  title: string;
  subtitle?: string;
  farmerOrSubmitter: string;
  barangay: string;
  keyMetric: string;
  currentRemarks?: string | null;
}

interface ValidationReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ReviewTargetItem[];
  onConfirmAction: (
    action: "APPROVED" | "SUBJECT_TO_REVISION",
    remarks: string,
    itemIds: (string | number)[]
  ) => void;
}

const PRESET_APPROVAL_NOTES = [
  "SIBAT field inspection confirmed & officially certified by MAO.",
  "Verified against SIBAT technologist assessment and barangay ledger.",
  "Data cross-checked with cooperative collection logs.",
  "Livestock health credentials and counts verified.",
];

const PRESET_REVISION_NOTES = [
  "Discrepancy with SIBAT field inspection findings; returned for revision.",
  "Missing required field inspection or vaccination certification.",
  "Volume exceeds biological baseline; returned for verification & correction.",
  "Incorrect ear tag or farmer profile association; please rectify.",
];

export function ValidationReviewDialog({
  open,
  onOpenChange,
  items,
  onConfirmAction,
}: ValidationReviewDialogProps) {
  const [remarks, setRemarks] = useState("");
  const [presetCategory, setPresetCategory] = useState<"approval" | "revision">("approval");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setRemarks(items.length === 1 && items[0].currentRemarks ? items[0].currentRemarks : "");
      setPresetCategory("approval");
      setIsSubmitting(false);
    }
  }, [open, items]);

  if (!items || items.length === 0) return null;

  const isBatch = items.length > 1;
  const singleItem = items[0];

  const handleAction = async (status: "APPROVED" | "SUBJECT_TO_REVISION") => {
    setIsSubmitting(true);
    try {
      await onConfirmAction(status, remarks.trim(), items.map((i) => i.id));
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[98vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl rounded-2xl sm:rounded-3xl p-0 overflow-hidden bg-white border border-slate-200/80 shadow-2xl [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100 [&>button]:right-3.5 sm:[&>button]:right-5 [&>button]:top-3.5 sm:[&>button]:top-5 [&>button]:p-2 [&>button]:rounded-full [&>button]:hover:bg-white/10 max-h-[94vh] flex flex-col">
        
        {/* ═══════════ HEADER ═══════════ */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#0B2E16] to-emerald-900 text-white p-4 sm:p-6 shrink-0 pr-12 sm:pr-14">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-white/15 text-emerald-200 border-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 flex items-center gap-1.5 backdrop-blur-xs">
              <ShieldCheck className="size-3.5 text-emerald-300" />
              <span>{isBatch ? `BATCH DECISION CONSOLE` : "QUICK VALIDATION ACTION"}</span>
            </Badge>
            {isBatch && (
              <Badge className="bg-emerald-500 text-white border-0 text-[10px] font-mono font-black">
                {items.length} RECORDS
              </Badge>
            )}
          </div>

          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg sm:text-xl font-black text-white tracking-tight">
              {isBatch ? `Certify ${items.length} Selected Records` : singleItem.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-emerald-100/80 font-medium">
              {isBatch
                ? "Apply batch municipal certification or return selected records for revision in one action."
                : `Official MAO Determination • Brgy. ${singleItem.barangay}`}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ═══════════ BODY ═══════════ */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* Target Summary */}
          {isBatch ? (
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Target Queue ({items.length})
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Bulk Processing
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                {items.map((item) => (
                  <div
                    key={String(item.id)}
                    className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-slate-50"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-900 truncate text-[11px]">{item.title}</p>
                      <p className="text-[10px] text-slate-500">{item.farmerOrSubmitter} &bull; Brgy. {item.barangay}</p>
                    </div>
                    <Badge className="bg-slate-100 text-slate-800 border-0 text-[9px] font-black font-mono shrink-0">
                      {item.keyMetric}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <User className="size-3 text-slate-400" />
                  Submitter / Raiser
                </span>
                <p className="text-xs font-black text-slate-900 mt-1 truncate">
                  {singleItem.farmerOrSubmitter}
                </p>
                <p className="text-[10px] text-slate-500 truncate">Brgy. {singleItem.barangay}</p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <FileCheck className="size-3 text-emerald-600" />
                  Verified Metric
                </span>
                <p className="text-xs font-black text-emerald-900 mt-1 font-mono">
                  {singleItem.keyMetric}
                </p>
                <p className="text-[10px] text-slate-500 uppercase">{singleItem.domain} entry</p>
              </div>
            </div>
          )}

          {/* Official Remarks Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Official Certification Remarks
              </label>
              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
            </div>
            <Textarea
              placeholder="Enter validation notes, verified ear tags, or correction guidance..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="text-xs bg-white border-slate-200 rounded-xl min-h-[85px] focus-visible:ring-emerald-500/20"
            />
          </div>

          {/* Preset Notes Strip */}
          <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="size-3 text-amber-500" />
                Quick Preset Remarks
              </span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-[9px] font-bold">
                <button
                  type="button"
                  onClick={() => setPresetCategory("approval")}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                    presetCategory === "approval" ? "bg-white text-emerald-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  For Approval
                </button>
                <button
                  type="button"
                  onClick={() => setPresetCategory("revision")}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                    presetCategory === "revision" ? "bg-white text-amber-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  For Revision
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-0.5">
              {(presetCategory === "approval" ? PRESET_APPROVAL_NOTES : PRESET_REVISION_NOTES).map(
                (preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRemarks(preset)}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all cursor-pointer text-left border border-slate-200/60"
                  >
                    {preset}
                  </button>
                )
              )}
            </div>
          </div>

        </div>

        {/* ═══════════ FOOTER ACTIONS ═══════════ */}
        <div className="p-3.5 sm:p-4.5 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => handleAction("SUBJECT_TO_REVISION")}
            className="flex-1 py-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 rounded-xl text-xs font-black uppercase tracking-wider gap-2 cursor-pointer"
          >
            <RotateCcw className="size-4 text-amber-700" />
            <span>Return for Revision</span>
          </Button>

          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction("APPROVED")}
            className="flex-1 py-4 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-xl text-xs font-black uppercase tracking-wider gap-2 shadow-md hover:shadow-lg cursor-pointer transition-all"
          >
            <ShieldCheck className="size-4 text-emerald-300" />
            <span>MAO Approve & Certify</span>
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
