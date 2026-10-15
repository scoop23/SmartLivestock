"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  Info,
  Layers,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Weight,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Camera,
  ImageIcon,
  Check,
} from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/components/ui/utils";
import { toast } from "sonner";
import type { LivestockInventoryItem, StatusType, EntryType } from "./page";
import type { OperationalStatus } from "./livestock-inventory";
import { getAvatarById } from "./livestock-inventory";
import { OperationalStatusBadge } from "./operational-status-badge";
import { formatAgeClassification, formatCalendarDate, formatLivestockAge } from "@/lib/livestock-age";

/* ── Species Color Palette & Styling ── */
interface SpeciesTheme {
  label: string;
  badge: string;
  dot: string;
}

const getSpeciesTheme = (typeName?: string): SpeciesTheme => {
  const name = (typeName || "").toLowerCase();
  if (name.includes("cattle") || name.includes("cow") || name.includes("baka")) {
    return {
      label: "Cattle",
      badge: "bg-amber-50 text-amber-900 border-amber-200",
      dot: "bg-amber-500",
    };
  }
  if (name.includes("carabao") || name.includes("kalabaw") || name.includes("buffalo")) {
    return {
      label: "Carabao",
      badge: "bg-indigo-50 text-indigo-900 border-indigo-200",
      dot: "bg-indigo-500",
    };
  }
  if (name.includes("swine") || name.includes("pig") || name.includes("baboy") || name.includes("hog")) {
    return {
      label: "Swine",
      badge: "bg-rose-50 text-rose-900 border-rose-200",
      dot: "bg-rose-500",
    };
  }
  if (name.includes("goat") || name.includes("kambing")) {
    return {
      label: "Goat",
      badge: "bg-emerald-50 text-emerald-900 border-emerald-200",
      dot: "bg-emerald-500",
    };
  }
  if (name.includes("sheep") || name.includes("tupa")) {
    return {
      label: "Sheep",
      badge: "bg-sky-50 text-sky-900 border-sky-200",
      dot: "bg-sky-500",
    };
  }
  if (name.includes("poultry") || name.includes("chicken") || name.includes("manok") || name.includes("duck")) {
    return {
      label: "Poultry",
      badge: "bg-orange-50 text-orange-900 border-orange-200",
      dot: "bg-orange-500",
    };
  }
  return {
    label: typeName || "Livestock",
    badge: "bg-slate-50 text-slate-800 border-slate-200",
    dot: "bg-slate-500",
  };
};

/* ── Status badge for record items (Accessibility-compliant high contrast) ── */
export const getStatusBadge = (status: StatusType) => {
  switch (status) {
    case "APPROVED":
      return (
        <Badge className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/90 font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Approved
        </Badge>
      );
    case "VERIFIED":
      return (
        <Badge className="bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200/90 font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
          Verified by SIBAT
        </Badge>
      );
    case "PENDING":
      return (
        <Badge className="bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/90 font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Pending
        </Badge>
      );
    case "SUBJECT_TO_REVISION":
    case "REJECTED":
      return (
        <Badge className="bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-200/90 font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
          Needs Revision
        </Badge>
      );
    default:
      return null;
  }
};

/* ── Status chip config (Preserved for exports & production-history compatibility) ── */
export const STATUS_CHIPS: {
  value: StatusType | "ALL";
  label: string;
  icon: React.ElementType;
  activeClass: string;
  dotClass: string;
  count?: number;
}[] = [
  {
    value: "ALL",
    label: "All Records",
    icon: Layers,
    activeClass: "bg-slate-900 text-white border-slate-900 shadow-sm",
    dotClass: "bg-slate-400",
  },
  {
    value: "APPROVED",
    label: "Approved",
    icon: CheckCircle2,
    activeClass: "bg-emerald-700 text-white border-emerald-700 shadow-sm",
    dotClass: "bg-emerald-500",
  },
  {
    value: "VERIFIED",
    label: "Verified by SIBAT",
    icon: ShieldCheck,
    activeClass: "bg-sky-700 text-white border-sky-700 shadow-sm",
    dotClass: "bg-sky-500",
  },
  {
    value: "PENDING",
    label: "Pending Review",
    icon: Clock,
    activeClass: "bg-amber-600 text-white border-amber-600 shadow-sm",
    dotClass: "bg-amber-500",
  },
  {
    value: "SUBJECT_TO_REVISION",
    label: "Needs Revision",
    icon: RotateCcw,
    activeClass: "bg-rose-700 text-white border-rose-700 shadow-sm",
    dotClass: "bg-rose-500",
  },
];

