"use client";

import React, { useState, useMemo, useEffect } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Tag,
  Scale,
  Calendar,
  Activity,
  ShieldCheck,
  TrendingUp,
  Stethoscope,
  QrCode,
  Printer,
  Download,
  Plus,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  Clock,
  Beef,
  Milk,
  Egg,
  Heart,
  AlertTriangle,
  ChevronRight,
  Baby,
  HeartPulse,
  Dna,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "@/lib/axios";
import { livestockIdentityQrPayload } from "@/lib/livestock-identity";
import {
  formatAgeClassification,
  formatCalendarDate,
  formatLivestockAge,
  localCalendarDateToday,
} from "@/lib/livestock-age";
import {
  useUserInventory,
  type LivestockInventoryItem,
  getAvatarById,
} from "../livestock-inventory";
import { OperationalStatusBadge } from "../operational-status-badge";
import { OwnershipTransferPanel } from "../ownership-transfer-panel";
import { LivestockPhotoManager } from "../livestock-photo-manager";
import { LivestockMilkForecastTab } from "../livestock-milk-forecast-tab";
import {
  getBirthingTerminology,
  type CalvingRecordItem,
} from "@/app/(farmer)/production-dashboard/production-calving-tab";
import { getProductionTypesForLivestock } from "@/app/(farmer)/production-dashboard/production-wizard";

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

