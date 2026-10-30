"use client";

import { DiseaseCaseFollowUp } from "@/components/disease-case-follow-up";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { evaluateFmdSigns } from "@/lib/fmd-signs";
import { FmdSuspicionAlertCard } from "./fmd-suspicion-alert-card";
import { useAuth } from "@/contexts/auth-context";
import { getAttachedPhoto,saveAttachedPhoto } from "@/lib/photo-storage";
import {
AlertTriangle,
ArrowLeft,
ArrowRight,
Beef,
Calendar,
Camera,
Check,
CheckCircle2,
ClipboardCheck,
Clock,
ExternalLink,
MapPin,
Maximize2,
Milk,
Scale,
ShieldAlert,
ShieldCheck,
Skull,
Sparkles,
Stethoscope,
Tag,
User,
X,
ZoomIn
} from "lucide-react";
import React,{ useRef, useState } from "react";
import { toast } from "sonner";

export type SibatReportType = "DISEASE" | "MORTALITY" | "SLAUGHTER" | "PRODUCTION" | "SALE";
export type SibatStatus = "PENDING" | "VERIFIED" | "APPROVED" | "FLAGGED" | "FALSE_ALARM" | "SUBJECT_TO_REVISION" | "SUBJECT_FOR_REVISION" | "REJECTED";
export type SeverityLevel = "MILD" | "MODERATE" | "SEVERE" | "CRITICAL";
export type BiosecurityAction =
  | "NONE"
  | "PEN_ISOLATION"
  | "TREATMENT_PRESCRIBED"
  | "BIOSECURE_BURIAL"
  | "LAB_SAMPLE_SENT"
  | "CARCASS_SECURED"
  | "AREA_DISINFECTED"
  | "VETERINARY_ESCALATION";

export interface AffectedAnimalItem {
  id?: number | string;
  tagNumber: string;
  breed?: string;
  livestockTypeName?: string;
}

export interface HeadDiagnosis {
  tagNumber: string;
  confirmedSymptoms: string[];
  temperature?: string;
}

