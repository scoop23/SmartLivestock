"use client";

import React, { useState, useMemo } from "react";
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
import {
  useUserInventory,
  type LivestockInventoryItem,
  getAvatarById,
} from "../livestock-inventory";
import {
  getBirthingTerminology,
  type CalvingRecordItem,
} from "@/app/(farmer)/production-dashboard/production-calving-tab";

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
  const { data: inventories = [], isLoading: isInventoryLoading } = useUserInventory();

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
        breed: directInventory.breed || "Standard Breed",
        sex: directInventory.sex || "Female",
        weight: directInventory.weight ? Number(directInventory.weight) : null,
        lastVaccinationDate: directInventory.last_vaccination_date || null,
        status: directInventory.status || "APPROVED",
        reviewRemarks: directInventory.review_remarks || null,
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
      .sort((a, b) => new Date(a.weighing_date).getTime() - new Date(b.weighing_date).getTime());

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

  // Form States: Weight
  const [newWeight, setNewWeight] = useState(String(latestWeight || "70.0"));
  const [weighDate, setWeighDate] = useState(new Date().toISOString().split("T")[0]);
  const [weighNotes, setWeighNotes] = useState("Routine weigh check");

  // Form States: Production
  const [prodType, setProdType] = useState<"MILK" | "MEAT" | "EGGS" | "WOOL">(
    (activeItem?.livestockTypeName || "").toLowerCase().includes("cattle") ? "MILK" : "MEAT"
  );
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
        description: "Submitted to municipal production telemetry & SIBAT verification.",
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
      toast.error("Please enter a valid yield quantity.");
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
          title="Loading Livestock Profile..."
          subtitle="Retrieving biometrics, production records, and municipal registry..."
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
          title="Livestock Record Not Found"
          subtitle="The requested animal profile could not be found in your municipal inventory."
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
                <ArrowLeft className="size-3.5" /> Back to Livestock Inventory
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
        title={`Livestock Profile: ${activeItem.tagNumber || `ID #${activeItem.id}`}`}
        subtitle={`Official Animal Profile, Biometrics & Municipal Production Registry • Padre Garcia LGU`}
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-6 max-w-7xl mx-auto">
        {/* Navigation & Breadcrumb */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link href="/livestock-inventory">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-slate-300 font-bold text-xs gap-1.5 text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="size-3.5" /> Back to Herd
              </Button>
            </Link>

            {activeItem.batchCode && (
              <Link href="/livestock-inventory/batches">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-emerald-300 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs gap-1.5"
                >
                  <Layers className="size-3.5 text-emerald-600" />
                  <span>Batch: {activeItem.batchCode}</span>
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
          <div className="bg-gradient-to-r from-[#1E4D2B] via-[#245833] to-[#1a4425] text-white p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={activeItem.tagNumber}
                      className="size-16 sm:size-20 rounded-2xl object-cover border-2 border-emerald-400 shadow-md"
                    />
                  ) : (
                    <div
                      className={`size-16 sm:size-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl bg-gradient-to-br border-2 border-white/20 shadow-md ${avatar.bgGradient}`}
                      title={`${avatar.name} (${avatar.badge})`}
                    >
                      {avatar.emoji}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {activeItem.tagNumber}
                    </span>
                    <Badge className="bg-emerald-400 text-emerald-950 font-black text-xs px-2.5 py-0.5">
                      {activeItem.status}
                    </Badge>
                    <Badge variant="outline" className="text-emerald-100 border-emerald-300/40 text-xs font-bold">
                      {activeItem.livestockTypeName}
                    </Badge>
                    {activeItem.batchCode && (
                      <Link href="/livestock-inventory/batches">
                        <Badge className="bg-teal-500/30 hover:bg-teal-500/50 text-teal-200 border-teal-400/40 font-bold text-xs px-2.5 py-0.5 inline-flex items-center gap-1 transition-colors cursor-pointer">
                          <Layers className="size-3" />
                          <span>Cohort: {activeItem.batchCode}</span>
                        </Badge>
                      </Link>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-emerald-100/90">
                    {activeItem.breed || "Standard Breed"} &bull; {activeItem.sex || "Female"}
                  </h3>

                  <p className="text-xs text-emerald-200/70 font-medium">
                    Owner: <strong>{activeItem.farmerName}</strong> &bull; Registration: {activeItem.createdAt ? activeItem.createdAt.split("T")[0] : "Official Record"}
                  </p>
                </div>
              </div>

              {/* Quick Biometrics Right Panel */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-black/20 p-4 rounded-2xl border border-white/10 text-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/60">Live Weight</span>
                  <p className="text-lg font-black text-white">{latestWeight} kg</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/60">Daily Gain (ADG)</span>
                  <p className="text-lg font-black text-emerald-300">+{latestAdg} kg/d</p>
                </div>
                <div className="space-y-0.5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/60">Gender</span>
                  <p className="text-lg font-black text-white">{activeItem.sex || "Female"}</p>
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
              <span className="text-[10px] font-bold uppercase text-slate-400">Carcass Yield Projection</span>
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

        {/* ── TABS: GROWTH, PRODUCTION YIELD, CALVING / BIRTHING, HEALTH, LINEAGE ───────── */}
        <Tabs defaultValue="growth" className="w-full space-y-6">
          <TabsList className="bg-slate-100 p-1 rounded-2xl border border-slate-200/80 flex flex-wrap h-auto gap-1">
            <TabsTrigger
              value="growth"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-xs px-3.5 py-2 cursor-pointer"
            >
              <TrendingUp className="size-3.5 mr-1.5 text-emerald-600" /> Growth &amp; Weight Logs
            </TabsTrigger>
            <TabsTrigger
              value="production"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-xs px-3.5 py-2 cursor-pointer"
            >
              <Milk className="size-3.5 mr-1.5 text-sky-600" /> Production &amp; Yield
            </TabsTrigger>
            <TabsTrigger
              value="calving"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-xs px-3.5 py-2 cursor-pointer"
            >
              <Baby className="size-3.5 mr-1.5 text-pink-600" /> {terms.eventName} &amp; Offspring ({totalCalves})
            </TabsTrigger>
            <TabsTrigger
              value="health"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-xs px-3.5 py-2 cursor-pointer"
            >
              <Stethoscope className="size-3.5 mr-1.5 text-rose-600" /> Health &amp; Vaccines
            </TabsTrigger>
            <TabsTrigger
              value="pedigree"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-xs px-3.5 py-2 cursor-pointer"
            >
              <Heart className="size-3.5 mr-1.5 text-purple-600" /> Pedigree &amp; Lineage
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
                    Animal Production Records (Milk / Meat / Eggs)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium">
                    Outputs logged here connect directly to the municipal Production Telemetry Dashboard and official validation queues.
                  </CardDescription>
                </div>

                <Button
                  onClick={() => setIsProductionDialogOpen(true)}
                  size="sm"
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="size-3.5" /> Log New Output
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Total Recorded Yield</span>
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
                    onClick={() => setIsProductionDialogOpen(true)}
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
                              className={`text-[10px] font-black ${
                                log.status === "APPROVED"
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
                    Maternal progeny records for Tag #{activeItem.tagNumber} linked to Padre Garcia municipal breeding and census telemetry.
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
                      When this animal delivers offspring, record the birth here to register progeny and trace maternal lineage in the municipal database.
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
                          <TableCell className="font-bold text-xs text-slate-800">{calving.calving_date}</TableCell>
                          <TableCell className="font-mono font-bold text-xs text-slate-900">
                            <Badge variant="outline" className="font-mono bg-slate-50 border-slate-200">
                              {calving.calf_tag || "Unregistered"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] font-black ${
                                calving.calf_sex === "FEMALE"
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
                    Veterinary &amp; Biosecurity Record
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium">
                    Official vaccination records, health clearances, and disease incident reports on file with the Padre Garcia municipal vet.
                  </CardDescription>
                </div>

                <Link href="/report-observation">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs gap-1.5"
                  >
                    <AlertTriangle className="size-3.5" /> Report Illness
                  </Button>
                </Link>
              </div>

              <div className="space-y-3 pt-2">
                {activeItem.lastVaccinationDate ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                    <ShieldCheck className="size-5 text-emerald-700 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-slate-900">
                        Official Vaccination Logged &amp; Verified
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Last immunization administered on <strong>{activeItem.lastVaccinationDate}</strong> as certified in the Municipal Livestock Database.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start gap-3">
                    <Clock className="size-5 text-amber-700 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-slate-900">
                        No Vaccination Record On File
                      </p>
                      <p className="text-[11px] text-slate-600">
                        This animal does not currently have a recorded immunization date. Consult your assigned SIBAT officer or barangay livestock technician.
                      </p>
                    </div>
                  </div>
                )}

                {/* Real Disease Cases */}
                {animalDiseaseCases.length > 0 ? (
                  <div className="space-y-2 pt-2">
                    <h5 className="font-bold text-xs text-slate-800">Reported Veterinary Incidents:</h5>
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
                        Clean Disease Record
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Zero active disease incidents or biosecurity quarantine notices recorded for Tag #{activeItem.tagNumber}.
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
                    <Layers className="size-3.5" /> Batch Cohort Origin
                  </span>
                  <p className="text-sm font-black text-slate-900">
                    Registered as part of Cohort: {activeItem.batchName || activeItem.batchCode}
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
              Enter the current scale reading. Saved weights update the animal profile and municipal telemetry in real time.
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
              <Label className="font-bold text-slate-700">Field Notes / Scale Conditions</Label>
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
              Record individual daily output. This connects directly to the Production Dashboard and municipal records.
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
                  <SelectItem value="MILK">Dairy Milk (Liters)</SelectItem>
                  <SelectItem value="MEAT">Meat / Carcass (kg)</SelectItem>
                  <SelectItem value="EGGS">Eggs (Pieces)</SelectItem>
                  <SelectItem value="WOOL">Wool (kg)</SelectItem>
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
                {logProductionMutation.isPending ? "Submitting..." : "Submit to Production Registry"}
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
              Register newborn {terms.offspringName.toLowerCase()} and maternal lineage directly into the municipal birthing registry.
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
                <Label className="font-bold text-slate-700">Birthing Date *</Label>
                <Input
                  type="date"
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
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl max-h-[92vh] overflow-y-auto">
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
              Official Animal ID &amp; Biosecurity Tag
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Municipal Identification, Veterinary Clearance &amp; Health Record
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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

              {/* Scannable SVG QR Code Simulation */}
              <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 mb-2">
                <svg className="size-36" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="10" y="10" width="30" height="30" rx="4" fill="#064E3B" />
                  <rect x="16" y="16" width="18" height="18" rx="2" fill="white" />
                  <rect x="20" y="20" width="10" height="10" rx="1" fill="#064E3B" />

                  <rect x="80" y="10" width="30" height="30" rx="4" fill="#064E3B" />
                  <rect x="86" y="16" width="18" height="18" rx="2" fill="white" />
                  <rect x="90" y="20" width="10" height="10" rx="1" fill="#064E3B" />

                  <rect x="10" y="80" width="30" height="30" rx="4" fill="#064E3B" />
                  <rect x="16" y="86" width="18" height="18" rx="2" fill="white" />
                  <rect x="20" y="90" width="10" height="10" rx="1" fill="#064E3B" />

                  <rect x="48" y="12" width="6" height="6" rx="1" fill="#064E3B" />
                  <rect x="58" y="12" width="6" height="6" rx="1" fill="#064E3B" />
                  <rect x="68" y="18" width="6" height="6" rx="1" fill="#064E3B" />
                  <rect x="48" y="26" width="12" height="6" rx="1" fill="#064E3B" />

                  <rect x="12" y="48" width="6" height="6" rx="1" fill="#064E3B" />
                  <rect x="24" y="48" width="6" height="12" rx="1" fill="#064E3B" />
                  <rect x="12" y="60" width="18" height="6" rx="1" fill="#064E3B" />

                  <rect x="44" y="44" width="32" height="32" rx="6" fill="#10B981" />
                  <circle cx="60" cy="60" r="10" fill="white" />
                  <circle cx="60" cy="60" r="5" fill="#064E3B" />

                  <rect x="82" y="48" width="14" height="6" rx="1" fill="#064E3B" />
                  <rect x="90" y="60" width="18" height="6" rx="1" fill="#064E3B" />
                  <rect x="82" y="70" width="6" height="14" rx="1" fill="#064E3B" />

                  <rect x="48" y="84" width="8" height="8" rx="1" fill="#064E3B" />
                  <rect x="60" y="92" width="14" height="6" rx="1" fill="#064E3B" />
                  <rect x="48" y="102" width="20" height="6" rx="1" fill="#064E3B" />
                  <rect x="84" y="90" width="12" height="6" rx="1" fill="#064E3B" />
                  <rect x="98" y="98" width="10" height="10" rx="1" fill="#064E3B" />
                </svg>
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
                    Cohort: {activeItem.batchCode}
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
                Padre Garcia Municipal Agriculture Office &bull; Animal Biosecurity Pass
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPassportDialogOpen(false)}
              className="rounded-xl font-bold text-xs flex-1"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                toast.success("Print command sent to local printer / PDF export.", {
                  description: `ID Pass for ${activeItem.tagNumber} generated.`,
                });
                setIsPassportDialogOpen(false);
              }}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex-1 gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="size-3.5" /> Print Animal Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
