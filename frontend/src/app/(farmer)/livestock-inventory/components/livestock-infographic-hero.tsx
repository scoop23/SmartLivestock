"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { formatAgeClassification,formatCalendarDate,formatLivestockAge } from "@/lib/livestock-age";
import {
AlertTriangle,
ArrowLeft,
Camera,
CheckCircle2,
Download,
Eye,
Layers,
Maximize2,
QrCode,
Scale,
ShieldCheck,
Sparkles
} from "lucide-react";
import Link from "next/link";
import React,{ useEffect,useState } from "react";
import type { LivestockInventoryItem } from "../livestock-inventory";
import { OperationalStatusBadge } from "../operational-status-badge";
import {
LivestockSilhouettePath,
resolveSpeciesKey,
SILHOUETTE_ANCHORS
} from "./livestock-silhouette-paths";

interface LivestockInfographicHeroProps {
  activeItem: LivestockInventoryItem;
  latestWeight: number;
  latestAdg: number;
  targetWeight: number;
  projectedCarcassKg: number;
  meatDressingPct: number;
  totalCalves: number;
  activeDiseaseCount: number;
  terms: {
    eventName: string;
    offspringName: string;
    offspringPlural: string;
  };
  onOpenPassport: () => void;
  onOpenWeigh: () => void;
  onOpenProduction: () => void;
  onOpenCalving: () => void;
  onOpenCorrection?: () => void;
  canCorrectIndividual?: boolean;
  onSelectTab: (tab: string) => void;
  photoSlot?: React.ReactNode;
  photoUrl?: string | null;
  avatar?: { emoji: string; bgGradient: string };
}