export interface SibatInspectionData {
  verifiedBy: string;
  verifiedAt: string;
  tagConfirmed: boolean;
  countConfirmed: boolean;
  confirmedCount: number;
  confirmedSymptoms: string[];
  fmdAssessment?: "SUSPECTED" | "";
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
  affectedAnimals?: AffectedAnimalItem[];
  reviewedByRole?: string;
  reviewedByName?: string;
  reviewRemarks?: string;
  previousRemarks?: string;
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

const MORTALITY_DIALOG_WIDTH = "w-[calc(100vw-1rem)] sm:w-full max-w-[calc(100vw-1rem)] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl";

function DiseaseReadOnlyDetails({
  record,
  photoUrl,
  onClose,
  onOpenPhoto,
}: {
  record: SibatValidationRecord;
  photoUrl: string;
  onClose: () => void;
  onOpenPhoto: () => void;
}) {
  const isApproved = record.status === "APPROVED";
  const isForwarded = record.status === "VERIFIED";
  const inspection = record.inspection;
  const severity = inspection?.severity ? inspection.severity.charAt(0) + inspection.severity.slice(1).toLowerCase() : "Not recorded";
  const biosecurityLabels: Record<BiosecurityAction, string> = {
    NONE: "No additional action",
    PEN_ISOLATION: "Temporary Pen Isolation (7 Days)",
    TREATMENT_PRESCRIBED: "Supportive Treatment Prescribed",
    BIOSECURE_BURIAL: "Biosecure Deep Pit Burial & Lime",
    LAB_SAMPLE_SENT: "Sample Sent to Laboratory",
    CARCASS_SECURED: "Carcass secured pending guidance",
    AREA_DISINFECTED: "Area and equipment disinfected",
    VETERINARY_ESCALATION: "Referred to veterinarian / MAO",
  };
  const biosecurity = inspection?.biosecurityAction ? biosecurityLabels[inspection.biosecurityAction] : "Not recorded";
  const statusLabel = isApproved ? "MAO Approved" : isForwarded ? "Under MAO Review" : "Needs Review";

  return (
    <div className="w-full min-w-0 max-w-full space-y-3 overflow-x-hidden bg-slate-50 p-2.5 sm:space-y-4 sm:p-5">
      <p id="sibat-inspection-description" className="sr-only">Reported animal information, field inspection findings, and case follow-up history.</p>
      <Button type="button" variant="ghost" onClick={onClose} className="h-8 gap-2 px-2 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-200">
        <ArrowLeft className="size-4" /> Back to Disease Reports
      </Button>

      <header className="flex flex-col gap-3 rounded-xl bg-gradient-to-r from-[#12365f] to-[#1e4e80] p-3.5 pr-10 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:px-6 sm:pr-14">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="grid size-11 sm:size-16 shrink-0 place-items-center rounded-full bg-sky-400/25 text-white">
            <Stethoscope className="size-6 sm:size-8" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-sky-100">Disease Report · {record.id}</p>
            <DialogTitle className="mt-0.5 text-base sm:text-xl md:text-2xl font-black leading-tight text-white break-words">Field Inspection Details</DialogTitle>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-sky-100">
              <span><strong>Farmer:</strong> {record.farmerName}</span>
              <span className="hidden sm:inline">|</span>
              <span><strong>Barangay:</strong> {record.barangayName}</span>
            </div>
          </div>
        </div>
        <Badge className="w-fit shrink-0 border border-amber-300 bg-amber-50 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-amber-950">
          <Clock className="mr-1.5 size-3.5 sm:size-4" />{statusLabel}
        </Badge>
      </header>

      <section className={`flex items-center gap-3 rounded-xl border p-3 sm:p-3.5 sm:px-5 ${isApproved ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-sky-200 bg-sky-50 text-sky-950"}`}>
        <span className={`grid size-10 sm:size-12 shrink-0 place-items-center rounded-full ${isApproved ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}><ShieldCheck className="size-6 sm:size-7" /></span>
        <div className="min-w-0"><h3 className="text-xs sm:text-base font-bold">{isApproved ? "MAO Review Completed" : isForwarded ? "Field Inspection Completed" : "Field Inspection Pending"}</h3><p className={`text-xs sm:text-sm leading-relaxed ${isApproved ? "text-emerald-900" : "text-sky-900"}`}>{isApproved ? "The report was approved by MAO." : isForwarded ? "A field reviewer checked this report and sent it to the MAO for review." : "This report is awaiting an on-site field inspection."}</p></div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5">
        <h3 className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900"><User className="size-5 sm:size-6 text-blue-700 shrink-0" />1. Animal &amp; Farmer Information</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 sm:gap-2.5">
          {[
            { label: "Ear Tag Number", value: record.livestockTag || "Not recorded", icon: <Tag className="size-5 sm:size-6" /> },
            { label: "Animal / Species", value: `${record.livestockType || "Livestock"}${record.livestockBreed ? ` (${record.livestockBreed})` : ""}`, icon: <Beef className="size-5 sm:size-6" /> },
            { label: "Farmer", value: record.farmerName || "Registered Farmer", icon: <User className="size-5 sm:size-6" /> },
            { label: "Barangay", value: record.barangayName || "Not recorded", icon: <MapPin className="size-5 sm:size-6" /> },
          ].map((item) => (
            <div key={item.label} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
              <span className="shrink-0 text-blue-700">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs font-semibold text-slate-500">{item.label}</p>
                <p className="font-bold text-slate-900 text-xs sm:text-sm break-words">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ClipboardCheck className="size-6 text-blue-700" />2. Reported Health Concerns</h3><p className="ml-8 text-sm text-slate-600">Reported by the farmer — not a confirmed diagnosis.</p></div>
        {record.farmerSymptoms.length ? <div className="flex flex-wrap gap-2 pl-1 sm:pl-8">{record.farmerSymptoms.map((symptom) => <Badge key={symptom} className="border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-bold text-rose-900">{symptom}</Badge>)}</div> : <p className="pl-1 text-sm text-slate-600 sm:pl-8">{record.farmerDescription || record.name || "No health concerns were recorded."}</p>}
        <p className="pl-1 text-xs text-slate-500 sm:pl-8">Reported {record.reportedDate} · {record.reportedCount} head{record.reportedCount === 1 ? "" : "s"}</p>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck className="size-6 text-blue-700" />3. Field Inspection</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2.5">
            <p className="flex items-center gap-2 text-sm text-slate-800"><CheckCircle2 className={`size-5 ${inspection?.tagConfirmed ? "text-emerald-600" : "text-slate-400"}`} />Ear tag {inspection?.tagConfirmed ? "checked and verified" : "not verified"}.</p>
            <p className="flex items-center gap-2 text-sm text-slate-800"><CheckCircle2 className={`size-5 ${inspection?.countConfirmed ? "text-emerald-600" : "text-slate-400"}`} />Physical count {inspection?.countConfirmed ? `checked (${inspection.confirmedCount} head${inspection.confirmedCount === 1 ? "" : "s"})` : "not verified"}.</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-600">Body Temperature</p><p className="font-bold text-slate-900">{inspection?.temperatureCelsius ? `${inspection.temperatureCelsius} °C` : "Not recorded"}</p></div>
          </div>
          <div className="space-y-2.5 border-slate-200 lg:border-l lg:pl-4">
            <h4 className="font-bold text-slate-900">Field Observations</h4>
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{inspection?.remarks || "No field observations recorded."}</p>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950"><AlertTriangle className="mr-1 inline size-4" />Severity: {severity}</span>
              <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950"><ShieldCheck className="mr-1 inline size-4" />Biosecurity Action: {biosecurity}</span>
              {inspection?.fmdAssessment === "SUSPECTED" && (
                <span className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-rose-950"><ShieldAlert className="mr-1 inline size-4 text-rose-700" />Suspected FMD Flagged</span>
              )}
            </div>
          </div>
        </div>
        {photoUrl ? (
          <div className="grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-[220px_minmax(0,1fr)]">
            <button type="button" onClick={onOpenPhoto} className="h-32 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-28"><img src={photoUrl} alt={`Inspection photo for ${record.livestockTag}`} className="size-full object-cover" /></button>
            <div className="flex flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 p-3"><h4 className="font-bold text-slate-900">Inspection Photo</h4><p className="text-sm text-slate-600">Photo taken during the on-farm inspection.</p><Button type="button" variant="outline" onClick={onOpenPhoto} className="mt-2 w-fit border-sky-200 text-sky-800"><ExternalLink className="mr-2 size-4" />View Full Photo</Button></div>
          </div>
        ) : null}
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ClipboardCheck className="size-6 text-blue-700" />4. Follow-up & Case Status</h3>
        <Badge className="border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-950"><Clock className="mr-1.5 size-4" />{isApproved ? "Awaiting Case Resolution" : isForwarded ? "Awaiting MAO Decision" : "Awaiting Field Inspection"}</Badge>
        {isForwarded ? (
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-900">Follow-up and case resolution</h4>
            <p className="text-sm text-slate-700">No case resolution recorded yet. Follow-up records and the final outcome will appear here after MAO review.</p>
          </div>
        ) : isApproved ? (
          <>
            <p className="text-sm text-slate-700">The report is approved. The case outcome can be recorded separately.</p>
            <DiseaseCaseFollowUp key={record.id} caseId={record.id} />
          </>
        ) : (
          <p className="text-sm text-slate-700">Case follow-up becomes available after the report is reviewed.</p>
        )}
      </section>

      <details className="group rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 font-bold text-slate-900 [&::-webkit-details-marker]:hidden"><Calendar className="size-6 text-blue-800" /><span className="flex-1">Inspection History<small className="block font-normal text-slate-600">View remarks and updates</small></span><span aria-hidden="true" className="text-xl text-slate-500 transition-transform group-open:rotate-180">⌄</span></summary>
        <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm text-slate-700">
          <p><strong>Inspected by:</strong> {inspection?.verifiedBy || "Not recorded"}</p>
          <p><strong>Inspection date:</strong> {inspection?.verifiedAt ? new Date(inspection.verifiedAt).toLocaleString() : "Not recorded"}</p>
          <p><strong>Remarks:</strong> {inspection?.remarks || "No inspection remarks recorded."}</p>
        </div>
      </details>

      <div className="flex justify-end pt-1">
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto min-h-10 justify-center">Close</Button>
      </div>
    </div>
  );
}

function MortalityReadOnlyDetails({
  record,
  photoUrl,
  onClose,
  onOpenPhoto,
}: {
  record: SibatValidationRecord;
  photoUrl: string;
  onClose: () => void;
  onOpenPhoto: () => void;
}) {
  const isApproved = record.status === "APPROVED";
  const isForwarded = record.status === "VERIFIED";
  const inspection = record.inspection;
  const biosecurityLabels: Record<BiosecurityAction, string> = {
    NONE: "No additional action",
    PEN_ISOLATION: "Temporary Pen Isolation (7 Days)",
    TREATMENT_PRESCRIBED: "Supportive Treatment Prescribed",
    BIOSECURE_BURIAL: "Biosecure Deep Pit Burial & Lime",
    LAB_SAMPLE_SENT: "Sample Sent to Laboratory",
    CARCASS_SECURED: "Carcass secured pending guidance",
    AREA_DISINFECTED: "Area and equipment disinfected",
    VETERINARY_ESCALATION: "Referred to veterinarian / MAO",
  };
  const biosecurity = inspection?.biosecurityAction ? biosecurityLabels[inspection.biosecurityAction] : "Not recorded";
  const statusLabel = isApproved ? "MAO Approved" : isForwarded ? "Under MAO Review" : "Reviewed";

  return (
    <div className="w-full min-w-0 max-w-full space-y-3 overflow-x-hidden bg-slate-50 p-2.5 sm:space-y-4 sm:p-5">
      <p id="sibat-inspection-description" className="sr-only">Reported mortality information, field inspection findings, and review status.</p>
      <Button type="button" variant="ghost" onClick={onClose} className="h-8 gap-2 px-2 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-200">
        <ArrowLeft className="size-4" /> Back to Mortality Reports
      </Button>

      <header className="flex flex-col gap-3 rounded-xl bg-gradient-to-r from-[#12365f] to-[#1e4e80] p-3.5 pr-10 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:px-6 sm:pr-14">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="grid size-11 sm:size-16 shrink-0 place-items-center rounded-full bg-rose-500/30 text-white">
            <Skull className="size-6 sm:size-8" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-blue-100">Mortality Report · {record.id}</p>
            <DialogTitle className="mt-0.5 text-base sm:text-xl md:text-2xl font-black leading-tight text-white break-words">Field Inspection Details</DialogTitle>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-blue-100">
              <span><strong>Farmer:</strong> {record.farmerName}</span>
              <span className="hidden sm:inline">|</span>
              <span><strong>Barangay:</strong> {record.barangayName}</span>
            </div>
          </div>
        </div>
        <Badge className="w-fit shrink-0 border border-amber-300 bg-amber-50 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-amber-950">
          <Clock className="mr-1.5 size-3.5 sm:size-4" />{statusLabel}
        </Badge>
      </header>

      <section className={`flex items-center gap-3 rounded-xl border p-3 sm:p-3.5 sm:px-5 ${isApproved ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-sky-200 bg-sky-50 text-sky-950"}`}>
        <span className={`grid size-10 sm:size-12 shrink-0 place-items-center rounded-full ${isApproved ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}><ShieldCheck className="size-6 sm:size-7" /></span>
        <div className="min-w-0"><h3 className="text-xs sm:text-base font-bold">{isApproved ? "MAO Review Completed" : "Field Inspection Completed"}</h3><p className={`text-xs sm:text-sm leading-relaxed ${isApproved ? "text-emerald-900" : "text-sky-900"}`}>{isApproved ? "The mortality report was approved by MAO." : "A field reviewer checked this mortality report and sent it to the MAO for review."}</p></div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5">
        <h3 className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900"><User className="size-5 sm:size-6 text-blue-700 shrink-0" />1. Animal &amp; Farmer Information</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 sm:gap-2.5">
          {[
            { label: "Ear Tag Number", value: record.livestockTag || "Not recorded", icon: <Tag className="size-5 sm:size-6" /> },
            { label: "Animal / Species", value: `${record.livestockType || "Livestock"}${record.livestockBreed ? ` (${record.livestockBreed})` : ""}`, icon: <Beef className="size-5 sm:size-6" /> },
            { label: "Farmer", value: record.farmerName || "Registered Farmer", icon: <User className="size-5 sm:size-6" /> },
            { label: "Barangay", value: record.barangayName || "Not recorded", icon: <MapPin className="size-5 sm:size-6" /> },
          ].map((item) => (
            <div key={item.label} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
              <span className="shrink-0 text-blue-700">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs font-semibold text-slate-500">{item.label}</p>
                <p className="font-bold text-slate-900 text-xs sm:text-sm break-words">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5">
        <div><h3 className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900"><Skull className="size-5 sm:size-6 text-rose-700 shrink-0" />2. Reported Mortality</h3><p className="ml-7 sm:ml-8 text-xs sm:text-sm text-slate-600">Reported by the farmer — the cause has not been independently diagnosed.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="text-[10px] sm:text-xs font-semibold text-rose-700 uppercase">Reported Cause of Death</p><p className="font-bold text-slate-900 text-xs sm:text-sm break-words">{record.name || "Not recorded"}</p></div>
          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase">Reported Dead Count</p><p className="font-bold text-slate-900 text-xs sm:text-sm">{record.reportedCount} head{record.reportedCount === 1 ? "" : "s"}</p></div>
        </div>
        <p className="text-xs sm:text-sm italic text-slate-700">“{record.farmerDescription || "No additional statement provided."}”</p>
        <p className="text-[11px] sm:text-xs text-slate-500">Reported {record.reportedDate}</p>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck className="size-6 text-blue-700" />3. Field Inspection</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2.5">
            <p className="flex items-center gap-2 text-sm text-slate-800"><CheckCircle2 className={`size-5 ${inspection?.tagConfirmed ? "text-emerald-600" : "text-slate-400"}`} />Ear tag {inspection?.tagConfirmed ? "checked and verified" : "not verified"}.</p>
            <p className="flex items-center gap-2 text-sm text-slate-800"><CheckCircle2 className={`size-5 ${inspection?.countConfirmed ? "text-emerald-600" : "text-slate-400"}`} />Physical count {inspection?.countConfirmed ? `checked (${inspection.confirmedCount} head${inspection.confirmedCount === 1 ? "" : "s"})` : "not verified"}.</p>
          </div>
          <div className="space-y-2.5 border-slate-200 lg:border-l lg:pl-4">
            <h4 className="font-bold text-slate-900">Field Observations</h4>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Signs observed before death</p>
              <p className="text-sm text-slate-800">{inspection?.confirmedSymptoms?.length ? inspection.confirmedSymptoms.join(", ") : "None recorded"}</p>
            </div>
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{inspection?.remarks || "No field observations recorded."}</p>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950"><ShieldCheck className="mr-1 inline size-4" />Biosecurity Action: {biosecurity}</span>
            </div>
          </div>
        </div>
        {photoUrl ? (
          <div className="grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-[220px_minmax(0,1fr)]">
            <button type="button" onClick={onOpenPhoto} className="h-32 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-28"><img src={photoUrl} alt={`Mortality report photo for ${record.livestockTag}`} className="size-full object-cover" /></button>
            <div className="flex flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 p-3"><h4 className="font-bold text-slate-900">Report / Inspection Photo</h4><p className="text-sm text-slate-600">Photo evidence attached to this mortality report.</p><Button type="button" variant="outline" onClick={onOpenPhoto} className="mt-2 w-fit border-sky-200 text-sky-800"><ExternalLink className="mr-2 size-4" />View Full Photo</Button></div>
          </div>
        ) : null}
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ClipboardCheck className="size-6 text-blue-700" />4. Review Status</h3>
        <Badge className="border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-950"><Clock className="mr-1.5 size-4" />{isApproved ? "MAO Approved" : "Awaiting MAO Decision"}</Badge>
        <p className="text-sm text-slate-700">{isApproved ? "The mortality report has completed review." : "The field inspection was forwarded to the MAO for final review."}</p>
      </section>

      <details className="group rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 font-bold text-slate-900 [&::-webkit-details-marker]:hidden"><Calendar className="size-6 text-blue-800" /><span className="flex-1">Inspection History<small className="block font-normal text-slate-600">View remarks and updates</small></span><span aria-hidden="true" className="text-xl text-slate-500 transition-transform group-open:rotate-180">⌄</span></summary>
        <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm text-slate-700">
          <p><strong>Inspected by:</strong> {inspection?.verifiedBy || "Not recorded"}</p>
          <p><strong>Inspection date:</strong> {inspection?.verifiedAt ? new Date(inspection.verifiedAt).toLocaleString() : "Not recorded"}</p>
          <p><strong>Remarks:</strong> {inspection?.remarks || "No inspection remarks recorded."}</p>
        </div>
      </details>

      <div className="flex justify-end pt-1">
        <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto min-h-10 justify-center">Close</Button>
      </div>
    </div>
  );
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

const SIBAT_DISEASE_PRESETS = [
  "Physical inspection conducted on-farm. Ear tag & animal verified. Mild symptoms confirmed; isolated for observation.",
  "Clinical signs match farmer report. Administered supportive electrolytes and prescribed isolation protocol.",
  "Mouth & hoof vesicles with salivation observed. Suspected Foot and Mouth Disease (FMD) recorded; pen isolation enforced pending MAO review.",
  "Confirmed symptoms of respiratory distress. Advised farmer on shelter ventilation and temporary herd separation.",
  "Discrepancy in recorded ear tag or physical symptoms upon inspection. Requires veterinary re-audit.",
];

const SIBAT_MORTALITY_PRESETS = [
  "Mortality verified on site. Carcass disinfected with lime and deep pit burial (2m) completed under SIBAT supervision.",
  "Death caused by severe birth complications. No signs of transmissible infectious disease.",
  "Discrepancy in recorded ear tag or animal identity. Requires re-audit.",
];

const SIBAT_VERIFIED_PRESETS = SIBAT_DISEASE_PRESETS;

const BIOSECURITY_LABELS: Record<string, string> = {
  NONE: "No additional action",
  PEN_ISOLATION: "Temporary Pen Isolation (7 Days)",
  TREATMENT_PRESCRIBED: "Supportive Treatment Prescribed",
  BIOSECURE_BURIAL: "Biosecure Deep Pit Burial & Lime",
  LAB_SAMPLE_SENT: "Sample Sent to Laboratory",
  CARCASS_SECURED: "Carcass secured pending guidance",
  AREA_DISINFECTED: "Area and equipment disinfected",
  VETERINARY_ESCALATION: "Referred to veterinarian / MAO",
};

const SEVERITY_LABELS: Record<string, string> = {
  MILD: "Mild (Monitoring Required)",
  MODERATE: "Moderate (Treatment Needed)",
  SEVERE: "Severe (Urgent Intervention)",
  CRITICAL: "Critical / Fatal",
};

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
  /** Optional read-only presentation for callers without review controls. */
  readOnly?: boolean;
}

export function SibatInspectionDialog(props: SibatInspectionDialogProps) {
  return <SibatInspectionDialogContent key={`${props.open}:${props.record?.id}`} {...props} />;
}

function SibatInspectionDialogContent({
  record,
  open,
  onOpenChange,
  onConfirmInspection,
  isSubmitting = false,
  readOnly = false,
}: SibatInspectionDialogProps) {
  const { user } = useAuth();
  const [tagConfirmed, setTagConfirmed] = useState<boolean>(record?.inspection?.tagConfirmed ?? false);
  const [countConfirmed, setCountConfirmed] = useState<boolean>(record?.inspection?.countConfirmed ?? false);
  const [confirmedSymptoms, setConfirmedSymptoms] = useState<string[]>(record?.inspection?.confirmedSymptoms ?? []);
  const [fmdAssessment, setFmdAssessment] = useState<"SUSPECTED" | "">(record?.inspection?.fmdAssessment ?? "");
  const [severity, setSeverity] = useState<SeverityLevel | "">(record?.inspection?.severity ?? "");
  const [biosecurityAction, setBiosecurityAction] = useState<BiosecurityAction | "">(record?.inspection?.biosecurityAction ?? "");
  const [temperature, setTemperature] = useState<string>(record?.inspection?.temperatureCelsius ? String(record.inspection.temperatureCelsius) : "");
  const [inspectorRemarks, setInspectorRemarks] = useState<string>(record?.inspection?.remarks ?? "");
  const [isPhotoLightboxOpen, setIsPhotoLightboxOpen] = useState<boolean>(false);
  const [inspectorPhotoUrl, setInspectorPhotoUrl] = useState<string>(record?.inspection?.inspectorPhotoUrl ?? "");
  const [inspectorPhotoName, setInspectorPhotoName] = useState<string>("");
  const [inspectorPhotoFile, setInspectorPhotoFile] = useState<File | null>(null);
  const [confirmationAction, setConfirmationAction] = useState<"VERIFIED" | "FLAGGED" | null>(null);
  const [validationError, setValidationError] = useState("");
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const dialogContentRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    dialogContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  // Resolves the list of distinct affected heads from the incident record
  const heads = React.useMemo<AffectedAnimalItem[]>(() => {
    if (!record) return [];
    if (record.affectedAnimals && record.affectedAnimals.length > 0) {
      return record.affectedAnimals;
    }
    if (record.livestockTag && record.livestockTag.includes(",")) {
      return record.livestockTag.split(",").map((t, idx) => ({
        id: idx + 1,
        tagNumber: t.trim(),
        breed: record.livestockBreed,
        livestockTypeName: record.livestockType,
      }));
    }
    if (record.reportedCount > 1) {
      return Array.from({ length: record.reportedCount }, (_, idx) => ({
        id: idx + 1,
        tagNumber: idx === 0 ? record.livestockTag : `${record.livestockTag}-${idx + 1}`,
        breed: record.livestockBreed,
        livestockTypeName: record.livestockType,
      }));
    }
    return [{ id: 1, tagNumber: record.livestockTag, breed: record.livestockBreed, livestockTypeName: record.livestockType }];
  }, [record]);

  // Per-head diagnosis state: 'ALL' means shared/batch view, or a specific tagNumber for individual head
  const [selectedHeadTag, setSelectedHeadTag] = useState<string>("ALL");
  const [headDiagnoses, setHeadDiagnoses] = useState<Record<string, HeadDiagnosis>>(() => Object.fromEntries(heads.map(head => [head.tagNumber, { tagNumber: head.tagNumber, confirmedSymptoms: [...(record?.inspection?.confirmedSymptoms ?? [])], temperature: record?.inspection?.temperatureCelsius ? String(record.inspection.temperatureCelsius) : "" }])));

  // Synchronize current findings across all affected heads
  const handleSyncToAll = () => {
    if (isReadOnly) return;
    const sourceSymptoms = selectedHeadTag === "ALL"
      ? confirmedSymptoms
      : (headDiagnoses[selectedHeadTag]?.confirmedSymptoms ?? confirmedSymptoms);
    const sourceTemp = selectedHeadTag === "ALL"
      ? temperature
      : (headDiagnoses[selectedHeadTag]?.temperature ?? temperature);

    const updated: Record<string, HeadDiagnosis> = {};
    heads.forEach((h) => {
      updated[h.tagNumber] = {
        tagNumber: h.tagNumber,
        confirmedSymptoms: [...sourceSymptoms],
        temperature: sourceTemp,
      };
    });
    setHeadDiagnoses(updated);
    setConfirmedSymptoms([...sourceSymptoms]);
    if (sourceTemp) setTemperature(sourceTemp);

    toast.success(`Synchronized symptoms across all ${heads.length} heads!`, {
      description: sourceSymptoms.length > 0
        ? `Applied ${sourceSymptoms.length} signs (${sourceSymptoms.slice(0, 2).join(", ")}${sourceSymptoms.length > 2 ? "..." : ""}) to all animals.`
        : "Synchronized clean baseline across all animals.",
    });
  };

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
            uploaderRole: user?.role === "CBAT" ? "CBAT" : "SIBAT",
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!record) return null;

  const isMortality = record.reportType === "MORTALITY";
  const isDisease = record.reportType === "DISEASE";
  const normStatus = (record.status || "PENDING").toUpperCase();
  const isPending =
    normStatus === "PENDING" ||
    normStatus === "FLAGGED" ||
    normStatus === "SUBJECT_TO_REVISION" ||
    normStatus === "SUBJECT_FOR_REVISION";
  const isReadOnly = readOnly || !isPending;
  const isApproved = normStatus === "APPROVED";
  const isVerified = normStatus === "VERIFIED";
  const isRevision = normStatus === "SUBJECT_FOR_REVISION" || normStatus === "SUBJECT_TO_REVISION";
  const isPendingMortality = isMortality && normStatus === "PENDING" && !readOnly;
  const isPendingDisease = isDisease && normStatus === "PENDING" && !readOnly;
  const isPendingVerification = (isMortality || isDisease) && normStatus === "PENDING" && !readOnly;

  const reviewerRoleName = (() => {
    const roleFromRecord = record.reviewedByRole?.toUpperCase();
    if (roleFromRecord === "CBAT" || roleFromRecord === "SIBAT" || roleFromRecord === "MAO") {
      return roleFromRecord;
    }
    const currentRole = user?.role?.toUpperCase();
    if (currentRole === "CBAT") return "CBAT";
    if (currentRole === "SIBAT") return "SIBAT";
    return "CBAT";
  })();

  // Active symptoms & temperature depending on whether 'ALL' or a specific head is selected
  const activeSymptoms = selectedHeadTag === "ALL"
    ? confirmedSymptoms
    : (headDiagnoses[selectedHeadTag]?.confirmedSymptoms ?? []);

  const farmerReportedSigns = [
    ...(record.farmerSymptoms || []),
    record.name,
    record.farmerDescription,
  ].filter(Boolean) as string[];

  const combinedSigns = Array.from(new Set([
    ...farmerReportedSigns,
    ...activeSymptoms,
  ]));

  const fmdEvaluation = !isDisease
    ? {
        hasPossibleFmd: false,
        isHighSuspicion: false,
        matchedSigns: [],
        indicatorType: "NONE" as const,
        summaryTagalog: "",
        summaryEnglish: "",
        checklistToInspect: [],
      }
    : evaluateFmdSigns(combinedSigns);

  const farmerHasFmdSigns = isDisease && evaluateFmdSigns(farmerReportedSigns).hasPossibleFmd;
  const inspectorHasFmdSigns = isDisease && evaluateFmdSigns(activeSymptoms).hasPossibleFmd;
  const hasAnyFmdSigns = fmdEvaluation.hasPossibleFmd;

  const handleToggleFmdAssessment = (isSuspected: boolean) => {
    if (isReadOnly) return;
    if (isSuspected) {
      setFmdAssessment("SUSPECTED");
      if (!biosecurityAction || biosecurityAction === "NONE") {
        setBiosecurityAction("PEN_ISOLATION");
      }
    } else {
      setFmdAssessment("");
    }
  };

  const applyFmdPresetAndProtocol = () => {
    if (isReadOnly) return;
    setFmdAssessment("SUSPECTED");
    setBiosecurityAction("PEN_ISOLATION");
    if (!severity || severity === "MILD") {
      setSeverity("SEVERE");
    }
    const fmdRemark = "Mouth & hoof vesicles with salivation observed. Suspected Foot and Mouth Disease (FMD) recorded; pen isolation enforced pending MAO review.";
    setInspectorRemarks(fmdRemark);
    toast.success("FMD Biosecurity Protocol Applied", {
      description: "Pen Isolation (7 days), Severe severity rating, and standard quarantine remarks configured.",
    });
  };

  const activeTemperature = selectedHeadTag === "ALL"
    ? temperature
    : (headDiagnoses[selectedHeadTag]?.temperature ?? temperature);

  const toggleSymptom = (label: string) => {
    if (isReadOnly) return;
    if (selectedHeadTag === "ALL") {
      setConfirmedSymptoms((prev) => {
        const next = prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label];
        // Keep individual heads updated with shared batch state
        setHeadDiagnoses((currentMap) => {
          const newMap = { ...currentMap };
          heads.forEach((h) => {
            newMap[h.tagNumber] = {
              ...(newMap[h.tagNumber] || { tagNumber: h.tagNumber }),
              confirmedSymptoms: [...next],
            };
          });
          return newMap;
        });
        return next;
      });
    } else {
      setHeadDiagnoses((prev) => {
        const currentHead = prev[selectedHeadTag] || { tagNumber: selectedHeadTag, confirmedSymptoms: [] };
        const currentSigns = currentHead.confirmedSymptoms || [];
        const nextSigns = currentSigns.includes(label)
          ? currentSigns.filter((s) => s !== label)
          : [...currentSigns, label];
        return {
          ...prev,
          [selectedHeadTag]: {
            ...currentHead,
            confirmedSymptoms: nextSigns,
          },
        };
      });
    }
  };

  const handleTemperatureChange = (val: string) => {
    if (isReadOnly) return;
    if (selectedHeadTag === "ALL") {
      setTemperature(val);
      setHeadDiagnoses((prev) => {
        const newMap = { ...prev };
        heads.forEach((h) => {
          newMap[h.tagNumber] = {
            ...(newMap[h.tagNumber] || { tagNumber: h.tagNumber, confirmedSymptoms: [] }),
            temperature: val,
          };
        });
        return newMap;
      });
    } else {
      setHeadDiagnoses((prev) => ({
        ...prev,
        [selectedHeadTag]: {
          ...(prev[selectedHeadTag] || { tagNumber: selectedHeadTag, confirmedSymptoms: [] }),
          temperature: val,
        },
      }));
    }
  };

  const handleAction = (status: "VERIFIED" | "FLAGGED") => {
    if (isReadOnly) return;
    if (status === "VERIFIED" && (!tagConfirmed || !countConfirmed)) {
      setValidationError("Confirm the physical tag and on-site count before sending this record to MAO.");
      return;
    }
    if (status === "VERIFIED" && !inspectorRemarks.trim()) {
      setValidationError("Field verification remarks are required. Please input your inspection findings.");
      return;
    }
    setValidationError("");
    setConfirmationAction(status);
  };

  const confirmAction = () => {
    if (!confirmationAction || isSubmitting || isReadOnly) return;
    const status = confirmationAction;
    const nowIso = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Check if any individual head has different clinical signs than the batch
    const hasPerHeadOverrides = heads.length > 1 && heads.some((h) => {
      const hSigns = headDiagnoses[h.tagNumber]?.confirmedSymptoms ?? [];
      return hSigns.slice().sort().join(",") !== confirmedSymptoms.slice().sort().join(",");
    });

    let finalRemarks = inspectorRemarks.trim();
    if (hasPerHeadOverrides) {
      const breakdown = heads
        .map((h) => {
          const d = headDiagnoses[h.tagNumber];
          const signs = d?.confirmedSymptoms?.length ? d.confirmedSymptoms.join(", ") : "None";
          const temp = !isMortality && d?.temperature ? ` (${d.temperature}°C)` : "";
          return `[${h.tagNumber}: ${signs}${temp}]`;
        })
        .join(" ");
      finalRemarks = finalRemarks
        ? `${finalRemarks} — Individual findings: ${breakdown}`
        : `On-farm inspection completed. Individual findings: ${breakdown}`;
    }

    const inspectionData: SibatInspectionData = {
      verifiedBy: "Signed-in SIBAT account",
      verifiedAt: nowIso,
      tagConfirmed,
      countConfirmed,
      confirmedCount: record.reportedCount ?? 1,
      confirmedSymptoms,
      fmdAssessment: isDisease ? fmdAssessment : "",
      severity: isMortality ? "" : severity,
      biosecurityAction,
      remarks:
        finalRemarks ||
        (status === "VERIFIED"
          ? "On-farm physical inspection completed and certified by SIBAT field officer."
          : status === "FLAGGED"
            ? "Returned for Veterinary follow-up / diagnostic testing."
            : "Marked as false alarm upon physical examination."),
      temperatureCelsius: !isMortality && temperature ? parseFloat(temperature) : undefined,
      inspectorPhotoFile: inspectorPhotoFile || undefined,
      inspectorPhotoUrl: inspectorPhotoUrl || undefined,
    };

    onConfirmInspection(record.id, status, inspectionData);
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
      <DialogContent
        ref={dialogContentRef}
        aria-describedby="sibat-inspection-description"
        className={isReadOnly
          ? `max-h-[95dvh] sm:max-h-[92vh] ${MORTALITY_DIALOG_WIDTH} overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl`
          : `max-h-[95dvh] sm:max-h-[92vh] ${MORTALITY_DIALOG_WIDTH} overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl sm:p-6 lg:p-8`}
      >
        {isDisease && isReadOnly ? (
          <DiseaseReadOnlyDetails
            record={record}
            photoUrl={lightboxPhotoUrl}
            onClose={() => onOpenChange(false)}
            onOpenPhoto={() => setIsPhotoLightboxOpen(true)}
          />
        ) : isMortality && isReadOnly ? (
          <MortalityReadOnlyDetails
            record={record}
            photoUrl={lightboxPhotoUrl}
            onClose={() => onOpenChange(false)}
            onOpenPhoto={() => setIsPhotoLightboxOpen(true)}
          />
        ) : (
        <>
        <p id="sibat-inspection-description" className="sr-only">Reported animal health details, original field inspection, and case follow-up history.</p>

        {/* ══ POPUP HEADER ══ */}
        {isPendingVerification ? (
          <header className="mb-3 flex flex-col gap-3 rounded-xl bg-gradient-to-r from-[#12365f] to-[#35618e] p-3 pr-10 text-white shadow-sm sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:pr-14">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid size-11 sm:size-12 shrink-0 place-items-center rounded-full text-white ${isMortality ? "bg-rose-600" : "bg-sky-600"}`}>
                {isMortality ? <Skull className="size-5 sm:size-6" /> : <Stethoscope className="size-5 sm:size-6" />}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] font-bold uppercase tracking-wide text-blue-100 sm:text-xs">
                  <span>{isMortality ? "Mortality Report" : "Disease Report"}</span><span>#{record.id}</span>
                  <Badge className="border border-amber-200 bg-amber-100 text-amber-900 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0">Pending On-Farm Visit</Badge>
                </div>
                <DialogTitle className="mt-0.5 text-base sm:text-xl md:text-2xl font-extrabold leading-tight text-white break-words">
                  {isMortality ? "SIBAT Mortality Verification" : "SIBAT Disease Verification"}
                </DialogTitle>
                <p className="mt-0.5 text-xs text-blue-100 leading-snug sm:text-sm">
                  {isMortality
                    ? "Record signs observed before death, verify the animal and count, and document carcass biosecurity actions for MAO review."
                    : "Record clinically observed signs, verify the animal and count, and document biosecurity actions for MAO review."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t border-white/15 pt-2 text-[11px] text-blue-100 sm:border-0 sm:pt-0 sm:pr-2">
              <Calendar className="size-4 shrink-0 text-sky-200" />
              <span>Reported on <strong className="text-white">{record.reportedDate}</strong></span>
            </div>
          </header>
        ) : isRevision ? (
          <header className="mb-3 sm:mb-4 flex flex-col gap-3 rounded-xl bg-gradient-to-r from-[#12365f] to-[#245889] p-3 pr-10 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:pr-14">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid size-11 sm:size-12 shrink-0 place-items-center rounded-full text-white sm:size-13 ${isMortality ? "bg-rose-600" : "bg-sky-500"}`}>
                {isMortality ? <Skull className="size-5 sm:size-6 text-white" /> : <Stethoscope className="size-5 sm:size-6 text-white" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] font-black uppercase tracking-wide text-blue-100 sm:text-xs">
                  <span>{record.reportType} REPORT</span>
                  <span>#{record.id}</span>
                  <Badge className="border border-rose-300 bg-rose-100 font-bold text-rose-800 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0">
                    Subject for Revision
                  </Badge>
                </div>
                <DialogTitle className="mt-0.5 text-base sm:text-xl md:text-2xl font-extrabold leading-tight text-white break-words">
                  Field Examination – Revision
                </DialogTitle>
                <p className="mt-0.5 text-xs text-blue-100 leading-snug sm:text-sm">
                  Update the field findings based on {reviewerRoleName} feedback and resubmit.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t border-white/15 pt-2 text-[11px] text-blue-100 sm:border-0 sm:pt-0 sm:pr-2">
              <Calendar className="size-4 shrink-0 text-sky-200" />
              <span>Reported on <strong className="text-white">{record.reportedDate}</strong></span>
            </div>
          </header>
        ) : <DialogHeader className="mb-3 sm:mb-4 pr-10 sm:pr-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 pb-3 sm:pb-4">
            <div className="flex items-center gap-3 sm:gap-3.5">
              <div
                className={`size-11 sm:size-15 rounded-2xl flex items-center justify-center shrink-0 shadow-md text-white ${getHeaderBg()}`}
              >
                {getHeaderIcon()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase font-mono">
                    Incident #{record.id}
                  </span>
                  <Badge
                    className={`text-[9px] sm:text-[10px] font-black uppercase px-2 sm:px-2.5 py-0.5 rounded-full ${record.status === "VERIFIED"
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
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400">
                    • {record.reportType}
                  </span>
                </div>
                <DialogTitle className="text-base sm:text-2xl md:text-3xl font-black text-slate-900 leading-tight mt-1 break-words">
                  {isReadOnly
                    ? isApproved
                      ? isMortality
                        ? "Certified Mortality Record (MAO Approved)"
                        : "Certified Health Record (MAO Approved)"
                      : isVerified
                        ? "SIBAT Field Inspection (Under MAO Review)"
                        : `Field Inspection Record (${record.status})`
                    : isMortality
                      ? "Step 2: SIBAT Mortality Verification"
                      : isDisease
                        ? "Step 2: SIBAT On-Farm Health Examination"
                        : `Step 2: SIBAT Field Inspection (${record.reportType})`}
                </DialogTitle>
                <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5 leading-snug">
                  {isReadOnly
                    ? isApproved
                      ? "MAO approved the report. The original inspection is locked; disease follow-up and resolution are recorded separately below."
                      : "Field findings and inspection details submitted to the Municipal Agriculture Office."
                    : "Conduct on-farm physical checks, verify clinical signs, and certify records for MAO municipal approval."}
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
        </DialogHeader>}

        {isRevision ? (
          <section className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 sm:mb-5 sm:p-4 shadow-2xs">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-600 text-white shadow-xs">
                <AlertTriangle className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-extrabold text-rose-900">Needs Revision — Feedback from {reviewerRoleName}</h2>
                  <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] font-bold">
                    Action Required
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-rose-700 leading-relaxed">
                  The {reviewerRoleName} reviewed this report and requested corrections. Review the feedback below and update your findings.
                </p>

                <div className="mt-2.5 rounded-xl border border-rose-200 bg-white p-3 text-xs text-slate-800 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800 mb-1">
                    <ClipboardCheck className="size-4 text-rose-600" />
                    <span>{reviewerRoleName} Review Remarks:</span>
                  </div>
                  <p className="leading-relaxed text-slate-700 font-medium whitespace-pre-wrap">
                    {record.reviewRemarks || record.previousRemarks || record.maoApproval?.remarks || record.inspection?.remarks || `No ${reviewerRoleName} feedback details were attached to this revision.`}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* ══ STEP-BY-STEP WIZARD STEPPER BAR ══ */}
        <nav
          aria-label="Verification Wizard Steps"
          className="mb-3 sm:mb-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-2 sm:p-2.5 shadow-2xs"
        >
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            {/* Step 1 */}
            <li>
              <button
                type="button"
                onClick={() => {
                  setValidationError("");
                  setCurrentStep(1);
                }}
                className={`group flex w-full items-center gap-2.5 sm:gap-2 rounded-xl p-2 sm:p-2.5 text-left transition-all cursor-pointer ${
                  currentStep === 1
                    ? "bg-white border-2 border-sky-400 shadow-xs ring-2 ring-sky-100"
                    : "bg-white/60 hover:bg-white border border-slate-200/80"
                }`}
              >
                <span
                  className={`grid size-7 sm:size-8 shrink-0 place-items-center rounded-full text-xs font-black transition-colors ${
                    currentStep === 1
                      ? "bg-[#1A365D] text-white"
                      : currentStep > 1
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {currentStep > 1 ? <Check className="size-4 stroke-[3]" /> : "1"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 1</span>
                    {currentStep > 1 ? (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                        Completed
                      </span>
                    ) : currentStep === 1 ? (
                      <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded-full border border-sky-200 sm:hidden">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <p className={`text-xs font-black leading-snug ${currentStep === 1 ? "text-slate-900" : "text-slate-700"}`}>
                    Farmer &amp; Animal Information
                  </p>
                </div>
              </button>
            </li>

            {/* Step 2 */}
            <li>
              <button
                type="button"
                onClick={() => {
                  setValidationError("");
                  setCurrentStep(2);
                }}
                className={`group flex w-full items-center gap-2.5 sm:gap-2 rounded-xl p-2 sm:p-2.5 text-left transition-all cursor-pointer ${
                  currentStep === 2
                    ? "bg-white border-2 border-sky-400 shadow-xs ring-2 ring-sky-100"
                    : "bg-white/60 hover:bg-white border border-slate-200/80"
                }`}
              >
                <span
                  className={`grid size-7 sm:size-8 shrink-0 place-items-center rounded-full text-xs font-black transition-colors ${
                    currentStep === 2
                      ? "bg-[#1A365D] text-white"
                      : currentStep > 2
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {currentStep > 2 ? <Check className="size-4 stroke-[3]" /> : "2"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 2</span>
                    {currentStep > 2 ? (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                        Completed
                      </span>
                    ) : tagConfirmed && countConfirmed ? (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                        Verified
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-full border border-amber-200">
                        Checklist
                      </span>
                    )}
                    {currentStep === 2 && (
                      <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded-full border border-sky-200 sm:hidden">
                        Current
                      </span>
                    )}
                  </div>
                  <p className={`text-xs font-black leading-snug ${currentStep === 2 ? "text-slate-900" : "text-slate-700"}`}>
                    Field Verification
                  </p>
                </div>
              </button>
            </li>

            {/* Step 3 */}
            <li>
              <button
                type="button"
                onClick={() => {
                  setValidationError("");
                  setCurrentStep(3);
                }}
                className={`group flex w-full items-center gap-2.5 sm:gap-2 rounded-xl p-2 sm:p-2.5 text-left transition-all cursor-pointer ${
                  currentStep === 3
                    ? "bg-white border-2 border-sky-400 shadow-xs ring-2 ring-sky-100"
                    : "bg-white/60 hover:bg-white border border-slate-200/80"
                }`}
              >
                <span
                  className={`grid size-7 sm:size-8 shrink-0 place-items-center rounded-full text-xs font-black transition-colors ${
                    currentStep === 3
                      ? "bg-[#1A365D] text-white"
                      : tagConfirmed && countConfirmed
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-slate-200 text-slate-700"
                  }`}
                >
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step 3</span>
                    {tagConfirmed && countConfirmed && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                        Ready
                      </span>
                    )}
                    {currentStep === 3 && (
                      <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded-full border border-sky-200 sm:hidden">
                        Current
                      </span>
                    )}
                  </div>
                  <p className={`text-xs font-black leading-snug ${currentStep === 3 ? "text-slate-900" : "text-slate-700"}`}>
                    {isRevision ? "Review & Resubmit" : "Review & Submit"}
                  </p>
                </div>
              </button>
            </li>
          </ol>
        </nav>

        {isDisease && isReadOnly && <div className="mb-5"><DiseaseCaseFollowUp key={record.id} caseId={record.id} /></div>}

        {/* ══ STEP 1: FARMER & ANIMAL INFORMATION ══ */}
        {currentStep === 1 && (
          <div className="space-y-3 sm:space-y-4 animate-in fade-in-50 duration-200">
            <div className="rounded-2xl border border-blue-100 bg-white p-3 sm:p-4 shadow-2xs space-y-3 sm:space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-blue-50 pb-2.5">
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-700">
                  <span className="grid size-6 sm:size-7 place-items-center rounded-full bg-sky-500 text-xs sm:text-sm font-black text-white shrink-0">1</span>
                  <span>
                    Farmer &amp; Animal Information
                    <small className="mt-0.5 block font-medium normal-case tracking-normal text-slate-500">
                      Review the raiser&apos;s reported details, signs, and attached photos.
                    </small>
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-slate-500">
                  <Calendar className="size-3.5 text-slate-400 shrink-0" />
                  Reported: {record.reportedDate}
                </span>
              </div>

              {/* Raiser & Animal 4-Pill Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs xl:grid-cols-4 sm:gap-2.5">
                <div className="min-w-0 p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Tag Number</span>
                  <span className="font-black text-slate-900 text-xs sm:text-base break-words block">
                    {record.livestockTag}
                  </span>
                </div>
                <div className="min-w-0 p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Breed / Species</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm break-words block">
                    {record.livestockBreed} ({record.livestockType})
                  </span>
                </div>
                <div className="min-w-0 p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Raiser / Farmer</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm truncate block">
                    {record.farmerName}
                  </span>
                  {record.farmerContact && (
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                      {record.farmerContact}
                    </span>
                  )}
                </div>
                <div className="min-w-0 p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Location</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm break-words block">
                    {record.barangayName} {record.purok ? `(${record.purok})` : ""}
                  </span>
                </div>
              </div>

              {/* Condition / Incident Details */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-3.5 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    {isMortality ? "Reported Mortality Cause" : "Reported Health Condition"}
                  </span>
                  <span className="font-black text-slate-900 text-xs sm:text-base break-words block">
                    {record.name}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    {isMortality ? "Reported Dead Count" : "Reported Affected Count"}
                  </span>
                  <span
                    className={`font-black text-xs sm:text-base ${isMortality ? "text-rose-700" : "text-[#1A365D]"}`}
                  >
                    {record.reportedCount} Head{record.reportedCount > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Farmer Initial Statement */}
              <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <span className="text-[10px] font-black text-slate-400 uppercase block">
                  Farmer&apos;s Initial Statement:
                </span>
                <p className="text-slate-700 italic leading-relaxed text-xs sm:text-sm">
                  &quot;{record.farmerDescription}&quot;
                </p>
              </div>

              {/* Farmer Reported Symptoms */}
              {record.farmerSymptoms && record.farmerSymptoms.length > 0 && (
                <div className="min-w-0 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase block">
                    Signs Reported by Farmer:
                  </span>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {record.farmerSymptoms.map((sym, idx) => (
                      <Badge
                        key={idx}
                        className="max-w-full min-w-0 whitespace-normal break-words text-left leading-relaxed bg-white text-slate-700 border border-slate-200 font-bold text-xs py-0.5 px-2 rounded-lg"
                      >
                        {sym}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Farmer Attached Photo Evidence */}
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
                    <div className="space-y-2.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
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
                    </div>
                  );
                }

                return (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-2xs">
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
                      className="relative group overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 aspect-16/9 sm:aspect-21/9 cursor-pointer shadow-sm"
                      onClick={() => setIsPhotoLightboxOpen(true)}
                    >
                      <img
                        src={activePhotoUrl}
                        alt={`Photo of ${record.livestockTag} (${record.name})`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

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

                    <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap text-xs">
                      <button
                        type="button"
                        onClick={() => setIsPhotoLightboxOpen(true)}
                        className="text-xs font-bold text-[#1A365D] hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        <Maximize2 className="size-3.5 text-blue-600" />
                        <span>Enlarge & Examine Symptoms</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* FMD DIFFERENTIAL ALERT CARD (if Disease & Signs Present) */}
            {isDisease && fmdEvaluation.hasPossibleFmd && (
              <FmdSuspicionAlertCard
                evaluation={fmdEvaluation}
                fmdAssessment={fmdAssessment}
                onToggleFmdAssessment={handleToggleFmdAssessment}
                onApplyFmdProtocol={applyFmdPresetAndProtocol}
                isReadOnly={isReadOnly}
                isPending={isPendingDisease || isRevision}
              />
            )}

            {/* Wizard Step 1 Footer Controls */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 border-t border-slate-200 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto min-h-11 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 justify-center"
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-full sm:w-auto min-h-11 gap-2 rounded-xl bg-[#1A365D] font-bold text-white hover:bg-[#132742] justify-center"
              >
                <span className="hidden sm:inline">Continue to Field Verification</span>
                <span className="sm:hidden">Next: Field Verification</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ══ STEP 2: FIELD VERIFICATION ══ */}
        {currentStep === 2 && (
          <div className="space-y-3 sm:space-y-4 animate-in fade-in-50 duration-200">
            <div className="space-y-3 sm:space-y-3.5 rounded-2xl border border-blue-100 bg-white p-3 sm:p-5 shadow-2xs">
              <div className="flex items-start sm:items-center justify-between gap-2 border-b border-blue-50 pb-2.5">
                <div className="flex items-start sm:items-center gap-2 min-w-0">
                  <span className="grid size-6 sm:size-7 place-items-center rounded-full bg-sky-500 text-xs sm:text-sm font-black text-white shrink-0">2</span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {isRevision ? "Update Field Examination Details" : "Field Verification"}
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {isRevision
                        ? `Edit or add the missing information requested by the ${reviewerRoleName}.`
                        : isMortality
                          ? "Record signs reported before death, verify ear tag and physical count, and document carcass disposal actions."
                          : "Verify physical ear tag and count on-site, record clinical signs, body temperature, and biosecurity actions."}
                    </p>
                  </div>
                </div>
                <Badge className="shrink-0 bg-sky-100 text-sky-800 border-sky-200 text-[10px] font-bold">
                  Step 2 of 3
                </Badge>
              </div>

              {/* Verification Checkboxes (Ear Tag & In-Person Count) */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className={`flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3 transition-all ${isReadOnly ? "cursor-default opacity-95" : "cursor-pointer hover:bg-sky-50"}`}>
                  <input
                    type="checkbox"
                    checked={tagConfirmed}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      if (isReadOnly) return;
                      setTagConfirmed(e.target.checked);
                      setValidationError("");
                    }}
                    className={`size-5 shrink-0 mt-0.5 rounded text-sky-700 focus:ring-sky-500 ${isReadOnly ? "cursor-default" : "cursor-pointer"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-black text-slate-900">
                      Physical Ear Tag Match Verified
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium break-words">
                      Confirmed reported ear tag{record.reportedCount === 1 ? "" : "s"}: {record.livestockTag}.
                    </p>
                  </div>
                </label>

                <label className={`flex min-h-12 items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3 ${isReadOnly ? "cursor-default opacity-95" : "cursor-pointer hover:bg-sky-50"}`}>
                  <input
                    type="checkbox"
                    checked={countConfirmed}
                    disabled={isReadOnly}
                    onChange={(event) => {
                      if (isReadOnly) return;
                      setCountConfirmed(event.target.checked);
                      setValidationError("");
                    }}
                    className={`size-5 shrink-0 mt-0.5 rounded text-sky-700 focus:ring-sky-500 ${isReadOnly ? "cursor-default" : "cursor-pointer"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-black text-slate-900">
                      Physical Count Confirmed
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Verified count in person ({record.reportedCount} head{record.reportedCount > 1 ? "s" : ""}).
                    </p>
                  </div>
                </label>
              </div>

              {/* Temperature, Severity, Biosecurity Actions */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {!isMortality && (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                        <span>Body Temp (°C) {isReadOnly ? "" : "(Optional)"}:</span>
                        {selectedHeadTag !== "ALL" && (
                          <span className="text-[10px] text-sky-700 font-bold bg-sky-100/70 px-2 py-0.5 rounded-full">
                            #{selectedHeadTag}
                          </span>
                        )}
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={isReadOnly ? "Not recorded" : "e.g. 39.5"}
                        value={activeTemperature}
                        disabled={isReadOnly}
                        onChange={(e) => handleTemperatureChange(e.target.value)}
                        className="h-10 bg-white border-sky-200 rounded-xl text-xs font-bold disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-800">Severity Rating:</label>
                      <Select
                        value={severity || "NONE_SELECTED"}
                        onValueChange={(val) => setSeverity(val === "NONE_SELECTED" ? "" : (val as SeverityLevel))}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="h-10 w-full rounded-xl border-sky-200 bg-white text-xs font-bold text-slate-800">
                          <SelectValue placeholder="Choose severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE_SELECTED">Not assessed</SelectItem>
                          <SelectItem value="MILD">Mild (Monitoring Required)</SelectItem>
                          <SelectItem value="MODERATE">Moderate (Treatment Needed)</SelectItem>
                          <SelectItem value="SEVERE">Severe (Urgent Intervention)</SelectItem>
                          <SelectItem value="CRITICAL">Critical / Fatal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className={`space-y-1 ${isMortality ? "sm:col-span-2" : ""}`}>
                  <label className="text-xs font-black text-slate-800">
                    {isMortality ? "Carcass Biosecurity Action:" : "Biosecurity Action:"}
                  </label>
                  {isMortality ? (
                    <Select
                      value={biosecurityAction || "NONE_SELECTED"}
                      onValueChange={(value) => setBiosecurityAction(value === "NONE_SELECTED" ? "" : (value as BiosecurityAction))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-sky-200 bg-white text-xs font-bold text-slate-800">
                        <SelectValue placeholder="Choose a carcass biosecurity action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE_SELECTED">No action recorded</SelectItem>
                        <SelectItem value="NONE">No additional action</SelectItem>
                        <SelectItem value="CARCASS_SECURED">Carcass secured pending guidance</SelectItem>
                        <SelectItem value="AREA_DISINFECTED">Area and equipment disinfected</SelectItem>
                        <SelectItem value="BIOSECURE_BURIAL">Biosecure carcass disposal completed</SelectItem>
                        <SelectItem value="VETERINARY_ESCALATION">Referred to veterinarian / MAO</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={biosecurityAction || "NONE_SELECTED"}
                      onValueChange={(value) => setBiosecurityAction(value === "NONE_SELECTED" ? "" : (value as BiosecurityAction))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-sky-200 bg-white text-xs font-bold text-slate-800">
                        <SelectValue placeholder="Choose a biosecurity action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE_SELECTED">No action recorded</SelectItem>
                        <SelectItem value="NONE">None / General Advisory</SelectItem>
                        <SelectItem value="PEN_ISOLATION">Temporary Pen Isolation (7 Days)</SelectItem>
                        <SelectItem value="TREATMENT_PRESCRIBED">Supportive Treatment Prescribed</SelectItem>
                        <SelectItem value="BIOSECURE_BURIAL">Biosecure Deep Pit Burial & Lime</SelectItem>
                        <SelectItem value="LAB_SAMPLE_SENT">Blood/Tissue Sample Sent to Lab</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Multi-head Selector & Sync Controls */}
              {heads.length >= 2 && (
                <div className="space-y-2.5 rounded-xl border border-sky-200 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Tag className="size-3.5 text-sky-700" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                        {isMortality ? "Record Signs by Animal" : "Diagnose by Head"} ({heads.length} Animals)
                      </span>
                    </div>

                    {!isReadOnly && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSyncToAll}
                        className="h-7 px-2.5 rounded-lg text-xs font-bold text-sky-900 bg-sky-50 border-sky-300 hover:bg-sky-100 hover:text-sky-950 cursor-pointer shadow-2xs gap-1.5"
                        title={isMortality ? "Copy selected signs to all affected animals" : "Copy current symptoms and temperature to all affected heads"}
                      >
                        <Sparkles className="size-3 text-sky-600" />
                        Sync to All Heads
                      </Button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 leading-normal">
                    Select a head to diagnose individual clinical signs, or use <strong>All Heads</strong> to inspect collectively.
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedHeadTag("ALL")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        selectedHeadTag === "ALL"
                          ? "bg-[#1A365D] text-white border-[#1A365D] shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span>★ All Heads (Batch)</span>
                      <Badge className={`text-[10px] px-1.5 py-0 rounded-full font-black ${
                        selectedHeadTag === "ALL" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                      }`}>
                        {heads.length}
                      </Badge>
                    </button>

                    {heads.map((h, idx) => {
                      const isSelected = selectedHeadTag === h.tagNumber;
                      const hSigns = headDiagnoses[h.tagNumber]?.confirmedSymptoms ?? [];
                      return (
                        <button
                          key={h.tagNumber || idx}
                          type="button"
                          onClick={() => setSelectedHeadTag(h.tagNumber)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            isSelected
                              ? "bg-sky-600 text-white border-sky-700 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-300"
                          }`}
                        >
                          <span>{h.tagNumber}</span>
                          {hSigns.length > 0 && (
                            <Badge className={`text-[9.5px] px-1.5 py-0 rounded-full font-black ${
                              isSelected ? "bg-white text-sky-800" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                            }`}>
                              {hSigns.length} {hSigns.length === 1 ? "sign" : "signs"}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Clinically Observed Signs Checklist */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 block">
                    {isMortality ? "Signs Observed Before Death" : "Clinically Observed Signs"} {selectedHeadTag !== "ALL" ? `for Tag #${selectedHeadTag}` : isReadOnly ? "(Recorded)" : "(Click to toggle)"}:
                  </label>
                  {selectedHeadTag !== "ALL" && (
                    <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                      Editing Tag #{selectedHeadTag}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {CLINICAL_SYMPTOMS_LIST.map((sym) => {
                    const isSelected = activeSymptoms.includes(sym.label);
                    return (
                      <button
                        key={sym.id}
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => toggleSymptom(sym.label)}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                          isReadOnly ? "cursor-default" : "cursor-pointer"
                        } ${isSelected
                          ? "bg-[#1A365D] text-white border-[#1A365D] shadow-2xs"
                          : isReadOnly
                            ? "bg-slate-50/70 text-slate-400 border-slate-200"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                      >
                        <span className="font-bold text-xs mt-0.5">
                          {isSelected ? "✓" : "○"}
                        </span>
                        <div>
                          <p className={`text-xs font-black leading-tight ${isSelected ? "text-white" : isReadOnly ? "text-slate-500" : "text-slate-800"}`}>
                            {sym.label}
                          </p>
                          <p
                            className={`text-[10px] font-medium ${isSelected ? "text-blue-200" : isReadOnly ? "text-slate-400" : "text-slate-500"}`}
                          >
                            {sym.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {isDisease && hasAnyFmdSigns && (
                  <div
                    className={`rounded-xl border p-2.5 text-xs transition-all flex items-center justify-between gap-2 flex-wrap ${
                      fmdAssessment === "SUSPECTED"
                        ? "border-rose-300 bg-rose-50/90 text-rose-950"
                        : "border-amber-300 bg-amber-50/80 text-amber-950"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {fmdAssessment === "SUSPECTED" ? (
                        <ShieldAlert className="size-4 text-rose-700 shrink-0" />
                      ) : (
                        <AlertTriangle className="size-4 text-amber-700 shrink-0" />
                      )}
                      <span className="font-bold text-[11px]">
                        {fmdAssessment === "SUSPECTED"
                          ? "Kaso minarkahan bilang Suspected FMD (Aktibo ang Pen Isolation protocol para sa MAO review)"
                          : "Natukoy ang posibleng FMD pattern — Tingnan ang advisory para sa buong checklist"}
                      </span>
                    </div>

                    {!isReadOnly && isPendingDisease && (
                      <button
                        type="button"
                        onClick={() => handleToggleFmdAssessment(fmdAssessment !== "SUSPECTED")}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer shadow-2xs ${
                          fmdAssessment === "SUSPECTED"
                            ? "bg-rose-700 hover:bg-rose-800 text-white"
                            : "bg-amber-600 hover:bg-amber-700 text-white"
                        }`}
                      >
                        {fmdAssessment === "SUSPECTED" ? "Suspected FMD Active (Click to Unset)" : "Verify as Suspected FMD"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* SIBAT Inspection Photo upload & preview */}
              {!isReadOnly ? (
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
              ) : inspectorPhotoUrl ? (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-black text-slate-800 block">
                    SIBAT Field Inspection Photo:
                  </span>
                  <div
                    onClick={() => setIsPhotoLightboxOpen(true)}
                    className="relative rounded-2xl overflow-hidden border border-sky-300 bg-white p-2 flex items-center gap-3 shadow-2xs cursor-pointer hover:bg-sky-50/50 transition-colors"
                  >
                    <img
                      src={inspectorPhotoUrl}
                      alt="Inspection preview"
                      className="w-16 h-16 rounded-xl object-cover border border-sky-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <p className="font-bold text-slate-900 truncate">Field Inspection Documentation</p>
                      <p className="text-[11px] text-sky-700 font-semibold flex items-center gap-1 mt-0.5">
                        <ZoomIn className="size-3" /> Click to inspect fullscreen
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Inspector Remarks & Presets */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span>Field Verification Remarks:</span>
                    <span className="text-rose-600 font-black">*</span>
                    <span className="text-[10px] text-rose-600 font-semibold">(Required)</span>
                  </label>
                  {!isReadOnly && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                      <Sparkles className="size-3" /> Quick Presets
                    </div>
                  )}
                </div>

                <Textarea
                  placeholder={isReadOnly ? "No field remarks recorded." : "Enter detailed clinical findings, veterinarian advisory, prescription details, or carcass disposal notes..."}
                  value={inspectorRemarks}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    if (isReadOnly) return;
                    setInspectorRemarks(e.target.value);
                  }}
                  className="bg-white border-sky-200 rounded-2xl text-xs font-medium resize-none h-20 p-3 focus-visible:ring-2 focus-visible:ring-[#1A365D] disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed"
                />

                {!isReadOnly && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {(isMortality
                      ? SIBAT_MORTALITY_PRESETS
                      : SIBAT_DISEASE_PRESETS
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
                )}
              </div>
            </div>

            {/* Wizard Step 2 Footer Controls */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 border-t border-slate-200 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="w-full sm:w-auto min-h-11 gap-2 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 justify-center"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Back to Farmer &amp; Animal Info</span>
                <span className="sm:hidden">Back to Step 1</span>
              </Button>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                {(!tagConfirmed || !countConfirmed) && (
                  <span className="text-center text-[11px] sm:text-xs font-semibold text-amber-700">
                    Checklist pending confirmation
                  </span>
                )}
                <Button
                  type="button"
                  onClick={() => {
                    if (!inspectorRemarks.trim()) {
                      setValidationError("Field verification remarks are required. Please input your examination findings.");
                      return;
                    }
                    setValidationError("");
                    setCurrentStep(3);
                  }}
                  className="w-full sm:w-auto min-h-11 gap-2 rounded-xl bg-[#1A365D] font-bold text-white hover:bg-[#132742] justify-center"
                >
                  <span className="hidden sm:inline">Continue to Review &amp; Submit</span>
                  <span className="sm:hidden">Next: Review &amp; Submit</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 3: REVIEW & SUBMIT ══ */}
        {currentStep === 3 && (
          <div className="space-y-3 sm:space-y-4 animate-in fade-in-50 duration-200">
            {/* Step 3 Header */}
            <div className="flex items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-start sm:items-center gap-2 min-w-0">
                <span className="grid size-6 sm:size-7 place-items-center rounded-full bg-sky-500 text-xs sm:text-sm font-black text-white shrink-0">3</span>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {isRevision ? "Review & Resubmit" : "Review & Submit"}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {isRevision
                      ? "Make sure all required information is complete before sending to MAO."
                      : "Check your recorded information and certification checklist before transmitting to MAO."}
                  </p>
                </div>
              </div>
              <Badge className="shrink-0 bg-sky-100 text-sky-800 border-sky-200 text-[10px] font-bold">
                Step 3 of 3
              </Badge>
            </div>

            {/* Checklist Verification Readiness Status Banner */}
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border p-3 text-xs ${
              tagConfirmed && countConfirmed
                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                : "border-amber-300 bg-amber-50 text-amber-950"
            }`}>
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                {tagConfirmed && countConfirmed ? (
                  <CheckCircle2 className="size-5 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-5 text-amber-700 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="font-extrabold text-sm">
                    {tagConfirmed && countConfirmed
                      ? isRevision ? "Ready to Resubmit" : "Checklist Complete — Ready to Submit"
                      : "Verification Checklist Incomplete"}
                  </p>
                  <p className="mt-0.5 leading-relaxed text-xs">
                    {tagConfirmed && countConfirmed
                      ? `Required field checks are confirmed. Submitting will forward this certified report to MAO for final approval.`
                      : "Physical ear tag match and physical count must be verified on Step 2 before submitting to MAO."}
                  </p>
                </div>
              </div>

              {(!tagConfirmed || !countConfirmed) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="w-full sm:w-auto shrink-0 rounded-lg border-amber-300 bg-white text-xs font-bold text-amber-950 hover:bg-amber-100 justify-center"
                >
                  Verify in Step 2
                </Button>
              )}
            </div>

            {/* FMD Alert Notice if applicable */}
            {fmdAssessment === "SUSPECTED" && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-950">
                <ShieldAlert className="size-5 shrink-0 text-rose-700" />
                <span>Notice: Submitting with explicit &quot;Suspected FMD&quot; assessment for MAO review and GIS tracking.</span>
              </div>
            )}

            {/* Two-Column Side-by-Side Review Recap */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Card 1: Animal & Farmer Overview */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-800">
                    <User className="size-4 text-sky-700" />
                    1. Animal &amp; Farmer Details
                  </span>
                  <Badge variant="outline" className="text-[10px] font-bold text-slate-500 bg-white">
                    Report #{record.id}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Ear Tag</span>
                      <span className="font-black text-slate-900 text-sm">{record.livestockTag}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Species / Breed</span>
                      <span className="font-bold text-slate-800">{record.livestockBreed} ({record.livestockType})</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Raiser</span>
                      <span className="font-bold text-slate-800 truncate block">{record.farmerName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Barangay</span>
                      <span className="font-bold text-slate-800">{record.barangayName}</span>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">
                      {isMortality ? "Reported Cause & Count" : "Reported Condition & Count"}
                    </span>
                    <span className="font-bold text-slate-900">
                      {record.name} • <strong className="text-slate-800">{record.reportedCount} Head{record.reportedCount > 1 ? "s" : ""}</strong>
                    </span>
                  </div>

                  {record.farmerSymptoms && record.farmerSymptoms.length > 0 && (
                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">
                        Signs Reported by Farmer
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {record.farmerSymptoms.map((sym, idx) => (
                          <Badge key={idx} className="bg-white text-slate-700 border border-slate-200 text-[10px] font-semibold py-0 px-1.5">
                            {sym}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {record.farmerDescription && (
                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Farmer Statement</span>
                      <p className="text-slate-600 italic mt-0.5 text-[11px] leading-relaxed">&quot;{record.farmerDescription}&quot;</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Field Verification Findings */}
              <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                  <span className="flex items-center gap-1.5 text-xs font-black uppercase text-sky-950">
                    <ShieldCheck className="size-4 text-sky-700" />
                    2. Field Verification Findings
                  </span>
                  <Badge className="bg-sky-200 text-sky-900 border-none text-[10px] font-bold">
                    Certified Findings
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Physical Checks */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-sky-200 bg-white p-2">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Ear Tag Match</span>
                      <span className={`text-xs font-black flex items-center gap-1 mt-0.5 ${tagConfirmed ? "text-emerald-700" : "text-amber-700"}`}>
                        {tagConfirmed ? <Check className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                        {tagConfirmed ? "Confirmed" : "Not Confirmed"}
                      </span>
                    </div>
                    <div className="rounded-xl border border-sky-200 bg-white p-2">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Physical Count</span>
                      <span className={`text-xs font-black flex items-center gap-1 mt-0.5 ${countConfirmed ? "text-emerald-700" : "text-amber-700"}`}>
                        {countConfirmed ? <Check className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                        {countConfirmed ? `${record.reportedCount} Head${record.reportedCount > 1 ? "s" : ""}` : "Not Confirmed"}
                      </span>
                    </div>
                  </div>

                  {/* Clinically Observed Signs */}
                  <div className="pt-1 border-t border-sky-100">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">
                      {isMortality ? "Observed Signs Before Death" : "Clinically Observed Signs"}
                    </span>
                    {activeSymptoms.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {activeSymptoms.map((sym, idx) => (
                          <Badge key={idx} className="bg-[#1A365D] text-white text-[10px] font-bold py-0.5 px-2">
                            {sym}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic text-xs">No clinical signs marked</span>
                    )}
                  </div>

                  {/* Measurements & Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-sky-100">
                    {!isMortality && (
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Body Temperature</span>
                        <span className="font-bold text-slate-800">{activeTemperature ? `${activeTemperature} °C` : "Not recorded"}</span>
                      </div>
                    )}
                    {!isMortality && (
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Severity Rating</span>
                        <span className="font-bold text-slate-800">{SEVERITY_LABELS[severity] || severity || "Not assessed"}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-1 border-t border-sky-100">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Biosecurity Action</span>
                    <span className="font-bold text-slate-900">{BIOSECURITY_LABELS[biosecurityAction] || biosecurityAction || "No action recorded"}</span>
                  </div>

                  {/* Inspector Remarks */}
                  {inspectorRemarks && (
                    <div className="pt-1 border-t border-sky-100">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Field Audit Remarks</span>
                      <p className="text-slate-700 italic mt-0.5 text-[11px] leading-relaxed">&quot;{inspectorRemarks}&quot;</p>
                    </div>
                  )}

                  {/* Inspection Photo Preview */}
                  {inspectorPhotoUrl && (
                    <div className="pt-1 border-t border-sky-100 flex items-center gap-2">
                      <img src={inspectorPhotoUrl} alt="Inspection" className="size-9 rounded-lg object-cover border border-sky-200" />
                      <div className="text-[11px]">
                        <p className="font-bold text-slate-900">Inspection photo attached</p>
                        <button type="button" onClick={() => setIsPhotoLightboxOpen(true)} className="text-sky-700 font-semibold hover:underline cursor-pointer">
                          View photo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Validation Error Message */}
            {validationError && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-900">
                {validationError}
              </p>
            )}

            {/* Confirmation Dialog / Action Box */}
            {confirmationAction && (
              <div role="alertdialog" aria-live="polite" className="space-y-3 rounded-xl border border-sky-300 bg-sky-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {confirmationAction === "VERIFIED"
                    ? isRevision
                      ? "Confirm the updated field examination and resubmit this report to the MAO?"
                      : "Confirm the physical checks and send this record to MAO for its decision?"
                    : "Flag this report as needing follow-up? The existing workflow will return it with your remarks."}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button type="button" onClick={confirmAction} disabled={isSubmitting} className="min-h-11 bg-[#1A365D] text-white hover:bg-[#152c4d]">
                    {isSubmitting ? "Saving decision..." : confirmationAction === "FLAGGED" ? "Confirm concern" : isRevision ? "Confirm updates and send to MAO" : "Confirm and send"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmationAction(null)} disabled={isSubmitting} className="min-h-11">
                    Go back
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 Footer Action Bar */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 border-t border-slate-200 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="w-full sm:w-auto min-h-11 gap-2 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 justify-center"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Back to Field Verification</span>
                <span className="sm:hidden">Back to Step 2</span>
              </Button>

              {isReadOnly ? (
                <Button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto min-h-11 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold px-6 justify-center"
                >
                  Close
                </Button>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAction("FLAGGED")}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto min-h-11 rounded-xl border-amber-300 bg-amber-50 font-semibold text-amber-950 hover:bg-amber-100 justify-center"
                  >
                    <AlertTriangle className="mr-2 size-4" />
                    <span>Flag a concern</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleAction("VERIFIED")}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto min-h-11 rounded-xl bg-[#1A365D] font-bold text-white hover:bg-[#152c4d] px-5 justify-center"
                  >
                    <ShieldCheck className="mr-2 size-5 text-emerald-300" />
                    <span className="hidden sm:inline">{isRevision ? "Confirm updates and send to MAO" : "Confirm details and send to MAO"}</span>
                    <span className="sm:hidden">{isRevision ? "Resubmit to MAO" : "Confirm & Send to MAO"}</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
        </>
        )}
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
