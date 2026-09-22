"use client";

import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Milk,
  Egg,
  Layers,
  MapPin,
  Calendar,
  Eye,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { ProductionRecordItem } from "@/app/(farmer)/production-dashboard/production-analytics";
import { ReviewTargetItem } from "../validation-review-dialog";
import { DetailRecordData } from "../record-detail-dialog";
import { getStatusPill } from "../validation-analytics";

interface ProductionTableProps {
  records: ProductionRecordItem[];
  selectedIds: (string | number)[];
  onToggleSelect: (id: string | number) => void;
  onSelectAll: (checked: boolean) => void;
  onViewDetail: (detail: DetailRecordData) => void;
  onReview: (target: ReviewTargetItem) => void;
}

export function ProductionTable({
  records,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewDetail,
  onReview,
}: ProductionTableProps) {
  const allSelected = records.length > 0 && records.every((p) => selectedIds.includes(p.id));

  const buildDetailPayload = (prod: ProductionRecordItem): DetailRecordData => ({
    kind: "production",
    id: prod.id,
    farmerName: prod.farmerName || "Registered Farmer",
    barangayName: prod.barangayName || "Batangas Municipality",
    livestockTypeName: prod.livestockTypeName || "Livestock",
    productionType: prod.productionType,
    quantity: prod.quantity,
    unit: prod.unit,
    recordDate: prod.recordDate,
    notes: prod.notes,
    status: prod.status,
    reviewRemarks: prod.reviewRemarks,
    reviewedByName: prod.reviewedByName,
    reviewedAt: prod.reviewedAt,
    createdAt: prod.createdAt,
  });

  return (
    <>
      {/* ── DESKTOP & TABLET VIEW (md and up) ── */}
      <div className="hidden md:block bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                <TableHead className="w-14 px-6 py-5 text-center">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
                    className="rounded-md border-gray-300 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27]"
                  />
                </TableHead>
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
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                  Quick Actions
                </TableHead>
                <TableHead className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Details
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-50">
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-green-500" />
                      <p className="text-sm font-bold text-gray-800">No production logs found</p>
                      <p className="text-xs text-gray-400 font-medium">All submitted farmer yields are verified.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((prod) => {
                  const isSelected = selectedIds.includes(prod.id);
                  const statusNorm = (prod.status || "PENDING").toUpperCase();
                  const detailPayload = buildDetailPayload(prod);

                  return (
                    <TableRow
                      key={prod.id}
                      className={`group hover:bg-gray-50/80 transition-all border-none ${
                        isSelected ? "bg-green-50/40" : ""
                      }`}
                    >
                      <TableCell className="px-6 py-5 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect(prod.id)}
                          className="rounded-md border-gray-300 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27]"
                        />
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
                          {getStatusPill(prod.status).label}
                        </Badge>
                        {statusNorm === "VERIFIED" && prod.reviewedByName && (
                          <span className="block text-[8px] text-sky-700 font-bold tracking-tight mt-0.5">
                            By {prod.reviewedByName}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewDetail(detailPayload)}
                            title="View Record Details"
                            className="h-8 w-8 hover:bg-white hover:shadow-md rounded-lg text-gray-400 hover:text-blue-600 transition-all"
                          >
                            <Eye size={16} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onReview({
                                id: prod.id,
                                domain: "production",
                                title: `${prod.farmerName || "Farmer"} — ${prod.productionType.toUpperCase()}`,
                                farmerOrSubmitter: prod.farmerName || "Registered Farmer",
                                barangay: prod.barangayName || "Batangas",
                                keyMetric: `${prod.quantity} ${prod.unit}`,
                                currentRemarks: prod.reviewRemarks,
                              })
                            }
                            title={
                              prod.status === "VERIFIED"
                                ? "Quick Action: MAO Approve SIBAT-Verified Record"
                                : prod.status === "PENDING"
                                ? "Quick Action: Validate & Certify"
                                : "Quick Action: Re-evaluate Determination"
                            }
                            className={`h-8 w-8 hover:bg-white hover:shadow-md rounded-lg transition-all cursor-pointer ${
                              prod.status === "VERIFIED"
                                ? "text-sky-700 hover:text-sky-900 bg-sky-50/70"
                                : prod.status === "PENDING"
                                ? "text-amber-600 hover:text-green-700"
                                : "text-gray-400 hover:text-gray-900"
                            }`}
                          >
                            <ShieldCheck size={16} />
                          </Button>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onViewDetail(detailPayload)}
                          title="Open Full Record Audit & Ledger Inspector"
                          className="h-9 w-9 bg-gray-100 rounded-xl text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-all cursor-pointer"
                        >
                          <ChevronRight size={18} />
                        </Button>
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
        {/* Mobile Header with Select All */}
        {records.length > 0 && (
          <div className="flex items-center justify-between px-2.5 py-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="-m-2 p-2 flex items-center justify-center">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onSelectAll(Boolean(checked))}
                  className="rounded-md border-gray-300 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27]"
                />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                Select All ({records.length})
              </span>
            </label>
            <span className="text-[10px] font-bold text-gray-400">
              {records.length} {records.length === 1 ? "record" : "records"}
            </span>
          </div>
        )}

        {records.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-sm font-bold text-gray-800">No production logs found</p>
            <p className="text-xs text-gray-400">All submitted farmer yields are verified.</p>
          </div>
        ) : (
          records.map((prod) => {
            const isSelected = selectedIds.includes(prod.id);
            const statusNorm = (prod.status || "PENDING").toUpperCase();
            const detailPayload = buildDetailPayload(prod);

            return (
              <div
                key={prod.id}
                className={`bg-white rounded-3xl p-4 shadow-sm border transition-all space-y-3 ${
                  isSelected
                    ? "border-[#2D5A27] bg-green-50/30 ring-1 ring-green-200/60 shadow-xs"
                    : "border-gray-100"
                }`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="-m-2 p-2 flex items-center justify-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(prod.id);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(prod.id)}
                        className="rounded-md border-gray-300 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27] shrink-0"
                      />
                    </div>
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
                    {getStatusPill(prod.status).label}
                  </Badge>
                </div>

                {statusNorm === "VERIFIED" && prod.reviewedByName && (
                  <div className="text-[10px] text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100 flex items-center justify-between">
                    <span className="font-bold">Verified by SIBAT Officer</span>
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
                    "{prod.notes}"
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

                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      onReview({
                        id: prod.id,
                        domain: "production",
                        title: `${prod.farmerName || "Farmer"} — ${prod.productionType.toUpperCase()}`,
                        farmerOrSubmitter: prod.farmerName || "Registered Farmer",
                        barangay: prod.barangayName || "Batangas",
                        keyMetric: `${prod.quantity} ${prod.unit}`,
                        currentRemarks: prod.reviewRemarks,
                      })
                    }
                    className={`flex-1 py-2.5 h-auto rounded-xl text-xs font-bold gap-1.5 shadow-xs ${
                      prod.status === "VERIFIED"
                        ? "bg-sky-700 hover:bg-sky-800 text-white"
                        : prod.status === "PENDING"
                        ? "bg-[#2D5A27] hover:bg-[#23471f] text-white"
                        : "bg-gray-900 hover:bg-gray-800 text-white"
                    }`}
                  >
                    <ShieldCheck size={15} />
                    <span>
                      {prod.status === "VERIFIED"
                        ? "MAO Approve"
                        : prod.status === "PENDING"
                        ? "Validate"
                        : "Re-evaluate"}
                    </span>
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
