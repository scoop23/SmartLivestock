"use client";

import React, { useState } from "react";
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
export type SibatStatus = "PENDING" | "VERIFIED" | "APPROVED" | "FLAGGED" | "FALSE_ALARM" | "SUBJECT_TO_REVISION" | "SUBJECT_FOR_REVISION" | "REJECTED";
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
  countConfirmed: boolean;
  confirmedCount: number;
  confirmedSymptoms: string[];
  severity: SeverityLevel | "";
  biosecurityAction: BiosecurityAction | "";
  remarks: string;
  temperatureCelsius?: number;
  inspectorPhotoFile?: File;
  inspectorPhotoUrl?: string;
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
  isSubmitting?: boolean;
}

export function SibatInspectionDialog({
  record,
  open,
  onOpenChange,
  onConfirmInspection,
  isSubmitting = false,
}: SibatInspectionDialogProps) {
  const [tagConfirmed, setTagConfirmed] = useState<boolean>(record?.inspection?.tagConfirmed ?? false);
  const [countConfirmed, setCountConfirmed] = useState<boolean>(record?.inspection?.countConfirmed ?? false);
  const [confirmedCount, setConfirmedCount] = useState<number>(record?.inspection?.confirmedCount ?? record?.reportedCount ?? 1);
  const [confirmedSymptoms, setConfirmedSymptoms] = useState<string[]>(record?.inspection?.confirmedSymptoms ?? []);
  const [severity, setSeverity] = useState<SeverityLevel | "">(record?.inspection?.severity ?? "");
  const [biosecurityAction, setBiosecurityAction] = useState<BiosecurityAction | "">(record?.inspection?.biosecurityAction ?? "");
  const [temperature, setTemperature] = useState<string>(record?.inspection?.temperatureCelsius ? String(record.inspection.temperatureCelsius) : "");
  const [inspectorRemarks, setInspectorRemarks] = useState<string>(record?.inspection?.remarks ?? "");
  const [isPhotoLightboxOpen, setIsPhotoLightboxOpen] = useState<boolean>(false);
  const [inspectorPhotoUrl, setInspectorPhotoUrl] = useState<string>("");
  const [inspectorPhotoName, setInspectorPhotoName] = useState<string>("");
  const [inspectorPhotoFile, setInspectorPhotoFile] = useState<File | null>(null);
  const [confirmationAction, setConfirmationAction] = useState<"VERIFIED" | "FLAGGED" | null>(null);
  const [validationError, setValidationError] = useState("");

  const handleInspectorPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && record) {
      setInspectorPhotoFile(file);
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

  const handleAction = (status: "VERIFIED" | "FLAGGED") => {
    if (status === "VERIFIED" && (!tagConfirmed || !countConfirmed || confirmedCount < 1)) {
      setValidationError("Confirm the physical tag and field count before sending this record to MAO.");
      return;
    }
    setValidationError("");
    setConfirmationAction(status);
  };

  const confirmAction = () => {
    if (!confirmationAction || isSubmitting) return;
    const status = confirmationAction;
    const nowIso = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const inspectionData: SibatInspectionData = {
      verifiedBy: "Signed-in SIBAT account",
      verifiedAt: nowIso,
      tagConfirmed,
      countConfirmed,
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
      inspectorPhotoFile: inspectorPhotoFile || undefined,
      inspectorPhotoUrl: inspectorPhotoUrl || undefined,
    };

    onConfirmInspection(record.id, status, inspectionData);
    setConfirmationAction(null);
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
    inspectorPhotoUrl || record?.photoUrl || (attachedForLightbox?.isFarmerUpload ? attachedForLightbox.photoUrl : "");
  const lightboxPhotoName =
    inspectorPhotoName || record?.photoName || (attachedForLightbox?.isFarmerUpload ? attachedForLightbox.photoName : "");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen max-w-none rounded-none p-4 sm:w-full sm:max-w-4xl sm:rounded-2xl sm:p-6 md:max-w-5xl lg:max-w-6xl lg:p-8 bg-white border border-slate-100 shadow-2xl max-h-[100dvh] sm:max-h-[92vh] overflow-y-auto">
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
                        : record.status === "FLAGGED" || record.status === "SUBJECT_TO_REVISION" || record.status === "SUBJECT_FOR_REVISION"
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : "bg-amber-50 text-amber-700 border-amber-300 animate-pulse"
                      }`}
                  >
                    {record.status === "VERIFIED"
                      ? "Verified (Field)"
                      : record.status === "APPROVED"
                        ? "MAO Approved"
                        : record.status === "FLAGGED" || record.status === "SUBJECT_TO_REVISION" || record.status === "SUBJECT_FOR_REVISION"
                          ? "Subject for Revision"
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
                  Farmer&apos;s Initial Statement:
                </span>
                <p className="text-slate-700 italic leading-relaxed text-xs sm:text-sm">
                  &quot;{record.farmerDescription}&quot;
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
                const activePhotoUrl = inspectorPhotoUrl || record.photoUrl || (attached.isFarmerUpload ? attached.photoUrl : "");
                const activePhotoName = inspectorPhotoName || record.photoName || (attached.isFarmerUpload ? attached.photoName : "");
                const isFarmerUpload = Boolean(inspectorPhotoUrl) ? false : Boolean(record.photoUrl || attached.isFarmerUpload);

                if (!activePhotoUrl) {
                  return (
                    <div className="p-4 bg-white rounded-2xl border border-dashed border-slate-200 space-y-2.5 text-center">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-slate-100 text-slate-500">
                            <Camera className="size-4.5" />
                          </div>
                          <div className="text-left">
                            <span className="text-xs sm:text-sm font-black text-slate-800 block leading-tight">
                              Photo Evidence
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              No photograph attached by farmer
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-slate-500 border-slate-200 text-[10px] font-bold">
                          No Photo
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 py-1">
                        The raiser did not upload a photograph with this incident report.
                      </p>

                      {/* Photo upload button & preview matching other dialogs */}
                      <div className="space-y-2 pt-1 text-left">
                        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 hover:border-sky-600 rounded-xl bg-slate-50 cursor-pointer transition-colors text-xs font-bold text-slate-600 hover:text-sky-700">
                          <Camera className="w-4 h-4 text-sky-600" />
                          <span>{inspectorPhotoName ? `Photo: ${inspectorPhotoName}` : "Add SIBAT Field Inspection Photo (Optional)"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleInspectorPhotoUpload}
                            className="hidden"
                          />
                        </label>

                        {inspectorPhotoUrl && (
                          <div className="relative rounded-2xl overflow-hidden border border-sky-300 bg-sky-50/60 p-2 flex items-center gap-3">
                            <img
                              src={inspectorPhotoUrl}
                              alt="Attached preview"
                              className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                            <div className="flex-1 min-w-0 text-xs">
                              <p className="font-bold text-slate-900 truncate">{inspectorPhotoName}</p>
                              <p className="text-[11px] text-sky-700 font-semibold">
                                Inspection photo attached & ready for MAO validation
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setInspectorPhotoName("");
                                setInspectorPhotoUrl("");
                                setInspectorPhotoFile(null);
                              }}
                              className="text-slate-400 hover:text-rose-600 rounded-xl"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-50 text-[#1E4D2B]">
                          <Camera className="size-4.5" />
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block leading-tight">
                            {isFarmerUpload ? "Farmer Attached Photo Evidence" : "SIBAT Inspection Photo"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {isFarmerUpload ? "Visual documentation submitted with the alert" : "Captured during on-farm verification visit"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isFarmerUpload ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-2xs">
                            Farmer Upload
                          </Badge>
                        ) : (
                          <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-2xs">
                            SIBAT Field Photo
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
                  onChange={(e) => {
                    setTagConfirmed(e.target.checked);
                    setValidationError("");
                  }}
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

              <label className="flex min-h-14 items-center gap-3 rounded-xl border border-sky-200 bg-white p-3.5">
                <input
                  type="checkbox"
                  checked={countConfirmed}
                  onChange={(event) => {
                    setCountConfirmed(event.target.checked);
                    setValidationError("");
                  }}
                  className="size-5 rounded text-sky-700 focus:ring-sky-500"
                />
                <span className="text-xs font-semibold text-slate-800">I counted the affected animal(s) in person.</span>
              </label>

              {/* Confirmed Count & Temperature */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-800">
                    Field count (farmer reported: {record.reportedCount}):
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={confirmedCount}
                    onChange={(e) => setConfirmedCount(e.target.value === "" ? 0 : Number(e.target.value))}
                    className="min-h-11 bg-white border-sky-200 rounded-xl text-sm font-bold"
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
                    onChange={(e) => setSeverity(e.target.value as SeverityLevel | "")}
                    className="w-full bg-white border border-sky-200 rounded-xl h-10 px-3 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="">Not assessed</option>
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
                    onChange={(e) => setBiosecurityAction(e.target.value as BiosecurityAction | "")}
                    className="w-full bg-white border border-sky-200 rounded-xl h-10 px-3 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="">No action recorded</option>
                    <option value="NONE">None / General Advisory</option>
                    <option value="PEN_ISOLATION">Temporary Pen Isolation (7 Days)</option>
                    <option value="TREATMENT_PRESCRIBED">Supportive Treatment Prescribed</option>
                    <option value="BIOSECURE_BURIAL">Biosecure Deep Pit Burial & Lime</option>
                    <option value="LAB_SAMPLE_SENT">Blood/Tissue Sample Sent to Lab</option>
                  </select>
                </div>
              </div>

              {/* SIBAT Inspection Photo upload matching other dialogs */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-black text-slate-800 block">
                  SIBAT Field Inspection Photo (Optional):
                </label>
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-sky-200 hover:border-sky-600 rounded-xl bg-white cursor-pointer transition-colors text-xs font-bold text-sky-800">
                  <Camera className="w-4 h-4 text-sky-600" />
                  <span>{inspectorPhotoName ? `Photo: ${inspectorPhotoName}` : "Attach SIBAT Field Inspection Photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleInspectorPhotoUpload}
                    className="hidden"
                  />
                </label>

                {inspectorPhotoUrl && (
                  <div className="relative rounded-2xl overflow-hidden border border-sky-300 bg-white p-2 flex items-center gap-3 shadow-2xs">
                    <img
                      src={inspectorPhotoUrl}
                      alt="Inspection preview"
                      className="w-16 h-16 rounded-xl object-cover border border-sky-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <p className="font-bold text-slate-900 truncate">{inspectorPhotoName}</p>
                      <p className="text-[11px] text-sky-700 font-semibold">
                        Field photo attached & ready for MAO certification
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setInspectorPhotoName("");
                        setInspectorPhotoUrl("");
                        setInspectorPhotoFile(null);
                      }}
                      className="text-slate-400 hover:text-rose-600 rounded-xl"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
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
                  Review recorded under the signed-in SIBAT account
                </span>
                <span className="text-[10px] font-mono text-slate-500">Padre Garcia Registry</span>
              </div>
            </div>

            {/* Decision Actions */}
            <div className="space-y-2 pt-1">
              {validationError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-900">{validationError}</p>}
              {confirmationAction ? (
                <div role="alertdialog" aria-live="polite" className="space-y-3 rounded-xl border border-sky-300 bg-sky-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {confirmationAction === "VERIFIED"
                      ? "Confirm the physical checks and send this record to MAO for its decision?"
                      : "Flag this report as needing follow-up? The existing workflow will return it with your remarks."}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button type="button" onClick={confirmAction} disabled={isSubmitting} className="min-h-11 bg-[#1A365D] text-white hover:bg-[#152c4d]">
                      {isSubmitting ? "Sending..." : "Confirm and send"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setConfirmationAction(null)} disabled={isSubmitting} className="min-h-11">Go back</Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={() => handleAction("VERIFIED")}
                    disabled={isSubmitting}
                    className="min-h-12 w-full bg-[#1A365D] text-white hover:bg-[#152c4d] rounded-xl font-bold"
                  >
                    <ShieldCheck className="mr-2 size-5 text-emerald-300" />
                    Confirm details and send to MAO
                  </Button>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleAction("FLAGGED")}
                      disabled={isSubmitting}
                      className="min-h-11 bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100 rounded-xl font-semibold"
                    >
                      <AlertTriangle className="mr-2 size-4" />Flag a concern
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="min-h-11">Close without sending</Button>
                  </div>
                </>
              )}
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
            <span className="text-white font-medium italic">&quot;{record.name}&quot;</span>
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
