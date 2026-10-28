"use client";

import { httpError } from "@/lib/http-error";
import { printElement } from "@/lib/print-element";
import type { ProductionRecordItem, ProductionType } from "@/app/(farmer)/production-dashboard/production-analytics";
import {
getBirthingTerminology,
type CalvingRecordItem,
} from "@/app/(farmer)/production-dashboard/production-calving-tab";
import type { ProductionFormState } from "@/app/(farmer)/production-dashboard/production-form-fields";
import ProductionWizard,{
getProductionTypesForLivestock,
type ProductionPayload,
} from "@/app/(farmer)/production-dashboard/production-wizard";
import { PageHeader } from "@/app/components/page-header";
import { LivestockBreedField } from "@/components/livestock-breed-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/components/ui/tabs";
import { ValidationLoadingScreen,useLoadingScreenTransition } from "@/components/validation-loading-screen";
import api from "@/lib/axios";
import {
formatCalendarDate,
localCalendarDateToday
} from "@/lib/livestock-age";
import { livestockIdentityQrPayload } from "@/lib/livestock-identity";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Baby,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
Download,
Heart,
Info,
Layers,
Milk,
Pill,
Plus,
Printer,
Scale,
ShieldCheck,
Stethoscope,
Syringe,
Target,
  Trash2,
  TrendingUp,
  Wheat,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams,useRouter } from "next/navigation";
import QRCode from "qrcode";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
CartesianGrid,
Line,
LineChart,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";
import { toast } from "sonner";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { markTutorialSeen, shouldAutoStartTutorial, startGuidedTutorial } from "@/lib/tutorial-preferences";
import ProductionSubmissionSuccessDialog from "../../production-dashboard/production-submission-success-dialog";
import { LivestockInfographicHero } from "../components/livestock-infographic-hero";
import { LivestockLineageTree } from "../components/livestock-lineage-tree";
import { LivestockSlidingPanel } from "../components/livestock-sliding-panel";
import LivestockEditDialog from "../livestock-edit-dialog";
import {
getAvatarById,
useLivestockTypes,
useUserInventory,
type LivestockInventoryItem,
type UpdateInventoryPayload,
} from "../livestock-inventory";
import { LivestockMilkForecastTab } from "../livestock-milk-forecast-tab";
import { LivestockPhotoManager } from "../livestock-photo-manager";
import { OwnershipTransferPanel } from "../ownership-transfer-panel";

const PRODUCTION_TYPE_CODES = {
  milk: "MILK",
  meat: "MEAT",
  eggs: "EGGS",
  wool: "WOOL",
} as const;

interface WeightLog {
  id?: number;
  date: string;
  weight: number;
  gain: number;
  adg: number;
  notes: string;
}

interface ProductionLog {
  id: number;
  date: string;
  type: string;
  quantity: number;
  unit: string;
  status: string;
  notes: string;
}

interface ApiProductionRecord {
  id: number;
  barangay_name?: string | null;
  farmer_name?: string;
  livestock: number;
  livestock_type_name?: string | null;
  production_type?: string;
  quantity: string | number;
  unit: string;
  record_date: string;
  notes?: string;
  status: string;
  review_remarks?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== "object") return fallback;

  const messages = Object.values(data as Record<string, unknown>)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === "string");
  return messages.join(" ") || fallback;
}

interface ApiWeightRecord {
  id: number;
  livestock: number;
  tag_number?: string;
  weight: string | number;
  weighing_date: string;
  notes?: string;
  created_at: string;
}

interface ApiBreedingRecord {
  id: number;
  dam: number;
  breeding_date: string;
  breeding_type: string;
  expected_due_date?: string | null;
  status: "PENDING_CHECK" | "PREGNANT" | "CALVED" | "OPEN" | string;
  sire_tag_or_code?: string;
  notes?: string;
}

interface ApiFeedingRecord {
  id: number;
  livestock?: number | null;
  feeding_date: string;
  feed_type: string;
  feed_name?: string;
  quantity_kg: string | number;
  feeding_time?: string;
  notes?: string;
}

interface ApiDiseaseCase {
  id: number;
  livestock: number;
  name: string;
  affected_count: number;
  record_date?: string | null;
  status: string;
  review_remarks?: string | null;
  created_at: string;
}