/* ── Sort options ── */
export type SortKey =
  | "newest"
  | "oldest"
  | "quantity_desc"
  | "quantity_asc"
  | "breed_az"
  | "weight_desc"
  | "weight_asc";

const SORT_OPTIONS: { value: SortKey; label: string; icon: React.ElementType }[] = [
  { value: "newest", label: "Newest First", icon: ArrowDownWideNarrow },
  { value: "oldest", label: "Oldest First", icon: ArrowUpDown },
  { value: "quantity_desc", label: "Most Heads", icon: ArrowDownWideNarrow },
  { value: "quantity_asc", label: "Fewest Heads", icon: ArrowUpDown },
  { value: "breed_az", label: "Breed A → Z", icon: ArrowDownAZ },
  { value: "weight_desc", label: "Weight: High to Low", icon: Scale },
  { value: "weight_asc", label: "Weight: Low to High", icon: Scale },
];

/* ── Component Props ── */
export interface LivestockRecordListProps {
  items: LivestockInventoryItem[];
  isLoading: boolean;
  livestockTypes?: Record<string, number>;
  onView: (item: LivestockInventoryItem) => void;
  onEdit: (item: LivestockInventoryItem) => void;
  onDelete: (item: LivestockInventoryItem) => void;
  onAddRecord?: () => void;
  showMetrics?: boolean;
  showExport?: boolean;
  showAddRecord?: boolean;
  centerViewToggle?: boolean;
  defaultViewMode?: "grid" | "table";
}

