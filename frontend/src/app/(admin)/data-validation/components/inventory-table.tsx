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
  Tag,
  MapPin,
  Calendar,
  Eye,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  Scale,
} from "lucide-react";
import { ValidationInventoryItem } from "../validation-analytics";
import { ReviewTargetItem } from "../validation-review-dialog";
import { DetailRecordData } from "../record-detail-dialog";

interface InventoryTableProps {
  records: ValidationInventoryItem[];
  selectedIds: (string | number)[];
  onToggleSelect: (id: string | number) => void;
  onSelectAll: (checked: boolean) => void;
  onViewDetail: (detail: DetailRecordData) => void;
  onReview: (target: ReviewTargetItem) => void;
}

export function InventoryTable({
  records,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewDetail,
  onReview,
}: InventoryTableProps) {
  const allSelected = records.length > 0 && records.every((i) => selectedIds.includes(i.id));

  const buildDetailPayload = (inv: ValidationInventoryItem): DetailRecordData => ({
    kind: "inventory",
    id: inv.id,
    farmerName: inv.farmerName,
    barangayName: inv.barangayName,
    livestockType: inv.livestockType,
    tagNumber: inv.tagNumber,
    breed: inv.breed,
    sex: inv.sex,
    weight: inv.weight,
    entryType: inv.entryType,
    quantity: inv.quantity,
    lastVaccinationDate: inv.lastVaccinationDate,
    status: inv.status,
    reviewRemarks: inv.reviewRemarks,
    createdAt: inv.createdAt,
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
                  Animal Tag / ID
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Owner / Farmer
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Barangay
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Species / Sex
                </TableHead>
                <TableHead className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                  Weight / Count
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
                      <p className="text-sm font-bold text-gray-800">No inventory entries pending review</p>
                      <p className="text-xs text-gray-400 font-medium">All livestock animal tags are verified.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((inv) => {
                  const isSelected = selectedIds.includes(inv.id);
                  const statusNorm = (inv.status || "PENDING").toUpperCase();
                  const detailPayload = buildDetailPayload(inv);

                  return (
                    <TableRow
                      key={inv.id}
                      className={`group hover:bg-gray-50/80 transition-all border-none ${
                        isSelected ? "bg-green-50/40" : ""
                      }`}
                    >
                      <TableCell className="px-6 py-5 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect(inv.id)}
                          className="rounded-md border-gray-300 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27]"
                        />
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 text-amber-800 shrink-0">
                            <Tag size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm font-mono leading-snug">
                              {inv.tagNumber || `TAG-${inv.id}`}
                            </p>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                              {inv.breed || "Standard Breed"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <p className="font-bold text-gray-700 text-sm">{inv.farmerName}</p>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                          Livestock Raiser
                        </span>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-sm font-bold text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-gray-300" />
                          <span>{inv.barangayName}</span>
                        </div>
                      </TableCell>

                      <TableCell className="px-8 py-5">
                        <Badge
                          variant="outline"
                          className="border-none text-[9px] font-black uppercase px-3 py-1 rounded-full bg-gray-100 text-gray-700"
                        >
                          {inv.livestockType} ({inv.sex})
                        </Badge>
                      </TableCell>

                      <TableCell className="px-8 py-5 text-right">
                        <p className="font-black text-[#2D5A27] text-sm">
                          {inv.quantity} Head{inv.quantity > 1 ? "s" : ""}
                        </p>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                          {inv.weight ? `${inv.weight} kg` : "No weight recorded"}
                        </span>
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
                            title="View Animal Details"
                            className="h-8 w-8 hover:bg-white hover:shadow-md rounded-lg text-gray-400 hover:text-blue-600 transition-all"
                          >
                            <Eye size={16} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              onReview({
                                id: inv.id,
                                domain: "inventory",
                                title: `${inv.tagNumber || inv.breed} (${inv.livestockType})`,
                                farmerOrSubmitter: inv.farmerName,
                                barangay: inv.barangayName,
                                keyMetric: `${inv.quantity} head(s)`,
                                currentRemarks: inv.reviewRemarks,
                              })
                            }
                            title={inv.status === "PENDING" ? "Validate & Certify" : "Re-evaluate"}
                            className={`h-8 w-8 hover:bg-white hover:shadow-md rounded-lg transition-all ${
                              inv.status === "PENDING"
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
              {records.length} {records.length === 1 ? "entry" : "entries"}
            </span>
          </div>
        )}

        {records.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-sm font-bold text-gray-800">No inventory entries pending review</p>
            <p className="text-xs text-gray-400">All registered livestock tags are verified.</p>
          </div>
        ) : (
          records.map((inv) => {
            const isSelected = selectedIds.includes(inv.id);
            const statusNorm = (inv.status || "PENDING").toUpperCase();
            const detailPayload = buildDetailPayload(inv);

            return (
              <div
                key={inv.id}
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
                        onToggleSelect(inv.id);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(inv.id)}
                        className="rounded-md border-gray-300 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27] shrink-0"
                      />
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Tag size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 text-sm font-mono truncate">
                        {inv.tagNumber || `TAG-${inv.id}`}
                      </p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">
                        {inv.breed || "Breed Unspecified"}
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

                {/* Info Pills */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-gray-50 rounded-xl flex items-center gap-2">
                    <MapPin size={13} className="text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9px] font-black text-gray-400 uppercase block">Raiser</span>
                      <span className="font-bold text-gray-700 truncate block">
                        {inv.farmerName} • {inv.barangayName}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-green-50/70 rounded-xl flex items-center gap-2">
                    <Scale size={13} className="text-green-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[9px] font-black text-green-700 uppercase block">Species & Count</span>
                      <span className="font-black text-[#2D5A27] truncate block">
                        {inv.livestockType} ({inv.quantity}h {inv.weight ? `${inv.weight}kg` : ""})
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
                    <span>Details</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      onReview({
                        id: inv.id,
                        domain: "inventory",
                        title: `${inv.tagNumber || inv.breed} (${inv.livestockType})`,
                        farmerOrSubmitter: inv.farmerName,
                        barangay: inv.barangayName,
                        keyMetric: `${inv.quantity} head(s)`,
                        currentRemarks: inv.reviewRemarks,
                      })
                    }
                    className={`flex-1 py-2.5 h-auto rounded-xl text-xs font-bold gap-1.5 shadow-xs ${
                      inv.status === "PENDING"
                        ? "bg-[#2D5A27] hover:bg-[#23471f] text-white"
                        : "bg-gray-900 hover:bg-gray-800 text-white"
                    }`}
                  >
                    <ShieldCheck size={15} />
                    <span>{inv.status === "PENDING" ? "Validate" : "Re-evaluate"}</span>
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
