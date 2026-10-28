"use client";

import type { ApiProductionRecord } from "@/app/(farmer)/production-dashboard/production-analytics";
import { getProductionTypesForLivestock } from "@/app/(farmer)/production-dashboard/production-wizard";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import {
  AlertTriangle,
  Baby,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Droplets,
  ExternalLink,
  HeartHandshake,
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
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export interface ReproductiveSummary {
  animal_id: number;
  tag_number: string;
  species: string;
  breed: string;
  sex: string;
  batch_id?: number | null;
  batch_code?: string | null;
  reproductive_status: {
    status: "EXPOSED" | "PREGNANT" | "COMPLETE" | "UNKNOWN" | "NOT_APPLICABLE";
    label: string;
    badge_variant: string;
    explanation: string;
    is_female: boolean;
    can_breed: boolean;
    cycle_number: number;
    days_in_status: number | null;
    expected_calving_date: string | null;
    gestation_window: { start: string; end: string } | null;
  };
  bull_herd_exposure: {
    has_exposure: boolean;
    batch_name: string | null;
    bull_tags: string[];
  };
  breeding_history: Array<{
    id: number;
    breeding_date: string;
    breeding_type: string;
    breeding_type_label: string;
    sire_code: string;
    technician: string;
    gestation_days: number;
    expected_due_date: string | null;
    status: string;
    status_label: string;
    pregnancy_confirmed_date: string | null;
    confirmation_method: string | null;
    notes: string;
  }>;
  calving_history: Array<{
    id: number;
    calving_date: string;
    calf_tag: string;
    calf_sex: string;
    birth_weight: number | null;
    sire_tag: string;
    calving_ease: string;
    status: string;
    notes: string;
  }>;
  treatment_history: Array<{
    id: number;
    treatment_date: string;
    treatment_type: string;
    treatment_type_label: string;
    medication_name: string;
    reason: string;
    dosage: string;
    route_of_administration: string;
    administered_by: string;
    notes: string;
    follow_up_date: string | null;
  }>;
  unified_timeline: Array<{
    type: "BREEDING" | "PREGNANCY_CHECK" | "CALVING" | "TREATMENT";
    date: string;
    title: string;
    details: string;
    status: string;
    badge_color: string;
  }>;
  conception_prediction: {
    prediction_available: boolean;
    prediction_status: string;
    conception_likelihood_pct: number | null;
    model_version: string;
    message: string;
    disclaimer: string;
    is_confirmed_pregnancy: boolean;
  };
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
  const [activeTab, setActiveTab] = useState<"overview" | "yields" | "weight" | "calves" | "reproduction" | "medical">("overview");
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

  // Determine whether this animal species, sex, and maturity produce milk
  const canProduceMilk = Boolean(
    activeLivestock
      && getProductionTypesForLivestock(activeLivestock.livestockTypeName).includes("milk")
      && ["FEMALE", "F"].includes((activeLivestock.sex || "").trim().toUpperCase())
      && !["CALF", "YEARLING"].includes((activeLivestock.ageClassification || "").trim().toUpperCase())
  );

  // Automatically fallback to overview if yields tab was selected for a non-milking animal
  const effectiveTab = !canProduceMilk && activeTab === "yields" ? "overview" : activeTab;

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

  // 6. Reproductive Summary & Lifecycle Timeline (Phase 3, 4, 5, 8)
  const { data: reproSummary, refetch: refetchRepro } = useQuery<ReproductiveSummary | null>({
    queryKey: ["reproductive_summary", animalId],
    queryFn: async () => {
      if (!animalId) return null;
      const res = await api.get(`production/livestock/${animalId}/reproductive-summary/`);
      return res.data;
    },
    enabled: open && !!animalId,
  });

  // Treatment Logging Form State (Phase 5)
  const [isTreatmentFormOpen, setIsTreatmentFormOpen] = useState(false);
  const [treatmentDate, setTreatmentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [treatmentType, setTreatmentType] = useState("ANTIBIOTIC");
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [route, setRoute] = useState("Intramuscular (IM)");
  const [treatmentReason, setTreatmentReason] = useState("");
  const [administeredBy, setAdministeredBy] = useState("");
  const [treatmentNotes, setTreatmentNotes] = useState("");

  const addTreatmentMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("production/treatments/", {
        livestock: animalId,
        treatment_date: treatmentDate,
        treatment_type: treatmentType,
        medication_name: medicationName,
        dosage,
        route_of_administration: route,
        reason: treatmentReason,
        administered_by: administeredBy,
        notes: treatmentNotes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Veterinary treatment record logged successfully!");
      setIsTreatmentFormOpen(false);
      setMedicationName("");
      setDosage("");
      setTreatmentReason("");
      setTreatmentNotes("");
      refetchRepro();
    },
    onError: (err: unknown) => {
      const httpErr = err as { response?: { data?: { medication_name?: string; error?: string } } };
      const msg = httpErr?.response?.data?.medication_name || httpErr?.response?.data?.error || "Failed to log treatment.";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    },
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
    if (!canProduceMilk || !animalProductions.length) return null;
    const total = animalProductions.reduce((sum, p) => sum + p.quantity, 0);
    return (total / animalProductions.length).toFixed(1);
  }, [canProduceMilk, animalProductions]);

  const healthCount = (activeLivestock?.lastVaccinationDate ? 1 : 0) + animalDiseaseCases.length;

  // ═══ Horizontal Scrollbar State & Interaction for Detail Tabs ═══
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startScrollLeft: number }>({ startX: 0, startScrollLeft: 0 });
  const [scrollInfo, setScrollInfo] = useState({
    canScroll: false,
    thumbWidthPct: 100,
    thumbLeftPct: 0,
  });

  const updateScrollMetrics = useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    const canScroll = maxScroll > 1 && scrollWidth > 0;

    if (!canScroll || scrollWidth === 0) {
      setScrollInfo({ canScroll: false, thumbWidthPct: 100, thumbLeftPct: 0 });
      return;
    }

    const rawRatio = clientWidth / scrollWidth;
    const thumbWidthPct = Math.min(100, Math.max(18, rawRatio * 100));
    const scrollProgress = maxScroll > 0 ? Math.max(0, Math.min(1, scrollLeft / maxScroll)) : 0;
    const thumbLeftPct = scrollProgress * (100 - thumbWidthPct);

    setScrollInfo({ canScroll: true, thumbWidthPct, thumbLeftPct });
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = tabsContainerRef.current;
    if (!el) return;

    const rafId = requestAnimationFrame(() => {
      updateScrollMetrics();
    });

    const ro = new ResizeObserver(() => {
      updateScrollMetrics();
    });
    ro.observe(el);
    Array.from(el.children).forEach((child) => ro.observe(child));

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [open, updateScrollMetrics, activeTab, reproSummary, animalProductions.length, animalWeights.length, animalCalves.length, canProduceMilk]);

  const handleThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = tabsContainerRef.current;
    if (!el) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Safe fallback
    }
  };

  const handleThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = tabsContainerRef.current;
    const track = trackRef.current;
    if (!el || !track) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const trackWidth = track.clientWidth;
    const thumbWidthPx = (scrollInfo.thumbWidthPct / 100) * trackWidth;
    const scrollableTrack = trackWidth - thumbWidthPx;
    const scrollableTabs = el.scrollWidth - el.clientWidth;

    if (scrollableTrack > 0 && scrollableTabs > 0) {
      const scrollDelta = (deltaX / scrollableTrack) * scrollableTabs;
      el.scrollLeft = dragStartRef.current.startScrollLeft + scrollDelta;
    }
  };

  const handleThumbPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) return;
    const el = tabsContainerRef.current;
    const track = trackRef.current;
    if (!el || !track || !scrollInfo.canScroll) return;

    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const trackWidth = rect.width;
    const thumbWidthPx = (scrollInfo.thumbWidthPct / 100) * trackWidth;
    const scrollableTrack = trackWidth - thumbWidthPx;
    const scrollableTabs = el.scrollWidth - el.clientWidth;

    if (scrollableTrack > 0 && scrollableTabs > 0) {
      const targetRatio = Math.max(0, Math.min(1, (clickX - thumbWidthPx / 2) / scrollableTrack));
      el.scrollTo({ left: targetRatio * scrollableTabs, behavior: "smooth" });
    }
  };

  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = tabsContainerRef.current;
    if (!el || !scrollInfo.canScroll) return;

    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += e.deltaY;
    }
  };

  const handleTabClick = (
    tab: "overview" | "yields" | "weight" | "calves" | "reproduction" | "medical",
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    setActiveTab(tab);
    e.currentTarget.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  };

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
          description: canProduceMilk
            ? "Switch between Overview Profile, Yields, Weight Logs, Calves, and Vaccines & Health records."
            : "Switch between Overview Profile, Weight Logs, Calves, and Vaccines & Health records.",
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
  }, [canProduceMilk]);

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
                  {activeLivestock?.sex && (() => {
                    const s = activeLivestock.sex.trim().toUpperCase();
                    const isFemale = s === "FEMALE" || s === "F";
                    const isMale = s === "MALE" || s === "M";
                    const isCastrated = s === "CASTRATED";
                    const badgeClass = isFemale
                      ? "bg-rose-50 text-rose-800 border-rose-200/70"
                      : isMale
                      ? "bg-sky-50 text-sky-800 border-sky-200/70"
                      : isCastrated
                      ? "bg-amber-50 text-amber-800 border-amber-200/70"
                      : "bg-slate-100/80 text-slate-700 border-slate-200/60";

                    return (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className={`inline-flex items-center gap-1 font-semibold px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs border ${badgeClass}`}>
                          {isFemale ? (
                            <>
                              <span className="text-rose-500 font-bold">♀</span> Female
                            </>
                          ) : isMale ? (
                            <>
                              <span className="text-sky-600 font-bold">♂</span> Male
                            </>
                          ) : isCastrated ? (
                            <>
                              <span className="text-amber-600 font-bold">⚲</span> Castrated
                            </>
                          ) : (
                            activeLivestock.sex
                          )}
                        </span>
                      </>
                    );
                  })()}
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

              {/* Official Reproductive Status Badge (Phase 3 & 9) */}
              {reproSummary?.reproductive_status && (
                <span
                  className={cn(
                    "min-h-[34px] sm:min-h-auto px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold tracking-wide inline-flex items-center gap-1.5 shadow-2xs border",
                    reproSummary.reproductive_status.status === "PREGNANT"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : reproSummary.reproductive_status.status === "EXPOSED"
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : reproSummary.reproductive_status.status === "COMPLETE"
                      ? "bg-sky-50 text-sky-800 border-sky-300"
                      : reproSummary.reproductive_status.status === "NOT_APPLICABLE"
                      ? "bg-slate-100 text-slate-600 border-slate-200"
                      : "bg-slate-50 text-slate-700 border-slate-300"
                  )}
                  title={reproSummary.reproductive_status.explanation}
                >
                  <HeartHandshake className="size-3.5" />
                  <span>{reproSummary.reproductive_status.label}</span>
                </span>
              )}
            </div>
          </div>

          {/* ═══ 2. TABS (Swipeable horizontal scroll with edge padding on mobile) ═══ */}
          <div
            ref={tabsContainerRef}
            onScroll={updateScrollMetrics}
            onWheel={handleTabsWheel}
            data-tour="details-tabs"
            className="mt-3.5 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            <button
              type="button"
              onClick={(e) => handleTabClick("overview", e)}
              className={cn(
                "shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                effectiveTab === "overview"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              )}
            >
              <Users className="size-3.5" />
              <span>Overview Profile</span>
            </button>

            {canProduceMilk && (
              <button
                type="button"
                onClick={(e) => handleTabClick("yields", e)}
                className={cn(
                  "shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                  effectiveTab === "yields"
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
            )}

            <button
              type="button"
              onClick={(e) => handleTabClick("weight", e)}
              className={cn(
                "shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                effectiveTab === "weight"
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
              onClick={(e) => handleTabClick("calves", e)}
              className={cn(
                "shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                effectiveTab === "calves"
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
              onClick={(e) => handleTabClick("reproduction", e)}
              className={cn(
                "shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                effectiveTab === "reproduction"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              )}
            >
              <HeartHandshake className="size-3.5" />
              <span>Reproduction</span>
              {reproSummary?.reproductive_status && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold border",
                  reproSummary.reproductive_status.status === "PREGNANT"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : reproSummary.reproductive_status.status === "EXPOSED"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                )}>
                  {reproSummary.reproductive_status.label}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={(e) => handleTabClick("medical", e)}
              className={cn(
                "shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-[38px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer",
                effectiveTab === "medical"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              )}
            >
              <Plus className="size-3.5 stroke-[2.5]" />
              <span>Vaccines & Health</span>
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                {healthCount + (reproSummary?.treatment_history?.length ?? 0)}
              </span>
            </button>
          </div>

          {/* ═══ INTERACTIVE HORIZONTAL SCROLLBAR FOR TABS (Indicated by user) ═══ */}
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className={cn(
              "w-full h-1.5 sm:h-2 bg-slate-100 hover:bg-slate-200/70 rounded-full mt-3 relative transition-all duration-200 select-none group",
              scrollInfo.canScroll ? "cursor-pointer" : "opacity-40 cursor-default"
            )}
            role="scrollbar"
            aria-controls="details-tabs"
            aria-valuenow={Math.round(scrollInfo.thumbLeftPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Horizontal scrollbar for detail tabs"
            title={scrollInfo.canScroll ? "Click or drag to scroll tabs horizontally" : undefined}
          >
            {scrollInfo.canScroll ? (
              <div
                onPointerDown={handleThumbPointerDown}
                onPointerMove={handleThumbPointerMove}
                onPointerUp={handleThumbPointerUp}
                onPointerCancel={handleThumbPointerUp}
                style={{
                  left: `${scrollInfo.thumbLeftPct}%`,
                  width: `${scrollInfo.thumbWidthPct}%`,
                }}
                className="absolute top-0 bottom-0 bg-slate-400 group-hover:bg-slate-500 active:bg-slate-700 rounded-full transition-colors cursor-grab active:cursor-grabbing shadow-2xs"
              />
            ) : (
              <div className="h-full bg-slate-200/90 rounded-full w-full" />
            )}
          </div>
        </div>

        {/* ═══ 3. SCROLLABLE CONTENT BODY (Field responsive spacing) ═══ */}
        <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 flex-1 overflow-y-auto max-h-[62vh] sm:max-h-[60vh]">
          {/* TAB 1: OVERVIEW PROFILE */}
          {effectiveTab === "overview" && (
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
          {canProduceMilk && effectiveTab === "yields" && (
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
          {effectiveTab === "weight" && (
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
          {effectiveTab === "calves" && (
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

          {/* TAB 5: REPRODUCTION & BREEDING LIFECYCLE (Phases 3, 4, 7, 8) */}
          {effectiveTab === "reproduction" && (
            <div className="space-y-4 font-mono text-xs">
              {/* Reproductive Status Overview Card */}
              {reproSummary?.reproductive_status ? (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">Authoritative Reproductive Status</span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-bold border",
                        reproSummary.reproductive_status.status === "PREGNANT"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : reproSummary.reproductive_status.status === "EXPOSED"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : reproSummary.reproductive_status.status === "COMPLETE"
                          ? "bg-sky-100 text-sky-800 border-sky-300"
                          : reproSummary.reproductive_status.status === "NOT_APPLICABLE"
                          ? "bg-slate-100 text-slate-600 border-slate-200"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                      )}>
                        {reproSummary.reproductive_status.label}
                      </span>
                    </div>
                    {reproSummary.reproductive_status.cycle_number > 0 && (
                      <span className="text-[11px] text-slate-500 font-semibold">
                        Reproductive Cycle #{reproSummary.reproductive_status.cycle_number}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {reproSummary.reproductive_status.explanation}
                  </p>

                  {/* Gestation Window & Calving Prediction (Phase 8) */}
                  {reproSummary.reproductive_status.expected_calving_date && (
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between font-bold text-amber-950">
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-4 text-amber-700" />
                          Estimated Calving Date:
                        </span>
                        <span className="text-sm font-black text-amber-900">
                          {formatCalendarDate(reproSummary.reproductive_status.expected_calving_date)}
                        </span>
                      </div>
                      {reproSummary.reproductive_status.gestation_window && (
                        <p className="text-[11px] text-amber-800">
                          Expected Window: {formatCalendarDate(reproSummary.reproductive_status.gestation_window.start)} – {formatCalendarDate(reproSummary.reproductive_status.gestation_window.end)}
                          {" "}(Biological variance: ±10 days based on species reference).
                        </p>
                      )}
                      <p className="text-[10px] text-amber-700 italic">
                        * Note: This date is a biological estimate derived from the recorded breeding date. It does not replace clinical ultrasound confirmation.
                      </p>
                    </div>
                  )}

                  {/* Herd Bull Exposure Check (Phase 4) */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span className="flex items-center gap-1.5">
                        <Users className="size-3.5 text-slate-600" />
                        Current Herd Bull Exposure:
                      </span>
                      <span className={reproSummary.bull_herd_exposure.has_exposure ? "text-amber-800" : "text-slate-500"}>
                        {reproSummary.bull_herd_exposure.has_exposure
                          ? `Exposed in ${reproSummary.bull_herd_exposure.batch_name || "Herd"}`
                          : "No Active Sire Bull in Current Pen"}
                      </span>
                    </div>
                    {reproSummary.bull_herd_exposure.bull_tags.length > 0 && (
                      <p className="text-[11px] text-slate-600">
                        Active Sire Bull(s): <strong className="text-slate-800">{reproSummary.bull_herd_exposure.bull_tags.join(", ")}</strong>
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 italic">
                      SmartLivestock enforces strict pen/herd boundaries. Exposure is never inferred merely because animals share a farm or barangay.
                    </p>
                  </div>

                  {/* AI Conception Prediction Governance Banner (Phase 7) */}
                  <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-sky-950">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-sky-600" />
                        Conception Likelihood Model:
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-sky-100 text-sky-800">
                        {reproSummary.conception_prediction.prediction_status === "BLOCKED_PENDING_DATA" ? "Deferred (Data Collection)" : "Active"}
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-800">
                      {reproSummary.conception_prediction.message}
                    </p>
                    <p className="text-[10px] text-sky-700 italic">
                      {reproSummary.conception_prediction.disclaimer}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">Loading reproductive profile...</div>
              )}

              {/* Unified Chronological Timeline (Phase 2 & 5) */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                  <Calendar className="size-4 text-emerald-700" />
                  <span>Unified Reproductive & Clinical History</span>
                </h4>

                {reproSummary?.unified_timeline && reproSummary.unified_timeline.length > 0 ? (
                  <div className="relative pl-6 space-y-3 border-l-2 border-slate-200">
                    {reproSummary.unified_timeline.map((evt, idx) => (
                      <div key={idx} className="relative group">
                        <div className={cn(
                          "absolute -left-[31px] top-1 size-3.5 rounded-full border-2 border-white",
                          evt.type === "PREGNANCY_CHECK"
                            ? "bg-emerald-600"
                            : evt.type === "CALVING"
                            ? "bg-sky-600"
                            : evt.type === "TREATMENT"
                            ? "bg-purple-600"
                            : "bg-amber-500"
                        )} />
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">{evt.title}</span>
                            <span className="text-[10px] text-slate-400">{formatCalendarDate(evt.date)}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">{evt.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    No historical breeding, pregnancy diagnoses, calvings, or treatments logged yet for this animal.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: VACCINES & HEALTH (Integrated with Clinical Treatments - Phase 5) */}
          {effectiveTab === "medical" && (
            <div className="space-y-3 font-mono text-xs">
              {/* Top Action to Log Treatment */}
              <div className="flex items-center justify-between pb-1">
                <span className="font-bold text-slate-800 text-xs sm:text-sm">Health Observations & Treatments</span>
                <button
                  type="button"
                  onClick={() => setIsTreatmentFormOpen((prev) => !prev)}
                  className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-mono font-bold transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>{isTreatmentFormOpen ? "Close Form" : "Log Treatment"}</span>
                </button>
              </div>

              {/* Inline Form to Log Clinical Treatment (Phase 5 & 10) */}
              {isTreatmentFormOpen && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addTreatmentMutation.mutate();
                  }}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Pill className="size-4 text-emerald-700" />
                      Log Veterinary or Clinical Treatment
                    </span>
                    <span className="text-[10px] text-slate-400">Scoped to this animal</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Treatment Date</label>
                      <input
                        type="date"
                        max={new Date().toISOString().split("T")[0]}
                        value={treatmentDate}
                        onChange={(e) => setTreatmentDate(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Treatment Category</label>
                      <select
                        value={treatmentType}
                        onChange={(e) => setTreatmentType(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs"
                      >
                        <option value="ANTIBIOTIC">Antibiotic / Anti-infective</option>
                        <option value="DEWORMER">Anthelmintic / Dewormer</option>
                        <option value="VITAMINS">Vitamins / Nutritional Supplement</option>
                        <option value="VACCINE">Vaccine / Immunization</option>
                        <option value="ANTI_INFLAMMATORY">Anti-inflammatory / Pain Relief</option>
                        <option value="HORMONAL">Hormonal / Estrus Synchronization</option>
                        <option value="OTHER">Other Clinical Treatment</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Medication Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Oxytetracycline LA"
                        value={medicationName}
                        onChange={(e) => setMedicationName(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Dosage</label>
                      <input
                        type="text"
                        placeholder="e.g. 20 mL"
                        value={dosage}
                        onChange={(e) => setDosage(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Route</label>
                      <input
                        type="text"
                        placeholder="e.g. Intramuscular (IM)"
                        value={route}
                        onChange={(e) => setRoute(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Clinical Indication / Reason</label>
                      <input
                        type="text"
                        placeholder="e.g. Post-calving uterine cleanse prophylaxis"
                        value={treatmentReason}
                        onChange={(e) => setTreatmentReason(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Administering Vet / Person</label>
                      <input
                        type="text"
                        placeholder="e.g. Dr. Dimaano (MAO)"
                        value={administeredBy}
                        onChange={(e) => setAdministeredBy(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsTreatmentFormOpen(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addTreatmentMutation.isPending}
                      className="px-4 py-1.5 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900"
                    >
                      {addTreatmentMutation.isPending ? "Saving..." : "Save Treatment"}
                    </button>
                  </div>
                </form>
              )}

              {/* Recorded Treatments List (Phase 5) */}
              {reproSummary?.treatment_history && reproSummary.treatment_history.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Clinical Treatments Logged</h5>
                  {reproSummary.treatment_history.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 sm:p-3.5 rounded-xl bg-white border border-slate-200 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <Pill className="size-4 text-purple-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{t.medication_name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              {t.treatment_type_label}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px] mt-0.5">
                            {t.dosage && `Dose: ${t.dosage} · `}
                            {t.route_of_administration && `Route: ${t.route_of_administration} · `}
                            {t.administered_by && `By: ${t.administered_by}`}
                          </p>
                          {t.reason && (
                            <p className="text-slate-500 text-[11px] mt-0.5">
                              Indication: {t.reason}
                            </p>
                          )}
                          {t.notes && (
                            <p className="text-slate-400 text-[10px] italic mt-0.5">&ldquo;{t.notes}&rdquo;</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 font-bold">
                        {formatCalendarDate(t.treatment_date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Official Vaccination Card */}
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

              {/* Disease Cases */}
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

              {!activeLivestock?.lastVaccinationDate && animalDiseaseCases.length === 0 && (!reproSummary?.treatment_history || reproSummary.treatment_history.length === 0) && (
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
