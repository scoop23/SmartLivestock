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
import {
Card,
CardContent
} from "@/components/ui/card";
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
import { ValidationLoadingScreen,useLoadingScreenTransition } from "@/components/validation-loading-screen";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import {
AlertTriangle,
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
Copy,
Download,
Eye,
ImageIcon,
Info,
Layers,
LayoutGrid,
List,
MapPin,
RefreshCw,
RotateCcw,
Scale,
Search,
ShieldCheck,
User,
Maximize2,
X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter,useSearchParams } from "next/navigation";
import React,{ Suspense,useEffect,useMemo,useRef,useState } from "react";
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

function HerdPhoto({ batch, compact = false }: { batch: BatchItem; compact?: boolean }) {
  const photos = useMemo(() => {
    const list = (batch.photos && batch.photos.length > 0)
      ? batch.photos
      : (batch.photo_url ? [batch.photo_url] : []);

    const seen = new Set<string>();
    const result: string[] = [];
    for (const rawUrl of list) {
      if (!rawUrl) continue;
      // Extract normalized filename/pathname so absolute vs relative URLs match
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
    <div className={`relative isolate overflow-hidden bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 ${compact ? "h-14 w-20 shrink-0 rounded-lg" : "aspect-[16/7] w-full"}`}>
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
          {!compact && <span className="mt-1 text-xs font-bold uppercase tracking-wider text-emerald-200">{batch.livestock_type_name}</span>}
        </div>
      )}
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
            className={`absolute left-2 top-1/2 z-10 grid -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white shadow-sm hover:bg-black/80 ${compact ? "size-7" : "size-9"}`}
          >
            <ArrowLeft className={compact ? "size-3.5" : "size-4.5"} />
          </button>
          <button
            type="button"
            aria-label="Next herd photo"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPhotoIndex((index) => (index + 1) % photos.length);
            }}
            className={`absolute right-2 top-1/2 z-10 grid -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white shadow-sm hover:bg-black/80 ${compact ? "size-7" : "size-9"}`}
          >
            <ChevronRight className={compact ? "size-3.5" : "size-4.5"} />
          </button>
          <span className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
            <Camera className="size-3" /> {safeIndex + 1}/{photos.length}
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

    // Primary herd cover photo uploaded by the farmer
    if (batch.photo_url) {
      addPhoto(
        batch.photo_url,
        "Cover Photo",
        `${batch.batch_name} (${batch.batch_code})`
      );
    }

    // Additional herd/pen photos uploaded by the farmer
    if (batch.photos && Array.isArray(batch.photos)) {
      batch.photos.forEach((url) => {
        addPhoto(url, `Herd Photo ${list.length + 1}`, batch.batch_name);
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
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col items-center justify-center text-center min-h-[260px] h-full">
        <div className="size-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-3 shadow-inner">
          {avatar.emoji}
        </div>
        <h3 className="text-sm font-bold text-slate-800">No Herd Photos Uploaded</h3>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          The farmer has not uploaded photos for this herd or housing pen yet.
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
          <Camera className="size-3 text-slate-400" /> 0 herd photos
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs flex flex-col">
        {/* Gallery Header Bar */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Camera className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 leading-tight truncate">Herd Photo Gallery</h3>
              <span className="text-[10px] text-slate-500 font-medium truncate block">
                {photos.length} photo{photos.length === 1 ? "" : "s"} • {batch.batch_name}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsLightboxOpen(true)}
            className="h-7 px-2 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50 rounded-lg gap-1 cursor-pointer shrink-0"
          >
            <Maximize2 className="size-3.5" /> Fullscreen
          </Button>
        </div>

        {/* Hero Photo Box */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsLightboxOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setIsLightboxOpen(true);
          }}
          className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-slate-950 overflow-hidden cursor-zoom-in group select-none"
        >
          {currentPhoto && (
            <Image
              src={currentPhoto.url}
              alt={currentPhoto.label}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover transition-transform duration-300 group-hover:scale-102"
            />
          )}

          {/* Top Right Counter & Expand */}
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs">
              <Camera className="size-3" /> {currentIndex + 1} / {photos.length}
            </span>
            <div className="size-7 rounded-full bg-black/70 backdrop-blur-xs text-white flex items-center justify-center hover:bg-black/90 transition-colors shadow-xs">
              <Maximize2 className="size-3.5" />
            </div>
          </div>

          {/* Bottom Caption Overlay */}
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-6 text-white flex items-end justify-between gap-2 pointer-events-none">
            <div className="min-w-0">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-0.5 bg-emerald-600/90 text-white">
                Herd Photo
              </span>
              <p className="text-xs sm:text-sm font-bold truncate text-white drop-shadow-xs">
                {currentPhoto?.label}
              </p>
              {currentPhoto?.sublabel && (
                <p className="text-[11px] text-slate-300 truncate">
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
                className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 size-8 sm:size-9 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-xs transition-transform active:scale-95 cursor-pointer shadow-md"
              >
                <ChevronLeft className="size-4 sm:size-5" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={handleNext}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 size-8 sm:size-9 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-xs transition-transform active:scale-95 cursor-pointer shadow-md"
              >
                <ChevronRight className="size-4 sm:size-5" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail Strip (if multiple photos) */}
        {photos.length > 1 && (
          <div className="p-2 sm:p-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-thin">
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
                  className={`relative shrink-0 h-14 w-18 sm:h-16 sm:w-20 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    isSelected
                      ? "border-emerald-600 ring-2 ring-emerald-600/40 scale-102"
                      : "border-slate-200/80 opacity-70 hover:opacity-100"
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
                  <span className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.2 rounded text-[9px] font-bold text-white">
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full-size herd photo view"
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Lightbox Header */}
          <div
            className="w-full flex items-center justify-between text-white py-2 px-1 max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <span className="text-xs text-slate-400 font-medium">
                Photo {currentIndex + 1} of {photos.length} • {batch.batch_name}
              </span>
              <h4 className="text-sm sm:text-base font-bold truncate text-white">
                {currentPhoto?.label}
              </h4>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsLightboxOpen(false)}
              className="size-9 rounded-full bg-white/10 hover:bg-white/20 text-white p-0 flex items-center justify-center cursor-pointer"
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
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 size-10 sm:size-12 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center backdrop-blur-xs transition-transform active:scale-95 cursor-pointer shadow-xl border border-white/20"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={handleNext}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 size-10 sm:size-12 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center backdrop-blur-xs transition-transform active:scale-95 cursor-pointer shadow-xl border border-white/20"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>

          {/* Lightbox Footer Caption */}
          <div
            className="w-full text-center py-2 text-xs text-slate-300 max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {currentPhoto?.sublabel && <p className="truncate">{currentPhoto.sublabel}</p>}
            <p className="text-[11px] text-slate-500 mt-0.5">Use Left/Right arrows to navigate, Esc or click backdrop to close</p>
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
  link.download = `sibat-herd-roster-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

function deriveBatchReviewStatus(batch: BatchItem): BatchItem["review_status"] {
  const statuses = (batch.animals || []).map((animal) =>
    (animal.status || "PENDING").toUpperCase(),
  );

  if (statuses.length === 0) return "NO_ANIMALS";
  if (statuses.every((status) => status === "APPROVED")) return "APPROVED";
  if (statuses.every((status) => status === "SUBJECT_TO_REVISION")) {
    return "SUBJECT_TO_REVISION";
  }
  if (statuses.every((status) => status === "VERIFIED")) return "VERIFIED";
  if (statuses.every((status) => status === "PENDING")) return "PENDING";
  return "MIXED";
}

// ── SPLIT CARD WITH HERO IMAGE COMPONENT (Tastefully Sized for SIBAT) ────────
function SibatHerdSplitCard({
  batch,
  isSelected,
  onSelect,
  getStatusBadge,
}: {
  batch: BatchItem;
  isSelected: boolean;
  onSelect: () => void;
  getStatusBadge: (status?: string) => React.ReactNode;
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
      className={`group cursor-pointer overflow-hidden rounded-xl border transition-all duration-200 flex flex-col sm:flex-row justify-between ${
        isSelected
          ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/30 shadow-md"
          : "border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md"
      }`}
    >
      {/* ── LEFT HERO IMAGE SECTION (Wider, landscape horizontal hero) ── */}
      <div className="relative aspect-[21/9] sm:aspect-auto sm:w-52 md:w-56 lg:w-64 sm:self-stretch min-h-[160px] sm:min-h-full shrink-0 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
        {currentPhoto ? (
          <Image
            src={currentPhoto}
            alt={batch.batch_name || `${batch.livestock_type_name} herd`}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 p-3 text-white">
            <span className="text-4xl drop-shadow-md">{avatar.emoji}</span>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              {batch.livestock_type_name}
            </span>
          </div>
        )}

        {/* Ambient Dark Gradient on bottom/sides */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

        {/* Top Badges */}
        <div className="absolute left-2.5 right-2.5 top-2.5 flex items-center justify-between gap-1.5 z-10">
          <Badge className="rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
            {batch.livestock_type_name}
          </Badge>

          {isSelected && (
            <Badge className="bg-emerald-700 text-white font-bold text-[10px] gap-1 px-1.5 py-0.5 shadow-xs">
              <Check className="size-2.5 stroke-[3]" /> Selected
            </Badge>
          )}
        </div>

        {/* Multiple Pictures Controls (compact chevron buttons) */}
        {photos.length > 1 && (
          <div className="absolute inset-y-0 left-1.5 right-1.5 flex items-center justify-between z-20 pointer-events-none">
            <button
              type="button"
              aria-label="Previous herd picture"
              onClick={handlePrevPhoto}
              className="pointer-events-auto flex size-6.5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/90 hover:scale-110 shadow-xs"
            >
              <ChevronLeft className="size-3.5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              aria-label="Next herd picture"
              onClick={handleNextPhoto}
              className="pointer-events-auto flex size-6.5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/90 hover:scale-110 shadow-xs"
            >
              <ChevronRight className="size-3.5 stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* Bottom Hero Overlay: Photo Counter & mobile herd code */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white z-10">
          {photos.length > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md">
              <Camera className="size-3 text-emerald-400" />
              <span>
                {(photoIndex % photos.length) + 1} of {photos.length}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-300">
              <ImageIcon className="size-3" />
              <span>Preset avatar</span>
            </div>
          )}

          <span className="sm:hidden rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-900 shadow-2xs">
            {batch.batch_code}
          </span>
        </div>
      </div>

      {/* ── RIGHT CONTENT SECTION (Horizontal split on sm+) ── */}
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5 space-y-2 min-w-0">
        <div className="space-y-2">
          {/* Header Row: Title, Herd Code & Regulatory Status Badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-950 group-hover:text-emerald-800 transition-colors line-clamp-1">
                  {batch.batch_name || `${batch.livestock_type_name} Herd`}
                </h3>
                <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 border border-slate-200 shrink-0">
                  {batch.batch_code}
                </span>
              </div>
            </div>

            <div className="shrink-0">{getStatusBadge(batch.review_status)}</div>
          </div>

          {/* Farmer, Barangay & Housing Pen (Dedicated Full-Width Row) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 font-bold text-slate-800">
              <User className="size-3.5 shrink-0 text-slate-400" />
              <span>{batch.farmer_name}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <MapPin className="size-3.5 shrink-0 text-slate-400" />
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

          {/* Field Verification Progress */}
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800">
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                <span>Field Verification</span>
              </span>
              <span className={`font-bold ${batch.review_status === "APPROVED" ? "text-emerald-700" : "text-sky-700"}`}>
                {verificationProgress}% ({sibatCheckedCount}/{headCount})
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  batch.review_status === "APPROVED" ? "bg-emerald-600" : "bg-sky-600"
                }`}
                style={{ width: `${verificationProgress}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-500">
              <span>{batch.approved_animals ?? 0} approved · {batch.pending_animals ?? 0} waiting SIBAT</span>
              {batch.target_weight && <span>Target: {batch.target_weight} kg</span>}
            </div>
          </div>

          {/* Quick Metrics Chips */}
          <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold text-slate-700">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center">
              <span className="block text-slate-500 text-[10px] uppercase">Animals in Herd</span>
              <span className="text-slate-950 font-bold text-xs">
                {headCount} {headCount === 1 ? "Head" : "Heads"}
              </span>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center">
              <span className="block text-slate-500 text-[10px] uppercase">Avg Weight</span>
              <span className="text-slate-950 font-bold text-xs">
                {avgWeight ? `${avgWeight} kg` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: Picture Counter & Review Herd Button */}
        <div className="border-t border-slate-100 pt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-500">
            {photos.length > 1
              ? `${photos.length} photos`
              : photos.length === 1
                ? "1 photo"
                : "Default avatar"}
          </span>

          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`h-8 px-3 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all ${
              isSelected
                ? "bg-emerald-700 text-white hover:bg-emerald-800"
                : "bg-slate-900 text-white hover:bg-emerald-700"
            }`}
          >
            <span>Review Herd</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SibatBatchesVerificationContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const batchIdParam = searchParams.get("batchId") || searchParams.get("id");
  const animalIdParam = searchParams.get("animalId") || searchParams.get("livestockId");
  const tagParam = searchParams.get("tag") || searchParams.get("tagNumber");
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

  const [animalViewMode, setAnimalViewMode] = useState<"card" | "table">("card");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setAnimalViewMode("table");
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    // Herds may be created or reviewed by another user while this page is open.
    // Refresh on entry so a cached empty list does not hide newly available herds.
    staleTime: 30_000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const batches = batchSummaryPage?.results ?? [];
  const isInitialLoading = isLoading && !batchSummaryPage;
  const keepLoadingScreenMounted = useLoadingScreenTransition(isInitialLoading);

  // Load the individual roster only after a reviewer opens a herd.
  const detailQuery = useQuery<BatchItem>({
    queryKey: ["sibat-batch-detail", user?.email, selectedBatch?.id],
    enabled: isDrilldownOpen && Boolean(selectedBatch?.id),
    queryFn: async ({ signal }) => (await api.get(`livestock/batches/${selectedBatch?.id}/`, { signal })).data,
    staleTime: 30_000,
  });
  // React Query refreshes the selected herd detail independently from local UI state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (detailQuery.data && detailQuery.data.id === selectedBatch?.id) {
      setSelectedBatch(detailQuery.data);
    }
  }, [detailQuery.data, selectedBatch?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Automatically select and open drilldown if `batchId` is present in URL
  // The URL is external navigation state; reflect its matching herd in the drilldown.
  /* eslint-disable react-hooks/set-state-in-effect */
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
      setSelectedBatch(found);
      setIsDrilldownOpen(true);
    }
  }, [batchIdParam, batches]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!batchIdParam || !isDrilldownOpen || !selectedBatch || detailQuery.isLoading) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("selected-herd-review-record")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [batchIdParam, detailQuery.isLoading, isDrilldownOpen, selectedBatch?.id]);

  // ── KPI Metrics ──────────────────────────────────────────────────────────
  // The API aggregates statuses from individual rows, so herd list KPIs stay accurate without loading every roster.
  const kpis = useMemo(() => {
    const summary = batchSummaryPage?.summary;
    const totalBatches = batchSummaryPage?.count ?? 0;
    const totalAnimals = summary?.totalAnimals ?? 0;
    return {
      totalBatches,
      totalAnimals,
      pendingAnimals: summary?.pendingAnimals ?? 0,
      verifiedAnimals: summary?.verifiedAnimals ?? 0,
      approvedAnimals: summary?.approvedAnimals ?? 0,
      revisionAnimals: summary?.revisionAnimals ?? 0,
      avgHeads: totalBatches > 0 ? (totalAnimals / totalBatches).toFixed(1) : "0",
    };
  }, [batchSummaryPage]);

  const speciesList = useMemo(() => {
    const set = new Set<string>();
    batches.forEach((b) => {
      if (b.livestock_type_name) set.add(b.livestock_type_name);
    });
    return Array.from(set).sort();
  }, [batches]);

  // ── Filtered Batches ─────────────────────────────────────────────────────
  const filteredBatches = useMemo(() => {
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

      const matchStatus = statusFilter === "ALL" || (
        statusFilter === "PENDING" ? (b.pending_animals ?? 0) > 0 :
        statusFilter === "VERIFIED" ? (b.verified_animals ?? 0) > 0 :
        statusFilter === "APPROVED" ? (b.approved_animals ?? 0) > 0 :
        statusFilter === "SUBJECT_TO_REVISION" ? (b.revision_animals ?? 0) > 0 : false
      );

      const matchBarangay =
        activeBarangayFilter === "ALL" ||
        b.barangay_name?.trim().toLowerCase() === activeBarangayFilter.trim().toLowerCase();

      return matchSearch && matchSpecies && matchStatus && matchBarangay;
    });
  }, [batches, searchQuery, speciesFilter, statusFilter, activeBarangayFilter]);

  const filteredChildAnimals = useMemo(() => {
    if (!selectedBatch || !selectedBatch.animals) return [];
    return selectedBatch.animals.filter((a) => {
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
  }, [selectedBatch, animalSearchQuery, animalStatusFilter]);

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
  const animalPageFilterKey = JSON.stringify([selectedBatch?.id, animalSearchQuery, animalStatusFilter]);
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
  const selectedPendingAnimals = (selectedBatch?.animals ?? []).filter(
    (animal) => selectedAnimalIds.includes(animal.id) && (animal.status || "PENDING").toUpperCase() === "PENDING",
  );
  const allFilteredPendingAnimalsSelected = filteredPendingAnimalIds.length > 0
    && filteredPendingAnimalIds.every((id) => selectedAnimalIds.includes(id));

  // Automatically focus on and page to target animal if `animalId` or `tag` is present in URL
  // Deep-link parameters identify the roster row and require updating the drilldown controls.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isDrilldownOpen || !selectedBatch?.animals || selectedBatch.animals.length === 0) {
      return;
    }
    if (!animalIdParam && !tagParam) return;

    const animals = selectedBatch.animals;
    const target = animals.find((a) => {
      if (animalIdParam && String(a.id) === String(animalIdParam)) return true;
      if (tagParam && a.tag_number && a.tag_number.trim().toLowerCase() === tagParam.trim().toLowerCase()) return true;
      return false;
    });

    if (!target) return;

    setHighlightedAnimalId(target.id);

    // Reset filters to ensure the target animal is visible
    if (animalSearchQuery) setAnimalSearchQuery("");
    if (animalStatusFilter !== "ALL") setAnimalStatusFilter("ALL");

    // Switch to page containing target animal
    const targetIndex = animals.findIndex((a) => a.id === target.id);
    if (targetIndex !== -1) {
      const targetPage = Math.floor(targetIndex / ANIMAL_PAGE_SIZE) + 1;
      setAnimalPage(targetPage);
    }
  }, [isDrilldownOpen, selectedBatch?.id, selectedBatch?.animals, animalIdParam, tagParam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Smoothly scroll down and focus on target animal once rendered in DOM
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

  // ── Mutations: Batch Review (SIBAT verification) ─────────────────────────
  // Individual animals are reviewed from the inventory queue.

  function toggleFilteredPendingAnimals(checked: boolean) {
    setSelectedAnimalIds((current) => checked
      ? Array.from(new Set([...current, ...filteredPendingAnimalIds]))
      : current.filter((id) => !filteredPendingAnimalIds.includes(id)));
  }

  async function verifySelectedAnimals() {
    if (!selectedBatch || selectedPendingAnimals.length === 0 || selectedPendingAnimals.length !== selectedAnimalIds.length) return;
    setBulkVerifying(true);
    try {
      // Reuse the individual review endpoint so role checks, barangay scope,
      // audit fields, and farmer notifications remain the same for every animal.
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
        queryClient.invalidateQueries({ queryKey: ["sibat-batch-detail", selectedBatch.id] }),
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
    // Summary rows omit `animals`; keep cached detail when reopening a herd so
    // the roster does not disappear while React Query serves its cached result.
    const cachedDetail = queryClient.getQueryData<BatchItem>([
      "sibat-batch-detail",
      batch.id,
    ]);
    setSelectedBatch(cachedDetail ?? batch);
    setIsDrilldownOpen(true);
  }

  function closeHerdDrilldown() {
    setIsDrilldownOpen(false);
    setHighlightedAnimalId(null);
    scrolledAnimalIdRef.current = null;
    if (batchIdParam) router.replace("/sibat/batches", { scroll: false });
  }

  function openAnimalReview(batch: BatchItem, animal: ChildAnimal) {
    // The herd roster contains enough animal and farmer context to open the same
    // individual review dialog used by the SIBAT registry.
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

  const getStatusBadge = (status?: string) => {
    const s = (status || "PENDING").toUpperCase();
    if (s === "MIXED") {
      return <Badge variant="outline" className="text-[10px] font-bold text-slate-700 border-slate-300">Mixed animal statuses</Badge>;
    }
    if (s === "NO_ANIMALS") {
      return <Badge variant="outline" className="text-[10px] font-bold text-slate-500">No animals</Badge>;
    }
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          All animals approved
        </span>
      );
    }
    if (s === "VERIFIED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-300">
          <ShieldCheck className="w-3 h-3 text-sky-600" />
          All animals checked
        </span>
      );
    }
    if (s === "SUBJECT_TO_REVISION" || s === "SUBJECT_FOR_REVISION") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Animals Needing Revision
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
        <Clock className="w-3 h-3 text-amber-600" />
        Waiting SIBAT Verification
      </span>
    );
  };

  const getAnimalStatusBadge = (status?: string) => {
    const s = (status || "PENDING").toUpperCase();
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Approved
        </span>
      );
    }
    if (s === "VERIFIED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-300">
          <ShieldCheck className="w-3 h-3 text-sky-600" />
          SIBAT Checked
        </span>
      );
    }
    if (s === "SUBJECT_TO_REVISION" || s === "SUBJECT_FOR_REVISION" || s === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Needs Revision
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
        <Clock className="w-3 h-3 text-amber-600" />
        Waiting SIBAT Verification
      </span>
    );
  };

  const getSpeciesColor = (species: string) => {
    const s = species?.toLowerCase() || "";
    if (s.includes("cattle") || s.includes("cow")) return "bg-emerald-50 text-emerald-800 border-emerald-200";
    if (s.includes("swine") || s.includes("pig")) return "bg-rose-50 text-rose-800 border-rose-200";
    if (s.includes("carabao")) return "bg-stone-100 text-stone-800 border-stone-300";
    if (s.includes("goat")) return "bg-amber-50 text-amber-800 border-amber-200";
    if (s.includes("poultry") || s.includes("chicken")) return "bg-orange-50 text-orange-800 border-orange-200";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  if (isInitialLoading || keepLoadingScreenMounted) {
    return (
      <>
        <PageHeader
          title={herdPageTitle}
          subtitle="Choose a registered livestock herd to inspect individual animals and verify records."
          variant="farmer"
          maxWidthClass="w-full"
          icon={<Layers className="size-5 text-white" />}
          hideIconOnMobile
          showTutorialToggle={false}
          mobileActionsInline
        />
        <div className="mx-auto w-full p-3 sm:p-5 lg:px-8 lg:py-6">
          <ValidationLoadingScreen
            isLoading={isInitialLoading}
            title="Loading SIBAT Herd Ledger"
            subtitle="Connecting authorized livestock batches, aggregate animal counts, and field inspection rosters..."
            badgeLabel="Herd Verification Queue"
            authorityText="SIBAT Field Review · Barangay-scoped herds"
            items={[
              {
                id: "batches",
                label: "Livestock Herds",
                sublabel: "Grouped cattle, swine, and livestock batches",
                icon: <Layers className="size-4 text-emerald-700" />,
                loaded: !isLoading,
              },
              {
                id: "roster",
                label: "Animal Roster",
                sublabel: "Individual tags and verification records",
                icon: <ShieldCheck className="size-4 text-sky-600" />,
                loaded: !isLoading,
              },
              {
                id: "barangay",
                label: "Area Scope",
                sublabel: "Barangay jurisdiction filter",
                icon: <MapPin className="size-4 text-amber-600" />,
                loaded: !isLoading,
              },
            ]}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={
          isDrilldownOpen && selectedBatch ? (
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="truncate">{selectedBatch.batch_name}</span>
              <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[11px] font-mono font-bold text-white shrink-0">
                {selectedBatch.batch_code}
              </span>
            </div>
          ) : (
            herdPageTitle
          )
        }
        subtitle={
          isDrilldownOpen && selectedBatch
            ? `Farmer: ${selectedBatch.farmer_name} • Brgy. ${selectedBatch.barangay_name} • ${selectedBatch.animals?.length || selectedBatch.total_animals} Heads`
            : "Choose a registered livestock herd to inspect individual animals and verify records."
        }
        variant="farmer"
        maxWidthClass="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        icon={<Layers className="size-5 text-white" />}
        hideIconOnMobile
        showTutorialToggle={false}
        mobileActionsInline
        showBreadcrumbs={!isDrilldownOpen}
      />

      <div className={isDrilldownOpen ? "hidden" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"}>
        {/* Navigation Breadcrumb / Top Bar */}
        <div className="flex min-w-0 flex-col items-start justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:p-4">
          <div className="flex items-center gap-2">
            <Link href="/sibat">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to overview
              </Button>
            </Link>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="text-xs font-black text-slate-600 uppercase tracking-wider hidden sm:inline">
              Herds ({batches.length})
            </span>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportHerdRosterCsv(filteredBatches)}
              disabled={isLoading || filteredBatches.length === 0}
              title="Download all herds matching the current filters, including their animal rosters"
              className="min-h-11 w-full gap-2 rounded-xl border-slate-200 px-3 text-sm font-semibold text-slate-700 sm:w-auto sm:px-4"
            >
              <Download className="size-3.5" />
              Download list ({filteredBatches.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="min-h-11 w-full gap-2 rounded-xl border-slate-200 px-3 text-sm font-semibold text-slate-700 sm:w-auto sm:px-4"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin text-sky-600" : ""}`} />
              Refresh list
            </Button>

            <div className="col-span-2 flex w-full items-center justify-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 sm:col-span-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`min-h-10 rounded-lg px-3 text-sm font-semibold flex items-center gap-2 transition-all ${viewMode === "grid"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
                title="Show herds as cards"
                aria-label="Show herds as cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`min-h-10 rounded-lg px-3 text-sm font-semibold flex items-center gap-2 transition-all ${viewMode === "table"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
                title="Show herds in a table"
                aria-label="Show herds in a table"
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          <Card className="rounded-xl border-slate-200 bg-white shadow-2xs transition-all hover:border-emerald-300">
            <CardContent className="p-3.5">
              <span className="text-xs font-bold text-slate-600 block">
                Total herds
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {kpis.totalBatches}
                </span>
                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">In your assigned area</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 bg-white shadow-2xs transition-all hover:border-emerald-300">
            <CardContent className="p-3.5">
              <span className="text-xs font-bold text-slate-600 block">
                Total animals
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-sky-800 font-mono">
                  {kpis.totalAnimals}
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  Heads
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Avg {kpis.avgHeads} animals / batch
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 bg-white shadow-2xs transition-all hover:border-emerald-300">
            <CardContent className="p-3.5">
              <span className="text-xs font-bold text-slate-600 block">
                Checked by field staff
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-sky-700 font-mono">
                  {kpis.verifiedAnimals}
                </span>
                <ShieldCheck className="w-4 h-4 text-sky-600" />
              </div>
              <p className="text-xs text-slate-600 mt-1">Ready for MAO approval</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 bg-white shadow-2xs transition-all hover:border-emerald-300">
            <CardContent className="p-3.5">
              <span className="text-xs font-bold text-slate-600 block">
                Waiting to be checked
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${kpis.pendingAnimals > 0 ? "text-amber-600" : "text-slate-400"}`}>
                  {kpis.pendingAnimals}
                </span>
                <Clock className={`w-4 h-4 ${kpis.pendingAnimals > 0 ? "text-amber-600" : "text-slate-400"}`} />
              </div>
              <p className="text-xs text-slate-600 mt-1">Farmer submissions</p>
            </CardContent>
          </Card>

          <Card className="col-span-2 rounded-xl border-slate-200 bg-white shadow-2xs transition-all hover:border-rose-300 sm:col-span-1">
            <CardContent className="p-3.5">
              <span className="text-xs font-bold text-slate-600 block">
                Needs correction
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${kpis.revisionAnimals > 0 ? "text-rose-600" : "text-slate-400"}`}>
                  {kpis.revisionAnimals}
                </span>
                <AlertTriangle className={`w-4 h-4 ${kpis.revisionAnimals > 0 ? "text-rose-600" : "text-slate-400"}`} />
              </div>
              <p className="text-xs text-slate-600 mt-1">Sent back to farmer</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <div className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2.5">
            <div className="relative lg:col-span-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by farmer, animal tag, or barangay"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-11 rounded-xl border-slate-200 bg-slate-50/80 pl-10 text-base focus-visible:ring-emerald-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="lg:col-span-3">
              <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
                <SelectTrigger className="min-h-11 rounded-xl border-slate-200 text-base font-medium">
                  <SelectValue placeholder="Animal type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All animal types ({speciesList.length})</SelectItem>
                  {speciesList.map((sp) => (
                    <SelectItem key={sp} value={sp}>
                      {sp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="min-h-11 rounded-xl border-slate-200 text-base font-medium">
                  <SelectValue placeholder="Review status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All review statuses ({batches.length})</SelectItem>
                  <SelectItem value="PENDING">Waiting to be checked ({kpis.pendingAnimals})</SelectItem>
                  <SelectItem value="VERIFIED">Waiting for MAO ({kpis.verifiedAnimals})</SelectItem>
                  <SelectItem value="APPROVED">Approved ({kpis.approvedAnimals})</SelectItem>
                  <SelectItem value="SUBJECT_TO_REVISION">Needs correction ({kpis.revisionAnimals})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-2">
              {user?.accessScope === "ALL_BARANGAYS" ? (
                <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                  <SelectTrigger className="min-h-11 rounded-xl border-slate-200 text-base font-medium truncate">
                    <SelectValue placeholder="Barangay" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-56">
                    <SelectItem value="ALL">All Barangays</SelectItem>
                    {PADRE_GARCIA_BARANGAYS.map((brgy) => (
                      <SelectItem key={brgy} value={brgy}>
                        {brgy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-medium text-slate-700">
                  Barangay: {user?.assignedBarangayName || "No barangay assigned"}
                </div>
              )}
            </div>
          </div>

          {(searchQuery || speciesFilter !== "ALL" || statusFilter !== "ALL" || activeBarangayFilter !== "ALL") && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap text-xs">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                Filters:
              </span>
              {searchQuery && (
                <Badge variant="secondary" className="rounded-lg text-[10px] font-medium gap-1 bg-slate-100">
                  Search: &ldquo;{searchQuery}&rdquo;
                  <button type="button" onClick={() => setSearchQuery("")} className="hover:text-red-500">×</button>
                </Badge>
              )}
              {speciesFilter !== "ALL" && (
                <Badge variant="secondary" className="rounded-lg text-[10px] font-medium gap-1 bg-slate-100">
                  Species: {speciesFilter}
                  <button type="button" onClick={() => setSpeciesFilter("ALL")} className="hover:text-red-500">×</button>
                </Badge>
              )}
              {statusFilter !== "ALL" && (
                <Badge variant="secondary" className="rounded-lg text-[10px] font-medium gap-1 bg-slate-100">
                  Status: {statusFilter}
                  <button type="button" onClick={() => setStatusFilter("ALL")} className="hover:text-red-500">×</button>
                </Badge>
              )}
              {activeBarangayFilter !== "ALL" && (
                <Badge variant="secondary" className="rounded-lg text-[10px] font-medium gap-1 bg-slate-100">
                  Barangay: {activeBarangayFilter}
                  <button type="button" onClick={() => setBarangayFilter("ALL")} className="hover:text-red-500">×</button>
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
                className="h-6 text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 rounded-md"
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {/* ── Main Batch Displays ── */}
        {isRefetching && !batchSummaryPage ? (
          <div role="status" aria-live="polite" className="mx-auto max-w-2xl rounded-xl border border-emerald-200 bg-white px-6 py-10 text-center shadow-2xs sm:px-10">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-50">
              <RefreshCw className="size-8 animate-spin text-emerald-700" />
            </div>
            <p className="text-xl font-bold text-slate-900">Loading your herd list</p>
            <p className="mx-auto mt-2 max-w-md text-base leading-6 text-slate-600">Please wait while we get the herds and animal records for your area.</p>
            <div className="mx-auto mt-6 max-w-md space-y-2" aria-hidden="true">
              <div className="h-3 animate-pulse rounded-full bg-slate-100" />
              <div className="mx-auto h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
        ) : isError && !batchSummaryPage ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center shadow-2xs">
            <p className="text-lg font-bold text-rose-900">We could not load the herd list</p>
            <p className="mx-auto mt-2 max-w-md text-base leading-6 text-rose-800">
              Check your internet connection, then try again. If the problem continues, ask your administrator for help.
            </p>
            <Button type="button" variant="outline" size="lg" onClick={() => void refetch()} className="mt-4 min-h-12 rounded-xl border-rose-300 px-5 text-base font-bold text-rose-900 hover:bg-rose-100">
              <RefreshCw className="mr-2 size-5" /> Try again
            </Button>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <Layers className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-lg font-bold text-slate-800">No herds found</p>
            <p className="text-base leading-6 text-slate-600 mt-2 max-w-md mx-auto">
              Try a different search, or clear the filters to see all herds in your area.
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
              className="mt-4 rounded-xl text-xs font-bold"
            >
              Clear filters
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View Mode */
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {pagedBatches.map((batch) => (
                <SibatHerdSplitCard
                  key={batch.id}
                  batch={batch}
                  isSelected={selectedBatch?.id === batch.id}
                  onSelect={() => openHerdDrilldown(batch)}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 py-2 text-xs">
              <span className="text-[11px] text-slate-500 font-medium">
                Showing herds {(safeBatchPage - 1) * BATCH_PAGE_SIZE + 1}–{Math.min(safeBatchPage * BATCH_PAGE_SIZE, filteredBatches.length)} of {filteredBatches.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" disabled={safeBatchPage <= 1} onClick={() => setBatchPage((p) => p - 1)} className="min-h-10 rounded-lg px-3 text-sm font-semibold">‹ Previous</Button>
                <span className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white">Page {safeBatchPage} of {pageCountBatches}</span>
                <Button variant="outline" size="sm" disabled={safeBatchPage >= pageCountBatches} onClick={() => setBatchPage((p) => p + 1)} className="min-h-10 rounded-lg px-3 text-sm font-semibold">Next ›</Button>
              </div>
            </div>
          </div>
        ) : (
          /* Table View Mode */
          <>
          <div className="space-y-3 md:hidden">
            {pagedBatches.map((batch) => (
              <Card key={batch.id} className="rounded-xl border-slate-200 shadow-2xs">
                <CardContent className="space-y-3 p-4">
                  <HerdPhoto batch={batch} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-lg font-bold text-slate-900">{batch.batch_name || `${batch.livestock_type_name} herd`}</p>
                      <p className="mt-1 text-sm text-slate-600">{batch.livestock_type_name} · {batch.batch_code}</p>
                    </div>
                    {getStatusBadge(batch.review_status)}
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                    <div><span className="block text-xs font-semibold text-slate-500">Farmer</span><span className="break-words font-semibold text-slate-900">{batch.farmer_name}</span></div>
                    <div><span className="block text-xs font-semibold text-slate-500">Barangay</span><span className="break-words font-semibold text-slate-900">{batch.barangay_name}</span></div>
                    <div><span className="block text-xs font-semibold text-slate-500">Animals</span><span className="font-semibold text-slate-900">{batch.total_animals || batch.animals?.length || 0}</span></div>
                    <div><span className="block text-xs font-semibold text-slate-500">Average weight</span><span className="font-semibold text-slate-900">{batch.average_weight ? `${batch.average_weight} kg` : "Not recorded"}</span></div>
                  </div>
                  <Button type="button" onClick={() => openHerdDrilldown(batch)} className="min-h-11 w-full rounded-xl bg-emerald-700 text-base font-bold text-white hover:bg-emerald-800">
                    <Eye className="mr-2 size-5" /> Open herd and animals
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Batch Code
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Herd name &amp; animal type
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Farmer &amp; Barangay
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 text-center">
                      Heads
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Pen &amp; Feed
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Weight Profile
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedBatches.map((batch) => {
                    const headCount = batch.total_animals || batch.animals?.length || 0;
                    return (
                      <TableRow key={batch.id} className="hover:bg-slate-50/60 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-slate-900">
                          {batch.batch_code}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <HerdPhoto batch={batch} compact />
                            <div className="min-w-0 space-y-0.5">
                              <span className="block max-w-[200px] truncate text-xs font-bold text-slate-900">
                                {batch.batch_name || `${batch.livestock_type_name} Herd`}
                              </span>
                              <span
                                className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${getSpeciesColor(
                                  batch.livestock_type_name
                                )}`}
                              >
                                {batch.livestock_type_name}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-xs">
                            <span className="font-bold text-slate-800 block truncate max-w-[180px]">
                              {batch.farmer_name}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {batch.barangay_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono font-black text-xs text-sky-800">
                          {headCount}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          <div>Pen: {batch.housing_pen || "General"}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {batch.feed_type || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            Avg: <strong>{batch.average_weight ? `${batch.average_weight} kg` : "N/A"}</strong>
                          </div>
                          {batch.target_weight && (
                            <div className="text-[10px] text-slate-400">
                              Target: {batch.target_weight} kg
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(batch.review_status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                                openHerdDrilldown(batch);
                            }}
                            className="h-9 rounded-xl bg-emerald-700 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Open herd
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-xs">
              <span className="text-[11px] text-slate-500 font-medium">
                Showing herds {(safeBatchPage - 1) * BATCH_PAGE_SIZE + 1}–
                {Math.min(safeBatchPage * BATCH_PAGE_SIZE, filteredBatches.length)} of {filteredBatches.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeBatchPage <= 1}
                  onClick={() => setBatchPage((p) => p - 1)}
                  className="min-h-10 rounded-lg px-3 text-sm font-semibold"
                >
                  ‹ Previous
                </Button>
                <span className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[10px] font-black text-white">
                  Page {safeBatchPage} of {pageCountBatches}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeBatchPage >= pageCountBatches}
                  onClick={() => setBatchPage((p) => p + 1)}
                  className="min-h-10 rounded-lg px-3 text-sm font-semibold"
                >
                  Next ›
                </Button>
              </div>
            </div>
          </div>
          </>
        )}
      </div>

      {/* Inline herd details and individual livestock roster */}
      {isDrilldownOpen && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-32 sm:pb-28" aria-label="Herd details">
          {detailQuery.isLoading ? (
            <div
              className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-6 text-center shadow-2xs"
              role="status"
              aria-live="polite"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <RefreshCw className="size-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">Loading herd and animals…</h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Please wait while the animal roster is being loaded.
                </p>
              </div>
            </div>
          ) : detailQuery.isError ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-center shadow-2xs">
              <AlertTriangle className="size-8 text-rose-600" />
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900">We could not open this herd</h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Check your network connection and try again.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void detailQuery.refetch()} className="rounded-xl px-4 text-xs font-bold border-rose-300 text-rose-800">
                Try again
              </Button>
            </div>
          ) : selectedBatch && (
            <div className="space-y-4 sm:space-y-5">
              {/* Top Navigation Bar: Back button (upper left, outside) + Breadcrumbs + Status */}
              <div
                id="selected-herd-review-record"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1"
              >
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={closeHerdDrilldown}
                    className="h-9 gap-1.5 rounded-xl border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-2xs shrink-0"
                  >
                    <ArrowLeft className="size-3.5" /> Back to herds
                  </Button>

                  <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 font-medium min-w-0">
                    <Link href="/sibat" className="hover:text-slate-900 transition-colors shrink-0">SmartLivestock</Link>
                    <span className="text-slate-300">/</span>
                    <button type="button" onClick={closeHerdDrilldown} className="hover:text-slate-900 transition-colors shrink-0 font-medium cursor-pointer">Herds</button>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-900 font-bold truncate">{selectedBatch.batch_code}</span>
                  </nav>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
                  {getStatusBadge(selectedBatch.review_status)}
                </div>
              </div>

              {/* Herd Profile & Husbandry Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
                {/* Photo Gallery Column (5 cols on lg) */}
                <div className="lg:col-span-5">
                  <HerdProfileGallery batch={selectedBatch} />
                </div>

                {/* Herd Summary & KPI Metrics Column (7 cols on lg) */}
                <div className="lg:col-span-7 space-y-3 sm:space-y-3.5">
                  {/* Herd Identification Card */}
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full mb-1.5">
                          Herd Profile
                        </span>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight truncate">
                          {selectedBatch.batch_name}
                        </h2>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap">
                          <span>Farmer: <strong className="text-slate-800">{selectedBatch.farmer_name}</strong></span>
                          <span className="text-slate-300">•</span>
                          <span>Brgy. <strong className="text-slate-800">{selectedBatch.barangay_name}</strong></span>
                          <span className="text-slate-300">•</span>
                          <span>Code: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-700 font-mono">{selectedBatch.batch_code}</code></span>
                        </div>
                      </div>
                      <div className="size-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center text-xl shadow-xs shrink-0">
                        {getDefaultAvatarForSpecies(selectedBatch.livestock_type_name).emoji}
                      </div>
                    </div>

                    {selectedBatch.notes && (
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 italic bg-slate-50/70 p-2.5 rounded-xl">
                        &ldquo;{selectedBatch.notes}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* Husbandry & Environment Summary KPI Cards */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                    <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 sm:size-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center justify-center shrink-0">
                          <Layers className="size-4" />
                        </div>
                        <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Commodity</span>
                      </div>
                      <div className="mt-2.5">
                        <span className="text-base sm:text-lg font-black text-slate-900 block truncate">
                          {selectedBatch.livestock_type_name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 block truncate">
                          Code: {selectedBatch.batch_code}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 sm:size-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center shrink-0">
                          <ShieldCheck className="size-4" />
                        </div>
                        <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Enrolled Herd</span>
                      </div>
                      <div className="mt-2.5">
                        <span className="text-base sm:text-lg font-black text-slate-900 block">
                          {selectedBatch.animals?.length || selectedBatch.total_animals} <span className="text-xs font-semibold text-slate-500">Heads</span>
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          Total capacity: {selectedBatch.enrolled_animals ?? selectedBatch.total_animals}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 sm:size-9 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/60 flex items-center justify-center shrink-0">
                          <Scale className="size-4" />
                        </div>
                        <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Average Weight</span>
                      </div>
                      <div className="mt-2.5">
                        <span className="text-base sm:text-lg font-black text-slate-900 block">
                          {selectedBatch.average_weight ? `${selectedBatch.average_weight} kg` : "—"}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 block truncate">
                          Target: {selectedBatch.target_weight ? `${selectedBatch.target_weight} kg` : "Not set"}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs flex flex-col justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 sm:size-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center shrink-0">
                          <Building2 className="size-4" />
                        </div>
                        <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Facility &amp; Feed</span>
                      </div>
                      <div className="mt-2.5">
                        <span className="text-base sm:text-lg font-black text-slate-900 block truncate">
                          {selectedBatch.housing_pen || "Standard Pen"}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 block truncate">
                          Feed: {selectedBatch.feed_type || "Standard"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Protocol Guidance Banner */}
              <div className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 shadow-2xs">
                <div className="size-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Info className="size-4.5" />
                </div>
                <div className="space-y-0.5 text-xs sm:text-sm">
                  <p className="font-bold text-emerald-950">Field Review &amp; Ear Tag Verification</p>
                  <p className="text-emerald-800/90 leading-relaxed text-xs">
                    Inspect physical ear tags and livestock condition on site. Select checked animals via checkboxes to verify in bulk, or click individual rows to inspect detailed history.
                  </p>
                </div>
              </div>

              {/* Individual Animals Roster Container */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-2xs space-y-4">
                {/* Roster Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center justify-between gap-3 w-full lg:w-auto">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8.5 rounded-xl bg-slate-100 text-emerald-800 flex items-center justify-center shrink-0">
                        <ClipboardList className="size-4.5" />
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-none">
                          Individual Animal Records
                        </h2>
                        <span className="text-xs text-slate-500 font-medium">
                          {filteredChildAnimals.length} animal{filteredChildAnimals.length === 1 ? "" : "s"} listed
                        </span>
                      </div>
                    </div>

                    {/* View Mode Toggler (Cards / Table) */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
                      <button
                        type="button"
                        onClick={() => setAnimalViewMode("card")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          animalViewMode === "card"
                            ? "bg-white text-emerald-800 shadow-2xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                        aria-label="Cards view"
                        title="Cards view"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Cards</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnimalViewMode("table")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          animalViewMode === "table"
                            ? "bg-white text-emerald-800 shadow-2xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                        aria-label="Table view"
                        title="Table view"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Table</span>
                      </button>
                    </div>
                  </div>

                  {/* Search, Filter & Bulk Select Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 sm:w-60 min-w-[160px]">
                      <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <Input
                        placeholder="Search by ear tag or ID..."
                        value={animalSearchQuery}
                        onChange={(e) => setAnimalSearchQuery(e.target.value)}
                        className="h-9.5 rounded-xl border-slate-200 pl-8.5 text-xs focus-visible:ring-1 focus-visible:ring-emerald-700"
                      />
                      {animalSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setAnimalSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          <RotateCcw className="size-3" />
                        </button>
                      )}
                    </div>

                    <div className="relative min-w-[130px]">
                      <select
                        value={animalStatusFilter}
                        onChange={(e) => setAnimalStatusFilter(e.target.value)}
                        className="h-9.5 w-full pl-3 pr-7 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-700 cursor-pointer appearance-none"
                      >
                        <option value="ALL">All Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="VERIFIED">Verified</option>
                        <option value="APPROVED">Approved</option>
                        <option value="SUBJECT_TO_REVISION">Revision</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toggleFilteredPendingAnimals(!allFilteredPendingAnimalsSelected)}
                      disabled={filteredPendingAnimalIds.length === 0}
                      className="h-9.5 rounded-xl border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <CheckSquare className="mr-1.5 size-3.5 text-slate-500" />
                      {allFilteredPendingAnimalsSelected ? "Deselect All" : "Select Pending"}
                    </Button>

                    {selectedAnimalIds.length > 0 && (
                      <Button
                        type="button"
                        onClick={() => setBulkVerifyOpen(true)}
                        className="h-9.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3.5 flex items-center gap-1.5 shadow-2xs animate-in fade-in cursor-pointer"
                      >
                        <ShieldCheck className="size-4" />
                        Verify ({selectedAnimalIds.length})
                      </Button>
                    )}
                  </div>
                </div>

                {/* Animal Records Display (Card View or Table View based on toggler) */}
                {animalViewMode === "card" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredChildAnimals.length === 0 ? (
                      <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs sm:text-sm text-slate-500 font-medium">
                        No individual animals match this search or filter.
                      </div>
                    ) : (
                      pagedChildAnimals.map((animal) => {
                        const mobileWeight = animal.weight == null ? null : Number(animal.weight);
                        const isPending = (animal.status || "PENDING").toUpperCase() === "PENDING";
                        const isTarget = highlightedAnimalId === animal.id;
                        const avatar = getDefaultAvatarForSpecies(selectedBatch.livestock_type_name);

                        return (
                          <article
                            key={animal.id}
                            id={`animal-card-${animal.id}`}
                            className={`rounded-2xl border p-3.5 shadow-2xs transition-all ${
                              isTarget
                                ? "border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-600 shadow-md"
                                : selectedAnimalIds.includes(animal.id)
                                  ? "border-emerald-300 bg-emerald-50/40"
                                  : "border-slate-200/90 bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${animal.tag_number || `animal ${animal.id}`} for field verification`}
                                  checked={selectedAnimalIds.includes(animal.id)}
                                  disabled={!isPending}
                                  onChange={(event) => setSelectedAnimalIds((current) => event.target.checked
                                    ? Array.from(new Set([...current, animal.id]))
                                    : current.filter((id) => id !== animal.id))}
                                  className="size-5 shrink-0 rounded border-slate-300 accent-emerald-700 disabled:opacity-40"
                                />
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`size-8 rounded-xl flex items-center justify-center text-xs border shadow-2xs shrink-0 ${avatar.bgGradient}`}>
                                    {avatar.emoji}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-sm font-bold text-slate-900 truncate">
                                        {animal.tag_number || `#${animal.id}`}
                                      </span>
                                      {animal.tag_number && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            handleCopyTag(animal.tag_number);
                                          }}
                                          className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
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
                                    <span className="text-[10px] font-mono text-slate-400 block">ID: {animal.id}</span>
                                  </div>
                                </div>
                              </label>
                              <div className="shrink-0">{getAnimalStatusBadge(animal.status)}</div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50/80 p-2.5 text-xs">
                              <div><span className="block text-[10px] uppercase font-bold text-slate-400">Breed</span><span className="font-bold text-slate-800 truncate block">{animal.breed || "Standard"}</span></div>
                              <div><span className="block text-[10px] uppercase font-bold text-slate-400">Sex</span><span className="font-bold text-slate-800">{animal.sex || "—"}</span></div>
                              <div><span className="block text-[10px] uppercase font-bold text-slate-400">Age</span><span className="font-bold text-slate-800">{animal.age?.total_months != null ? `${animal.age.total_months} mos` : "—"}</span></div>
                              <div><span className="block text-[10px] uppercase font-bold text-slate-400">Weight</span><span className="font-bold text-slate-800">{mobileWeight == null ? "—" : `${mobileWeight} kg`}</span></div>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => openAnimalReview(selectedBatch, animal)}
                              className="mt-3 h-9 w-full rounded-xl border-emerald-200/80 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Eye className="size-3.5" />
                              {isPending ? "Review animal details" : "View animal details"}
                            </Button>
                          </article>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1 md:hidden">
                      <span>← Scroll horizontally to inspect roster columns →</span>
                    </div>
                    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/90 bg-white">
                      <Table className="min-w-[1050px]">
                        <TableHeader className="bg-slate-50/90">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-12 text-center text-xs font-bold text-slate-700">Select</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">Ear Tag #</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">Breed</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sex</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">Age (mos)</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">Weight (kg)</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">Vaccination</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 text-right sticky right-0 z-10 bg-slate-50 border-l border-slate-200 shadow-[-4px_0_8px_-8px_rgba(0,0,0,0.25)]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredChildAnimals.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-8 text-xs sm:text-sm text-slate-500">
                                No individual animals found matching filter criteria.
                              </TableCell>
                            </TableRow>
                          ) : (
                            pagedChildAnimals.map((animal) => {
                              const isTarget = highlightedAnimalId === animal.id;
                              const avatar = getDefaultAvatarForSpecies(selectedBatch.livestock_type_name);
                              const animalWeight = animal.weight ? Number(animal.weight) : null;
                              const batchAvg = selectedBatch.average_weight ? Number(selectedBatch.average_weight) : null;
                              const weightDiff = animalWeight && batchAvg ? (animalWeight - batchAvg).toFixed(1) : null;

                              return (
                                <TableRow
                                  key={animal.id}
                                  id={`animal-row-${animal.id}`}
                                  className={`transition-all ${
                                    isTarget
                                      ? "bg-emerald-100/90 ring-2 ring-emerald-600 ring-inset shadow-md font-medium"
                                      : selectedAnimalIds.includes(animal.id)
                                        ? "bg-emerald-50/50"
                                        : "hover:bg-slate-50/70"
                                  }`}
                                >
                                  <TableCell className="text-center">
                                    <input
                                      type="checkbox"
                                      aria-label={`Select ${animal.tag_number || `animal ${animal.id}`} for field verification`}
                                      checked={selectedAnimalIds.includes(animal.id)}
                                      disabled={(animal.status || "PENDING").toUpperCase() !== "PENDING"}
                                      onChange={(event) => setSelectedAnimalIds((current) => event.target.checked
                                        ? Array.from(new Set([...current, animal.id]))
                                        : current.filter((id) => id !== animal.id))}
                                      className="size-4.5 rounded border-slate-300 accent-emerald-700 disabled:opacity-40"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className={`size-8 rounded-xl flex items-center justify-center text-xs border shadow-2xs shrink-0 ${avatar.bgGradient}`}>
                                        {avatar.emoji}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-mono font-bold text-xs text-slate-900">
                                            {animal.tag_number || `#${animal.id}`}
                                          </span>
                                          {animal.tag_number && (
                                            <button
                                              type="button"
                                              onClick={() => handleCopyTag(animal.tag_number)}
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
                                      onClick={() => openAnimalReview(selectedBatch, animal)}
                                      className="h-8 px-2.5 rounded-lg border-emerald-200 text-emerald-800 hover:bg-emerald-50 text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                                    >
                                      <Eye className="size-3.5" />
                                      <span>Review</span>
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
                )}

                {/* Pagination & Status Footer */}
                {filteredChildAnimals.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
                    <span className="text-xs font-medium text-slate-500">
                      Showing {(safeAnimalPage - 1) * ANIMAL_PAGE_SIZE + 1}–{Math.min(safeAnimalPage * ANIMAL_PAGE_SIZE, filteredChildAnimals.length)} of {filteredChildAnimals.length} animals
                    </span>
                    {filteredChildAnimals.length > ANIMAL_PAGE_SIZE && (
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safeAnimalPage <= 1}
                          onClick={() => setAnimalPage((p) => p - 1)}
                          className="h-8 px-2.5 rounded-lg text-xs font-bold border-slate-200 cursor-pointer"
                        >
                          ‹ Prev
                        </Button>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
                          {safeAnimalPage} / {pageCountAnimals}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={safeAnimalPage >= pageCountAnimals}
                          onClick={() => setAnimalPage((p) => p + 1)}
                          className="h-8 px-2.5 rounded-lg text-xs font-bold border-slate-200 cursor-pointer"
                        >
                          Next ›
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Reviewer Notes & Audit Trail Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
                <button
                  type="button"
                  onClick={() => setShowBatchNotes(!showBatchNotes)}
                  className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                  aria-expanded={showBatchNotes}
                >
                  <span className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <ClipboardList className="size-4 text-emerald-800 shrink-0" />
                    Reviewer Notes &amp; Batch Audit Trail
                    {selectedBatch.notes && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {selectedBatch.notes.split("\n").filter(Boolean).length} entries
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`size-4 text-slate-400 transition-transform shrink-0 ${showBatchNotes ? "rotate-180" : ""}`}
                  />
                </button>

                {showBatchNotes && (
                  <div className="pt-2 space-y-3 border-t border-slate-100">
                    <pre className="text-xs text-slate-700 font-sans whitespace-pre-wrap leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3.5 max-h-40 overflow-y-auto">
                      {selectedBatch.notes || "No audit notes recorded for this batch yet."}
                    </pre>
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start">
                      <Textarea
                        value={batchNoteText}
                        onChange={(e) => setBatchNoteText(e.target.value)}
                        placeholder="Add inspection observations or remarks for this batch..."
                        className="text-xs rounded-xl border-slate-200 focus-visible:ring-1 focus-visible:ring-emerald-700 min-h-[70px]"
                      />
                      <Button
                        size="sm"
                        disabled={addBatchNoteMutation.isPending || !batchNoteText.trim()}
                        onClick={() => {
                          if (!batchNoteText.trim() || !selectedBatch) return;
                          addBatchNoteMutation.mutate({
                            batchId: selectedBatch.id,
                            text: batchNoteText.trim(),
                          });
                        }}
                        className="h-10 sm:h-[70px] shrink-0 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer shadow-2xs"
                      >
                        {addBatchNoteMutation.isPending ? "Adding…" : "Add Note"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating Sticky Bottom Verification Bar */}
          {selectedAnimalIds.length > 0 && (
            <div className="fixed bottom-10 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center justify-between gap-2.5 sm:gap-3 bg-slate-900/95 text-white backdrop-blur-md px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-4 duration-200 w-[calc(100%-1.75rem)] sm:w-auto sm:min-w-[420px] max-w-lg">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <span className="size-6 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center shrink-0">
                  {selectedAnimalIds.length}
                </span>
                <span className="text-xs font-semibold text-slate-200 truncate">
                  <span className="hidden sm:inline">
                    animal{selectedAnimalIds.length === 1 ? "" : "s"} selected for verification
                  </span>
                  <span className="sm:hidden">
                    {selectedAnimalIds.length === 1 ? "animal selected" : "animals selected"}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAnimalIds([])}
                  className="h-8 px-2 sm:px-2.5 text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setBulkVerifyOpen(true)}
                  className="h-8.5 px-3 sm:px-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
                >
                  <ShieldCheck className="size-4" />
                  Verify Now
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

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

      <AlertDialog open={bulkVerifyOpen} onOpenChange={setBulkVerifyOpen}>
        <AlertDialogContent className="max-w-2xl gap-0 rounded-2xl border-slate-200 p-5 sm:p-6">
          <AlertDialogHeader className="gap-3 text-left">
            <AlertDialogTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 sm:text-2xl">
              <ShieldCheck className="size-6 shrink-0 text-emerald-600" />
              Confirm Animal Verification
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-slate-700">
              You selected {selectedPendingAnimals.length} {selectedPendingAnimals.length === 1 ? "animal" : "animals"} for verification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-6 text-slate-800">
            <h3 className="font-bold">What happens next?</h3>
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold">Your field check will be recorded.</p>
                <p className="mt-1 text-sm text-slate-600">The animal record will be sent to the MAO for final approval.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">Continue only if you have checked the animal&apos;s tag and details.</p>
          </div>
          <AlertDialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <AlertDialogCancel className="min-h-12 w-full rounded-xl border-slate-300 px-5 text-base font-semibold">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void verifySelectedAnimals(); }}
              disabled={bulkVerifying || selectedPendingAnimals.length === 0 || selectedPendingAnimals.length !== selectedAnimalIds.length}
              className="min-h-12 w-full rounded-xl bg-emerald-700 px-5 text-base font-bold text-white hover:bg-emerald-800"
            >
              {bulkVerifying ? "Saving verification…" : "Confirm Verification"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ──────────────────────────────────────────────────────────────────────────
          HERD REVIEW CONFIRMATION
      ────────────────────────────────────────────────────────────────────────── */}

    </>
  );
}

export default function SibatBatchesVerificationPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader
            title="Herds & Batches"
            subtitle="Choose a registered livestock herd to inspect individual animals and verify records."
            variant="farmer"
            maxWidthClass="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
            icon={<Layers className="size-5 text-white" />}
            hideIconOnMobile
            showTutorialToggle={false}
            mobileActionsInline
          />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <ValidationLoadingScreen
              isLoading={true}
              title="Loading SIBAT Herd Ledger"
              subtitle="Connecting authorized livestock batches, aggregate animal counts, and field inspection rosters..."
              badgeLabel="Herd Verification Queue"
              authorityText="SIBAT Field Review · Barangay-scoped herds"
              items={[
                {
                  id: "batches",
                  label: "Livestock Herds",
                  sublabel: "Grouped cattle, swine, and livestock batches",
                  icon: <Layers className="size-4 text-emerald-700" />,
                  loaded: false,
                },
                {
                  id: "roster",
                  label: "Animal Roster",
                  sublabel: "Individual tags and verification records",
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
        </>
      }
    >
      <SibatBatchesVerificationContent />
    </Suspense>
  );
}
