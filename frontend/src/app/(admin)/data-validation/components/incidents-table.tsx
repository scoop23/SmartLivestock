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
  Stethoscope,
  Skull,
  Beef,
  Scale,
  Sparkles,
} from "lucide-react";
import {
  ValidationIncidentItem,
  getIncidentTypeBadge,
  getStatusPill,
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
  onReviewHealth?: (record: ValidationIncidentItem) => void;
}

export function IncidentsTable({
  records,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewDetail,
  onReview,
  onReviewHealth,
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
    reviewedByName: inc.reviewedBy,
    reviewedAt: inc.reviewedAt,
    headCount: inc.headCount,
    weight: inc.weight,
    tagNumber: inc.tagNumber,
  });

  const getIncidentIcon = (type: string) => {
    switch (type) {
      case "disease":
        return {
          icon: <Stethoscope size={20} />,
          bg: "bg-amber-100 text-amber-800",
        };
      case "mortality":
        return {
          icon: <Skull size={20} />,
          bg: "bg-rose-100 text-rose-700",
        };
      case "slaughter":
        return {
          icon: <Beef size={20} />,
          bg: "bg-purple-100 text-purple-800",
        };
      case "birth":
        return {
          icon: <Activity size={20} />,
          bg: "bg-green-100 text-[#2D5A27]",
        };
      case "sale":
      default:
        return {
          icon: <Scale size={20} />,
          bg: "bg-blue-100 text-blue-700",
        };
    }
  };

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
                  Farmer / Raiser
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Barangay
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Summary & Symptoms
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
                  const statusPill = getStatusPill(inc.status);
                  const detailPayload = buildDetailPayload(inc);
                  const iconStyle = getIncidentIcon(inc.type);
                  const isHealthOrMortality = inc.type === "disease" || inc.type === "mortality";

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
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconStyle.bg}`}
                          >
                            {iconStyle.icon}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm capitalize">{inc.type}</p>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                              {typeBadge.label}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <p className="font-bold text-gray-800 text-sm">{inc.farmerName}</p>
                        <span className="text-[9px] font-bold text-gray-400">
                          {inc.tagNumber ? `Tag: ${inc.tagNumber}` : "Registered Raiser"}
                        </span>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-sm font-bold text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-gray-300" />
                          <span>{inc.barangayName}</span>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5 max-w-xs">
                        <p className="text-xs text-gray-700 font-medium line-clamp-2 leading-relaxed">
                          {inc.conditionName ? `${inc.conditionName}: ` : ""}
                          {inc.details}
                        </p>
                        {inc.symptoms && inc.symptoms.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            {inc.symptoms.slice(0, 2).map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-600"
                              >
                                {s}
                              </span>
                            ))}
                            {inc.symptoms.length > 2 && (
                              <span className="text-[9px] text-gray-400 font-bold">
                                +{inc.symptoms.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="px-8 py-5 text-sm font-bold text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-gray-300" />
                          <span>{inc.date}</span>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-center">
                        <Badge
                          variant="outline"
                          className={`border text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${statusPill.bg}`}
                        >
                          <span className={`size-1.5 rounded-full mr-1.5 ${statusPill.dot}`} />
                          {statusPill.label}
                        </Badge>
                        {(inc.status === "VERIFIED" || statusPill.label.includes("Verified")) && inc.reviewedBy && (
                          <span className="block text-[8px] text-sky-700 font-bold tracking-tight mt-0.5">
                            By {inc.reviewedBy}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="px-8 py-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isHealthOrMortality ? (
                            <Button
                              size="sm"
                              onClick={() => onReviewHealth ? onReviewHealth(inc) : onViewDetail(detailPayload)}
                              className="h-8 px-3 rounded-xl bg-[#2D5A27] hover:bg-[#23471f] text-white text-[11px] font-black uppercase tracking-wider gap-1.5 shadow-xs cursor-pointer"
                            >
                              <ShieldCheck size={14} />
                              <span>Review SIBAT</span>
                            </Button>
                          ) : (
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
                              title="Validate Record"
                              className="h-8 w-8 hover:bg-white hover:shadow-md rounded-lg text-gray-400 hover:text-green-700 transition-all cursor-pointer"
                            >
                              <ShieldCheck size={16} />
                            </Button>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => isHealthOrMortality && onReviewHealth ? onReviewHealth(inc) : onViewDetail(detailPayload)}
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
            const statusPill = getStatusPill(inc.status);
            const detailPayload = buildDetailPayload(inc);
            const iconStyle = getIncidentIcon(inc.type);
            const isHealthOrMortality = inc.type === "disease" || inc.type === "mortality";

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
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconStyle.bg}`}
                    >
                      {iconStyle.icon}
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
                    className={`border text-[9px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 ${statusPill.bg}`}
                  >
                    <span className={`size-1.5 rounded-full mr-1.5 ${statusPill.dot}`} />
                    {statusPill.label}
                  </Badge>
                </div>

                {(inc.status === "VERIFIED" || statusPill.label.includes("Verified")) && inc.reviewedBy && (
                  <div className="text-[10px] text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100 flex items-center justify-between">
                    <span className="font-bold">Verified by SIBAT Officer</span>
                    <span className="font-mono font-bold">{inc.reviewedBy}</span>
                  </div>
                )}

                {/* Details snippet */}
                <div className="p-3 bg-gray-50 rounded-2xl text-xs text-gray-700 font-medium leading-relaxed">
                  {inc.conditionName ? `${inc.conditionName}: ` : ""}
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
                  {isHealthOrMortality ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onReviewHealth ? onReviewHealth(inc) : onViewDetail(detailPayload)}
                      className="w-full py-3 h-auto rounded-xl bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-black uppercase tracking-wider gap-2 shadow-xs cursor-pointer"
                    >
                      <ShieldCheck size={16} />
                      <span>Review SIBAT Health Report</span>
                    </Button>
                  ) : (
                    <>
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
                        className="flex-1 py-2.5 h-auto rounded-xl bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-bold gap-1.5 shadow-xs"
                      >
                        <ShieldCheck size={15} />
                        <span>Validate</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
