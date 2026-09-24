"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Stethoscope,
  Skull,
  Beef,
  Milk,
  Scale,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Tag,
  Calendar,
  Sparkles,
  XCircle,
  ClipboardCheck,
  Camera,
  Activity,
  X,
  ZoomIn,
  Maximize2,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { getAttachedPhoto, saveAttachedPhoto } from "@/lib/photo-storage";

export type SibatReportType = "DISEASE" | "MORTALITY" | "SLAUGHTER" | "PRODUCTION" | "SALE";
export type SibatStatus = "PENDING" | "VERIFIED" | "APPROVED" | "FLAGGED" | "FALSE_ALARM" | "SUBJECT_TO_REVISION" | "REJECTED";
export type SeverityLevel = "MILD" | "MODERATE" | "SEVERE" | "CRITICAL";
export type BiosecurityAction =
  | "NONE"
  | "PEN_ISOLATION"
  | "TREATMENT_PRESCRIBED"
  | "BIOSECURE_BURIAL"
  | "LAB_SAMPLE_SENT";

export interface SibatInspectionData {
  verifiedBy: string;
  verifiedAt: string;
  tagConfirmed: boolean;
  confirmedCount: number;
  confirmedSymptoms: string[];
  severity: SeverityLevel;
  biosecurityAction: BiosecurityAction;
  remarks: string;
  temperatureCelsius?: number;
}

export interface SibatValidationRecord {
  id: string;
  reportType: SibatReportType;
  farmerName: string;
  barangayName: string;
  purok?: string;
  farmerContact?: string;
  livestockTag: string;
  livestockBreed: string;
  livestockType: string;
  inventoryId?: string;
  name: string;
  reportedCount: number;
  reportedDate: string;
  reportedAt: string;
  farmerSymptoms: string[];
  farmerDescription: string;
  photoName?: string;
  photoUrl?: string;
  status: SibatStatus;
  inspection?: SibatInspectionData;
  maoApproval?: {
    approvedBy: string;
    approvedAt: string;
    remarks?: string;
  };
  extraDetails?: {
    liveWeightKg?: number;
    dressedWeightKg?: number;
    productionQuantity?: number;
    productionUnit?: string;
    salePricePhp?: number;
  };
}

const CLINICAL_SYMPTOMS_LIST = [
  { id: "not_eating", label: "Not Eating / Off-Feed", desc: "Refusing food or water" },
  { id: "fever", label: "High Fever / Hot Ears", desc: "Body temp elevated" },
  { id: "limping", label: "Limping / Weak Legs", desc: "Difficulty standing/walking" },
  { id: "salivating", label: "Excessive Drooling", desc: "Foaming or salivation" },
  { id: "coughing", label: "Coughing / Runny Nose", desc: "Nasal discharge / wheeze" },
  { id: "bloating", label: "Bloated Belly", desc: "Swollen rumen / gas build-up" },
  { id: "wounds", label: "Skin Sores / Blisters", desc: "Hoof, mouth, skin lesions" },
  { id: "weak", label: "Lethargic / Isolated", desc: "Lying down away from herd" },
];

const SIBAT_VERIFIED_PRESETS = [
  "Physical inspection conducted on-farm. Ear tag & animal verified. Mild hoof swelling confirmed; isolated for observation.",
  "Clinical signs match farmer report. Administered supportive oral electrolytes and prescribed isolation protocol.",
  "Mortality verified on site. Carcass disinfected with lime and deep pit burial (2m) completed under SIBAT supervision.",
  "Confirmed symptoms of respiratory distress. Advised farmer on shelter ventilation and temporary herd separation.",
  "Slaughter inspection completed on site. Carcass clean and fit for commercial consumption.",
];

interface SibatInspectionDialogProps {
  record: SibatValidationRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmInspection: (
    recordId: string,
    action: "VERIFIED" | "FLAGGED" | "FALSE_ALARM",
    inspectionData: SibatInspectionData
  ) => void;
}

