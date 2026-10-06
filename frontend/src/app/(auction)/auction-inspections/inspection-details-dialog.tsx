"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  FileDown,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  MapPin,
  Map,
  Truck,
  Building,
  Calendar,
  Check,
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
import { InspectionRecord, resubmitInspection, submitFarmerRequest } from "./auction-analytics";
import { cowHead } from "@lucide/lab";
import { Icon } from "lucide-react";

const CowHeadIcon = ({ className }: { className?: string }) => (
  <Icon iconNode={cowHead} className={className} />
);

interface InspectionDetailsDialogProps {
  inspection: InspectionRecord | null;
  onClose: () => void;
  statusBadge: React.ReactNode;
  onActionSuccess?: () => void;
  onEdit?: () => void;
}

export function InspectionDetailsDialog({
  inspection,
  onClose,
  statusBadge,
  onActionSuccess,
  onEdit,
}: InspectionDetailsDialogProps) {
  const router = useRouter();
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!inspection) return null;

  const canResubmit = inspection.status === "SUBJECT_TO_REVISION" && inspection.can_edit;
  const canSubmitFarmerRequest = inspection.can_submit_farmer_request;

  const handleResubmit = async () => {
    setIsResubmitting(true);
    setErrorMsg(null);
    try {
      if (canSubmitFarmerRequest) {
        await submitFarmerRequest(inspection.id);
      } else {
        await resubmitInspection(inspection.id);
      }
      onActionSuccess?.();
      onClose();
    } catch (err: unknown) {
      const respData = axios.isAxiosError(err) ? err.response?.data as Record<string, string> | undefined : undefined;
      setErrorMsg(
        respData?.error ||
          respData?.status ||
          respData?.detail ||
          "Failed to resubmit the record. Please try again."
      );
    } finally {
      setIsResubmitting(false);
    }
  };

  const totalAnimals = inspection.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

  // Determine active step index in the verification workflow
  // 0: Draft / Pending
  // 1: Submitted to MAO
  // 2: MAO Review & Cleared
  let currentStep = 0;
  if (inspection.status === "PENDING" || inspection.status === "VERIFIED") currentStep = 1;
  else if (inspection.status === "APPROVED") currentStep = 2;
  else if (inspection.status === "SUBJECT_TO_REVISION" || inspection.status === "REJECTED") currentStep = 0;

  return (
    <Dialog open={!!inspection} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl p-0 shadow-2xl">
        {/* Header Banner */}
        <DialogHeader className="p-5 sm:p-6 bg-gradient-to-r from-[#7C3AED] via-[#6D28D9] to-[#5B21B6] text-white rounded-t-3xl">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Badge className="bg-white/20 text-white font-mono text-xs px-2.5 py-0.5 border border-white/30">
              Control #{inspection.control_number}
            </Badge>
            {statusBadge}
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black mt-2 tracking-tight">
            {inspection.status === "APPROVED" ? "Livestock Transport Clearance" : "Auction Livestock Movement Log"}
          </DialogTitle>
          <DialogDescription className="text-purple-100 text-xs sm:text-sm">
            Auction house intake record submitted for official MAO review
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ════ SECTION 1: VERIFICATION & WORKFLOW STEPPER ════ */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Movement Log Review Progress
              </span>
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                {inspection.status === "APPROVED"
                  ? "Status: CLEARED"
                  : inspection.status === "SUBJECT_TO_REVISION"
                  ? "Status: REVISION REQUIRED"
                  : canSubmitFarmerRequest ? "Status: AWAITING AUCTION" : "Status: AWAITING MAO"}
              </span>
            </div>

            {/* Visual Stepper */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div
                className={`p-2.5 rounded-xl text-center border transition-all ${
                  currentStep >= 0
                    ? "bg-purple-100/70 border-purple-300 text-[#7C3AED]"
                    : "bg-white border-slate-200 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-[11px] font-black">
                  <Check className="w-3.5 h-3.5" /> 1. Recorded
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Auction Entry</p>
              </div>

              <div
                className={`p-2.5 rounded-xl text-center border transition-all ${
                  currentStep >= 1
                    ? "bg-blue-100/70 border-blue-300 text-blue-800"
                    : "bg-white border-slate-200 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-[11px] font-black">
                  {currentStep >= 1 ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />} 2. Submitted
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">MAO Queue</p>
              </div>

              <div
                className={`p-2.5 rounded-xl text-center border transition-all ${
                  currentStep >= 2
                    ? "bg-emerald-100/70 border-emerald-300 text-emerald-800"
                    : inspection.status === "SUBJECT_TO_REVISION"
                    ? "bg-amber-100 border-amber-300 text-amber-900"
                    : "bg-white border-slate-200 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-[11px] font-black">
                  {currentStep >= 2 ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : inspection.status === "SUBJECT_TO_REVISION" ? (
                    <RotateCcw className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  3. MAO Review
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Final Decision</p>
              </div>
            </div>

            {/* Workflow Stage Remarks / Alerts */}
            {inspection.status === "SUBJECT_TO_REVISION" && inspection.review_remarks && (
              <div className="p-3.5 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-950 space-y-1">
                <p className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-amber-900">
                  <RotateCcw className="w-4 h-4" /> Returned by MAO for Revision:
                </p>
                <p className="text-xs font-semibold">{inspection.review_remarks}</p>
              </div>
            )}

            {(inspection.status === "PENDING" || inspection.status === "VERIFIED") && (
              <p className="text-xs font-semibold text-blue-900 bg-blue-50/80 p-2.5 rounded-xl border border-blue-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                {canSubmitFarmerRequest
                  ? "Farmer request awaits Auction staff submission."
                  : "Auction movement record submitted. Awaiting official MAO review."}
              </p>
            )}

            {inspection.status === "APPROVED" && (
              <p className="text-xs font-semibold text-emerald-900 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Clearance approved and issued on {inspection.date_issued || "today"}. Officially cleared for transport.
              </p>
            )}
          </div>

          {/* ════ SECTION 2: LIVESTOCK DETAILS ════ */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <CowHeadIcon className="w-4 h-4 text-[#7C3AED]" />
                Livestock Breakdown ({totalAnimals} Heads Total)
              </h4>
              <Badge variant="outline" className="text-[11px] font-mono font-bold">
                {inspection.items.length} Batch Record{inspection.items.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-black uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3 pl-4">Livestock / Species</th>
                    <th className="p-3 text-center">Head Count</th>
                    <th className="p-3 text-center">Sex</th>
                    <th className="p-3 text-center">Classification</th>
                    <th className="p-3 pr-4">Line Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {inspection.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/30 transition-colors">
                      <td className="p-3 pl-4 font-bold text-slate-900">
                        {it.livestock_type_name || String(it.livestock_type)}
                        {it.inventory_tag && (
                          <span className="block text-[10px] font-mono text-purple-700 font-bold">
                            Tag: {it.inventory_tag}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-black text-slate-900 text-sm font-mono">
                        {it.quantity}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                          {it.sex}
                        </span>
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-700">
                        {it.classification}
                      </td>
                      <td className="p-3 pr-4 text-slate-600 italic">
                        {it.remarks || "No notes"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ════ SECTION 3: AUCTION & SHIPPER PARTICULARS ════ */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-[#7C3AED]" />
              Auction, Shipper &amp; Transport Particulars
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Shipper / Owner</span>
                <p className="font-black text-slate-900 mt-0.5">{inspection.shipper_name}</p>
                {inspection.shipper_address && (
                  <p className="text-[11px] text-slate-500 truncate">{inspection.shipper_address}</p>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Inspection Date</span>
                <p className="font-black text-slate-900 font-mono mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-purple-600" /> {inspection.inspection_date}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Purpose</span>
                <span className="font-extrabold text-[11px] text-purple-700 bg-purple-100/70 border border-purple-200 px-2 py-0.5 rounded-md inline-block mt-0.5">
                  {inspection.purpose}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Vehicle Plate Number</span>
                <p className="font-mono font-bold text-slate-800 mt-0.5">
                  {inspection.vehicle_plate_number || "Not specified"}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Handler License No.</span>
                <p className="font-mono font-bold text-slate-800 mt-0.5">
                  {inspection.livestock_handler_license_no || "Not specified"}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Issuing Officer</span>
                <p className="font-bold text-slate-800 mt-0.5">
                  {inspection.created_by_name || "Auction Officer"}
                </p>
              </div>
            </div>
          </div>

          {/* ════ SECTION 4: MOVEMENT ROUTE & GIS CONNECTION ════ */}
          <div className="bg-gradient-to-br from-purple-50/70 via-white to-purple-50/30 p-4 rounded-2xl border-2 border-purple-200/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#7C3AED]" />
                  Livestock Movement Route &amp; GIS Telemetry
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Trace animal origin, destination checkpoints, and municipal movement flows.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  router.push("/auction-gis");
                }}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-black rounded-xl shadow-xs gap-1.5 cursor-pointer"
              >
                <Map className="w-3.5 h-3.5" />
                View Movement on GIS Map
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-white p-3 rounded-xl border border-purple-100 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 text-[#7C3AED] shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Origin Point</span>
                  <p className="text-xs font-black text-slate-900 truncate">
                    {inspection.origin || "Not recorded"}
                  </p>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-purple-100 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Destination</span>
                  <p className="text-xs font-black text-slate-900 truncate">
                    {inspection.destination || "Not recorded"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="gap-2 p-4 sm:p-6 border-t border-slate-200 flex-col sm:flex-row justify-between items-stretch sm:items-center bg-slate-50/50 rounded-b-3xl">
          {inspection.status === "APPROVED" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl font-bold text-xs gap-1.5 cursor-pointer w-full sm:w-auto"
            >
              <FileDown className="w-3.5 h-3.5" /> Export / Print Permit
            </Button>
          ) : canResubmit || canSubmitFarmerRequest ? (
            <div className="flex gap-2">
            {canResubmit && <Button variant="outline" onClick={onEdit}>Edit Record</Button>}
            <Button
              onClick={handleResubmit}
              disabled={isResubmitting}
              className="rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer w-full sm:w-auto gap-1.5 shadow-xs"
            >
              {isResubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> {canSubmitFarmerRequest ? "Submit Farmer Request to MAO" : "Resubmit to MAO"}
                </>
              )}
            </Button>
            </div>
          ) : (
            <div />
          )}

          <Button
            onClick={onClose}
            className="rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white cursor-pointer w-full sm:w-auto"
          >
            Close Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

