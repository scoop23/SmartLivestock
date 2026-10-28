"use client";

import type { ApiProductionRecord } from "@/app/(farmer)/production-dashboard/production-analytics";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api from "@/lib/axios";
import { formatAgeClassification, formatCalendarDate, formatLivestockAge } from "@/lib/livestock-age";
import { startGuidedTutorial } from "@/lib/tutorial-preferences";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import {
  AlertTriangle,
  Baby,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Droplets,
  ExternalLink,
  HelpCircle,
  Hourglass,
  Info,
  Layers,
  Pill,
  Plus,
  PlusCircle,
  Radio,
  Scale,
  ShieldCheck,
  Syringe,
  Tag,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getAvatarById, mapInventory, type InventoryApiItem } from "./livestock-inventory";
import type { LivestockInventoryItem } from "./page";

interface ProductionRecordItem {
  id: number;
  livestockId?: number;
  livestock?: number;
  productionType: string;
  quantity: number;
  unit: string;
  recordDate: string;
  status: string;
  notes?: string;
}

interface WeightRecordItem {
  id: number;
  livestock: number;
  weight: number;
  weighing_date: string;
  notes?: string;
}

interface CalvingRecordItem {
  id: number;
  dam: number;
  calf_tag: string;
  calf_sex: string;
  birth_weight: number | null;
  calving_date: string;
  offspring_inventory?: number | null;
  breed: string;
  calving_ease: string;
  notes?: string;
}

interface DiseaseCaseItem {
  id: number;
  livestock?: number | null;
  name: string;
  affected_count: number;
  record_date?: string | null;
  status: string;
  review_remarks?: string | null;
  created_at: string;
}

interface LivestockDetailsDialogProps {
  livestock: LivestockInventoryItem | null;
  open: boolean;
  onOpenChange: () => void;
}

