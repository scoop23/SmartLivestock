"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getIncidentTypeBadge } from "./validation-analytics";
import { CensusItemEntry } from "@/app/(sibat)/sibat/sibat-analytics";
import {
  FileSpreadsheet,
  Milk,
  Tag,
  Activity,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertTriangle,
  User,
  MapPin,
  Calendar,
  Layers,
  Copy,
  Printer,
  Sparkles,
  Search,
  Check,
  Building2,
  FileCheck,
  Pencil,
  Save,
} from "lucide-react";
import { toast } from "sonner";

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
      reviewedByName?: string | null;
      reviewedAt?: string | null;
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
      reviewedByName?: string | null;
      reviewedAt?: string | null;
      createdAt: string;
    }
  | {
      kind: "inventory";
      id: string | number;
      rawId?: number;
      isBatch?: boolean;
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
      reviewedByName?: string | null;
      reviewedAt?: string | null;
      createdAt: string;
      batchCode?: string;
      batchName?: string;
      housingPen?: string;
      feedType?: string;
      targetWeight?: number;
      animals?: any[];
    }
  | {
      kind: "incident";

      id: string | number;
      type: "disease" | "slaughter" | "mortality" | "birth" | "sale";
      farmerName: string;
      barangayName: string;
      details: string;
      date: string;
      status: string;
      reviewRemarks?: string | null;
      reviewedByName?: string | null;
      reviewedAt?: string | null;
      headCount?: number;
      weight?: string;
      tagNumber?: string;
    };

interface RecordDetailDialogProps {
  record: DetailRecordData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenReview?: (record: DetailRecordData) => void;
  onConfirmAction?: (
    action: "APPROVED" | "SUBJECT_TO_REVISION",
    remarks: string,
    itemIds: (string | number)[]
  ) => void;
}

const PRESET_APPROVAL_NOTES = [
  "SIBAT field inspection confirmed & officially certified by MAO.",
  "Verified against SIBAT technologist assessment and barangay ledger.",
  "Data cross-checked with cooperative collection logs.",
  "Livestock health credentials and counts verified.",
];

const PRESET_REVISION_NOTES = [
  "Discrepancy with SIBAT field inspection findings; returned for revision.",
  "Missing required field inspection or vaccination certification.",
  "Volume exceeds biological baseline; returned for verification & correction.",
  "Incorrect ear tag or farmer profile association; please rectify.",
];

