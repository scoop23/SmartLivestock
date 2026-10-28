"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import api from "@/lib/axios";
import { localCalendarDateToday } from "@/lib/livestock-age";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import {
ArrowLeft,
AlertTriangle,
Baby,
ClipboardList,
HeartHandshake,
LineChart as LineChartIcon,
Milk,
Pill,
Plus,
RefreshCw,
Scale,
ShieldCheck,
ShoppingBag,
Wheat,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import SpeciesHeroBanner from "./components/species-hero-banner";
import SpeciesKpiCards from "./components/species-kpi-cards";
import ProductionBreedingTab from "./production-breeding-tab";
import ProductionFeedingTab from "./production-feeding-tab";
import ProductionTreatmentsTab from "./production-treatments-tab";
import ProductionCalvingTab,{
CalvingRecordItem,
getBirthingTerminology,
} from "./production-calving-tab";
import ProductionCharts from "./production-charts";
import ProductionDeleteDialog from "./production-delete-dialog";
import ProductionForecastsTab from "./production-forecasts-tab";
import ProductionHistory from "./production-history";
import ProductionRecent from "./production-recent";
import ProductionSalesTab from "./production-sales-tab";
import ProductionSubmissionSuccessDialog from "./production-submission-success-dialog";
import ProductionTypeSelector from "./production-type-selector";
import ProductionWeightTab from "./production-weight-tab";
import ProductionWizard,{ getProductionTypesForLivestock } from "./production-wizard";

import { useUserInventory,type LivestockInventoryItem } from "../livestock-inventory/livestock-inventory";
import {
  EMPTY_TYPE_ANALYTICS,
  PRODUCTION_TYPE_LABELS,
  computeProductionAnalytics,
  deleteProductionRecord,
  fetchProductionRecords,
  type ProductionRecordItem,
  type ProductionType,
} from "./production-analytics";
import type { ProductionPayload } from "./production-wizard";

export type UnitType = "liters" | "pieces" | "kilograms";

type DiseaseReportSummary = {
  id: number;
  livestock: number | null;
  batch: number | null;
  name: string;
  status: string;
};

export type UpdateProductionPayload = {
  id: number;
  payload: ProductionPayload;
};

export type WizardMode = "create" | "edit";

interface ProductionDashboardViewProps {
  selectedSpecies: string | null;
  onSpeciesChange?: (species: string | null) => void;
  onBackToHub?: () => void;
  showEnterpriseSwitch?: boolean;
  initialActivity?: string | null;
  initialMode?: "record" | "history" | null;
  initialEligibleSpecies?: string[];
  onReturnToChooser?: () => void;
}

function productionErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data || typeof data !== "object") return fallback;
  const messages = Object.values(data).flat().filter((value): value is string => typeof value === "string");
  return messages.join(" ") || fallback;
}

