"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Info,
  CheckCircle2,
  ExternalLink,
  Flame,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FmdEvaluation } from "@/lib/fmd-signs";

interface FmdSuspicionAlertCardProps {
  evaluation: FmdEvaluation;
  fmdAssessment: "SUSPECTED" | "";
  onToggleFmdAssessment: (isSuspected: boolean) => void;
  onApplyFmdProtocol: () => void;
  isReadOnly?: boolean;
  isPending?: boolean;
  defaultOpen?: boolean;
}

export function FmdSuspicionAlertCard({
  evaluation,
  fmdAssessment,
  onToggleFmdAssessment,
  onApplyFmdProtocol,
  isReadOnly = false,
  isPending = true,
  defaultOpen = false,
}: FmdSuspicionAlertCardProps) {
  // If explicitly flagged as suspected, keep open by default, else allow user to expand via pulsing button
  const [isOpen, setIsOpen] = useState(defaultOpen || fmdAssessment === "SUSPECTED");

  const isSuspected = fmdAssessment === "SUSPECTED";
  const shouldPulse = isPending && !isReadOnly && !isOpen && !isSuspected;

  return (
    <div className="w-full">
      {/* ─── Pulsing Trigger Button ─── */}
      <div className="relative group w-full">
        {/* Pulsing halo aura when closed & pending review */}
        {shouldPulse && (
          <span
            className="absolute -inset-1 rounded-2xl bg-amber-400/50 animate-pulse blur-xs pointer-events-none"
            aria-hidden="true"
          />
        )}

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`relative w-full flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border-2 transition-all duration-300 text-left shadow-xs cursor-pointer ${
            isSuspected
              ? "border-rose-400 bg-rose-50/90 text-rose-950 shadow-sm"
              : isOpen
              ? "border-amber-400 bg-amber-50/90 text-amber-950 shadow-sm"
              : "border-amber-400 bg-gradient-to-r from-amber-500/15 via-amber-50 to-amber-500/10 hover:from-amber-500/20 hover:to-amber-500/15 text-amber-950 hover:shadow-md active:scale-[0.99]"
          }`}
          aria-expanded={isOpen}
          aria-label="Toggle Foot and Mouth Disease differential advisory"
        >
          {/* Left Icon and Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`relative size-9 sm:size-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs ${
                isSuspected
                  ? "bg-rose-600"
                  : evaluation.isHighSuspicion
                  ? "bg-rose-500"
                  : "bg-amber-500"
              }`}
            >
              {isSuspected ? (
                <ShieldAlert className="size-5 stroke-[2.5]" />
              ) : evaluation.isHighSuspicion ? (
                <ShieldAlert className="size-5 stroke-[2.5]" />
              ) : (
                <AlertTriangle className="size-5 stroke-[2.5]" />
              )}

              {/* Animated pinging aura dot when closed */}
              {shouldPulse && (
                <span className="absolute -top-1 -right-1 flex size-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-90" />
                  <span className="relative inline-flex size-3 rounded-full bg-amber-600 border-2 border-white" />
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                  Maaaring Foot and Mouth Disease (FMD)
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wide shadow-2xs ${
                    isSuspected
                      ? "bg-rose-700 text-white"
                      : evaluation.isHighSuspicion
                      ? "bg-rose-600 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {isSuspected ? (
                    <>
                      <ShieldCheck className="size-3 stroke-[3]" />
                      <span>Suspected FMD Flagged</span>
                    </>
                  ) : evaluation.isHighSuspicion ? (
                    <>
                      <Flame className="size-3 stroke-[3]" />
                      <span>Mataas na Hinala (High Risk)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-3 stroke-[3]" />
                      <span>Possible FMD Pattern</span>
                    </>
                  )}
                </span>

                {isPending && !isSuspected && (
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider hidden sm:inline">
                    Kailangan suriin sa bukid
                  </span>
                )}
              </div>

              <p className="text-[11px] sm:text-xs text-amber-950/80 font-medium truncate mt-0.5">
                {isOpen
                  ? "I-click upang isara ang gabay at protocol"
                  : evaluation.matchedSigns.length > 0
                  ? `Natukoy ang mga senyales: ${evaluation.matchedSigns.slice(0, 3).join(", ")}${
                      evaluation.matchedSigns.length > 3 ? "..." : ""
                    } • I-click para sa gabay sa bukid`
                  : "Maaaring may FMD batay sa iniulat na sintomas • I-click para sa gabay"}
              </p>
            </div>
          </div>

          {/* Right Chevron */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-amber-900 hidden md:inline">
              {isOpen ? "Isara" : "Buksan ang Gabay"}
            </span>
            <div className="size-7 rounded-lg bg-black/5 flex items-center justify-center text-slate-700">
              <ChevronDown
                className={`size-4 transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>
        </button>
      </div>

      {/* ─── Elongating / Accordion Container ─── */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen
            ? "max-h-[1600px] opacity-100 mt-3"
            : "max-h-0 opacity-0 mt-0 pointer-events-none"
        }`}
      >
        <div
          className={`w-full rounded-2xl border p-4 sm:p-5 space-y-4 shadow-sm ${
            isSuspected
              ? "border-rose-300 bg-gradient-to-b from-rose-50/90 via-white to-rose-50/40 text-rose-950"
              : "border-amber-300 bg-gradient-to-b from-amber-50/80 via-white to-amber-50/30 text-amber-950"
          }`}
        >
          {/* ─── 1. Rationale & Symptoms Matched ─── */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Stethoscope className="size-4.5 text-amber-700" />
                <h4 className="text-sm font-black text-slate-900">
                  Klinikal na Pagsusuri (Clinical Decision Support)
                </h4>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-amber-300 bg-amber-100/70 text-amber-900">
                Padre Garcia Biosecurity Protocol
              </Badge>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {evaluation.summaryTagalog}
            </p>
            <p className="text-[11px] text-slate-500 italic leading-relaxed">
              {evaluation.summaryEnglish}
            </p>

            {/* Matched symptoms pill badges */}
            {evaluation.matchedSigns.length > 0 && (
              <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-1">
                  Mga Natukoy na Palatandaan:
                </span>
                {evaluation.matchedSigns.map((sign, idx) => (
                  <Badge
                    key={idx}
                    className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs py-0.5 px-2 rounded-lg"
                  >
                    {sign}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* ─── 2. Field Inspection Checklist ("Ano ang dapat suriin sa hayop?") ─── */}
          <div className="rounded-xl border border-amber-200/90 bg-white/90 p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <Search className="size-4 text-amber-700" />
              <span>GABAY SA PAGSURI SA BUKID (On-Farm Physical Examination):</span>
            </div>
            <ul className="space-y-1.5 text-slate-700 pl-1">
              {evaluation.checklistToInspect.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 font-black shrink-0 mt-0.5">•</span>
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ─── 3. CBAT Field Officer Action & Verification ─── */}
          {!isReadOnly && isPending && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-black text-rose-950 uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldAlert className="size-4 text-rose-700" />
                  Opisyal na Aksyon ng CBAT Field Reviewer
                </span>
                {isSuspected && (
                  <Badge className="bg-rose-700 text-white text-[10px] font-black uppercase">
                    Suspected FMD Flag Active
                  </Badge>
                )}
              </div>

              {/* Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer rounded-xl bg-white p-3 border border-rose-200 hover:border-rose-300 transition-all shadow-2xs">
                <input
                  type="checkbox"
                  checked={isSuspected}
                  onChange={(e) => onToggleFmdAssessment(e.target.checked)}
                  className="size-5 rounded text-rose-700 focus:ring-rose-500 cursor-pointer mt-0.5"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-black text-slate-900 block leading-tight">
                    I-beripika bilang Suspected Foot and Mouth Disease (FMD) para sa MAO review
                  </span>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Ang pag-check dito ay opisyal na magmamarka sa kaso bilang <strong>Suspected FMD</strong>.
                    Awtomatiko itong magbibigay-alerto sa MAO at isasama sa GIS epidemic simulation kapag naaprubahan ng MAO.
                  </p>
                </div>
              </label>

              {/* Action button to apply biosecurity protocol & standard remarks */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <p className="text-[11px] text-rose-900 font-semibold">
                  Mabilisang Aksyon: Ipatupad ang isolation at veterinary remarks.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={onApplyFmdProtocol}
                  className="h-8 px-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Sparkles className="size-3.5" />
                  Apply FMD Protocol & Remarks
                </Button>
              </div>
            </div>
          )}

          {/* Read-Only State Summary */}
          {isReadOnly && isSuspected && (
            <div className="rounded-xl border border-rose-200 bg-rose-100/70 p-3 text-xs font-bold text-rose-950 flex items-center gap-2">
              <ShieldCheck className="size-4.5 text-rose-700 shrink-0" />
              <span>
                Ang ulat na ito ay opisyal na minarkahan ng SIBAT/CBAT bilang Suspected FMD. Ang opisyal na pagsusuri sa laboratoryo ay isasagawa sa ilalim ng MAO at BAI.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