/* ── Split Card with Hero Image Layout (like Herd Card) ── */
function LivestockSplitCard({
  item,
  onView,
  onEdit,
  onDelete,
  handleCopyTag,
}: {
  item: LivestockInventoryItem;
  onView: (item: LivestockInventoryItem) => void;
  onEdit: (item: LivestockInventoryItem) => void;
  onDelete: (item: LivestockInventoryItem) => void;
  handleCopyTag: (tag: string) => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);

  const localPhoto = typeof window !== "undefined"
    ? localStorage.getItem(`livestock_photo_${item.id}`) || localStorage.getItem(`livestock_photo_${item.tagNumber}`)
    : null;
  const localAvatar = typeof window !== "undefined"
    ? localStorage.getItem(`livestock_avatar_${item.id}`)
    : null;
  const photoUrl = item.photoUrl || localPhoto;
  const avatar = getAvatarById(item.avatarKey || localAvatar, item.livestockTypeName);

  // Collect potential photos for multi-photo carousel
  const photos = useMemo(() => {
    const list: string[] = [];
    if (photoUrl) list.push(photoUrl);
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`livestock_photos_${item.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            list.push(...parsed);
          }
        }
      } catch {}
    }
    return Array.from(new Set(list.filter(Boolean)));
  }, [photoUrl, item.id]);

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

  const hasVax = Boolean(item.lastVaccinationDate);
  const isApproved = item.status === "APPROVED";

  return (
    <Card
      className={cn(
        "group overflow-hidden rounded-xl border transition-all duration-200 flex flex-col sm:flex-row justify-between",
        "border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md",
        item.status === "SUBJECT_TO_REVISION" && "border-rose-300/80 bg-rose-50/15"
      )}
    >
      {/* ── LEFT HERO IMAGE SECTION ── */}
      <div className="relative aspect-[21/9] sm:aspect-auto sm:w-52 md:w-56 lg:w-60 sm:self-stretch min-h-[150px] sm:min-h-full shrink-0 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
        {currentPhoto ? (
          <Image
            src={currentPhoto}
            alt={item.tagNumber || item.livestockTypeName}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 p-3 text-white">
            <span className="text-4xl drop-shadow-md">{avatar.emoji}</span>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              {item.livestockTypeName}
            </span>
          </div>
        )}

        {/* Ambient Dark Gradient on bottom/sides */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

        {/* Top Badges */}
        <div className="absolute left-2.5 right-2.5 top-2.5 flex items-center justify-between gap-1.5 z-10">
          <Badge className="rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
            {item.livestockTypeName}
          </Badge>

          <OperationalStatusBadge status={item.operationalStatus} compact />
        </div>

        {/* Multi-Photo Navigation Controls */}
        {photos.length > 1 && (
          <div className="absolute inset-y-0 left-1.5 right-1.5 flex items-center justify-between z-20 pointer-events-none">
            <button
              type="button"
              aria-label="Previous livestock picture"
              onClick={handlePrevPhoto}
              className="pointer-events-auto flex size-6.5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/90 hover:scale-110 shadow-xs cursor-pointer"
            >
              <ChevronLeft className="size-3.5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              aria-label="Next livestock picture"
              onClick={handleNextPhoto}
              className="pointer-events-auto flex size-6.5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/90 hover:scale-110 shadow-xs cursor-pointer"
            >
              <ChevronRight className="size-3.5 stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* Bottom Hero Overlay: Tag Badge & Photo Counter or Herd */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white z-10">
          <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-mono font-bold backdrop-blur-md text-emerald-300">
            <Tag className="size-3 text-emerald-400" />
            <span>{item.tagNumber || `TAG-${item.id}`}</span>
          </div>

          {photos.length > 1 ? (
            <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md text-white">
              <Camera className="size-3 text-emerald-400" />
              <span>
                {(photoIndex % photos.length) + 1} of {photos.length}
              </span>
            </div>
          ) : item.batchCode ? (
            <span className="rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-900 shadow-2xs">
              Herd {item.batchCode}
            </span>
          ) : (
            <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-300">
              <ImageIcon className="size-3" />
              <span>{hasPhotos ? "1 photo" : "Avatar"}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT CONTENT SECTION ── */}
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5 space-y-2 min-w-0">
        <div className="space-y-2">
          {/* Header Row: Title & Regulatory Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  href={`/livestock-inventory/${item.tagNumber || item.id}`}
                  className="text-sm sm:text-base font-bold text-slate-950 hover:text-emerald-800 transition-colors line-clamp-1"
                >
                  {item.livestockTypeName} {item.tagNumber ? `#${item.tagNumber}` : `#${item.id}`}
                </Link>
                {item.tagNumber && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyTag(item.tagNumber!);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    title="Copy ear tag"
                  >
                    <Copy className="size-3" />
                  </button>
                )}
                {item.batchCode && (
                  <Link
                    href="/livestock-inventory/batches"
                    className="hidden sm:inline-flex items-center gap-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-2xs shrink-0 transition-colors"
                    title={`Belongs to Herd: ${item.batchCode}`}
                  >
                    <Layers className="size-2.5 text-teal-600" />
                    <span>Herd {item.batchCode}</span>
                  </Link>
                )}
                {item.entryType === "INDIVIDUAL" && !item.batchCode && (
                  <Badge className="hidden sm:inline-flex shrink-0 border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100">
                    INDIVIDUAL
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs font-medium text-slate-600 line-clamp-1">
                {item.breed || "Standard Breed"}
                {item.sex ? ` · ${item.sex}` : ""}
                {item.age ? ` · ${formatLivestockAge(item.age)}` : ""}
              </p>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
              {getStatusBadge(item.status)}
            </div>
          </div>

          {/* Core Stats: 2x2 Grid */}
          <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold text-slate-700">
            {/* Weight */}
            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center gap-2">
              <div className="p-1 rounded-md bg-white text-[#1E4D2B] shadow-2xs shrink-0">
                <Weight className="size-3.5 text-[#1E4D2B]" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                  Weight
                </span>
                <span className="font-extrabold text-slate-900 truncate block leading-tight">
                  {item.weight ? `${item.weight} kg` : "Unrecorded"}
                </span>
              </div>
            </div>

            {/* Immunization */}
            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center gap-2">
              <div className="p-1 rounded-md bg-white shadow-2xs shrink-0">
                {hasVax ? (
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                ) : (
                  <ShieldAlert className="size-3.5 text-amber-600" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                  Immunization
                </span>
                <span
                  className={cn(
                    "font-extrabold truncate block leading-tight",
                    hasVax ? "text-emerald-700" : "text-amber-600"
                  )}
                  title={hasVax ? item.lastVaccinationDate ?? undefined : "Due for Vaccine"}
                >
                  {hasVax ? item.lastVaccinationDate : "Due for Vaccine"}
                </span>
              </div>
            </div>

            {/* Life Stage */}
            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center gap-2">
              <div className="p-1 rounded-md bg-white text-slate-700 shadow-2xs shrink-0">
                <Icon iconNode={cowHead} className="size-3.5 text-slate-600" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                  Life Stage
                </span>
                <span className="font-extrabold text-slate-900 truncate block leading-tight">
                  {formatAgeClassification(item.ageClassification)}
                </span>
              </div>
            </div>

            {/* Birth Date / Registered */}
            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center gap-2">
              <div className="p-1 rounded-md bg-white text-teal-700 shadow-2xs shrink-0">
                <CalendarDays className="size-3.5 text-teal-700" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                  Birth / Age
                </span>
                <span className="font-extrabold text-slate-900 truncate block leading-tight">
                  {item.birthDate ? formatCalendarDate(item.birthDate) : (item.age ? formatLivestockAge(item.age) : "Not recorded")}
                </span>
              </div>
            </div>
          </div>

          {/* Officer remarks if present */}
          {item.reviewRemarks && (
            <div className="p-2 rounded-lg bg-rose-50/80 border border-rose-200/80 text-[11px] text-rose-950 flex items-start gap-1.5">
              <Info className="size-3.5 text-rose-600 shrink-0 mt-0.5" />
              <p className="line-clamp-2 leading-relaxed min-w-0">
                <strong className="font-bold text-rose-900">Officer Note:</strong> {item.reviewRemarks}
              </p>
            </div>
          )}
        </div>

        {/* Footer Bar: Date left, Actions right */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <CalendarDays className="size-3.5 text-slate-400" />
            <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Registered"}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onView(item)}
              className="h-8 gap-1.5 rounded-lg border-emerald-200 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 cursor-pointer"
            >
              <Eye className="size-3.5" />
              <span>Profile</span>
            </Button>

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(item)}
                      disabled={isApproved}
                      className="size-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isApproved ? "Approved entries are locked" : "Edit animal record"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(item)}
                      disabled={isApproved}
                      className="size-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-25 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isApproved ? "Approved entries cannot be deleted" : "Delete record"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function LivestockRecordList({
  items,
  isLoading,
  livestockTypes,
  onView,
  onEdit,
  onDelete,
  onAddRecord,
  showMetrics = true,
  showExport = true,
  showAddRecord = true,
  centerViewToggle = false,
  defaultViewMode,
}: LivestockRecordListProps) {
  const router = useRouter();

  // View mode: "grid" | "table"
  const [viewMode, setViewMode] = useState<"grid" | "table">(defaultViewMode ?? "grid");

  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusType | "ALL">("ALL");
  const [operationalFilter, setOperationalFilter] = useState<OperationalStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(12);

  /* Count active filters */
  const activeFilterCount = [
    statusFilter !== "ALL",
    operationalFilter !== "ALL",
    typeFilter !== "ALL",
    searchQuery.trim().length > 0,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setOperationalFilter("ALL");
    setTypeFilter("ALL");
    setSortBy("newest");
    setCurrentPage(1);
  };

  /* Filter + sort pipeline */
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    let result = items.filter((item) => {
      const matchesSearch =
        !query ||
        item?.tagNumber?.toLowerCase().includes(query) ||
        item.breed?.toLowerCase().includes(query) ||
        item.livestockTypeName?.toLowerCase().includes(query) ||
        item.farmerName?.toLowerCase().includes(query) ||
        item.batchCode?.toLowerCase().includes(query) ||
        item.batchName?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        item.status === statusFilter ||
        (statusFilter === "SUBJECT_TO_REVISION" &&
          (item.status === "SUBJECT_TO_REVISION" || item.status === "REJECTED"));

      const matchesType =
        typeFilter === "ALL" || item.livestockTypeName === typeFilter;

      const matchesOperational =
        operationalFilter === "ALL" || item.operationalStatus === operationalFilter;

      return matchesSearch && matchesStatus && matchesType && matchesOperational;
    });

    // Sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "quantity_desc":
          return (b.quantity || 1) - (a.quantity || 1);
        case "quantity_asc":
          return (a.quantity || 1) - (b.quantity || 1);
        case "breed_az":
          return (a.breed || "").localeCompare(b.breed || "");
        case "weight_desc":
          return (Number(b.weight) || 0) - (Number(a.weight) || 0);
        case "weight_asc":
          return (Number(a.weight) || 0) - (Number(b.weight) || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [items, searchQuery, statusFilter, operationalFilter, typeFilter, sortBy]);

  /* Reset pagination to page 1 whenever filters change */
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, operationalFilter, typeFilter, sortBy, pageSize]);

  /* Paginated slice */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  /* Slim Horizontal Metrics Summary */
  const metrics = useMemo(() => {
    const totalHeads = filtered.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0);
    const approvedCount = filtered.filter((i) => i.status === "APPROVED").length;
    const verifiedCount = filtered.filter((i) => i.status === "VERIFIED").length;
    const pendingCount = filtered.filter((i) => i.status === "PENDING").length;
    const revisionCount = filtered.filter(
      (i) => i.status === "SUBJECT_TO_REVISION" || i.status === "REJECTED"
    ).length;
    const vaxCount = filtered.filter((i) => Boolean(i.lastVaccinationDate)).length;
    const vaxRate = filtered.length > 0 ? Math.round((vaxCount / filtered.length) * 100) : 0;

    return { totalHeads, approvedCount, verifiedCount, pendingCount, revisionCount, vaxCount, vaxRate };
  }, [filtered]);

  /* Copy Tag to clipboard */
  const handleCopyTag = (tag: string) => {
    if (!tag) return;
    navigator.clipboard.writeText(tag);
    toast.success("Ear Tag Copied", {
      description: `${tag} has been copied to your clipboard.`,
    });
  };

  /* Export CSV of currently filtered dataset */
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.error("No records to export.");
      return;
    }

    const headers = [
      "Record ID",
      "Tag Number / Batch ID",
      "Entry Type",
      "Species",
      "Breed",
      "Sex",
      "Quantity",
      "Weight (kg)",
      "Last Vaccination Date",
      "Status",
      "Herd Lifecycle",
      "Lifecycle Changed",
      "Date Registered",
      "Officer Remarks",
    ];

    const rows = filtered.map((item) => [
      item.id,
      item.tagNumber || `Batch-${item.id}`,
      item.entryType,
      item.livestockTypeName,
      item.breed || "Standard",
      item.sex,
      item.quantity,
      item.weight ?? "N/A",
      item.lastVaccinationDate ?? "Pending",
      item.status,
      item.operationalStatus,
      item.operationalStatusChangedAt
        ? new Date(item.operationalStatusChangedAt).toLocaleDateString()
        : "",
      item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "",
      `"${(item.reviewRemarks || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `SmartLivestock_Registry_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Livestock list downloaded", {
      description: `Downloaded ${filtered.length} records as CSV spreadsheet.`,
    });
  };

  const viewToggle = (
    <div className="flex min-h-11 items-center justify-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
      <button
        type="button"
        onClick={() => setViewMode("grid")}
        aria-label="Show livestock as cards"
        aria-pressed={viewMode === "grid"}
        title="Cards Grid"
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-md transition-all",
          viewMode === "grid"
            ? "bg-white text-slate-900 shadow-2xs font-bold"
            : "text-slate-500 hover:text-slate-800"
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setViewMode("table")}
        aria-label="Show livestock as a table"
        aria-pressed={viewMode === "table"}
        title="Table View"
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-md transition-all",
          viewMode === "table"
            ? "bg-white text-slate-900 shadow-2xs font-bold"
            : "text-slate-500 hover:text-slate-800"
        )}
      >
        <List className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3.5">
      {/* Keep summary counts on the main inventory view; management lists can focus on records. */}
      {showMetrics && <div className="bg-white rounded-xl border border-slate-200/90 px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap text-xs shadow-2xs">
        <div className="flex items-center gap-5 sm:gap-7 flex-wrap">
          {/* Total Heads */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#1E4D2B]/10 text-[#1E4D2B] flex items-center justify-center shrink-0">
              <Tag className="w-3.5 h-3.5 text-[#1E4D2B]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black text-slate-900 tabular-nums">
                {metrics.totalHeads}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Total Heads
              </span>
            </div>
          </div>

          <div className="hidden sm:block w-px h-4 bg-slate-200" />

          {/* Active Records */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black text-slate-900 tabular-nums">
                {filtered.length}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Active Records
              </span>
            </div>
          </div>

          <div className="hidden sm:block w-px h-4 bg-slate-200" />

          {/* Vaccination Status */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black text-slate-900 tabular-nums">
                {metrics.vaxRate}%
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Vaccinated
              </span>
              <span className="text-[10px] text-slate-400 font-medium hidden md:inline">
                ({metrics.vaxCount}/{filtered.length})
              </span>
            </div>
          </div>
        </div>

        {/* Status Indicators Pill Breakdown */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {metrics.approvedCount} Approved
          </span>
          {metrics.verifiedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
              {metrics.verifiedCount} Verified by SIBAT
            </span>
          )}
          {metrics.pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
              {metrics.pendingCount} Pending
            </span>
          )}
          {metrics.revisionCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-900 border border-rose-200">
              {metrics.revisionCount} Needs Revision
            </span>
          )}
        </div>
      </div>}

      {/* ═══ 3. Sub-Header & Controls Bar ═══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Clean Search Bar */}
        <div className="relative w-full min-w-0 flex-1 sm:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search by ear tag, breed, or species..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 bg-slate-50/80 border-slate-200 rounded-lg h-12 text-base focus-visible:ring-[#1E4D2B]/30"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Inline Dropdown Filters & Actions */}
        <div
          className={cn(
            "w-full flex-1 min-w-0 items-center gap-2",
            centerViewToggle
              ? "flex flex-nowrap overflow-x-auto pb-1"
              : "grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-end",
          )}
        >
          {/* Species Dropdown */}
          {livestockTypes && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger aria-label="Filter by livestock type" className={cn("min-h-11 rounded-lg border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-700", centerViewToggle ? "w-[150px] shrink-0" : "w-full sm:w-[150px]")}>
                <SelectValue placeholder="All Species" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Species</SelectItem>
                {Object.entries(livestockTypes).map(([name, id]) => (
                  <SelectItem key={id} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status Dropdown */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusType | "ALL")}
          >
            <SelectTrigger aria-label="Filter by review status" className={cn("min-h-11 rounded-lg border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-700", centerViewToggle ? "w-[170px] shrink-0" : "w-full sm:w-[170px]")}>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="VERIFIED">Verified by SIBAT</SelectItem>
              <SelectItem value="PENDING">Pending Review</SelectItem>
              <SelectItem value="SUBJECT_TO_REVISION">Needs Revision</SelectItem>
            </SelectContent>
          </Select>

          {/* Real-world herd lifecycle, separate from municipal validation */}
          <Select
            value={operationalFilter}
            onValueChange={(value) => setOperationalFilter(value as OperationalStatus | "ALL")}
          >
            <SelectTrigger aria-label="Filter by livestock status" className={cn("min-h-11 rounded-lg border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-700", centerViewToggle ? "w-[160px] shrink-0" : "w-full sm:w-[160px]")}>
              <SelectValue placeholder="Herd Lifecycle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Lifecycle</SelectItem>
              <SelectItem value="ACTIVE">Active Herd</SelectItem>
              <SelectItem value="SOLD">Sold</SelectItem>
              <SelectItem value="DECEASED">Deceased</SelectItem>
              <SelectItem value="SLAUGHTERED">Slaughtered</SelectItem>
              <SelectItem value="MOVED_OUT">Moved Out</SelectItem>
            </SelectContent>
          </Select>

          {/* Sorting Dropdown */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger aria-label="Sort livestock records" className={cn("min-h-11 rounded-lg border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-700", centerViewToggle ? "w-[150px] shrink-0" : "w-full sm:w-[150px]")}>
              <div className="flex items-center gap-1.5 truncate">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <SelectValue placeholder="Sort by" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* On the All Livestock page, center the switcher within the search/filter bar. */}
          <div className={cn(centerViewToggle ? "shrink-0" : "col-span-2 sm:col-span-1")}>
            {viewToggle}
          </div>

          {/* Export Button */}
          {showExport && <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportCSV}
                  className="min-h-11 w-full sm:w-auto px-3 rounded-lg border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700 font-bold text-sm gap-2 shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Export filtered records as CSV spreadsheet
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>}

          {/* Add Record Button */}
          {showAddRecord && <Button
            type="button"
            onClick={() => {
              if (onAddRecord) {
                onAddRecord();
              } else {
                router.push("/livestock-inventory");
              }
            }}
            className="min-h-11 w-full sm:w-auto px-3.5 rounded-lg bg-[#1E4D2B] hover:bg-[#163b21] text-white font-bold text-sm gap-2 shrink-0 shadow-2xs transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Record</span>
          </Button>}

          {/* Reset Filters Icon */}
          {activeFilterCount > 0 && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className={cn(
                      "min-h-11 rounded-lg text-sm font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-50 transition-colors shrink-0",
                      centerViewToggle
                        ? "w-auto px-3"
                        : "col-span-2 w-full sm:col-span-1 sm:w-auto sm:px-3",
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-2"><RotateCcw className="size-4" /> Reset filters</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Reset filters ({activeFilterCount} active)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* ═══ Content Area: Loading / Empty / Grid / Table ═══ */}
      {isLoading ? (
        /* Premium Skeleton Loading States */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((sk) => (
            <Card
              key={sk}
              className="p-4 rounded-xl border border-slate-200 animate-pulse space-y-3 h-[270px] flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <div className="h-6 w-28 bg-slate-200 rounded-full" />
                <div className="h-5 w-20 bg-slate-200 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-10 bg-slate-100 rounded-lg" />
                <div className="h-10 bg-slate-100 rounded-lg" />
                <div className="h-10 bg-slate-100 rounded-lg" />
                <div className="h-10 bg-slate-100 rounded-lg" />
              </div>
              <div className="h-8 bg-slate-100 rounded-lg" />
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <div className="h-4 w-20 bg-slate-200 rounded" />
                <div className="h-7 w-20 bg-slate-200 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        /* Empty State */
        <Card className="py-14 border-dashed border-slate-300 rounded-xl bg-white shadow-2xs">
          <div className="flex flex-col items-center text-center space-y-2.5 px-6 max-w-md mx-auto">
            <div className="p-3 rounded-xl bg-[#1E4D2B]/10 text-[#1E4D2B]">
              <Search className="w-6 h-6 text-[#1E4D2B]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                No Matching Livestock Records
              </h3>
              <p className="text-xs text-slate-500">
                {searchQuery
                  ? `No records found matching "${searchQuery}".`
                  : activeFilterCount > 0
                  ? "None of your registered animals match the selected criteria."
                  : "No livestock animals have been registered in your inventory yet."}
              </p>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="rounded-lg text-xs font-bold gap-1.5 mt-1 border-slate-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset all filters
              </Button>
            )}
          </div>
        </Card>
      ) : viewMode === "grid" ? (
        /* ═══ 4. Data Display Cards: Split Hero Cards Grid Layout ═══ */
        <div className="grid min-w-0 grid-cols-1 gap-3.5 md:grid-cols-2">
          {paginatedItems.map((item) => (
            <LivestockSplitCard
              key={item.id}
              item={item}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              handleCopyTag={handleCopyTag}
            />
          ))}
        </div>
      ) : (
        /* ═══ Pro Table View ═══ */
        <Card className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
          <Table>
            <TableHeader className="bg-slate-50/90 border-b border-slate-200">
              <TableRow>
                <TableHead className="font-bold text-slate-700 text-xs py-3">
                  Ear Tag / ID
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Species & Breed
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Sex
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Heads
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Weight
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Immunization
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Status
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Herd Lifecycle
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Registered
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs text-right pr-4">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => {
                const hasVax = Boolean(item.lastVaccinationDate);
                const isApproved = item.status === "APPROVED";
                const localPhoto = typeof window !== "undefined" ? localStorage.getItem(`livestock_photo_${item.id}`) : null;
                const localAvatar = typeof window !== "undefined" ? localStorage.getItem(`livestock_avatar_${item.id}`) : null;
                const photoUrl = item.photoUrl || localPhoto;
                const avatar = getAvatarById(item.avatarKey || localAvatar, item.livestockTypeName);

                return (
                  <TableRow
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors border-b border-slate-100"
                  >
                    {/* Ear Tag */}
                    <TableCell className="font-mono text-xs font-black py-2.5">
                      <div className="flex items-center gap-2">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={item.tagNumber}
                            className="size-6 rounded-md object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div
                            className={`size-6 rounded-md flex items-center justify-center text-xs bg-gradient-to-br border shrink-0 ${avatar.bgGradient}`}
                            title={avatar.name}
                          >
                            {avatar.emoji}
                          </div>
                        )}
                        <Link
                          href={`/livestock-inventory/${item.tagNumber || item.id}`}
                          className="bg-[#1E4D2B] hover:bg-[#163b21] text-white px-2.5 py-0.5 rounded-full text-[11px] shadow-2xs inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Tag className="w-3 h-3 text-emerald-300" />
                          <span>{item.tagNumber || `TAG-${item.id}`}</span>
                        </Link>
                        {item.batchCode && (
                          <Link
                            href="/livestock-inventory/batches"
                            className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                            title={`Assigned to Batch ${item.batchCode}`}
                          >
                            <Layers className="w-2.5 h-2.5 text-teal-600" />
                            <span>{item.batchCode}</span>
                          </Link>
                        )}
                        {item.entryType === "INDIVIDUAL" && !item.batchCode && (
                          <Badge className="border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100">
                            INDIVIDUAL
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Species & Breed */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-xs">
                          {item.breed || "Standard"}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {item.livestockTypeName}
                        </span>
                      </div>
                    </TableCell>

                    {/* Sex */}
                    <TableCell className="text-xs font-semibold text-slate-700">
                      {item.sex}
                    </TableCell>

                    {/* Quantity */}
                    <TableCell className="text-xs font-extrabold text-slate-900 tabular-nums">
                      {item.quantity}
                    </TableCell>

                    {/* Weight */}
                    <TableCell className="text-xs font-bold text-slate-800 tabular-nums">
                      {item.weight ? `${item.weight} kg` : "—"}
                    </TableCell>

                    {/* Immunization */}
                    <TableCell>
                      {hasVax ? (
                        <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{item.lastVaccinationDate}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-600 font-bold text-xs">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                          <span>Pending</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>{getStatusBadge(item.status)}</TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <OperationalStatusBadge status={item.operationalStatus} compact />
                        {item.operationalStatusChangedAt && item.operationalStatus !== "ACTIVE" && (
                          <p className="text-[10px] text-slate-500">
                            {new Date(item.operationalStatusChangedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-xs font-medium text-slate-500 tabular-nums">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : "—"}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`View profile for ${item.tagNumber || `livestock ${item.id}`}`}
                          onClick={() => onView(item)}
                          className="h-8 gap-1.5 rounded-lg border-emerald-200 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Profile</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(item)}
                          disabled={isApproved}
                          className="h-7 w-7 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-25"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(item)}
                          disabled={isApproved}
                          className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-25"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ═══ Numbered Pagination Bar ═══ */}
      {filtered.length > pageSize && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 px-1">
          <p className="text-xs text-slate-500 font-semibold">
            Page <strong className="text-slate-900">{currentPage}</strong> of{" "}
            <strong className="text-slate-900">{totalPages}</strong> ({filtered.length} total)
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="h-8 px-2 rounded-lg border-slate-200 text-xs font-bold disabled:opacity-30"
              title="First page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 rounded-lg border-slate-200 text-xs font-bold gap-1 disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </Button>

            {/* Numeric page pills */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  return (
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 1
                  );
                })
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && (
                        <span className="text-xs text-slate-400 px-1">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={cn(
                          "h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold transition-colors",
                          currentPage === p
                            ? "bg-[#1E4D2B] text-white shadow-2xs"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-3 rounded-lg border-slate-200 text-xs font-bold gap-1 disabled:opacity-30"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="h-8 px-2 rounded-lg border-slate-200 text-xs font-bold disabled:opacity-30"
              title="Last page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
