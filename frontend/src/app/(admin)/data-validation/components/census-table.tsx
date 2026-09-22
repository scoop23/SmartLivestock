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
  FileSpreadsheet,
  Calendar,
  Eye,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  User,
  Layers,
} from "lucide-react";
import { CensusSubmissionRecord } from "@/app/(sibat)/sibat/sibat-analytics";
import { ReviewTargetItem } from "../validation-review-dialog";
import { DetailRecordData } from "../record-detail-dialog";
import { getStatusPill } from "../validation-analytics";

interface CensusTableProps {
  records: CensusSubmissionRecord[];
  selectedIds: (string | number)[];
  onToggleSelect: (id: string | number) => void;
  onSelectAll: (checked: boolean) => void;
  onViewDetail: (detail: DetailRecordData) => void;
  onReview: (target: ReviewTargetItem) => void;
}

export function CensusTable({
  records,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewDetail,
  onReview,
}: CensusTableProps) {
  const allSelected = records.length > 0 && records.every((c) => selectedIds.includes(c.id));

  const buildDetailPayload = (census: CensusSubmissionRecord): DetailRecordData => ({
    kind: "census",
    id: census.id,
    barangay: census.barangay,
    reportYear: census.reportYear,
    reportQuarter: census.reportQuarter,
    submissionDate: census.submissionDate,
    submittedBy: census.submittedBy,
    totalHeads: census.totalHeads,
    totalFarmers: census.totalFarmers,
    status: census.status,
    remarks: census.remarks,
    reviewRemarks: census.reviewRemarks,
    reviewedByName: census.submittedBy,
    reviewedAt: census.submissionDate,
    items: census.items,
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
                  Barangay / Census Batch
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Enumerator
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Submission Date
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                  Head Count
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
                  <TableCell colSpan={8} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <CheckCircle2 className="w-10 h-10 text-green-500" />
                      <p className="text-sm font-bold text-gray-800">No census records match your filter</p>
                      <p className="text-xs text-gray-400 font-medium">All quarterly census submissions are validated.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((census) => {
                  const isSelected = selectedIds.includes(census.id);
                  const statusNorm = (census.status || "PENDING").toUpperCase();
                  const detailPayload = buildDetailPayload(census);

                  return (
                    <TableRow
                      key={census.id}
                      className={`group hover:bg-gray-50/80 transition-all border-none ${
                        isSelected ? "bg-green-50/40" : ""
                      }`}
                    >
                      <TableCell className="px-6 py-5 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect(census.id)}
                          className="rounded-md border-gray-300 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27]"
                        />
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600 text-white shadow-xs shrink-0">
                            <FileSpreadsheet size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm leading-snug">{census.barangay}</p>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                              Quarter {census.reportQuarter} • {census.reportYear}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <p className="font-bold text-gray-700 text-sm">{census.submittedBy}</p>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                          Field Officer
                        </span>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-sm font-bold text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-300" />
                          <span>{census.submissionDate}</span>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-right">
                        <p className="font-black text-[#2D5A27] text-sm">{census.totalHeads} Heads</p>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                          {census.totalFarmers} Raisers
                        </span>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-center">
                        <Badge
                          variant="outline"
                          className={`border text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${getStatusPill(census.status).bg}`}
                        >
                          <span className={`size-1.5 rounded-full mr-1.5 ${getStatusPill(census.status).dot}`} />
                          {getStatusPill(census.status).label}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewDetail(detailPayload)}
                            title="View Census Line Items"
                            className="h-8 w-8 hover:bg-white hover:shadow-md rounded-lg text-gray-400 hover:text-blue-600 transition-all"
                          >
                            <Eye size={16} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onReview({
                                id: census.id,
                                domain: "census",
                                title: `${census.barangay} Q${census.reportQuarter} ${census.reportYear}`,
                                farmerOrSubmitter: census.submittedBy,
                                barangay: census.barangay,
                                keyMetric: `${census.totalHeads} Heads`,
                                currentRemarks: census.reviewRemarks,
                              })
                            }
                            title={
                              census.status === "PENDING"
                                ? "Quick Action: Validate & Certify"
                                : "Quick Action: Re-evaluate Determination"
                            }
                            className={`h-8 w-8 hover:bg-white hover:shadow-md rounded-lg transition-all cursor-pointer ${
                              census.status === "PENDING"
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
              {records.length} {records.length === 1 ? "batch" : "batches"}
            </span>
          </div>
        )}

        {records.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-sm font-bold text-gray-800">No census batches match criteria</p>
            <p className="text-xs text-gray-400">All quarterly submissions are validated.</p>
          </div>
        ) : (
          records.map((census) => {
            const isSelected = selectedIds.includes(census.id);
            const statusNorm = (census.status || "PENDING").toUpperCase();
            const detailPayload = buildDetailPayload(census);

            return (
              <div
                key={census.id}
                className={`bg-white rounded-3xl p-4 shadow-sm border transition-all space-y-3 ${
                  isSelected
                    ? "border-[#2D5A27] bg-green-50/30 ring-1 ring-green-200/60 shadow-xs"
                    : "border-gray-100"
                }`}
              >
                {/* Header Row: Checkbox, Icon, Title, Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="-m-2 p-2 flex items-center justify-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(census.id);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(census.id)}
                        className="rounded-md border-gray-300 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27] shrink-0"
                      />
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{census.barangay}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Q{census.reportQuarter} • {census.reportYear}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`border text-[9px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 ${getStatusPill(census.status).bg}`}
                  >
                    <span className={`size-1.5 rounded-full mr-1.5 ${getStatusPill(census.status).dot}`} />
                    {getStatusPill(census.status).label}
                  </Badge>
                </div>

                {/* Info Pills */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-gray-50 rounded-xl flex items-center gap-2">
                    <User size={13} className="text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9px] font-black text-gray-400 uppercase block">Enumerator</span>
                      <span className="font-bold text-gray-700 truncate block">{census.submittedBy}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-green-50/70 rounded-xl flex items-center gap-2">
                    <Layers size={13} className="text-green-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9px] font-black text-green-700 uppercase block">Total Count</span>
                      <span className="font-black text-[#2D5A27] truncate block">
                        {census.totalHeads} Heads ({census.totalFarmers} r.)
                      </span>
                    </div>
                  </div>
                </div>

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
                    <span>Items ({census.items?.length || 0})</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      onReview({
                        id: census.id,
                        domain: "census",
                        title: `${census.barangay} Q${census.reportQuarter} ${census.reportYear}`,
                        farmerOrSubmitter: census.submittedBy,
                        barangay: census.barangay,
                        keyMetric: `${census.totalHeads} Heads`,
                        currentRemarks: census.reviewRemarks,
                      })
                    }
                    className={`flex-1 py-2.5 h-auto rounded-xl text-xs font-bold gap-1.5 shadow-xs ${
                      census.status === "PENDING"
                        ? "bg-[#2D5A27] hover:bg-[#23471f] text-white"
                        : "bg-gray-900 hover:bg-gray-800 text-white"
                    }`}
                  >
                    <ShieldCheck size={15} />
                    <span>{census.status === "PENDING" ? "Validate" : "Re-evaluate"}</span>
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
