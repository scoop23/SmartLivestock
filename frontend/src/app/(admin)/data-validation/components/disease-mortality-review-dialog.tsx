"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Stethoscope,
  Skull,
  ShieldCheck,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Tag,
  Calendar,
  Sparkles,
  XCircle,
  ClipboardCheck,
  Camera,
  HeartPulse,
  RotateCcw,
  ZoomIn,
} from "lucide-react";
import { getAttachedPhoto } from "@/lib/photo-storage";
import {
  ValidationIncidentItem,
  getStatusPill,
} from "../validation-analytics";

interface DiseaseMortalityReviewDialogProps {
  record: ValidationIncidentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmAction: (
    action: "APPROVED" | "SUBJECT_TO_REVISION",
    remarks: string,
    recordId: string
  ) => void;
}

const MAO_DISEASE_APPROVAL_PRESETS = [
  "Official MAO Animal Health Certificate issued; supportive treatment & quarantine verified.",
  "Clinical signs match SIBAT field report; issued prescription under Municipal Veterinary supervision.",
  "Pen isolation protocol confirmed; scheduled 72-hour SIBAT health follow-up.",
];

const MAO_MORTALITY_APPROVAL_PRESETS = [
  "Biosecure carcass deep pit burial supervised & certified by MAO.",
  "Official mortality certificate issued; herd census records decremented.",
  "Epidemiological post-mortem inspection cleared of anthrax/ASF risk.",
];

const MAO_REVISION_PRESETS = [
  "Clinical evidence requires clarification; requested Provincial Veterinary blood smear analysis.",
  "Discrepancy in recorded ear tag or raiser ownership; returned for SIBAT field correction.",
  "Incomplete carcass disposal documentation; returned for compliance.",
];