export default function LivestockDetailsDialog({
  livestock,
  open,
  onOpenChange,
}: LivestockDetailsDialogProps) {
  const router = useRouter();
  const animalId = livestock?.id ? Number(livestock.id) : null;
  const [activeTab, setActiveTab] = useState<"overview" | "yields" | "weight" | "calves" | "medical">("overview");
  const [copiedTag, setCopiedTag] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [prevAnimalId, setPrevAnimalId] = useState<number | null>(null);

  // Synchronize tab to overview whenever dialog opens for a different animal
  if (animalId !== prevAnimalId) {
    setPrevAnimalId(animalId);
    setActiveTab("overview");
    setCopiedTag(false);
    setImageError(false);
  }

  // 1. Direct single-item fetch from backend to get freshest canonical passport data
  const { data: directInventory } = useQuery<InventoryApiItem>({
    queryKey: ["inventory_item", animalId],
    queryFn: async () => {
      if (!animalId) return null as unknown as InventoryApiItem;
      const res = await api.get<InventoryApiItem>(`livestock/inventory/${animalId}/`);
      return res.data;
    },
    enabled: open && !!animalId,
  });

  // Authoritative merged item: direct backend record has precedence over list cache
  const activeLivestock = useMemo(() => {
    if (!livestock && !directInventory) return null;
    if (directInventory) {
      const mapped = mapInventory(directInventory);
      return {
        ...livestock,
        ...mapped,
        photoUrl: mapped.photoUrl || livestock?.photoUrl || null,
        leftSidePhotoUrl: mapped.leftSidePhotoUrl || livestock?.leftSidePhotoUrl || null,
        rightSidePhotoUrl: mapped.rightSidePhotoUrl || livestock?.rightSidePhotoUrl || null,
        avatarKey: mapped.avatarKey || livestock?.avatarKey || null,
      };
    }
    return livestock;
  }, [livestock, directInventory]);

  // 2. Real production records
  const { data: productionRecords = [] } = useQuery<ProductionRecordItem[]>({
    queryKey: ["production"],
    queryFn: async () => {
      try {
        const res = await api.get<ApiProductionRecord[]>("production/records/");
        return (res.data || []).map((r) => ({
          id: r.id,
          livestockId: r.livestock,
          productionType: r.production_type?.toLowerCase() || "milk",
          quantity: Number(r.quantity) || 0,
          unit: r.unit || "LITERS",
          recordDate: r.record_date,
          status: r.status,
          notes: r.notes,
        }));
      } catch {
        return [];
      }
    },
    enabled: open && !!animalId,
  });

  // 3. Real weight records
  const { data: weightRecords = [] } = useQuery<WeightRecordItem[]>({
    queryKey: ["weight_records"],
    queryFn: async () => {
      try {
        const res = await api.get("production/weights/");
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    enabled: open && !!animalId,
  });

  // 4. Real calving records
  const { data: calvingRecords = [] } = useQuery<CalvingRecordItem[]>({
    queryKey: ["calving_records"],
    queryFn: async () => {
      try {
        const res = await api.get("production/calving/");
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    enabled: open && !!animalId,
  });

  // 5. Real disease cases
  const { data: diseaseCases = [] } = useQuery<DiseaseCaseItem[]>({
    queryKey: ["disease_cases", animalId],
    queryFn: async () => {
      try {
        const res = await api.get<DiseaseCaseItem[]>("diseases/cases/", {
          params: { livestock: animalId },
        });
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    enabled: open && !!animalId,
  });

  // Filter for this specific animal
  const animalProductions = useMemo(() => {
    if (!animalId) return [];
    return productionRecords
      .filter((p) => p.livestockId === animalId)
      .sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());
  }, [productionRecords, animalId]);

  const animalWeights = useMemo(() => {
    if (!animalId) return [];
    return weightRecords
      .filter((w) => w.livestock === animalId)
      .sort((a, b) => new Date(b.weighing_date).getTime() - new Date(a.weighing_date).getTime());
  }, [weightRecords, animalId]);

  const animalCalves = useMemo(() => {
    if (!animalId) return [];
    return calvingRecords.filter((c) => c.dam === animalId);
  }, [calvingRecords, animalId]);

  const animalDiseaseCases = useMemo(() => {
    if (!animalId) return [];
    return diseaseCases.filter((d) => d.livestock === animalId);
  }, [diseaseCases, animalId]);

  const titleText =
    activeLivestock?.tagNumber || (activeLivestock?.id ? `ANIMAL-${activeLivestock.id}` : "Livestock Record");

  const localPhoto = activeLivestock && typeof window !== "undefined"
    ? localStorage.getItem(`livestock_photo_${activeLivestock.id}`) || localStorage.getItem(`livestock_photo_${activeLivestock.tagNumber}`)
    : null;
  const localAvatar = activeLivestock && typeof window !== "undefined"
    ? localStorage.getItem(`livestock_avatar_${activeLivestock.id}`) || localStorage.getItem(`livestock_avatar_${activeLivestock.tagNumber}`)
    : null;

  const photoUrl = activeLivestock?.photoUrl || activeLivestock?.leftSidePhotoUrl || activeLivestock?.rightSidePhotoUrl || localPhoto;
  const avatar = getAvatarById(activeLivestock?.avatarKey || localAvatar, activeLivestock?.livestockTypeName);
  const hasPhoto = Boolean(photoUrl && !imageError);

  const latestWeight = animalWeights[0];
  const previousWeight = animalWeights[1];
  const weightGainKg =
    latestWeight && previousWeight
      ? Number((latestWeight.weight - previousWeight.weight).toFixed(1))
      : null;

  const displayWeight = activeLivestock?.weight != null
    ? Number(activeLivestock.weight).toFixed(2)
    : latestWeight
      ? Number(latestWeight.weight).toFixed(2)
      : null;

  const avgYield = useMemo(() => {
    if (!animalProductions.length) return null;
    const total = animalProductions.reduce((sum, p) => sum + p.quantity, 0);
    return (total / animalProductions.length).toFixed(1);
  }, [animalProductions]);

  const healthCount = (activeLivestock?.lastVaccinationDate ? 1 : 0) + animalDiseaseCases.length;

  const handleCopyEarTag = () => {
    if (!titleText) return;
    navigator.clipboard.writeText(titleText);
    setCopiedTag(true);
    toast.success(`Ear Tag ${titleText} copied to clipboard`);
    setTimeout(() => setCopiedTag(false), 2000);
  };

  const startDetailsTour = useCallback(() => {
    const isMobile = window.matchMedia("(max-width: 639px)").matches;
    const steps: DriveStep[] = [
      {
        element: '[data-tour="details-header"]',
        popover: {
          title: "Animal identity and status",
          description: "The top of the dialog displays the animal’s ear tag, RFID active status, livestock type, breed, sex, and official review badges.",
          side: "bottom",
          align: isMobile ? "center" : "start",
        },
      },
      {
        element: '[data-tour="details-tabs"]',
        popover: {
          title: "Interactive Record Sections",
          description: "Switch between Overview Profile, Yields, Weight Logs, Calves, and Vaccines & Health records.",
          side: "bottom",
          align: "center",
        },
      },
      {
        element: '[data-tour="details-profile"]',
        popover: {
          title: "Overview Profile Grid",
          description: "Review key biometrics: Ear Tag ID, Assigned Herd, Scale Weight, Birth Date, Age Class, and SIBAT Vaccination status.",
          side: "top",
          align: "start",
        },
      },
      {
        element: '[data-tour="details-footer"]',
        popover: {
          title: "Profile & Health Actions",
          description: "Use Report Issue to file an immediate health observation, or View Profile to open the full bio page.",
          side: "top",
          align: "end",
        },
      },
    ];

    startGuidedTutorial({
      showProgress: true,
      animate: true,
      allowClose: true,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Finish",
      progressText: "{{current}} of {{total}}",
      steps,
    });
  }, []);

  const isApproved = activeLivestock?.status === "APPROVED";
  const approvalLabel = activeLivestock?.status ? activeLivestock.status.replace(/_/g, " ") : "PENDING";
  const operationalLabel = activeLivestock?.operationalStatus ? activeLivestock.operationalStatus.replace(/_/g, " ") : "ACTIVE HERD";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ maxWidth: "880px" }}
        className="w-[calc(100vw-1rem)] sm:w-[94vw] sm:max-w-[880px] max-h-[94dvh] sm:max-h-[90dvh] p-0 gap-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl bg-white flex flex-col [&>button]:hidden transition-all duration-200"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{titleText} - Livestock Bio-Record</DialogTitle>
          <DialogDescription>
            Authoritative biometric profile, production yields, and medical history
          </DialogDescription>
        </DialogHeader>

        {/* ═══ 1. HEADER SECTION (Mobile-responsive flex flow) ═══ */}
        <div
          data-tour="details-header"
          className="p-4 sm:p-6 bg-white border-b border-slate-100 relative shrink-0"
        >
          {/* Close Modal Icon - Fixed at Top Right */}
          <DialogClose asChild>
            <button
              type="button"
              onClick={onOpenChange}
              className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 z-20 size-9 sm:size-10 rounded-full bg-slate-100/90 hover:bg-slate-200 active:bg-slate-300 text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="Close modal"
            >
              <X className="size-4.5 sm:size-5 stroke-[2.5]" />
            </button>
          </DialogClose>

          {/* Top Row: Avatar + Title + Status Badges */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 pr-12 sm:pr-16">
            {/* Left: Photo/Avatar & Identifiers */}
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              {/* Tactile Avatar Badge (R2 Photo or Fallback to Species Avatar) */}
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "size-14 sm:size-16 rounded-xl sm:rounded-2xl border flex items-center justify-center shadow-2xs overflow-hidden group transition-all",
                    hasPhoto
                      ? "border-slate-200/90 bg-slate-100"
                      : cn("border-amber-200/70 bg-gradient-to-br", avatar.bgGradient)
                  )}
                >
                  {hasPhoto ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={photoUrl!}
                      alt={titleText}
                      onError={() => setImageError(true)}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : avatar.emoji ? (
                    <span
                      className="text-2xl sm:text-3xl drop-shadow-xs select-none transition-transform duration-200 group-hover:scale-110"
                      role="img"
                      aria-label={avatar.name}
                    >
                      {avatar.emoji}
                    </span>
                  ) : (
                    /* Illustrated Cattle SVG Icon matching reference */
                    <svg
                      viewBox="0 0 64 64"
                      className="w-9 h-9 sm:w-10 sm:h-10 text-amber-800"
                      fill="currentColor"
                    >
                      <path
                        d="M12 20c-1.5 0-3-1-3-3s1.5-5 5-5c1 0 2 .5 3 1l5 4h14l5-4c1-.5 2-1 3-1 3.5 0 5 3 5 5s-1.5 3-3 3h-2l1 6c1 5-2 10-7 12v12c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2v-8h-8v8c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2V38c-5-2-8-7-7-12l1-6h-2z"
                        opacity="0.9"
                      />
                      <circle cx="24" cy="28" r="2.5" fill="#ffffff" />
                      <circle cx="40" cy="28" r="2.5" fill="#ffffff" />
                    </svg>
                  )}
                </div>

                {/* Sub-badge: RFID chip active */}
                <span
                  className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[10px] shadow-2xs"
                  title="RFID Tag Active"
                >
                  <Radio className="size-3 stroke-[2.5]" />
                </span>
              </div>

              {/* Metadata & Tag Code */}
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                    {titleText}
                  </h1>
                  <button
                    type="button"
                    onClick={handleCopyEarTag}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                    title="Copy Ear Tag ID"
                  >
                    {copiedTag ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  </button>
                </div>

                <div className="text-xs sm:text-sm text-slate-600 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="inline-flex items-center gap-1 text-slate-900 font-bold">
                    <Tag className="text-emerald-700 size-3 sm:size-3.5 fill-emerald-700" />
                    {activeLivestock?.livestockTypeName || "Livestock"}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-700 font-bold">{activeLivestock?.breed || "Breed unrecorded"}</span>
                  {activeLivestock?.sex && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 text-slate-700 font-semibold bg-slate-100/80 px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs">
                        {activeLivestock.sex.toLowerCase().includes("male") ? (
                          <>
                            <span className="text-sky-600 font-bold">♂</span> Male
                          </>
                        ) : activeLivestock.sex.toLowerCase().includes("female") ? (
                          <>
                            <span className="text-rose-500 font-bold">♀</span> Female
                          </>
                        ) : (
                          activeLivestock.sex
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Badges & Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 sm:border-0">
              {/* Tutorial Button */}
              <button
                type="button"
                onClick={startDetailsTour}
                className="min-h-[34px] sm:min-h-auto px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <HelpCircle className="size-3.5 text-slate-400" />
                <span>Tutorial</span>
              </button>

              {/* Status Badges */}
              <span
                className={cn(
                  "min-h-[34px] sm:min-h-auto px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide inline-flex items-center gap-1.5 shadow-2xs",
                  isApproved
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/90"
                    : "bg-amber-50 text-amber-800 border border-amber-200/90"
                )}
              >
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                <span>{approvalLabel}</span>
              </span>

              <span
                className={cn(
                  "min-h-[34px] sm:min-h-auto px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide inline-flex items-center gap-1.5 shadow-2xs",
                  operationalLabel === "DECEASED"
                    ? "bg-slate-100 text-slate-800 border border-slate-300"
                    : "bg-sky-50 text-sky-700 border border-sky-200/90"
                )}
              >
                <CheckCircle2 className="size-3.5 text-sky-600" />
                <span>{operationalLabel === "ACTIVE" ? "ACTIVE HERD" : operationalLabel}</span>
              </span>
            </div>
          </div>

          {/* ═══ 2. TABS (Swipeable horizontal scroll with edge padding on mobile) ═══ */}
          <div
            data-tour="details-tabs"
            className="mt-3.5 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                activeTab === "overview"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              )}
            >
              <Users className="size-3.5" />
              <span>Overview Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("yields")}
              className={cn(
                "shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                activeTab === "yields"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              )}
            >
              <Droplets className="size-3.5" />
              <span>Yields</span>
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                {animalProductions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("weight")}
              className={cn(
                "shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                activeTab === "weight"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              )}
            >
              <Scale className="size-3.5" />
              <span>Weight Logs</span>
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                {animalWeights.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("calves")}
              className={cn(
                "shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                activeTab === "calves"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              )}
            >
              <Baby className="size-3.5" />
              <span>Calves</span>
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 text-slate-400 border border-slate-200/60">
                {animalCalves.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("medical")}
              className={cn(
                "shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                activeTab === "medical"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              )}
            >
              <Plus className="size-3.5 stroke-[2.5]" />
              <span>Vaccines & Health</span>
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                {healthCount}
              </span>
            </button>
          </div>

          {/* Subtle Progress Track underneath tabs matching screenshot */}
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-slate-200/90 rounded-full w-full" />
          </div>
        </div>

        {/* ═══ 3. SCROLLABLE CONTENT BODY (Field responsive spacing) ═══ */}
        <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 flex-1 overflow-y-auto max-h-[62vh] sm:max-h-[60vh]">
          {/* TAB 1: OVERVIEW PROFILE */}
          {activeTab === "overview" && (
            <div data-tour="details-profile" className="space-y-3.5 sm:space-y-4">
              {/* Part of Herd Banner / Individual Animal Banner */}
              {activeLivestock?.batchId || activeLivestock?.batchCode ? (
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50/50 border border-emerald-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="size-10 sm:size-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-2xs">
                      <Layers className="size-4.5 sm:size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight">
                          Part of Herd: {activeLivestock.batchCode}
                        </span>
                        {activeLivestock.batchId && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 font-mono text-[10px] sm:text-[11px] font-semibold">
                            Cohort #{activeLivestock.batchId}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-normal mt-0.5 leading-snug">
                        Tracked as an individual animal inside {activeLivestock.batchName || activeLivestock.batchCode}
                        {activeLivestock.farmerName ? ` • Registered to ${activeLivestock.farmerName}` : ""}.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange();
                      const rosterParams = new URLSearchParams();
                      if (activeLivestock.batchId) rosterParams.set("batch", String(activeLivestock.batchId));
                      if (activeLivestock.id) rosterParams.set("animalId", String(activeLivestock.id));
                      if (activeLivestock.tagNumber) rosterParams.set("tag", activeLivestock.tagNumber);
                      router.push(`/livestock-inventory/batches?${rosterParams.toString()}`);
                    }}
                    className="w-full sm:w-auto min-h-[40px] sm:min-h-auto px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-950 text-white font-mono text-xs font-semibold tracking-wide transition-all shadow-2xs flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                  >
                    <span>View Herd Roster</span>
                    <ExternalLink className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="size-10 sm:size-11 rounded-xl bg-slate-700 text-white flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-2xs">
                      <Tag className="size-4.5 sm:size-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight block">
                        Individual Livestock Registration
                      </span>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-normal mt-0.5 leading-snug">
                        Independent animal record • {activeLivestock?.farmerName ? `Owner: ${activeLivestock.farmerName}` : "Municipal livestock registry"}
                        {activeLivestock?.barangayName ? ` • Barangay ${activeLivestock.barangayName}` : ""}.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange();
                      router.push(`/livestock-inventory/${animalId || activeLivestock?.tagNumber}`);
                    }}
                    className="w-full sm:w-auto min-h-[40px] sm:min-h-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-mono text-xs font-semibold tracking-wide transition-all shadow-2xs flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                  >
                    <span>Full Bio Record</span>
                    <ExternalLink className="size-3.5" />
                  </button>
                </div>
              )}

              {/* 6-Card Metric Grid (1 col on mobile, 2 col on tablet, 3 col on desktop) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
                {/* Tile 1: Ear Tag ID */}
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between shadow-2xs min-h-[96px] sm:min-h-[105px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      EAR TAG ID
                    </span>
                    <Tag className="size-3.5 text-slate-400" />
                  </div>
                  <div className="mt-1">
                    <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight block truncate">
                      {titleText}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                      <Check className="size-3 text-emerald-600 stroke-[3]" />
                      {activeLivestock?.ownershipCertificateNumber
                        ? `Cert #${activeLivestock.ownershipCertificateNumber}`
                        : (activeLivestock?.tagNumber ? "Standard Tag & Barcode Confirmed" : "System ID Assigned")}
                    </span>
                  </div>
                </div>

                {/* Tile 2: Assigned Herd */}
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between shadow-2xs min-h-[96px] sm:min-h-[105px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      ASSIGNED HERD
                    </span>
                    <Users className="size-3.5 text-slate-400" />
                  </div>
                  <div className="mt-1">
                    <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-mono block truncate">
                      {activeLivestock?.batchCode || "None (Individual)"}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 mt-0.5 block truncate">
                      {activeLivestock?.batchName || (activeLivestock?.batchCode ? "Assigned Herd Group" : "Not grouped in a herd")}
                    </span>
                  </div>
                </div>

                {/* Tile 3: Scale Weight */}
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between shadow-2xs min-h-[96px] sm:min-h-[105px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      SCALE WEIGHT
                    </span>
                    {weightGainKg !== null ? (
                      <span className={cn(
                        "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5",
                        weightGainKg >= 0 ? "text-emerald-700 bg-emerald-100/80" : "text-rose-700 bg-rose-100/80"
                      )}>
                        <TrendingUp className="size-3" /> {weightGainKg >= 0 ? `+${weightGainKg}` : weightGainKg} kg
                      </span>
                    ) : latestWeight ? (
                      <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        Baseline
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        Unweighed
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        {displayWeight || "—"}
                      </span>
                      {displayWeight && <span className="text-xs font-mono font-bold text-slate-500">kg</span>}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 mt-0.5 block truncate">
                      {latestWeight
                        ? `Last weigh-in: ${formatCalendarDate(latestWeight.weighing_date)}`
                        : (activeLivestock?.createdAt ? `Registered: ${formatCalendarDate(activeLivestock.createdAt)}` : "No weigh-ins")}
                    </span>
                  </div>
                </div>

                {/* Tile 4: Birth Date */}
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between shadow-2xs min-h-[96px] sm:min-h-[105px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      BIRTH DATE
                    </span>
                    <Calendar className="size-3.5 text-slate-400" />
                  </div>
                  <div className="mt-1">
                    <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight block">
                      {activeLivestock?.birthDate ? formatCalendarDate(activeLivestock.birthDate) : "Birth date unrecorded"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 mt-0.5 block truncate">
                      {activeLivestock?.barangayName
                        ? `Barangay ${activeLivestock.barangayName}`
                        : (activeLivestock?.farmerName ? `Owner: ${activeLivestock.farmerName}` : "Municipal Livestock Registry")}
                    </span>
                  </div>
                </div>

                {/* Tile 5: Age & Class */}
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between shadow-2xs min-h-[96px] sm:min-h-[105px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      AGE / CLASS
                    </span>
                    <Hourglass className="size-3.5 text-slate-400" />
                  </div>
                  <div className="mt-1">
                    <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight block truncate">
                      {formatLivestockAge(activeLivestock?.age) || "Age unrecorded"} •{" "}
                      {formatAgeClassification(activeLivestock?.ageClassification) || "Livestock"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 mt-0.5 block truncate">
                      {activeLivestock?.sex || "Sex unrecorded"} • {activeLivestock?.entryType === "INDIVIDUAL" ? "Individual Animal" : "Herd Stock"}
                    </span>
                  </div>
                </div>

                {/* Tile 6: Vaccination Status */}
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50/40 border border-emerald-200/90 hover:border-emerald-300 transition-all flex flex-col justify-between shadow-2xs min-h-[96px] sm:min-h-[105px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
                      VACCINATION STATUS
                    </span>
                    <ShieldCheck className="size-4 text-emerald-600" />
                  </div>
                  <div className="mt-1">
                    <span className="text-xs sm:text-sm md:text-base font-bold text-emerald-950 tracking-tight block truncate">
                      {activeLivestock?.lastVaccinationDate
                        ? `Vaccinated (${formatCalendarDate(activeLivestock.lastVaccinationDate)})`
                        : "Unvaccinated / Pending"}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                      <Check className="size-3 text-emerald-600 stroke-[3]" />
                      {activeLivestock?.lastVaccinationDate ? "SIBAT Field Certified" : "No vaccination logged yet"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Remarks If Present */}
              {activeLivestock?.reviewRemarks && (
                <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-950 mb-1 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-emerald-700" />
                      <span>Municipal Review Remarks</span>
                    </div>
                    {activeLivestock.reviewedByName && (
                      <span className="text-[11px] font-mono text-emerald-700 font-medium">
                        Reviewed by {activeLivestock.reviewedByName}
                        {activeLivestock.reviewedAt ? ` on ${formatCalendarDate(activeLivestock.reviewedAt)}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-emerald-900 leading-relaxed italic">
                    &ldquo;{activeLivestock.reviewRemarks}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: YIELDS */}
          {activeTab === "yields" && (
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-sky-50/70 border border-sky-200/80 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                    {activeLivestock?.livestockTypeName || "Livestock"} Production Telemetry
                  </h3>
                  <p className="text-[11px] sm:text-xs font-mono text-slate-500 mt-0.5">
                    {avgYield
                      ? `Average: ${avgYield} ${animalProductions[0]?.unit === "LITERS" ? "L" : (animalProductions[0]?.unit || "units")} / session • ${animalProductions.length} total logged sessions`
                      : "No production yields recorded for this animal yet"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange();
                    router.push("/production-dashboard");
                  }}
                  className="w-full sm:w-auto min-h-[38px] sm:min-h-auto px-3.5 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-mono font-semibold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Log Production</span>
                </button>
              </div>

              <div className="space-y-2 font-mono text-xs">
                {animalProductions.length > 0 ? (
                  animalProductions.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-800 block text-xs">
                          {formatCalendarDate(p.recordDate)} {p.notes ? `(${p.notes})` : `(${p.productionType.toUpperCase()})`}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          Type: {p.productionType.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-sky-800 text-sm">
                          {p.quantity.toFixed(2)} {p.unit === "LITERS" ? "L" : p.unit}
                        </span>
                        <span className="block text-emerald-700 font-semibold text-[10px]">
                          {p.status || "VERIFIED"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 sm:py-10 space-y-3">
                    <div className="size-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto border border-sky-100">
                      <Droplets className="size-6 text-sky-600" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">No Production Yields Recorded</h3>
                    <p className="text-xs font-mono text-slate-500 max-w-sm mx-auto">
                      There are no milk, egg, or harvest sessions recorded for this animal in the Municipal system.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange();
                        router.push("/production-dashboard");
                      }}
                      className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-mono font-bold transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Log Production Session</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WEIGHT LOGS */}
          {activeTab === "weight" && (
            <div className="space-y-3">
              <div className="p-3 sm:p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Certified Weight Scales</h3>
                  <p className="text-[11px] sm:text-xs font-mono text-slate-500 mt-0.5">
                    {animalWeights.length > 0 ? `${animalWeights.length} weighing events logged` : "No weigh-in logs recorded"}
                  </p>
                </div>
                <span className="px-3 py-1 bg-white border border-slate-200/80 rounded-xl font-mono text-xs font-bold text-slate-800 self-start sm:self-auto">
                  Current: {displayWeight ? `${displayWeight} kg` : "Unrecorded"}
                </span>
              </div>

              {animalWeights.length > 0 ? (
                animalWeights.map((w, idx) => {
                  const prev = animalWeights[idx + 1];
                  const diff = prev ? (w.weight - prev.weight).toFixed(2) : null;
                  return (
                    <div
                      key={w.id}
                      className="p-3 sm:p-3.5 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between font-mono text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">{formatCalendarDate(w.weighing_date)}</span>
                        <span className="text-slate-500 text-[11px]">
                          {w.notes || "Official Scale Record"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm sm:text-base font-bold text-slate-900">{Number(w.weight).toFixed(2)} kg</span>
                        {diff !== null ? (
                          <span className={cn("block font-bold text-[10px]", Number(diff) >= 0 ? "text-emerald-700" : "text-rose-600")}>
                            {Number(diff) >= 0 ? `+${diff}` : diff} kg gain
                          </span>
                        ) : (
                          <span className="block text-slate-400 font-bold text-[10px]">Baseline</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 sm:py-10 space-y-3">
                  <div className="size-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto border border-slate-200">
                    <Scale className="size-6 text-slate-500" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">No Weight Logs Recorded</h3>
                  <p className="text-xs font-mono text-slate-500 max-w-sm mx-auto">
                    {displayWeight
                      ? `Baseline weight is recorded as ${displayWeight} kg. Periodic scale records will appear here.`
                      : "No weighing logs have been recorded for this animal yet."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange();
                      router.push("/production-dashboard");
                    }}
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-mono font-bold transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Log Weight Check</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CALVES */}
          {activeTab === "calves" && (
            <div className="space-y-3">
              {animalCalves.length > 0 ? (
                animalCalves.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 sm:p-3.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{c.calf_tag || `Calf #${c.id}`}</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Born {formatCalendarDate(c.calving_date)} • {c.calf_sex} • {c.breed}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 block text-xs">
                        {c.birth_weight ? `${c.birth_weight} kg` : "No birth weight"}
                      </span>
                      <span className="text-[10px] text-slate-400">{c.calving_ease}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 sm:py-8 space-y-2.5">
                  <div className="size-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl mx-auto">
                    <Baby className="size-6 text-slate-400" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">No Calves Registered Yet</h3>
                  <p className="text-xs font-mono text-slate-500 max-w-sm mx-auto">
                    This cow has 0 recorded offspring in the Municipal registry. You can register a calf when calving occurs.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange();
                      router.push("/production-dashboard");
                    }}
                    className="w-full sm:w-auto min-h-[40px] sm:min-h-auto px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-mono font-bold transition-all inline-flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <PlusCircle className="size-3.5" />
                    <span>Record New Calving</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: VACCINES & HEALTH */}
          {activeTab === "medical" && (
            <div className="space-y-2.5 sm:space-y-3 font-mono text-xs">
              {activeLivestock?.lastVaccinationDate && (
                <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5 sm:gap-3">
                  <ShieldCheck className="size-4.5 text-emerald-700 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                      Official Municipal Vaccination
                    </h4>
                    <p className="text-slate-600 text-xs mt-0.5">
                      Administered / Verified: {formatCalendarDate(activeLivestock.lastVaccinationDate)}
                    </p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-emerald-100/90 text-emerald-800 rounded font-bold text-[10px]">
                      CERTIFIED BY MAO / SIBAT
                    </span>
                  </div>
                </div>
              )}

              {animalDiseaseCases.length > 0 && (
                animalDiseaseCases.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 flex items-start justify-between gap-2.5 sm:gap-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className={cn(
                        "size-4.5 mt-0.5 shrink-0",
                        d.status === "APPROVED" ? "text-amber-600" : "text-slate-400"
                      )} />
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                          {d.name || "Health Observation"}
                        </h4>
                        <p className="text-slate-600 text-xs mt-0.5">
                          Reported: {formatCalendarDate(d.record_date || d.created_at)}
                        </p>
                        {d.review_remarks && (
                          <p className="text-slate-500 text-[11px] mt-1 italic">
                            &ldquo;{d.review_remarks}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded font-bold text-[10px] shrink-0",
                      d.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                    )}>
                      {d.status}
                    </span>
                  </div>
                ))
              )}

              {!activeLivestock?.lastVaccinationDate && animalDiseaseCases.length === 0 && (
                <div className="text-center py-8 sm:py-10 space-y-3">
                  <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-100">
                    <ShieldCheck className="size-6 text-emerald-700" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">Clear Health & Observation History</h3>
                  <p className="text-xs font-mono text-slate-500 max-w-sm mx-auto">
                    No disease cases or adverse health observations have been reported for this animal. Routine vaccination date has not been registered yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange();
                      router.push(`/report-observation?livestock_id=${animalId || ""}`);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-mono font-bold transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Report Health Observation</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ 4. BOTTOM ACTION FOOTER (Finger-friendly 44px+ touch targets on mobile) ═══ */}
        <div
          data-tour="details-footer"
          className="p-3.5 sm:p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0"
        >
          {/* Helper Text */}
          <div className="flex items-center gap-2 text-slate-500">
            <Info className="size-4 text-emerald-800 shrink-0" />
            <span className="text-[11px] sm:text-xs leading-tight">Open this animal&apos;s complete profile, records, and management tools.</span>
          </div>

          {/* Action Button Group */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Secondary Quick Health Action */}
            <button
              type="button"
              onClick={() => {
                onOpenChange();
                router.push(`/report-observation?livestock_id=${animalId || ""}`);
              }}
              className="w-1/2 sm:w-auto min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-mono text-xs font-semibold border border-slate-200/90 transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-98"
            >
              <Plus className="size-3.5 text-amber-600 stroke-[2.5]" />
              <span>Report Issue</span>
            </button>

            {/* Primary Full Bio Profile Button */}
            <button
              type="button"
              onClick={() => {
                onOpenChange();
                router.push(`/livestock-inventory/${animalId || livestock?.tagNumber}`);
              }}
              className="w-1/2 sm:w-auto min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-950 active:scale-95 text-white font-mono text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <span>View Profile</span>
              <ExternalLink className="size-3.5" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