interface ApiWeightRecord {
  id: number;
  livestock: number;
  tag_number?: string;
  weight: string | number;
  weighing_date: string;
  notes?: string;
  created_at: string;
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
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const rawId = params?.id ? decodeURIComponent(String(params.id)) : "";

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
        avatarKey: directInventory.avatar_key || null,
        batchId: directInventory.batch || null,
        batchCode: directInventory.batch_code || null,
        batchName: directInventory.batch_name || null,
      } as LivestockInventoryItem;
    }
    return null;
  }, [inventoryMatch, directInventory]);

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
  const { data: allProductionRecords = [] } = useQuery<ApiProductionRecord[]>({
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
    return 0.72;
  }, [weightLogs]);

  // Filter production logs for this specific animal
  const productionLogs: ProductionLog[] = useMemo(() => {
    if (!activeItem) return [];
    const animalIdStr = String(activeItem.id);
    return allProductionRecords
      .filter((r) => String(r.livestock) === animalIdStr)
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
  }, [allProductionRecords, activeItem]);

  // Filter Calving & Birthing progeny records where dam is this animal
  const animalCalvingRecords: CalvingRecordItem[] = useMemo(() => {
    if (!activeItem) return [];
    const animalIdNum = Number(activeItem.id);
    return allCalvingRecords.filter((c) => Number(c.dam) === animalIdNum);
  }, [allCalvingRecords, activeItem]);

  // Check if this animal itself was recorded as an offspring in municipal registry
  const selfLineage = useMemo(() => {
    if (!activeItem || !activeItem.tagNumber) return null;
    const tagUpper = activeItem.tagNumber.trim().toUpperCase();
    return allCalvingRecords.find((c) => c.calf_tag && c.calf_tag.trim().toUpperCase() === tagUpper) || null;
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

  // Target weight calculation by species
  const targetWeight = useMemo(() => {
    const s = (activeItem?.livestockTypeName || "").toLowerCase();
    if (s.includes("cattle") || s.includes("cow") || s.includes("baka")) return 420;
    if (s.includes("carabao") || s.includes("kalabaw")) return 450;
    if (s.includes("swine") || s.includes("pig") || s.includes("baboy")) return 90;
    if (s.includes("goat") || s.includes("kambing") || s.includes("sheep")) return 40;
    if (s.includes("poultry") || s.includes("chicken")) return 2.2;
    return 100;
  }, [activeItem?.livestockTypeName]);

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
  const [isPassportDialogOpen, setIsPassportDialogOpen] = useState(false);
  const [isProductionDialogOpen, setIsProductionDialogOpen] = useState(false);
  const [isCalvingDialogOpen, setIsCalvingDialogOpen] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState("growth");
  const [isOwnershipFormOpen, setIsOwnershipFormOpen] = useState(false);
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
  const [prodType, setProdType] = useState<"MILK" | "MEAT" | "EGGS" | "WOOL">(
    (activeItem?.livestockTypeName || "").toLowerCase().includes("cattle") ? "MILK" : "MEAT"
  );
  const availableProductionTypes = useMemo(
    () => getProductionTypesForLivestock(activeItem?.livestockTypeName).map((type) => PRODUCTION_TYPE_CODES[type]),
    [activeItem?.livestockTypeName],
  );
  const openProductionDialog = () => {
    if (availableProductionTypes.length > 0) {
      setProdType(availableProductionTypes.includes("WOOL") ? "WOOL" : availableProductionTypes[0]);
    }
    setIsProductionDialogOpen(true);
  };
  const [prodQuantity, setProdQuantity] = useState("10.0");
  const [prodDate, setProdDate] = useState(new Date().toISOString().split("T")[0]);
  const [prodNotes, setProdNotes] = useState("Daily yield collection");

  // Form States: Calving / Birthing
  const [newCalfData, setNewCalfData] = useState({
    tag: "",
    sex: "FEMALE" as "FEMALE" | "MALE",
    birthWeight: "",
    sireTag: "",
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
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.response?.data?.weight?.[0] || "Failed to save weight record.";
      toast.error(msg);
    },
  });

  const handleAddWeight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    const val = parseFloat(newWeight);
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid weight in kilograms.");
      return;
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
      const res = await api.post("production/records/", payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Production record of ${data.quantity} ${data.unit} logged successfully!`, {
        description: "Production record submitted for review.",
      });
      setIsProductionDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["production_records"] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.quantity?.[0] ||
        err.response?.data?.non_field_errors?.[0] ||
        "Failed to save production record.";
      toast.error(msg);
    },
  });

  const handleAddProduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    const qty = parseFloat(prodQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid production amount.");
      return;
    }

    const unit =
      prodType === "MILK"
        ? "LITERS"
        : prodType === "EGGS"
          ? "PIECES"
          : "KILOGRAMS";

    logProductionMutation.mutate({
      livestock: Number(activeItem.id),
      production_type: prodType,
      quantity: qty,
      unit: unit,
      record_date: prodDate,
      notes: prodNotes.trim() || undefined,
    });
  };

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
        date: new Date().toISOString().split("T")[0],
        ease: "Normal / Unassisted",
        notes: "",
      });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.response?.data?.non_field_errors?.[0] || `Failed to record ${terms.eventName.toLowerCase()} details.`;
      toast.error(msg);
    },
  });

  const handleRecordCalving = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    const generatedTag = newCalfData.tag.trim() || `${terms.offspringName.toUpperCase()}-${Date.now().toString().slice(-4)}`;

    recordCalvingMutation.mutate({
      dam: Number(activeItem.id),
      calf_tag: generatedTag,
      calf_sex: newCalfData.sex,
      birth_weight: newCalfData.birthWeight ? parseFloat(newCalfData.birthWeight) : null,
      sire_tag: newCalfData.sireTag.trim(),
      calving_date: newCalfData.date,
      breed: activeItem.breed || "Standard Breed",
      calving_ease: newCalfData.ease,
      notes: newCalfData.notes.trim(),
    });
  };

  // Avatar and photo
  const localPhoto = typeof window !== "undefined" ? localStorage.getItem(`livestock_photo_${activeItem?.id || activeItem?.tagNumber}`) : null;
  const localAvatar = typeof window !== "undefined" ? localStorage.getItem(`livestock_avatar_${activeItem?.id || activeItem?.tagNumber}`) : null;
  const photoUrl = activeItem?.photoUrl || localPhoto;
  const avatar = getAvatarById(activeItem?.avatarKey || localAvatar, activeItem?.livestockTypeName);
  const normalizedLivestockType = activeItem?.livestockTypeName?.toLowerCase() || "";
  // The profile tab is offered to every individually identified female bovine.
  // The backend still decides whether its status, age, and approved history
  // are sufficient to return a forecast.
  const canShowMilkPredictionTab = Boolean(
    activeItem
      && ["cattle", "cow", "bovine", "baka", "carabao", "buffalo"].some((term) => normalizedLivestockType.includes(term))
      && activeItem.entryType === "INDIVIDUAL"
      && activeItem.quantity === 1
      && ["FEMALE", "F"].includes(activeItem.sex.trim().toUpperCase())
  );

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

  // Loading state
  const isGlobalLoading = isInventoryLoading || isDirectLoading;

  if (isGlobalLoading) {
    return (
      <>
        <PageHeader
          title="Loading Animal Details..."
          subtitle="Loading animal details and records..."
          variant="farmer"
          maxWidthClass="w-full"
        />
        <div className="p-4 md:p-8 w-full space-y-6 max-w-7xl mx-auto">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-44 rounded-3xl" />
          </div>
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

      <div className="w-full max-w-none space-y-6 p-4 md:p-6 xl:p-8">
        {/* Navigation & Breadcrumb */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href={
                activeItem.batchId
                  ? `/livestock-inventory/batches?batch=${activeItem.batchId}`
                  : "/livestock-inventory"
              }
            >
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-slate-300 font-bold text-xs gap-1.5 text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="size-3.5" />
                {activeItem.batchId ? "Back to Herds" : "Back to Herd"}
              </Button>
            </Link>

            {activeItem.batchCode && (
              <Link href={`/livestock-inventory/batches?batch=${activeItem.batchId}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-emerald-300 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs gap-1.5"
                >
                  <Layers className="size-3.5 text-emerald-600" />
                  <span>Herd: {activeItem.batchCode}</span>
                </Button>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={() => setIsPassportDialogOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-300 font-bold text-xs gap-1.5 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <QrCode className="size-3.5 text-slate-600" /> Print ID Card
            </Button>

            <Button
              onClick={() => {
                setNewWeight(String(latestWeight || "70.0"));
                setIsWeighDialogOpen(true);
              }}
              size="sm"
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-sm"
            >
              <Scale className="size-3.5" /> Log Weight
            </Button>
          </div>
        </div>

        {/* ── HERO PASSPORT CARD ──────────────────────────────────────────── */}
        <Card className="rounded-3xl border-slate-200 shadow-md bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-[#1E4D2B] via-[#245833] to-[#1a4425] text-white p-5 sm:p-6 md:p-8">
            <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)] md:items-center">
              <div className="flex min-w-0 items-start gap-4">
                <LivestockPhotoManager
                    title="Livestock Photo"
                    subject="livestock"
                    compactOnMobile
                    triggerImage
                    currentPhotoUrl={photoUrl}
                  currentAvatarKey={activeItem.avatarKey || localAvatar}
                  species={activeItem.livestockTypeName}
                  fallback={<div className={`flex size-36 items-center justify-center rounded-2xl text-6xl ${avatar.bgGradient}`}>{avatar.emoji}</div>}
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

                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words text-xl sm:text-2xl font-black text-white tracking-tight">
                      {activeItem.tagNumber}
                    </span>
                    <Badge
                      className={`font-black text-xs px-2.5 py-0.5 ${
                        activeItem.status === "APPROVED"
                          ? "bg-emerald-400 text-emerald-950 border-emerald-300"
                          : activeItem.status === "VERIFIED"
                            ? "bg-sky-300 text-sky-950 border-sky-200"
                            : activeItem.status === "PENDING"
                              ? "bg-amber-300 text-amber-950 border-amber-200"
                              : activeItem.status === "SUBJECT_TO_REVISION"
                                ? "bg-orange-300 text-orange-950 border-orange-200"
                                : "bg-rose-300 text-rose-950 border-rose-200"
                      }`}
                    >
                      {activeItem.status}
                    </Badge>
                    <OperationalStatusBadge status={activeItem.operationalStatus} />
                    <Badge variant="outline" className="text-emerald-100 border-emerald-300/40 text-xs font-bold">
                      {activeItem.livestockTypeName}
                    </Badge>
                    {activeItem.batchCode && (
                      <Link href="/livestock-inventory/batches">
                        <Badge className="bg-teal-500/30 hover:bg-teal-500/50 text-teal-200 border-teal-400/40 font-bold text-xs px-2.5 py-0.5 inline-flex items-center gap-1 transition-colors cursor-pointer">
                          <Layers className="size-3" />
                          <span>Herd: {activeItem.batchCode}</span>
                        </Badge>
                      </Link>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 text-xs">
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-200/60">Breed</span>
                      <span className="block break-words font-semibold text-emerald-50">{activeItem.breed?.trim() || "Unknown"}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-200/60">Sex</span>
                      <span className="block break-words font-semibold text-emerald-50">{activeItem.sex?.trim() || "Unknown"}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-200/60">Age</span>
                      <span className="block break-words font-semibold text-emerald-50">
                        {formatLivestockAge(activeItem.age)} · {formatAgeClassification(activeItem.ageClassification)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-200/60">Birth Date</span>
                      <span className="block break-words font-semibold text-emerald-50">{formatCalendarDate(activeItem.birthDate)}</span>
                    </div>
                  </div>

                  <p className="break-words text-xs text-emerald-200/70 font-medium">
                    Owner: <strong>{activeItem.farmerName}</strong> &bull; Registration: {activeItem.createdAt ? activeItem.createdAt.split("T")[0] : "Official Record"}
                  </p>
                </div>
              </div>

              {/* Quick Biometrics Right Panel */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-black/20 p-4 rounded-2xl border border-white/10 text-center md:min-w-0">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/60">Live Weight</span>
                  <p className="text-lg font-black text-white">{latestWeight} kg</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/60">Daily Gain (ADG)</span>
                  <p className="text-lg font-black text-emerald-300">+{latestAdg} kg/d</p>
                </div>
                <div className="space-y-0.5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/60">Age Category</span>
                  <p className="text-lg font-black text-white">{formatAgeClassification(activeItem.ageClassification)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-t border-slate-100 text-xs bg-slate-50/50">
            <div className="p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Target Weight</span>
              <p className="font-black text-slate-900">{targetWeight} kg</p>
            </div>
            <div className="p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Estimated Meat</span>
              <p className="font-black text-emerald-700">~{projectedCarcassKg} kg meat ({meatDressingPct}%)</p>
            </div>
            <div className="p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Offspring Produced</span>
              <p className="font-black text-slate-900">{totalCalves} {terms.offspringPlural}</p>
            </div>
            <div className="p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Last Vaccination</span>
              <p className="font-black text-slate-900">
                {activeItem.lastVaccinationDate ? activeItem.lastVaccinationDate : "No Record Logged"}
              </p>
            </div>
          </div>
        </Card>

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

        {/* ── TABS: GROWTH, PRODUCTION YIELD, CALVING / BIRTHING, HEALTH, LINEAGE ───────── */}
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-600">Need to record a change of owner?</p>
          <Button
            type="button"
            variant="outline"
            disabled={!(activeItem.status === "APPROVED" && activeItem.operationalStatus === "ACTIVE" && activeItem.entryType === "INDIVIDUAL" && activeItem.quantity === 1)}
            onClick={() => {
              setActiveProfileTab("ownership");
              setIsOwnershipFormOpen(true);
            }}
            className="min-h-11 w-full rounded-xl border-emerald-700 font-semibold text-emerald-800 hover:bg-emerald-50 sm:w-auto"
          >
            Record Ownership Transfer
          </Button>
        </div>
        {!(activeItem.status === "APPROVED" && activeItem.operationalStatus === "ACTIVE" && activeItem.entryType === "INDIVIDUAL" && activeItem.quantity === 1) ? (
          <p className="-mt-4 text-xs text-slate-500">Transfers are available for approved, active individual animals.</p>
        ) : null}
        <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab} className="w-full space-y-6">
          {/* A two-column tab grid gives each section a comfortable touch target on phones. */}
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 bg-slate-100 p-2 sm:flex sm:flex-wrap sm:gap-1 sm:p-1">
            <TabsTrigger
              value="growth"
              className="min-h-11 w-full justify-start whitespace-normal rounded-xl px-2.5 py-2.5 text-left text-xs font-bold leading-snug data-[state=active]:bg-white data-[state=active]:shadow-xs sm:w-auto sm:justify-center sm:px-3.5 sm:py-2 sm:text-center"
            >
              <TrendingUp className="mr-1.5 size-4 shrink-0 text-emerald-600" /> <span>Growth &amp; Weight Logs</span>
            </TabsTrigger>
            <TabsTrigger
              value="production"
              className="min-h-11 w-full justify-start whitespace-normal rounded-xl px-2.5 py-2.5 text-left text-xs font-bold leading-snug data-[state=active]:bg-white data-[state=active]:shadow-xs sm:w-auto sm:justify-center sm:px-3.5 sm:py-2 sm:text-center"
            >
              <Milk className="mr-1.5 size-4 shrink-0 text-sky-600" /> <span>Production</span>
            </TabsTrigger>
            {canShowMilkPredictionTab && (
              <TabsTrigger
                value="milk-prediction"
                className="min-h-11 w-full justify-start whitespace-normal rounded-xl px-2.5 py-2.5 text-left text-xs font-bold leading-snug data-[state=active]:bg-white data-[state=active]:shadow-xs sm:w-auto sm:justify-center sm:px-3.5 sm:py-2 sm:text-center"
              >
                <Milk className="mr-1.5 size-4 shrink-0 text-amber-600" /> <span>Milk Production Prediction</span>
              </TabsTrigger>
            )}
            <TabsTrigger
              value="calving"
              className="min-h-11 w-full justify-start whitespace-normal rounded-xl px-2.5 py-2.5 text-left text-xs font-bold leading-snug data-[state=active]:bg-white data-[state=active]:shadow-xs sm:w-auto sm:justify-center sm:px-3.5 sm:py-2 sm:text-center"
            >
              <Baby className="mr-1.5 size-4 shrink-0 text-pink-600" /> <span>{terms.eventName} &amp; Offspring ({totalCalves})</span>
            </TabsTrigger>
            <TabsTrigger
              value="health"
              className="min-h-11 w-full justify-start whitespace-normal rounded-xl px-2.5 py-2.5 text-left text-xs font-bold leading-snug data-[state=active]:bg-white data-[state=active]:shadow-xs sm:w-auto sm:justify-center sm:px-3.5 sm:py-2 sm:text-center"
            >
              <Stethoscope className="mr-1.5 size-4 shrink-0 text-rose-600" /> <span>Health &amp; Vaccines</span>
            </TabsTrigger>
          <TabsTrigger
            value="pedigree"
              className="min-h-11 w-full justify-start whitespace-normal rounded-xl px-2.5 py-2.5 text-left text-xs font-bold leading-snug data-[state=active]:bg-white data-[state=active]:shadow-xs sm:col-span-1 sm:w-auto sm:justify-center sm:px-3.5 sm:py-2 sm:text-center col-span-2"
            >
              <Heart className="mr-1.5 size-4 shrink-0 text-purple-600" /> <span>Pedigree &amp; Lineage</span>
            </TabsTrigger>
            <TabsTrigger
              value="ownership"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-xs px-3.5 py-2 cursor-pointer"
            >
              Ownership History
            </TabsTrigger>
          </TabsList>

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
                      Historical body weight recordings compared against target market weight ({targetWeight} kg).
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      setNewWeight(String(latestWeight || "70.0"));
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
                    <p className="text-xl font-black text-emerald-950">+{latestAdg} kg/day</p>
                    <p className="text-slate-600 text-[11px]">
                      {weightLogs.length > 1 ? "Computed from verified historical scale readings." : "Baseline estimate until next weigh-in."}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Progress to Target ({targetWeight} kg)
                    </span>
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
                  <p className="text-slate-500 text-[11px]">Across {productionLogs.length} verified production recordings</p>
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
                    Log daily milk volume, egg count, or harvest yield for Tag #{activeItem.tagNumber} to track output.
                  </p>
                  <Button
                    onClick={openProductionDialog}
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-emerald-300 text-emerald-800 font-bold text-xs"
                  >
                    <Plus className="size-3.5 mr-1" /> Log First Yield Output
                  </Button>
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
                  <Button
                    onClick={() => setIsCalvingDialogOpen(true)}
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-pink-300 text-pink-700 hover:bg-pink-50 font-bold text-xs"
                  >
                    <Plus className="size-3.5 mr-1" /> Log First {terms.eventName}
                  </Button>
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

          {/* ── TAB 5: PEDIGREE & LINEAGE ─────────────────────────────────── */}
          <TabsContent value="pedigree" className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6 space-y-4">
              <div>
                <CardTitle className="text-base font-black text-slate-900">
                  Lineage &amp; Parentage Pedigree
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium">
                  Verified genealogical records connecting this animal to its registered dam (mother) and sire (father).
                </CardDescription>
              </div>

              {selfLineage ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">
                      <Dna className="size-3" /> Sire (Father)
                    </span>
                    <p className="text-sm font-black text-slate-900">
                      {selfLineage.sire_tag || "Sire tag not specified"}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      Breed origin: {selfLineage.breed || activeItem.breed}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-rose-600 flex items-center gap-1">
                      <HeartPulse className="size-3" /> Dam (Mother)
                    </span>
                    <p className="text-sm font-black text-slate-900">
                      {selfLineage.dam_tag ? `Dam #${selfLineage.dam_tag}` : `Dam ID #${selfLineage.dam}`}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      Calving ease: {selfLineage.calving_ease || "Normal / Unassisted"} &bull; Birth weight: {selfLineage.birth_weight ? `${selfLineage.birth_weight} kg` : "Standard"}
                    </p>
                  </div>
                </div>
              ) : activeItem.batchCode ? (
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
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <Dna className="size-8 text-slate-400 mx-auto" />
                  <h4 className="font-bold text-sm text-slate-800">Independent Registration</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    This animal was registered as an independent stock item. No maternal or paternal lineage was linked at registration. Offspring born from this animal will automatically appear under the &ldquo;{terms.eventName}&rdquo; tab.
                  </p>
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
            <p className="px-1 text-xs text-slate-500">The animal’s QR remains linked to its canonical inventory ID. It identifies the animal; the backend transfer records hold the changing ownership history.</p>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── MODAL: LOG WEIGHT ─────────────────────────────────────────────── */}
      <Dialog open={isWeighDialogOpen} onOpenChange={setIsWeighDialogOpen}>
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

      {/* ── MODAL: LOG PRODUCTION OUTPUT ──────────────────────────────────── */}
      <Dialog open={isProductionDialogOpen} onOpenChange={setIsProductionDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Milk className="size-5 text-sky-600" />
              <span>Log Production Output for {activeItem.tagNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Record individual daily output. This connects directly to the Production page.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddProduction} className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Production Type *</Label>
              <Select
                value={prodType}
                onValueChange={(val: "MILK" | "MEAT" | "EGGS" | "WOOL") => setProdType(val)}
              >
                <SelectTrigger className="rounded-xl border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableProductionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "MILK" ? "Dairy Milk (Liters)" :
                        type === "MEAT" ? "Meat / Carcass (kg)" :
                          type === "EGGS" ? "Eggs (Pieces)" : "Wool (kg)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">
                Yield Quantity ({prodType === "MILK" ? "Liters" : prodType === "EGGS" ? "Pieces" : "Kilograms"}) *
              </Label>
              <Input
                type="number"
                step="0.1"
                value={prodQuantity}
                onChange={(e) => setProdQuantity(e.target.value)}
                className="rounded-xl border-slate-300 font-black text-lg h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Collection Date *</Label>
              <Input
                type="date"
                value={prodDate}
                onChange={(e) => setProdDate(e.target.value)}
                className="rounded-xl border-slate-300"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Remarks / Quality Notes</Label>
              <Input
                value={prodNotes}
                onChange={(e) => setProdNotes(e.target.value)}
                placeholder="e.g. Morning milking, normal butterfat consistency."
                className="rounded-xl border-slate-300"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsProductionDialogOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={logProductionMutation.isPending}
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
              >
                {logProductionMutation.isPending ? "Submitting..." : "Save Production Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: LOG CALVING / BIRTHING ─────────────────────────────────── */}
      <Dialog open={isCalvingDialogOpen} onOpenChange={setIsCalvingDialogOpen}>
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
                    className={`size-16 rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-br border-2 border-emerald-300 shadow-md mx-auto ${avatar.bgGradient}`}
                  >
                    {avatar.emoji}
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
              onClick={() => window.print()}
              className="livestock-id-pass-action rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex-1 gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="size-3.5" /> Print Animal ID
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