export function LivestockInfographicHero({
  activeItem,
  latestWeight,
  latestAdg,
  targetWeight,
  projectedCarcassKg,
  meatDressingPct,
  totalCalves,
  activeDiseaseCount,
  terms,
  onOpenPassport,
  onOpenWeigh,
  onOpenProduction,
  onOpenCalving,
  onOpenCorrection,
  canCorrectIndividual,
  onSelectTab,
  photoSlot,
  photoUrl,
  avatar,
}: LivestockInfographicHeroProps) {
  const speciesKey = resolveSpeciesKey(activeItem.livestockTypeName);
  const anchors = SILHOUETTE_ANCHORS[speciesKey];

  // View Mode: Silhouette blueprint vs Optional Full View Photo
  const [viewMode, setViewMode] = useState<"silhouette" | "photo">("silhouette");
  const [isFullPhotoModalOpen, setIsFullPhotoModalOpen] = useState(false);

  useEffect(() => {
    setViewMode(photoUrl ? "photo" : "silhouette");
  }, [activeItem.id, photoUrl]);

  // Natural Age Classification
  const normClass = (activeItem.ageClassification || "").toUpperCase();
  const totalMonths = activeItem.age?.total_months ?? (activeItem.age?.years ? activeItem.age.years * 12 + (activeItem.age.months || 0) : null);

  const naturalStage: "young" | "grower" | "adult" = (() => {
    if (
      ["CALF", "PIGLET", "KID", "LAMB", "CHICK", "FOAL"].includes(normClass) ||
      (totalMonths !== null && totalMonths <= 6)
    ) {
      return "young";
    }
    if (
      ["YEARLING", "GROWER", "HEIFER", "PULLET"].includes(normClass) ||
      (totalMonths !== null && totalMonths > 6 && totalMonths < 24)
    ) {
      return "grower";
    }
    return "adult";
  })();

  // Interactive age stage simulator (allows user or capstone panelists to preview how the animal silhouette scales by age)
  const [selectedStage, setSelectedStage] = useState<"young" | "grower" | "adult">(naturalStage);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

  const stageScale = selectedStage === "young" ? 0.74 : selectedStage === "grower" ? 0.88 : 1.0;
  const stageBadgeLabel =
    selectedStage === "young"
      ? "Young / Calf Stage (74% Scale)"
      : selectedStage === "grower"
      ? "Grower / Yearling Stage (88% Scale)"
      : "Adult / Mature Stage (100% Scale)";
  const herdRosterHref = activeItem.batchId
    ? `/livestock-inventory/batches?batch=${encodeURIComponent(String(activeItem.batchId))}&animalId=${encodeURIComponent(String(activeItem.id))}${activeItem.tagNumber ? `&tag=${encodeURIComponent(activeItem.tagNumber)}` : ""}`
    : "/livestock-inventory";

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-emerald-950/40 shadow-2xl bg-gradient-to-b from-[#092b1b] via-[#072417] to-[#04160e] text-white relative">
      {/* Subtle ambient spotlight */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ── TOP ACTION & TITLE BAR ────────────────────────────────────────── */}
      <div className="p-4 sm:p-6 pb-2 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={herdRosterHref}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold gap-1.5"
              >
                <ArrowLeft className="size-3.5" />
                {activeItem.batchId ? "Herds" : "My Livestock"}
              </Button>
            </Link>

            <span className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono">
              {activeItem.tagNumber}
            </span>

            <Badge
              className={`font-black text-[11px] px-2.5 py-0.5 ${
                activeItem.status === "APPROVED"
                  ? "bg-emerald-400 text-emerald-950 border-emerald-300"
                  : activeItem.status === "VERIFIED"
                  ? "bg-sky-300 text-sky-950 border-sky-200"
                  : activeItem.status === "PENDING"
                  ? "bg-amber-300 text-amber-950 border-amber-200"
                  : "bg-rose-200 text-rose-950 border-rose-300"
              }`}
            >
              {activeItem.status}
            </Badge>

            <OperationalStatusBadge status={activeItem.operationalStatus} />

            <Badge className="bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 font-bold text-xs">
              {activeItem.livestockTypeName} &bull; {activeItem.breed || "Standard Breed"}
            </Badge>

            {activeItem.batchCode && (
              <Badge className="bg-teal-500/20 border border-teal-400/30 text-teal-200 font-bold text-xs">
                <Layers className="size-3 mr-1" /> Herd {activeItem.batchCode}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-200/80">
            <span>Owner: <strong className="text-white">{activeItem.farmerName}</strong></span>
            <span>&bull;</span>
            <span>Registered: <strong className="text-white">{formatCalendarDate(activeItem.createdAt)}</strong></span>
            <span>&bull;</span>
            <span className="text-emerald-300 font-medium">Municipality of Padre Garcia, Batangas</span>
          </div>
        </div>

        {/* Action Buttons & Photo Manager */}
        <div className="flex flex-wrap items-center gap-2">
          {photoSlot && <div className="shrink-0">{photoSlot}</div>}

          {canCorrectIndividual && onOpenCorrection && (
            <Button
              onClick={onOpenCorrection}
              size="sm"
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 shadow-sm"
            >
              <AlertTriangle className="size-3.5" /> Corrections
            </Button>
          )}

          <Button
            onClick={() => setIsFullPhotoModalOpen(true)}
            variant="outline"
            size="sm"
            className="rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs gap-1.5 cursor-pointer"
          >
            <Camera className="size-3.5 text-emerald-300" /> Full Photo
          </Button>

          <Button
            onClick={onOpenPassport}
            variant="outline"
            size="sm"
            className="rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs gap-1.5 cursor-pointer"
          >
            <QrCode className="size-3.5 text-emerald-300" /> ID Passport
          </Button>

          <Button
            onClick={onOpenWeigh}
            size="sm"
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-sm cursor-pointer"
          >
            <Scale className="size-3.5" /> Log Weight
          </Button>
        </div>
      </div>

      {/* ── VIEW MODE & AGE SCALE INTERACTIVE CONTROLLER BAR ────────────────── */}
      <div className="px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs border-b border-white/5 bg-black/20">
        {/* Left: View Mode Switcher (Silhouette Blueprint vs Full View Photo) */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => setViewMode("silhouette")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === "silhouette"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <Sparkles className="size-3.5 text-emerald-300" />
            <span>Silhouette Blueprint</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("photo")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === "photo"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <Camera className="size-3.5 text-emerald-300" />
            <span>Full View Photo</span>
            {photoUrl && (
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
        </div>

        {/* Right: Stage Scale simulator in Silhouette mode OR Lightbox trigger in Photo mode */}
        {viewMode === "silhouette" ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-300/80">
                Scale by Age:
              </span>
              <Badge variant="outline" className="text-emerald-200 border-emerald-500/30 text-[10px] font-bold py-0.5">
                {stageBadgeLabel}
              </Badge>
            </div>

            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setSelectedStage("young")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  selectedStage === "young"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Young (74%)
              </button>
              <button
                type="button"
                onClick={() => setSelectedStage("grower")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  selectedStage === "grower"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Grower (88%)
              </button>
              <button
                type="button"
                onClick={() => setSelectedStage("adult")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  selectedStage === "adult"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Adult (100%)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFullPhotoModalOpen(true)}
              className="h-7 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold gap-1.5 cursor-pointer"
            >
              <Maximize2 className="size-3 text-emerald-300" />
              <span>Fullscreen Lightbox</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── MAIN INFOGRAPHIC HERO VIEW (DESKTOP & TABLET) ───────────────────── */}
      {/* Inspired by the attached reference image with pointing lines and callout cards */}
      <div className="relative p-4 sm:p-6 lg:p-8 min-h-[460px] flex items-center justify-center">
        {/* SVG Drawing Layer for Silhouette and Connected Pointer Lines */}
        <div className="w-full max-w-5xl mx-auto relative hidden md:block">
          {viewMode === "silhouette" ? (
            <>
              <svg
                viewBox="0 0 1000 520"
                className="w-full h-auto overflow-visible select-none"
                style={{ maxHeight: "480px" }}
              >
                <defs>
                  {/* Radial gradient glow behind the animal */}
                  <radialGradient id="silhouetteGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="60%" stopColor="#059669" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#04160e" stopOpacity="0" />
                  </radialGradient>

                  {/* Shadow filter for callout cards */}
                  <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.5" />
                  </filter>
                </defs>

                {/* Glowing backdrop circle */}
                <circle cx="500" cy="260" r="180" fill="url(#silhouetteGlow)" />

                {/* ── CENTRAL ANIMAL SILHOUETTE (SCALED BY AGE GROUP) ── */}
                <g
                  transform={`translate(${500 - 300 * stageScale}, ${260 - 210 * stageScale}) scale(${stageScale})`}
                  className="transition-transform duration-500 ease-out"
                >
                  {/* Silhouette Body Shadow */}
                  <g transform="translate(4, 6)" opacity="0.35">
                    <LivestockSilhouettePath species={speciesKey} className="fill-black" />
                  </g>

                  {/* Silhouette Body Highlight / Texture */}
                  <LivestockSilhouettePath
                    species={speciesKey}
                    className="fill-gradient text-emerald-100/90 transition-colors"
                  />
                </g>

                {/* ── POINTER LINES & ANCHORS (Calculated based on scale) ── */}
                {(() => {
                  // Convert native 600x420 coordinates to 1000x520 world space
                  const toWorld = (p: { x: number; y: number }) => {
                    const ox = 500 - 300 * stageScale;
                    const oy = 260 - 210 * stageScale;
                    return {
                      x: ox + p.x * stageScale,
                      y: oy + p.y * stageScale,
                    };
                  };

                  const aEar = toWorld(anchors.earTag);
                  const aWeight = toWorld(anchors.weight);
                  const aHealth = toWorld(anchors.health);
                  const aAge = toWorld(anchors.age);
                  const aCarcass = toWorld(anchors.carcass);
                  const aOffspring = toWorld(anchors.offspring);

                  return (
                    <g className="transition-all duration-500">
                      {/* Left Line 1: Ear Tag & Identity */}
                      <path
                        d={`M 260,90 H 340 L ${aEar.x},${aEar.y}`}
                        fill="none"
                        stroke={activeHighlight === "ear" ? "#34d399" : "#6ee7b7"}
                        strokeWidth={activeHighlight === "ear" ? "2.5" : "1.75"}
                        strokeDasharray={activeHighlight === "ear" ? "none" : "none"}
                        className="transition-all"
                      />
                      <circle cx={aEar.x} cy={aEar.y} r="6" fill="#04160e" stroke="#34d399" strokeWidth="2.5" />
                      <circle cx={aEar.x} cy={aEar.y} r="2.5" fill="#ffffff" />

                      {/* Left Line 2: Live Weight & Growth */}
                      <path
                        d={`M 260,230 H 350 L ${aWeight.x},${aWeight.y}`}
                        fill="none"
                        stroke={activeHighlight === "weight" ? "#34d399" : "#6ee7b7"}
                        strokeWidth={activeHighlight === "weight" ? "2.5" : "1.75"}
                        className="transition-all"
                      />
                      <circle cx={aWeight.x} cy={aWeight.y} r="6" fill="#04160e" stroke="#34d399" strokeWidth="2.5" />
                      <circle cx={aWeight.x} cy={aWeight.y} r="2.5" fill="#ffffff" />

                      {/* Left Line 3: Health & Vaccines */}
                      <path
                        d={`M 260,390 H 340 L ${aHealth.x},${aHealth.y}`}
                        fill="none"
                        stroke={activeHighlight === "health" ? "#34d399" : "#6ee7b7"}
                        strokeWidth={activeHighlight === "health" ? "2.5" : "1.75"}
                        className="transition-all"
                      />
                      <circle cx={aHealth.x} cy={aHealth.y} r="6" fill="#04160e" stroke="#34d399" strokeWidth="2.5" />
                      <circle cx={aHealth.x} cy={aHealth.y} r="2.5" fill="#ffffff" />

                      {/* Right Line 4: Age & Biological Stage */}
                      <path
                        d={`M 740,90 H 660 L ${aAge.x},${aAge.y}`}
                        fill="none"
                        stroke={activeHighlight === "age" ? "#34d399" : "#6ee7b7"}
                        strokeWidth={activeHighlight === "age" ? "2.5" : "1.75"}
                        className="transition-all"
                      />
                      <circle cx={aAge.x} cy={aAge.y} r="6" fill="#04160e" stroke="#34d399" strokeWidth="2.5" />
                      <circle cx={aAge.x} cy={aAge.y} r="2.5" fill="#ffffff" />

                      {/* Right Line 5: Meat Dressing & Carcass Yield */}
                      <path
                        d={`M 740,230 H 650 L ${aCarcass.x},${aCarcass.y}`}
                        fill="none"
                        stroke={activeHighlight === "carcass" ? "#34d399" : "#6ee7b7"}
                        strokeWidth={activeHighlight === "carcass" ? "2.5" : "1.75"}
                        className="transition-all"
                      />
                      <circle cx={aCarcass.x} cy={aCarcass.y} r="6" fill="#04160e" stroke="#34d399" strokeWidth="2.5" />
                      <circle cx={aCarcass.x} cy={aCarcass.y} r="2.5" fill="#ffffff" />

                      {/* Right Line 6: Offspring & Lineage */}
                      <path
                        d={`M 740,390 H 660 L ${aOffspring.x},${aOffspring.y}`}
                        fill="none"
                        stroke={activeHighlight === "offspring" ? "#34d399" : "#6ee7b7"}
                        strokeWidth={activeHighlight === "offspring" ? "2.5" : "1.75"}
                        className="transition-all"
                      />
                      <circle cx={aOffspring.x} cy={aOffspring.y} r="6" fill="#04160e" stroke="#34d399" strokeWidth="2.5" />
                      <circle cx={aOffspring.x} cy={aOffspring.y} r="2.5" fill="#ffffff" />
                    </g>
                  );
                })()}
              </svg>

              {/* Quick switch floating pill when in silhouette mode */}
              {photoUrl && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
                  <button
                    type="button"
                    onClick={() => setViewMode("photo")}
                    className="px-3.5 py-1.5 rounded-full bg-black/80 hover:bg-black/95 border border-emerald-400/40 text-emerald-200 hover:text-white text-xs font-bold flex items-center gap-1.5 shadow-xl backdrop-blur-md transition-all cursor-pointer hover:scale-105"
                  >
                    <Camera className="size-3.5 text-emerald-400" />
                    <span>View Actual Livestock Photo</span>
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            /* ── CENTER STAGE FULL VIEW PHOTO DISPLAY ── */
            <div className="w-full h-[480px] flex items-center justify-center relative select-none">
              {/* Ambient backdrop glow */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl" />
              </div>

              {photoUrl ? (
                <div
                  onClick={() => setIsFullPhotoModalOpen(true)}
                  className="group relative w-full max-w-md h-[400px] rounded-3xl overflow-hidden border border-emerald-500/30 shadow-2xl bg-black/50 backdrop-blur-md cursor-pointer transition-all hover:border-emerald-400 hover:shadow-emerald-950/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt={`${activeItem.tagNumber} Photo`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Gradient vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40 pointer-events-none" />

                  {/* Top badges */}
                  <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between">
                    <Badge className="bg-emerald-950/90 backdrop-blur-md border border-emerald-400/40 text-emerald-200 text-[10px] font-bold">
                      <Camera className="size-3 mr-1 text-emerald-300" /> Official Animal Photo
                    </Badge>
                    <Badge className="bg-black/70 backdrop-blur-md border border-white/20 text-white text-[10px] font-mono">
                      {activeItem.tagNumber}
                    </Badge>
                  </div>

                  {/* Bottom info & expand trigger */}
                  <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-sm leading-tight drop-shadow-md">
                        {activeItem.breed || "Standard Breed"} &bull; {activeItem.sex || "Livestock"}
                      </p>
                      <p className="text-[11px] text-emerald-300 font-medium drop-shadow-md">
                        Padre Garcia Livestock Registry
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/90 group-hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-colors">
                      <Maximize2 className="size-3.5" />
                      <span>Expand</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-md h-[400px] rounded-3xl border border-dashed border-emerald-500/30 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className={`size-24 rounded-3xl flex items-center justify-center text-5xl shadow-xl border border-white/10 ${avatar?.bgGradient || "bg-emerald-800"}`}>
                    {avatar?.emoji || "🐄"}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">No Photo Registered</h4>
                    <p className="text-xs text-emerald-200/70 mt-1 max-w-xs">
                      An official photographic record has not been uploaded for tag <strong className="text-white">{activeItem.tagNumber}</strong> yet.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setViewMode("silhouette")}
                      className="rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold"
                    >
                      View Silhouette
                    </Button>
                    {photoSlot && <div className="shrink-0">{photoSlot}</div>}
                  </div>
                </div>
              )}

              {/* Floating switch back to silhouette */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
                <button
                  type="button"
                  onClick={() => setViewMode("silhouette")}
                  className="px-3.5 py-1.5 rounded-full bg-black/80 hover:bg-black/95 border border-emerald-400/40 text-emerald-200 hover:text-white text-xs font-bold flex items-center gap-1.5 shadow-xl backdrop-blur-md transition-all cursor-pointer hover:scale-105"
                >
                  <Sparkles className="size-3.5 text-emerald-400" />
                  <span>Switch to Silhouette Blueprint</span>
                </button>
              </div>
            </div>
          )}

          {/* ── HTML CALLOUT CARDS OVERLAY (Left & Right Column) ── */}
          {/* LEFT COLUMN CALLOUTS */}
          <div className="absolute top-8 left-2 w-64 space-y-12">
            {/* Callout 1: Ear Tag & Identity */}
            <div
              onMouseEnter={() => setActiveHighlight("ear")}
              onMouseLeave={() => setActiveHighlight(null)}
              onClick={() => onSelectTab("pedigree")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
                activeHighlight === "ear"
                  ? "bg-emerald-950/90 border-emerald-400 shadow-lg scale-105"
                  : "bg-black/40 border-emerald-500/20 hover:border-emerald-400/60"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Ear Tag &amp; ID
              </span>
              <p className="text-lg font-black text-white font-mono">{activeItem.tagNumber}</p>
              <p className="text-[11px] text-emerald-200/70 font-medium">
                Breed: <strong>{activeItem.breed || "Standard"}</strong> &bull; Registered
              </p>
            </div>

            {/* Callout 2: Live Weight & Growth */}
            <div
              onMouseEnter={() => setActiveHighlight("weight")}
              onMouseLeave={() => setActiveHighlight(null)}
              onClick={() => onSelectTab("growth")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
                activeHighlight === "weight"
                  ? "bg-emerald-950/90 border-emerald-400 shadow-lg scale-105"
                  : "bg-black/40 border-emerald-500/20 hover:border-emerald-400/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Live Body Weight
                </span>
                <span className="text-[10px] font-bold text-emerald-400">+{latestAdg} kg/d</span>
              </div>
              <p className="text-2xl font-black text-white">{latestWeight} kg</p>
              <p className="text-[11px] text-emerald-200/70 font-medium">
                Target: {targetWeight} kg &bull; Click to log weight
              </p>
            </div>

            {/* Callout 3: Health & Vaccines */}
            <div
              onMouseEnter={() => setActiveHighlight("health")}
              onMouseLeave={() => setActiveHighlight(null)}
              onClick={() => onSelectTab("health")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
                activeHighlight === "health"
                  ? "bg-emerald-950/90 border-emerald-400 shadow-lg scale-105"
                  : "bg-black/40 border-emerald-500/20 hover:border-emerald-400/60"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Health &amp; Vaccines
              </span>
              <p className="text-base font-black text-white flex items-center gap-1.5">
                {activeItem.lastVaccinationDate ? (
                  <>
                    <ShieldCheck className="size-4 text-emerald-400" />
                    <span>Vaccinated</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-4 text-amber-400" />
                    <span>Pending Vaccine</span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-emerald-200/70 font-medium">
                {activeDiseaseCount > 0 ? `${activeDiseaseCount} active report` : "Healthy / Disease Free"}
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN CALLOUTS */}
          <div className="absolute top-8 right-2 w-64 space-y-12 text-right">
            {/* Callout 4: Age & Biological Stage */}
            <div
              onMouseEnter={() => setActiveHighlight("age")}
              onMouseLeave={() => setActiveHighlight(null)}
              onClick={() => onSelectTab("pedigree")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
                activeHighlight === "age"
                  ? "bg-emerald-950/90 border-emerald-400 shadow-lg scale-105"
                  : "bg-black/40 border-emerald-500/20 hover:border-emerald-400/60"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Age &amp; Classification
              </span>
              <p className="text-lg font-black text-white">{formatLivestockAge(activeItem.age)}</p>
              <p className="text-[11px] text-emerald-200/70 font-medium">
                {formatAgeClassification(activeItem.ageClassification)} Stage &bull; Born {formatCalendarDate(activeItem.birthDate)}
              </p>
            </div>

            {/* Callout 5: Carcass Meat Yield */}
            <div
              onMouseEnter={() => setActiveHighlight("carcass")}
              onMouseLeave={() => setActiveHighlight(null)}
              onClick={() => onSelectTab("production")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
                activeHighlight === "carcass"
                  ? "bg-emerald-950/90 border-emerald-400 shadow-lg scale-105"
                  : "bg-black/40 border-emerald-500/20 hover:border-emerald-400/60"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Estimated Meat Yield
              </span>
              <p className="text-2xl font-black text-emerald-300">~{projectedCarcassKg} kg</p>
              <p className="text-[11px] text-emerald-200/70 font-medium">
                {meatDressingPct}% dressing &bull; Est. ₱{(projectedCarcassKg * 280).toLocaleString()}
              </p>
            </div>

            {/* Callout 6: Offspring & Lineage */}
            <div
              onMouseEnter={() => setActiveHighlight("offspring")}
              onMouseLeave={() => setActiveHighlight(null)}
              onClick={() => onSelectTab("calving")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
                activeHighlight === "offspring"
                  ? "bg-emerald-950/90 border-emerald-400 shadow-lg scale-105"
                  : "bg-black/40 border-emerald-500/20 hover:border-emerald-400/60"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Offspring &amp; Lineage
              </span>
              <p className="text-base font-black text-white">
                {totalCalves} {terms.offspringPlural} Logged
              </p>
              <p className="text-[11px] text-emerald-200/70 font-medium">
                Sex: <strong>{activeItem.sex || "Female"}</strong> &bull; Maternal records active
              </p>
            </div>
          </div>
        </div>

        {/* ── MOBILE / SMALL SCREEN VIEW (< md) ────────────────────────────── */}
        <div className="w-full md:hidden flex flex-col items-center space-y-4">
          {viewMode === "silhouette" ? (
            <div className="relative w-full max-w-xs h-56 flex items-center justify-center">
              {/* Glowing circle background */}
              <div className="absolute inset-4 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <svg
                viewBox="0 0 600 420"
                className="w-full h-full overflow-visible transition-transform duration-500"
                style={{ transform: `scale(${stageScale})` }}
              >
                <g transform="translate(4, 6)" opacity="0.3">
                  <LivestockSilhouettePath species={speciesKey} className="fill-black" />
                </g>
                <LivestockSilhouettePath
                  species={speciesKey}
                  className="fill-current text-emerald-200/90"
                />

                {/* Glowing anchor tap points */}
                <circle cx={anchors.earTag.x} cy={anchors.earTag.y} r="8" fill="#04160e" stroke="#34d399" strokeWidth="3" />
                <circle cx={anchors.weight.x} cy={anchors.weight.y} r="8" fill="#04160e" stroke="#34d399" strokeWidth="3" />
                <circle cx={anchors.age.x} cy={anchors.age.y} r="8" fill="#04160e" stroke="#34d399" strokeWidth="3" />
              </svg>
            </div>
          ) : (
            <div className="w-full max-w-xs h-56 relative rounded-2xl overflow-hidden border border-emerald-500/30 shadow-lg group cursor-pointer bg-black/40">
              {photoUrl ? (
                <div
                  onClick={() => setIsFullPhotoModalOpen(true)}
                  className="w-full h-full relative"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt={`${activeItem.tagNumber} Photo`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-white">{activeItem.tagNumber}</span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-bold bg-black/70 px-2 py-0.5 rounded-lg border border-white/10">
                      <Maximize2 className="size-3" /> Full View
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                  <div className={`size-16 rounded-2xl flex items-center justify-center text-3xl shadow mb-2 ${avatar?.bgGradient || "bg-emerald-800"}`}>
                    {avatar?.emoji || "🐄"}
                  </div>
                  <p className="text-xs font-bold text-white">No Photo Uploaded</p>
                  <p className="text-[10px] text-emerald-200/70">Tap &apos;Silhouette&apos; to view anatomy blueprint</p>
                </div>
              )}
            </div>
          )}

          {/* 6 Responsive Callout Cards on Mobile */}
          <div className="grid grid-cols-2 gap-2.5 w-full text-xs">
            <div
              onClick={() => onSelectTab("growth")}
              className="p-2.5 rounded-2xl bg-black/40 border border-emerald-500/20 active:bg-emerald-950/80 space-y-0.5"
            >
              <span className="text-[9px] uppercase font-bold text-emerald-300">Live Weight</span>
              <p className="text-base font-black text-white">{latestWeight} kg</p>
              <p className="text-[10px] text-emerald-300 font-semibold">+{latestAdg} kg/d ADG</p>
            </div>

            <div
              onClick={() => onSelectTab("pedigree")}
              className="p-2.5 rounded-2xl bg-black/40 border border-emerald-500/20 active:bg-emerald-950/80 space-y-0.5"
            >
              <span className="text-[9px] uppercase font-bold text-emerald-300">Age &amp; Breed</span>
              <p className="text-base font-black text-white truncate">{formatLivestockAge(activeItem.age)}</p>
              <p className="text-[10px] text-emerald-200/70 truncate">{activeItem.breed || "Standard"}</p>
            </div>

            <div
              onClick={() => onSelectTab("production")}
              className="p-2.5 rounded-2xl bg-black/40 border border-emerald-500/20 active:bg-emerald-950/80 space-y-0.5"
            >
              <span className="text-[9px] uppercase font-bold text-emerald-300">Carcass Yield</span>
              <p className="text-base font-black text-emerald-300">~{projectedCarcassKg} kg</p>
              <p className="text-[10px] text-emerald-200/70">{meatDressingPct}% dressed</p>
            </div>

            <div
              onClick={() => onSelectTab("health")}
              className="p-2.5 rounded-2xl bg-black/40 border border-emerald-500/20 active:bg-emerald-950/80 space-y-0.5"
            >
              <span className="text-[9px] uppercase font-bold text-emerald-300">Health</span>
              <p className="text-base font-black text-white">
                {activeItem.lastVaccinationDate ? "Vaccinated" : "Unrecorded"}
              </p>
              <p className="text-[10px] text-emerald-200/70">
                {activeDiseaseCount === 0 ? "No Active Disease" : `${activeDiseaseCount} Case`}
              </p>
            </div>

            <div
              onClick={() => onSelectTab("calving")}
              className="p-2.5 rounded-2xl bg-black/40 border border-emerald-500/20 active:bg-emerald-950/80 space-y-0.5"
            >
              <span className="text-[9px] uppercase font-bold text-emerald-300">Offspring</span>
              <p className="text-base font-black text-white">{totalCalves} {terms.offspringPlural}</p>
              <p className="text-[10px] text-emerald-200/70">Sex: {activeItem.sex || "Female"}</p>
            </div>

            <div
              onClick={() => onSelectTab("ownership")}
              className="p-2.5 rounded-2xl bg-black/40 border border-emerald-500/20 active:bg-emerald-950/80 space-y-0.5"
            >
              <span className="text-[9px] uppercase font-bold text-emerald-300">Status</span>
              <p className="text-base font-black text-emerald-400">{activeItem.operationalStatus}</p>
              <p className="text-[10px] text-emerald-200/70">{activeItem.status}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ADVANTAGE & CERTIFICATION BADGES ───────────────────────── */}
      {/* Inspired by the green feature badges in the user's reference image */}
      <div className="p-4 sm:p-5 border-t border-white/10 bg-black/20 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-emerald-300/80 tracking-wider">
            Verification &amp; Certification:
          </span>
          <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[11px] font-semibold py-0.5">
            <CheckCircle2 className="size-3 mr-1 text-emerald-400" /> MAO Padre Garcia Approved
          </Badge>
          <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[11px] font-semibold py-0.5">
            <CheckCircle2 className="size-3 mr-1 text-emerald-400" /> SIBAT / CBAT Validated
          </Badge>
          <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[11px] font-semibold py-0.5">
            <CheckCircle2 className="size-3 mr-1 text-emerald-400" /> Auction Market Eligible
          </Badge>
          <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 text-[11px] font-semibold py-0.5">
            <CheckCircle2 className="size-3 mr-1 text-emerald-400" /> Official Animal Registry
          </Badge>
        </div>

        <div className="text-[11px] text-emerald-200/60 font-medium">
          Padre Garcia &bull; Cattle Capital of the Philippines
        </div>
      </div>

      {/* ── FULL-SCREEN PHOTO LIGHTBOX MODAL ──────────────────────────────── */}
      <Dialog open={isFullPhotoModalOpen} onOpenChange={setIsFullPhotoModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-[#04160e] border border-emerald-900/60 text-white rounded-3xl shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-white/10 bg-black/30">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black font-mono text-white flex items-center gap-2">
                  <Camera className="size-5 text-emerald-400" />
                  {activeItem.tagNumber} &bull; Full View Photo
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-200/80 mt-1">
                  Official livestock visual record &bull; {activeItem.livestockTypeName} &bull; {activeItem.breed || "Standard Breed"}
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  className={`font-black text-xs px-2.5 py-0.5 ${
                    activeItem.status === "APPROVED"
                      ? "bg-emerald-400 text-emerald-950"
                      : activeItem.status === "VERIFIED"
                      ? "bg-sky-300 text-sky-950"
                      : "bg-amber-300 text-amber-950"
                  }`}
                >
                  {activeItem.status}
                </Badge>
                <OperationalStatusBadge status={activeItem.operationalStatus} />
              </div>
            </div>
          </DialogHeader>

          {/* Modal Photo Body */}
          <div className="flex-1 p-4 sm:p-6 flex items-center justify-center bg-black/60 min-h-[320px] max-h-[68vh] overflow-auto">
            {photoUrl ? (
              <div className="relative group max-h-full max-w-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt={`${activeItem.tagNumber} Full Photo`}
                  className="max-h-[62vh] w-auto max-w-full object-contain rounded-2xl border border-white/10 shadow-2xl transition-all select-none"
                />
              </div>
            ) : (
              <div className="text-center py-12 px-6 max-w-md space-y-4">
                <div className={`size-24 rounded-3xl border border-white/10 flex items-center justify-center mx-auto text-5xl shadow-xl ${avatar?.bgGradient || "bg-emerald-800"}`}>
                  {avatar?.emoji || "🐄"}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">No Photo Registered</h4>
                  <p className="text-xs text-emerald-200/70 mt-1">
                    An official photo has not been uploaded for {activeItem.tagNumber} yet. You can use the photo manager to upload one.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <DialogFooter className="p-3 sm:p-4 px-6 border-t border-white/10 bg-black/40 flex flex-row items-center justify-between sm:justify-between gap-3">
            <div className="text-[11px] text-emerald-200/60 hidden sm:block">
              Owner: <strong className="text-white">{activeItem.farmerName}</strong> &bull; Padre Garcia, Batangas
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {photoUrl && (
                <>
                  <a
                    href={photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all"
                  >
                    <Eye className="size-3.5 text-emerald-300" />
                    Open Raw
                  </a>
                  <a
                    href={photoUrl}
                    download={`${activeItem.tagNumber}-photo`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <Download className="size-3.5" />
                    Download Photo
                  </a>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFullPhotoModalOpen(false)}
                className="rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold"
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