export function RecordDetailDialog({
  record,
  open,
  onOpenChange,
  onOpenReview,
  onConfirmAction,
}: RecordDetailDialogProps) {
  const queryClient = useQueryClient();
  const [censusSearch, setCensusSearch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state for inventory / batch
  const [isEditing, setIsEditing] = useState(false);
  const [editTagNumber, setEditTagNumber] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editSex, setEditSex] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editHousingPen, setEditHousingPen] = useState("");
  const [editFeedType, setEditFeedType] = useState("");
  const [editTargetWeight, setEditTargetWeight] = useState("");
  const [isSavingEdits, setIsSavingEdits] = useState(false);

  useEffect(() => {
    if (record && record.kind === "inventory") {
      setEditTagNumber(record.tagNumber || "");
      setEditBreed(record.breed || "");
      setEditSex(record.sex || "Female");
      setEditWeight(record.weight !== null && record.weight !== undefined ? String(record.weight) : "");
      setEditHousingPen(record.housingPen || "");
      setEditFeedType(record.feedType || "");
      setEditTargetWeight(record.targetWeight ? String(record.targetWeight) : "");
      setIsEditing(false);
    }
  }, [record]);

  if (!record) return null;

  const statusNorm = (record.status || "PENDING").toUpperCase();
  const isPending = statusNorm === "PENDING";
  const isVerified = statusNorm === "VERIFIED";
  const isApproved = statusNorm === "APPROVED";
  const isRejected = statusNorm === "SUBJECT_TO_REVISION" || statusNorm === "REJECTED" || statusNorm === "FLAGGED";

  const handleSaveEdits = async () => {
    if (!record || record.kind !== "inventory") return;
    setIsSavingEdits(true);
    try {
      const isBatch = record.isBatch || String(record.id).startsWith("batch-");
      const cleanId = String(record.id).replace("batch-", "");
      const payload: Record<string, any> = {};
      if (isBatch) {
        if (editHousingPen !== undefined) payload.housing_pen = editHousingPen;
        if (editFeedType !== undefined) payload.feed_type = editFeedType;
        if (editTargetWeight) payload.target_weight = parseFloat(editTargetWeight);
      } else {
        if (editTagNumber) payload.tag_number = editTagNumber;
        if (editBreed) payload.breed = editBreed;
        if (editSex) payload.sex = editSex;
        if (editWeight) payload.weight = parseFloat(editWeight);
      }
      const endpoint = isBatch ? `livestock/batches/${cleanId}/` : `livestock/inventory/${cleanId}/`;
      await api.patch(endpoint, payload);
      toast.success("Record details updated successfully!");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["admin-inventory-records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
    } catch (err: any) {
      toast.error("Failed to update record", {
        description: err?.response?.data?.error || "Please check your inputs.",
      });
    } finally {
      setIsSavingEdits(false);
    }
  };

  const handleCopyId = () => {
    const idStr = String(record.id);
    navigator.clipboard.writeText(idStr);
    toast.success(`Record ID ${idStr} copied to clipboard`);
  };


  const handlePrint = () => {
    window.print();
  };

  const handleAction = async (action: "APPROVED" | "SUBJECT_TO_REVISION") => {
    if (onConfirmAction) {
      setIsSubmitting(true);
      try {
        await onConfirmAction(action, remarks.trim(), [record.id]);
        onOpenChange(false);
      } finally {
        setIsSubmitting(false);
      }
    } else if (onOpenReview) {
      onOpenChange(false);
      onOpenReview(record);
    }
  };

  // Filtered census items if domain is census
  const censusItems = record.kind === "census" ? record.items || [] : [];
  const filteredCensusItems = censusItems.filter((item) => {
    if (!censusSearch.trim()) return true;
    const q = censusSearch.toLowerCase();
    return (
      item.farmerName.toLowerCase().includes(q) ||
      (item.purok && item.purok.toLowerCase().includes(q)) ||
      item.livestockType.toLowerCase().includes(q)
    );
  });

  const getDomainMeta = () => {
    switch (record.kind) {
      case "census":
        return {
          domainLabel: "CENSUS MASTER ROSTER",
          icon: <FileSpreadsheet className="size-4 text-emerald-300" />,
          title: `Brgy. ${record.barangay} Census`,
          subtitle: `Quarter ${record.reportQuarter} • ${record.reportYear} Municipal Livestock Enumeration`,
        };
      case "production":
        return {
          domainLabel: "PRODUCTION YIELD ENTRY",
          icon: <Milk className="size-4 text-emerald-300" />,
          title: `${record.farmerName}`,
          subtitle: `${record.productionType.toUpperCase()} Production • Brgy. ${record.barangayName}`,
        };
      case "inventory":
        return {
          domainLabel: "LIVESTOCK HERD REGISTRY",
          icon: <Tag className="size-4 text-emerald-300" />,
          title: record.tagNumber ? `Tag #${record.tagNumber}` : `${record.breed} (${record.livestockType})`,
          subtitle: `${record.farmerName} • Brgy. ${record.barangayName}`,
        };
      case "incident":
        return {
          domainLabel: "CLINICAL & HEALTH RECORD",
          icon: <Activity className="size-4 text-emerald-300" />,
          title: `${getIncidentTypeBadge(record.type).label} — ${record.farmerName}`,
          subtitle: `Reported Condition • Brgy. ${record.barangayName}`,
        };
    }
  };

  const domainMeta = getDomainMeta();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[96vw] sm:max-w-3xl md:max-w-4xl p-0 rounded-3xl overflow-hidden bg-white border border-slate-200/80 shadow-2xl [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:opacity-100 [&>button]:right-5 [&>button]:top-5 [&>button]:p-2.5 [&>button]:rounded-full [&>button]:hover:bg-white/10 max-h-[92vh] flex flex-col">
        
        {/* ═══════════ MAO OFFICIAL BANNER HEADER ═══════════ */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#0C3318] to-emerald-900 text-white p-5 sm:p-6.5 shrink-0 relative">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <Badge className="bg-white/15 text-emerald-200 border-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 flex items-center gap-1.5 backdrop-blur-xs">
                {domainMeta.icon}
                <span>{domainMeta.domainLabel}</span>
              </Badge>
              <button
                type="button"
                onClick={handleCopyId}
                className="text-[11px] font-mono font-bold text-emerald-300/80 hover:text-emerald-200 flex items-center gap-1 bg-black/20 hover:bg-black/30 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                title="Click to copy ID"
              >
                <span>ID: {record.id}</span>
                <Copy className="size-2.5" />
              </button>
            </div>

            {/* Status Pill */}
            <Badge
              className={`font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-full shadow-2xs border ${
                isApproved
                  ? "bg-emerald-500 text-white border-emerald-400"
                  : isVerified
                  ? "bg-sky-500 text-white border-sky-400"
                  : isRejected
                  ? "bg-amber-500 text-white border-amber-400"
                  : "bg-amber-400/20 text-amber-200 border-amber-300/40"
              }`}
            >
              {isApproved && <CheckCircle2 className="size-3 mr-1" />}
              {isVerified && <ShieldCheck className="size-3 mr-1" />}
              {isRejected && <RotateCcw className="size-3 mr-1" />}
              {isPending && <Clock className="size-3 mr-1" />}
              <span>
                {isApproved
                  ? "MAO Approved & Certified"
                  : isVerified
                  ? "SIBAT Field-Verified"
                  : isRejected
                  ? "Subject to Revision"
                  : "Pending MAO Review"}
              </span>
            </Badge>
          </div>

          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{domainMeta.title}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-emerald-100/80 font-medium">
              {domainMeta.subtitle}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3.5 pt-3 border-t border-emerald-800/60 flex items-center justify-between text-[11px] text-emerald-200/70">
            <span>Padre Garcia Municipal Agriculture Office &bull; Regulatory Ledger</span>
            <span className="font-mono text-[10px] text-emerald-300/70">OFFICIAL ARCHIVE</span>
          </div>
        </div>

        {/* ═══════════ SCROLLABLE INSPECTION BODY ═══════════ */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 bg-slate-50/50">

          {/* ── LIFECYCLE PROGRESSION STEPPER ── */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">
              Validation Lifecycle & Audit Trail
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Step 1 */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="size-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Check className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-slate-900 leading-tight">1. Initial Submission</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {record.kind === "census" ? record.submittedBy : (record as any).farmerName || "Farmer Raiser"}
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${
                  isVerified || isApproved
                    ? "bg-sky-50/80 border-sky-200 text-sky-950"
                    : isRejected
                    ? "bg-amber-50/60 border-amber-200 text-amber-950"
                    : "bg-slate-50 border-slate-100 text-slate-400"
                }`}
              >
                <div
                  className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isVerified || isApproved
                      ? "bg-sky-600 text-white"
                      : isRejected
                      ? "bg-amber-500 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isVerified || isApproved ? <ShieldCheck className="size-4" /> : <Clock className="size-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black leading-tight">2. SIBAT Field Audit</p>
                  <p className="text-[10px] truncate">
                    {record.reviewedByName ? `By ${record.reviewedByName}` : isVerified ? "Field Verified" : "Barangay Inspection Queue"}
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${
                  isApproved
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                    : isRejected
                    ? "bg-amber-50/60 border-amber-200 text-amber-950"
                    : "bg-slate-50 border-slate-100 text-slate-400"
                }`}
              >
                <div
                  className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isApproved
                      ? "bg-[#2D5A27] text-white"
                      : isRejected
                      ? "bg-amber-500 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isApproved ? <CheckCircle2 className="size-4" /> : isRejected ? <RotateCcw className="size-4" /> : <Clock className="size-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black leading-tight">3. MAO Certification</p>
                  <p className="text-[10px] truncate">
                    {isApproved ? "Certified Ledger Entry" : isRejected ? "Subject to Revision" : "Awaiting Final Certification"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── ENTITY PROFILE & METRIC CARDS ── */}
          {/* CENSUS SPECIFICS */}
          {record.kind === "census" && (
            <div className="space-y-4">
              {/* 3-KPI Highlight Ribbon */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Total Enumerated Heads
                  </span>
                  <p className="text-2xl font-black text-emerald-900 mt-1 font-mono">
                    {record.totalHeads.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Across verified barangay puroks</p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Participating Raisers
                  </span>
                  <p className="text-2xl font-black text-slate-900 mt-1 font-mono">
                    {record.totalFarmers.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Registered farmer profiles</p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Reporting Quarter
                  </span>
                  <p className="text-2xl font-black text-blue-900 mt-1">
                    Q{record.reportQuarter} {record.reportYear}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Logged: {record.submissionDate}</p>
                </div>
              </div>

              {/* Census Enumerator Remarks */}
              {record.remarks && (
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Field Enumerator Notes & Observations
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed italic">
                    "{record.remarks}"
                  </p>
                </div>
              )}

              {/* Census Items Roster with Search */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Layers className="size-3.5 text-emerald-700" />
                      <span>Raiser Head Count Roster ({filteredCensusItems.length} records)</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">Individual livestock breakdowns surveyed per purok</p>
                  </div>

                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                    <Input
                      placeholder="Filter by raiser or purok..."
                      value={censusSearch}
                      onChange={(e) => setCensusSearch(e.target.value)}
                      className="pl-8.5 h-8 text-xs bg-slate-50 border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Farmer / Raiser Name</TableHead>
                        <TableHead>Purok / Sector</TableHead>
                        <TableHead>Species Type</TableHead>
                        <TableHead className="text-right">Surveyed Heads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100">
                      {filteredCensusItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                            No farmer entries match your filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCensusItems.map((item, idx) => (
                          <TableRow key={item.id || idx} className="hover:bg-slate-50/60">
                            <TableCell className="text-center font-bold text-slate-400 text-[11px]">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-bold text-slate-900">
                              {item.farmerName}
                            </TableCell>
                            <TableCell className="text-slate-500 font-medium">
                              {item.purok || "General Sector"}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-slate-100 text-slate-800 border-0 text-[10px] font-bold">
                                {item.livestockType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-black text-emerald-800 font-mono text-xs">
                              {item.numberOfHeads} heads
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* PRODUCTION SPECIFICS */}
          {record.kind === "production" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Certified Production Yield
                  </span>
                  <p className="text-2xl font-black text-emerald-900 mt-1 font-mono">
                    {record.quantity} <span className="text-sm font-bold text-slate-600">{record.unit}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{record.productionType.toUpperCase()}</p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Registered Producer
                  </span>
                  <p className="text-base font-black text-slate-900 mt-1 truncate">
                    {record.farmerName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Brgy. {record.barangayName}</p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Production Date
                  </span>
                  <p className="text-base font-black text-slate-900 mt-1">
                    {record.recordDate}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Animal: {record.livestockTypeName}</p>
                </div>
              </div>

              {record.notes && (
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Producer Declaration & Notes
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed italic">
                    "{record.notes}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* INVENTORY SPECIFICS */}
          {record.kind === "inventory" && (
            <div className="space-y-4">
              {/* Header Ribbon with Edit Action */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {record.isBatch ? "Cohort Batch Information" : "Animal Registry Specifications"}
                  </span>
                  {record.isBatch ? (
                    <Badge className="bg-teal-100 text-teal-900 border-0 text-[10px] font-bold">
                      Cohort Batch ({record.quantity} heads)
                    </Badge>
                  ) : record.batchCode ? (
                    <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-bold">
                      Cohort: {record.batchCode}
                    </Badge>
                  ) : null}
                </div>

                {(isPending || isVerified) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(!isEditing)}
                    className="h-6 px-2 text-[11px] font-bold text-slate-700 hover:text-slate-900 rounded-lg gap-1 cursor-pointer"
                  >
                    <Pencil className="size-3 text-emerald-600" />
                    <span>{isEditing ? "Cancel Edit" : "Edit Record"}</span>
                  </Button>
                )}
              </div>

              {/* Editing Form */}
              {isEditing ? (
                <div className="bg-white p-4 rounded-2xl border-2 border-emerald-300 shadow-sm space-y-3">
                  <p className="text-xs font-black uppercase text-emerald-800 tracking-wider">
                    {record.isBatch ? "Modify Cohort Parameters" : "Correct Animal Identification & Biometrics"}
                  </p>

                  {record.isBatch ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs font-bold text-slate-600">Housing Pen</Label>
                        <Input
                          value={editHousingPen}
                          onChange={(e) => setEditHousingPen(e.target.value)}
                          placeholder="e.g. Pen 3 Fattening"
                          className="h-8 text-xs rounded-xl mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-600">Feed Formulation</Label>
                        <Input
                          value={editFeedType}
                          onChange={(e) => setEditFeedType(e.target.value)}
                          placeholder="e.g. Finisher Pellets"
                          className="h-8 text-xs rounded-xl mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-600">Target Weight (kg)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={editTargetWeight}
                          onChange={(e) => setEditTargetWeight(e.target.value)}
                          placeholder="90"
                          className="h-8 text-xs rounded-xl mt-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs font-bold text-slate-600">Ear Tag #</Label>
                        <Input
                          value={editTagNumber}
                          onChange={(e) => setEditTagNumber(e.target.value)}
                          placeholder="TAG-01-01"
                          className="h-8 text-xs rounded-xl mt-1 font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-600">Breed</Label>
                        <Input
                          value={editBreed}
                          onChange={(e) => setEditBreed(e.target.value)}
                          placeholder="Large White"
                          className="h-8 text-xs rounded-xl mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-600">Sex</Label>
                        <select
                          value={editSex}
                          onChange={(e) => setEditSex(e.target.value)}
                          className="h-8 w-full text-xs rounded-xl border border-slate-200 bg-white px-2.5 mt-1 font-medium"
                        >
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                          <option value="Castrated">Castrated</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-slate-600">Weight (kg)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                          placeholder="68.5"
                          className="h-8 text-xs rounded-xl mt-1"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="text-xs rounded-xl h-8"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveEdits}
                      disabled={isSavingEdits}
                      className="text-xs rounded-xl h-8 bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1"
                    >
                      <Save className="size-3.5" />
                      {isSavingEdits ? "Saving..." : "Save Updates"}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Read-Only Cards */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        Species & Breed
                      </span>
                      <p className="text-xs font-black text-slate-900 mt-1 truncate">{record.breed}</p>
                      <p className="text-[10px] text-slate-500">{record.livestockType}</p>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        Sex & Head Count
                      </span>
                      <p className="text-xs font-black text-slate-900 mt-1">
                        {record.sex} • {record.quantity} Head{record.quantity > 1 ? "s" : ""}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Live Weight: {record.weight ? `${record.weight} kg${record.isBatch ? " (Avg)" : ""}` : "N/A"}
                      </p>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        {record.isBatch ? "Cohort Code" : "Ear Tag / RFID"}
                      </span>
                      <p className="text-xs font-mono font-black text-emerald-800 mt-1">
                        {record.tagNumber || "No Tag Code"}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {record.isBatch ? "Pen Cohort" : `Entry: ${record.entryType}`}
                      </p>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        {record.isBatch ? "Housing Pen" : "Last Vaccination"}
                      </span>
                      <p className="text-xs font-black text-slate-900 mt-1">
                        {record.isBatch
                          ? record.housingPen || "Standard Pen"
                          : record.lastVaccinationDate || "Not Recorded"}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {record.isBatch
                          ? `Feed: ${record.feedType || "Rations"}`
                          : "Official Vet Record"}
                      </p>
                    </div>
                  </div>

                  {/* If batch, show linked animal tags */}
                  {record.isBatch && record.animals && record.animals.length > 0 && (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        Linked Individual Animals in this Cohort ({record.animals.length} heads):
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                        {record.animals.map((a: any) => (
                          <Badge
                            key={a.id}
                            variant="secondary"
                            className="bg-white border border-slate-200 text-[10px] font-mono font-bold"
                          >
                            {a.tag_number || `#${a.id}`} • {a.weight ? `${a.weight}kg` : a.sex}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}


              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Registered Livestock Owner
                  </span>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{record.farmerName}</p>
                  <p className="text-xs text-slate-500">Barangay {record.barangayName}, Padre Garcia, Batangas</p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-900 border-0 text-[10px] font-bold">
                  Active Farm Profile
                </Badge>
              </div>
            </div>
          )}

          {/* INCIDENT SPECIFICS */}
          {record.kind === "incident" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Incident Classification
                  </span>
                  <p className="text-base font-black text-slate-900 mt-1">
                    {getIncidentTypeBadge(record.type).label}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Date: {record.date}</p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Affected Heads
                  </span>
                  <p className="text-2xl font-black text-rose-800 mt-1 font-mono">
                    {record.headCount || 1}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Reported livestock</p>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Farmer & Location
                  </span>
                  <p className="text-base font-black text-slate-900 mt-1 truncate">
                    {record.farmerName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Brgy. {record.barangayName}</p>
                </div>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Detailed Case Description / Symptoms
                </span>
                <p className="text-xs text-slate-800 leading-relaxed">
                  {record.details}
                </p>
              </div>
            </div>
          )}

          {/* ── SIBAT FIELD AUDIT REPORT ── */}
          {(record.reviewedByName || isVerified) && (
            <div className="p-4 bg-sky-50/80 border border-sky-200/80 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-sky-900 uppercase flex items-center gap-1.5 tracking-wider">
                  <ShieldCheck className="size-4 text-sky-700" />
                  SIBAT Field Verification Findings
                </span>
                {record.reviewedAt && (
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-md">
                    Inspected: {new Date(record.reviewedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>

              {record.reviewedByName && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-sky-100">
                  <span className="text-sky-800 font-medium">Inspecting SIBAT Officer:</span>
                  <span className="font-black text-sky-950">{record.reviewedByName}</span>
                </div>
              )}

              {record.reviewRemarks && (
                <div className="text-xs text-sky-950 bg-white/90 p-3 rounded-xl border border-sky-100/80">
                  <span className="text-[9px] font-black text-sky-800 uppercase block mb-1">
                    Officer Observation Notes
                  </span>
                  <p className="italic leading-relaxed">"{record.reviewRemarks}"</p>
                </div>
              )}
            </div>
          )}

          {/* ── MAO MUNICIPAL DECISION CONSOLE (INLINE ACTION) ── */}
          {(isPending || isVerified) ? (
            <div className="p-4 sm:p-5 bg-white rounded-2xl border-2 border-emerald-800/20 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-emerald-100 text-[#2D5A27] flex items-center justify-center font-bold">
                    <FileCheck className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      MAO Municipal Certification Action
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Issue the official municipal seal or return the record for revision
                    </p>
                  </div>
                </div>

                <Badge className="bg-emerald-50 text-emerald-900 border-emerald-200 text-[9px] font-black">
                  ACTIVE ACTION CONSOLE
                </Badge>
              </div>

              {/* Review Remarks Textarea */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Official MAO Review Remarks / Directives
                </label>
                <Textarea
                  placeholder="Enter official audit certification remarks or required corrections..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="text-xs bg-slate-50 border-slate-200 rounded-xl min-h-[75px] focus-visible:ring-emerald-500/20"
                />
              </div>

              {/* Quick Preset Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-500" />
                  Quick Presets (Click to insert):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {[...PRESET_APPROVAL_NOTES, ...PRESET_REVISION_NOTES].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRemarks(preset)}
                      className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer text-left"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => handleAction("SUBJECT_TO_REVISION")}
                  className="flex-1 py-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 rounded-xl text-xs font-black uppercase tracking-wider gap-2 cursor-pointer"
                >
                  <RotateCcw className="size-4 text-amber-700" />
                  <span>Return for Revision</span>
                </Button>

                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleAction("APPROVED")}
                  className="flex-1 py-4 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-xl text-xs font-black uppercase tracking-wider gap-2 shadow-md hover:shadow-lg cursor-pointer transition-all"
                >
                  <ShieldCheck className="size-4 text-emerald-300" />
                  <span>MAO Approve & Certify</span>
                </Button>
              </div>
            </div>
          ) : (
            /* OFFICIAL HISTORICAL STAMP */
            <div className="p-4 bg-slate-100/80 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <FileCheck className="size-3.5 text-slate-600" />
                  Certified Municipal Determination
                </span>
                <Badge
                  className={`text-[9px] font-black uppercase ${
                    isApproved ? "bg-emerald-100 text-emerald-900 border-0" : "bg-amber-100 text-amber-900 border-0"
                  }`}
                >
                  {isApproved ? "OFFICIALLY CERTIFIED" : "RETURNED FOR REVISION"}
                </Badge>
              </div>
              {record.reviewRemarks && (
                <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-200/60">
                  "{record.reviewRemarks}"
                </p>
              )}
            </div>
          )}

        </div>

        {/* ═══════════ MODAL FOOTER ═══════════ */}
        <div className="p-3.5 sm:p-4.5 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyId}
              className="text-xs font-bold rounded-xl h-8.5 gap-1.5 cursor-pointer bg-white"
            >
              <Copy className="size-3.5 text-slate-500" />
              <span>Copy Identifier</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs font-bold rounded-xl h-8.5 gap-1.5 cursor-pointer bg-white"
            >
              <Printer className="size-3.5 text-slate-500" />
              <span>Print Ledger</span>
            </Button>
          </div>

          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-5 py-2 h-8.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            Close Inspector
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
