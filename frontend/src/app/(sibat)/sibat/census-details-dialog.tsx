"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  User,
  Layers,
  FileDown,
  Printer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CensusSubmissionRecord } from "./sibat-analytics";
interface CensusDetailsDialogProps {
  submission: CensusSubmissionRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CensusDetailsDialog({
  submission,
  open,
  onOpenChange,
}: CensusDetailsDialogProps) {
  if (!submission) return null;

  const getStatusBadge = (status: CensusSubmissionRecord["status"]) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approved by MAO
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200 font-bold text-xs">
            <AlertCircle className="w-3.5 h-3.5 mr-1" /> Needs Revision
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold text-xs">
            <Clock className="w-3.5 h-3.5 mr-1" /> Pending MAO Review
          </Badge>
        );
    }
  };

  const handleExport = () => {
    toast.success(`Exporting Census Report for ${submission.barangay} Q${submission.reportQuarter} ${submission.reportYear}...`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50 border-slate-200 text-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1A365D] to-[#1E4E8C] text-white p-6 pb-5 shrink-0">
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20">
                  <FileSpreadsheet className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                    Census Batch {submission.id}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-sky-100 font-medium">
                    Quarterly Livestock Census Submission Details
                  </DialogDescription>
                </div>
              </div>
              {getStatusBadge(submission.status)}
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <MapPin className="w-3.5 h-3.5 text-[#1A365D]" />
                <span className="text-[10px] font-bold uppercase">Barangay</span>
              </div>
              <p className="text-sm font-black text-slate-900">{submission.barangay}</p>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Calendar className="w-3.5 h-3.5 text-[#1A365D]" />
                <span className="text-[10px] font-bold uppercase">Period</span>
              </div>
              <p className="text-sm font-black text-slate-900">
                Q{submission.reportQuarter} {submission.reportYear}
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[10px] font-bold uppercase">Total Animals</span>
              </div>
              <p className="text-sm font-black text-emerald-700 tabular-nums">
                {submission.totalHeads} Heads
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[10px] font-bold uppercase">Farmers</span>
              </div>
              <p className="text-sm font-black text-blue-700 tabular-nums">
                {submission.totalFarmers} Counted
              </p>
            </div>
          </div>

          {/* Submission Remarks */}
          {(submission.remarks || submission.reviewRemarks) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {submission.remarks && (
                <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-2xs">
                  <CardContent className="p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      Technologist Field Remarks / Notes
                    </span>
                    <p className="text-xs font-medium text-slate-700">
                      {submission.remarks}
                    </p>
                  </CardContent>
                </Card>
              )}
              {submission.reviewRemarks && (
                <Card className="border border-amber-200/80 bg-amber-50/40 rounded-2xl shadow-2xs">
                  <CardContent className="p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-amber-600">
                      MAO Review Remarks
                    </span>
                    <p className="text-xs font-medium text-slate-700">
                      {submission.reviewRemarks}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Line Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Submitted Farmer Line Items</span>
              <span className="text-slate-400 font-bold">{submission.items.length} records</span>
            </h3>

            <div className="border border-slate-200 rounded-2xl bg-white shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold uppercase text-[10px]">
                    <tr>
                      <th className="p-3 pl-4">#</th>
                      <th className="p-3">Farmer Name</th>
                      <th className="p-3">Sitio / Purok</th>
                      <th className="p-3">Livestock Species</th>
                      <th className="p-3 text-right">Head Count</th>
                      <th className="p-3 pr-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submission.items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50">
                        <td className="p-3 pl-4 font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-black text-slate-900">{item.farmerName}</td>
                        <td className="p-3 font-medium text-slate-600">{item.purok || "—"}</td>
                        <td className="p-3">
                          <span className="font-bold text-[#1A365D] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            {item.livestockType}
                          </span>
                        </td>
                        <td className="p-3 text-right font-black text-slate-900 tabular-nums">
                          {item.numberOfHeads}
                        </td>
                        <td className="p-3 pr-4 text-slate-500 font-medium">{item.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black border-t border-slate-200 text-slate-900">
                    <tr>
                      <td colSpan={4} className="p-3 pl-4 uppercase text-[11px]">
                        Total Validated Head Count:
                      </td>
                      <td className="p-3 text-right text-emerald-700 font-black tabular-nums text-sm">
                        {submission.totalHeads}
                      </td>
                      <td className="p-3 pr-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 sm:p-5 bg-slate-100/80 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="rounded-xl font-bold text-xs gap-1.5 text-slate-700"
          >
            <FileDown className="w-3.5 h-3.5" />
            Export CSV / PDF
          </Button>

          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold text-xs px-5 bg-[#1A365D] hover:bg-[#152944] text-white"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
