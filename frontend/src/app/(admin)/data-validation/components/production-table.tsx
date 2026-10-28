"use client";

import { ProductionRecordItem } from "@/app/(farmer)/production-dashboard/production-analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from "@/components/ui/table";
import {
Calendar,
CheckCircle2,
ChevronRight,
Egg,
Eye,
Layers,
MapPin,
Milk,
} from "lucide-react";
import { DetailRecordData } from "../record-detail-dialog";
import { getStatusPill } from "../validation-analytics";

interface ProductionTableProps {
  records: ProductionRecordItem[];
  onViewDetail: (detail: DetailRecordData) => void;
}

export function ProductionTable({
  records,
  onViewDetail,
}: ProductionTableProps) {

  const buildDetailPayload = (prod: ProductionRecordItem): DetailRecordData => ({
    kind: "production",
    slaughterDetails: prod.slaughterDetails,
    id: prod.id,
    farmerName: prod.farmerName || "Registered Farmer",
    barangayName: prod.barangayName || "Batangas Municipality",
    livestockTypeName: prod.livestockTypeName || "Livestock",
    livestockTagNumber: prod.livestockTagNumber,
    productionType: prod.productionType,
    quantity: prod.quantity,
    unit: prod.unit,
    recordDate: prod.recordDate,
    notes: prod.notes,
    status: prod.status,
    reviewRemarks: prod.reviewRemarks,
    reviewedByName: prod.reviewedByName,
    reviewedByRole: prod.reviewedByRole,
    reviewedAt: prod.reviewedAt,
    createdAt: prod.createdAt,
    anomalyAssessmentStatus: prod.anomalyAssessmentStatus,
    anomalyDetected: prod.anomalyDetected,
    requiresCbatVerification: prod.requiresCbatVerification,
    nextReviewQueue: prod.nextReviewQueue,
    anomalyReason: prod.anomalyReason,
    anomalyAssessment: prod.anomalyAssessment,
  });

  return (
    <>
      {/* ── DESKTOP & TABLET VIEW (md and up) ── */}
      <div className="hidden md:block bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                <TableHead className="w-14 px-6 py-5 text-center">History</TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Farmer / Raiser
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Barangay
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Production Type
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                  Yield Output
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Record Date
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                  Status
                </TableHead>
                <TableHead className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-50">
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-green-500" />
                      <p className="text-sm font-bold text-gray-800">No production logs found</p>
                    <p className="text-xs text-gray-400 font-medium">Farmer production logs are informational and do not require municipal review.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((prod) => {
                  const statusNorm = (prod.status || "PENDING").toUpperCase();
                  const detailPayload = buildDetailPayload(prod);

                  return (
                    <TableRow
                      key={prod.id}
                      className="group hover:bg-gray-50/80 transition-all border-none"
                    >
                      <TableCell className="px-6 py-5 text-center">
                        <span className="text-[9px] font-bold uppercase text-slate-400">View only</span>
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100 text-[#2D5A27] shrink-0">
                            {prod.productionType === "milk" ? (
                              <Milk size={20} />
                            ) : prod.productionType === "eggs" ? (
                              <Egg size={20} />
                            ) : (
                              <Layers size={20} />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm leading-snug">
                              {prod.farmerName || `Farmer #${prod.livestockId}`}
                            </p>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                              {prod.livestockTypeName || "Livestock"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-sm font-bold text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-gray-300" />
                          <span>{prod.barangayName || "Municipality"}</span>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <Badge
                          variant="outline"
                          className="border-none text-[9px] font-black uppercase px-3 py-1 rounded-full bg-blue-100 text-blue-700"
                        >
                          {prod.productionType}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-right">
                        <p className="font-black text-[#2D5A27] text-sm">
                          {prod.quantity}{" "}
                          <span className="text-[10px] font-black text-gray-500 uppercase">{prod.unit}</span>
                        </p>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-sm font-bold text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-300" />
                          <span>{prod.recordDate}</span>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-center">
                        <Badge
                          variant="outline"
                          className={`border text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${getStatusPill(prod.status).bg}`}
                        >
                          <span className={`size-1.5 rounded-full mr-1.5 ${getStatusPill(prod.status).dot}`} />
                          {statusNorm === "PENDING" ? "Legacy Pending" : statusNorm === "VERIFIED" ? "Legacy Verified" : getStatusPill(prod.status).label}
                        </Badge>
                        {statusNorm === "VERIFIED" && prod.reviewedByName && (
                          <span className="block text-[8px] text-sky-700 font-bold tracking-tight mt-0.5">
                            By {prod.reviewedByName} ({prod.reviewedByRole || "SIBAT"})
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewDetail(detailPayload)}
                            title="View Record Details & Audit Ledger"
                            className="h-9 w-9 bg-gray-100 hover:bg-[#2D5A27] hover:text-white rounded-xl text-gray-500 transition-all cursor-pointer"
                          >
                            <ChevronRight size={18} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── MOBILE CARD LIST VIEW (under md) ── */}
      <div className="md:hidden space-y-3">
        {records.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-sm font-bold text-gray-800">No production logs found</p>
            <p className="text-xs text-gray-400">Farmer production logs are informational and do not require municipal review.</p>
          </div>
        ) : (
          records.map((prod) => {
            const statusNorm = (prod.status || "PENDING").toUpperCase();
            const detailPayload = buildDetailPayload(prod);

            return (
              <div
                key={prod.id}
                className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 space-y-3"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-green-100 text-[#2D5A27] flex items-center justify-center shrink-0">
                      {prod.productionType === "milk" ? (
                        <Milk size={20} />
                      ) : prod.productionType === "eggs" ? (
                        <Egg size={20} />
                      ) : (
                        <Layers size={20} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">
                        {prod.farmerName || `Farmer #${prod.livestockId}`}
                      </p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 truncate">
                        <MapPin size={11} /> {prod.barangayName || "Municipality"}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`border text-[9px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 ${getStatusPill(prod.status).bg}`}
                  >
                    <span className={`size-1.5 rounded-full mr-1.5 ${getStatusPill(prod.status).dot}`} />
                    {statusNorm === "PENDING" ? "Legacy Pending" : statusNorm === "VERIFIED" ? "Legacy Verified" : getStatusPill(prod.status).label}
                  </Badge>
                </div>

                {statusNorm === "VERIFIED" && prod.reviewedByName && (
                  <div className="text-[10px] text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100 flex items-center justify-between">
                    <span className="font-bold">Verified by {prod.reviewedByRole === "CBAT" ? "CBAT" : "SIBAT"} Officer</span>
                    <span className="font-mono font-bold">{prod.reviewedByName}</span>
                  </div>
                )}

                {/* Info Pills */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-green-50/70 rounded-xl flex items-center gap-2">
                    <div className="min-w-0">
                      <span className="text-[9px] font-black text-green-700 uppercase block">Declared Yield</span>
                      <span className="font-black text-[#2D5A27] truncate block">
                        {prod.quantity} {prod.unit}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-gray-50 rounded-xl flex items-center gap-2">
                    <Calendar size={13} className="text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9px] font-black text-gray-400 uppercase block">Date</span>
                      <span className="font-bold text-gray-700 truncate block">{prod.recordDate}</span>
                    </div>
                  </div>
                </div>

                {prod.notes && (
                  <p className="text-[11px] text-gray-500 italic bg-gray-50/80 px-3 py-1.5 rounded-xl truncate">
                    &quot;{prod.notes}&quot;
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetail(detailPayload)}
                    className="flex-1 py-2.5 h-auto rounded-xl border-gray-200 text-gray-700 text-xs font-bold gap-1.5"
                  >
                    <Eye size={15} />
                    <span>Details</span>
                  </Button>

                  <span className="flex-1 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">History only</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
