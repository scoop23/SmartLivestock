"use client";

import { useState } from "react";
import {
  FileDown,
  ShieldCheck,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { InspectionRecord, verifyInspection } from "./auction-analytics";

interface InspectionDetailsDialogProps {
  inspection: InspectionRecord | null;
  onClose: () => void;
  statusBadge: React.ReactNode;
  onActionSuccess?: () => void;
}

export function InspectionDetailsDialog({
  inspection,
  onClose,
  statusBadge,
  onActionSuccess,
}: InspectionDetailsDialogProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!inspection) return null;

  const canVerify =
    inspection.status === "PENDING" ||
    inspection.status === "SUBJECT_TO_REVISION" ||
    inspection.status === "REJECTED";

  const handleVerify = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      await verifyInspection(inspection.id);
      onActionSuccess?.();
      onClose();
    } catch (err: any) {
      const respData = err?.response?.data;
      setErrorMsg(
        respData?.error ||
          respData?.status ||
          "Failed to verify inspection. Please try again."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={!!inspection} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-0">
        <DialogHeader className="p-5 sm:p-6 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white rounded-t-3xl">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Badge className="bg-white/20 text-white font-mono text-xs px-2.5 py-0.5">
              {inspection.control_number}
            </Badge>
            {statusBadge}
          </div>
          <DialogTitle className="text-xl font-black mt-2">
            Livestock Transport Clearance Certificate
          </DialogTitle>
          <DialogDescription className="text-purple-100 text-xs">
            Official permit for Padre Garcia livestock movement, trade checkpoints, and market inspection.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Workflow Stage Notice */}
          {inspection.status === "SUBJECT_TO_REVISION" && inspection.review_remarks && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 text-amber-900 space-y-1">
              <p className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-amber-800">
                <RotateCcw className="w-4 h-4" /> Returned by MAO for Correction:
              </p>
              <p className="text-xs font-semibold">{inspection.review_remarks}</p>
            </div>
          )}

          {inspection.status === "VERIFIED" && (
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <p className="text-xs font-bold">
                Inspection findings verified by Auction. Awaiting municipal final review &amp; clearance issuance by MAO.
              </p>
            </div>
          )}

          {inspection.status === "APPROVED" && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-bold">
                Clearance officially approved and issued by MAO on {inspection.date_issued || "today"}. Valid for transport.
              </p>
            </div>
          )}

          {/* Key Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Shipper</span>
              <p className="text-xs font-black text-slate-900">{inspection.shipper_name}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Destination</span>
              <p className="text-xs font-black text-slate-900">{inspection.destination}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Purpose</span>
              <p className="text-xs font-black text-purple-700">{inspection.purpose}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Vehicle Plate</span>
              <p className="text-xs font-mono font-bold text-slate-700">{inspection.vehicle_plate_number || "N/A"}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Handler License</span>
              <p className="text-xs font-mono font-bold text-slate-700">{inspection.livestock_handler_license_no || "N/A"}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Date Issued</span>
              <p className="text-xs font-semibold text-slate-700">
                {inspection.status === "APPROVED" && inspection.date_issued ? inspection.date_issued : "Pending MAO approval"}
              </p>
            </div>
          </div>

          {/* Inspected Animals List */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Inspected Animals Breakdown
            </h4>
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px]">
                  <tr>
                    <th className="p-3 pl-4">Animal Species</th>
                    <th className="p-3 text-center">Head Count</th>
                    <th className="p-3 text-center">Sex</th>
                    <th className="p-3 text-center">Class</th>
                    <th className="p-3 pr-4">Health Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspection.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-3 pl-4 font-bold text-slate-900">
                        {it.livestock_type_name || String(it.livestock_type)}
                        {it.inventory_tag && (
                          <span className="block text-[10px] font-mono text-purple-700 font-normal">
                            Tag: {it.inventory_tag}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-black text-slate-900">{it.quantity}</td>
                      <td className="p-3 text-center text-slate-600">{it.sex}</td>
                      <td className="p-3 text-center text-slate-600">{it.classification}</td>
                      <td className="p-3 pr-4 text-slate-500 italic">{it.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Verification QR Block & Biosecurity Seal */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200 shrink-0">
              <svg className="size-20 sm:size-24" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="10" width="30" height="30" rx="4" fill="#6D28D9" />
                <rect x="16" y="16" width="18" height="18" rx="2" fill="white" />
                <rect x="20" y="20" width="10" height="10" rx="1" fill="#6D28D9" />

                <rect x="80" y="10" width="30" height="30" rx="4" fill="#6D28D9" />
                <rect x="86" y="16" width="18" height="18" rx="2" fill="white" />
                <rect x="90" y="20" width="10" height="10" rx="1" fill="#6D28D9" />

                <rect x="10" y="80" width="30" height="30" rx="4" fill="#6D28D9" />
                <rect x="16" y="86" width="18" height="18" rx="2" fill="white" />
                <rect x="20" y="90" width="10" height="10" rx="1" fill="#6D28D9" />

                <rect x="48" y="12" width="6" height="6" rx="1" fill="#6D28D9" />
                <rect x="58" y="12" width="6" height="6" rx="1" fill="#6D28D9" />
                <rect x="68" y="18" width="6" height="6" rx="1" fill="#6D28D9" />
                <rect x="48" y="26" width="12" height="6" rx="1" fill="#6D28D9" />

                <rect x="12" y="48" width="6" height="6" rx="1" fill="#6D28D9" />
                <rect x="24" y="48" width="6" height="12" rx="1" fill="#6D28D9" />
                <rect x="12" y="60" width="18" height="6" rx="1" fill="#6D28D9" />

                <rect x="44" y="44" width="32" height="32" rx="6" fill="#7C3AED" />
                <circle cx="60" cy="60" r="10" fill="white" />
                <circle cx="60" cy="60" r="5" fill="#6D28D9" />

                <rect x="82" y="48" width="14" height="6" rx="1" fill="#6D28D9" />
                <rect x="90" y="60" width="18" height="6" rx="1" fill="#6D28D9" />
                <rect x="82" y="70" width="6" height="14" rx="1" fill="#6D28D9" />

                <rect x="48" y="84" width="8" height="8" rx="1" fill="#6D28D9" />
                <rect x="60" y="92" width="14" height="6" rx="1" fill="#6D28D9" />
                <rect x="48" y="102" width="20" height="6" rx="1" fill="#6D28D9" />
                <rect x="84" y="90" width="12" height="6" rx="1" fill="#6D28D9" />
                <rect x="98" y="98" width="10" height="10" rx="1" fill="#6D28D9" />
              </svg>
            </div>

            <div className="space-y-1 text-center sm:text-left flex-1">
              <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span className="text-[11px] font-black uppercase text-slate-800 tracking-wider">
                  Padre Garcia Municipal Agriculture Office
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-600">
                Official Veterinary Biosecurity &amp; Movement Certificate
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                Scan via checkpoint mobile terminal to verify permit authenticity and antemortem health status.
              </p>
              <p className="text-[10px] font-mono font-bold text-purple-700">
                LGU Control Code: {inspection.control_number}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4 border-t border-slate-200 flex-col sm:flex-row justify-between items-stretch sm:items-center">
            {inspection.status === "APPROVED" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="rounded-xl font-bold text-xs gap-1.5 cursor-pointer w-full sm:w-auto"
              >
                <FileDown className="w-3.5 h-3.5" /> Export / Print Permit
              </Button>
            ) : canVerify ? (
              <Button
                onClick={handleVerify}
                disabled={isVerifying}
                className="rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer w-full sm:w-auto gap-1.5"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Verify &amp; Forward to MAO
                  </>
                )}
              </Button>
            ) : (
              <div />
            )}

            <Button
              onClick={onClose}
              className="rounded-xl font-bold text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-white cursor-pointer w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