export function SibatInspectionDialog({
  record,
  open,
  onOpenChange,
  onConfirmInspection,
}: SibatInspectionDialogProps) {
  const [tagConfirmed, setTagConfirmed] = useState<boolean>(true);
  const [confirmedCount, setConfirmedCount] = useState<number>(1);
  const [confirmedSymptoms, setConfirmedSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<SeverityLevel>("MODERATE");
  const [biosecurityAction, setBiosecurityAction] = useState<BiosecurityAction>("PEN_ISOLATION");
  const [temperature, setTemperature] = useState<string>("");
  const [inspectorRemarks, setInspectorRemarks] = useState<string>("");
  const [isPhotoLightboxOpen, setIsPhotoLightboxOpen] = useState<boolean>(false);
  const [inspectorPhotoUrl, setInspectorPhotoUrl] = useState<string>("");
  const [inspectorPhotoName, setInspectorPhotoName] = useState<string>("");

  useEffect(() => {
    if (open && record) {
      setTagConfirmed(record.inspection?.tagConfirmed ?? true);
      setConfirmedCount(record.inspection?.confirmedCount ?? record.reportedCount ?? 1);
      setConfirmedSymptoms(
        record.inspection?.confirmedSymptoms && record.inspection.confirmedSymptoms.length > 0
          ? record.inspection.confirmedSymptoms
          : record.farmerSymptoms || []
      );
      setSeverity(record.inspection?.severity ?? "MODERATE");
      setBiosecurityAction(
        record.inspection?.biosecurityAction ??
        (record.reportType === "MORTALITY" ? "BIOSECURE_BURIAL" : "PEN_ISOLATION")
      );
      setTemperature(
        record.inspection?.temperatureCelsius ? String(record.inspection.temperatureCelsius) : ""
      );
      setInspectorRemarks(record.inspection?.remarks ?? "");
      setInspectorPhotoUrl("");
      setInspectorPhotoName("");
    }
  }, [open, record]);

  const handleInspectorPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && record) {
      setInspectorPhotoName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const dataUrl = event.target.result as string;
          setInspectorPhotoUrl(dataUrl);
          saveAttachedPhoto(record.id, {
            photoUrl: dataUrl,
            photoName: file.name,
            timestamp: new Date().toISOString(),
            uploaderRole: "SIBAT",
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!record) return null;

  const isMortality = record.reportType === "MORTALITY";
  const isDisease = record.reportType === "DISEASE";
  const isVerified = (record.status || "PENDING").toUpperCase() === "VERIFIED";

  const toggleSymptom = (label: string) => {
    setConfirmedSymptoms((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  };

  const handleAction = (status: "VERIFIED" | "FLAGGED" | "FALSE_ALARM") => {
    const officerName = "Officer R. Mendoza (SIBAT Sector 1)";
    const nowIso = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const inspectionData: SibatInspectionData = {
      verifiedBy: officerName,
      verifiedAt: nowIso,
      tagConfirmed,
      confirmedCount,
      confirmedSymptoms,
      severity,
      biosecurityAction,
      remarks:
        inspectorRemarks.trim() ||
        (status === "VERIFIED"
          ? "On-farm physical inspection completed and certified by SIBAT field officer."
          : status === "FLAGGED"
            ? "Returned for Veterinary follow-up / diagnostic testing."
            : "Marked as false alarm upon physical examination."),
      temperatureCelsius: temperature ? parseFloat(temperature) : undefined,
    };

    onConfirmInspection(record.id, status, inspectionData);
    onOpenChange(false);
  };

  const getHeaderIcon = () => {
    switch (record.reportType) {
      case "DISEASE":
        return <Stethoscope className="size-7 sm:size-8 text-emerald-200" />;
      case "MORTALITY":
        return <Skull className="size-7 sm:size-8 text-rose-200" />;
      case "SLAUGHTER":
        return <Beef className="size-7 sm:size-8 text-purple-200" />;
      case "PRODUCTION":
        return <Milk className="size-7 sm:size-8 text-blue-200" />;
      case "SALE":
      default:
        return <Scale className="size-7 sm:size-8 text-teal-200" />;
    }
  };

  const getHeaderBg = () => {
    switch (record.reportType) {
      case "DISEASE":
        return "bg-[#1A365D]";
      case "MORTALITY":
        return "bg-rose-700";
      case "SLAUGHTER":
        return "bg-purple-700";
      case "PRODUCTION":
        return "bg-blue-700";
      case "SALE":
      default:
        return "bg-teal-700";
    }
  };

  const attachedForLightbox = record
    ? getAttachedPhoto(
        record.id,
        record.livestockTag,
        record.livestockType,
        record.name
      )
    : null;
  const lightboxPhotoUrl =
    inspectorPhotoUrl || record?.photoUrl || attachedForLightbox?.photoUrl || "";
  const lightboxPhotoName =
    inspectorPhotoName || record?.photoName || attachedForLightbox?.photoName || "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[96vw] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 md:p-10 bg-white border border-slate-100 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* ══ POPUP HEADER ══ */}
        <DialogHeader className="mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`size-13 sm:size-15 rounded-2xl flex items-center justify-center shrink-0 shadow-md text-white ${getHeaderBg()}`}
              >
                {getHeaderIcon()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-slate-400 uppercase font-mono">
                    Incident #{record.id}
                  </span>
                  <Badge
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${record.status === "VERIFIED"
                      ? "bg-sky-100 text-sky-800 border-sky-300"
                      : record.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : record.status === "FLAGGED"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-amber-50 text-amber-700 border-amber-300 animate-pulse"
                      }`}
                  >
                    {record.status === "VERIFIED"
                      ? "Verified (Field)"
                      : record.status === "APPROVED"
                        ? "MAO Approved"
                        : record.status === "FLAGGED"
                          ? "Subject to Revision"
                          : "Pending On-Farm Visit"}
                  </Badge>
                  <span className="text-xs font-bold text-slate-400">
                    • {record.reportType}
                  </span>
                </div>
                <DialogTitle className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 leading-tight mt-1">
                  {isMortality
                    ? "Step 2: SIBAT Mortality Verification"
                    : isDisease
                      ? "Step 2: SIBAT On-Farm Health Examination"
                      : `Step 2: SIBAT Field Inspection (${record.reportType})`}
                </DialogTitle>
                <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                  Conduct on-farm physical checks, verify clinical signs, and certify records for MAO municipal approval.
                </p>
              </div>
            </div>

            <div className="hidden lg:flex flex-col items-end shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                SIBAT Field Command
              </span>
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mt-0.5">
                <ClipboardCheck className="size-4 text-blue-600" />
                Sector 1 • Padre Garcia
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* ══ 2-COLUMN EXPANDED SIBAT INSPECTION LAYOUT ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* ── LEFT COLUMN (6 COLS): LIVESTOCK & FARMER INITIAL REPORT ── */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest block">
                  1. Livestock & Raiser Profile
                </span>
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Calendar className="size-3.5 text-slate-400" />
                  Reported: {record.reportedDate}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Tag Number</span>
                  <span className="font-black text-slate-900 text-sm sm:text-base">
                    {record.livestockTag}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Breed / Species</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">
                    {record.livestockBreed} ({record.livestockType})
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Raiser / Farmer</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm truncate block">
                    {record.farmerName}
                  </span>
                  {record.farmerContact && (
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                      {record.farmerContact}
                    </span>
                  )}
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Location</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">
                    {record.barangayName} {record.purok ? `(${record.purok})` : ""}
                  </span>
                </div>
              </div>

              {/* Condition / Incident details */}
              <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    {isMortality ? "Reported Mortality Cause" : "Reported Health Condition"}
                  </span>
                  <span className="font-black text-slate-900 text-sm sm:text-base">
                    {record.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    {isMortality ? "Reported Dead Count" : "Reported Affected Count"}
                  </span>
                  <span
                    className={`font-black text-sm sm:text-base ${isMortality ? "text-rose-700" : "text-[#1A365D]"
                      }`}
                  >
                    {record.reportedCount} Head{record.reportedCount > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Farmer Initial Statement */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase block">
                  Farmer's Initial Statement:
                </span>
                <p className="text-slate-700 italic leading-relaxed text-xs sm:text-sm">
                  "{record.farmerDescription}"
                </p>
              </div>

              {/* Farmer Reported Symptoms */}
              {record.farmerSymptoms && record.farmerSymptoms.length > 0 && (
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase block">
                    Signs Reported by Farmer:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {record.farmerSymptoms.map((sym, idx) => (
                      <Badge
                        key={idx}
                        className="bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs py-0.5 px-2 rounded-lg"
                      >
                        {sym}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Farmer Attached Photo Evidence ── */}
              {(() => {
                const attached = getAttachedPhoto(
                  record.id,
                  record.livestockTag,
                  record.livestockType,
                  record.name
                );
                const activePhotoUrl = inspectorPhotoUrl || record.photoUrl || attached.photoUrl;
                const activePhotoName = inspectorPhotoName || record.photoName || attached.photoName;
                const isFarmerUpload = Boolean(inspectorPhotoUrl) ? false : Boolean(record.photoUrl || attached.isFarmerUpload);

                return (
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-50 text-[#1E4D2B]">
                          <Camera className="size-4.5" />
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block leading-tight">
                            Farmer Attached Photo Evidence
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Visual documentation submitted with the alert
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isFarmerUpload ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-2xs">
                            Farmer Upload
                          </Badge>
                        ) : (
                          <Badge className="bg-sky-50 text-sky-800 border-sky-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                            On-Farm Record Photo
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Clickable Photo Container */}
                    <div
                      className="relative group overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 aspect-16/10 cursor-pointer shadow-sm"
                      onClick={() => setIsPhotoLightboxOpen(true)}
                    >
                      <img
                        src={activePhotoUrl}
                        alt={`Photo of ${record.livestockTag} (${record.name})`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Hover Overlay with Inspect Badge */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent opacity-95 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3.5">
                        <div className="flex justify-end">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/70 text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-md">
                            <ZoomIn className="size-3.5 text-emerald-300" />
                            <span>Click to Inspect Fullscreen</span>
                          </span>
                        </div>

                        <div className="flex items-end justify-between gap-2 text-white">
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-black tracking-tight drop-shadow-md truncate">
                              #{record.livestockTag} • {record.livestockBreed} ({record.livestockType})
                            </p>
                            <p className="text-[10px] text-slate-300 font-mono mt-0.5 truncate max-w-xs">
                              {activePhotoName}
                            </p>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/90 text-emerald-950 shrink-0 font-mono shadow-xs">
                            {record.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap text-xs">
                      <button
                        type="button"
                        onClick={() => setIsPhotoLightboxOpen(true)}
                        className="text-xs font-bold text-[#1A365D] hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        <Maximize2 className="size-3.5 text-blue-600" />
                        <span>Enlarge & Examine Symptoms</span>
                      </button>

                      <label className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer hover:underline">
                        <Camera className="size-3.5 text-slate-400" />
                        <span>Add SIBAT Field Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleInspectorPhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── RIGHT COLUMN (6 COLS): SIBAT CLINICAL FORM & ACTIONS ── */}
          <div className="lg:col-span-6 space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="size-5 text-sky-800" />
                  <span className="text-xs sm:text-sm font-black uppercase text-sky-950 tracking-wider">
                    2. Physical On-Farm Examination (Step 2)
                  </span>
                </div>
                <Badge className="bg-sky-200 text-sky-900 border-none font-black text-[10px] uppercase">
                  Field Checklist
                </Badge>
              </div>

              {/* Ear Tag Verification Checkbox */}
              <label className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-sky-200 cursor-pointer hover:bg-sky-50/40 transition-all">
                <input
                  type="checkbox"
                  checked={tagConfirmed}
                  onChange={(e) => setTagConfirmed(e.target.checked)}
                  className="size-5 rounded text-sky-700 focus:ring-sky-500 cursor-pointer"
                />
                <div>
                  <p className="text-xs sm:text-sm font-black text-slate-900">
                    Physical Ear Tag Match Verified
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Confirmed physical ear tag #{record.livestockTag} on animal in pen.
                  </p>
                </div>
              </label>

              {/* Confirmed Count & Temperature */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-800">
                    Confirmed Head Count:
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={confirmedCount}
                    onChange={(e) => setConfirmedCount(parseInt(e.target.value) || 1)}
                    className="bg-white border-sky-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-800">
                    Body Temp (°C) (Optional):
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 39.5"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="bg-white border-sky-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              {/* Interactive Symptoms Checklist */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 block">
                  Clinically Observed Signs (Click to toggle):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {CLINICAL_SYMPTOMS_LIST.map((sym) => {
                    const isSelected = confirmedSymptoms.includes(sym.label);
                    return (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() => toggleSymptom(sym.label)}
                        className={`p-2 rounded-xl border text-left flex items-start gap-2 transition-all cursor-pointer ${isSelected
                          ? "bg-[#1A365D] text-white border-[#1A365D] shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                      >
                        <span className="font-bold text-xs mt-0.5">
                          {isSelected ? "✓" : "○"}
                        </span>
                        <div>
                          <p className="text-xs font-black leading-tight">{sym.label}</p>
                          <p
                            className={`text-[9px] font-medium ${isSelected ? "text-blue-200" : "text-slate-400"
                              }`}
                          >
                            {sym.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Severity & Biosecurity Protocol */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-800">
                    Severity Rating:
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                    className="w-full bg-white border border-sky-200 rounded-xl h-10 px-3 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="MILD">Mild (Monitoring Required)</option>
                    <option value="MODERATE">Moderate (Treatment Needed)</option>
                    <option value="SEVERE">Severe (Urgent Intervention)</option>
                    <option value="CRITICAL">Critical / Fatal</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-800">
                    Biosecurity Action:
                  </label>
                  <select
                    value={biosecurityAction}
                    onChange={(e) => setBiosecurityAction(e.target.value as BiosecurityAction)}
                    className="w-full bg-white border border-sky-200 rounded-xl h-10 px-3 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="NONE">None / General Advisory</option>
                    <option value="PEN_ISOLATION">Temporary Pen Isolation (7 Days)</option>
                    <option value="TREATMENT_PRESCRIBED">Supportive Treatment Prescribed</option>
                    <option value="BIOSECURE_BURIAL">Biosecure Deep Pit Burial & Lime</option>
                    <option value="LAB_SAMPLE_SENT">Blood/Tissue Sample Sent to Lab</option>
                  </select>
                </div>
              </div>

              {/* Inspector Remarks & Presets */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800">
                    SIBAT Field Audit Remarks:
                  </label>
                  <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                    <Sparkles className="size-3" /> Quick Presets
                  </div>
                </div>

                <Textarea
                  placeholder="Enter detailed clinical findings, veterinarian advisory, prescription details, or carcass disposal notes..."
                  value={inspectorRemarks}
                  onChange={(e) => setInspectorRemarks(e.target.value)}
                  className="bg-white border-sky-200 rounded-2xl text-xs font-medium resize-none h-20 p-3 focus-visible:ring-2 focus-visible:ring-[#1A365D]"
                />

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {(isMortality
                    ? [
                      "Mortality verified on site. Carcass disinfected with lime and deep pit burial (2m) completed under SIBAT supervision.",
                      "Death caused by severe birth complications. No signs of transmissible infectious disease.",
                      "Discrepancy in recorded ear tag or animal identity. Requires re-audit.",
                    ]
                    : SIBAT_VERIFIED_PRESETS
                  ).map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setInspectorRemarks(preset)}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-white hover:bg-sky-100 text-sky-950 font-bold border border-sky-200 transition-all text-left cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inspector Stamp */}
              <div className="p-2.5 bg-white rounded-xl border border-sky-200 flex items-center justify-between text-xs text-slate-600">
                <span className="font-bold flex items-center gap-1.5">
                  <User className="size-3.5 text-sky-700" />
                  Officer: R. Mendoza (SIBAT Sector 1)
                </span>
                <span className="text-[10px] font-mono text-slate-500">Padre Garcia Registry</span>
              </div>
            </div>

            {/* Decision Actions */}
            <div className="space-y-2 pt-1">
              <Button
                type="button"
                onClick={() => handleAction("VERIFIED")}
                className="w-full py-6 bg-[#1A365D] hover:bg-[#152c4d] text-white rounded-2xl font-black uppercase text-xs sm:text-sm tracking-wider shadow-lg hover:shadow-xl transition-all gap-2 cursor-pointer"
              >
                <ShieldCheck className="size-5 text-emerald-300" />
                <span>Certify as VERIFIED ➔ Forward to MAO</span>
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAction("FLAGGED")}
                  className="py-4 bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 rounded-xl font-black uppercase text-xs tracking-wider gap-1.5 cursor-pointer"
                >
                  <AlertTriangle className="size-4" />
                  <span>Refer for Vet Lab Sample</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black uppercase text-xs tracking-wider cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* ══ FULLSCREEN PHOTO LIGHTBOX MODAL ══ */}
    <Dialog open={isPhotoLightboxOpen} onOpenChange={setIsPhotoLightboxOpen}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl md:max-w-4xl p-0 rounded-3xl bg-slate-950 border border-slate-800 text-white overflow-hidden shadow-2xl">
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Camera className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-white leading-tight">
                Farmer Photo Evidence • #{record.livestockTag}
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5 font-mono truncate max-w-md">
                {lightboxPhotoName} • {record.farmerName} ({record.barangayName})
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsPhotoLightboxOpen(false)}
            className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="relative bg-black flex items-center justify-center max-h-[75vh] overflow-hidden p-2 sm:p-4">
          <img
            src={lightboxPhotoUrl}
            alt={`Full-resolution evidence for ${record.livestockTag}`}
            className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-2xl"
          />
        </div>

        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-300">Observation:</span>
            <span className="text-white font-medium italic">"{record.name}"</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Reported: {record.reportedDate}</span>
          </div>

          <a
            href={lightboxPhotoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink className="size-3.5" />
            <span>Open Original in New Tab</span>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}
