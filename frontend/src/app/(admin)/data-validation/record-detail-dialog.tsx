"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getIncidentTypeBadge } from "./validation-analytics";
import { CensusItemEntry } from "@/app/(sibat)/sibat/sibat-analytics";
import {
  FileSpreadsheet,
  Milk,
  Tag,
  Activity,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

export type DetailRecordData =
  | {
      kind: "census";
      id: string | number;
      barangay: string;
      reportYear: number;
      reportQuarter: number;
      submissionDate: string;
      submittedBy: string;
      totalHeads: number;
      totalFarmers: number;
      status: string;
      remarks?: string;
      reviewRemarks?: string | null;
      items?: CensusItemEntry[];
    }
  | {
      kind: "production";
      id: number;
      farmerName: string;
      barangayName: string;
      livestockTypeName: string;
      productionType: string;
      quantity: number;
      unit: string;
      recordDate: string;
      notes: string;
      status: string;
      reviewRemarks?: string | null;
      createdAt: string;
    }
  | {
      kind: "inventory";
      id: number;
      farmerName: string;
      barangayName: string;
      livestockType: string;
      tagNumber: string;
      breed: string;
      sex: string;
      weight: number | null;
      entryType: string;
      quantity: number;
      lastVaccinationDate: string | null;
      status: string;
      reviewRemarks?: string | null;
      createdAt: string;
    }
  | {
      kind: "incident";
      id: string | number;
      type: "slaughter" | "mortality" | "birth" | "sale";
      farmerName: string;
      barangayName: string;
      details: string;
      date: string;
      status: string;
      reviewRemarks?: string | null;
      headCount?: number;
      weight?: string;
      tagNumber?: string;
    };

interface RecordDetailDialogProps {
  record: DetailRecordData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenReview: (record: DetailRecordData) => void;
}

export function RecordDetailDialog({
  record,
  open,
  onOpenChange,
  onOpenReview,
}: RecordDetailDialogProps) {
  if (!record) return null;

  const statusNorm = (record.status || "PENDING").toUpperCase();

  const getIcon = () => {
    switch (record.kind) {
      case "census":
        return (
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 sm:mb-4 bg-blue-600 text-white shadow-md">
            <FileSpreadsheet className="w-7 h-7 sm:w-10 sm:h-10" />
          </div>
        );
      case "production":
        return (
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 sm:mb-4 bg-green-100 text-[#2D5A27] shadow-md">
            <Milk className="w-7 h-7 sm:w-10 sm:h-10" />
          </div>
        );
      case "inventory":
        return (
          <div className="w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 sm:mb-4 bg-amber-100 text-amber-800 shadow-md">
            <Tag className="w-7 h-7 sm:w-10 sm:h-10" />
          </div>
        );
      case "incident":
        return (
          <div
            className={`w-14 h-14 sm:w-20 sm:h-20 mx-auto rounded-2xl sm:rounded-3xl flex items-center justify-center mb-3 sm:mb-4 text-white shadow-md ${
              record.type === "mortality" ? "bg-red-600" : "bg-purple-600"
            }`}
          >
            {record.type === "mortality" ? (
              <AlertTriangle className="w-7 h-7 sm:w-10 sm:h-10" />
            ) : (
              <Activity className="w-7 h-7 sm:w-10 sm:h-10" />
            )}
          </div>
        );
    }
  };

  const getTitle = () => {
    switch (record.kind) {
      case "census":
        return record.barangay;
      case "production":
        return record.farmerName;
      case "inventory":
        return record.tagNumber || `Tag #${record.id}`;
      case "incident":
        return record.farmerName;
    }
  };

  const getSubtitle = () => {
    switch (record.kind) {
      case "census":
        return `QUARTER ${record.reportQuarter} • ${record.reportYear} CENSUS SUBMISSION`;
      case "production":
        return `${record.productionType.toUpperCase()} PRODUCTION • ${record.barangayName}`;
      case "inventory":
        return `${record.breed} (${record.livestockType}) • ${record.barangayName}`;
      case "incident":
        return `${getIncidentTypeBadge(record.type).label.toUpperCase()} • ${record.barangayName}`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-8 md:p-10 bg-white border-none shadow-2xl [&>button]:right-5 [&>button]:top-5 sm:[&>button]:right-8 sm:[&>button]:top-8 [&>button]:p-2 [&>button]:rounded-full [&>button]:hover:bg-gray-100 max-h-[90vh] overflow-y-auto ${
          record.kind === "census" ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
      >
        <DialogHeader className="text-center mb-3 sm:mb-4">
          {getIcon()}
          <DialogTitle className="text-xl sm:text-2xl font-black text-gray-900 text-center">
            {getTitle()}
          </DialogTitle>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mt-1">
            {getSubtitle()}
          </p>
        </DialogHeader>

        {/* Dynamic Detail Cards */}
        <div className="space-y-2.5 sm:space-y-3">
          {/* Census Specifics */}
          {record.kind === "census" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-2">
                <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Field Officer</span>
                  <span className="text-xs sm:text-sm font-bold text-gray-800">{record.submittedBy}</span>
                </div>
                <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Date Logged</span>
                  <span className="text-xs sm:text-sm font-bold text-gray-800">{record.submissionDate}</span>
                </div>
                <div className="p-3.5 sm:p-4 bg-green-50 rounded-2xl flex justify-between items-center">
                  <span className="text-[10px] font-black text-green-700 uppercase">Total Inventory</span>
                  <span className="text-xs sm:text-sm font-black text-[#2D5A27]">
                    {record.totalHeads} Heads ({record.totalFarmers} Raisers)
                  </span>
                </div>
                <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Status</span>
                  <Badge
                    variant="outline"
                    className={`border-none text-[9px] font-black uppercase px-2.5 sm:px-3 py-1 rounded-full ${
                      statusNorm === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : statusNorm === "REJECTED" || statusNorm === "FLAGGED"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {statusNorm}
                  </Badge>
                </div>
              </div>

              {record.remarks && (
                <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl space-y-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase block">Enumerator Notes</span>
                  <p className="text-xs text-gray-700">{record.remarks}</p>
                </div>
              )}

              {/* Census Items Breakdown */}
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Farmer Head Count Breakdown ({record.items?.length || 0} entries)
                </p>

                {/* Mobile Item Card List (under sm) */}
                <div className="sm:hidden space-y-2 max-h-56 overflow-y-auto pr-0.5">
                  {!record.items || record.items.length === 0 ? (
                    <div className="p-4 bg-gray-50 rounded-2xl text-center text-xs text-gray-400">
                      No item breakdowns recorded.
                    </div>
                  ) : (
                    record.items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 bg-gray-50 rounded-2xl flex items-center justify-between gap-2 border border-gray-100/80"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800 text-xs truncate">{item.farmerName}</p>
                          <p className="text-[10px] text-gray-400 font-medium">Purok: {item.purok || "—"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className="border-none text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white text-gray-700 shadow-2xs"
                          >
                            {item.livestockType}
                          </Badge>
                          <span className="font-black text-[#2D5A27] text-xs font-mono">
                            {item.numberOfHeads}h
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Item Table (sm and up) */}
                <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 overflow-x-auto shadow-xs">
                  <Table className="min-w-[440px] sm:min-w-full">
                    <TableHeader>
                      <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                        <TableHead className="w-10 px-3 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">
                          #
                        </TableHead>
                        <TableHead className="px-3 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                          Farmer / Raiser
                        </TableHead>
                        <TableHead className="px-3 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                          Purok
                        </TableHead>
                        <TableHead className="px-3 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                          Livestock
                        </TableHead>
                        <TableHead className="px-3 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">
                          Heads
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-gray-50 text-xs">
                      {!record.items || record.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-gray-400 font-medium">
                            No item breakdowns recorded.
                          </TableCell>
                        </TableRow>
                      ) : (
                        record.items.map((item, idx) => (
                          <TableRow key={item.id || idx} className="hover:bg-gray-50/60 border-none">
                            <TableCell className="px-3 py-2.5 text-center text-gray-400 font-bold">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="px-3 py-2.5 font-bold text-gray-800">
                              {item.farmerName}
                            </TableCell>
                            <TableCell className="px-3 py-2.5 text-gray-500 font-medium">
                              {item.purok || "—"}
                            </TableCell>
                            <TableCell className="px-3 py-2.5">
                              <Badge
                                variant="outline"
                                className="border-none text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                              >
                                {item.livestockType}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-3 py-2.5 text-right font-black text-[#2D5A27]">
                              {item.numberOfHeads}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {/* Production Specifics */}
          {record.kind === "production" && (
            <>
              <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Barangay</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800">{record.barangayName}</span>
              </div>
              <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Record Date</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800">{record.recordDate}</span>
              </div>
              <div className="p-3.5 sm:p-4 bg-green-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-green-700 uppercase">Certified Yield</span>
                <span className="text-xs sm:text-sm font-black text-[#2D5A27]">
                  {record.quantity} {record.unit}
                </span>
              </div>
              {record.notes && (
                <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl space-y-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase block">Farmer Declaration</span>
                  <p className="text-xs text-gray-700 italic">"{record.notes}"</p>
                </div>
              )}
            </>
          )}

          {/* Inventory Specifics */}
          {record.kind === "inventory" && (
            <>
              <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Livestock Owner</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800">{record.farmerName}</span>
              </div>
              <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Barangay</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800">{record.barangayName}</span>
              </div>
              <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Species / Sex</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800">
                  {record.livestockType} ({record.sex})
                </span>
              </div>
              <div className="p-3.5 sm:p-4 bg-green-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-green-700 uppercase">Registered Stock</span>
                <span className="text-xs sm:text-sm font-black text-[#2D5A27]">
                  {record.quantity} Head{record.quantity > 1 ? "s" : ""}{" "}
                  {record.weight ? `• ${record.weight} kg` : ""}
                </span>
              </div>
            </>
          )}

          {/* Incident Specifics */}
          {record.kind === "incident" && (
            <>
              <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Farmer</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800">{record.farmerName}</span>
              </div>
              <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Barangay</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800">{record.barangayName}</span>
              </div>
              <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">Date Logged</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800">{record.date}</span>
              </div>
              <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl space-y-1">
                <span className="text-[10px] font-black text-gray-400 uppercase block">Report Details</span>
                <p className="text-xs text-gray-700 leading-relaxed">{record.details}</p>
              </div>
            </>
          )}

          {/* Audit Remarks */}
          {record.reviewRemarks && (
            <div className="p-3.5 sm:p-4 bg-green-50 rounded-2xl space-y-1">
              <span className="text-[10px] font-black text-[#2D5A27] uppercase block">Official Audit Notes</span>
              <p className="text-xs text-[#2D5A27]">{record.reviewRemarks}</p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-6 sm:mt-8">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            variant="ghost"
            className="flex-1 py-4 sm:py-6 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
          >
            Close
          </Button>

          {record.status === "PENDING" && (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onOpenReview(record);
              }}
              className="flex-1 py-4 sm:py-6 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:shadow-xl transition-all gap-2"
            >
              <ShieldCheck size={18} />
              <span>Validate & Certify</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
