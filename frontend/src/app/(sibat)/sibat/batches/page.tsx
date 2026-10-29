"use client";

import { PADRE_GARCIA_BARANGAYS } from "@/app/(admin)/admin/admin-charts";
import { getDefaultAvatarForSpecies } from "@/app/(farmer)/livestock-inventory/livestock-inventory";
import { PageHeader } from "@/app/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ValidationLoadingScreen, useLoadingScreenTransition } from "@/components/validation-loading-screen";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Compass,
  Copy,
  Cpu,
  Dna,
  Download,
  Eye,
  FileSpreadsheet,
  ImageIcon,
  Info,
  Layers,
  LayoutGrid,
  List,
  MapPin,
  Maximize2,
  Radio,
  RefreshCw,
  RotateCcw,
  Scale,
  Scan,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import SibatReviewDialog from "../components/sibat-review-dialog";
import type { UnifiedSubmissionItem } from "../sibat-analytics";

// ── Types ──────────────────────────────────────────────────────────────────

interface ChildAnimal {
  id: number;
  tag_number: string;
  breed: string;
  sex: string;
  age?: { years: number; months: number; total_months: number } | null;
  weight: number | string | null;
  photo_url?: string | null;
  avatar_key?: string | null;
  last_vaccination_date?: string | null;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";
  review_remarks?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
}

interface BatchItem {
  id: number;
  farmer: number | null;
  farmer_name: string;
  barangay_id?: number | null;
  barangay_name: string;
  livestock_type: number;
  livestock_type_name: string;
  batch_name: string;
  batch_code: string;
  photo_url?: string | null;
  photos?: string[];
  housing_pen: string;
  feed_type: string;
  target_weight: number | string | null;
  target_harvest_date?: string | null;
  status: string;
  notes?: string;
  total_animals: number;
  enrolled_animals?: number;
  pending_animals?: number;
  verified_animals?: number;
  approved_animals?: number;
  revision_animals?: number;
  rejected_animals?: number;
  average_weight: number | string | null;
  animals: ChildAnimal[];
  review_status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED" | "MIXED" | "NO_ANIMALS";
  review_remarks?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

interface BatchSummaryPage {
  count: number;
  results: BatchItem[];
  summary: {
    totalAnimals: number | null;
    totalHerds: number;
    pendingAnimals: number | null;
    verifiedAnimals: number | null;
    approvedAnimals: number | null;
    revisionAnimals: number | null;
    rejectedAnimals: number | null;
  };
}

// ── Futuristic Photo Components with Optical HUD ──────────────────────────

function HerdPhoto({ batch, compact = false }: { batch: BatchItem; compact?: boolean }) {
  const photos = useMemo(() => {
    const list = (batch.photos && batch.photos.length > 0)
      ? batch.photos
      : (batch.photo_url ? [batch.photo_url] : []);

    const seen = new Set<string>();
    const result: string[] = [];
    for (const rawUrl of list) {
      if (!rawUrl) continue;
      let norm = rawUrl.trim();
      try {
        const parsed = new URL(norm, "http://localhost");
        norm = parsed.pathname;
      } catch {
        // use rawUrl
      }
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push(rawUrl);
      }
    }
    return result;
  }, [batch.photos, batch.photo_url]);

  const [photoIndex, setPhotoIndex] = useState(0);
  const avatar = getDefaultAvatarForSpecies(batch.livestock_type_name);
  const safeIndex = photos.length > 0 ? ((photoIndex % photos.length) + photos.length) % photos.length : 0;
  const currentPhoto = photos.length ? photos[safeIndex] : null;

  return (
    <div className={`relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-teal-950 to-emerald-950 ${compact ? "h-14 w-20 shrink-0 rounded-xl border border-emerald-500/30" : "aspect-[16/7] w-full rounded-2xl border border-emerald-500/25 shadow-sm"}`}>
      {/* High-Tech HUD Corner Reticles */}
      <div className="pointer-events-none absolute inset-1.5 z-20">
        <span className="absolute top-0 left-0 size-2 border-t border-l border-emerald-400" />
        <span className="absolute top-0 right-0 size-2 border-t border-r border-emerald-400" />
        <span className="absolute bottom-0 left-0 size-2 border-b border-l border-emerald-400" />
        <span className="absolute bottom-0 right-0 size-2 border-b border-r border-emerald-400" />
      </div>

      {currentPhoto ? (
        <Image
          src={currentPhoto}
          alt={`${batch.batch_name || batch.livestock_type_name + " herd"} photo`}
          fill
          unoptimized
          sizes={compact ? "80px" : "(max-width: 768px) 100vw, 50vw"}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center text-white">
          <span className={compact ? "text-2xl" : "text-5xl"} aria-hidden="true">{avatar.emoji}</span>
          {!compact && (
            <span className="mt-1 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300">
              {batch.livestock_type_name}
            </span>
          )}
        </div>
      )}

      {/* Cyber HUD Overlay Status */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous herd photo"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPhotoIndex((index) => (index === 0 ? photos.length - 1 : index - 1));
            }}
            className={`absolute left-1.5 top-1/2 z-30 grid -translate-y-1/2 place-items-center rounded-lg bg-black/70 text-emerald-300 border border-emerald-500/30 shadow-xs hover:bg-black/90 ${compact ? "size-6" : "size-8"}`}
          >
            <ArrowLeft className={compact ? "size-3" : "size-4"} />
          </button>
          <button
            type="button"
            aria-label="Next herd photo"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPhotoIndex((index) => (index + 1) % photos.length);
            }}
            className={`absolute right-1.5 top-1/2 z-30 grid -translate-y-1/2 place-items-center rounded-lg bg-black/70 text-emerald-300 border border-emerald-500/30 shadow-xs hover:bg-black/90 ${compact ? "size-6" : "size-8"}`}
          >
            <ChevronRight className={compact ? "size-3" : "size-4"} />
          </button>
          <span className="absolute bottom-1.5 right-2 z-30 inline-flex items-center gap-1 rounded-md bg-black/80 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-emerald-300">
            <Camera className="size-2.5 text-emerald-400" /> {safeIndex + 1}/{photos.length}
          </span>
        </>
      )}
    </div>
  );
}

interface GalleryPhoto {
  url: string;
  label: string;
  sublabel?: string;
}