export function DiseaseMortalityReviewDialog({
  record,
  open,
  onOpenChange,
  onConfirmAction,
}: DiseaseMortalityReviewDialogProps) {
  const [remarks, setRemarks] = useState("");

  if (!record) return null;

  const isMortality = record.type === "mortality";
  const isDisease = record.type === "disease";
  const isSibatVerified = (record.status || "PENDING").toUpperCase() === "VERIFIED";
  const statusPill = getStatusPill(record.status);

  const handleAction = (status: "APPROVED" | "SUBJECT_TO_REVISION") => {
    onConfirmAction(status, remarks.trim(), record.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[98vw] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] p-4 sm:p-7 md:p-9 bg-white border border-slate-100 shadow-2xl max-h-[94vh] overflow-y-auto">
        {/* ══ POPUP HEADER ══ */}
        <DialogHeader className="mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`size-13 sm:size-15 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                  isMortality
                    ? "bg-rose-700 text-white"
                    : "bg-[#2D5A27] text-white"
                }`}
              >
                {isMortality ? (
                  <Skull className="size-7 sm:size-8 text-rose-200" />
                ) : (
                  <Stethoscope className="size-7 sm:size-8 text-emerald-200" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-slate-400 uppercase font-mono">
                    Case #{record.id}
                  </span>
                  <Badge
                    variant="outline"
                    className={`border text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${statusPill.bg}`}
                  >
                    <span className={`size-1.5 rounded-full mr-1.5 ${statusPill.dot}`} />
                    {statusPill.label}
                  </Badge>
                  {isSibatVerified && (
                    <Badge className="bg-sky-100 text-sky-800 border-sky-300 font-black text-[10px] uppercase">
                      Step 2 Complete: SIBAT Verified
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 leading-tight mt-1">
                  {isMortality
                    ? "Municipal Mortality Review & Certification"
                    : "Municipal Disease & Health Outbreak Review"}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                  Municipal Agriculture Office (MAO) Final Audit & Verification Center
                </DialogDescription>
              </div>
            </div>

            <div className="hidden lg:flex flex-col items-end shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Municipal Authority Stamp
              </span>
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="size-4 text-[#2D5A27]" />
                Padre Garcia, Batangas
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* ══ 2-COLUMN EXPANDED LAYOUT ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* ── LEFT COLUMN (7 COLS): ANIMAL & SIBAT FINDINGS ── */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Livestock & Raiser Profile */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest block">
                  1. Livestock & Raiser Profile
                </span>
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Calendar className="size-3.5 text-slate-400" />
                  Logged: {record.date}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Tag Number</span>
                  <span className="font-black text-slate-900 text-sm sm:text-base">
                    {record.tagNumber || `TAG-${record.id}`}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Breed / Species</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">
                    {record.livestockBreed || "Standard"} ({record.livestockType || "Cattle"})
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Raiser Name</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm truncate block">
                    {record.farmerName}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Barangay Location</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">
                    {record.barangayName} {record.purok ? `(${record.purok})` : ""}
                  </span>
                </div>
              </div>

              {/* Condition Banner */}
              <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    {isMortality ? "Reported Cause of Death" : "Reported Health Condition"}
                  </span>
                  <span className="font-black text-slate-900 text-sm sm:text-base">
                    {record.conditionName || record.details}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    {isMortality ? "Dead Count" : "Affected Count"}
                  </span>
                  <span
                    className={`font-black text-sm sm:text-base ${
                      isMortality ? "text-rose-700" : "text-[#2D5A27]"
                    }`}
                  >
                    {record.headCount || 1} Head{(record.headCount || 1) > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Farmer Initial Statement */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase block">
                  Farmer's Initial Statement:
                </span>
                <p className="text-slate-700 italic leading-relaxed">"{record.details}"</p>
              </div>

              {/* Attached Photo Evidence Card */}
              {(() => {
                const attached = getAttachedPhoto(
                  record.id,
                  record.tagNumber,
                  record.livestockType,
                  record.conditionName
                );
                const activePhotoUrl = record.photoUrl || (attached.isFarmerUpload ? attached.photoUrl : "");
                const activePhotoName = record.photoName || (attached.isFarmerUpload ? attached.photoName : "");

                if (!activePhotoUrl) return null;

                return (
                  <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-[#1E4D2B]">
                          <Camera className="size-4" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-slate-900 block leading-tight">
                            Farmer Attached Photo Evidence
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Submitted by raiser during incident log
                          </span>
                        </div>
                      </div>

                      <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        Photo Attached
                      </Badge>
                    </div>

                    <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-slate-950 aspect-16/10 shadow-2xs">
                      <img
                        src={activePhotoUrl}
                        alt={`Photo evidence for #${record.tagNumber}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end justify-between p-2.5 text-white">
                        <span className="text-[10px] font-mono text-slate-200 truncate max-w-xs">
                          {activePhotoName}
                        </span>
                        <a
                          href={activePhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-emerald-300 hover:underline flex items-center gap-1"
                        >
                          <ZoomIn className="size-3" /> Full size
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 2. SIBAT On-Farm Field Inspection Findings (Step 2) */}
            {record.sibatInspection ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="size-5 text-sky-700" />
                    <span className="text-xs sm:text-sm font-black uppercase text-sky-950 tracking-wider">
                      2. SIBAT On-Farm Clinical Inspection (Step 2)
                    </span>
                  </div>
                  <Badge className="bg-sky-200 text-sky-900 border-none font-black text-[10px] uppercase">
                    Verified On-Farm
                  </Badge>
                </div>

                {/* SIBAT Officer & Timestamp Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-sky-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Inspecting SIBAT Officer
                    </span>
                    <span className="font-black text-sky-950 flex items-center gap-1.5 mt-0.5 text-xs sm:text-sm">
                      <User className="size-4 text-sky-600" />
                      {record.sibatInspection.verifiedBy}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-sky-200">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Inspection Date & Time
                    </span>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5 text-xs sm:text-sm">
                      <Calendar className="size-4 text-slate-400" />
                      {record.sibatInspection.verifiedAt}
                    </span>
                  </div>
                </div>

                {/* Clinical Verification Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-sky-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Ear Tag Match</span>
                    <span className="font-black text-emerald-700 flex items-center gap-1 mt-0.5 text-xs sm:text-sm">
                      <CheckCircle2 className="size-4" />
                      {record.sibatInspection.tagConfirmed ? "Verified" : "Unverified"}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-sky-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Confirmed Heads</span>
                    <span className="font-black text-slate-900 mt-0.5 block text-xs sm:text-sm">
                      {record.sibatInspection.confirmedCount} Head(s)
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-sky-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Severity Rating</span>
                    <span className="font-black text-amber-700 uppercase mt-0.5 block text-xs sm:text-sm">
                      {record.sibatInspection.severity}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-sky-200">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Body Temperature</span>
                    <span className="font-black text-slate-900 mt-0.5 block text-xs sm:text-sm">
                      {record.sibatInspection.temperatureCelsius
                        ? `${record.sibatInspection.temperatureCelsius} °C`
                        : "Normal"}
                    </span>
                  </div>
                </div>

                {/* Symptoms Observed by SIBAT */}
                {record.sibatInspection.confirmedSymptoms &&
                  record.sibatInspection.confirmedSymptoms.length > 0 && (
                    <div className="p-3.5 bg-white rounded-xl border border-sky-200 text-xs space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase block">
                        Clinically Confirmed Symptoms Checklist:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {record.sibatInspection.confirmedSymptoms.map((sym, idx) => (
                          <Badge
                            key={idx}
                            className="bg-sky-100 text-sky-900 border border-sky-200 font-bold text-xs py-1 px-2.5 rounded-lg"
                          >
                            ✓ {sym}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {/* SIBAT Officer Remarks Quote */}
                <div className="p-3.5 bg-white rounded-xl border border-sky-200 text-xs space-y-1">
                  <span className="text-[10px] font-black text-sky-900 uppercase block">
                    SIBAT Field Officer Remarks & Guidance:
                  </span>
                  <p className="text-slate-800 font-medium italic leading-relaxed text-xs sm:text-sm">
                    "{record.sibatInspection.remarks}"
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-3.5">
                <Clock className="size-6 text-amber-600 shrink-0" />
                <div>
                  <p className="font-black text-sm">Awaiting SIBAT On-Farm Field Inspection</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    This report has been submitted by the farmer but has not yet been physically verified on-site by a SIBAT field officer.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN (5 COLS): STEP 3 MAO CERTIFICATION & ACTIONS ── */}
          <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
            <div className="p-5 sm:p-6 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-[#2D5A27]" />
                  <span className="text-xs sm:text-sm font-black uppercase text-[#2D5A27] tracking-wider">
                    3. MAO Municipal Certification (Step 3)
                  </span>
                </div>
                <Badge className="bg-[#2D5A27] text-white border-none font-black text-[10px] uppercase">
                  Official Audit
                </Badge>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Review the SIBAT on-farm clinical findings on the left, attach official veterinarian remarks, and issue the final municipal certification or quarantine directives.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 block">
                  Official MAO Certification Remarks:
                </label>
                <Textarea
                  placeholder="Enter official MAO certification remarks, veterinary directives, quarantine compliance, or registry adjustments..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="bg-white border-emerald-200 rounded-2xl text-xs sm:text-sm font-medium resize-none h-28 sm:h-32 p-3.5 focus-visible:ring-2 focus-visible:ring-[#2D5A27]"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span>MAO Preset Suggestions</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {(isMortality
                    ? MAO_MORTALITY_APPROVAL_PRESETS
                    : MAO_DISEASE_APPROVAL_PRESETS
                  ).map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRemarks(preset)}
                      className="text-left text-xs px-3 py-2 rounded-xl bg-white hover:bg-emerald-100 text-emerald-950 font-bold border border-emerald-200 transition-all leading-snug cursor-pointer shadow-2xs"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Decision Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <Button
                type="button"
                onClick={() => handleAction("APPROVED")}
                className="w-full py-6 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-2xl font-black uppercase text-xs sm:text-sm tracking-wider shadow-lg hover:shadow-xl transition-all gap-2 cursor-pointer"
              >
                <ShieldCheck className="size-5 text-emerald-200" />
                <span>Certify & Issue MAO Approval</span>
              </Button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleAction("SUBJECT_TO_REVISION")}
                  className="py-5 bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 rounded-2xl font-black uppercase text-xs tracking-wider gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="size-4 text-amber-700" />
                  <span>Return for Revision</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black uppercase text-xs tracking-wider cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