export default function ProductionDashboardView({
  selectedSpecies,
  onSpeciesChange,
  onBackToHub,
  showEnterpriseSwitch = true,
  initialActivity = null,
  initialMode = null,
  initialEligibleSpecies = [],
  onReturnToChooser,
}: ProductionDashboardViewProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const activityTabs: Record<string, "production" | "breeding" | "calving" | "weights" | "sales" | "forecasts" | "feedings" | "treatments"> = {
    milk: "production", meat: "production", eggs: "production", wool: "production",
    breeding: "breeding", insemination: "breeding",
    calving: "calving", weights: "weights", sales: "sales", intent: "sales",
    feedings: "feedings", feeding: "feedings",
    treatment: "treatments", treatments: "treatments", health: "treatments", medical: "treatments",
  };
  const focusedProductionType = initialActivity && ["milk", "meat", "eggs", "wool"].includes(initialActivity)
    ? initialActivity as ProductionType
    : "milk";
  const currentMonth = localCalendarDateToday().slice(0, 7);
  const [focusedActivity] = useState<string | null>(initialActivity);
  const [focusedMode] = useState<"record" | "history" | null>(initialMode);
  const [kpiMonth, setKpiMonth] = useState(currentMonth);
  const [showOverallKpis, setShowOverallKpis] = useState(initialMode === "history");

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(initialMode === "record" && ["milk", "meat", "eggs", "wool"].includes(initialActivity ?? ""));
  const [isSubmissionSuccessOpen, setIsSubmissionSuccessOpen] = useState(false);
  const [submittedProductionId, setSubmittedProductionId] = useState<number | string | null>(null);
  const [diseaseWarning, setDiseaseWarning] = useState<{
    payload: ProductionPayload;
    reports: DiseaseReportSummary[];
    lookupFailed: boolean;
    blocked: boolean;
  } | null>(null);
  const [editingRecord, setEditingRecord] = useState<Partial<ProductionRecordItem> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionRecordItem | null>(null);
  const [productionType, setProductionType] = useState<ProductionType>(focusedProductionType);
  const [clickedInventory, setClickedInventory] = useState<LivestockInventoryItem | null>(null);
  const [formState, setFormState] = useState<Record<string, string | number>>(() => {
    if (initialMode !== "record") return {} as Record<string, string | number>;
    return {
      prodDate: localCalendarDateToday(), milkTime: "Morning", collectionTime: "Morning",
      meatPurpose: "Auction / Market Sale", notes: "",
    };
  });
  const [resetSignal, setResetSignal] = useState(0);

  // Main Tabs State: "production" | "breeding" | "calving" | "weights" | "sales" | "forecasts" | "feedings" | "treatments"
  const [activeMainTab, setActiveMainTab] = useState<
    "production" | "breeding" | "calving" | "weights" | "sales" | "forecasts" | "feedings" | "treatments"
  >(initialActivity ? activityTabs[initialActivity] ?? "production" : "production");

  const shouldRenderFocusedTab = !focusedActivity
    || focusedMode === "history"
    || (focusedMode === "record" && ["breeding", "insemination", "calving", "weights", "sales", "intent", "feedings", "feeding", "treatment", "treatments"].includes(focusedActivity));
  const isFocusedProductionHistory = Boolean(
    focusedMode === "history" && ["milk", "meat", "eggs", "wool"].includes(focusedActivity ?? ""),
  );

  // ═══ Horizontal Scrollbar State & Interaction for Production Tabs ═══
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
  }, [updateScrollMetrics, activeMainTab, selectedSpecies]);

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
    } catch {}
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
      } catch {}
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

  const handleMainTabSelect = (tabKey: typeof activeMainTab, e?: React.MouseEvent) => {
    setActiveMainTab(tabKey);
    if (e?.currentTarget) {
      (e.currentTarget as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  };
  // Fetch Inventory with standard hook & mapper
  const { data: inventories = [], isLoading: isInventoryLoading } = useUserInventory();

  // Fetch Production Records
  const {
    data: productionRecords = [],
    isLoading: isRecordsLoading,
    isError: isRecordsError,
    error: recordsError,
    refetch,
    isRefetching,
  } = useQuery<ProductionRecordItem[]>({
    queryKey: ["production_records"],
    queryFn: fetchProductionRecords,
  });

  const diseaseReportsQuery = useQuery<DiseaseReportSummary[]>({
    queryKey: ["farmer-disease-reports-for-recording"],
    queryFn: async () => (await api.get<DiseaseReportSummary[]>("diseases/cases/")).data,
    enabled: isWizardOpen,
    staleTime: 30_000,
  });

  // Fetch Calving Records
  const { data: calvingRecords = [], isLoading: isCalvingLoading } = useQuery<CalvingRecordItem[]>({
    queryKey: ["calving_records"],
    queryFn: async () => {
      const res = await api.get("production/calving/");
      return res.data;
    },
  });

  // Fetch Weight Records
  const { data: weightRecords = [], isLoading: isWeightLoading } = useQuery<
    Array<{ weight: number; weighing_date: string; livestock: number }>
  >({
    queryKey: ["weight_records"],
    queryFn: async () => {
      const res = await api.get("production/weights/");
      return res.data;
    },
  });

  // Fetch Clinical Treatment Records
  const { data: treatmentRecords = [] } = useQuery<
    Array<{ id: number; livestock: number }>
  >({
    queryKey: ["production_treatments_all"],
    queryFn: async () => {
      try {
        const res = await api.get("production/treatments/");
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
  });

  const approvedInventories = useMemo(() => {
    return inventories.filter(
      (item) =>
        item.status === "APPROVED" &&
        (item.operationalStatus || "ACTIVE") === "ACTIVE" && item.quantity > 0,
    );
  }, [inventories]);
  const activeIntentInventories = useMemo(() => {
    const active = inventories.filter(
      (item) => (item.operationalStatus || "ACTIVE") === "ACTIVE" && item.quantity > 0 && item.status !== "REJECTED",
    );
    if (!focusedActivity || initialEligibleSpecies.length === 0) return active;
    const eligible = new Set(initialEligibleSpecies.map((name) => name.toLowerCase()));
    return active.filter((item) => eligible.has(item.livestockTypeName?.toLowerCase() ?? ""));
  }, [inventories, focusedActivity, initialEligibleSpecies]);
  const activityInventories = useMemo(() => {
    if (!focusedActivity || initialEligibleSpecies.length === 0) return approvedInventories;
    const eligible = new Set(initialEligibleSpecies.map((name) => name.toLowerCase()));
    return approvedInventories.filter((item) => eligible.has(item.livestockTypeName?.toLowerCase() ?? ""));
  }, [approvedInventories, focusedActivity, initialEligibleSpecies]);

  const ownedSpecies = useMemo(
    () =>
      Array.from(
        new Set(
          approvedInventories
            .map((item) => item.livestockTypeName?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [approvedInventories],
  );

  const allowedProductionTypes = useMemo(() => {
    if (selectedSpecies && selectedSpecies !== "ALL") {
      return getProductionTypesForLivestock(selectedSpecies);
    }
    const allowed = new Set<ProductionType>();
    ownedSpecies.forEach((speciesName) => {
      getProductionTypesForLivestock(speciesName).forEach((type) => allowed.add(type));
    });
    const displayOrder: ProductionType[] = ["milk", "meat", "eggs", "wool"];
    return displayOrder.filter((type) => allowed.has(type));
  }, [ownedSpecies, selectedSpecies]);

  const activeProductionType = allowedProductionTypes.includes(productionType)
    ? productionType
    : allowedProductionTypes[0] ?? "milk";

  // console.log(Array.from(new Set(approvedInventories.map((r) => r.livestockTypeName))).sort((left, right) => left.localeCompare(right)));


  const filteredInventories = useMemo(() => {
    if (!selectedSpecies || selectedSpecies === "ALL")
      return inventories.filter((item) => item.status !== "SUBJECT_TO_REVISION" && item.status !== "REJECTED");
    return inventories
      .filter((item) => item.status !== "SUBJECT_TO_REVISION" && item.status !== "REJECTED")
      .filter((item) => item.livestockTypeName?.toLowerCase() === selectedSpecies.toLowerCase());
  }, [inventories, selectedSpecies]);

  const filteredProductionRecords = useMemo(() => {
    let records = productionRecords;
    if (selectedSpecies && selectedSpecies !== "ALL") {
      records = records.filter((item) => item.livestockTypeName?.toLowerCase() === selectedSpecies.toLowerCase());
    }
    if (focusedActivity && ["milk", "meat", "eggs", "wool"].includes(focusedActivity)) {
      records = records.filter((item) => item.productionType === focusedActivity);
    }
    return records;
  }, [focusedActivity, productionRecords, selectedSpecies]);

  const selectedInventoryIds = useMemo(
    () => new Set(filteredInventories.map((item) => Number(item.id))),
    [filteredInventories],
  );
  const monthlyKpiProductionRecords = useMemo(
    () => showOverallKpis
      ? filteredProductionRecords
      : filteredProductionRecords.filter((record) => record.recordDate?.slice(0, 7) === kpiMonth),
    [filteredProductionRecords, kpiMonth, showOverallKpis],
  );
  const monthlyKpiCalvingRecords = useMemo(
    () => calvingRecords.filter((record) =>
      selectedInventoryIds.has(Number(record.dam)) &&
      (showOverallKpis || record.calving_date?.slice(0, 7) === kpiMonth),
    ),
    [calvingRecords, kpiMonth, selectedInventoryIds, showOverallKpis],
  );
  const monthlyKpiWeightRecords = useMemo(
    () => weightRecords.filter((record) =>
      selectedInventoryIds.has(Number(record.livestock)) &&
      (showOverallKpis || record.weighing_date?.slice(0, 7) === kpiMonth),
    ),
    [kpiMonth, selectedInventoryIds, showOverallKpis, weightRecords],
  );

  const filteredTreatmentCount = useMemo(() => {
    if (!selectedSpecies || selectedSpecies === "ALL") return treatmentRecords.length;
    const idSet = new Set(filteredInventories.map((item) => Number(item.id)));
    return treatmentRecords.filter((t) => idSet.has(Number(t.livestock))).length;
  }, [filteredInventories, selectedSpecies, treatmentRecords]);

  const terms = getBirthingTerminology(selectedSpecies);

  // Dynamically adapt button label when user changes between Milk, Meat, Eggs, Wool
  const quickLogLabel = useMemo(() => {
    const s = (selectedSpecies || "").toLowerCase();
    switch (activeProductionType) {
      case "meat":
        if (s.includes("swine") || s.includes("pig")) return "Log Pork & Carcass";
        if (s.includes("cattle")) return "Log Beef & Carcass";
        if (s.includes("carabao")) return "Log Carabeef & Carcass";
        if (s.includes("goat")) return "Log Chevon & Meat";
        if (s.includes("sheep")) return "Log Mutton & Meat";
        if (s.includes("poultry") || s.includes("chicken")) return "Log Poultry Meat";
        return "Log Meat & Carcass";
      case "eggs":
        return "Log Egg Collection";
      case "wool":
        return "Log Wool Shearing";
      case "milk":
      default:
        if (s.includes("goat")) return "Log Goat Milk Yield";
        if (s.includes("carabao")) return "Log Carabao Milk Yield";
        if (s.includes("cattle")) return "Log Cow Milk Yield";
        return "Log Daily Milk Yield";
    }
  }, [activeProductionType, selectedSpecies]);

  const handleFieldChange = (field: string, val: string | number) => {
    setFormState((prev) => ({ ...prev, [field]: val }));
  };

  const handleTypeSelect = (type: ProductionType) => {
    setProductionType(type);
  };

  const handleOpenNewWizard = () => {
    setEditingRecord(null);
    setClickedInventory(null);
    // Keep the selected production activity; the farmer chooses the animal in the wizard.
    setFormState({
      prodDate: localCalendarDateToday(),
      milkTime: "Morning",
      collectionTime: "Morning",
      meatPurpose: "Auction / Market Sale",
      notes: "",
    });
    setResetSignal((prev) => prev + 1);
    setIsWizardOpen(true);
  };

  const handleOpenEditWizard = (record: ProductionRecordItem) => {
    setEditingRecord(record);
    setProductionType(record.productionType);
    const targetLivestockId = String(record.livestockId || "");
    const matchedInv =
      inventories.find((i) => String(i.id) === targetLivestockId) ||
      (targetLivestockId
        ? ({
            id: targetLivestockId,
            livestockTypeName: record.livestockTypeName || "Livestock",
            entryType: "INDIVIDUAL",
            status: "APPROVED",
            tagNumber: `ID #${targetLivestockId}`,
            breed: "",
            sex: "",
            farmerName: record.farmerName || "",
            quantity: 1,
            weight: null,
            lastVaccinationDate: null,
            createdAt: record.createdAt,
          } as LivestockInventoryItem)
        : null);

    setClickedInventory(matchedInv);

    let rawNotes = record.notes || "";
    let extractedMilkTime = record.milkingSession
      ? record.milkingSession.charAt(0) + record.milkingSession.slice(1).toLowerCase()
      : "Morning";
    let extractedMeatPurpose = "Auction / Market Sale";

    if (record.productionType === "milk") {
      const timeMatch = rawNotes.match(/\[(Morning|Afternoon|Evening)\]/i);
      if (!record.milkingSession && timeMatch) {
        extractedMilkTime =
          timeMatch[1].charAt(0).toUpperCase() + timeMatch[1].slice(1).toLowerCase();
        rawNotes = rawNotes.replace(timeMatch[0], "").trim();
      }
    } else if (record.productionType === "meat") {
      const purposeMatch = rawNotes.match(/\[Purpose:\s*([^\]]+)\]/i);
      if (purposeMatch) {
        extractedMeatPurpose = purposeMatch[1].trim();
        rawNotes = rawNotes.replace(purposeMatch[0], "").trim();
      }
    }

    const newFormState: Record<string, string | number> = {
      prodDate: record.recordDate,
      notes: rawNotes,
      milkTime: extractedMilkTime,
      meatPurpose: extractedMeatPurpose,
      collectionTime: "Morning",
    };

    if (record.productionType === "milk") {
      newFormState.milkQty = Number(record.quantity);
    } else if (record.productionType === "meat") {
      newFormState.meatQty = Number(record.quantity);
    } else if (record.productionType === "eggs") {
      newFormState.eggQty = Number(record.quantity);
    } else if (record.productionType === "wool") {
      newFormState.woolQty = Number(record.quantity);
    }

    setFormState(newFormState);
    setResetSignal((prev) => prev + 1);
    setIsWizardOpen(true);
  };

  // Mutations
  const submitMutation = useMutation({
    mutationFn: async (payload: ProductionPayload) => {
      const res = await api.post("production/records/", payload);
      return res.data;
    },
    onSuccess: (createdRecord) => {
      setSubmittedProductionId(createdRecord?.id ?? null);
      setIsSubmissionSuccessOpen(true);
      setIsWizardOpen(false);
      queryClient.invalidateQueries({ queryKey: ["production_records"] });
      queryClient.invalidateQueries({ queryKey: ["production"] });
    },
    onError: (error: unknown) => {
      toast.error(productionErrorMessage(error, "Failed to log production record."));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: UpdateProductionPayload) => {
      const res = await api.put(`production/records/${id}/`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Production record updated successfully!");
      setIsWizardOpen(false);
      setEditingRecord(null);
      queryClient.invalidateQueries({ queryKey: ["production_records"] });
    },
    onError: (error: unknown) => {
      toast.error(productionErrorMessage(error, "Failed to update production record."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProductionRecord,
    onSuccess: () => {
      toast.success("Production record deleted.");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["production_records"] });
    },
    onError: () => {
      toast.error("Failed to delete record.");
    },
  });

  const handleProductionSubmit = async (payload: ProductionPayload) => {
    if (editingRecord?.id) {
      updateMutation.mutate({ id: editingRecord.id as number, payload });
      return;
    }

    const result = await diseaseReportsQuery.refetch();
    const reports = result.data;
    const lookupFailed = result.isError || !reports;

    const relatedAnimalIds = new Set([
      String(payload.livestock),
      ...(payload.selected_animals ?? []).map(String),
    ]);
    const targetBatchId = clickedInventory?.batchId
      ?? (clickedInventory?.entryType === "BATCH" ? Number(clickedInventory.id) : null);
    const matchingReports = (reports ?? []).filter((report) =>
      ["PENDING", "VERIFIED"].includes(report.status)
      && (
        (report.livestock != null && relatedAnimalIds.has(String(report.livestock)))
        || (report.batch != null && targetBatchId != null && String(report.batch) === String(targetBatchId))
      ),
    );

    const verifiedReports = matchingReports.filter((report) => report.status === "VERIFIED");
    if (verifiedReports.length > 0) {
      setDiseaseWarning({ payload, reports: verifiedReports, lookupFailed: false, blocked: true });
      return;
    }
    const pendingReports = matchingReports.filter((report) => report.status === "PENDING");
    if (pendingReports.length > 0 || lookupFailed) {
      setDiseaseWarning({ payload, reports: pendingReports, lookupFailed, blocked: lookupFailed });
      return;
    }
    submitMutation.mutate(payload);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
  };

  const returnToActivityChooser = () => {
    if (onReturnToChooser) {
      onReturnToChooser();
      return;
    }
    router.push("/production-dashboard");
  };

  // A farmer who closes a form opened from the Record activity chooser should
  // return to that chooser instead of staying on an intermediate activity page.
  const handleWizardClose = () => {
    setIsWizardOpen(false);
    if (focusedActivity && focusedMode === "record") {
      returnToActivityChooser();
    }
  };

  const analytics = useMemo(
    () => computeProductionAnalytics(filteredProductionRecords),
    [filteredProductionRecords]
  );
  const legacyReviewStatusCount = filteredProductionRecords.filter((r) =>
    ["PENDING", "VERIFIED"].includes((r.status || "").toUpperCase())
  ).length;
  const isOverviewLoading =
    isRecordsLoading || isInventoryLoading || isCalvingLoading || isWeightLoading;

  return (
    <div className="space-y-6">
      {focusedActivity && focusedMode ? (
        <div className="space-y-3">
          <Button type="button" variant="outline" className="min-h-11 shrink-0 rounded-xl" onClick={returnToActivityChooser}>
            <ArrowLeft className="mr-2 size-4" /> Choose another activity
          </Button>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{selectedSpecies === "ALL" ? "All livestock" : selectedSpecies}</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {focusedMode === "record"
                ? `Record ${focusedActivity ?? "activity"} output`
                : `${focusedActivity ? focusedActivity.charAt(0).toUpperCase() + focusedActivity.slice(1) : "Activity"} records`}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {focusedMode === "record"
                ? `Complete the form to log ${focusedActivity ?? "production"} output. Choose the animal and review before saving.`
                : `Review your saved ${focusedActivity ?? "production"} records and activity history.`}
            </p>
          </section>
        </div>
      ) : null}
      <div className={focusedActivity ? "hidden" : "space-y-6"}>
      {/* Top Enterprise Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          {showEnterpriseSwitch && onBackToHub && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBackToHub}
              className="gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:text-emerald-950 hover:bg-emerald-50 font-bold"
            >
              <ArrowLeft className="size-4" /> All Enterprises
            </Button>
          )}

          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-bold px-2.5 py-0.5">
              {selectedSpecies === "ALL" || !selectedSpecies
                ? "Combined Herd"
                : `${selectedSpecies} Enterprise`}
            </Badge>
            <span className="text-xs font-semibold text-slate-500 hidden md:inline">
              {filteredInventories.length} Inventory Records (
              {filteredInventories.reduce(
                (a: number, b: LivestockInventoryItem) => a + (b.quantity || 1),
                0
              )}{" "}
              Heads)
            </span>
          </div>
        </div>

        {/* Quick Enterprise Switcher Pills */}
        {showEnterpriseSwitch && onSpeciesChange && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {ownedSpecies.map((sName) => (
              <button
                key={sName}
                type="button"
                onClick={() => onSpeciesChange(sName)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap ${
                  selectedSpecies === sName
                    ? "bg-emerald-700 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {sName}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onSpeciesChange("ALL")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap ${
                selectedSpecies === "ALL"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
          </div>
        )}
      </div>

      {/* Executive Species Telemetry Hero Banner */}
      <SpeciesHeroBanner
        species={selectedSpecies}
        terms={terms}
        filteredInventories={filteredInventories}
        filteredProductionRecords={filteredProductionRecords}
        calvingRecords={calvingRecords}
      />

      {/* Main Unified Navigation Tabs */}
      <div className={cn("space-y-2 pb-1", isFocusedProductionHistory && "hidden")}>
        <div
          ref={tabsContainerRef}
          onScroll={updateScrollMetrics}
          onWheel={handleTabsWheel}
          className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1"
        >
          <button
            type="button"
            onClick={(e) => handleMainTabSelect("production", e)}
            className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer ${
              activeMainTab === "production"
                ? "bg-emerald-800 text-white shadow-emerald-950/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <Milk className="size-4" />
            <span>Daily Yield Logs</span>
            {filteredProductionRecords.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeMainTab === "production"
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {filteredProductionRecords.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => handleMainTabSelect("breeding", e)}
            className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer ${
              activeMainTab === "breeding"
                ? "bg-emerald-800 text-white shadow-emerald-950/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <HeartHandshake className="size-4" />
            <span>Breeding & Insemination</span>
          </button>

          <button
            type="button"
            onClick={(e) => handleMainTabSelect("calving", e)}
            className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer ${
              activeMainTab === "calving"
                ? "bg-emerald-800 text-white shadow-emerald-950/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <Baby className="size-4" />
            <span>{terms.eventName} & Offspring</span>
            {calvingRecords.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeMainTab === "calving"
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {calvingRecords.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => handleMainTabSelect("weights", e)}
            className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer ${
              activeMainTab === "weights"
                ? "bg-emerald-800 text-white shadow-emerald-950/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <Scale className="size-4" />
            <span>Growth & ADG Tracker</span>
          </button>

          <button
            type="button"
            onClick={(e) => handleMainTabSelect("feedings", e)}
            className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer ${
              activeMainTab === "feedings"
                ? "bg-emerald-800 text-white shadow-emerald-950/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <Wheat className="size-4" />
            <span>Feeding & Rations</span>
          </button>

          <button
            type="button"
            onClick={(e) => handleMainTabSelect("treatments", e)}
            className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer ${
              activeMainTab === "treatments"
                ? "bg-emerald-800 text-white shadow-emerald-950/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <Pill className="size-4" />
            <span>Clinical Treatments</span>
            {filteredTreatmentCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeMainTab === "treatments"
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {filteredTreatmentCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => handleMainTabSelect("sales", e)}
            className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer ${
              activeMainTab === "sales"
                ? "bg-emerald-800 text-white shadow-emerald-950/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <ShoppingBag className="size-4" />
            <span>Live Sales & Outlets</span>
          </button>

          <button
            type="button"
            onClick={(e) => handleMainTabSelect("forecasts", e)}
            className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer ${
              activeMainTab === "forecasts"
                ? "bg-emerald-800 text-white shadow-emerald-950/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            <LineChartIcon className="size-4" />
            <span>Herd Forecasting</span>
          </button>
        </div>

        {/* ═══ INTERACTIVE HORIZONTAL SCROLLBAR FOR TABS ═══ */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className={cn(
            "w-full h-1.5 sm:h-2 bg-slate-100 hover:bg-slate-200/70 rounded-full relative transition-all duration-200 select-none group",
            scrollInfo.canScroll ? "cursor-pointer" : "opacity-40 cursor-default"
          )}
          role="scrollbar"
          aria-controls="production-tabs"
          aria-valuenow={Math.round(scrollInfo.thumbLeftPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Horizontal scrollbar for production tabs"
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
      </div>

      {isFocusedProductionHistory && focusedActivity ? (
        <>
          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900">Production overview</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Totals and trends for your {focusedActivity} records.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 rounded-xl border-slate-200 bg-white"
                  onClick={() => router.push(`/production-dashboard/history?type=${focusedActivity}`)}
                >
                  <ClipboardList className="mr-2 size-4" /> View history
                </Button>
                <label htmlFor="production-history-kpi-period">View period</label>
                <select
                  id="production-history-kpi-period"
                  value={showOverallKpis ? "OVERALL" : "MONTH"}
                  onChange={(event) => setShowOverallKpis(event.target.value === "OVERALL")}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                >
                  <option value="OVERALL">All dates</option>
                  <option value="MONTH">By month</option>
                </select>
                {!showOverallKpis && (
                  <input
                    aria-label="KPI month"
                    type="month"
                    value={kpiMonth}
                    max={currentMonth}
                    onChange={(event) => setKpiMonth(event.target.value)}
                    className="h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                  />
                )}
              </div>
            </div>

            {isOverviewLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
              >
                <div className="flex items-center gap-3">
                  <RefreshCw className="size-5 animate-spin text-emerald-700" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">Loading production overview</p>
                    <p className="mt-1 text-xs text-slate-500">Getting your production totals, chart, and review statuses.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[1, 2, 3, 4].map((item) => (
                    <Skeleton key={item} className="h-28 rounded-2xl" />
                  ))}
                </div>
                <Skeleton className="h-[320px] w-full rounded-2xl" />
              </div>
            ) : isRecordsError ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-xs"
              >
                <p className="text-base font-bold text-red-900">Failed to load {focusedActivity} production records</p>
                <p className="mt-1 text-xs text-red-700">
                  {recordsError instanceof Error ? recordsError.message : "A network or server error occurred while retrieving production records."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => refetch()}
                  className="mt-4 rounded-xl border-red-300 bg-white text-xs font-bold text-red-900 hover:bg-red-100"
                >
                  <RefreshCw className="mr-2 size-3.5" /> Retry
                </Button>
              </div>
            ) : (
              <>
                <SpeciesKpiCards
                  species={selectedSpecies}
                  inventories={activityInventories}
                  productionRecords={monthlyKpiProductionRecords}
                  calvingRecords={monthlyKpiCalvingRecords}
                  weightRecords={monthlyKpiWeightRecords}
                  activity={focusedActivity}
                  productionType={focusedActivity as ProductionType}
                />

                {monthlyKpiProductionRecords.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
                    <p className="text-sm font-bold text-slate-700">
                      No {focusedActivity} production records are available for the selected period.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Log a new entry or select a different month or date range to view history.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <ProductionCharts
                      type={focusedActivity as ProductionType}
                      data={analytics.by_type[focusedActivity as ProductionType] ?? EMPTY_TYPE_ANALYTICS}
                    />

                    <div className="pt-2">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <ClipboardList className="size-4.5 text-emerald-700" />
                            <span>
                              {selectedSpecies === "ALL" ? "" : `${selectedSpecies} `}
                              {PRODUCTION_TYPE_LABELS[focusedActivity as ProductionType] ?? "Production"} Records History
                            </span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Individual submitted daily yield entries, shift sessions, and review verification logs.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <ProductionHistory
                          initialTypeFilter={focusedActivity as ProductionType}
                          speciesFilter={selectedSpecies}
                          hideTypeFilter
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      ) : null}

      {shouldRenderFocusedTab && !isFocusedProductionHistory && <>
      {/* Tab 1: Daily Yield Logs */}
      {activeMainTab === "production" && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                {showOverallKpis ? "Overall KPI Summary" : "Monthly KPI Summary"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {showOverallKpis
                  ? "Production, births, and weighings include all dates. Inventory counts show the current roster."
                  : "Production, births, and weighings use this month. Inventory counts show the current roster."}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
              <label htmlFor="production-kpi-period">View period</label>
              <select
                id="production-kpi-period"
                value={showOverallKpis ? "OVERALL" : "MONTH"}
                onChange={(event) => setShowOverallKpis(event.target.value === "OVERALL")}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
              >
                <option value="MONTH">By month</option>
                <option value="OVERALL">Overall (all dates)</option>
              </select>
              {!showOverallKpis && (
                <input
                  aria-label="KPI month"
                  type="month"
                  value={kpiMonth}
                  max={currentMonth}
                  onChange={(event) => setKpiMonth(event.target.value)}
                  className="h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                />
              )}
            </div>
          </div>

          {/* Date-based KPI totals use the selected period; inventory counts remain current. */}
          <SpeciesKpiCards
            species={selectedSpecies}
            inventories={filteredInventories}
            productionRecords={monthlyKpiProductionRecords}
            calvingRecords={monthlyKpiCalvingRecords}
            weightRecords={monthlyKpiWeightRecords}
            activity={activeProductionType}
            productionType={activeProductionType}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <ProductionTypeSelector
              types={allowedProductionTypes}
              selected={activeProductionType}
              onSelect={handleTypeSelect}
            />
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="gap-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 border-slate-200 hover:bg-slate-50 cursor-pointer h-10 px-4 active:scale-95 transition-all shadow-xs"
              >
                <RefreshCw className={`size-4.5 ${isRefetching ? "animate-spin" : ""}`} />
                <span>Refresh Feed</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleOpenNewWizard}
                className="gap-1.5 rounded-xl text-xs font-black bg-[#2D5A27] hover:bg-[#23471f] text-white shadow-xs cursor-pointer h-9 px-3.5"
              >
                <Plus className="size-4" />
                <span>{quickLogLabel}</span>
              </Button>
            </div>
          </div>

          {isRecordsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ProductionCharts
                  type={activeProductionType}
                  data={analytics.by_type[activeProductionType] ?? EMPTY_TYPE_ANALYTICS}
                />
              </div>

              <div className="space-y-6">
                <ProductionRecent
                  records={filteredProductionRecords}
                  onEdit={handleOpenEditWizard}
                  onDelete={(record) => setDeleteTarget(record)}
                />

                <Card className="border-slate-200 shadow-xs rounded-3xl overflow-hidden bg-slate-50/60">
                  <CardContent className="p-5 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                      <ShieldCheck className="size-4 text-emerald-700" />
                      <span>Personal Production Records</span>
                    </div>
                    <p className="text-slate-500 leading-relaxed">
                      Submitted daily yields and {terms.eventName.toLowerCase()} records are
                      saved in your own farm history. Official livestock and incident reports follow their separate municipal workflows.
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-600 font-semibold border-t border-slate-200/60">
                      <span>Legacy review statuses:</span>
                      <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                        {legacyReviewStatusCount} historical records
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Breeding & Insemination Tracker */}
      {activeMainTab === "breeding" && (
        <ProductionBreedingTab
          approvedInventories={focusedActivity ? activityInventories : approvedInventories}
          selectedSpecies={selectedSpecies}
          autoOpen={focusedActivity === "breeding" && focusedMode === "record"}
        />
      )}

      {/* Tab 2: Birthing & Offspring Registry */}
      {activeMainTab === "calving" && (
        <ProductionCalvingTab
          approvedInventories={focusedActivity ? activityInventories : approvedInventories}
          selectedSpecies={selectedSpecies}
          autoOpen={focusedActivity === "calving" && focusedMode === "record"}
        />
      )}

      {/* Tab 3: Weight & Growth Tracker */}
      {activeMainTab === "weights" && (
        <ProductionWeightTab
          approvedInventories={focusedActivity ? activityInventories : filteredInventories}
          selectedSpecies={selectedSpecies || undefined}
          autoOpen={focusedActivity === "weights" && focusedMode === "record"}
        />
      )}

      {/* Tab: Feeding & Rations Tracker */}
      {activeMainTab === "feedings" && (
        <ProductionFeedingTab
          approvedInventories={focusedActivity ? activityInventories : approvedInventories}
          selectedSpecies={selectedSpecies}
          autoOpen={Boolean(["feedings", "feeding"].includes(focusedActivity ?? "") && focusedMode === "record")}
        />
      )}

      {/* Tab: Clinical Treatments & Veterinary Care */}
      {activeMainTab === "treatments" && (
        <ProductionTreatmentsTab
          approvedInventories={focusedActivity ? activityInventories : approvedInventories}
          selectedSpecies={selectedSpecies}
          autoOpen={Boolean(["treatments", "treatment"].includes(focusedActivity ?? "") && focusedMode === "record")}
          onClose={returnToActivityChooser}
        />
      )}

      {/* Tab 4: Live Animal Sales & Commercial Outlets */}
      {activeMainTab === "sales" && (
        <ProductionSalesTab
          intentInventories={activeIntentInventories}
          autoOpenIntent={(["sales", "intent"].includes(focusedActivity ?? "")) && focusedMode === "record"}
        />
      )}

      {/* Tab 5: Forecasts & Analytics */}
      {activeMainTab === "forecasts" && (
        <ProductionForecastsTab
          inventories={filteredInventories}
          records={filteredProductionRecords}
        />
      )}

      </>}

      {/* Preserved Production Entry Wizard (modal) */}
      <ProductionWizard
        productionType={activeProductionType}
        onTypeChange={handleTypeSelect}
        clickedInventory={clickedInventory}
        onSelectInventory={setClickedInventory}
        formState={formState}
        onFieldChange={handleFieldChange}
        approvedInventories={focusedActivity ? activityInventories : approvedInventories}
        isLoading={isInventoryLoading}
        isSubmitting={submitMutation.isPending || updateMutation.isPending}
        resetSignal={resetSignal}
        onSubmit={handleProductionSubmit}
        open={isWizardOpen}
        onClose={handleWizardClose}
        mode={editingRecord ? "edit" : "create"}
        editingRecord={editingRecord}
        productionRecords={productionRecords}
        isLoadingProductionRecords={isRecordsLoading}
        fixedProductionType={
          focusedActivity && ["milk", "meat", "eggs", "wool"].includes(focusedActivity)
            ? focusedActivity as ProductionType
            : undefined
        }
      />

      <ProductionDeleteDialog
        record={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
      <ProductionSubmissionSuccessDialog
        open={isSubmissionSuccessOpen}
        onOpenChange={setIsSubmissionSuccessOpen}
        recordId={submittedProductionId}
      />
      <AlertDialog
        open={diseaseWarning !== null}
        onOpenChange={(open) => !open && setDiseaseWarning(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-amber-100 text-amber-800 sm:mx-0">
              <AlertTriangle className="size-5" />
            </div>
            <AlertDialogTitle>Disease report on this livestock</AlertDialogTitle>
            <AlertDialogDescription>
              {diseaseWarning?.lookupFailed
                ? "We could not check this animal’s disease reports, so production recording is temporarily unavailable. Please try again."
                : diseaseWarning?.blocked
                  ? "This animal has a disease report verified by SIBAT, so it cannot be selected for a production record."
                  : "This animal has a disease report pending review. You can continue recording, and the disease report will remain pending."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {diseaseWarning && !diseaseWarning.lookupFailed && (
            <ul className="max-h-36 space-y-2 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              {diseaseWarning.reports.map((report) => (
                <li key={report.id} className="flex items-start justify-between gap-3">
                  <span className="font-medium text-amber-950">{report.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-amber-800">
                    {report.status === "VERIFIED" ? "SIBAT verified" : "Pending review"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            {!diseaseWarning?.blocked && (
              <AlertDialogAction
                className="bg-amber-700 text-white hover:bg-amber-800"
                onClick={() => {
                  if (diseaseWarning) submitMutation.mutate(diseaseWarning.payload);
                  setDiseaseWarning(null);
                }}
              >
                Yes, continue recording
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
