"use client";

import { FileDown } from "lucide-react";
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
import { InspectionRecord } from "./auction-analytics";

interface InspectionDetailsDialogProps {
  inspection: InspectionRecord | null;
  onClose: () => void;
  statusBadge: React.ReactNode;
}

export function InspectionDetailsDialog({
  inspection,
  onClose,
  statusBadge,
}: InspectionDetailsDialogProps) {
  if (!inspection) return null;

  return (
    <Dialog open={!!inspection} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-0">
        <DialogHeader className="p-6 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white rounded-t-3xl">
          <div className="flex items-center justify-between">
            <Badge className="bg-white/20 text-white font-mono text-xs px-2.5 py-0.5">
              {inspection.control_number}
            </Badge>
            {statusBadge}
          </div>
          <DialogTitle className="text-xl font-black mt-2">
            Livestock Transport Clearance Certificate
          </DialogTitle>
          <DialogDescription className="text-purple-100 text-xs">
            Official permit issued for Padre Garcia livestock movement and market inspection.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
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
              <p className="text-xs font-mono font-bold text-slate-700">{inspection.vehicle_plate_number}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Handler License</span>
              <p className="text-xs font-mono font-bold text-slate-700">{inspection.livestock_handler_license_no}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Date Issued</span>
              <p className="text-xs font-semibold text-slate-700">{inspection.date_issued}</p>
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
                    <th className="p-3 text-center">Classification</th>
                    <th className="p-3 pr-4">Health Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspection.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-3 pl-4 font-bold text-slate-900">{it.livestock_type}</td>
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

          <DialogFooter className="gap-2 pt-4 border-t border-slate-200 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl font-bold text-xs gap-1.5 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" /> Export / Print Permit
            </Button>
            <Button
              onClick={onClose}
              className="rounded-xl font-bold text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-white cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