export default function LivestockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const rawId = params?.id ? decodeURIComponent(String(params.id)) : "";
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false);
  const { data: livestockTypes = {} } = useLivestockTypes();

  // 1. Fetch user inventories
  const { data: inventories = [], isLoading: isInventoryLoading } = useUserInventory({ includeInactive: true });

  // 2. Direct single-item fetch fallback if numeric ID not found in current inventory list
  const { data: directInventory, isLoading: isDirectLoading } = useQuery({
    queryKey: ["inventory_item", rawId],
    queryFn: async () => {
      if (!rawId || isNaN(Number(rawId))) return null;
      try {
        const res = await api.get(`livestock/inventory/${rawId}/`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: Boolean(rawId && !inventories.some((i) => String(i.id) === rawId || i.tagNumber?.toUpperCase() === rawId.toUpperCase())),
  });

  // Find in inventory
  const inventoryMatch = useMemo(() => {
    return (
      inventories.find(
        (item) =>
          String(item.id) === rawId ||
          (item.tagNumber && item.tagNumber.toUpperCase() === rawId.toUpperCase())
      ) || null
    );
  }, [inventories, rawId]);

  // Unified active inventory item (or null if not found)
  const activeItem = useMemo(() => {
    if (inventoryMatch) return inventoryMatch;
    if (directInventory) {
      return {
        id: String(directInventory.id),
        tagNumber: directInventory.tag_number || `ANIMAL-${directInventory.id}`,
        farmerName: directInventory.farmer_name || "Farmer",
        livestockTypeName: directInventory.livestock_type_name || "Livestock",
        entryType: directInventory.entry_type || "INDIVIDUAL",
        quantity: directInventory.quantity || 1,
        breed: directInventory.breed || "",
        // Keep unknown sex unknown; defaulting to Female would expose the
        // female-cattle prediction tab for records with missing sex data.
        sex: directInventory.sex || "",
        birthDate: directInventory.birth_date ?? null,
        age: directInventory.age ?? null,
        ageClassification: directInventory.age_classification ?? "UNKNOWN",
        weight: directInventory.weight ? Number(directInventory.weight) : null,
        lastVaccinationDate: directInventory.last_vaccination_date || null,
        status: directInventory.status || "APPROVED",
        operationalStatus: directInventory.operational_status || "ACTIVE",
        operationalStatusChangedAt: directInventory.operational_status_changed_at || null,
        reviewRemarks: directInventory.review_remarks || null,
        reviewedByName: directInventory.reviewed_by_name || null,
        reviewedAt: directInventory.reviewed_at || null,
        createdAt: directInventory.created_at || new Date().toISOString(),
        photoUrl: directInventory.photo_url || null,
        leftSidePhotoUrl: directInventory.left_side_photo_url || directInventory.left_side_photo || null,
        rightSidePhotoUrl: directInventory.right_side_photo_url || directInventory.right_side_photo || null,
        avatarKey: directInventory.avatar_key || null,
        batchId: directInventory.batch || null,
        batchCode: directInventory.batch_code || null,
        batchName: directInventory.batch_name || null,
        batchTargetWeight: directInventory.batch_target_weight ? Number(directInventory.batch_target_weight) : null,
      } as LivestockInventoryItem;
    }
    return null;
  }, [inventoryMatch, directInventory]);

  useEffect(() => {
    if (!activeItem?.id || !shouldAutoStartTutorial("smartlivestock-livestock-profile-tour")) return;

    const timer = window.setTimeout(() => {
      const isMobile = window.matchMedia("(max-width: 1023px)").matches;
      const steps: DriveStep[] = [
        {
          element: '[data-tour="livestock-profile-overview"]',
          popover: {
            title: "Animal profile overview",
            description: "This infographic summarizes the selected animal’s identity, status, and available actions. Use its shortcuts to open the related record section.",
            side: "bottom",
            align: "start",
          },
        },
      ];

      if (activeItem.entryType === "INDIVIDUAL") {
        steps.push({
          element: '[data-tour="livestock-profile-side-photos"]',
          popover: {
            title: "Left and right side photos",
            description: "These views help identify an individual animal. Upload a photo for either side, or remove an existing one; a species avatar appears when a photo is missing.",
            side: "top",
            align: "start",
          },
        });
      }

      steps.push(
        {
          element: isMobile
            ? '[data-tour="profile-tabs-mobile"]'
            : '[data-tour="profile-tabs-desktop"]',
          popover: {
            title: isMobile ? "Switch profile sections" : "Profile sections",
            description: isMobile
              ? "The profile opens in a draggable bottom panel. Swipe or drag its handle to expand it, then use this row to switch sections."
              : "Use these tabs to switch between growth, production, offspring, health, pedigree, and ownership information.",
            side: isMobile ? "top" : "bottom",
            align: "center",
          },
        },
        {
          element: isMobile
            ? '[data-tour="profile-pedigree-tab-mobile"]'
            : '[data-tour="profile-pedigree-tab-desktop"]',
          popover: {
            title: "Pedigree and lineage",
            description: "Choose this section to see recorded parents and offspring in a family tree. It reflects saved birth and inventory links; missing parentage is shown as not recorded.",
            side: isMobile ? "top" : "bottom",
            align: "center",
          },
        },
      );

      markTutorialSeen("smartlivestock-livestock-profile-tour");
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
    }, 700);

    return () => window.clearTimeout(timer);
  }, [activeItem?.id, activeItem?.entryType]);
  const canCorrectIndividual = Boolean(
    activeItem?.status === "SUBJECT_TO_REVISION"
      && activeItem.operationalStatus === "ACTIVE"
      && activeItem.entryType === "INDIVIDUAL"
      && activeItem.quantity === 1
  );
  const isDeceased = activeItem?.operationalStatus === "DECEASED";
  const isSlaughtered = activeItem?.operationalStatus === "SLAUGHTERED";
  const isInactive = isDeceased || isSlaughtered;

  const correctionMutation = useMutation({
    mutationFn: async (payload: UpdateInventoryPayload) => {
      if (!activeItem) throw new Error("No livestock record is selected.");
      if (isInactive) throw new Error(`${isDeceased ? "Deceased" : "Slaughtered"} animals are read-only.`);
      const response = await api.put(`livestock/inventory/${activeItem.id}/`, payload);
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory_item", rawId] }),
      ]);
      setIsCorrectionDialogOpen(false);
      toast.success(
        activeItem?.batchId ? "Corrections saved" : "Corrections resubmitted",
        {
          description: activeItem?.batchId
            ? "Return to the herd page and resubmit the whole herd for review."
            : "Your individual livestock record is back in the review queue.",
        }
      );
    },
    onError: () => toast.error("Could not save your corrections. Please review the fields and try again."),
  });

  const sidePhotoMutation = useMutation({
    mutationFn: async ({ side, file }: { side: "left" | "right"; file: File | null }) => {
      if (!activeItem) throw new Error("Livestock record is not ready.");
      const field = `${side}_side_photo`;
      if (file) {
        const payload = new FormData();
        payload.append(field, file);
        return api.patch(`livestock/inventory/${activeItem.id}/`, payload);
      }
      return api.patch(`livestock/inventory/${activeItem.id}/`, { [field]: null });
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory_item", String(activeItem?.id ?? rawId)] }),
      ]);
      toast.success(variables.file ? `${variables.side === "left" ? "Left" : "Right"} side photo updated.` : `${variables.side === "left" ? "Left" : "Right"} side photo removed.`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not update this side photo.")),
  });

  function handleSidePhotoUpload(side: "left" | "right", event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo exceeds 5 MB. Please choose a smaller image.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type.toLowerCase())) {
      toast.error("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    sidePhotoMutation.mutate({ side, file });
  }

  // 3. Real Weight Records from Backend API
  const { data: allWeightRecords = [] } = useQuery<ApiWeightRecord[]>({
    queryKey: ["production_weights"],
    queryFn: async () => {
      try {
        const res = await api.get("production/weights/");
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(activeItem),
  });

  // 4. Real Production Records (Milk / Meat / Eggs / Wool) from Backend API
  const { data: allProductionRecords = [], isLoading: isProductionRecordsLoading } = useQuery<ApiProductionRecord[]>({
    queryKey: ["production_records"],
    queryFn: async () => {
      try {
        const res = await api.get("production/records/");
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(activeItem),
  });

  // 5. Real Calving / Birthing Records from Backend API
  const { data: allCalvingRecords = [] } = useQuery<CalvingRecordItem[]>({
    queryKey: ["calving_records"],
    queryFn: async () => {
      try {
        const res = await api.get("production/calving/");
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
  });

  const { data: allBreedingRecords = [] } = useQuery<ApiBreedingRecord[]>({
    queryKey: ["breeding_records"],
    queryFn: async () => {
      const res = await api.get("production/breeding/");
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: Boolean(activeItem),
  });

  const { data: allFeedingRecords = [] } = useQuery<ApiFeedingRecord[]>({
    queryKey: ["feeding_records"],
    queryFn: async () => {
      const res = await api.get("production/feedings/");
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: Boolean(activeItem),
  });

  // 6. Real Disease Cases from Backend API
  const { data: allDiseaseCases = [] } = useQuery<ApiDiseaseCase[]>({
    queryKey: ["disease_cases"],
    queryFn: async () => {
      try {
        const res = await api.get("diseases/cases/");
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(activeItem),
  });

  // 7. Real Clinical Treatment Records from Backend API
  const { data: allTreatmentRecords = [], refetch: refetchTreatments } = useQuery<Array<{
    id: number;
    livestock: number;
    livestock_tag?: string;
    treatment_date: string;
    treatment_type: string;
    treatment_type_label?: string;
    medication_name: string;
    reason: string;
    dosage: string;
    route_of_administration: string;
    administered_by: string;
    notes: string;
    follow_up_date: string | null;
    created_at?: string;
  }>>({
    queryKey: ["treatment_records", activeItem?.id],
    queryFn: async () => {
      if (!activeItem?.id) return [];
      try {
        const res = await api.get(`production/treatments/?livestock=${activeItem.id}`);
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(activeItem?.id),
  });

  const animalTreatments = useMemo(() => {
    return [...allTreatmentRecords].sort(
      (a, b) => new Date(b.treatment_date).getTime() - new Date(a.treatment_date).getTime()
    );
  }, [allTreatmentRecords]);

  // Filter weight logs for this specific animal
  const weightLogs: WeightLog[] = useMemo(() => {
    if (!activeItem) return [];
    const animalIdStr = String(activeItem.id);
    const logs = allWeightRecords
      .filter((r) => String(r.livestock) === animalIdStr)
      .sort((a, b) => {
        const dateDifference = new Date(a.weighing_date).getTime() - new Date(b.weighing_date).getTime();
        return dateDifference || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

    if (logs.length === 0) {
      if (activeItem.weight && activeItem.weight > 0) {
        return [
          {
            date: activeItem.createdAt ? activeItem.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
            weight: Number(activeItem.weight),
            gain: 0,
            adg: 0,
            notes: "Initial registration weight baseline",
          },
        ];
      }
      return [];
    }

    return logs.map((log, idx, arr) => {
      const prev = idx > 0 ? arr[idx - 1] : null;
      const currentW = Number(log.weight);
      const prevW = prev ? Number(prev.weight) : currentW;
      const gain = prev ? Math.round((currentW - prevW) * 10) / 10 : 0;
      const days = prev
        ? Math.max(1, (new Date(log.weighing_date).getTime() - new Date(prev.weighing_date).getTime()) / (1000 * 60 * 60 * 24))
        : 14;
      const adg = gain > 0 ? Math.round((gain / days) * 100) / 100 : 0;

      return {
        id: log.id,
        date: log.weighing_date,
        weight: currentW,
        gain: Math.max(0, gain),
        adg: adg,
        notes: log.notes || "Official weigh log",
      };
    });
  }, [allWeightRecords, activeItem]);

  // Latest calculated weight & ADG
  const latestWeight = useMemo(() => {
    if (weightLogs.length > 0) {
      return weightLogs[weightLogs.length - 1].weight;
    }
    return activeItem?.weight || 0;
  }, [weightLogs, activeItem]);

  const latestAdg = useMemo(() => {
    if (weightLogs.length > 1) {
      const first = weightLogs[0];
      const last = weightLogs[weightLogs.length - 1];
      const days = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24));
      const totalGain = last.weight - first.weight;
      if (totalGain > 0) {
        return Math.round((totalGain / days) * 100) / 100;
      }
    }
    return null;
  }, [weightLogs]);

  // Filter production logs for this specific animal
  const canProduceMilk = Boolean(
    activeItem
      && activeItem.entryType === "INDIVIDUAL"
      && getProductionTypesForLivestock(activeItem.livestockTypeName).includes("milk")
      && ["FEMALE", "F"].includes(activeItem.sex.trim().toUpperCase())
      && !["CALF", "YEARLING"].includes(activeItem.ageClassification),
  );
  const productionLogs: ProductionLog[] = useMemo(() => {
    if (!activeItem) return [];
    const animalIdStr = String(activeItem.id);
    return allProductionRecords
      .filter((r) => String(r.livestock) === animalIdStr && (r.production_type !== "MILK" || canProduceMilk))
      .sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime())
      .map((r) => ({
        id: r.id,
        date: r.record_date,
        type: r.production_type === "MILK" ? "Dairy Milk" : r.production_type === "MEAT" ? "Meat Yield" : r.production_type === "EGGS" ? "Eggs" : r.production_type || "Production Output",
        quantity: Number(r.quantity) || 0,
        unit: r.unit === "LITERS" ? "L" : r.unit === "KILOGRAMS" ? "kg" : r.unit === "PIECES" ? "pcs" : r.unit,
        status: r.status,
        notes: r.notes || "Farm production record",
      }));
  }, [allProductionRecords, activeItem, canProduceMilk]);

  // Filter Calving & Birthing progeny records where dam is this animal
  const animalCalvingRecords: CalvingRecordItem[] = useMemo(() => {
    if (!activeItem) return [];
    const animalIdNum = Number(activeItem.id);
    return allCalvingRecords.filter((c) => Number(c.dam) === animalIdNum);
  }, [allCalvingRecords, activeItem]);

  const animalBreedingRecords = useMemo(() => {
    if (!activeItem) return [];
    return allBreedingRecords
      .filter((record) => String(record.dam) === String(activeItem.id))
      .sort((a, b) => b.breeding_date.localeCompare(a.breeding_date));
  }, [allBreedingRecords, activeItem]);

  const animalFeedingRecords = useMemo(() => {
    if (!activeItem) return [];
    return allFeedingRecords
      .filter((record) => String(record.livestock) === String(activeItem.id))
      .sort((a, b) => b.feeding_date.localeCompare(a.feeding_date));
  }, [allFeedingRecords, activeItem]);

  const recentSevenDayProduction = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const rows = productionLogs.filter((record) => {
      const date = new Date(`${record.date}T12:00:00`);
      return date >= start && date <= end;
    });
    return { rows, total: rows.reduce((sum, row) => sum + row.quantity, 0) };
  }, [productionLogs]);

  const breedingFollowUps = useMemo(() => animalBreedingRecords.filter((record) =>
    record.status === "PENDING_CHECK" || record.status === "PREGNANT"
  ), [animalBreedingRecords]);

  // Check if this animal itself was recorded as an offspring in municipal registry
  const selfLineage = useMemo(() => {
    if (!activeItem) return null;
    const tagUpper = activeItem.tagNumber.trim().toUpperCase();
    return allCalvingRecords.find((c) =>
      Number(c.offspring_inventory) === Number(activeItem.id)
      || Boolean(tagUpper && c.calf_tag && c.calf_tag.trim().toUpperCase() === tagUpper)
    ) || null;
  }, [allCalvingRecords, activeItem]);

  // Filter disease cases for this animal
  const animalDiseaseCases: ApiDiseaseCase[] = useMemo(() => {
    if (!activeItem) return [];
    const animalIdStr = String(activeItem.id);
    return allDiseaseCases.filter((d) => String(d.livestock) === animalIdStr);
  }, [allDiseaseCases, activeItem]);

  // Species Terminology for Birthing
  const terms = useMemo(() => {
    return getBirthingTerminology(activeItem?.livestockTypeName);
  }, [activeItem?.livestockTypeName]);

  // Target weight: optional benchmark for market or slaughter readiness
  const [targetWeightOverride, setTargetWeightOverride] = useState<{ id: string; val: number | null } | null>(null);
  const [isTargetWeightDialogOpen, setIsTargetWeightDialogOpen] = useState(false);
  const [targetWeightInput, setTargetWeightInput] = useState<string>("");
  const [weighTargetWeight, setWeighTargetWeight] = useState<string>("");

  const activeItemId = activeItem?.id;
  const activeBatchTargetWeight = activeItem?.batchTargetWeight;

  const targetWeight: number | null = useMemo(() => {
    if (!activeItemId) return null;
    if (targetWeightOverride && targetWeightOverride.id === activeItemId) {
      return targetWeightOverride.val;
    }
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`livestock_target_weight_${activeItemId}`);
      if (stored !== null && stored.trim() !== "") {
        const num = Number(stored);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    if (activeBatchTargetWeight != null && activeBatchTargetWeight > 0) {
      return activeBatchTargetWeight;
    }
    return null;
  }, [activeItemId, activeBatchTargetWeight, targetWeightOverride]);

  // Meat Dressing % calculation
  const meatDressingPct = useMemo(() => {
    const s = (activeItem?.livestockTypeName || "").toLowerCase();
    if (s.includes("cattle") || s.includes("carabao")) return 58;
    if (s.includes("swine") || s.includes("pig")) return 74;
    if (s.includes("poultry")) return 68;
    return 60;
  }, [activeItem?.livestockTypeName]);

  const projectedCarcassKg = Math.round((latestWeight * (meatDressingPct / 100)) * 10) / 10;

  // Dialog States
  const [isWeighDialogOpen, setIsWeighDialogOpen] = useState(false);
  const [isBirthDateDialogOpen, setIsBirthDateDialogOpen] = useState(false);
  const [editBirthDateValue, setEditBirthDateValue] = useState("");
  const [isPassportDialogOpen, setIsPassportDialogOpen] = useState(false);
  const [isProductionDialogOpen, setIsProductionDialogOpen] = useState(false);
  const [isProductionSuccessOpen, setIsProductionSuccessOpen] = useState(false);
  const [submittedProductionId, setSubmittedProductionId] = useState<number | string | null>(null);
  const [isCalvingDialogOpen, setIsCalvingDialogOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState("growth");
  const [isOwnershipFormOpen, setIsOwnershipFormOpen] = useState(false);

  // Treatment Form States & Mutation
  const [isTreatmentDialogOpen, setIsTreatmentDialogOpen] = useState(false);
  const [treatmentDate, setTreatmentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [treatmentType, setTreatmentType] = useState("ANTIBIOTIC");
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [route, setRoute] = useState("Intramuscular (IM)");
  const [treatmentReason, setTreatmentReason] = useState("");
  const [administeredBy, setAdministeredBy] = useState("");
  const [treatmentNotes, setTreatmentNotes] = useState("");
  const [treatmentFollowUpDate, setTreatmentFollowUpDate] = useState("");

  const addTreatmentMutation = useMutation({
    mutationFn: async () => {
      if (!activeItem?.id) throw new Error("No livestock selected");
      const res = await api.post("production/treatments/", {
        livestock: Number(activeItem.id),
        treatment_date: treatmentDate,
        treatment_type: treatmentType,
        medication_name: medicationName,
        dosage,
        route_of_administration: route,
        reason: treatmentReason,
        administered_by: administeredBy,
        notes: treatmentNotes,
        follow_up_date: treatmentFollowUpDate || null,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Clinical treatment record logged successfully!");
      setIsTreatmentDialogOpen(false);
      setMedicationName("");
      setDosage("");
      setTreatmentReason("");
      setTreatmentNotes("");
      setTreatmentFollowUpDate("");
      refetchTreatments();
      queryClient.invalidateQueries({ queryKey: ["treatment_records"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.medication_name || err?.response?.data?.error || "Failed to log treatment.";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    },
  });

  // ═══ Desktop Profile Tabs Horizontal Scrollbar State & Handlers ═══
  const desktopTabsContainerRef = useRef<HTMLDivElement>(null);
  const desktopTrackRef = useRef<HTMLDivElement>(null);
  const isDesktopDraggingRef = useRef(false);
  const desktopDragStartRef = useRef<{ startX: number; startScrollLeft: number }>({ startX: 0, startScrollLeft: 0 });
  const [desktopScrollInfo, setDesktopScrollInfo] = useState({
    canScroll: false,
    thumbWidthPct: 100,
    thumbLeftPct: 0,
  });

  const updateDesktopScrollMetrics = useCallback(() => {
    const el = desktopTabsContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    const canScroll = maxScroll > 1 && scrollWidth > 0;

    if (!canScroll || scrollWidth === 0) {
      setDesktopScrollInfo({ canScroll: false, thumbWidthPct: 100, thumbLeftPct: 0 });
      return;
    }

    const rawRatio = clientWidth / scrollWidth;
    const thumbWidthPct = Math.min(100, Math.max(18, rawRatio * 100));
    const scrollProgress = maxScroll > 0 ? Math.max(0, Math.min(1, scrollLeft / maxScroll)) : 0;
    const thumbLeftPct = scrollProgress * (100 - thumbWidthPct);

    setDesktopScrollInfo({ canScroll: true, thumbWidthPct, thumbLeftPct });
  }, []);

  useEffect(() => {
    const el = desktopTabsContainerRef.current;
    if (!el) return;

    const rafId = requestAnimationFrame(() => {
      updateDesktopScrollMetrics();
    });

    const ro = new ResizeObserver(() => {
      updateDesktopScrollMetrics();
    });
    ro.observe(el);
    Array.from(el.children).forEach((child) => {
      ro.observe(child);
      if (child.children) {
        Array.from(child.children).forEach((grandchild) => ro.observe(grandchild));
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [updateDesktopScrollMetrics, activeProfileTab, animalTreatments.length]);

  const handleDesktopThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = desktopTabsContainerRef.current;
    if (!el) return;

    isDesktopDraggingRef.current = true;
    desktopDragStartRef.current = {
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleDesktopThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDesktopDraggingRef.current) return;
    const el = desktopTabsContainerRef.current;
    const track = desktopTrackRef.current;
    if (!el || !track) return;

    const deltaX = e.clientX - desktopDragStartRef.current.startX;
    const trackWidth = track.clientWidth;
    const thumbWidthPx = (desktopScrollInfo.thumbWidthPct / 100) * trackWidth;
    const scrollableTrack = trackWidth - thumbWidthPx;
    const scrollableTabs = el.scrollWidth - el.clientWidth;

    if (scrollableTrack > 0 && scrollableTabs > 0) {
      const scrollDelta = (deltaX / scrollableTrack) * scrollableTabs;
      el.scrollLeft = desktopDragStartRef.current.startScrollLeft + scrollDelta;
    }
  };

  const handleDesktopThumbPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDesktopDraggingRef.current) {
      isDesktopDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleDesktopTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDesktopDraggingRef.current) return;
    const el = desktopTabsContainerRef.current;
    const track = desktopTrackRef.current;
    if (!el || !track || !desktopScrollInfo.canScroll) return;

    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const trackWidth = rect.width;
    const thumbWidthPx = (desktopScrollInfo.thumbWidthPct / 100) * trackWidth;
    const scrollableTrack = trackWidth - thumbWidthPx;
    const scrollableTabs = el.scrollWidth - el.clientWidth;

    if (scrollableTrack > 0 && scrollableTabs > 0) {
      const targetRatio = Math.max(0, Math.min(1, (clickX - thumbWidthPx / 2) / scrollableTrack));
      el.scrollTo({ left: targetRatio * scrollableTabs, behavior: "smooth" });
    }
  };

  const handleDesktopTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = desktopTabsContainerRef.current;
    if (!el || !desktopScrollInfo.canScroll) return;

    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += e.deltaY;
    }
  };

  const handleSelectProfileTab = (tabValue: string, e?: React.MouseEvent) => {
    setActiveProfileTab(tabValue);
    if (e?.currentTarget) {
      (e.currentTarget as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  };
  const [livestockQrResult, setLivestockQrResult] = useState<{
    animalId: string;
    dataUrl: string | null;
    failed: boolean;
  } | null>(null);
  const qrAnimalId = activeItem?.id;
  const canHaveLivestockQr = activeItem?.entryType === "INDIVIDUAL" && activeItem.quantity === 1;
  const livestockQrDataUrl = canHaveLivestockQr && livestockQrResult?.animalId === qrAnimalId
    ? livestockQrResult?.dataUrl || ""
    : "";
  const livestockQrError = canHaveLivestockQr
    && livestockQrResult?.animalId === qrAnimalId
    && livestockQrResult?.failed === true;

  useEffect(() => {
    if (!qrAnimalId || !canHaveLivestockQr) return;

    let mounted = true;
    // The QR carries only the stable inventory key; the authenticated lookup
    // resolves it and applies current ownership, scope, and eligibility rules.
    void QRCode.toDataURL(livestockIdentityQrPayload(qrAnimalId), {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#064E3B", light: "#FFFFFF" },
    }).then((dataUrl) => {
      if (mounted) setLivestockQrResult({ animalId: qrAnimalId, dataUrl, failed: false });
    }).catch(() => {
      if (mounted) setLivestockQrResult({ animalId: qrAnimalId, dataUrl: null, failed: true });
    });

    return () => { mounted = false; };
  }, [canHaveLivestockQr, qrAnimalId]);

  // Form States: Weight
  const [newWeight, setNewWeight] = useState(String(latestWeight || "70.0"));
  const [weighDate, setWeighDate] = useState(new Date().toISOString().split("T")[0]);
  const [weighNotes, setWeighNotes] = useState("Routine weigh check");

  // Form States: Production
  const availableProductionTypes = useMemo(
    () => getProductionTypesForLivestock(activeItem?.livestockTypeName)
      .filter((type) => type !== "milk" || canProduceMilk)
      .map((type) => PRODUCTION_TYPE_CODES[type]),
    [activeItem?.livestockTypeName, canProduceMilk],
  );
  const [profileProductionType, setProfileProductionType] = useState<ProductionType>("milk");
  const [profileProductionForm, setProfileProductionForm] = useState<ProductionFormState>({});
  const [productionWizardResetSignal, setProductionWizardResetSignal] = useState(0);
  const openProductionDialog = () => {
    if (isInactive || !canProduceMilk) return;
    if (availableProductionTypes.length > 0) {
      const defaultType = availableProductionTypes.includes("MILK") ? "MILK" : availableProductionTypes[0];
      setProfileProductionType(defaultType.toLowerCase() as ProductionType);
    }
    setProfileProductionForm({
      prodDate: localCalendarDateToday(),
      milkTime: "Morning",
      collectionTime: "Morning",
      meatPurpose: "Auction / Market Sale",
      notes: "",
    });
    setProductionWizardResetSignal((value) => value + 1);
    setIsProductionDialogOpen(true);
  };

  // Form States: Calving / Birthing
  const [newCalfData, setNewCalfData] = useState({
    tag: "",
    sex: "FEMALE" as "FEMALE" | "MALE",
    birthWeight: "",
    sireTag: "",
    breed: "",
    date: new Date().toISOString().split("T")[0],
    ease: "Normal / Unassisted",
    notes: "",
  });

  // ── MUTATIONS (SAVING TO REAL BACKEND) ───────────────────────────────────

  // 1. Save Weight Record -> POST /api/production/weights/
  const logWeightMutation = useMutation({
    mutationFn: async (payload: {
      livestock: number;
      weight: number;
      weighing_date: string;
      notes?: string;
    }) => {
      if (isInactive) throw new Error(`${isDeceased ? "Deceased" : "Slaughtered"} animals are read-only.`);
      const res = await api.post("production/weights/", payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Weight updated: ${data.weight} kg for Tag #${activeItem?.tagNumber || activeItem?.id}`);
      setIsWeighDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["production_weights"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_item", rawId] });
    },
    onError: (err: unknown) => {
      const data = httpError(err)?.response?.data as Record<string, unknown> | undefined;
      let msg = "Failed to save weight record.";
      if (typeof data?.error === "string") {
        msg = data.error;
      } else if (typeof data?.detail === "string") {
        msg = data.detail;
      } else if (Array.isArray(data?.livestock) && data.livestock[0]) {
        msg = String(data.livestock[0]);
      } else if (Array.isArray(data?.weight) && data.weight[0]) {
        msg = String(data.weight[0]);
      } else if (data && typeof data === "object") {
        const firstVal = Object.values(data)[0];
        if (Array.isArray(firstVal) && firstVal[0]) {
          msg = String(firstVal[0]);
        } else if (typeof firstVal === "string") {
          msg = firstVal;
        }
      }
      toast.error(msg);
    },
  });

  const updateBirthDateMutation = useMutation({
    mutationFn: async (birthDateStr: string | null) => {
      if (!activeItem) throw new Error("No livestock record selected.");
      if (isInactive) throw new Error(`${isDeceased ? "Deceased" : "Slaughtered"} animals are read-only.`);
      const res = await api.patch(`livestock/inventory/${activeItem.id}/`, {
        birth_date: birthDateStr || null,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        data.birth_date
          ? `Birth date updated to ${formatCalendarDate(data.birth_date)}`
          : "Birth date cleared."
      );
      setIsBirthDateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_item", rawId] });
    },
    onError: (err: unknown) => {
      const data = httpError(err)?.response?.data as Record<string, unknown> | undefined;
      let msg = "Failed to update birth date.";
      if (typeof data?.error === "string") msg = data.error;
      else if (typeof data?.detail === "string") msg = data.detail;
      else if (Array.isArray(data?.birth_date) && data.birth_date[0]) msg = String(data.birth_date[0]);
      toast.error(msg);
    },
  });

  const handleAddWeight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    if (isInactive) return;
    const val = parseFloat(newWeight);
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid weight in kilograms.");
      return;
    }

    if (activeItem.id && typeof window !== "undefined") {
      const parsedTarget = parseFloat(weighTargetWeight);
      if (!isNaN(parsedTarget) && parsedTarget > 0) {
        localStorage.setItem(`livestock_target_weight_${activeItem.id}`, String(parsedTarget));
        setTargetWeightOverride({ id: activeItem.id, val: parsedTarget });
      } else if (weighTargetWeight.trim() === "") {
        localStorage.removeItem(`livestock_target_weight_${activeItem.id}`);
        setTargetWeightOverride({ id: activeItem.id, val: null });
      }
    }

    logWeightMutation.mutate({
      livestock: Number(activeItem.id),
      weight: val,
      weighing_date: weighDate,
      notes: weighNotes.trim() || undefined,
    });
  };

  // 2. Save Production Record -> POST /api/production/records/
  const logProductionMutation = useMutation({
    mutationFn: async (payload: {
      livestock: number;
      production_type: string;
      quantity: number;
      unit: string;
      record_date: string;
      notes?: string;
    }) => {
      if (isInactive) throw new Error(`${isDeceased ? "Deceased" : "Slaughtered"} animals are read-only.`);
      if (payload.production_type === "MILK" && !canProduceMilk) {
        throw new Error("Milk production can only be recorded for a female animal.");
      }
      const res = await api.post("production/records/", payload);
      return res.data;
    },
    onSuccess: (data) => {
      setSubmittedProductionId(data?.id ?? null);
      setIsProductionSuccessOpen(true);
      setIsProductionDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["production_records"] });
      queryClient.invalidateQueries({ queryKey: ["production"] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, "Failed to save production record."));
    },
  });

  // 3. Save Calving Record -> POST /api/production/calving/
  const recordCalvingMutation = useMutation({
    mutationFn: async (payload: {
      dam: number;
      calf_tag: string;
      calf_sex: "MALE" | "FEMALE";
      birth_weight: number | null;
      sire_tag: string;
      calving_date: string;
      breed: string;
      calving_ease: string;
      notes: string;
    }) => {
      if (isInactive) throw new Error(`${isDeceased ? "Deceased" : "Slaughtered"} animals are read-only.`);
      const res = await api.post("production/calving/", payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`${terms.eventName} & birth record logged successfully!`, {
        description: `Offspring ${data.calf_tag || "progeny"} registered to Dam #${activeItem?.tagNumber}.`,
      });
      setIsCalvingDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["calving_records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setNewCalfData({
        tag: "",
        sex: "FEMALE",
        birthWeight: "",
        sireTag: "",
        breed: "",
        date: new Date().toISOString().split("T")[0],
        ease: "Normal / Unassisted",
        notes: "",
      });
    },
    onError: (err: unknown) => {
      const msg = httpError(err)?.response?.data?.calving_date?.[0] || httpError(err)?.response?.data?.error || httpError(err)?.response?.data?.non_field_errors?.[0] || `Failed to record ${terms.eventName.toLowerCase()} details.`;
      toast.error(msg);
    },
  });

  const handleRecordCalving = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    if (isInactive) return;
    if (newCalfData.date > localCalendarDateToday()) {
      toast.error("Calving / birth date cannot be in the future.");
      return;
    }
    const generatedTag = newCalfData.tag.trim() || `${terms.offspringName.toUpperCase()}-${Date.now().toString().slice(-4)}`;

    recordCalvingMutation.mutate({
      dam: Number(activeItem.id),
      calf_tag: generatedTag,
      calf_sex: newCalfData.sex,
      birth_weight: newCalfData.birthWeight ? parseFloat(newCalfData.birthWeight) : null,
      sire_tag: newCalfData.sireTag.trim(),
      calving_date: newCalfData.date,
      breed: newCalfData.breed.trim() || activeItem.breed || "Standard Breed",
      calving_ease: newCalfData.ease,
      notes: newCalfData.notes.trim(),
    });
  };

  // Avatar and photo
  const localPhoto = typeof window !== "undefined" ? localStorage.getItem(`livestock_photo_${activeItem?.id || activeItem?.tagNumber}`) : null;
  const localAvatar = typeof window !== "undefined" ? localStorage.getItem(`livestock_avatar_${activeItem?.id || activeItem?.tagNumber}`) : null;
  const photoUrl = activeItem?.photoUrl || localPhoto;
  const avatar = getAvatarById(activeItem?.avatarKey || localAvatar, activeItem?.livestockTypeName);
  const speciesImageUrl = /carabao|buffalo/i.test(activeItem?.livestockTypeName || "")
    ? "/images/species-carabao.jpg"
    : null;
  const normalizedLivestockType = activeItem?.livestockTypeName?.toLowerCase() || "";
  // Milk forecasting is currently supported for individually identified female cattle and carabao.
  // The backend still decides whether its status, age, and approved history
  // are sufficient to return a forecast.
  const canShowMilkPredictionTab = Boolean(
    activeItem
      && ["cattle", "cow", "baka", "carabao", "buffalo"].some((term) => normalizedLivestockType.includes(term))
      && activeItem.operationalStatus === "ACTIVE"
      && activeItem.entryType === "INDIVIDUAL"
      && activeItem.quantity === 1
      && canProduceMilk
      && ["FEMALE", "F"].includes(activeItem.sex.trim().toUpperCase())
  );

  const effectiveProfileTab = useMemo(() => {
    if (!canShowMilkPredictionTab && activeProfileTab === "milk-prediction") return "growth";
    if (!canProduceMilk && activeProfileTab === "production") return "growth";
    return activeProfileTab;
  }, [activeProfileTab, canShowMilkPredictionTab, canProduceMilk]);

  // Calving stats
  const totalCalves = animalCalvingRecords.length;
  const femaleCalves = animalCalvingRecords.filter((c) => c.calf_sex === "FEMALE").length;
  const maleCalves = animalCalvingRecords.filter((c) => c.calf_sex === "MALE").length;
  const avgBirthWeight =
    animalCalvingRecords.filter((c) => c.birth_weight).length > 0
      ? (
        animalCalvingRecords.reduce((acc, c) => acc + (Number(c.birth_weight) || 0), 0) /
        animalCalvingRecords.filter((c) => c.birth_weight).length
      ).toFixed(1)
      : "—";

  // Tab items for mobile draggable sliding panel & desktop tabs
  const tabItems = useMemo(
    () => [
      {
        id: "growth",
        label: "Growth & Weight",
        icon: <TrendingUp className="size-3.5 text-emerald-600" />,
      },
      ...(canProduceMilk
        ? [{
            id: "production",
            label: "Production",
            icon: <Milk className="size-3.5 text-sky-600" />,
          }]
        : []),
      ...(canShowMilkPredictionTab
        ? [
            {
              id: "milk-prediction",
              label: "Milk Prediction",
              icon: <Milk className="size-3.5 text-amber-500" />,
            },
          ]
        : []),
      {
        id: "calving",
        label: `${terms.eventName} & Offspring`,
        count: totalCalves,
        icon: <Baby className="size-3.5 text-pink-600" />,
      },
      {
        id: "breeding",
        label: "Breeding",
        count: breedingFollowUps.length > 0 ? breedingFollowUps.length : undefined,
        icon: <CalendarClock className="size-3.5 text-indigo-600" />,
      },
      {
        id: "feeding",
        label: "Feeding",
        count: animalFeedingRecords.length > 0 ? animalFeedingRecords.length : undefined,
        icon: <Wheat className="size-3.5 text-amber-600" />,
      },
      {
        id: "health",
        label: "Health & Vaccines",
        icon: <Stethoscope className="size-3.5 text-rose-600" />,
      },
      {
        id: "treatments",
        label: "Treatments",
        count: animalTreatments.length > 0 ? animalTreatments.length : undefined,
        icon: <Pill className="size-3.5 text-teal-600" />,
      },
      {
        id: "pedigree",
        label: "Pedigree & Lineage",
        icon: <Heart className="size-3.5 text-purple-600" />,
      },
      {
        id: "ownership",
        label: "Ownership History",
        icon: <Layers className="size-3.5 text-slate-600" />,
      },
    ],
    [canProduceMilk, canShowMilkPredictionTab, terms.eventName, totalCalves, breedingFollowUps.length, animalFeedingRecords.length, animalTreatments.length]
  );

  // Loading state
  const isGlobalLoading = isInventoryLoading || isDirectLoading;
  const keepLoadingScreenMounted = useLoadingScreenTransition(isGlobalLoading);

  if (isGlobalLoading || keepLoadingScreenMounted) {
    return (
      <>
        <PageHeader
          title="Livestock Profile"
          subtitle="Individual animal details and production records"
          variant="farmer"
          maxWidthClass="w-full"
        />
        <div className="w-full p-3 sm:p-4 md:p-6">
          <ValidationLoadingScreen
            isLoading={isGlobalLoading}
            title="Loading Livestock Profile"
            subtitle="Retrieving this animal’s registration details and checking the farmer’s livestock records..."
            badgeLabel="Animal Record Sync"
            authorityText="SmartLivestock · Padre Garcia"
            items={[
              {
                id: "inventory",
                label: "Farmer Livestock Records",
                sublabel: "Finding the animal in the current inventory",
                loaded: !isInventoryLoading,
              },
              {
                id: "animal",
                label: "Individual Animal Profile",
                sublabel: "Loading the selected animal record when needed",
                loaded: !isDirectLoading,
              },
            ]}
          />
        </div>
      </>
    );
  }

  // Not Found State (Graceful, no dummy fallback)
  if (!activeItem) {
    return (
      <>
        <PageHeader
          title="Animal Not Found"
          subtitle="This animal could not be found in your livestock list."
          variant="farmer"
          maxWidthClass="w-full"
        />
        <div className="p-4 md:p-8 w-full max-w-3xl mx-auto text-center space-y-4 py-16">
          <div className="size-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <AlertTriangle className="size-8" />
          </div>
          <h3 className="text-xl font-black text-slate-900">Animal Record Not Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            No animal with ID or tag &ldquo;{rawId}&rdquo; was found in your active inventory. It may have been harvested, sold, or moved to another herd.
          </p>
          <div className="pt-2">
            <Link href="/livestock-inventory">
              <Button className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5">
                <ArrowLeft className="size-3.5" /> Back to My Livestock
              </Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Animal: ${activeItem.tagNumber || `ID #${activeItem.id}`}`}
        subtitle={`Animal details and production records`}
        variant="farmer"
        maxWidthClass="w-full"
      />

      {isDeceased && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-slate-700 md:mx-6 xl:mx-8" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-stone-600" />
          <p className="text-sm font-semibold">Deceased record — read-only. Production, weight, calving, and correction actions are disabled; existing history remains available.</p>
        </div>
      )}

      {isSlaughtered && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-stone-300 bg-stone-100 px-4 py-3 text-slate-700 md:mx-6 xl:mx-8" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-stone-600" />
          <p className="text-sm font-semibold">Slaughtered record — read-only. Production, weight, calving, and correction actions are disabled; existing history remains available.</p>
        </div>
      )}

      <div className={`w-full max-w-none space-y-6 p-4 md:p-6 xl:p-8 pb-36 lg:pb-8 ${isInactive ? "grayscale-[0.75]" : ""}`}>
        {canCorrectIndividual && !isInactive && (
          <section className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-950 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-labelledby="livestock-revision-title">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 id="livestock-revision-title" className="font-bold">Changes requested for this livestock record</h2>
                <p className="mt-1 break-words text-sm text-rose-900">
                  {activeItem.reviewRemarks || "Please review and correct the livestock information."}
                </p>
                <p className="mt-1 text-xs text-rose-800">
                  {activeItem.batchId
                    ? "After saving, return to the herd page and resubmit the whole herd."
                    : "Saving your corrections will send this individual record back for review."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => setIsCorrectionDialogOpen(true)}
              className="min-h-11 w-full shrink-0 bg-rose-700 font-semibold text-white hover:bg-rose-800 sm:w-auto"
            >
              Make Corrections
            </Button>
          </section>
        )}

        {/* ── INTERACTIVE LIVESTOCK SILHOUETTE INFOGRAPHIC HERO ── */}
        <div data-tour="livestock-profile-overview" className={isInactive ? "pointer-events-none grayscale opacity-75" : undefined} aria-disabled={isInactive}>
        <LivestockInfographicHero
          activeItem={activeItem}
          latestWeight={latestWeight}
          latestAdg={latestAdg}
          targetWeight={targetWeight}
          projectedCarcassKg={projectedCarcassKg}
          meatDressingPct={meatDressingPct}
          totalCalves={totalCalves}
          activeDiseaseCount={animalDiseaseCases.length}
          terms={terms}
          canShowProduction={canProduceMilk}
          onOpenPassport={() => setIsPassportDialogOpen(true)}
          onOpenBirthDate={() => {
            setEditBirthDateValue(activeItem?.birthDate || "");
            setIsBirthDateDialogOpen(true);
          }}
          onOpenWeigh={() => {
            setNewWeight(String(latestWeight || "70.0"));
            setWeighTargetWeight(targetWeight != null ? String(targetWeight) : "");
            setIsWeighDialogOpen(true);
          }}
          onOpenProduction={openProductionDialog}
          onOpenCalving={() => setIsCalvingDialogOpen(true)}
          onOpenCorrection={() => setIsCorrectionDialogOpen(true)}
          canCorrectIndividual={canCorrectIndividual}
          onSelectTab={(tabKey) => setActiveProfileTab(tabKey)}
          photoUrl={photoUrl}
          avatar={avatar}
          speciesImageUrl={speciesImageUrl}
          photoSlot={
            <LivestockPhotoManager
              title="Livestock Photo"
              subject="livestock"
              compactOnMobile
              triggerImage
              triggerImageSizeClassName="size-9 sm:size-10"
              triggerImageShapeClassName="rounded-xl border border-white/30"
              triggerImageFallbackClassName="text-xl"
              currentPhotoUrl={photoUrl}
              currentAvatarKey={activeItem.avatarKey || localAvatar}
              species={activeItem.livestockTypeName}
              fallback={
                <div className={`relative flex size-9 sm:size-10 items-center justify-center overflow-hidden rounded-xl text-xl ${avatar.bgGradient}`}>
                  {speciesImageUrl ? (
                    <Image src={speciesImageUrl} alt="Carabao" fill sizes="40px" className="object-cover" />
                  ) : avatar.emoji}
                </div>
              }
              onSave={async ({ file, removePhoto, avatarKey }) => {
                let payload: FormData | { photo?: null; avatar_key?: string };
                if (file) {
                  const formData = new FormData();
                  formData.append("photo", file);
                  if (avatarKey) formData.append("avatar_key", avatarKey);
                  payload = formData;
                } else {
                  const update = removePhoto ? { photo: null as null } : {};
                  if (avatarKey) Object.assign(update, { avatar_key: avatarKey });
                  payload = update;
                }
                await api.patch(`livestock/inventory/${activeItem.id}/`, payload);
                if (removePhoto && typeof window !== "undefined") {
                  localStorage.removeItem(`livestock_photo_${activeItem.id}`);
                  localStorage.removeItem(`livestock_photo_${activeItem.tagNumber}`);
                }
                await queryClient.invalidateQueries({ queryKey: ["inventory"] });
                await queryClient.invalidateQueries({ queryKey: ["inventory_item", String(activeItem.id)] });
                toast.success("Livestock photo updated.");
              }}
            />
          }
        />
        </div>

        {activeItem.entryType === "INDIVIDUAL" && (
          <Card data-tour="livestock-profile-side-photos" className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-3">
              <CardTitle className="text-sm font-black text-slate-900">Livestock Side Photos</CardTitle>
              <CardDescription className="text-xs text-slate-500">Left- and right-side views. The species avatar is shown for any side without a photo.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-2 sm:p-5 sm:pt-2">
              {([
                { side: "Left", url: activeItem.leftSidePhotoUrl },
                { side: "Right", url: activeItem.rightSidePhotoUrl },
              ] as const).map(({ side, url }) => (
                <figure key={side} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {url ? (
                    <img src={url} alt={`${side} side view of livestock ${activeItem.tagNumber}`} className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <div className={`relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-gradient-to-br text-7xl ${avatar.bgGradient}`} aria-label={`Avatar shown because the ${side.toLowerCase()} side photo is missing`}>
                      {speciesImageUrl ? <Image src={speciesImageUrl} alt={`${activeItem.livestockTypeName} avatar`} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-contain p-6" /> : avatar.emoji}
                    </div>
                  )}
                  <figcaption className="space-y-2 border-t border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-bold text-slate-700">{side} side view{!url ? " · avatar placeholder" : ""}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label={`Upload ${side.toLowerCase()} side photo`}
                        disabled={sidePhotoMutation.isPending}
                        onChange={(event) => handleSidePhotoUpload(side.toLowerCase() as "left" | "right", event)}
                        className="h-auto min-w-0 flex-1 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold"
                      />
                      {url ? <Button type="button" size="sm" variant="ghost" disabled={sidePhotoMutation.isPending} onClick={() => sidePhotoMutation.mutate({ side: side.toLowerCase() as "left" | "right", file: null })}><Trash2 className="mr-1 size-3.5" />Remove</Button> : null}
                    </div>
                  </figcaption>
                </figure>
              ))}
            </CardContent>
          </Card>
        )}

        {activeItem.status === "APPROVED" && activeItem.reviewRemarks && (
          <Card className="rounded-2xl border-emerald-200 bg-emerald-50/70 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 flex items-start gap-3">
              <div className="size-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-900">
                      MAO Review Message
                    </p>
                    <p className="text-[11px] text-emerald-800">
                      Official approval remarks from the Municipal Agriculture Office
                    </p>
                  </div>
                  {activeItem.reviewedAt && (
                    <span className="text-[10px] font-bold text-emerald-700 whitespace-nowrap">
                      {new Date(activeItem.reviewedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <blockquote className="text-sm font-medium leading-relaxed text-slate-800 border-l-2 border-emerald-500 pl-3">
                  &ldquo;{activeItem.reviewRemarks}&rdquo;
                </blockquote>
                {activeItem.reviewedByName && (
                  <p className="text-[11px] font-bold text-emerald-900">
                    Reviewed by {activeItem.reviewedByName}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ── EXPANDABLE BOTTOM SHEET / DRAGGABLE SLIDING PANEL (MOBILE) & DASHBOARD TABS (DESKTOP) ── */}
        <LivestockSlidingPanel
          activeTab={effectiveProfileTab}
          onSelectTab={setActiveProfileTab}
          tabItems={tabItems}
        >
          <Tabs value={effectiveProfileTab === "breeding-care" ? "breeding" : effectiveProfileTab} onValueChange={setActiveProfileTab} className="w-full space-y-6">
            <div
              ref={desktopTabsContainerRef}
              onScroll={updateDesktopScrollMetrics}
              onWheel={handleDesktopTabsWheel}
              className="hidden lg:block w-full overflow-x-auto scroll-smooth no-scrollbar py-1.5"
            >
              <TabsList data-tour="profile-tabs-desktop" className="h-12 flex w-full min-w-max items-center justify-between gap-1 rounded-2xl border border-slate-200/90 bg-slate-100/90 p-1.5 shadow-2xs">
                <TabsTrigger
                  value="growth"
                  onClick={(e) => handleSelectProfileTab("growth", e)}
                  className="flex-1 h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 xl:px-3.5 py-1.5 text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                >
                  <TrendingUp className="size-3.5 shrink-0 text-emerald-600" />
                  <span>Growth &amp; Weight</span>
                </TabsTrigger>

                {canProduceMilk && (
                  <TabsTrigger
                    value="production"
                    onClick={(e) => handleSelectProfileTab("production", e)}
                    className="flex-1 h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 xl:px-3.5 py-1.5 text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                  >
                    <Milk className="size-3.5 shrink-0 text-sky-600" />
                    <span>Production</span>
                  </TabsTrigger>
                )}

                {canShowMilkPredictionTab && (
                  <TabsTrigger
                    value="milk-prediction"
                    onClick={(e) => handleSelectProfileTab("milk-prediction", e)}
                    className="flex-1 h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 xl:px-3.5 py-1.5 text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                  >
                    <Milk className="size-3.5 shrink-0 text-amber-500" />
                    <span>Milk Prediction</span>
                  </TabsTrigger>
                )}

                <TabsTrigger
                  value="calving"
                  onClick={(e) => handleSelectProfileTab("calving", e)}
                  className="flex-1 h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 xl:px-3.5 py-1.5 text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                >
                  <Baby className="size-3.5 shrink-0 text-pink-600" />
                  <span>{terms.eventName} &amp; Offspring</span>
                  <span className="ml-0.5 rounded-full bg-pink-100 text-pink-800 text-[10px] font-black px-1.5 py-0.5">
                    {totalCalves}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="breeding"
                  onClick={(e) => handleSelectProfileTab("breeding", e)}
                  className="flex-1 h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 xl:px-3.5 py-1.5 text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                >
                  <CalendarClock className="size-3.5 shrink-0 text-indigo-600" />
                  <span>Breeding</span>
                  {breedingFollowUps.length > 0 && (
                    <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-800">
                      {breedingFollowUps.length}
                    </span>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="feeding"
                  onClick={(e) => handleSelectProfileTab("feeding", e)}
                  className="flex-1 h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 xl:px-3.5 py-1.5 text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                >
                  <Wheat className="size-3.5 shrink-0 text-amber-600" />
                  <span>Feeding</span>
                  {animalFeedingRecords.length > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800">
                      {animalFeedingRecords.length}
                    </span>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="health"
                  onClick={(e) => handleSelectProfileTab("health", e)}
                  className="flex-1 h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 xl:px-3.5 py-1.5 text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                >
                  <Stethoscope className="size-3.5 shrink-0 text-rose-600" />
                  <span>Health &amp; Vaccines</span>
                </TabsTrigger>

                <TabsTrigger
                  value="treatments"
                  onClick={(e) => handleSelectProfileTab("treatments", e)}
                  className="flex-1 h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 xl:px-3.5 py-1.5 text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                >
                  <Pill className="size-3.5 shrink-0 text-teal-600" />
                  <span>Treatments</span>
                  {animalTreatments.length > 0 && (
                    <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-black text-teal-800">
                      {animalTreatments.length}
                    </span>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="pedigree"
                  data-tour="profile-pedigree-tab-desktop"
                  onClick={(e) => handleSelectProfileTab("pedigree", e)}
                  className="flex-1 h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 xl:px-3.5 py-1.5 text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                >
                  <Heart className="size-3.5 shrink-0 text-purple-600" />
                  <span>Pedigree &amp; Lineage</span>
                </TabsTrigger>

                <TabsTrigger
                  value="ownership"
                  onClick={(e) => handleSelectProfileTab("ownership", e)}
                  className="flex-1 h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 xl:px-3.5 py-1.5 text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-white/50 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60"
                >
                  <Layers className="size-3.5 shrink-0 text-slate-600" />
                  <span>Ownership History</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ═══ INTERACTIVE HORIZONTAL SCROLLBAR FOR DESKTOP PROFILE TABS ═══ */}
            <div
              ref={desktopTrackRef}
              onClick={handleDesktopTrackClick}
              className={cn(
                "hidden lg:block w-full h-1.5 sm:h-2 bg-slate-100 hover:bg-slate-200/70 rounded-full -mt-2 mb-4 relative transition-all duration-200 select-none group",
                desktopScrollInfo.canScroll ? "cursor-pointer" : "opacity-40 cursor-default"
              )}
              role="scrollbar"
              aria-controls="profile-tabs-desktop"
              aria-valuenow={Math.round(desktopScrollInfo.thumbLeftPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Horizontal scrollbar for profile tabs"
              title={desktopScrollInfo.canScroll ? "Click or drag to scroll tabs horizontally" : undefined}
            >
              {desktopScrollInfo.canScroll ? (
                <div
                  onPointerDown={handleDesktopThumbPointerDown}
                  onPointerMove={handleDesktopThumbPointerMove}
                  onPointerUp={handleDesktopThumbPointerUp}
                  onPointerCancel={handleDesktopThumbPointerUp}
                  style={{
                    left: `${desktopScrollInfo.thumbLeftPct}%`,
                    width: `${desktopScrollInfo.thumbWidthPct}%`,
                  }}
                  className="absolute top-0 bottom-0 bg-slate-400 group-hover:bg-slate-500 active:bg-slate-700 rounded-full transition-colors cursor-grab active:cursor-grabbing shadow-2xs"
                />
              ) : (
                <div className="h-full bg-slate-200/90 rounded-full w-full" />
              )}
            </div>

          {/* ── TAB 1: GROWTH & WEIGHT LOGS ───────────────────────────────── */}
          <TabsContent value="growth" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart Card */}
              <Card className="lg:col-span-2 rounded-3xl border-slate-200 shadow-sm bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-black text-slate-900">
                      Weight Gain &amp; Growth Progression
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      {targetWeight
                        ? `Historical body weight recordings compared against target market weight (${targetWeight} kg).`
                        : "Historical body weight recordings over time."}
                    </CardDescription>
                  </div>
                  <Button
                    disabled={isInactive}
                    title={isDeceased ? "Deceased animals are read-only" : isSlaughtered ? "Slaughtered animals are read-only" : "Log weight"}
                    onClick={() => {
                      setNewWeight(String(latestWeight || "70.0"));
                      setWeighTargetWeight(targetWeight != null ? String(targetWeight) : "");
                      setIsWeighDialogOpen(true);
                    }}
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs font-bold border-slate-300 cursor-pointer"
                  >
                    <Plus className="size-3.5 mr-1" /> Log Weight
                  </Button>
                </div>

                <div className="h-64 w-full pt-2">
                  {weightLogs.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weightLogs} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} unit="kg" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1E293B",
                            border: "none",
                            borderRadius: "12px",
                            color: "white",
                            fontSize: "12px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke="#10B981"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#059669", stroke: "#FFFFFF", strokeWidth: 2 }}
                          name="Live Weight (kg)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No weight recordings logged yet. Click &ldquo;Log Weight&rdquo; to add scale readings.
                    </div>
                  )}
                </div>
              </Card>

              {/* Feed & Efficiency Card */}
              <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-5 space-y-4">
                <CardTitle className="text-base font-black text-slate-900">
                  Feed &amp; Growth Metrics
                </CardTitle>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-800">
                      Average Daily Gain (ADG)
                    </span>
                    <p className="text-xl font-black text-emerald-950">
                      {latestAdg === null ? "—" : `+${latestAdg} kg/day`}
                    </p>
                    <p className="text-slate-600 text-[11px]">
                      {latestAdg === null ? "Add a second weigh-in to calculate daily gain." : "Calculated between recorded weigh-ins."}
                    </p>
                  </div>

                  {targetWeight !== null ? (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-500">
                          Progress to Target ({targetWeight} kg)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetWeightInput(String(targetWeight));
                            setIsTargetWeightDialogOpen(true);
                          }}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                      <p className="text-base font-black text-slate-900">
                        {Math.round((latestWeight / targetWeight) * 100)}% Completed
                      </p>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((latestWeight / targetWeight) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-500">
                          Target Market Weight
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded-md">
                          Optional
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-600">Not Configured</p>
                      <p className="text-slate-400 text-[11px]">
                        Optional benchmark for slaughter or market readiness tracking.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTargetWeightInput("");
                          setIsTargetWeightDialogOpen(true);
                        }}
                        className="w-full mt-1 h-7 rounded-lg text-xs font-bold border-slate-300 hover:bg-slate-100 cursor-pointer"
                      >
                        <Plus className="size-3 mr-1" /> Set Target Weight (Optional)
                      </Button>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Carcass Valuation Benchmark
                    </span>
                    <p className="font-black text-slate-900">₱{(projectedCarcassKg * 280).toLocaleString()}</p>
                    <p className="text-slate-500 text-[11px]">Based on Padre Garcia Auction meat index (₱280/kg).</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Weigh-in Table */}
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-black text-slate-900">
                  Weigh-In Historical Logs ({weightLogs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {weightLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No weight logs recorded in database yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-50/70">
                      <TableRow>
                        <TableHead className="font-bold text-xs text-slate-600">Recording Date</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Weight (kg)</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Gain (kg)</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Calculated ADG</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Field Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weightLogs.map((log, idx) => (
                        <TableRow key={log.id || idx}>
                          <TableCell className="font-bold text-xs text-slate-800">{log.date}</TableCell>
                          <TableCell className="font-black text-xs text-emerald-800">{log.weight} kg</TableCell>
                          <TableCell className="text-xs font-bold text-slate-700">
                            {log.gain > 0 ? `+${log.gain} kg` : "—"}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-emerald-700">
                            {log.adg > 0 ? `+${log.adg} kg/d` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 font-medium">{log.notes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB 2: PRODUCTION & YIELD ─────────────────────────────────── */}
          {canProduceMilk && (
          <TabsContent value="production" className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-black text-slate-900">
                    Animal Production Records
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium">
                    Your production records appear here after you submit them.
                  </CardDescription>
                </div>

                <Button
                  disabled={isInactive}
                  title={isDeceased ? "Deceased animals are read-only" : isSlaughtered ? "Slaughtered animals are read-only" : "Record production"}
                  onClick={openProductionDialog}
                  size="sm"
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="size-3.5" /> Record Production
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Total Production</span>
                  <p className="text-2xl font-black text-slate-900">
                    {productionLogs.reduce((acc, curr) => acc + curr.quantity, 0).toFixed(1)}{" "}
                    {productionLogs[0]?.unit || "Units"}
                  </p>
                  <p className="text-slate-500 text-[11px]">Across {productionLogs.length} recorded production entries</p>
                </div>

                <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-sky-700">Recorded in the last 7 days</span>
                  <p className="text-2xl font-black text-sky-900">{recentSevenDayProduction.total.toFixed(1)} {recentSevenDayProduction.rows[0]?.unit || "Units"}</p>
                  <p className="text-slate-500 text-[11px]">{recentSevenDayProduction.rows.length} entries · includes the last 7 calendar days</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Projected Meat Yield</span>
                  <p className="text-2xl font-black text-emerald-800">~{projectedCarcassKg} kg</p>
                  <p className="text-slate-500 text-[11px]">{meatDressingPct}% dressed carcass ratio</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Estimated Market Value</span>
                  <p className="text-2xl font-black text-slate-900">
                    ₱{(projectedCarcassKg * 280).toLocaleString()}
                  </p>
                  <p className="text-slate-500 text-[11px]">Live livestock appraisal index</p>
                </div>
              </div>

              {productionLogs.length === 0 ? (
                <div className="text-center py-10 px-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl space-y-2 mt-4">
                  <Milk className="size-8 text-slate-400 mx-auto" />
                  <h4 className="font-bold text-sm text-slate-800">No production logs recorded yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {canProduceMilk
                      ? `Log milk volume or other applicable production for Tag #${activeItem.tagNumber} to track output.`
                      : `Log other applicable production for Tag #${activeItem.tagNumber} to track output.`}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 overflow-hidden mt-4">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold text-xs text-slate-600">Date</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Product</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Quantity</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Validation Status</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-bold text-xs text-slate-800">{log.date}</TableCell>
                          <TableCell className="text-xs font-semibold text-slate-700">{log.type}</TableCell>
                          <TableCell className="font-black text-xs text-slate-900">
                            {log.quantity} {log.unit}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] font-black ${log.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                                : log.status === "VERIFIED"
                                  ? "bg-sky-100 text-sky-900 border-sky-200"
                                  : "bg-amber-100 text-amber-900 border-amber-200"
                                }`}
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 font-medium">{log.notes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>
          )}

          {canShowMilkPredictionTab && (
            <TabsContent value="milk-prediction" className="space-y-6">
              <LivestockMilkForecastTab livestockId={Number(activeItem.id)} />
            </TabsContent>
          )}

          {/* ── TAB 3: CALVING & OFFSPRING ─────────────────────────────────── */}
          <TabsContent value="calving" className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>{terms.eventName} &amp; Offspring Registry</span>
                    <Badge className="bg-pink-100 text-pink-900 border-pink-200 text-[10px] font-black uppercase">
                      {activeItem.sex === "Female" ? terms.damName : "Maternal Record"}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium">
                    Birth records for Tag #{activeItem.tagNumber}
                  </CardDescription>
                </div>

                <Button
                  disabled={isInactive}
                  title={isDeceased ? "Deceased animals are read-only" : isSlaughtered ? "Slaughtered animals are read-only" : `Record new ${terms.eventName.toLowerCase()}`}
                  onClick={() => setIsCalvingDialogOpen(true)}
                  size="sm"
                  className="rounded-xl bg-pink-700 hover:bg-pink-800 text-white font-bold text-xs gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="size-3.5" /> Record New {terms.eventName}
                </Button>
              </div>

              {/* Birthing KPI summaries */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Total {terms.offspringPlural}</span>
                  <p className="text-2xl font-black text-slate-900">{totalCalves}</p>
                  <p className="text-slate-500 text-[11px]">Live births registered</p>
                </div>

                <div className="p-4 bg-pink-50/60 rounded-2xl border border-pink-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-pink-700">{terms.femaleOffspring}</span>
                  <p className="text-2xl font-black text-pink-900">{femaleCalves}</p>
                  <p className="text-slate-500 text-[11px]">Female progeny</p>
                </div>

                <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-blue-700">{terms.maleOffspring}</span>
                  <p className="text-2xl font-black text-blue-900">{maleCalves}</p>
                  <p className="text-slate-500 text-[11px]">Male progeny</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Avg Birth Weight</span>
                  <p className="text-2xl font-black text-slate-900">{avgBirthWeight !== "—" ? `${avgBirthWeight} kg` : "—"}</p>
                  <p className="text-slate-500 text-[11px]">Baseline vitality score</p>
                </div>
              </div>

              {/* Offspring Table */}
              {animalCalvingRecords.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl space-y-3">
                  <div className="size-12 rounded-2xl bg-pink-100 text-pink-700 flex items-center justify-center mx-auto">
                    <Baby className="size-6" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h4 className="font-bold text-sm text-slate-800">No {terms.eventName.toLowerCase()} records yet</h4>
                    <p className="text-xs text-slate-500">
                      When this animal has a newborn, add its birth details here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 overflow-hidden mt-4">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold text-xs text-slate-600">Birth Date</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">{terms.offspringName} Tag</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Gender</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Birth Weight</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Sire Tag / Breed</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Calving Ease</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {animalCalvingRecords.map((calving) => (
                        <TableRow key={calving.id}>
                          <TableCell className="font-bold text-xs text-slate-800">{formatCalendarDate(calving.calving_date)}</TableCell>
                          <TableCell className="font-mono font-bold text-xs text-slate-900">
                            <Badge variant="outline" className="font-mono bg-slate-50 border-slate-200">
                              {calving.calf_tag || "Unregistered"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] font-black ${calving.calf_sex === "FEMALE"
                                ? "bg-pink-100 text-pink-900 border-pink-200"
                                : "bg-blue-100 text-blue-900 border-blue-200"
                                }`}
                            >
                              {calving.calf_sex}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-800">
                            {calving.birth_weight ? `${calving.birth_weight} kg` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {calving.sire_tag || "Unknown"} {calving.breed ? `(${calving.breed})` : ""}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-700">
                            {calving.calving_ease || "Normal"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 font-medium">
                            {calving.notes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="breeding" className="space-y-6">
            <Card className="rounded-3xl border-indigo-100 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><CalendarClock className="size-5" /></div>
                <div><CardTitle className="text-base font-black">Follow-ups</CardTitle><CardDescription>Use these reminders to update the animal&apos;s record after a check or birth.</CardDescription></div>
              </div>
              {breedingFollowUps.length === 0 ? (
                <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">No open breeding follow-ups recorded for this animal.</p>
              ) : (
                <div className="space-y-3">
                  {breedingFollowUps.map((record) => {
                    const estimatedDate = record.expected_due_date;
                    const duePassed = Boolean(estimatedDate && estimatedDate < localCalendarDateToday());
                    return <div key={record.id} className="flex flex-col gap-1 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="font-bold text-sm text-slate-900">{record.status === "PENDING_CHECK" ? "Record the pregnancy check outcome" : "Check for calving and record the birth"}</p><p className="text-xs text-slate-600">{record.breeding_type.replaceAll("_", " ")} · recorded {formatCalendarDate(record.breeding_date)}</p></div>
                      {estimatedDate && <Badge className={duePassed ? "border-amber-200 bg-amber-100 text-amber-900" : "border-indigo-200 bg-white text-indigo-800"}>{duePassed ? "Estimated date passed" : "Estimated due"}: {formatCalendarDate(estimatedDate)}</Badge>}
                    </div>;
                  })}
                  <p className="text-xs text-slate-500">Due dates are estimates based on the recorded breeding date and gestation length. They are reminders to check and update records, not a prediction or veterinary assessment.</p>
                </div>
              )}
            </Card>

            <Card className="rounded-3xl border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <CardHeader className="p-0"><CardTitle className="text-base font-black">Breeding &amp; Insemination History</CardTitle></CardHeader>
              {animalBreedingRecords.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">No breeding records linked to this animal yet.</p> : <div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Breeding date</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Estimated due date</TableHead><TableHead>Sire / code</TableHead></TableRow></TableHeader><TableBody>{animalBreedingRecords.map((record) => <TableRow key={record.id}><TableCell>{formatCalendarDate(record.breeding_date)}</TableCell><TableCell>{record.breeding_type.replaceAll("_", " ")}</TableCell><TableCell>{record.status.replaceAll("_", " ")}</TableCell><TableCell>{record.expected_due_date ? formatCalendarDate(record.expected_due_date) : "—"}</TableCell><TableCell>{record.sire_tag_or_code || "—"}</TableCell></TableRow>)}</TableBody></Table></div>}
            </Card>
          </TabsContent>

          {/* ── TAB: FEEDING & RATIONS ──────────────────────────────────── */}
          <TabsContent value="feeding" className="space-y-6">
            <Card className="rounded-3xl border-amber-100 bg-white p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <Wheat className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-black text-slate-900">
                      Feeding &amp; Rations
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Individual feed entries linked to Tag #{activeItem.tagNumber}.
                    </CardDescription>
                  </div>
                </div>

                <Link href="/production-dashboard">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-amber-300 text-amber-800 hover:bg-amber-50 font-bold text-xs gap-1.5 self-start sm:self-auto"
                  >
                    <Wheat className="size-3.5" /> Production Dashboard
                  </Button>
                </Link>
              </div>

              {animalFeedingRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/30 p-8 text-center space-y-2">
                  <Wheat className="size-8 text-amber-400 mx-auto" />
                  <p className="font-bold text-sm text-slate-800">No Individual Feeding Records</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    No individual feeding logs have been recorded for this animal yet. Herd and batch feeding entries can be managed from the Production Dashboard.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead className="font-bold text-xs">Date</TableHead>
                        <TableHead className="font-bold text-xs">Feed</TableHead>
                        <TableHead className="font-bold text-xs">Quantity</TableHead>
                        <TableHead className="font-bold text-xs">Time</TableHead>
                        <TableHead className="font-bold text-xs">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {animalFeedingRecords.map((record) => (
                        <TableRow key={record.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-medium text-xs">
                            {formatCalendarDate(record.feeding_date)}
                          </TableCell>
                          <TableCell className="font-bold text-xs text-slate-900">
                            {record.feed_name || record.feed_type.replaceAll("_", " ")}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-xs text-amber-700">
                            {Number(record.quantity_kg).toFixed(2)} kg
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {record.feeding_time?.replaceAll("_", " ") || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {record.notes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* ── TAB 4: HEALTH & VACCINES ──────────────────────────────────── */}
          <TabsContent value="health" className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black text-slate-900">
                    Health &amp; Vaccinations
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium">
                    Vaccination dates and animal health reports.
                  </CardDescription>
                </div>

                <Link href="/report-observation">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs gap-1.5"
                  >
                    <AlertTriangle className="size-3.5" /> Report Sick Animal
                  </Button>
                </Link>
              </div>

              <div className="space-y-3 pt-2">
                {activeItem.lastVaccinationDate ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                    <ShieldCheck className="size-5 text-emerald-700 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-slate-900">
                        Vaccination Recorded
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Last vaccinated on <strong>{activeItem.lastVaccinationDate}</strong>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start gap-3">
                    <Clock className="size-5 text-amber-700 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-slate-900">
                        No Vaccination Date
                      </p>
                      <p className="text-[11px] text-slate-600">
                        No vaccination date is recorded for this animal. Contact your local livestock officer for help.
                      </p>
                    </div>
                  </div>
                )}

                {/* Real Disease Cases */}
                {animalDiseaseCases.length > 0 ? (
                  <div className="space-y-2 pt-2">
                    <h5 className="font-bold text-xs text-slate-800">Animal Health Reports:</h5>
                    {animalDiseaseCases.map((d) => (
                      <div key={d.id} className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                        <AlertTriangle className="size-4 text-rose-600 mt-0.5 shrink-0" />
                        <div className="space-y-0.5 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-900">{d.name}</p>
                            <Badge className="bg-rose-200 text-rose-900 text-[10px] font-bold">
                              {d.status}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            Recorded: {d.record_date || d.created_at?.split("T")[0]} &bull; {d.review_remarks || "Under observation"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-slate-900">
                        No Health Reports
                      </p>
                      <p className="text-[11px] text-slate-600">
                        No active health reports for Tag #{activeItem.tagNumber}.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* ── TAB: CLINICAL TREATMENTS & MEDICATIONS ──────────────────────── */}
          <TabsContent value="treatments" className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-2xs">
                    <Pill className="size-5.5 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-black text-slate-900">
                        Clinical Treatments &amp; Medications
                      </CardTitle>
                      <Badge variant="outline" className="text-xs font-bold bg-teal-50 text-teal-800 border-teal-200">
                        {animalTreatments.length} Logged
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-slate-500 font-medium mt-0.5">
                      Individual veterinary interventions, antibiotic regimens, dewormers, vitamins, and therapeutic logs.
                    </CardDescription>
                  </div>
                </div>

                <Button
                  disabled={isInactive}
                  title={isDeceased ? "Deceased animals are read-only" : isSlaughtered ? "Slaughtered animals are read-only" : "Log a clinical treatment"}
                  onClick={() => setIsTreatmentDialogOpen(true)}
                  size="sm"
                  className="rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white cursor-pointer shadow-2xs gap-1.5 shrink-0"
                >
                  <Plus className="size-3.5" /> Log Treatment
                </Button>
              </div>

              {/* Treatment KPI Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Total Treatments
                  </span>
                  <p className="text-xl font-black text-slate-900">
                    {animalTreatments.length}
                  </p>
                  <p className="text-[11px] text-slate-500">Lifetime recorded interventions</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                    Latest Treatment
                  </span>
                  <p className="text-sm font-bold text-teal-950 truncate">
                    {animalTreatments[0]?.medication_name || "None recorded"}
                  </p>
                  <p className="text-[11px] text-teal-800 font-medium">
                    {animalTreatments[0]?.treatment_date ? formatCalendarDate(animalTreatments[0].treatment_date) : "No clinical history"}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Active Follow-Ups
                  </span>
                  <p className="text-xl font-black text-slate-900">
                    {animalTreatments.filter((t) => t.follow_up_date && new Date(t.follow_up_date) >= new Date()).length}
                  </p>
                  <p className="text-[11px] text-slate-500">Pending scheduled re-checks</p>
                </div>
              </div>

              {/* Treatments History Table */}
              {animalTreatments.length === 0 ? (
                <div className="p-10 rounded-2xl bg-slate-50/60 border border-dashed border-slate-200 text-center space-y-3">
                  <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Pill className="size-6" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <p className="text-sm font-bold text-slate-800">No clinical treatments logged</p>
                    <p className="text-xs text-slate-500">
                      Record veterinary interventions, administered antibiotics, dewormers, or vitamins to track health history.
                    </p>
                  </div>
                  <Button
                    disabled={isInactive}
                    size="sm"
                    variant="outline"
                    onClick={() => setIsTreatmentDialogOpen(true)}
                    className="rounded-xl text-xs font-bold border-slate-300 hover:bg-slate-100 cursor-pointer"
                  >
                    <Plus className="size-3.5 mr-1" /> Record First Treatment
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/90 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead className="font-bold text-xs text-slate-700">Date</TableHead>
                        <TableHead className="font-bold text-xs text-slate-700">Type</TableHead>
                        <TableHead className="font-bold text-xs text-slate-700">Medication &amp; Dosage</TableHead>
                        <TableHead className="font-bold text-xs text-slate-700">Route</TableHead>
                        <TableHead className="font-bold text-xs text-slate-700">Practitioner</TableHead>
                        <TableHead className="font-bold text-xs text-slate-700">Reason &amp; Notes</TableHead>
                        <TableHead className="font-bold text-xs text-slate-700">Follow-up</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {animalTreatments.map((record) => (
                        <TableRow key={record.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-semibold text-xs text-slate-800 whitespace-nowrap">
                            {formatCalendarDate(record.treatment_date)}
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                              record.treatment_type === "ANTIBIOTIC"
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : record.treatment_type === "DEWORMER"
                                ? "bg-sky-50 text-sky-800 border-sky-200"
                                : record.treatment_type === "VITAMIN_MINERAL"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : record.treatment_type === "VACCINE"
                                ? "bg-purple-50 text-purple-800 border-purple-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            )}>
                              {record.treatment_type_label || record.treatment_type}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-bold text-slate-900">{record.medication_name}</div>
                            {record.dosage && (
                              <div className="text-[11px] text-slate-500 font-mono">{record.dosage}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                            {record.route_of_administration || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 font-medium whitespace-nowrap">
                            {record.administered_by || "Self / Farm Staff"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 max-w-xs">
                            {record.reason && (
                              <div className="font-semibold text-slate-800">{record.reason}</div>
                            )}
                            {record.notes && (
                              <div className="text-[11px] text-slate-500 truncate" title={record.notes}>
                                {record.notes}
                              </div>
                            )}
                            {!record.reason && !record.notes && "—"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                            {record.follow_up_date ? (
                              <span className="font-semibold text-amber-700">
                                {formatCalendarDate(record.follow_up_date)}
                              </span>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* ── TAB 5: PEDIGREE & LINEAGE ─────────────────────────────────── */}
          <TabsContent value="pedigree" className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6 space-y-4">
              <div>
                <CardTitle className="text-base font-black text-slate-900">
                  Lineage &amp; Parentage Pedigree
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium">
                  A family tree from recorded parentage and birth records. Records show their current review status.
                </CardDescription>
              </div>

              <LivestockLineageTree
                animal={activeItem}
                parentRecord={selfLineage}
                offspringRecords={animalCalvingRecords}
                inventory={inventories}
                offspringName={terms.offspringName}
                offspringPlural={terms.offspringPlural}
              />

              {!selfLineage && activeItem.batchCode && (
                <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-200 space-y-2 pt-2">
                  <span className="text-[10px] font-black uppercase text-teal-800 flex items-center gap-1">
                    <Layers className="size-3.5" /> Herd Origin
                  </span>
                  <p className="text-sm font-black text-slate-900">
                    Registered as part of Herd: {activeItem.batchName || activeItem.batchCode}
                  </p>
                  <p className="text-xs text-slate-600">
                    Animal entered the municipal inventory as part of batch <strong>{activeItem.batchCode}</strong> ({activeItem.breed}). Individual parent tags were not separately indexed.
                  </p>
                  {activeItem.batchId && (
                    <div className="pt-1">
                      <Link
                        href={`/livestock-inventory/batches?batch=${encodeURIComponent(String(activeItem.batchId))}&livestockType=${encodeURIComponent(activeItem.livestockTypeName || "Cattle")}&animalId=${encodeURIComponent(String(activeItem.id))}${activeItem.tagNumber ? `&tag=${encodeURIComponent(activeItem.tagNumber)}` : ""}`}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-xl bg-teal-700/10 hover:bg-teal-700/20 text-teal-900 border-teal-300 text-xs font-bold gap-1.5 cursor-pointer"
                        >
                          <Layers className="size-3.5 text-teal-700" /> View Herd Roster
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="ownership" className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-5 sm:p-6">
              <OwnershipTransferPanel
                livestockId={Number(activeItem.id)}
                eligible={activeItem.status === "APPROVED" && activeItem.operationalStatus === "ACTIVE" && activeItem.entryType === "INDIVIDUAL" && activeItem.quantity === 1}
                open={isOwnershipFormOpen}
                onOpenChange={setIsOwnershipFormOpen}
              />
            </Card>
            <p className="px-1 text-xs text-slate-500">After approval, this seller-side record remains in history as SOLD with the buyer recorded. A registered buyer submits their own inventory record for the acquired animal.</p>
          </TabsContent>
        </Tabs>
      </LivestockSlidingPanel>
    </div>

      {/* ── MODAL: LOG WEIGHT ─────────────────────────────────────────────── */}
      <LivestockEditDialog
        item={canCorrectIndividual ? activeItem : null}
        open={isCorrectionDialogOpen}
        onOpenChange={setIsCorrectionDialogOpen}
        livestockTypes={livestockTypes}
        isSubmitting={correctionMutation.isPending}
        onSubmit={(payload) => correctionMutation.mutate(payload)}
      />

      {/* ── MODAL: EDIT BIRTH DATE ────────────────────────────────────────── */}
      <Dialog open={isBirthDateDialogOpen && !isInactive} onOpenChange={setIsBirthDateDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Calendar className="size-5 text-emerald-600" />
              <span>Edit Birth Date for {activeItem.tagNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Updating the birth date automatically recalculates the animal&apos;s exact age, life stage classification, and breeding timelines.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateBirthDateMutation.mutate(editBirthDateValue || null);
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Date of Birth</Label>
              <Input
                type="date"
                max={localCalendarDateToday()}
                value={editBirthDateValue}
                onChange={(e) => setEditBirthDateValue(e.target.value)}
                className="h-11 rounded-xl bg-slate-50 border-slate-200"
              />
              <p className="text-[11px] text-slate-500">
                Current record: {activeItem.birthDate ? formatCalendarDate(activeItem.birthDate) : "Not recorded"}
              </p>
            </div>

            {editBirthDateValue && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  Selected: {formatCalendarDate(editBirthDateValue)}
                </p>
                <p className="mt-1 text-emerald-800 text-[11px]">
                  Saving this date will update the passport, growth tracking, and gestation analytics.
                </p>
              </div>
            )}

            <DialogFooter className="flex items-center justify-between pt-2">
              {activeItem.birthDate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditBirthDateValue("");
                    updateBirthDateMutation.mutate(null);
                  }}
                  disabled={updateBirthDateMutation.isPending}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  Clear Date
                </Button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBirthDateDialogOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateBirthDateMutation.isPending}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  {updateBirthDateMutation.isPending ? "Saving..." : "Save Birth Date"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isWeighDialogOpen && !isInactive} onOpenChange={setIsWeighDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Scale className="size-5 text-emerald-600" />
              <span>Record New Weight for {activeItem.tagNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Enter the current weight. It will be added to the animal record.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddWeight} className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">New Live Weight (kg) *</Label>
              <Input
                type="number"
                step="0.1"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="rounded-xl border-slate-300 font-black text-lg h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Weighing Date *</Label>
              <Input
                type="date"
                value={weighDate}
                onChange={(e) => setWeighDate(e.target.value)}
                className="rounded-xl border-slate-300"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Notes</Label>
              <Input
                value={weighNotes}
                onChange={(e) => setWeighNotes(e.target.value)}
                placeholder="e.g. Weigh before morning feeding"
                className="rounded-xl border-slate-300"
              />
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-slate-700">Target Market Weight (kg)</Label>
                <span className="text-[10px] text-slate-400 font-medium">Optional</span>
              </div>
              <Input
                type="number"
                step="0.5"
                value={weighTargetWeight}
                onChange={(e) => setWeighTargetWeight(e.target.value)}
                placeholder="Leave blank if no target market weight"
                className="rounded-xl border-slate-300"
              />
              <p className="text-[11px] text-slate-400">
                Optional market or slaughter benchmark for this animal.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsWeighDialogOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={logWeightMutation.isPending}
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
              >
                {logWeightMutation.isPending ? "Saving..." : "Save Weight Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: TARGET MARKET WEIGHT (OPTIONAL) ────────────────────────── */}
      <Dialog open={isTargetWeightDialogOpen} onOpenChange={setIsTargetWeightDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Target className="size-5 text-emerald-600" />
              <span>Target Market Weight</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Target weight is completely optional. For dairy stock, breeders, or draft animals, you can leave this blank.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Target Weight (kg, optional)</Label>
              <Input
                type="number"
                step="0.5"
                placeholder="e.g. 420 (or leave empty)"
                value={targetWeightInput}
                onChange={(e) => setTargetWeightInput(e.target.value)}
                className="rounded-xl border-slate-300 font-bold text-base h-11"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 flex items-center justify-between">
              {targetWeight !== null ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (activeItem?.id && typeof window !== "undefined") {
                      localStorage.removeItem(`livestock_target_weight_${activeItem.id}`);
                      setTargetWeightOverride({ id: activeItem.id, val: null });
                    }
                    setWeighTargetWeight("");
                    setIsTargetWeightDialogOpen(false);
                    toast.success("Target weight cleared (set to optional).");
                  }}
                  className="rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold mr-auto"
                >
                  Clear Target
                </Button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTargetWeightDialogOpen(false)}
                  className="rounded-xl font-bold text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const val = parseFloat(targetWeightInput);
                    if (!isNaN(val) && val > 0) {
                      if (activeItem?.id && typeof window !== "undefined") {
                        localStorage.setItem(`livestock_target_weight_${activeItem.id}`, String(val));
                        setTargetWeightOverride({ id: activeItem.id, val });
                      }
                      setWeighTargetWeight(String(val));
                      toast.success(`Target weight set to ${val} kg.`);
                    } else {
                      if (activeItem?.id && typeof window !== "undefined") {
                        localStorage.removeItem(`livestock_target_weight_${activeItem.id}`);
                        setTargetWeightOverride({ id: activeItem.id, val: null });
                      }
                      setWeighTargetWeight("");
                      toast.success("Target weight cleared.");
                    }
                    setIsTargetWeightDialogOpen(false);
                  }}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                >
                  Save
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: LOG PRODUCTION OUTPUT ──────────────────────────────────── */}
      {/* The profile already supplies the animal and production type, so start at Details. */}
      {canProduceMilk && <ProductionWizard
        profileMode
        productionType={profileProductionType}
        onTypeChange={setProfileProductionType}
        clickedInventory={activeItem}
        onSelectInventory={() => undefined}
        formState={profileProductionForm}
        onFieldChange={(field, value) => setProfileProductionForm((previous) => ({ ...previous, [field]: value }))}
        approvedInventories={activeItem ? [activeItem] : []}
        isLoading={false}
        isSubmitting={logProductionMutation.isPending}
        resetSignal={productionWizardResetSignal}
        onSubmit={(payload: ProductionPayload) => logProductionMutation.mutate(payload)}
        open={isProductionDialogOpen && !isInactive && canProduceMilk}
        onClose={() => setIsProductionDialogOpen(false)}
        mode="create"
        editingRecord={null}
        productionRecords={allProductionRecords.map((record): ProductionRecordItem => ({
          id: record.id,
          livestockId: record.livestock,
          productionType: (record.production_type ?? "milk").toLowerCase() as ProductionType,
          quantity: Number(record.quantity) || 0,
          unit: record.unit,
          recordDate: record.record_date,
          notes: record.notes ?? "",
          status: record.status as ProductionRecordItem["status"],
          farmerName: null,
          livestockTypeName: null,
          reviewRemarks: record.review_remarks ?? null,
          createdAt: record.created_at,
        }))}
        isLoadingProductionRecords={isProductionRecordsLoading}
      />}

      <ProductionSubmissionSuccessDialog
        open={isProductionSuccessOpen}
        onOpenChange={setIsProductionSuccessOpen}
        recordId={submittedProductionId}
      />

      <Dialog open={isCalvingDialogOpen && !isInactive} onOpenChange={setIsCalvingDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Baby className="size-5 text-pink-600" />
              <span>Record {terms.eventName} for Dam #{activeItem.tagNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Add newborn {terms.offspringName.toLowerCase()} and birth details to the animal records.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordCalving} className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">{terms.offspringName} Ear Tag / Identifier</Label>
                <Input
                  value={newCalfData.tag}
                  onChange={(e) => setNewCalfData({ ...newCalfData, tag: e.target.value })}
                  placeholder={`e.g. ${terms.offspringName.toUpperCase()}-01`}
                  className="rounded-xl border-slate-300"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Offspring Gender *</Label>
                <Select
                  value={newCalfData.sex}
                  onValueChange={(val: "FEMALE" | "MALE") => setNewCalfData({ ...newCalfData, sex: val })}
                >
                  <SelectTrigger className="rounded-xl border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEMALE">{terms.femaleOffspring}</SelectItem>
                    <SelectItem value="MALE">{terms.maleOffspring}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <LivestockBreedField
              id="profile-offspring-breed"
              species={activeItem.livestockTypeName}
              label="Offspring Breed"
              value={newCalfData.breed}
              onChange={(breed) => setNewCalfData({ ...newCalfData, breed })}
              placeholder={`Select ${activeItem.livestockTypeName} breed`}
              customPlaceholder="Enter crossbreed or other breed"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Birth Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newCalfData.birthWeight}
                  onChange={(e) => setNewCalfData({ ...newCalfData, birthWeight: e.target.value })}
                  placeholder="e.g. 28.5"
                  className="rounded-xl border-slate-300"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">{terms.sireName} Tag / Breed Origin</Label>
                <Input
                  value={newCalfData.sireTag}
                  onChange={(e) => setNewCalfData({ ...newCalfData, sireTag: e.target.value })}
                  placeholder="e.g. BULL-2025-09"
                  className="rounded-xl border-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Calving / Birth Date *</Label>
                <Input
                  type="date"
                  max={localCalendarDateToday()}
                  value={newCalfData.date}
                  onChange={(e) => setNewCalfData({ ...newCalfData, date: e.target.value })}
                  className="rounded-xl border-slate-300"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Calving Ease / Delivery</Label>
                <Select
                  value={newCalfData.ease}
                  onValueChange={(val) => setNewCalfData({ ...newCalfData, ease: val })}
                >
                  <SelectTrigger className="rounded-xl border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal / Unassisted">Normal / Unassisted</SelectItem>
                    <SelectItem value="Assisted by Farmer">Assisted by Farmer</SelectItem>
                    <SelectItem value="Veterinary Intervention">Veterinary Intervention</SelectItem>
                    <SelectItem value="Mild Difficulty">Mild Difficulty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Birth Notes &amp; Vitality</Label>
              <Input
                value={newCalfData.notes}
                onChange={(e) => setNewCalfData({ ...newCalfData, notes: e.target.value })}
                placeholder="e.g. Vigorous nursing within 1 hour, normal colostrum intake."
                className="rounded-xl border-slate-300"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCalvingDialogOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={recordCalvingMutation.isPending}
                className="rounded-xl bg-pink-700 hover:bg-pink-800 text-white font-bold text-xs"
              >
                {recordCalvingMutation.isPending ? "Recording..." : `Register ${terms.offspringName}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: PRINT LGU PASSPORT ─────────────────────────────────────── */}
      <Dialog open={isPassportDialogOpen} onOpenChange={setIsPassportDialogOpen}>
        <DialogContent id="livestock-identity-pass" className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="text-center pb-2 border-b border-slate-100">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="size-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-xs shadow-xs">
                PG
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Municipality of Padre Garcia &bull; Batangas
                </p>
                <p className="text-xs font-black text-slate-900">
                  Office of the Municipal Agriculturist (MAO)
                </p>
              </div>
            </div>
            <DialogTitle className="text-base font-black text-slate-900 pt-1">
              Official Livestock Identity Card
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Livestock registry identity; inspection and movement approvals are checked separately
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ── Guidance Note: How This QR Code Works ── */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-slate-50 border border-emerald-200/90 shadow-2xs space-y-1 text-left">
              <div className="flex items-center gap-1.5 font-bold text-emerald-950 text-xs">
                <Info className="size-3.5 text-emerald-700 shrink-0" />
                <span>How this QR Code works:</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                This real QR identifies this individual livestock record. Authorized staff scan it with SmartLivestock to retrieve current registry details; the QR itself does not prove ownership, health clearance, or movement approval.
              </p>
            </div>

            {/* Visual QR Code & Photo Card */}
            <div className="flex flex-col items-center justify-center p-5 bg-gradient-to-b from-slate-50 via-emerald-50/30 to-slate-50 rounded-2xl border-2 border-dashed border-emerald-300/80 text-center relative">
              <div className="mx-auto shrink-0 mb-3">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={activeItem.tagNumber}
                    className="size-16 rounded-2xl object-cover border-2 border-emerald-600 shadow-md mx-auto"
                  />
                ) : (
                  <div
                    className={`relative size-16 rounded-2xl flex items-center justify-center overflow-hidden text-3xl bg-gradient-to-br border-2 border-emerald-300 shadow-md mx-auto ${avatar.bgGradient}`}
                  >
                    {speciesImageUrl ? (
                      <Image src={speciesImageUrl} alt="Carabao" fill sizes="64px" className="object-cover" />
                    ) : avatar.emoji}
                  </div>
                )}
              </div>

              {/* Generate a standards-compliant QR from the canonical inventory ID. */}
              <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 mb-2">
                {livestockQrDataUrl ? (
                  <Image className="size-36" src={livestockQrDataUrl} width={144} height={144} unoptimized alt={`Livestock identity QR for ${activeItem.tagNumber}`} />
                ) : livestockQrError ? (
                  <div role="alert" className="flex size-36 items-center justify-center text-center text-xs text-rose-700">QR generation failed. Reopen the ID card to retry.</div>
                ) : activeItem.entryType === "INDIVIDUAL" && activeItem.quantity === 1 ? (
                  <div className="flex size-36 items-center justify-center text-xs text-slate-500">Preparing QR…</div>
                ) : (
                  <div className="flex size-36 items-center justify-center text-center text-xs text-slate-500">A QR identity is available for individual animals only.</div>
                )}
              </div>

              <p className="font-mono font-black text-base text-slate-900 tracking-wider">
                {activeItem.tagNumber}
              </p>
              <div className="flex items-center gap-1.5 justify-center mt-1">
                {activeItem.status === "APPROVED" ? (
                  <Badge className="bg-emerald-600 text-white font-black text-[10px]">
                    ✓ MAO APPROVED
                  </Badge>
                ) : activeItem.status === "VERIFIED" ? (
                  <Badge className="bg-blue-600 text-white font-black text-[10px]">
                    ✓ SIBAT VERIFIED
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                    PENDING REVIEW
                  </Badge>
                )}
                {activeItem.batchCode && (
                  <Badge variant="outline" className="text-[10px] font-mono font-bold text-slate-600">
                    Herd: {activeItem.batchCode}
                  </Badge>
                )}
              </div>
            </div>

            {/* Biometric & Veterinary Details */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Species &amp; Breed:</span>
                <span className="font-bold text-slate-900">{activeItem.livestockTypeName} &bull; {activeItem.breed}</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Sex &amp; Weight:</span>
                <span className="font-bold text-slate-900">{activeItem.sex || "Female"} &bull; {latestWeight} kg</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Last Vaccination:</span>
                <span className="font-bold text-emerald-700">{activeItem.lastVaccinationDate || "No Record"}</span>
              </div>
              <p className="text-emerald-800 font-bold text-[11px] pt-1 text-center">
                Padre Garcia Municipal Agriculture Office &bull; Livestock Registry Identity Card
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPassportDialogOpen(false)}
              className="livestock-id-pass-action rounded-xl font-bold text-xs flex-1"
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={!livestockQrDataUrl}
              variant="outline"
              onClick={() => {
                const link = document.createElement("a");
                link.href = livestockQrDataUrl;
                link.download = `livestock-qr-${activeItem.id}.png`;
                link.click();
              }}
              className="livestock-id-pass-action rounded-xl font-bold text-xs flex-1 gap-1.5"
            >
              <Download className="size-3.5" /> Download QR
            </Button>
            <Button
              type="button"
              disabled={!livestockQrDataUrl}
              onClick={(event) => printElement(event.currentTarget.closest<HTMLElement>("#livestock-identity-pass"))}
              className="livestock-id-pass-action rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex-1 gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="size-3.5" /> Print Animal ID
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: LOG TREATMENT ─────────────────────────────────────────── */}
      <Dialog open={isTreatmentDialogOpen && !isInactive} onOpenChange={setIsTreatmentDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Pill className="size-5 text-teal-600" />
              <span>Log Treatment for {activeItem?.tagNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Record medication, antibiotic treatments, deworming, or therapeutic care administered to this animal.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTreatmentMutation.mutate();
            }}
            className="space-y-4 pt-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Treatment Date *</Label>
                <Input
                  type="date"
                  value={treatmentDate}
                  onChange={(e) => setTreatmentDate(e.target.value)}
                  max={localCalendarDateToday()}
                  className="rounded-xl mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Treatment Category *</Label>
                <Select value={treatmentType} onValueChange={setTreatmentType}>
                  <SelectTrigger className="rounded-xl mt-1 text-xs">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ANTIBIOTIC">Antibiotic</SelectItem>
                    <SelectItem value="DEWORMER">Dewormer / Anthelmintic</SelectItem>
                    <SelectItem value="VITAMIN_MINERAL">Vitamin / Mineral Supplement</SelectItem>
                    <SelectItem value="VACCINE">Vaccine</SelectItem>
                    <SelectItem value="ANTI_INFLAMMATORY">Anti-inflammatory / Pain</SelectItem>
                    <SelectItem value="TOPICAL_WOUND">Topical / Wound Care</SelectItem>
                    <SelectItem value="HORMONAL">Hormonal Therapy</SelectItem>
                    <SelectItem value="OTHER">Other Intervention</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Medication / Product *</Label>
                <Input
                  placeholder="e.g. Penicillin, Ivermectin"
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Dosage</Label>
                <Input
                  placeholder="e.g. 10 mL, 2 boluses"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Route of Administration</Label>
                <Select value={route} onValueChange={setRoute}>
                  <SelectTrigger className="rounded-xl mt-1 text-xs">
                    <SelectValue placeholder="Select route" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Intramuscular (IM)">Intramuscular (IM)</SelectItem>
                    <SelectItem value="Subcutaneous (SC)">Subcutaneous (SC)</SelectItem>
                    <SelectItem value="Oral (Drench/Bolus)">Oral (Drench/Bolus)</SelectItem>
                    <SelectItem value="Topical / Pour-on">Topical / Pour-on</SelectItem>
                    <SelectItem value="Intravenous (IV)">Intravenous (IV)</SelectItem>
                    <SelectItem value="Intrauterine">Intrauterine</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Administered By</Label>
                <Input
                  placeholder="e.g. Dr. Santos / Self"
                  value={administeredBy}
                  onChange={(e) => setAdministeredBy(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Reason / Diagnosis</Label>
              <Input
                placeholder="e.g. Coughing, routine parasite prevention"
                value={treatmentReason}
                onChange={(e) => setTreatmentReason(e.target.value)}
                className="rounded-xl mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Follow-up Date (Optional)</Label>
                <Input
                  type="date"
                  value={treatmentFollowUpDate}
                  onChange={(e) => setTreatmentFollowUpDate(e.target.value)}
                  min={localCalendarDateToday()}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Field Notes</Label>
                <Input
                  placeholder="Observations, withdrawal period"
                  value={treatmentNotes}
                  onChange={(e) => setTreatmentNotes(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTreatmentDialogOpen(false)}
                className="rounded-xl text-xs font-bold border-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addTreatmentMutation.isPending || !medicationName.trim()}
                className="rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white"
              >
                {addTreatmentMutation.isPending ? "Logging..." : "Save Treatment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
