"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
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
  onConfirmAction: (action: "APPROVED" | "REJECTED", remarks: string, itemIds: (string | number)[]) => void;
}

const PRESET_APPROVAL_NOTES = [
  "SIBAT field inspection report confirmed & certified by MAO.",
  "Verified against SIBAT technologist assessment and barangay records.",
  "Data cross-checked with cooperative collection logs.",
  "Ear tag, livestock health credentials, and count verified.",
];

const PRESET_REJECTION_NOTES = [
  "Discrepancy with SIBAT field inspection findings.",
  "Missing required field inspection certification.",
  "Volume exceeds biological baseline; returned for SIBAT re-check.",
  "Incorrect ear tag or farmer profile association.",
];

export function ValidationReviewDialog({
  open,
  onOpenChange,
  items,
  onConfirmAction,
}: ValidationReviewDialogProps) {
  const [remarks, setRemarks] = useState("");
  const [actionType, setActionType] = useState<"APPROVED" | "REJECTED" | null>(null);

  useEffect(() => {
    if (open) {
      setRemarks(items.length === 1 && items[0].currentRemarks ? items[0].currentRemarks : "");
      setActionType(null);
    }
  }, [open, items]);

  if (!items || items.length === 0) return null;

  const isBatch = items.length > 1;
  const singleItem = items[0];

  const handleAction = (status: "APPROVED" | "REJECTED") => {
    onConfirmAction(status, remarks.trim(), items.map((i) => i.id));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[calc(100%-1.5rem)] sm:max-w-md rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-8 md:p-10 bg-white border-none shadow-2xl [&>button]:right-4 [&>button]:top-4 sm:[&>button]:right-8 sm:[&>button]:top-8 [&>button]:p-2 [&>button]:rounded-full [&>button]:hover:bg-gray-100 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="text-center mb-4 sm:mb-6">
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 sm:mb-4 bg-[#2D5A27] text-white shadow-md">
            <ShieldCheck className="w-7 h-7 sm:w-10 sm:h-10" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-gray-900 text-center">
            {isBatch ? `Batch Validation` : "Record Validation"}
          </DialogTitle>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mt-1">
            {isBatch ? `${items.length} Records Selected for Review` : singleItem.title}
          </p>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {/* Target Record Summary */}
          {isBatch ? (
            <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Selected Items</span>
                <span className="text-xs sm:text-sm font-black text-[#2D5A27]">{items.length} Entries</span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                {items.map((item) => (
                  <div
                    key={String(item.id)}
                    className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-white shadow-2xs"
                  >
                    <span className="font-bold text-gray-800 truncate max-w-[180px] sm:max-w-[200px]">{item.title}</span>
                    <span className="text-gray-500 font-bold">{item.barangay}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Submitter</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800">{singleItem.farmerOrSubmitter}</span>
              </div>
              <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Barangay</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800">{singleItem.barangay}</span>
              </div>
              <div className="p-3.5 sm:p-4 bg-green-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-green-700 uppercase">Record Metric</span>
                <span className="text-xs sm:text-sm font-black text-[#2D5A27]">{singleItem.keyMetric}</span>
              </div>
            </div>
          )}

          {/* Validation Remarks */}
          <div className="space-y-1.5 pt-1 sm:pt-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
              Official Review Remarks
            </span>
            <Textarea
              placeholder="Enter validation notes, inspection findings, or guidance..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full p-3.5 sm:p-4 bg-gray-50 border-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27] text-xs font-medium resize-none h-20 sm:h-24"
            />
          </div>

          {/* Quick Preset Suggestions */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <Sparkles size={12} className="text-amber-500" />
              <span>Preset Suggestions</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {(actionType === "REJECTED" ? PRESET_REJECTION_NOTES : PRESET_APPROVAL_NOTES).map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRemarks(preset)}
                  className="text-[10px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-all text-left leading-tight"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleAction("REJECTED")}
              className="flex-1 py-3.5 sm:py-5 bg-red-50 hover:bg-red-100 text-red-700 rounded-2xl font-black uppercase text-xs tracking-widest transition-all gap-2"
            >
              <XCircle size={18} />
              <span>Flag / Reject</span>
            </Button>

            <Button
              type="button"
              onClick={() => handleAction("APPROVED")}
              className="flex-1 py-3.5 sm:py-5 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:shadow-xl transition-all gap-2 shadow-xs"
            >
              <CheckCircle2 size={18} />
              <span>Approve & Certify</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