function HerdProfileGallery({ batch }: { batch: BatchItem }) {
  const photos = useMemo<GalleryPhoto[]>(() => {
    const list: GalleryPhoto[] = [];
    const seen = new Set<string>();

    const addPhoto = (
      rawUrl: string | undefined | null,
      label: string,
      sublabel?: string
    ) => {
      if (!rawUrl || typeof rawUrl !== "string") return;
      let norm = rawUrl.trim();
      if (!norm) return;
      try {
        const parsed = new URL(norm, "http://localhost");
        norm = parsed.pathname;
      } catch {
        // use rawUrl
      }
      if (!seen.has(norm)) {
        seen.add(norm);
        list.push({ url: rawUrl, label, sublabel });
      }
    };

    if (batch.photo_url) {
      addPhoto(batch.photo_url, "Main Batch Photo", `${batch.batch_name} (${batch.batch_code})`);
    }

    if (batch.photos && Array.isArray(batch.photos)) {
      batch.photos.forEach((url, i) => {
        addPhoto(url, `Batch Photo 0${i + 1}`, batch.batch_name);
      });
    }

    return list;
  }, [batch.photos, batch.photo_url, batch.batch_name, batch.batch_code]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const currentIndex = photos.length > 0 ? ((activeIndex % photos.length) + photos.length) % photos.length : 0;
  const currentPhoto = photos[currentIndex];

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % photos.length);
  };

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsLightboxOpen(false);
      } else if (e.key === "ArrowLeft") {
        setActiveIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
      } else if (e.key === "ArrowRight") {
        setActiveIndex((prev) => (prev + 1) % photos.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, photos.length]);

  const avatar = getDefaultAvatarForSpecies(batch.livestock_type_name);

  if (photos.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-6 shadow-sm flex flex-col items-center justify-center text-center min-h-[280px] h-full text-slate-800">
        {/* HUD grid */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.035)_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="size-16 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-3xl mb-3">
          {avatar.emoji}
        </div>
        <h3 className="text-sm font-bold font-mono tracking-wide text-emerald-800 uppercase">NO BATCH PHOTOS ADDED</h3>
        <p className="text-xs text-slate-600 max-w-xs mt-1.5 font-sans leading-relaxed">
          The farmer has not uploaded photos for this batch or housing pen yet.
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-emerald-200 text-[11px] font-mono text-emerald-800">
          <Camera className="size-3 text-emerald-600" /> NO PHOTOS AVAILABLE
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-md flex flex-col">
        {/* Gallery Top Bar */}
        <div className="px-4 py-2.5 border-b border-emerald-500/20 flex items-center justify-between gap-2 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex size-2">
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <h3 className="text-xs font-mono font-bold text-emerald-300 leading-tight uppercase tracking-wider truncate">
                BATCH PHOTOS
              </h3>
              <span className="text-[10px] font-mono text-slate-400 truncate block">
                {photos.length} {photos.length === 1 ? "PHOTO" : "PHOTOS"} • {batch.batch_code}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsLightboxOpen(true)}
            className="h-7 px-2 text-[11px] font-mono font-bold text-emerald-400 hover:text-white hover:bg-emerald-500/20 rounded-lg gap-1 cursor-pointer shrink-0 border border-emerald-500/30"
          >
            <Maximize2 className="size-3.5" /> FULLSCREEN
          </Button>
        </div>

        {/* Optical Viewport with Corner Reticles */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsLightboxOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setIsLightboxOpen(true);
          }}
          className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-black overflow-hidden cursor-zoom-in group select-none"
        >
          {/* Cyber HUD Corner Reticles */}
          <div className="pointer-events-none absolute inset-3 z-30">
            <span className="absolute top-0 left-0 size-3 border-t-2 border-l-2 border-emerald-400" />
            <span className="absolute top-0 right-0 size-3 border-t-2 border-r-2 border-emerald-400" />
            <span className="absolute bottom-0 left-0 size-3 border-b-2 border-l-2 border-emerald-400" />
            <span className="absolute bottom-0 right-0 size-3 border-b-2 border-r-2 border-emerald-400" />
          </div>

          {currentPhoto && (
            <Image
              src={currentPhoto.url}
              alt={currentPhoto.label}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}

          {/* Top Right Counter & Expand */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-black/80 backdrop-blur-md px-2.5 py-1 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/40 shadow-xs">
              <Camera className="size-3 text-emerald-400" /> PHOTO {currentIndex + 1} / {photos.length}
            </span>
          </div>

          {/* Bottom Caption Overlay */}
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3.5 pt-7 text-white flex items-end justify-between gap-2 pointer-events-none">
            <div className="min-w-0">
              <span className="inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider mb-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                BATCH PHOTO
              </span>
              <p className="text-xs sm:text-sm font-bold font-mono truncate text-white drop-shadow-xs">
                {currentPhoto?.label}
              </p>
              {currentPhoto?.sublabel && (
                <p className="text-[11px] text-slate-300 font-mono truncate">
                  {currentPhoto.sublabel}
                </p>
              )}
            </div>
          </div>

          {/* Prev / Next Arrows */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={handlePrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-30 size-9 rounded-xl bg-black/70 hover:bg-black text-emerald-300 border border-emerald-500/40 flex items-center justify-center backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-lg"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={handleNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-30 size-9 rounded-xl bg-black/70 hover:bg-black text-emerald-300 border border-emerald-500/40 flex items-center justify-center backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-lg"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail Strip */}
        {photos.length > 1 && (
          <div className="p-2.5 bg-black/60 border-t border-emerald-500/20 flex items-center gap-2 overflow-x-auto scrollbar-thin">
            {photos.map((item, idx) => {
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={`${item.url}-${idx}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(idx);
                  }}
                  className={`relative shrink-0 h-14 w-20 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    isSelected
                      ? "border-emerald-400 ring-2 ring-emerald-500/50 scale-102 shadow-holo-glow-emerald"
                      : "border-slate-800 opacity-60 hover:opacity-100"
                  }`}
                  aria-label={`Select photo ${idx + 1}: ${item.label}`}
                >
                  <Image
                    src={item.url}
                    alt={item.label}
                    fill
                    unoptimized
                    sizes="80px"
                    className="object-cover"
                  />
                  <span className="absolute bottom-1 right-1 bg-black/85 px-1 py-0.2 rounded text-[8px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                    0{idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal with HUD Reticle */}
      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full-size herd photo view"
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-xl p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Lightbox Header */}
          <div
            className="w-full flex items-center justify-between text-white py-2 px-1 max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                PHOTO {currentIndex + 1} OF {photos.length} • {batch.batch_code}
              </span>
              <h4 className="text-sm sm:text-base font-bold font-mono truncate text-white">
                {currentPhoto?.label}
              </h4>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsLightboxOpen(false)}
              className="size-9 rounded-full bg-white/10 hover:bg-emerald-500/20 text-white p-0 flex items-center justify-center cursor-pointer border border-emerald-500/40"
              aria-label="Close fullscreen view"
            >
              <X className="size-5" />
            </Button>
          </div>

          {/* Lightbox Image Container */}
          <div
            className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-auto min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cyber Corner Reticles */}
            <div className="pointer-events-none absolute inset-4 z-20">
              <span className="absolute top-0 left-0 size-4 border-t-2 border-l-2 border-emerald-400" />
              <span className="absolute top-0 right-0 size-4 border-t-2 border-r-2 border-emerald-400" />
              <span className="absolute bottom-0 left-0 size-4 border-b-2 border-l-2 border-emerald-400" />
              <span className="absolute bottom-0 right-0 size-4 border-b-2 border-r-2 border-emerald-400" />
            </div>

            {currentPhoto && (
              <div className="relative h-full w-full max-h-[75vh] flex items-center justify-center">
                <Image
                  src={currentPhoto.url}
                  alt={currentPhoto.label}
                  fill
                  unoptimized
                  sizes="100vw"
                  className="object-contain"
                />
              </div>
            )}

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={handlePrev}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 size-11 sm:size-12 rounded-2xl bg-black/80 hover:bg-black text-emerald-300 border border-emerald-500/40 flex items-center justify-center backdrop-blur-md transition-transform active:scale-95 cursor-pointer shadow-xl"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={handleNext}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 size-11 sm:size-12 rounded-2xl bg-black/80 hover:bg-black text-emerald-300 border border-emerald-500/40 flex items-center justify-center backdrop-blur-md transition-transform active:scale-95 cursor-pointer shadow-xl"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>

          {/* Lightbox Footer Caption */}
          <div
            className="w-full text-center py-2 text-xs font-mono text-slate-400 max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {currentPhoto?.sublabel && <p className="truncate text-emerald-300/80">{currentPhoto.sublabel}</p>}
            <p className="text-[10px] text-slate-500 mt-0.5">Use Left/Right arrows to step frames, ESC to terminate viewport</p>
          </div>
        </div>
      )}
    </>
  );
}

async function fetchAllHerdSummaries(): Promise<BatchSummaryPage> {
  const pageSize = 100;
  const first = (await api.get<BatchSummaryPage>("livestock/batches/", {
    params: { summary: "true", page: 1, page_size: pageSize },
  })).data;
  const pageCount = Math.ceil(first.count / pageSize);
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      api.get<BatchSummaryPage>("livestock/batches/", {
        params: { summary: "true", page: index + 2, page_size: pageSize },
      }),
    ),
  );
  return { ...first, results: [
    ...first.results,
    ...remainingPages.flatMap((response) => response.data.results),
  ] };
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function exportHerdRosterCsv(batches: BatchItem[]) {
  const headers = [
    "Row Type", "Batch Code", "Batch Name", "Farmer", "Barangay", "Livestock Type", "Review Status",
    "Herd Status", "Housing Pen", "Feed Type", "Target Weight", "Target Harvest Date", "Animal Tag",
    "Animal Breed", "Animal Sex", "Animal Weight", "Animal Review Status", "Last Vaccination Date", "Animal Registered At",
  ];
  const rows = batches.flatMap((batch) => {
    const shared = [
      batch.batch_code, batch.batch_name, batch.farmer_name, batch.barangay_name,
      batch.livestock_type_name, batch.review_status, batch.status, batch.housing_pen,
      batch.feed_type, batch.target_weight, batch.target_harvest_date,
    ];
    if (batch.animals?.length) {
      return batch.animals.map((animal) => [
        "Animal", ...shared, animal.tag_number, animal.breed, animal.sex, animal.weight,
        animal.status, animal.last_vaccination_date, animal.created_at,
      ]);
    }
    return [["Batch", ...shared, "", "", "", "", "", "", ""]];
  });
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blobUrl = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `sibat-livestock-batches-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

// ── FUTURISTIC CYBER HERD SPLIT CARD ───────────────────────────────────────

function SibatHerdSplitCard({
  batch,
  isSelected,
  onSelect,
  getStatusBadge,
  isCbat = false,
  onArchive,
  onDelete,
}: {
  batch: BatchItem;
  isSelected: boolean;
  onSelect: () => void;
  getStatusBadge: (status?: string) => React.ReactNode;
  isCbat?: boolean;
  onArchive?: (batch: BatchItem) => void;
  onDelete?: (batch: BatchItem) => void;
}) {
  const photos = useMemo(() => {
    const list = batch.photos && batch.photos.length > 0
      ? batch.photos
      : (batch.photo_url ? [batch.photo_url] : []);

    const seen = new Set<string>();
    const result: string[] = [];
    for (const rawUrl of list) {
      if (!rawUrl) continue;
      let norm = rawUrl.trim();
      try {
        const parsed = new URL(norm, "http://localhost");
        norm = parsed.pathname;
      } catch {
        // use rawUrl
      }
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push(rawUrl);
      }
    }
    return result;
  }, [batch.photos, batch.photo_url]);

  const [photoIndex, setPhotoIndex] = useState(0);
  const avatar = getDefaultAvatarForSpecies(batch.livestock_type_name);
  const hasPhotos = photos.length > 0;
  const currentPhoto = hasPhotos ? photos[photoIndex % photos.length] : null;

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const headCount = batch.total_animals || batch.animals?.length || 0;
  const avgWeight = batch.average_weight ? Number(batch.average_weight) : null;
  const sibatCheckedCount = (batch.verified_animals ?? 0) + (batch.approved_animals ?? 0);
  const verificationProgress = headCount > 0 ? Math.round((sibatCheckedCount / headCount) * 100) : 0;

  const formattedPen = batch.housing_pen
    ? batch.housing_pen.toLowerCase().startsWith("pen")
      ? batch.housing_pen
      : `Pen ${batch.housing_pen}`
    : null;

  return (
    <Card
      onClick={onSelect}
      className={`group cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row justify-between relative ${
        isSelected
          ? "border-emerald-500 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/40 ring-2 ring-emerald-500/50 shadow-holo-glow-emerald"
          : "border-slate-200/90 bg-white/95 hover:border-emerald-500/60 hover:shadow-holo-glow-emerald backdrop-blur-md"
      }`}
    >
      {/* Decorative ambient blur orb */}
      <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />

      {/* ── LEFT HERO OPTICAL SCANNER (Wider, landscape horizontal hero) ── */}
      <div className="relative aspect-[21/9] sm:aspect-auto sm:w-52 md:w-56 lg:w-64 sm:self-stretch min-h-[170px] sm:min-h-full shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900">
        {/* HUD Corner Reticles */}
        <div className="pointer-events-none absolute inset-2 z-20">
          <span className="absolute top-0 left-0 size-2.5 border-t-2 border-l-2 border-emerald-400" />
          <span className="absolute top-0 right-0 size-2.5 border-t-2 border-r-2 border-emerald-400" />
          <span className="absolute bottom-0 left-0 size-2.5 border-b-2 border-l-2 border-emerald-400" />
          <span className="absolute bottom-0 right-0 size-2.5 border-b-2 border-r-2 border-emerald-400" />
        </div>

        {currentPhoto ? (
          <Image
            src={currentPhoto}
            alt={batch.batch_name || `${batch.livestock_type_name} herd`}
            fill
            unoptimized
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-teal-950 to-emerald-950 p-4 text-white">
            <span className="text-4xl drop-shadow-md">{avatar.emoji}</span>
            <span className="mt-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-300">
              {batch.livestock_type_name}
            </span>
          </div>
        )}

        {/* Ambient Dark Gradient on bottom/sides */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/15" />

        {/* Top Badges */}
        <div className="absolute left-2.5 right-2.5 top-2.5 flex items-center justify-between gap-1.5 z-20">
          <Badge className="rounded-full border border-emerald-500/40 bg-black/75 px-2.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-300 backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-emerald-400 inline-block mr-1 animate-pulse" />
            {batch.livestock_type_name}
          </Badge>

          {isSelected && (
            <Badge className="bg-emerald-600 text-white font-mono font-bold text-[9px] gap-1 px-2 py-0.5 shadow-xs border border-emerald-400">
              <Check className="size-2.5 stroke-[3]" /> LOCKED
            </Badge>
          )}
        </div>

        {/* Multiple Pictures Controls (compact chevron buttons) */}
        {photos.length > 1 && (
          <div className="absolute inset-y-0 left-1.5 right-1.5 flex items-center justify-between z-30 pointer-events-none">
            <button
              type="button"
              aria-label="Previous herd picture"
              onClick={handlePrevPhoto}
              className="pointer-events-auto flex size-7 items-center justify-center rounded-lg bg-black/70 text-emerald-300 border border-emerald-500/30 backdrop-blur-md transition-all hover:bg-black/90 hover:scale-110 shadow-xs cursor-pointer"
            >
              <ChevronLeft className="size-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              aria-label="Next herd picture"
              onClick={handleNextPhoto}
              className="pointer-events-auto flex size-7 items-center justify-center rounded-lg bg-black/70 text-emerald-300 border border-emerald-500/30 backdrop-blur-md transition-all hover:bg-black/90 hover:scale-110 shadow-xs cursor-pointer"
            >
              <ChevronRight className="size-4 stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* Bottom Hero Overlay */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white z-20">
          {photos.length > 0 ? (
            <div className="flex items-center gap-1 rounded-md bg-black/80 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-mono font-semibold text-emerald-300 backdrop-blur-md">
              <Camera className="size-3 text-emerald-400" />
              <span>
                FRAME {(photoIndex % photos.length) + 1}/{photos.length}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
              <span>DEFAULT ICON</span>
            </div>
          )}

          <span className="sm:hidden rounded-md bg-black/85 border border-emerald-500/40 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-300 shadow-2xs">
            {batch.batch_code}
          </span>
        </div>
      </div>

      {/* ── RIGHT TELEMETRY CONTENT SECTION ── */}
      <div className="flex flex-1 flex-col justify-between p-3.5 sm:p-4 space-y-2.5 min-w-0">
        <div className="space-y-2.5">
          {/* Header Row: Title, Cohort Chip & Regulatory Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-1">
                  {batch.batch_name || `${batch.livestock_type_name} Herd`}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 border border-emerald-500/30 shrink-0">
                  <Cpu className="size-3 text-emerald-600" />
                  {batch.batch_code}
                </span>
              </div>
            </div>

            <div className="shrink-0">{getStatusBadge(batch.review_status)}</div>
          </div>

          {/* Farmer & Barangay Geo-Coordinates */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 font-mono">
            <span className="inline-flex items-center gap-1 font-bold text-slate-800">
              <User className="size-3.5 shrink-0 text-emerald-600" />
              <span>{batch.farmer_name}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <MapPin className="size-3.5 shrink-0 text-teal-600" />
              <span>{batch.barangay_name || "Padre Garcia"}</span>
            </span>
            {formattedPen && (
              <>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                  <Building2 className="size-3 shrink-0 text-slate-400" />
                  <span>{formattedPen}</span>
                </span>
              </>
            )}
          </div>

          {/* Inspection Progress Gauge */}
          <div className="rounded-xl border border-emerald-500/20 bg-slate-50/80 p-2.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-800">
              <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                <span>INSPECTION PROGRESS</span>
              </span>
              <span className={`font-mono font-bold ${batch.review_status === "APPROVED" ? "text-emerald-700" : "text-sky-700"}`}>
                {verificationProgress}% Inspected ({sibatCheckedCount}/{headCount} heads)
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 relative">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  batch.review_status === "APPROVED"
                    ? "bg-emerald-600"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${verificationProgress}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-500 font-medium">
              <span>{batch.approved_animals ?? 0} approved · {batch.pending_animals ?? 0} pending check</span>
              {batch.target_weight && <span className="text-emerald-700 font-bold">Target: {batch.target_weight} kg</span>}
            </div>
          </div>

          {/* Metric Chips */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-slate-200/80 bg-white p-2 text-center shadow-2xs">
              <span className="block text-slate-400 text-[9px] uppercase tracking-wider font-bold">TOTAL HEADS</span>
              <span className="text-slate-900 font-black text-xs block mt-0.5 font-mono">
                {headCount} {headCount === 1 ? "HEAD" : "HEADS"}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-2 text-center shadow-2xs">
              <span className="block text-slate-400 text-[9px] uppercase tracking-wider font-bold">AVERAGE WEIGHT</span>
              <span className="text-slate-900 font-black text-xs block mt-0.5 font-mono">
                {avgWeight ? `${avgWeight} kg` : "UNWEIGHED"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: Picture Counter & Review Herd Button */}
        <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            {photos.length > 0 ? `${photos.length} photos` : "Standard profile"}
          </span>

          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`h-8.5 px-3.5 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer ${
              isSelected
                ? "bg-emerald-700 text-white hover:bg-emerald-800"
                : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
            }`}
          >
            <span>{isCbat ? "VIEW HERD" : "VIEW BATCH"}</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>

      {/* ── CBAT EMPTY HERD OVERLAY ── */}
      {isCbat && headCount === 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-slate-950/85 backdrop-blur-xs p-4 text-center border-2 border-dashed border-amber-400/60 shadow-xl"
        >
          <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 mb-2 shadow-xs">
            <AlertTriangle className="size-5" />
          </div>
          <span className="text-sm font-black font-mono uppercase tracking-widest text-amber-300">
            HERD EMPTY
          </span>
          <p className="mt-1 text-xs text-slate-300 max-w-[240px] leading-relaxed">
            This herd currently has 0 registered animals. You can archive or delete this record.
          </p>
          <div className="mt-3.5 flex items-center gap-2 flex-wrap justify-center">
            {onArchive && (
              <Button
                type="button"
                size="sm"
                onClick={() => onArchive(batch)}
                className="h-8 px-3.5 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 border border-amber-400/40 text-xs font-bold gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Archive className="size-3.5" />
                <span>Archive</span>
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                size="sm"
                onClick={() => onDelete(batch)}
                className="h-8 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </Button>
            )}
          </div>
          <button
            type="button"
            onClick={onSelect}
            className="mt-2.5 text-[11px] font-mono text-slate-400 hover:text-white underline cursor-pointer"
          >
            View Details
          </button>
        </div>
      )}
    </Card>
  );
}

// ── MAIN COMPONENT: SibatBatchesVerificationContent ─────────────────────────

function SibatBatchesVerificationContent() {
  const { user } = useAuth();
  const isCbat = user?.role?.toUpperCase() === "CBAT";
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const batchIdParam = searchParams.get("batchId") || searchParams.get("id");
  const animalIdParam = searchParams.get("animalId") || searchParams.get("livestockId");
  const tagParam = searchParams.get("tag") || searchParams.get("tagNumber");
  const fromParam = searchParams.get("from");
  const isFromRegistry = Boolean(
    fromParam === "registry" ||
    fromParam === "livestock-registry" ||
    animalIdParam ||
    tagParam ||
    (typeof document !== "undefined" && document.referrer?.includes("/sibat/livestock-registry"))
  );
  const herdPageTitle = user?.accessScope === "ALL_BARANGAYS"
    ? "Herds in All Barangays"
    : user?.assignedBarangayName
      ? `Herds in ${user.assignedBarangayName}`
      : "Herds";

  // ── States ───────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [barangayFilter, setBarangayFilter] = useState<string>("ALL");
  const activeBarangayFilter = user?.accessScope === "ALL_BARANGAYS" ? barangayFilter : "ALL";
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const BATCH_PAGE_SIZE = 10;
  const batchFilterKey = JSON.stringify([searchQuery, speciesFilter, statusFilter, activeBarangayFilter]);
  const [batchPageState, setBatchPageState] = useState({ filterKey: batchFilterKey, page: 1 });
  const batchPage = batchPageState.filterKey === batchFilterKey ? batchPageState.page : 1;
  const setBatchPage = (nextPage: number | ((currentPage: number) => number)) =>
    setBatchPageState({
      filterKey: batchFilterKey,
      page: typeof nextPage === "function" ? nextPage(batchPage) : nextPage,
    });

  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [selectedAnimalReview, setSelectedAnimalReview] = useState<UnifiedSubmissionItem | null>(null);
  const [animalSearchQuery, setAnimalSearchQuery] = useState("");
  const [animalStatusFilter, setAnimalStatusFilter] = useState<string>("ALL");
  const animalSelectionKey = JSON.stringify([selectedBatch?.id, animalSearchQuery, animalStatusFilter]);
  const [animalSelectionState, setAnimalSelectionState] = useState({ key: animalSelectionKey, ids: [] as number[] });
  const selectedAnimalIds = animalSelectionState.key === animalSelectionKey ? animalSelectionState.ids : [];
  const setSelectedAnimalIds = (nextIds: number[] | ((currentIds: number[]) => number[])) =>
    setAnimalSelectionState((current) => {
      const currentIds = current.key === animalSelectionKey ? current.ids : [];
      return {
        key: animalSelectionKey,
        ids: typeof nextIds === "function" ? nextIds(currentIds) : nextIds,
      };
    });
  const [bulkVerifyOpen, setBulkVerifyOpen] = useState(false);
  const [bulkVerifying, setBulkVerifying] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    type: "archive" | "delete";
    batch: BatchItem;
  } | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const handleArchiveConfirm = async () => {
    if (!confirmAction) return;
    setIsProcessingAction(true);
    try {
      await api.patch(`livestock/batches/${confirmAction.batch.id}/`, {
        status: "ARCHIVED",
      });
      toast.success(`Herd ${confirmAction.batch.batch_code} archived successfully.`, {
        description: "The empty herd has been moved to archived status.",
      });
      queryClient.invalidateQueries({ queryKey: ["sibat-batches-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
      setConfirmAction(null);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string; detail?: string } } }).response?.data?.error ||
            (err as { response?: { data?: { error?: string; detail?: string } } }).response?.data?.detail ||
            "Failed to archive herd."
          : "Failed to archive herd.";
      toast.error(message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmAction) return;
    setIsProcessingAction(true);
    try {
      await api.delete(`livestock/batches/${confirmAction.batch.id}/`);
      toast.success(`Herd ${confirmAction.batch.batch_code} deleted successfully.`, {
        description: "The empty herd has been permanently removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["sibat-batches-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
      setConfirmAction(null);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string; detail?: string } } }).response?.data?.error ||
            (err as { response?: { data?: { error?: string; detail?: string } } }).response?.data?.detail ||
            "Failed to delete herd."
          : "Failed to delete herd.";
      toast.error(message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const [animalViewMode, setAnimalViewMode] = useState<"card" | "table">("card");

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnimalViewMode("table");
    }
  }, []);

  const [highlightedAnimalId, setHighlightedAnimalId] = useState<number | null>(null);
  const scrolledAnimalIdRef = useRef<number | null>(null);

  const [batchNoteText, setBatchNoteText] = useState("");
  const [showBatchNotes, setShowBatchNotes] = useState(false);

  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // ── Data Fetching ────────────────────────────────────────────────────────
  const {
    data: batchSummaryPage,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useQuery<BatchSummaryPage>({
    queryKey: ["sibat-batches-drilldown", user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: fetchAllHerdSummaries,
    enabled: Boolean(user?.email),
    staleTime: 30_000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const batches = batchSummaryPage?.results ?? [];
  const isInitialLoading = isLoading && !batchSummaryPage;
  const keepLoadingScreenMounted = useLoadingScreenTransition(isInitialLoading);

  const detailQuery = useQuery<BatchItem>({
    queryKey: ["sibat-batch-detail", selectedBatch?.id],
    enabled: isDrilldownOpen && Boolean(selectedBatch?.id),
    queryFn: async ({ signal }) => (await api.get(`livestock/batches/${selectedBatch?.id}/`, { signal })).data,
    staleTime: 30_000,
  });

  const activeBatch = (detailQuery.data && detailQuery.data.id === selectedBatch?.id ? detailQuery.data : null) ?? selectedBatch;

  useEffect(() => {
    if (!batchIdParam || !batches || batches.length === 0) return;

    const rawParam = String(batchIdParam).trim();
    const numericId = Number(rawParam.replace(/\D/g, ""));

    const found = batches.find((b) => {
      if (numericId && b.id === numericId) return true;
      if (String(b.id) === rawParam) return true;
      if (b.batch_code && b.batch_code.toLowerCase() === rawParam.toLowerCase()) return true;
      if (b.batch_name && b.batch_name.toLowerCase() === rawParam.toLowerCase()) return true;
      return false;
    });

    if (found) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedBatch(found);
      setIsDrilldownOpen(true);
    }
  }, [batchIdParam, batches]);

  const speciesList = useMemo(() => {
    const set = new Set<string>();
    batches.forEach((b) => {
      if (b.livestock_type_name) set.add(b.livestock_type_name);
    });
    return Array.from(set).sort();
  }, [batches]);

  // ── Scoped Batches (Accounting for Search, Species & Barangay) ───────────
  const scopedBatches = useMemo(() => {
    return batches.filter((b) => {
      const matchSearch =
        !searchQuery ||
        b.batch_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.batch_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.farmer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.barangay_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchSpecies =
        speciesFilter === "ALL" ||
        b.livestock_type_name?.trim().toLowerCase() === speciesFilter.trim().toLowerCase();

      const matchBarangay =
        activeBarangayFilter === "ALL" ||
        b.barangay_name?.trim().toLowerCase() === activeBarangayFilter.trim().toLowerCase();

      return matchSearch && matchSpecies && matchBarangay;
    });
  }, [batches, searchQuery, speciesFilter, activeBarangayFilter]);

  // ── Filtered Batches (Filtered by Status) ─────────────────────────────────
  const filteredBatches = useMemo(() => {
    if (statusFilter === "ALL") return scopedBatches;
    return scopedBatches.filter((b) => {
      if (statusFilter === "PENDING") {
        return b.review_status === "PENDING" || (b.pending_animals ?? 0) > 0;
      }
      if (statusFilter === "VERIFIED") {
        return b.review_status === "VERIFIED" || (b.verified_animals ?? 0) > 0;
      }
      if (statusFilter === "APPROVED") {
        return b.review_status === "APPROVED" || (b.approved_animals ?? 0) > 0;
      }
      if (statusFilter === "SUBJECT_TO_REVISION") {
        return b.review_status === "SUBJECT_TO_REVISION" || (b.revision_animals ?? 0) > 0;
      }
      return false;
    });
  }, [scopedBatches, statusFilter]);

  // ── KPIs connected directly to the actual data ───────────────────────────
  const kpis = useMemo(() => {
    const activeList = statusFilter === "ALL" ? scopedBatches : filteredBatches;

    const totalHerds = activeList.length;
    const totalAnimals = activeList.reduce(
      (sum, b) => sum + (b.total_animals || b.animals?.length || 0),
      0
    );
    const verifiedAnimals = activeList.reduce(
      (sum, b) => sum + (b.verified_animals ?? 0),
      0
    );
    const pendingAnimals = activeList.reduce(
      (sum, b) => sum + (b.pending_animals ?? 0),
      0
    );
    const revisionAnimals = activeList.reduce(
      (sum, b) => sum + (b.revision_animals ?? 0),
      0
    );
    const approvedAnimals = activeList.reduce(
      (sum, b) => sum + (b.approved_animals ?? 0),
      0
    );

    const avgHeads = totalHerds > 0 ? Math.round(totalAnimals / totalHerds) : 0;
    const verificationRate =
      totalAnimals > 0
        ? Math.round(((verifiedAnimals + approvedAnimals) / totalAnimals) * 100)
        : 0;

    return {
      totalBatches: totalHerds,
      totalAnimals,
      verifiedAnimals,
      pendingAnimals,
      revisionAnimals,
      approvedAnimals,
      avgHeads,
      verificationRate,
    };
  }, [scopedBatches, filteredBatches, statusFilter]);

  // ── Status dropdown counts reflecting scoped herds ────────────────────────
  const statusCounts = useMemo(() => {
    return {
      all: scopedBatches.length,
      pending: scopedBatches.filter((b) => b.review_status === "PENDING" || (b.pending_animals ?? 0) > 0).length,
      verified: scopedBatches.filter((b) => b.review_status === "VERIFIED" || (b.verified_animals ?? 0) > 0).length,
      approved: scopedBatches.filter((b) => b.review_status === "APPROVED" || (b.approved_animals ?? 0) > 0).length,
      revision: scopedBatches.filter((b) => b.review_status === "SUBJECT_TO_REVISION" || (b.revision_animals ?? 0) > 0).length,
    };
  }, [scopedBatches]);

  const filteredChildAnimals = useMemo(() => {
    if (!activeBatch || !activeBatch.animals) return [];
    return activeBatch.animals.filter((a) => {
      const matchSearch =
        !animalSearchQuery ||
        a.tag_number?.toLowerCase().includes(animalSearchQuery.toLowerCase()) ||
        a.breed?.toLowerCase().includes(animalSearchQuery.toLowerCase()) ||
        a.sex?.toLowerCase().includes(animalSearchQuery.toLowerCase());

      const matchStatus =
        animalStatusFilter === "ALL" ||
        (animalStatusFilter === "SUBJECT_TO_REVISION"
          ? (a.status || "").toUpperCase() === "SUBJECT_TO_REVISION" || (a.status || "").toUpperCase() === "SUBJECT_FOR_REVISION"
          : (a.status || "PENDING").toUpperCase() === animalStatusFilter);

      return matchSearch && matchStatus;
    });
  }, [activeBatch, animalSearchQuery, animalStatusFilter]);

  // ── Pagination: Batch Table View ─────────────────────────────────────────
  const pageCountBatches = Math.max(1, Math.ceil(filteredBatches.length / BATCH_PAGE_SIZE));
  const safeBatchPage = Math.min(batchPage, pageCountBatches);
  const pagedBatches = useMemo(
    () =>
      filteredBatches.slice(
        (safeBatchPage - 1) * BATCH_PAGE_SIZE,
        (safeBatchPage - 1) * BATCH_PAGE_SIZE + BATCH_PAGE_SIZE,
      ),
    [filteredBatches, safeBatchPage],
  );

  // ── Pagination: Individual Animal Roster ─────────────────────────────────
  const ANIMAL_PAGE_SIZE = 10;
  const animalPageFilterKey = JSON.stringify([activeBatch?.id, animalSearchQuery, animalStatusFilter]);
  const [animalPageState, setAnimalPageState] = useState({ filterKey: animalPageFilterKey, page: 1 });
  const animalPage = animalPageState.filterKey === animalPageFilterKey ? animalPageState.page : 1;
  const setAnimalPage = (nextPage: number | ((currentPage: number) => number)) =>
    setAnimalPageState({
      filterKey: animalPageFilterKey,
      page: typeof nextPage === "function" ? nextPage(animalPage) : nextPage,
    });
  const pageCountAnimals = Math.max(1, Math.ceil(filteredChildAnimals.length / ANIMAL_PAGE_SIZE));
  const safeAnimalPage = Math.min(animalPage, pageCountAnimals);
  const pagedChildAnimals = useMemo(
    () =>
      filteredChildAnimals.slice(
        (safeAnimalPage - 1) * ANIMAL_PAGE_SIZE,
        (safeAnimalPage - 1) * ANIMAL_PAGE_SIZE + ANIMAL_PAGE_SIZE,
      ),
    [filteredChildAnimals, safeAnimalPage],
  );
  const filteredPendingAnimalIds = filteredChildAnimals
    .filter((animal) => (animal.status || "PENDING").toUpperCase() === "PENDING")
    .map((animal) => animal.id);
  const selectedPendingAnimals = (activeBatch?.animals ?? []).filter(
    (animal) => selectedAnimalIds.includes(animal.id) && (animal.status || "PENDING").toUpperCase() === "PENDING",
  );
  const allFilteredPendingAnimalsSelected = filteredPendingAnimalIds.length > 0
    && filteredPendingAnimalIds.every((id) => selectedAnimalIds.includes(id));

  useEffect(() => {
    if (!isDrilldownOpen || !activeBatch?.animals || activeBatch.animals.length === 0) {
      return;
    }
    if (!animalIdParam && !tagParam) return;

    const animals = activeBatch.animals;
    const target = animals.find((a) => {
      if (animalIdParam && String(a.id) === String(animalIdParam)) return true;
      if (tagParam && a.tag_number && a.tag_number.trim().toLowerCase() === tagParam.trim().toLowerCase()) return true;
      return false;
    });

    if (!target) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedAnimalId(target.id);

    if (animalSearchQuery) setAnimalSearchQuery("");
    if (animalStatusFilter !== "ALL") setAnimalStatusFilter("ALL");

    const targetIndex = animals.findIndex((a) => a.id === target.id);
    if (targetIndex !== -1) {
      const targetPage = Math.floor(targetIndex / ANIMAL_PAGE_SIZE) + 1;
      setAnimalPage(targetPage);
    }
  }, [isDrilldownOpen, activeBatch?.id, activeBatch?.animals, animalIdParam, tagParam]);

  useEffect(() => {
    if (!highlightedAnimalId || scrolledAnimalIdRef.current === highlightedAnimalId) return;

    let attempts = 0;
    const maxAttempts = 15;
    const interval = setInterval(() => {
      attempts++;
      const targetEl =
        document.getElementById(`animal-row-${highlightedAnimalId}`) ||
        document.getElementById(`animal-card-${highlightedAnimalId}`);

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        scrolledAnimalIdRef.current = highlightedAnimalId;
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [highlightedAnimalId, animalPage, pagedChildAnimals]);

  // ── Gmail-style Selection & Mobile Press-Down (Long-Press) ────────────────
  const lastSelectedAnimalIdRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressTriggeredRef = useRef(false);

  function handleAnimalPressDown(animalId: number, isPending: boolean, e: React.PointerEvent) {
    if (!isPending) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    isLongPressTriggeredRef.current = false;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate?.(45);
        } catch {
          // ignore
        }
      }
      setSelectedAnimalIds((current) =>
        current.includes(animalId)
          ? current.filter((id) => id !== animalId)
          : Array.from(new Set([...current, animalId]))
      );
      lastSelectedAnimalIdRef.current = animalId;
    }, 400);
  }

  function handleAnimalPressMove(e: React.PointerEvent) {
    if (!touchStartPosRef.current) return;
    const deltaX = Math.abs(e.clientX - touchStartPosRef.current.x);
    const deltaY = Math.abs(e.clientY - touchStartPosRef.current.y);

    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }

  function handleAnimalPressUp() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }

  function handleAnimalToggle(animalId: number, isPending: boolean, shiftKey?: boolean) {
    if (!isPending) return;

    if (shiftKey && lastSelectedAnimalIdRef.current !== null) {
      const visibleAnimals = pagedChildAnimals;
      const indexA = visibleAnimals.findIndex((a) => a.id === lastSelectedAnimalIdRef.current);
      const indexB = visibleAnimals.findIndex((a) => a.id === animalId);

      if (indexA !== -1 && indexB !== -1) {
        const start = Math.min(indexA, indexB);
        const end = Math.max(indexA, indexB);
        const rangePendingIds = visibleAnimals
          .slice(start, end + 1)
          .filter((a) => (a.status || "PENDING").toUpperCase() === "PENDING")
          .map((a) => a.id);

        setSelectedAnimalIds((current) => Array.from(new Set([...current, ...rangePendingIds])));
        lastSelectedAnimalIdRef.current = animalId;
        return;
      }
    }

    setSelectedAnimalIds((current) =>
      current.includes(animalId)
        ? current.filter((id) => id !== animalId)
        : [...current, animalId]
    );
    lastSelectedAnimalIdRef.current = animalId;
  }

  function selectAllFilteredPending() {
    setSelectedAnimalIds(filteredPendingAnimalIds);
  }

  function deselectAllAnimals() {
    setSelectedAnimalIds([]);
    lastSelectedAnimalIdRef.current = null;
  }

  function toggleFilteredPendingAnimals(checked: boolean) {
    if (checked) {
      if (filteredPendingAnimalIds.length > 0) {
        setSelectedAnimalIds([filteredPendingAnimalIds[0]]);
        lastSelectedAnimalIdRef.current = filteredPendingAnimalIds[0];
      }
    } else {
      deselectAllAnimals();
    }
  }

  async function verifySelectedAnimals() {
    if (!activeBatch || selectedPendingAnimals.length === 0 || selectedPendingAnimals.length !== selectedAnimalIds.length) return;
    setBulkVerifying(true);
    try {
      const results = await Promise.allSettled(selectedPendingAnimals.map((animal) =>
        api.post(`livestock/inventory/${animal.id}/review/`, {
          status: "VERIFIED",
          remarks: "Field verification completed in the herd registry.",
        }),
      ));
      const verifiedCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - verifiedCount;
      setBulkVerifyOpen(false);
      setSelectedAnimalIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sibat-batches-drilldown"] }),
        queryClient.invalidateQueries({ queryKey: ["sibat-batch-detail", activeBatch.id] }),
        queryClient.invalidateQueries({ queryKey: ["sibat", "livestock-registry"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
      await detailQuery.refetch();
      if (failedCount > 0) {
        toast.warning(`${verifiedCount} animal${verifiedCount === 1 ? "" : "s"} verified. ${failedCount} could not be verified.`, {
          description: "Refresh the herd and review the remaining animals individually.",
        });
      } else {
        toast.success(`${verifiedCount} animal${verifiedCount === 1 ? "" : "s"} verified.`, {
          description: "These records are now ready for MAO review.",
        });
      }
    } catch {
      toast.error("Could not verify the selected animals. Please try again.");
    } finally {
      setBulkVerifying(false);
    }
  }

  const addBatchNoteMutation = useMutation({
    mutationFn: async ({ batchId, text }: { batchId: number; text: string }) => {
      const res = await api.post(`livestock/batches/${batchId}/notes/`, { text });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Note added to batch audit trail.", {
        description: "The farmer can now see this note on the herd page.",
      });
      queryClient.invalidateQueries({ queryKey: ["sibat-batches-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["sibat-batch-detail"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
      setBatchNoteText("");
    },
    onError: (err) => {
      console.error("Batch note failed:", err);
      toast.error("Failed to add note. Please try again.");
    },
  });

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    toast.success(`Tag copied: ${tag}`);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  function openHerdDrilldown(batch: BatchItem) {
    const cachedDetail = queryClient.getQueryData<BatchItem>([
      "sibat-batch-detail",
      batch.id,
    ]);
    setSelectedBatch(cachedDetail ?? batch);
    setIsDrilldownOpen(true);
  }

  function closeHerdDrilldown() {
    setIsDrilldownOpen(false);
    setSelectedBatch(null);
    setHighlightedAnimalId(null);
    scrolledAnimalIdRef.current = null;
    if (isFromRegistry) {
      router.push("/sibat/livestock-registry");
    } else {
      if (batchIdParam) router.replace("/sibat/batches", { scroll: false });
    }
  }

  function openAnimalReview(batch: BatchItem, animal: ChildAnimal) {
    setSelectedAnimalReview({
      id: `inv-${animal.id}`,
      rawId: animal.id,
      sourceType: "INVENTORY",
      submissionTypeLabel: "Livestock Inventory",
      farmerName: batch.farmer_name,
      barangayName: batch.barangay_name,
      livestockTypeName: batch.livestock_type_name,
      detailsTitle: `${animal.tag_number || `Animal #${animal.id}`} (${batch.livestock_type_name})`,
      quantityDisplay: "1 head",
      quantity: 1,
      unit: "head",
      recordDate: animal.created_at || batch.created_at,
      status: animal.status,
      notes: animal.review_remarks || "",
      breed: animal.breed,
      tagNumber: animal.tag_number,
      sex: animal.sex,
      weight: animal.weight == null ? null : Number(animal.weight),
      entryType: "INDIVIDUAL",
      batchId: batch.id,
      batchCode: batch.batch_code,
      batchName: batch.batch_name,
      photoUrl: animal.photo_url,
      lastVaccinationDate: animal.last_vaccination_date || null,
      reviewRemarks: animal.review_remarks || null,
      reviewedAt: animal.reviewed_at || null,
      reviewedByName: animal.reviewed_by_name || null,
      createdAt: animal.created_at || batch.created_at,
    });
  }

  // ── Futuristic Status Badges ──────────────────────────────────────────────
  const getStatusBadge = (status?: string) => {
    const s = (status || "PENDING").toUpperCase();
    if (s === "MIXED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
          <Activity className="size-3 text-slate-500" />
          MIXED STATUS
        </span>
      );
    }
    if (s === "NO_ANIMALS") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-400 border border-slate-200">
          EMPTY COHORT
        </span>
      );
    }
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-800 border border-emerald-500/40 shadow-2xs">
          <CheckCircle2 className="size-3 text-emerald-600" />
          MAO APPROVED
        </span>
      );
    }
    if (s === "VERIFIED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-500/15 text-sky-800 border border-sky-500/40 shadow-2xs">
          <ShieldCheck className="size-3 text-sky-600" />
          SIBAT VERIFIED
        </span>
      );
    }
    if (s === "SUBJECT_TO_REVISION" || s === "SUBJECT_FOR_REVISION") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/15 text-rose-800 border border-rose-500/40 shadow-2xs">
          <AlertTriangle className="size-3 text-rose-600" />
          REVISION PROTOCOL
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-800 border border-amber-500/40 shadow-2xs">
        <Clock className="size-3 text-amber-600" />
        AUDIT QUEUE
      </span>
    );
  };

  const getAnimalStatusBadge = (status?: string) => {
    const s = (status || "PENDING").toUpperCase();
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-800 border border-emerald-500/40">
          <CheckCircle2 className="size-2.5 text-emerald-600" /> APPROVED
        </span>
      );
    }
    if (s === "VERIFIED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-500/15 text-sky-800 border border-sky-500/40">
          <ShieldCheck className="size-2.5 text-sky-600" /> VERIFIED
        </span>
      );
    }
    if (s === "SUBJECT_TO_REVISION" || s === "SUBJECT_FOR_REVISION" || s === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/15 text-rose-800 border border-rose-500/40">
          <AlertTriangle className="size-2.5 text-rose-600" /> REVISE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-800 border border-amber-500/40">
        <Clock className="size-2.5 text-amber-600" /> PENDING
      </span>
    );
  };

  const getSpeciesColor = (species: string) => {
    const s = species?.toLowerCase() || "";
    if (s.includes("cattle") || s.includes("cow")) return "bg-emerald-50 text-emerald-800 border-emerald-300";
    if (s.includes("swine") || s.includes("pig")) return "bg-rose-50 text-rose-800 border-rose-300";
    if (s.includes("carabao")) return "bg-stone-100 text-stone-800 border-stone-300";
    if (s.includes("goat")) return "bg-amber-50 text-amber-800 border-amber-300";
    if (s.includes("poultry") || s.includes("chicken")) return "bg-orange-50 text-orange-800 border-orange-300";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  if (isInitialLoading || keepLoadingScreenMounted) {
    return (
      <div className="w-full space-y-6">
        <PageHeader
          title={
            <>
              <span className="hidden sm:inline">Livestock Groups &amp; Batches</span>
              <span className="sm:hidden">Livestock Batches</span>
            </>
          }
          subtitle={
            <>
              <span className="hidden sm:inline">
                Monitor, review, and inspect farmer-registered livestock herds, animal batches, and feeding pens.
              </span>
              <span className="sm:hidden">
                Inspect registered livestock herds and batches.
              </span>
            </>
          }
          variant="sibat"
          maxWidthClass="w-full"
          icon={<Layers className="size-5 text-white" />}
          hideIconOnMobile
          showTutorialToggle={false}
          mobileActionsInline
        />
        <div className="mx-auto w-full p-4 sm:p-6 lg:px-8 lg:py-8 space-y-6">
          <ValidationLoadingScreen
            isLoading={isInitialLoading}
            title="Loading Livestock Batches & Herds"
            subtitle="Connecting registered animal batches, head counts, and barangay records..."
            badgeLabel="Livestock Sync"
            authorityText="SIBAT Field Inspection · Padre Garcia, Batangas"
            items={[
              {
                id: "batches",
                label: "Animal Groups & Batches",
                sublabel: "Swine, poultry, goat, and cattle batches",
                icon: <Layers className="size-4 text-emerald-600" />,
                loaded: !isLoading,
              },
              {
                id: "roster",
                label: "Ear Tags & Animal List",
                sublabel: "Individual tag numbers and health inspection records",
                icon: <ShieldCheck className="size-4 text-sky-600" />,
                loaded: !isLoading,
              },
              {
                id: "barangay",
                label: "Barangay Coverage",
                sublabel: "Assigned barangay area records",
                icon: <MapPin className="size-4 text-amber-600" />,
                loaded: !isLoading,
              },
            ]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={
          isDrilldownOpen && activeBatch ? (
            <>
              <span className="hidden sm:inline">{activeBatch.batch_name || (isCbat ? "Herd Details" : "Animal Batch Details")}</span>
              <span className="sm:hidden">{activeBatch.batch_name || (isCbat ? "Herd Details" : "Batch Details")}</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">{isCbat ? "Livestock Herds & Groups" : "Livestock Groups & Batches"}</span>
              <span className="sm:hidden">{isCbat ? "Livestock Herds" : "Livestock Batches"}</span>
            </>
          )
        }
        subtitle={
          isDrilldownOpen && activeBatch ? (
            <>
              <span className="hidden sm:inline">
                Farmer: {activeBatch.farmer_name} • Barangay: {activeBatch.barangay_name} • {activeBatch.animals?.length || activeBatch.total_animals} heads
              </span>
              <span className="sm:hidden">
                {activeBatch.farmer_name} • Brgy. {activeBatch.barangay_name}
              </span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">
                {isCbat
                  ? "Monitor, review, and inspect farmer-registered livestock herds, cattle groups, and breeding pens."
                  : "Monitor, review, and inspect farmer-registered livestock herds, animal batches, and feeding pens."}
              </span>
              <span className="sm:hidden">
                {isCbat
                  ? "Inspect registered livestock herds."
                  : "Inspect registered livestock herds and batches."}
              </span>
            </>
          )
        }
        variant="sibat"
        maxWidthClass="w-full"
        icon={<Layers className="size-5 text-white" />}
        hideIconOnMobile
        showTutorialToggle={false}
        mobileActionsInline
        action={
          isDrilldownOpen ? undefined : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => exportHerdRosterCsv(filteredBatches)}
                disabled={isLoading || filteredBatches.length === 0}
                className="h-10 rounded-xl border-white/20 bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs gap-1.5 cursor-pointer backdrop-blur-xs"
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Download CSV ({filteredBatches.length})</span>
                <span className="sm:hidden">CSV</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="h-10 rounded-xl border-white/20 bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs gap-1.5 cursor-pointer backdrop-blur-xs"
              >
                <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh Data</span>
              </Button>
            </div>
          )
        }
      />

      <div className="w-full space-y-6 px-4 sm:px-6 lg:px-8 py-6 pb-28">
        {isDrilldownOpen && (
          <div className="flex items-center justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeHerdDrilldown}
              className="h-10 rounded-xl border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-900 text-xs sm:text-sm font-semibold transition-all shadow-xs gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="size-4 text-emerald-700" />
              <span>
                {isFromRegistry
                  ? "Back to Livestock Registry"
                  : isCbat
                    ? "Back to Herds"
                    : "Back to Batches"}
              </span>
            </Button>
          </div>
        )}

        {/* ── 1. SUB-BANNER: BARANGAY COVERAGE & CONTROLS ───────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-emerald-200/90 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <MapPin className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800">
                  Inspection Area
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  SIBAT / CBAT
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                {user?.accessScope === "ALL_BARANGAYS" ? "All Authorized Barangays (Full Access)" : user?.assignedBarangayName || "Assigned Barangay"}
              </h2>
            </div>
          </div>

          {!isDrilldownOpen && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-white text-emerald-800 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="size-3.5" />
                  CARDS
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === "table"
                      ? "bg-white text-emerald-800 font-bold shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <List className="size-3.5" />
                  TABLE
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 2. MAIN BATCHES VIEW (When drilldown is closed) ────────────────── */}
        <div className={isDrilldownOpen ? "hidden" : "space-y-6"}>
          {/* KPI SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Tile 1: Total Batches */}
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                statusFilter === "ALL"
                  ? "border-emerald-500 bg-white ring-2 ring-emerald-400/40 shadow-sm"
                  : "border-emerald-200 bg-white hover:border-emerald-300 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                <span>{isCbat ? "REGISTERED HERDS" : "REGISTERED BATCHES"}</span>
                <Layers className="size-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                  {kpis.totalBatches}
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">{isCbat ? "Active animal herds" : "Active animal batches"}</p>
            </button>

            {/* Tile 2: Total Heads */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                <span>TOTAL HEAD COUNT</span>
                <Activity className="size-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                  {kpis.totalAnimals}
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  HEADS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">~{kpis.avgHeads} animals per {isCbat ? "herd" : "batch"}</p>
            </div>

            {/* Tile 3: Field Verified */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "VERIFIED" ? "ALL" : "VERIFIED")}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                statusFilter === "VERIFIED"
                  ? "border-emerald-500 bg-white ring-2 ring-emerald-400/40 shadow-sm"
                  : "border-emerald-200 bg-white hover:border-emerald-300 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                <span>{isCbat ? "INSPECTED (VERIFIED)" : "INSPECTED BY SIBAT"}</span>
                <ShieldCheck className="size-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 tracking-tight">
                  {kpis.verifiedAnimals}
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  {kpis.verificationRate}% CHECKED
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">Forwarded to MAO for approval</p>
            </button>

            {/* Tile 4: Pending Check */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "PENDING" ? "ALL" : "PENDING")}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                statusFilter === "PENDING"
                  ? "border-amber-500 bg-white ring-2 ring-amber-400/40 shadow-sm"
                  : "border-amber-200 bg-white hover:border-amber-300 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                <span>{isCbat ? "AWAITING CHECK" : "AWAITING SIBAT CHECK"}</span>
                <Clock className={`size-4 ${kpis.pendingAnimals > 0 ? "text-amber-600 animate-pulse" : "text-slate-400"}`} />
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${kpis.pendingAnimals > 0 ? "text-amber-600" : "text-slate-400"}`}>
                  {kpis.pendingAnimals}
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  FOR REVIEW
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">New farmer submissions</p>
            </button>

            {/* Tile 5: Returned for Revision */}
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "SUBJECT_TO_REVISION" ? "ALL" : "SUBJECT_TO_REVISION")}
              className={`col-span-2 sm:col-span-1 relative overflow-hidden rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                statusFilter === "SUBJECT_TO_REVISION"
                  ? "border-rose-500 bg-white ring-2 ring-rose-400/40 shadow-sm"
                  : "border-rose-200 bg-white hover:border-rose-300 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                <span>RETURNED FOR REVISION</span>
                <AlertTriangle className={`size-4 ${kpis.revisionAnimals > 0 ? "text-rose-600 animate-bounce" : "text-slate-400"}`} />
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${kpis.revisionAnimals > 0 ? "text-rose-600" : "text-slate-400"}`}>
                  {kpis.revisionAnimals}
                </span>
                <span className="text-[10px] font-mono font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                  NEEDS UPDATE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">Returned to farmer for correction</p>
            </button>
          </div>

          {/* FILTER BAR & SEARCH */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3">
              {/* Search Input */}
              <div className="relative lg:col-span-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="Search farmer name, batch code, or pen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-11 rounded-xl border-slate-200 bg-slate-50/80 pl-10 text-xs sm:text-sm focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Animal Type / Species Selector */}
              <div className="lg:col-span-3">
                <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
                  <SelectTrigger className="min-h-11 rounded-xl border-slate-200 text-xs">
                    <SelectValue placeholder="ANIMAL TYPE / SPECIES" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="ALL">ALL ANIMAL TYPES ({speciesList.length})</SelectItem>
                    {speciesList.map((sp) => (
                      <SelectItem key={sp} value={sp}>
                        {sp.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Review Status Selector */}
              <div className="lg:col-span-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="min-h-11 rounded-xl border-slate-200 text-xs">
                    <SelectValue placeholder="REVIEW STATUS" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="ALL">ALL STATUSES ({statusCounts.all})</SelectItem>
                    <SelectItem value="PENDING">{isCbat ? "PENDING CHECK" : "PENDING SIBAT CHECK"} ({statusCounts.pending})</SelectItem>
                    <SelectItem value="VERIFIED">{isCbat ? "CHECKED (VERIFIED)" : "CHECKED BY SIBAT (VERIFIED)"} ({statusCounts.verified})</SelectItem>
                    <SelectItem value="APPROVED">APPROVED BY MAO ({statusCounts.approved})</SelectItem>
                    <SelectItem value="SUBJECT_TO_REVISION">RETURNED FOR REVISION ({statusCounts.revision})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Barangay Selector */}
              <div className="lg:col-span-2">
                {user?.accessScope === "ALL_BARANGAYS" ? (
                  <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                    <SelectTrigger className="min-h-11 rounded-xl border-slate-200 text-xs truncate">
                      <SelectValue placeholder="ALL BARANGAYS" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-56 text-xs">
                      <SelectItem value="ALL">ALL BARANGAYS</SelectItem>
                      {PADRE_GARCIA_BARANGAYS.map((brgy) => (
                        <SelectItem key={brgy} value={brgy}>
                          BRGY. {brgy.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 font-semibold">
                    <MapPin className="size-3.5 text-emerald-600 mr-1.5 shrink-0" />
                    {user?.assignedBarangayName || "Unassigned"}
                  </div>
                )}
              </div>
            </div>

            {/* Active Filters Bar */}
            {(searchQuery || speciesFilter !== "ALL" || statusFilter !== "ALL" || activeBarangayFilter !== "ALL") && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-xs font-mono">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  ACTIVE FILTERS:
                </span>
                {searchQuery && (
                  <Badge variant="secondary" className="rounded-lg text-[10px] font-mono gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300">
                    SEARCH: &ldquo;{searchQuery}&rdquo;
                    <button type="button" onClick={() => setSearchQuery("")} className="hover:text-rose-600 font-bold">✕</button>
                  </Badge>
                )}
                {speciesFilter !== "ALL" && (
                  <Badge variant="secondary" className="rounded-lg text-[10px] font-mono gap-1.5 bg-cyan-50 text-cyan-800 border border-cyan-300">
                    ANIMAL: {speciesFilter.toUpperCase()}
                    <button type="button" onClick={() => setSpeciesFilter("ALL")} className="hover:text-rose-600 font-bold">✕</button>
                  </Badge>
                )}
                {statusFilter !== "ALL" && (
                  <Badge variant="secondary" className="rounded-lg text-[10px] font-mono gap-1.5 bg-amber-50 text-amber-800 border border-amber-300">
                    STATUS: {statusFilter}
                    <button type="button" onClick={() => setStatusFilter("ALL")} className="hover:text-rose-600 font-bold">✕</button>
                  </Badge>
                )}
                {activeBarangayFilter !== "ALL" && (
                  <Badge variant="secondary" className="rounded-lg text-[10px] font-mono gap-1.5 bg-purple-50 text-purple-800 border border-purple-300">
                    BARANGAY: {activeBarangayFilter.toUpperCase()}
                    <button type="button" onClick={() => setBarangayFilter("ALL")} className="hover:text-rose-600 font-bold">✕</button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSpeciesFilter("ALL");
                    setStatusFilter("ALL");
                    setBarangayFilter("ALL");
                  }}
                  className="h-6 text-[10px] font-mono font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 rounded-md cursor-pointer"
                >
                  RESET FILTERS
                </Button>
              </div>
            )}
          </div>

        {/* ── BATCH LISTINGS (Grid or Matrix Table) ── */}
        {filteredBatches.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-emerald-500/25 shadow-sm space-y-3">
            <Layers className="size-10 mx-auto text-emerald-400 mb-2" />
            <h3 className="text-base font-bold font-mono text-slate-800 uppercase tracking-wide">NO MATCHING ANIMAL BATCHES FOUND</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Modify your search keywords or clear current filters to view all registered batches in the municipality.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSpeciesFilter("ALL");
                setStatusFilter("ALL");
                setBarangayFilter("ALL");
              }}
              className="mt-2 rounded-xl text-xs font-mono font-bold border-emerald-500/40 text-emerald-800 hover:bg-emerald-50"
            >
              RESET ALL FILTERS
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          /* GRID VIEW */
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {pagedBatches.map((batch) => (
                <SibatHerdSplitCard
                  key={batch.id}
                  batch={batch}
                  isSelected={activeBatch?.id === batch.id}
                  onSelect={() => openHerdDrilldown(batch)}
                  getStatusBadge={getStatusBadge}
                  isCbat={isCbat}
                  onArchive={(b) => setConfirmAction({ type: "archive", batch: b })}
                  onDelete={(b) => setConfirmAction({ type: "delete", batch: b })}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-emerald-500/20 text-xs font-mono">
              <span className="text-[11px] text-slate-500">
                {isCbat ? "HERDS" : "BATCHES"} {(safeBatchPage - 1) * BATCH_PAGE_SIZE + 1}–{Math.min(safeBatchPage * BATCH_PAGE_SIZE, filteredBatches.length)} OF {filteredBatches.length} RECORDED
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeBatchPage <= 1}
                  onClick={() => setBatchPage((p) => p - 1)}
                  className="h-8 rounded-lg px-3 font-mono font-bold text-xs border-emerald-500/30"
                >
                  ‹ PREV
                </Button>
                <span className="rounded-lg bg-emerald-600 px-3 py-1 font-mono font-bold text-xs text-white shadow-xs">
                  PAGE {safeBatchPage} / {pageCountBatches}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeBatchPage >= pageCountBatches}
                  onClick={() => setBatchPage((p) => p + 1)}
                  className="h-8 rounded-lg px-3 font-mono font-bold text-xs border-emerald-500/30"
                >
                  NEXT ›
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* MATRIX TABLE VIEW */
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-emerald-50 text-emerald-950">
                    <TableRow className="hover:bg-transparent border-emerald-500/30">
                      <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                        BATCH CODE
                      </TableHead>
                      <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                        ANIMAL GROUP & SPECIES
                      </TableHead>
                      <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                        FARMER & BARANGAY
                      </TableHead>
                      <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900 text-center">
                        HEAD COUNT
                      </TableHead>
                      <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                        PEN & FEED
                      </TableHead>
                      <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                        AVG WEIGHT (KG)
                      </TableHead>
                      <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                        STATUS
                      </TableHead>
                      <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900 text-right">
                        ACTION
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedBatches.map((batch) => {
                      const headCount = batch.total_animals || batch.animals?.length || 0;
                      return (
                        <TableRow
                          key={batch.id}
                          className="hover:bg-emerald-50/40 transition-colors border-slate-100 cursor-pointer"
                          onClick={() => openHerdDrilldown(batch)}
                        >
                          <TableCell className="font-mono text-xs font-bold text-slate-900">
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 border border-slate-200">
                              <Cpu className="size-3 text-emerald-600" />
                              {batch.batch_code}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <HerdPhoto batch={batch} compact />
                              <div className="min-w-0 space-y-0.5">
                                <span className="block max-w-[200px] truncate text-xs font-bold text-slate-900">
                                  {batch.batch_name || `${batch.livestock_type_name} Herd`}
                                </span>
                                <span className={`inline-block rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider border ${getSpeciesColor(batch.livestock_type_name)}`}>
                                  {batch.livestock_type_name}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5 text-xs font-mono">
                              <span className="font-bold text-slate-800 block truncate max-w-[180px]">
                                {batch.farmer_name}
                              </span>
                              <span className="text-[10px] text-slate-500 block truncate">
                                Brgy: {batch.barangay_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono font-black text-xs text-emerald-700">
                            {headCount}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-slate-600">
                            <div>Pen: {batch.housing_pen || "General"}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                              {batch.feed_type || "Standard"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            <span className="font-bold text-slate-900">
                              {batch.average_weight ? `${batch.average_weight} kg` : "—"}
                            </span>
                            {batch.target_weight && (
                              <span className="text-[10px] text-slate-400 block">
                                Target: {batch.target_weight} kg
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(batch.review_status)}</TableCell>
                          <TableCell className="text-right">
                            {isCbat && headCount === 0 ? (
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <span className="text-[10px] font-mono font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                  Empty
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmAction({ type: "archive", batch })}
                                  title="Archive Herd"
                                  className="h-7 px-2 text-xs font-semibold text-amber-800 border-amber-300 hover:bg-amber-50 cursor-pointer"
                                >
                                  <Archive className="size-3 mr-1" />
                                  <span>Archive</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmAction({ type: "delete", batch })}
                                  title="Delete Herd"
                                  className="h-7 px-2 text-xs font-semibold text-rose-700 border-rose-300 hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="size-3 mr-1" />
                                  <span>Delete</span>
                                </Button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openHerdDrilldown(batch);
                                }}
                                className="h-8 px-3 rounded-lg bg-emerald-700 text-white font-mono text-xs font-bold hover:bg-emerald-800 transition-colors shadow-2xs gap-1.5 cursor-pointer"
                              >
                                <Eye className="size-3.5" />
                                <span>{isCbat ? "VIEW HERD" : "VIEW BATCH"}</span>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-emerald-500/20 text-xs font-mono">
              <span className="text-[11px] text-slate-500">
                {isCbat ? "HERDS" : "BATCHES"} {(safeBatchPage - 1) * BATCH_PAGE_SIZE + 1}–{Math.min(safeBatchPage * BATCH_PAGE_SIZE, filteredBatches.length)} OF {filteredBatches.length} RECORDED
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeBatchPage <= 1}
                  onClick={() => setBatchPage((p) => p - 1)}
                  className="h-8 rounded-lg px-3 font-mono font-bold text-xs border-emerald-500/30"
                >
                  ‹ PREV
                </Button>
                <span className="rounded-lg bg-emerald-600 px-3 py-1 font-mono font-bold text-xs text-white shadow-xs">
                  PAGE {safeBatchPage} / {pageCountBatches}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeBatchPage >= pageCountBatches}
                  onClick={() => setBatchPage((p) => p + 1)}
                  className="h-8 rounded-lg px-3 font-mono font-bold text-xs border-emerald-500/30"
                >
                  NEXT ›
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. BATCH DRILLDOWN DETAIL VIEW (When a batch is opened) ───── */}
      {isDrilldownOpen && (
        <section className="space-y-6" aria-label="Batch Details and Animal Verification">
          {detailQuery.isLoading ? (
            <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 rounded-3xl border border-emerald-500/25 bg-white p-8 text-center shadow-sm">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                <RefreshCw className="size-7 animate-spin" />
              </div>
              <h3 className="text-base font-mono font-bold text-slate-900 uppercase tracking-wide">LOADING BATCH DETAILS</h3>
              <p className="text-xs text-slate-500 max-w-sm">Loading animal ear tags and records for this batch...</p>
            </div>
          ) : detailQuery.isError ? (
            <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 rounded-3xl border border-rose-300 bg-rose-50/50 p-8 text-center shadow-sm">
              <AlertTriangle className="size-9 text-rose-600" />
              <h3 className="text-base font-mono font-bold text-slate-900 uppercase tracking-wide">COULD NOT LOAD BATCH</h3>
              <p className="text-xs text-slate-600 max-w-sm">Unable to load batch details. Please check your connection and try again.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void detailQuery.refetch()}
                className="rounded-xl px-4 text-xs font-mono font-bold border-rose-300 text-rose-800"
              >
                RETRY
              </Button>
            </div>
          ) : activeBatch && (
            <div className="space-y-5">
              {/* Husbandry & Animal Information */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Photo Gallery Column (5 cols) */}
                <div className="lg:col-span-5">
                  <HerdProfileGallery batch={activeBatch} />
                </div>

                {/* Herd Summary Telemetry Matrix (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Cohort Identity Banner */}
                  <div className="rounded-2xl border border-emerald-500/25 bg-white/95 p-5 shadow-sm backdrop-blur-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-800 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                            <Cpu className="size-3 text-emerald-600" />
                            ANIMAL BATCH RECORD
                          </span>
                          {getStatusBadge(activeBatch.review_status)}
                        </div>
                        <h2 className="text-xl font-black font-sans text-slate-900 leading-tight truncate">
                          {activeBatch.batch_name}
                        </h2>
                        <div className="mt-1.5 flex items-center gap-2 text-xs font-mono text-slate-500 flex-wrap">
                          <span>Farmer: <strong className="text-slate-900">{activeBatch.farmer_name}</strong></span>
                          <span className="text-slate-300">•</span>
                          <span>Barangay: <strong className="text-slate-900">Brgy. {activeBatch.barangay_name}</strong></span>
                          <span className="text-slate-300">•</span>
                          <span>Batch Code: <code className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded text-[11px] border border-emerald-200">{activeBatch.batch_code}</code></span>
                        </div>
                      </div>
                      <div className="size-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl border border-emerald-200 shrink-0">
                        {getDefaultAvatarForSpecies(activeBatch.livestock_type_name).emoji}
                      </div>
                    </div>

                    {activeBatch.notes && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 text-xs font-mono text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-200/60">
                        &ldquo;{activeBatch.notes}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* 4 Batch Overview Cards */}
                  <div className="grid grid-cols-2 gap-3.5">
                    {/* Animal Type */}
                    <div className="p-4 rounded-2xl border border-emerald-500/25 bg-white shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Layers className="size-4" />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">ANIMAL TYPE</span>
                      </div>
                      <div className="mt-3">
                        <span className="text-base font-black font-mono text-slate-900 block truncate">
                          {activeBatch.livestock_type_name.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5">
                          Code: {activeBatch.batch_code}
                        </span>
                      </div>
                    </div>

                    {/* Head Count */}
                    <div className="p-4 rounded-2xl border border-blue-500/25 bg-white shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-xl bg-blue-500/10 text-blue-700 border border-blue-500/30 flex items-center justify-center shrink-0">
                          <ShieldCheck className="size-4" />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">HEAD COUNT</span>
                      </div>
                      <div className="mt-3">
                        <span className="text-base font-black font-mono text-slate-900 block">
                          {activeBatch.animals?.length || activeBatch.total_animals} <span className="text-xs text-slate-500">HEADS</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                          Total registered: {activeBatch.enrolled_animals ?? activeBatch.total_animals}
                        </span>
                      </div>
                    </div>

                    {/* Average Weight */}
                    <div className="p-4 rounded-2xl border border-sky-500/25 bg-white shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-xl bg-sky-500/10 text-sky-700 border border-sky-500/30 flex items-center justify-center shrink-0">
                          <Scale className="size-4" />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">AVERAGE WEIGHT</span>
                      </div>
                      <div className="mt-3">
                        <span className="text-base font-black font-mono text-slate-900 block">
                          {activeBatch.average_weight ? `${activeBatch.average_weight} kg` : "NOT WEIGHED"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5">
                          Target: {activeBatch.target_weight ? `${activeBatch.target_weight} kg` : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Pen & Housing */}
                    <div className="p-4 rounded-2xl border border-amber-500/25 bg-white shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-500/30 flex items-center justify-center shrink-0">
                          <Building2 className="size-4" />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">PEN &amp; HOUSING</span>
                      </div>
                      <div className="mt-3">
                        <span className="text-base font-black font-mono text-slate-900 block truncate">
                          {activeBatch.housing_pen || "General Pen"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5">
                          Feed: {activeBatch.feed_type || "Standard"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Protocol Directive Guidance Banner */}
              <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-emerald-50 text-slate-800 border border-emerald-200 shadow-xs">
                <div className="size-10 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                  <ShieldCheck className="size-5" />
                </div>
                <div className="space-y-0.5 text-xs font-mono">
                  <p className="font-bold text-emerald-900 uppercase tracking-wider">SIBAT FIELD INSPECTION GUIDELINES</p>
                  <p className="text-slate-600 leading-relaxed font-sans text-xs">
                    Inspect physical ear tags and animal health on site. Check off verified animals for batch submission, or click review on an individual animal to check vaccination history.
                  </p>
                </div>
              </div>

              {/* SPECIMEN ANIMAL ROSTER (The Verification Station) */}
              <div className="rounded-3xl border border-emerald-500/25 bg-white/95 p-4 sm:p-6 shadow-sm backdrop-blur-md space-y-4">
                {/* Roster Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center justify-between gap-3 w-full lg:w-auto">
                    <div className="flex items-center gap-2.5">
                      <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 flex items-center justify-center shrink-0">
                        <ClipboardList className="size-4.5" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold font-mono text-slate-900 leading-none uppercase">
                          ANIMALS IN THIS BATCH
                        </h3>
                        <span className="text-xs font-mono text-slate-500">
                          {filteredChildAnimals.length} ANIMALS LISTED
                        </span>
                      </div>
                    </div>

                    {/* View Mode Toggler */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setAnimalViewMode("card")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          animalViewMode === "card"
                            ? "bg-white text-emerald-800 shadow-2xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <LayoutGrid className="size-3.5" />
                        <span>CARDS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnimalViewMode("table")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          animalViewMode === "table"
                            ? "bg-white text-emerald-800 shadow-2xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <List className="size-3.5" />
                        <span>TABLE</span>
                      </button>
                    </div>
                  </div>

                  {/* Search, Filter & Bulk Select Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 sm:w-60 min-w-[160px]">
                      <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <Input
                        placeholder="Search tag or animal ID..."
                        value={animalSearchQuery}
                        onChange={(e) => setAnimalSearchQuery(e.target.value)}
                        className="h-9.5 rounded-xl border-emerald-500/30 pl-8.5 font-mono text-xs focus-visible:ring-emerald-500"
                      />
                      {animalSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setAnimalSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer font-mono font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="relative min-w-[130px]">
                      <select
                        value={animalStatusFilter}
                        onChange={(e) => setAnimalStatusFilter(e.target.value)}
                        className="h-9.5 w-full pl-3 pr-7 text-xs font-mono font-bold rounded-xl border border-emerald-500/30 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none"
                      >
                        <option value="ALL">ALL STATUS</option>
                        <option value="PENDING">PENDING</option>
                        <option value="VERIFIED">VERIFIED</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="SUBJECT_TO_REVISION">NEEDS REVISION</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                    </div>

                    {selectedAnimalIds.length === 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleFilteredPendingAnimals(true)}
                        disabled={filteredPendingAnimalIds.length === 0}
                        className="h-9.5 rounded-xl border-emerald-500/30 px-3 text-xs font-mono font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <CheckSquare className="mr-1.5 size-3.5 text-emerald-600" />
                        <span>SELECT PENDING</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Animals Cards or Table Display */}
                {animalViewMode === "card" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredChildAnimals.length === 0 ? (
                      <div className="col-span-full rounded-2xl border border-dashed border-emerald-500/30 bg-slate-50/50 p-8 text-center text-xs font-mono text-slate-500">
                        NO ANIMALS MATCH THIS FILTER.
                      </div>
                    ) : (
                      pagedChildAnimals.map((animal) => {
                        const isPending = (animal.status || "PENDING").toUpperCase() === "PENDING";
                        const isTarget = highlightedAnimalId === animal.id;
                        const isSelected = selectedAnimalIds.includes(animal.id);
                        const speciesAvatar = getDefaultAvatarForSpecies(activeBatch.livestock_type_name);
                        const animalWeight = animal.weight == null ? null : Number(animal.weight);

                        return (
                          <article
                            key={animal.id}
                            id={`animal-card-${animal.id}`}
                            onPointerDown={(e) => handleAnimalPressDown(animal.id, isPending, e)}
                            onPointerMove={handleAnimalPressMove}
                            onPointerUp={handleAnimalPressUp}
                            onPointerCancel={handleAnimalPressUp}
                            onClick={(e) => {
                              if (isLongPressTriggeredRef.current) {
                                isLongPressTriggeredRef.current = false;
                                return;
                              }
                              if (selectedAnimalIds.length > 0 || e.shiftKey) {
                                handleAnimalToggle(animal.id, isPending, e.shiftKey);
                              }
                            }}
                            className={`rounded-2xl border p-4 shadow-sm transition-all duration-200 relative select-none touch-manipulation cursor-pointer ${
                              isTarget
                                ? "border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-500 shadow-holo-glow-emerald"
                                : isSelected
                                  ? "border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/25 shadow-sm"
                                  : "border-slate-200/90 bg-white hover:border-emerald-500/40 hover:bg-slate-50/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${animal.tag_number || `animal ${animal.id}`} for field verification`}
                                  checked={isSelected}
                                  disabled={!isPending}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    handleAnimalToggle(animal.id, isPending, (event.nativeEvent as MouseEvent).shiftKey);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="size-4.5 rounded border-slate-300 accent-emerald-600 disabled:opacity-40 cursor-pointer shrink-0"
                                />

                                {/* Gmail-style Avatar with Checkmark Overlay */}
                                <button
                                  type="button"
                                  disabled={!isPending}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAnimalToggle(animal.id, isPending, e.shiftKey);
                                  }}
                                  className={`size-9 rounded-xl flex items-center justify-center text-sm border transition-all cursor-pointer shrink-0 ${
                                    isSelected
                                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                                  }`}
                                  title={isSelected ? "Deselect animal" : "Select animal"}
                                >
                                  {isSelected ? (
                                    <Check className="size-4.5 text-white stroke-[3] animate-in zoom-in-75 duration-150" />
                                  ) : (
                                    speciesAvatar.emoji
                                  )}
                                </button>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">
                                      {animal.tag_number || `#${animal.id}`}
                                    </span>
                                    {animal.tag_number && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyTag(animal.tag_number);
                                        }}
                                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                        title="Copy tag number"
                                      >
                                        {copiedTag === animal.tag_number ? (
                                          <Check className="size-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="size-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-400 block">ANIMAL ID: {animal.id}</span>
                                </div>
                              </div>

                              <div className="shrink-0">{getAnimalStatusBadge(animal.status)}</div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
                              <div className="rounded-xl bg-slate-50 p-2 border border-slate-200/60">
                                <span className="block text-[9px] uppercase text-slate-400 font-bold">BREED / SEX</span>
                                <span className="font-bold text-slate-800 block truncate">
                                  {animal.breed || "Standard"} • {animal.sex || "—"}
                                </span>
                              </div>
                              <div className="rounded-xl bg-slate-50 p-2 border border-slate-200/60">
                                <span className="block text-[9px] uppercase text-slate-400 font-bold">WEIGHT / AGE</span>
                                <span className="font-bold text-slate-800 block truncate">
                                  {animalWeight ? `${animalWeight} kg` : "—"} • {animal.age?.total_months != null ? `${animal.age.total_months}m` : "—"}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono text-slate-500 truncate">
                                VACCINE: {animal.last_vaccination_date || "Up to Date"}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAnimalReview(activeBatch, animal);
                                }}
                                className="h-7.5 px-2.5 rounded-lg border-emerald-500/30 text-emerald-800 hover:bg-emerald-50 text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="size-3" />
                                <span>REVIEW</span>
                              </Button>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto rounded-2xl border border-emerald-500/25 bg-white">
                    <Table className="min-w-[1050px]">
                      <TableHeader className="bg-emerald-50 text-emerald-950">
                        <TableRow className="hover:bg-transparent border-emerald-500/30">
                          <TableHead className="w-12 text-center text-xs font-mono font-bold text-emerald-900">
                            <button
                              type="button"
                              onClick={() => {
                                if (allFilteredPendingAnimalsSelected) {
                                  deselectAllAnimals();
                                } else {
                                  selectAllFilteredPending();
                                }
                              }}
                              disabled={filteredPendingAnimalIds.length === 0}
                              aria-label={allFilteredPendingAnimalsSelected ? "Deselect All" : "Select All Pending"}
                              title={allFilteredPendingAnimalsSelected ? "Deselect All" : "Select All Pending"}
                              className="size-5 rounded border border-emerald-600 bg-white inline-flex items-center justify-center text-emerald-800 disabled:opacity-40 cursor-pointer transition-colors"
                            >
                              {allFilteredPendingAnimalsSelected ? (
                                <Check className="size-3.5 text-emerald-700 stroke-[3]" />
                              ) : selectedAnimalIds.length > 0 ? (
                                <span className="block h-0.5 w-2 bg-emerald-700 rounded-full" />
                              ) : null}
                            </button>
                          </TableHead>
                          <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">EAR TAG #</TableHead>
                          <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">BREED</TableHead>
                          <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">SEX</TableHead>
                          <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">AGE (MOS)</TableHead>
                          <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">WEIGHT (KG)</TableHead>
                          <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">VACCINATION</TableHead>
                          <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">STATUS</TableHead>
                          <TableHead className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900 text-right sticky right-0 z-10 bg-emerald-50 border-l border-emerald-200">ACTIONS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredChildAnimals.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-xs font-mono text-slate-500">
                              NO ANIMALS FOUND MATCHING THIS FILTER.
                            </TableCell>
                          </TableRow>
                        ) : (
                          pagedChildAnimals.map((animal) => {
                            const isPending = (animal.status || "PENDING").toUpperCase() === "PENDING";
                            const isSelected = selectedAnimalIds.includes(animal.id);
                            const isTarget = highlightedAnimalId === animal.id;
                            const avatar = getDefaultAvatarForSpecies(activeBatch.livestock_type_name);
                            const animalWeight = animal.weight ? Number(animal.weight) : null;
                            const batchAvg = activeBatch.average_weight ? Number(activeBatch.average_weight) : null;
                            const weightDiff = animalWeight && batchAvg ? (animalWeight - batchAvg).toFixed(1) : null;

                            return (
                              <TableRow
                                key={animal.id}
                                id={`animal-row-${animal.id}`}
                                onPointerDown={(e) => handleAnimalPressDown(animal.id, isPending, e)}
                                onPointerMove={handleAnimalPressMove}
                                onPointerUp={handleAnimalPressUp}
                                onPointerCancel={handleAnimalPressUp}
                                onClick={(e) => {
                                  if (isLongPressTriggeredRef.current) {
                                    isLongPressTriggeredRef.current = false;
                                    return;
                                  }
                                  if (selectedAnimalIds.length > 0 || e.shiftKey) {
                                    handleAnimalToggle(animal.id, isPending, e.shiftKey);
                                  }
                                }}
                                className={`transition-all border-slate-100 font-mono text-xs cursor-pointer select-none touch-manipulation ${
                                  isTarget
                                    ? "bg-emerald-100/90 ring-2 ring-emerald-600 ring-inset shadow-md font-medium"
                                    : isSelected
                                      ? "bg-emerald-50/80 border-l-4 border-l-emerald-600 font-medium"
                                      : "hover:bg-slate-50/70"
                                }`}
                              >
                                <TableCell className="text-center">
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${animal.tag_number || `animal ${animal.id}`} for field verification`}
                                    checked={isSelected}
                                    disabled={!isPending}
                                    onChange={(event) => {
                                      event.stopPropagation();
                                      handleAnimalToggle(animal.id, isPending, (event.nativeEvent as MouseEvent).shiftKey);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="size-4.5 rounded border-slate-300 accent-emerald-600 disabled:opacity-40 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAnimalToggle(animal.id, isPending, e.shiftKey);
                                      }}
                                      className={`size-8 rounded-xl flex items-center justify-center text-xs border transition-all cursor-pointer shrink-0 ${
                                        isSelected
                                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                                          : "bg-emerald-50 text-emerald-800 border-emerald-500/30 hover:bg-emerald-100"
                                      }`}
                                      title={isSelected ? "Deselect animal" : "Select animal"}
                                    >
                                      {isSelected ? <Check className="size-4 text-white stroke-[3] animate-in zoom-in-75 duration-150" /> : avatar.emoji}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-mono font-bold text-xs text-slate-900">
                                          {animal.tag_number || `#${animal.id}`}
                                        </span>
                                        {animal.tag_number && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleCopyTag(animal.tag_number);
                                            }}
                                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                            title="Copy tag number"
                                          >
                                            {copiedTag === animal.tag_number ? (
                                              <Check className="size-3 text-emerald-600" />
                                            ) : (
                                              <Copy className="size-3" />
                                            )}
                                          </button>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-mono block">ID: {animal.id}</span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs font-semibold text-slate-800">
                                  {animal.breed || "Standard"}
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    animal.sex === "Female"
                                      ? "text-rose-700 bg-rose-50 border border-rose-200/60"
                                      : animal.sex === "Male"
                                        ? "text-blue-700 bg-blue-50 border border-blue-200/60"
                                        : "text-slate-700 bg-slate-50 border border-slate-200"
                                  }`}>
                                    {animal.sex || "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs font-medium text-slate-700">
                                  {animal.age?.total_months != null ? `${animal.age.total_months} mos` : "—"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  <span className="font-mono font-bold text-slate-900">
                                    {animalWeight ? `${animalWeight} kg` : "—"}
                                  </span>
                                  {weightDiff && (
                                    <span className={`ml-1 text-[10px] font-mono font-bold ${Number(weightDiff) >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                                      {Number(weightDiff) >= 0 ? `+${weightDiff}` : weightDiff}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">
                                  {animal.last_vaccination_date || "Up to Date"}
                                </TableCell>
                                <TableCell>{getAnimalStatusBadge(animal.status)}</TableCell>
                                <TableCell className="sticky right-0 z-10 bg-white border-l border-slate-200 text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openAnimalReview(activeBatch, animal);
                                    }}
                                    className="h-8 px-2.5 rounded-lg border-emerald-500/30 text-emerald-800 hover:bg-emerald-50 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="size-3.5" />
                                    <span>REVIEW</span>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination Controls */}
                {filteredChildAnimals.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs font-mono">
                    <span className="text-xs text-slate-500">
                      SHOWING {(safeAnimalPage - 1) * ANIMAL_PAGE_SIZE + 1}–{Math.min(safeAnimalPage * ANIMAL_PAGE_SIZE, filteredChildAnimals.length)} OF {filteredChildAnimals.length} ANIMALS
                    </span>
                    {filteredChildAnimals.length > ANIMAL_PAGE_SIZE && (
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safeAnimalPage <= 1}
                          onClick={() => setAnimalPage((p) => p - 1)}
                          className="h-8 px-2.5 rounded-lg text-xs font-mono font-bold border-emerald-500/30 cursor-pointer"
                        >
                          ‹ PREV
                        </Button>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs shadow-xs">
                          {safeAnimalPage} / {pageCountAnimals}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safeAnimalPage >= pageCountAnimals}
                          onClick={() => setAnimalPage((p) => p + 1)}
                          className="h-8 px-2.5 rounded-lg text-xs font-mono font-bold border-emerald-500/30 cursor-pointer"
                        >
                          NEXT ›
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Reviewer Notes & Field Notes */}
              <div className="rounded-2xl border border-emerald-500/25 bg-white/95 p-5 shadow-sm space-y-3 font-mono">
                <button
                  type="button"
                  onClick={() => setShowBatchNotes(!showBatchNotes)}
                  className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                  aria-expanded={showBatchNotes}
                >
                  <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                    <ClipboardList className="size-4 text-emerald-600 shrink-0" />
                    INSPECTION REMARKS &amp; FIELD NOTES
                    {activeBatch.notes && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {activeBatch.notes.split("\n").filter(Boolean).length} ENTRIES
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`size-4 text-slate-400 transition-transform shrink-0 ${showBatchNotes ? "rotate-180" : ""}`}
                  />
                </button>

                {showBatchNotes && (
                  <div className="pt-2 space-y-3 border-t border-slate-100">
                    <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-40 overflow-y-auto">
                      {activeBatch.notes || "NO FIELD REMARKS RECORDED FOR THIS BATCH YET."}
                    </pre>
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start">
                      <Textarea
                        value={batchNoteText}
                        onChange={(e) => setBatchNoteText(e.target.value)}
                        placeholder="Enter field observations, health findings, or inspector remarks..."
                        className="text-xs font-mono rounded-xl border-emerald-500/30 focus-visible:ring-emerald-500 min-h-[70px]"
                      />
                      <Button
                        size="sm"
                        disabled={addBatchNoteMutation.isPending || !batchNoteText.trim()}
                        onClick={() => {
                          if (!batchNoteText.trim() || !activeBatch) return;
                          addBatchNoteMutation.mutate({
                            batchId: activeBatch.id,
                            text: batchNoteText.trim(),
                          });
                        }}
                        className="h-10 sm:h-[70px] shrink-0 rounded-xl bg-emerald-700 px-4 text-xs font-mono font-bold text-white hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer shadow-holo-glow-emerald"
                      >
                        {addBatchNoteMutation.isPending ? "SAVING…" : "ADD NOTE"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating Sticky Bottom Verification Bar */}
          {selectedAnimalIds.length > 0 && (
            <div className="fixed bottom-10 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center justify-between gap-2.5 sm:gap-3 bg-white text-slate-800 backdrop-blur-xl px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-xl border border-emerald-300 animate-in slide-in-from-bottom-4 duration-200 w-[calc(100%-1.5rem)] sm:w-auto sm:min-w-[460px] max-w-lg">
              <div className="flex items-center gap-2 min-w-0 font-mono">
                <span className="size-6 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-2xs">
                  {selectedAnimalIds.length}
                </span>
                <span className="text-xs font-bold text-slate-800 truncate hidden xs:inline">
                  SELECTED
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (allFilteredPendingAnimalsSelected) {
                      deselectAllAnimals();
                    } else {
                      selectAllFilteredPending();
                    }
                  }}
                  className="h-8.5 px-2.5 sm:px-3 rounded-xl border-emerald-300 text-emerald-900 bg-emerald-50 hover:bg-emerald-100 text-[11px] sm:text-xs font-mono font-bold cursor-pointer"
                >
                  {allFilteredPendingAnimalsSelected ? "DESELECT ALL" : "SELECT ALL"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={deselectAllAnimals}
                  className="h-8 px-2 text-xs font-mono text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                  title="Clear selection"
                >
                  <X className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setBulkVerifyOpen(true)}
                  className="h-8.5 px-3 sm:px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-mono font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-holo-glow-emerald cursor-pointer shrink-0"
                >
                  <ShieldCheck className="size-4" />
                  <span>VERIFY ({selectedAnimalIds.length})</span>
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── 4. INDIVIDUAL ANIMAL REVIEW MODAL ──────────────────────────────── */}
      {selectedAnimalReview && (
        <SibatReviewDialog
          submission={selectedAnimalReview}
          open={selectedAnimalReview !== null}
          hideFooterClose
          onOpenChange={(open) => { if (!open) setSelectedAnimalReview(null); }}
          onReviewSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["sibat-batches-drilldown"] });
            void queryClient.invalidateQueries({ queryKey: ["sibat", "livestock-registry"] });
          }}
        />
      )}

      {/* ── 5. CONFIRMATION ALERT DIALOG ──────────────────────────────────── */}
      <AlertDialog open={bulkVerifyOpen} onOpenChange={setBulkVerifyOpen}>
        <AlertDialogContent className="max-w-xl gap-0 rounded-3xl border-emerald-500/30 bg-white p-6 shadow-2xl">
          <AlertDialogHeader className="gap-3 text-left">
            <AlertDialogTitle className="flex items-center gap-3 text-xl font-mono font-bold text-slate-900">
              <ShieldCheck className="size-6 shrink-0 text-emerald-600" />
              CONFIRM FIELD VERIFICATION
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-mono text-slate-600">
              You have selected {selectedPendingAnimals.length} {selectedPendingAnimals.length === 1 ? "animal" : "animals"} for official field verification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-5 text-slate-800 text-xs font-mono">
            <h4 className="font-bold uppercase tracking-wider text-emerald-950">WHAT HAPPENS NEXT:</h4>
            <div className="flex gap-3 bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
              <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-bold text-emerald-950">Verification record will be saved.</p>
                <p className="mt-1 text-emerald-800 leading-relaxed font-sans text-xs">These animals will advance to the Municipal Agriculture Office (MAO) review queue for final approval.</p>
              </div>
            </div>
            <p className="text-slate-500 text-[11px]">Proceed only if you have physically checked the ear tags and confirmed animal health on site.</p>
          </div>
          <AlertDialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2">
            <AlertDialogCancel className="min-h-11 w-full rounded-xl border-slate-300 font-mono text-xs font-bold">CANCEL</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void verifySelectedAnimals(); }}
              disabled={bulkVerifying || selectedPendingAnimals.length === 0 || selectedPendingAnimals.length !== selectedAnimalIds.length}
              className="min-h-11 w-full rounded-xl bg-emerald-700 font-mono text-xs font-bold text-white hover:bg-emerald-800 shadow-holo-glow-emerald"
            >
              {bulkVerifying ? "SAVING…" : "CONFIRM VERIFICATION"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── CBAT Empty Herd Confirmation Dialog ── */}
      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open && !isProcessingAction) setConfirmAction(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmAction?.type === "delete"
                    ? "bg-rose-100 text-rose-600"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {confirmAction?.type === "delete" ? (
                  <Trash2 className="size-5" />
                ) : (
                  <Archive className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <AlertDialogTitle className="text-base font-bold text-slate-900">
                  {confirmAction?.type === "delete"
                    ? "Delete Empty Herd?"
                    : "Archive Empty Herd?"}
                </AlertDialogTitle>
                <p className="text-xs font-mono font-bold text-slate-500 truncate">
                  {confirmAction?.batch.batch_code} • {confirmAction?.batch.batch_name || `${confirmAction?.batch.livestock_type_name} Herd`}
                </p>
              </div>
            </div>
            <AlertDialogDescription className="text-xs sm:text-sm text-slate-600 mt-2.5 text-left leading-relaxed">
              {confirmAction?.type === "delete" ? (
                <>
                  Are you sure you want to permanently delete this herd? This herd has{" "}
                  <strong className="text-slate-900 font-bold">0 animals</strong>. This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to archive this empty herd? It will be marked as{" "}
                  <strong className="text-slate-900 font-bold">ARCHIVED</strong> and hidden from the active herd roster.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              disabled={isProcessingAction}
              className="h-10 rounded-xl border-slate-200 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isProcessingAction}
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction?.type === "delete") {
                  void handleDeleteConfirm();
                } else {
                  void handleArchiveConfirm();
                }
              }}
              className={`h-10 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer ${
                confirmAction?.type === "delete"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {isProcessingAction
                ? "Processing..."
                : confirmAction?.type === "delete"
                  ? "Yes, Delete Herd"
                  : "Yes, Archive Herd"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}

export default function SibatBatchesVerificationPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <ValidationLoadingScreen
            isLoading={true}
            title="Loading Livestock Batches"
            subtitle="Connecting livestock batches, animal counts, and inspection records..."
            badgeLabel="SIBAT Batch Operations"
            authorityText="SIBAT Field Review · Padre Garcia MAO"
            items={[
              {
                id: "batches",
                label: "Animal Batches",
                sublabel: "Registered livestock groups",
                icon: <Layers className="size-4 text-emerald-700" />,
                loaded: false,
              },
              {
                id: "roster",
                label: "Animal List",
                sublabel: "Ear tags and individual records",
                icon: <ShieldCheck className="size-4 text-sky-600" />,
                loaded: false,
              },
              {
                id: "barangay",
                label: "Area Scope",
                sublabel: "Barangay jurisdiction filter",
                icon: <MapPin className="size-4 text-amber-600" />,
                loaded: false,
              },
            ]}
          />
        </div>
      }
    >
      <SibatBatchesVerificationContent />
    </Suspense>
  );
}
