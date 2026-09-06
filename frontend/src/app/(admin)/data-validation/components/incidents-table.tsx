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
  Activity,
  MapPin,
  Calendar,
  Eye,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  User,
} from "lucide-react";
import {
  ValidationIncidentItem,
  getIncidentTypeBadge,
} from "../validation-analytics";
import { ReviewTargetItem } from "../validation-review-dialog";
import { DetailRecordData } from "../record-detail-dialog";

interface IncidentsTableProps {
  records: ValidationIncidentItem[];
  selectedIds: (string | number)[];
  onToggleSelect: (id: string | number) => void;
  onSelectAll: (checked: boolean) => void;
  onViewDetail: (detail: DetailRecordData) => void;
  onReview: (target: ReviewTargetItem) => void;
}

export function IncidentsTable({
  records,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewDetail,
  onReview,
}: IncidentsTableProps) {
  const allSelected = records.length > 0 && records.every((inc) => selectedIds.includes(inc.id));

  const buildDetailPayload = (inc: ValidationIncidentItem): DetailRecordData => ({
    kind: "incident",
    id: inc.id,
    type: inc.type,
    farmerName: inc.farmerName,
    barangayName: inc.barangayName,
    details: inc.details,
    date: inc.date,
    status: inc.status,
    reviewRemarks: inc.reviewRemarks,
    headCount: inc.headCount,
    weight: inc.weight,
    tagNumber: inc.tagNumber,
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
                  Event / Declaration Type
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Farmer
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Barangay
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Summary Details
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Date
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
                      <p className="text-sm font-bold text-gray-800">No field declarations found</p>
                      <p className="text-xs text-gray-400 font-medium">All field event logs are cleared.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((inc) => {
                  const isSelected = selectedIds.includes(inc.id);
                  const typeBadge = getIncidentTypeBadge(inc.type);
                  const statusNorm = (inc.status || "PENDING").toUpperCase();
                  const detailPayload = buildDetailPayload(inc);

                  return (
                    <TableRow
                      key={inc.id}
                      className={`group hover:bg-gray-50/80 transition-all border-none ${
                        isSelected ? "bg-green-50/40" : ""
                      }`}
                    >
                      <TableCell className="px-6 py-5 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect(inc.id)}
                          className="rounded-md border-gray-300 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27]"
                        />
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              inc.type === "slaughter"
                                ? "bg-purple-100 text-purple-800"
                                : inc.type === "mortality"
                                ? "bg-red-100 text-red-700"
                                : inc.type === "birth"
                                ? "bg-green-100 text-[#2D5A27]"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {inc.type === "mortality" ? (
                              <AlertTriangle size={20} />
                            ) : (
                              <Activity size={20} />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm capitalize">{inc.type}</p>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                              {typeBadge.label}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <p className="font-bold text-gray-700 text-sm">{inc.farmerName}</p>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                          Farmer
                        </span>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-sm font-bold text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-gray-300" />
                          <span>{inc.barangayName}</span>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5 max-w-xs">
                        <p className="text-xs text-gray-600 font-medium line-clamp-2 leading-relaxed">
                          {inc.details}
                        </p>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-sm font-bold text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-300" />
                          <span>{inc.date}</span>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-center">
                        <Badge
                          variant="outline"
                          className={`border-none text-[9px] font-black uppercase px-3 py-1 rounded-full ${
                            statusNorm === "APPROVED"
                              ? "bg-green-100 text-green-700"
                              : statusNorm === "REJECTED" || statusNorm === "FLAGGED"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {statusNorm === "APPROVED" ? "Approved" : statusNorm === "REJECTED" ? "Rejected" : "Pending"}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewDetail(detailPayload)}
                            title="View Incident Details"
                            className="h-8 w-8 hover:bg-white hover:shadow-md rounded-lg text-gray-400 hover:text-blue-600 transition-all"
                          >
                            <Eye size={16} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onReview({
                                id: inc.id,
                                domain: "incidents",
                                title: `${typeBadge.label} — ${inc.farmerName}`,
                                farmerOrSubmitter: inc.farmerName,
                                barangay: inc.barangayName,
                                keyMetric: inc.type.toUpperCase(),
                                currentRemarks: inc.reviewRemarks,
                              })
                            }
                            title={inc.status === "PENDING" ? "Validate & Certify" : "Re-evaluate"}
                            className={`h-8 w-8 hover:bg-white hover:shadow-md rounded-lg transition-all ${
                              inc.status === "PENDING"
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
                          className="h-9 w-9 bg-gray-100 rounded-xl text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-all"
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
              {records.length} {records.length === 1 ? "declaration" : "declarations"}
            </span>
          </div>
        )}

        {records.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-sm font-bold text-gray-800">No field declarations found</p>
            <p className="text-xs text-gray-400">All field event logs are cleared.</p>
          </div>
        ) : (
          records.map((inc) => {
            const isSelected = selectedIds.includes(inc.id);
            const typeBadge = getIncidentTypeBadge(inc.type);
            const statusNorm = (inc.status || "PENDING").toUpperCase();
            const detailPayload = buildDetailPayload(inc);

            return (
              <div
                key={inc.id}
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
                        onToggleSelect(inc.id);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(inc.id)}
                        className="rounded-md border-gray-300 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27] shrink-0"
                      />
                    </div>
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        inc.type === "slaughter"
                          ? "bg-purple-100 text-purple-800"
                          : inc.type === "mortality"
                          ? "bg-red-100 text-red-700"
                          : inc.type === "birth"
                          ? "bg-green-100 text-[#2D5A27]"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {inc.type === "mortality" ? (
                        <AlertTriangle size={20} />
                      ) : (
                        <Activity size={20} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{inc.farmerName}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">
                        {typeBadge.label} • {inc.barangayName}
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`border-none text-[9px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 ${
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

                {/* Details snippet */}
                <div className="p-3 bg-gray-50 rounded-2xl text-xs text-gray-700 font-medium leading-relaxed">
                  {inc.details}
                </div>

                {/* Info Date */}
                <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Calendar size={13} className="text-gray-400" /> {inc.date}
                  </span>
                  {inc.headCount ? (
                    <span className="font-black text-[#2D5A27] text-[11px]">
                      {inc.headCount} Head(s)
                    </span>
                  ) : null}
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
                    <span>Details</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      onReview({
                        id: inc.id,
                        domain: "incidents",
                        title: `${typeBadge.label} — ${inc.farmerName}`,
                        farmerOrSubmitter: inc.farmerName,
                        barangay: inc.barangayName,
                        keyMetric: inc.type.toUpperCase(),
                        currentRemarks: inc.reviewRemarks,
                      })
                    }
                    className={`flex-1 py-2.5 h-auto rounded-xl text-xs font-bold gap-1.5 shadow-xs ${
                      inc.status === "PENDING"
                        ? "bg-[#2D5A27] hover:bg-[#23471f] text-white"
                        : "bg-gray-900 hover:bg-gray-800 text-white"
                    }`}
                  >
                    <ShieldCheck size={15} />
                    <span>{inc.status === "PENDING" ? "Validate" : "Re-evaluate"}</span>
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
