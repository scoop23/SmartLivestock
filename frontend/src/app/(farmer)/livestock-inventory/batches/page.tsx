"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Layers,
  ArrowLeft,
  Plus,
  Scale,
  ShieldCheck,
  Activity,
  AlertTriangle,
  TrendingUp,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Calendar,
  Sparkles,
  ChevronRight,
  ClipboardList,
  Beef,
  Flame,
  Egg,
  Milk,
  RefreshCw,
  QrCode,
  Tag,
  Clock,
  HelpCircle,
  Printer,
  MapPin,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import {
  useUserInventory,
  useLivestockTypes,
  useLivestockBatches,
  getDefaultAvatarForSpecies,
  type LivestockInventoryItem,
} from "../livestock-inventory";

// ── Types for Individual Animals inside a Batch ──────────────────────────────
export interface BatchIndividual {
  id: string;
  tagNumber: string;
  name: string;
  sex: "Male" | "Female" | "Castrated";
  ageMonths: number;
  weightKg: number;
  adgKgDay: number;
  healthStatus: "Healthy" | "Monitored" | "Vaccinated" | "Quarantined";
  lastWeighedDate: string;
  notes?: string;
}

export interface EnrichedBatch {
  id: string;
  batchCode: string;
  batchName?: string;
  species: string;
  breed: string;
  totalQuantity: number;
  activeCount: number;
  mortalityCount: number;
  targetWeightKg: number;
  averageWeightKg: number;
  acquiredDate: string;
  housingPen: string;
  status: string;
  reviewStatus?: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";
  reviewRemarks?: string;
  feedType: string;
  individuals: BatchIndividual[];
}

// Helper to generate realistic individual animal profiles if batch has no custom DB individuals yet
function generateInitialIndividuals(
  batchId: string,
  batchCode: string,
  species: string,
  quantity: number,
  baseWeight: number
): BatchIndividual[] {
  const isSwine = species.toLowerCase().includes("swine") || species.toLowerCase().includes("pig");
  const isPoultry = species.toLowerCase().includes("poultry") || species.toLowerCase().includes("chicken");
  const isCattle = species.toLowerCase().includes("cattle") || species.toLowerCase().includes("cow");

  const results: BatchIndividual[] = [];
  const defaultCount = Math.min(Math.max(quantity, 4), 20);

  for (let i = 1; i <= defaultCount; i++) {
    const pad = i.toString().padStart(2, "0");
    const tag = `${batchCode.replace("BATCH-", "")}-${pad}`;

    // Slight natural variation in weight (+/- 8%)
    const variation = (Math.sin(i * 1.7) * 0.08) * baseWeight;
    const finalWeight = Math.round((baseWeight + variation) * 10) / 10;

    const sex: "Male" | "Female" | "Castrated" = isSwine
      ? (i % 2 === 0 ? "Female" : i % 3 === 0 ? "Castrated" : "Male")
      : (i % 2 === 0 ? "Female" : "Male");

    const age = isPoultry ? 1.8 : isSwine ? 4.5 : isCattle ? 14 : 6;
    const adg = isPoultry ? 0.04 : isSwine ? 0.72 : isCattle ? 0.85 : 0.25;

    results.push({
      id: `${batchId}-${i}`,
      tagNumber: tag,
      name: `Livestock #${i}`,
      sex: sex,
      ageMonths: age,
      weightKg: Math.max(finalWeight, 1),
      adgKgDay: Math.round((adg + (Math.cos(i) * 0.05)) * 100) / 100,
      healthStatus: i === 3 ? "Monitored" : i === 7 ? "Vaccinated" : "Healthy",
      lastWeighedDate: "2026-09-20",
      notes: i === 3 ? "Mild lethargy noted yesterday, normal appetite today." : undefined,
    });
  }
  return results;
}

// Helper to render official regulatory review badge for cohorts
function getReviewStatusBadge(status?: string) {
  if (status === "APPROVED") {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-black px-1.5 py-0 gap-1 shrink-0"
      >
        <ShieldCheck className="size-3 text-emerald-600" /> MAO Approved
      </Badge>
    );
  }
  if (status === "VERIFIED") {
    return (
      <Badge
        variant="outline"
        className="bg-sky-50 text-sky-800 border-sky-300 text-[10px] font-black px-1.5 py-0 gap-1 shrink-0"
      >
        <CheckCircle2 className="size-3 text-sky-600" /> SIBAT Verified
      </Badge>
    );
  }
  if (status === "SUBJECT_TO_REVISION") {
    return (
      <Badge
        variant="outline"
        className="bg-rose-50 text-rose-800 border-rose-300 text-[10px] font-black px-1.5 py-0 gap-1 shrink-0"
      >
        <AlertTriangle className="size-3 text-rose-600" /> Revision Needed
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-black px-1.5 py-0 gap-1 shrink-0"
    >
      <Clock className="size-3 text-amber-600" /> Pending Review
    </Badge>
  );
}

export default function BatchOverviewPage() {
  const router = useRouter();
  const { data: rawInventories = [], isLoading } = useUserInventory();
  const { data: backendBatches = [] } = useLivestockBatches();

  // Local state for interactive enhancements
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("ALL");
  const [healthFilter, setHealthFilter] = useState<string>("ALL");

  // Dialog States
  const [isAddIndividualOpen, setIsAddIndividualOpen] = useState(false);
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
  const [isBatchProductionOpen, setIsBatchProductionOpen] = useState(false);
  const [isQrCardOpen, setIsQrCardOpen] = useState(false);
  const [weighTarget, setWeighTarget] = useState<BatchIndividual | null>(null);
  const [newWeightInput, setNewWeightInput] = useState<string>("");

  // Form for adding individual to batch
  const [newAnimalData, setNewAnimalData] = useState({
    tagNumber: "",
    name: "",
    sex: "Female" as "Male" | "Female" | "Castrated",
    ageMonths: "4",
    weightKg: "65",
    healthStatus: "Healthy" as "Healthy" | "Monitored" | "Vaccinated",
  });

  // Production recording state
  const [batchProductionData, setBatchProductionData] = useState({
    productionType: "meat",
    quantity: "45",
    unit: "kg",
    recordDate: new Date().toISOString().split("T")[0],
    notes: "Batch growth sampling & feed conversion check",
  });

  // Local store of custom added or updated individuals
  const [customIndividuals, setCustomIndividuals] = useState<Record<string, BatchIndividual[]>>({});

  // Hydrate custom batch individuals from localStorage (from Add Livestock batch registration)
  useEffect(() => {
    try {
      const stored: Record<string, BatchIndividual[]> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("batch_individuals_")) {
          const batchId = key.replace("batch_individuals_", "");
          const raw = localStorage.getItem(key);
          if (raw) {
            stored[batchId] = JSON.parse(raw);
          }
        }
      }
      if (Object.keys(stored).length > 0) {
        setCustomIndividuals((prev) => ({ ...prev, ...stored }));
      }
    } catch (e) {
      console.error("Failed to load local batch individuals:", e);
    }
  }, []);

  // Compile Batches from Backend API + Inventory (or seed intelligent defaults if none)
  const batches: EnrichedBatch[] = useMemo(() => {
    // 1. Batches from dedicated backend LivestockBatch API
    const apiBatches: EnrichedBatch[] = backendBatches.map((b) => {
      const indList: BatchIndividual[] =
        b.animals && b.animals.length > 0
          ? b.animals.map((a, idx) => ({
            id: String(a.id),
            tagNumber: a.tagNumber || `${b.batchCode}-${(idx + 1).toString().padStart(2, "0")}`,
            name: a.tagNumber ? `Animal ${a.tagNumber}` : `Animal #${idx + 1}`,
            sex:
              a.sex?.toUpperCase() === "MALE"
                ? ("Male" as const)
                : a.sex?.toUpperCase() === "CASTRATED"
                  ? ("Castrated" as const)
                  : ("Female" as const),
            ageMonths: 4,
            weightKg: a.weight ? Number(a.weight) : 65,
            adgKgDay: 0.72,
            healthStatus: a.lastVaccinationDate ? ("Vaccinated" as const) : ("Healthy" as const),
            lastWeighedDate: a.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0],
          }))
          : customIndividuals[String(b.id)] ||
          generateInitialIndividuals(
            String(b.id),
            b.batchCode,
            b.livestockTypeName,
            b.totalAnimals || 1,
            b.averageWeight || 65
          );

      const computedAvgWeight =
        indList.length > 0
          ? Math.round(
            (indList.reduce((acc, curr) => acc + curr.weightKg, 0) / indList.length) * 10
          ) / 10
          : b.averageWeight || 65;

      return {
        id: String(b.id),
        batchCode: b.batchCode,
        batchName: b.batchName || `${b.livestockTypeName} Cohort`,
        species: b.livestockTypeName,
        breed: b.animals?.[0]?.breed || "Cohort Roster",
        totalQuantity: b.totalAnimals || indList.length,
        activeCount: indList.length,
        mortalityCount: 0,
        targetWeightKg: b.targetWeight || 90,
        averageWeightKg: computedAvgWeight,
        acquiredDate: b.createdAt ? b.createdAt.split("T")[0] : "2026-06-01",
        housingPen: b.housingPen || "Standard Pen",
        status: b.status || "ACTIVE",
        reviewStatus: b.reviewStatus || "PENDING",
        reviewRemarks: b.reviewRemarks,
        feedType: b.feedType || "Farm Rations",
        individuals: indList,
      };
    });

    // 2. Legacy batch entries from raw inventory
    const legacyBatchItems = rawInventories.filter(
      (item) => item.entryType === "BATCH" && !backendBatches.some((bb) => bb.batchCode === item.tagNumber)
    );

    const legacyBatches: EnrichedBatch[] = legacyBatchItems.map((item, index) => {
      const batchCode = item.tagNumber || `BATCH-${item.livestockTypeName.slice(0, 3).toUpperCase()}-${item.id}`;
      const baseWeight = item.weight || (item.livestockTypeName.toLowerCase().includes("swine") ? 65 : 35);
      const indKey = String(item.id);

      const generated = customIndividuals[indKey] || generateInitialIndividuals(
        indKey,
        batchCode,
        item.livestockTypeName,
        item.quantity,
        baseWeight
      );

      const avgWeight =
        generated.length > 0
          ? Math.round(
            (generated.reduce((acc, curr) => acc + curr.weightKg, 0) / generated.length) * 10
          ) / 10
          : baseWeight;

      return {
        id: String(item.id),
        batchCode: batchCode,
        batchName: item.batchName || `${item.livestockTypeName} Cohort`,
        species: item.livestockTypeName,
        breed: item.breed || "Standard Hybrid",
        totalQuantity: item.quantity,
        activeCount: generated.length || item.quantity,
        mortalityCount: 0,
        targetWeightKg: item.livestockTypeName.toLowerCase().includes("swine") ? 90 : 45,
        averageWeightKg: avgWeight,
        acquiredDate: item.createdAt ? item.createdAt.split("T")[0] : "2026-06-01",
        housingPen: `Enclosure Pen ${index + 1}`,
        status: "ACTIVE",
        reviewStatus: (item.status as any) || "PENDING",
        reviewRemarks: item.reviewRemarks || undefined,
        feedType: "Local LGU Agri-Blend Formula",
        individuals: generated,
      };
    });

    const combined = [...apiBatches, ...legacyBatches];
    if (combined.length > 0) {
      return combined;
    }

    // Demo batches if completely empty
    const demoBatches: EnrichedBatch[] = [
      {
        id: "demo-batch-1",
        batchCode: "BATCH-SWN-2026-01",
        species: "Swine",
        breed: "Large White x Landrace",
        totalQuantity: 10,
        activeCount: 10,
        mortalityCount: 0,
        targetWeightKg: 90,
        averageWeightKg: 68.4,
        acquiredDate: "2026-06-15",
        housingPen: "Pen 3 - Fattening Barn",
        status: "ACTIVE",
        reviewStatus: "APPROVED",
        feedType: "Commercial Finisher Pellets",
        individuals: customIndividuals["demo-batch-1"] || generateInitialIndividuals(
          "demo-batch-1",
          "BATCH-SWN-2026-01",
          "Swine",
          10,
          68.4
        ),
      },
      {
        id: "demo-batch-2",
        batchCode: "BATCH-PLT-2026-04",
        species: "Poultry",
        breed: "Lohmann Brown (Layer)",
        totalQuantity: 30,
        activeCount: 29,
        mortalityCount: 1,
        targetWeightKg: 2.2,
        averageWeightKg: 1.95,
        acquiredDate: "2026-07-01",
        housingPen: "Coop B - Free Range Enclosure",
        status: "ACTIVE",
        reviewStatus: "VERIFIED",
        feedType: "Layer Mash 18% Protein",
        individuals: customIndividuals["demo-batch-2"] || generateInitialIndividuals(
          "demo-batch-2",
          "BATCH-PLT-2026-04",
          "Poultry",
          8,
          1.95
        ),
      },
      {
        id: "demo-batch-3",
        batchCode: "BATCH-GOAT-2026-02",
        species: "Goat",
        breed: "Boer x Anglo-Nubian",
        totalQuantity: 6,
        activeCount: 6,
        mortalityCount: 0,
        targetWeightKg: 45,
        averageWeightKg: 34.2,
        acquiredDate: "2026-05-10",
        housingPen: "Paddock 2 - Elevated Slatted Pen",
        status: "ACTIVE",
        reviewStatus: "PENDING",
        feedType: "Napier Grass & Goat Concentrate",
        individuals: customIndividuals["demo-batch-3"] || generateInitialIndividuals(
          "demo-batch-3",
          "BATCH-GOAT-2026-02",
          "Goat",
          6,
          34.2
        ),
      },
    ];
    return demoBatches;
  }, [backendBatches, rawInventories, customIndividuals]);

  // Active selected batch
  const currentBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null;
    const found = batches.find((b) => b.id === selectedBatchId);
    return found || batches[0];
  }, [batches, selectedBatchId]);

  // Filter individuals inside current batch
  const filteredIndividuals = useMemo(() => {
    if (!currentBatch) return [];
    return currentBatch.individuals.filter((animal) => {
      const matchSearch =
        animal.tagNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        animal.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchGender = genderFilter === "ALL" || animal.sex.toUpperCase() === genderFilter.toUpperCase();
      const matchHealth = healthFilter === "ALL" || animal.healthStatus.toUpperCase() === healthFilter.toUpperCase();
      return matchSearch && matchGender && matchHealth;
    });
  }, [currentBatch, searchQuery, genderFilter, healthFilter]);

  // Calculations for Batch Yield
  const yieldMetrics = useMemo(() => {
    if (!currentBatch) return { totalBiomass: 0, dressedYieldKg: 0, dressingPct: 75, readinessPct: 0 };
    const totalBiomass = Math.round(
      currentBatch.individuals.reduce((acc, curr) => acc + curr.weightKg, 0) * 10
    ) / 10;

    // Standard dressing percentage by species
    let dressingPct = 75; // Swine ~75%
    if (currentBatch.species.toLowerCase().includes("poultry")) dressingPct = 70;
    if (currentBatch.species.toLowerCase().includes("cattle")) dressingPct = 58;
    if (currentBatch.species.toLowerCase().includes("goat")) dressingPct = 50;

    const dressedYieldKg = Math.round((totalBiomass * (dressingPct / 100)) * 10) / 10;
    const readinessPct = Math.min(
      Math.round((currentBatch.averageWeightKg / currentBatch.targetWeightKg) * 100),
      100
    );

    return { totalBiomass, dressedYieldKg, dressingPct, readinessPct };
  }, [currentBatch]);

  // Handlers
  const handleOpenWeighModal = (animal: BatchIndividual) => {
    setWeighTarget(animal);
    setNewWeightInput(String(animal.weightKg));
    setIsWeighModalOpen(true);
  };

  const handleSaveWeight = () => {
    if (!weighTarget || !currentBatch) return;
    const weightNum = parseFloat(newWeightInput);
    if (isNaN(weightNum) || weightNum <= 0) {
      toast.error("Please enter a valid weight in kilograms.");
      return;
    }

    const updated = currentBatch.individuals.map((ind) => {
      if (ind.id === weighTarget.id) {
        const diff = weightNum - ind.weightKg;
        return {
          ...ind,
          weightKg: weightNum,
          adgKgDay: diff > 0 ? Math.round((ind.adgKgDay + 0.05) * 100) / 100 : ind.adgKgDay,
          lastWeighedDate: new Date().toISOString().split("T")[0],
        };
      }
      return ind;
    });

    setCustomIndividuals((prev) => ({
      ...prev,
      [currentBatch.id]: updated,
    }));

    try {
      localStorage.setItem(`batch_individuals_${currentBatch.id}`, JSON.stringify(updated));
    } catch (e) {
      console.error("Local storage sync error:", e);
    }

    toast.success(`Weight updated for ${weighTarget.tagNumber}: ${weightNum} kg`);
    setIsWeighModalOpen(false);
  };

  const handleAddIndividual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBatch) return;

    if (!newAnimalData.tagNumber.trim()) {
      toast.error("Ear Tag Number is required.");
      return;
    }

    const newInd: BatchIndividual = {
      id: `${currentBatch.id}-${Date.now()}`,
      tagNumber: newAnimalData.tagNumber.trim().toUpperCase(),
      name: newAnimalData.name.trim() || `Livestock #${currentBatch.individuals.length + 1}`,
      sex: newAnimalData.sex,
      ageMonths: parseFloat(newAnimalData.ageMonths) || 4,
      weightKg: parseFloat(newAnimalData.weightKg) || currentBatch.averageWeightKg,
      adgKgDay: 0.72,
      healthStatus: newAnimalData.healthStatus,
      lastWeighedDate: new Date().toISOString().split("T")[0],
    };

    const updated = [...currentBatch.individuals, newInd];
    setCustomIndividuals((prev) => ({
      ...prev,
      [currentBatch.id]: updated,
    }));

    try {
      localStorage.setItem(`batch_individuals_${currentBatch.id}`, JSON.stringify(updated));
    } catch (e) {
      console.error("Local storage sync error:", e);
    }

    toast.success(`Animal ${newInd.tagNumber} registered to ${currentBatch.batchCode}!`);
    setIsAddIndividualOpen(false);
    setNewAnimalData({
      tagNumber: "",
      name: "",
      sex: "Female",
      ageMonths: "4",
      weightKg: "65",
      healthStatus: "Healthy",
    });
  };

  return (
    <>
      <PageHeader
        title="Livestock Batch & Flock Overview"
        subtitle="Monitor cohort performance, individual animal tracking within batches, and aggregate yield."
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-6 max-w-7xl mx-auto">
        {/* Top Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <Link href="/livestock-inventory">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-slate-300 font-bold text-xs gap-1.5 text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="size-3.5" /> Back to Herd
              </Button>
            </Link>
            <span className="text-xs font-semibold text-slate-400">|</span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Layers className="size-4 text-emerald-600" />
              <span>{batches.length} Active Batches on Record</span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={() => setIsBatchProductionOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-xl border-emerald-600/30 text-emerald-800 hover:bg-emerald-50 font-bold text-xs gap-1.5 cursor-pointer"
            >
              <TrendingUp className="size-3.5 text-emerald-600" /> Log Batch Yield
            </Button>

            <Button
              onClick={() => {
                if (currentBatch) {
                  const nextPad = (currentBatch.individuals.length + 1).toString().padStart(2, "0");
                  setNewAnimalData((prev) => ({
                    ...prev,
                    tagNumber: `${currentBatch.batchCode.replace("BATCH-", "")}-${nextPad}`,
                  }));
                }
                setIsAddIndividualOpen(true);
              }}
              size="sm"
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="size-4" /> Add Animal to Batch
            </Button>
          </div>
        </div>

        {/* ── BATCH SELECTOR CARDS ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {batches.map((batch) => {
            const isSelected = currentBatch?.id === batch.id;
            const avatar = getDefaultAvatarForSpecies(batch.species);
            const headCount = batch.individuals?.length || batch.totalQuantity || 0;
            const targetKg =
              batch.targetWeightKg > 0
                ? batch.targetWeightKg
                : batch.averageWeightKg > 0
                  ? Math.round(batch.averageWeightKg * 1.3)
                  : 90;
            const weightProgress = Math.min(
              100,
              Math.max(0, Math.round((batch.averageWeightKg / targetKg) * 100))
            );

            return (
              <Card
                key={batch.id}
                onClick={() => setSelectedBatchId(batch.id)}
                className={`group relative cursor-pointer transition-all duration-200 rounded-2xl border-2 overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? "border-emerald-600 bg-gradient-to-b from-emerald-50/50 via-white to-emerald-50/20 shadow-md ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:border-emerald-300 hover:shadow-md bg-white hover:-translate-y-0.5"
                }`}
              >
                {/* Top Ambient Glow / Accent Strip */}
                <div
                  className={`h-1.5 w-full transition-colors ${
                    isSelected
                      ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500"
                      : "bg-transparent group-hover:bg-emerald-400/40"
                  }`}
                />

                <CardContent className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Header Row: Species & MAO Status on left, Head count on right */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-emerald-100 text-emerald-900 border border-emerald-200/80 shadow-2xs">
                          <span>{avatar.emoji}</span>
                          <span>{batch.species}</span>
                        </span>
                        {getReviewStatusBadge(batch.reviewStatus)}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-baseline justify-end gap-1">
                          <span className="text-xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                            {headCount}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-slate-400">Heads</span>
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-emerald-600">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active</span>
                        </div>
                      </div>
                    </div>

                    {/* Batch Name & Tag Subtitle */}
                    <div className="space-y-1">
                      <h4 className="font-black text-base text-slate-900 leading-snug group-hover:text-emerald-900 transition-colors line-clamp-1">
                        {batch.batchName || `${batch.species} Cohort`}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {batch.batchCode}
                        </span>
                        <span className="text-slate-300 font-bold">&bull;</span>
                        <span className="text-slate-500 font-medium truncate max-w-[160px]">
                          {batch.breed}
                        </span>
                      </div>
                    </div>

                    {/* Weight & Target Progress Bar */}
                    <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-100/90 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                          <Scale className="size-3 text-slate-400" /> Avg Weight
                        </span>
                        <span className="font-bold text-slate-800 text-xs">
                          {batch.averageWeightKg} kg{" "}
                          <span className="text-[10px] font-medium text-slate-400">
                            / {targetKg} kg
                          </span>
                          <span className="ml-1 text-[10px] font-black text-emerald-600">
                            ({weightProgress}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            weightProgress >= 90
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                              : weightProgress >= 60
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                                : "bg-gradient-to-r from-amber-500 to-emerald-500"
                          }`}
                          style={{ width: `${weightProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Pen & Feed Quick Specs */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-0.5 border-t border-slate-100/80">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="size-3.5 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">
                            Housing Pen
                          </span>
                          <p className="font-bold text-slate-700 truncate leading-tight text-xs mt-0.5">
                            {batch.housingPen || "Standard Pen"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Flame className="size-3.5 text-amber-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">
                            Feed Ration
                          </span>
                          <p className="font-bold text-slate-700 truncate leading-tight text-xs mt-0.5">
                            {batch.feedType || "Farm Rations"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Selection Status / Inspect Action */}
                  <div className="pt-2">
                    {isSelected ? (
                      <div className="flex items-center justify-between text-[11px] font-black text-emerald-800 bg-emerald-100/90 py-1.5 px-2.5 rounded-lg border border-emerald-300/80 shadow-2xs">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-emerald-700" />
                          <span>Currently Inspecting</span>
                        </div>
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-700 bg-white/90 px-1.5 py-0.5 rounded shadow-2xs">
                          Active
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 group-hover:text-emerald-700 py-1 px-2.5 rounded-lg group-hover:bg-emerald-50/70 transition-colors">
                        <span>Click to inspect cohort</span>
                        <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── ACTIVE BATCH OVERVIEW HERO & KPIS ───────────────────────────── */}
        {currentBatch && (
          <div className="space-y-6">
            {/* Banner Header */}
            <div className="bg-gradient-to-r from-[#1E4D2B] via-[#245833] to-[#1a4425] text-white p-6 rounded-3xl shadow-lg border border-emerald-800/40 relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-bold uppercase tracking-wider backdrop-blur-xs border border-white/10">
                    <Beef className="size-3.5" />
                    <span>Cohort ID: {currentBatch.batchCode}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                    {currentBatch.batchName || `${currentBatch.species} Cohort`}
                  </h2>
                  <p className="text-xs text-emerald-100/80 font-medium">
                    {currentBatch.batchCode} &bull; {currentBatch.species} &bull; {currentBatch.breed}
                  </p>
                  {currentBatch.reviewRemarks && (
                    <div className="inline-block mt-1">
                      <p className="text-[11px] text-emerald-200/90 italic bg-black/25 px-2.5 py-1 rounded-lg border border-white/10 max-w-xl">
                        Official LGU Note: &ldquo;{currentBatch.reviewRemarks}&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Herd Lifecycle Status (Active in pen vs harvested/sold) */}
                  <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 font-bold px-3 py-1.5 text-xs flex items-center gap-1.5 shadow-sm">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    Herd: {currentBatch.status || "ACTIVE"}
                  </Badge>

                  {/* LGU Municipal Regulatory Review Status */}
                  {currentBatch.reviewStatus === "APPROVED" ? (
                    <Badge className="bg-emerald-400 text-emerald-950 font-black px-3 py-1.5 text-xs flex items-center gap-1 shadow-sm">
                      <ShieldCheck className="size-3.5" /> MAO APPROVED
                    </Badge>
                  ) : currentBatch.reviewStatus === "VERIFIED" ? (
                    <Badge className="bg-blue-400 text-blue-950 font-black px-3 py-1.5 text-xs flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="size-3.5" /> SIBAT VERIFIED
                    </Badge>
                  ) : currentBatch.reviewStatus === "SUBJECT_TO_REVISION" ? (
                    <Badge className="bg-amber-400 text-amber-950 font-black px-3 py-1.5 text-xs flex items-center gap-1 shadow-sm">
                      <AlertTriangle className="size-3.5" /> REVISION NEEDED
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100/20 text-amber-200 border border-amber-300/40 font-black px-3 py-1.5 text-xs flex items-center gap-1 shadow-sm">
                      <Clock className="size-3.5" /> PENDING VERIFICATION
                    </Badge>
                  )}

                  {/* Printable Biosecurity QR Pass Button */}
                  <Button
                    onClick={() => setIsQrCardOpen(true)}
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 text-xs font-bold rounded-xl gap-1.5 cursor-pointer shadow-sm"
                  >
                    <QrCode className="size-3.5" /> Batch QR Card
                  </Button>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Head Count</span>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-black text-slate-900">
                      {currentBatch.individuals.length}
                    </p>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      100% Alive
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">0 mortalities • 0 culled</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Average Weight</span>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-black text-slate-900">
                      {currentBatch.averageWeightKg} <span className="text-sm font-semibold text-slate-400">kg</span>
                    </p>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      +0.72 kg/d
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">Target: {currentBatch.targetWeightKg} kg</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Total Live Biomass</span>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-black text-emerald-700">
                      {yieldMetrics.totalBiomass} <span className="text-sm font-semibold text-slate-400">kg</span>
                    </p>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      ~{yieldMetrics.dressedYieldKg} kg meat
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">{yieldMetrics.dressingPct}% dressing yield</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Harvest Readiness</span>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-black text-slate-900">
                      {yieldMetrics.readinessPct}%
                    </p>
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                      ~22 days
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-emerald-600 h-1.5 rounded-full"
                      style={{ width: `${yieldMetrics.readinessPct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── HOW THIS WORKS ON PRODUCTION / YIELD EXPLANATION CARD ──── */}
            <Card className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 to-teal-50/50 shadow-xs overflow-hidden">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <TrendingUp className="size-5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                      <span>How Batch vs. Individual Tracking Powers Production & Yield</span>
                      {/* <Badge className="bg-emerald-200 text-emerald-900 text-[9px] font-black">Capstone Standard</Badge> */}
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      In livestock science, batches represent commercial cohorts (e.g. 10 fatteners or 30 layers), but each animal has distinct biological gain. By tracking individual weight and health below:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
                  <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 space-y-1">
                    <p className="font-black text-slate-900 flex items-center gap-1.5">
                      <Scale className="size-3.5 text-emerald-600" /> Average Daily Gain (ADG)
                    </p>
                    <p className="text-slate-600 text-[11px]">
                      Comparing individual weights against batch average ({currentBatch.averageWeightKg} kg) reveals top growers vs runts in the cohort.
                    </p>
                  </div>

                  <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 space-y-1">
                    <p className="font-black text-slate-900 flex items-center gap-1.5">
                      <Beef className="size-3.5 text-amber-600" /> Meat & Dressing Percentage
                    </p>
                    <p className="text-slate-600 text-[11px]">
                      Total batch liveweight ({yieldMetrics.totalBiomass} kg) projects {yieldMetrics.dressedYieldKg} kg carcass yield for Padre Garcia slaughterhouse and livestock auction.
                    </p>
                  </div>

                  <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 space-y-1">
                    <p className="font-black text-slate-900 flex items-center gap-1.5">
                      <Egg className="size-3.5 text-sky-600" /> Dairy & Egg Aggregate Output
                    </p>
                    <p className="text-slate-600 text-[11px]">
                      For layers or dairy herds, yield logs can be entered once for the batch and distributed or correlated with individual head counts.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── INDIVIDUAL LIVESTOCK ROSTER (ADVISOR REQUIREMENT) ───────── */}
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
              <CardHeader className="p-5 md:p-6 pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>Individual Livestock in {currentBatch.batchCode}</span>
                    <Badge variant="outline" className="text-xs font-bold border-slate-300">
                      {filteredIndividuals.length} of {currentBatch.individuals.length} Listed
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium">
                    Monitor each animal&apos;s distinct gender, age, weight, and health within this batch.
                  </CardDescription>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-44">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                    <Input
                      placeholder="Search ear tag..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-xs rounded-xl border-slate-200"
                    />
                  </div>

                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger className="h-8 text-xs rounded-xl border-slate-200 w-28 font-bold">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Genders</SelectItem>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="CASTRATED">Castrated</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={healthFilter} onValueChange={setHealthFilter}>
                    <SelectTrigger className="h-8 text-xs rounded-xl border-slate-200 w-32 font-bold">
                      <SelectValue placeholder="Health" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Health</SelectItem>
                      <SelectItem value="HEALTHY">Healthy</SelectItem>
                      <SelectItem value="MONITORED">Monitored</SelectItem>
                      <SelectItem value="VACCINATED">Vaccinated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/70">
                      <TableRow>
                        <TableHead className="font-bold text-xs text-slate-600">Tag / Ear ID</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Animal Label</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Gender</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Age / Stage</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Weight (kg)</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Daily Gain (ADG)</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Health Status</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600 text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIndividuals.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10 text-xs text-slate-400 font-medium">
                            No individual livestock matched the current filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredIndividuals.map((animal) => {
                          const isAboveAvg = animal.weightKg >= currentBatch.averageWeightKg;
                          return (
                            <TableRow key={animal.id} className="hover:bg-slate-50/60 transition-colors">
                              <TableCell className="font-black text-xs text-slate-900">
                                <Link
                                  href={`/livestock-inventory/${animal.tagNumber}`}
                                  className="text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1.5"
                                >
                                  <Tag className="size-3 text-emerald-600" />
                                  <span>{animal.tagNumber}</span>
                                </Link>
                              </TableCell>

                              <TableCell className="text-xs font-semibold text-slate-700">
                                {animal.name}
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] font-black uppercase ${animal.sex === "Female"
                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : animal.sex === "Male"
                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                >
                                  {animal.sex}
                                </Badge>
                              </TableCell>

                              <TableCell className="text-xs text-slate-600 font-medium">
                                {animal.ageMonths} mos
                              </TableCell>

                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-slate-900">{animal.weightKg} kg</span>
                                  <span
                                    className={`text-[10px] font-bold ${isAboveAvg ? "text-emerald-600" : "text-amber-600"
                                      }`}
                                  >
                                    ({isAboveAvg ? "+" : ""}{(animal.weightKg - currentBatch.averageWeightKg).toFixed(1)})
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="text-xs font-bold text-emerald-700">
                                +{animal.adgKgDay} kg/d
                              </TableCell>

                              <TableCell>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${animal.healthStatus === "Healthy"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : animal.healthStatus === "Vaccinated"
                                        ? "bg-sky-100 text-sky-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                >
                                  <span className="size-1.5 rounded-full bg-current" />
                                  {animal.healthStatus}
                                </span>
                              </TableCell>

                              <TableCell className="text-right pr-6">
                                <div className="inline-flex items-center gap-1.5">
                                  <Button
                                    onClick={() => handleOpenWeighModal(animal)}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px] rounded-lg font-bold border-slate-200 hover:bg-emerald-50 hover:text-emerald-800"
                                    title="Quick Log Weight"
                                  >
                                    <Scale className="size-3 mr-1 text-emerald-600" /> Weigh
                                  </Button>

                                  <Link href={`/livestock-inventory/${animal.tagNumber}`}>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-[11px] rounded-lg font-bold text-slate-700 hover:bg-slate-100"
                                    >
                                      <Eye className="size-3 mr-1 text-slate-500" /> Details
                                    </Button>
                                  </Link>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── DIALOG: QUICK WEIGH ANIMAL ────────────────────────────────────── */}
      <Dialog open={isWeighModalOpen} onOpenChange={setIsWeighModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Scale className="size-5 text-emerald-600" />
              <span>Record New Weight for {weighTarget?.tagNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Update body weight to automatically calculate Average Daily Gain (ADG) and yield projection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
              <span className="font-bold text-slate-600">Previous Recorded Weight:</span>
              <span className="font-black text-slate-900">{weighTarget?.weightKg} kg</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">New Live Weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={newWeightInput}
                onChange={(e) => setNewWeightInput(e.target.value)}
                placeholder="e.g. 72.5"
                className="rounded-xl border-slate-300 font-black text-lg h-11"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsWeighModalOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveWeight}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
            >
              Save Weigh Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: ADD INDIVIDUAL TO BATCH ───────────────────────────────── */}
      <Dialog open={isAddIndividualOpen} onOpenChange={setIsAddIndividualOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <form onSubmit={handleAddIndividual}>
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Plus className="size-5 text-emerald-600" />
                <span>Add Animal to {currentBatch?.batchCode}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Register a new individual animal in this cohort with its specific ear tag, gender, and starting weight.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3.5 py-4 text-xs">
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Ear Tag Number</Label>
                <Input
                  value={newAnimalData.tagNumber}
                  onChange={(e) => setNewAnimalData({ ...newAnimalData, tagNumber: e.target.value })}
                  placeholder="e.g. SWN-01-11"
                  className="rounded-xl border-slate-300 font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Animal Name / Identifier</Label>
                <Input
                  value={newAnimalData.name}
                  onChange={(e) => setNewAnimalData({ ...newAnimalData, name: e.target.value })}
                  placeholder="e.g. Livestock #11"
                  className="rounded-xl border-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Gender</Label>
                <Select
                  value={newAnimalData.sex}
                  onValueChange={(val: any) => setNewAnimalData({ ...newAnimalData, sex: val })}
                >
                  <SelectTrigger className="rounded-xl border-slate-300 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Female">Female (Sow / Dam / Hen)</SelectItem>
                    <SelectItem value="Male">Male (Boar / Bull / Rooster)</SelectItem>
                    <SelectItem value="Castrated">Castrated / Barrow / Steer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Age (Months)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newAnimalData.ageMonths}
                  onChange={(e) => setNewAnimalData({ ...newAnimalData, ageMonths: e.target.value })}
                  className="rounded-xl border-slate-300 font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Current Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newAnimalData.weightKg}
                  onChange={(e) => setNewAnimalData({ ...newAnimalData, weightKg: e.target.value })}
                  className="rounded-xl border-slate-300 font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Initial Health Status</Label>
                <Select
                  value={newAnimalData.healthStatus}
                  onValueChange={(val: any) => setNewAnimalData({ ...newAnimalData, healthStatus: val })}
                >
                  <SelectTrigger className="rounded-xl border-slate-300 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Healthy">Healthy & Active</SelectItem>
                    <SelectItem value="Vaccinated">Vaccinated</SelectItem>
                    <SelectItem value="Monitored">Monitored / Under Observation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddIndividualOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
              >
                Save to Cohort
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: LOG BATCH PRODUCTION OUTPUT ──────────────────────────── */}
      <Dialog open={isBatchProductionOpen} onOpenChange={setIsBatchProductionOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="size-5 text-emerald-600" />
              <span>Log Production for {currentBatch?.batchCode}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Record collective batch production such as daily egg harvest, collective milk collection, or feed intake.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Production Type</Label>
              <Select
                value={batchProductionData.productionType}
                onValueChange={(v) =>
                  setBatchProductionData({
                    ...batchProductionData,
                    productionType: v,
                    unit: v === "eggs" ? "pc" : v === "milk" ? "L" : "kg",
                  })
                }
              >
                <SelectTrigger className="rounded-xl border-slate-300 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meat">Meat / Growth Biomass (kg)</SelectItem>
                  <SelectItem value="eggs">Egg Harvest (pc / trays)</SelectItem>
                  <SelectItem value="milk">Dairy Milk (Liters)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Quantity Harvested</Label>
                <Input
                  type="number"
                  value={batchProductionData.quantity}
                  onChange={(e) => setBatchProductionData({ ...batchProductionData, quantity: e.target.value })}
                  className="rounded-xl border-slate-300 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Unit</Label>
                <Input
                  value={batchProductionData.unit}
                  disabled
                  className="rounded-xl border-slate-200 bg-slate-50 font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Observation Notes</Label>
              <Input
                value={batchProductionData.notes}
                onChange={(e) => setBatchProductionData({ ...batchProductionData, notes: e.target.value })}
                placeholder="e.g. Good feed conversion, no stress symptoms."
                className="rounded-xl border-slate-300"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBatchProductionOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                toast.success(
                  `Batch yield record of ${batchProductionData.quantity} ${batchProductionData.unit} logged successfully for ${currentBatch?.batchCode}!`
                );
                setIsBatchProductionOpen(false);
              }}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
            >
              Submit Batch Yield
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: BATCH QR BIOSECURITY CARD ───────────────────────────── */}
      <Dialog open={isQrCardOpen} onOpenChange={setIsQrCardOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader className="text-center pb-2 border-b border-slate-100">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="size-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-xs shadow-xs">
                PG
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Municipality of Padre Garcia • Batangas
                </p>
                <p className="text-xs font-black text-slate-900">
                  Office of the Municipal Agriculturist (MAO)
                </p>
              </div>
            </div>
            <DialogTitle className="text-base font-black text-emerald-950 pt-1">
              Cohort Biosecurity &amp; Movement Clearance Pass
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Official QR clearance for auction pen entry, checkpoints, and bulk livestock transport.
            </DialogDescription>
          </DialogHeader>

          {currentBatch && (
            <div className="space-y-4 py-2">
              {/* QR Code Card Graphic */}
              <div className="flex flex-col items-center justify-center p-5 bg-gradient-to-b from-slate-50 to-emerald-50/40 rounded-2xl border-2 border-dashed border-emerald-300/80 text-center relative">
                {/* SVG QR Code Simulation */}
                <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 mb-3">
                  <svg className="size-40" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Corners */}
                    <rect x="10" y="10" width="30" height="30" rx="4" fill="#064E3B" />
                    <rect x="16" y="16" width="18" height="18" rx="2" fill="white" />
                    <rect x="20" y="20" width="10" height="10" rx="1" fill="#064E3B" />

                    <rect x="80" y="10" width="30" height="30" rx="4" fill="#064E3B" />
                    <rect x="86" y="16" width="18" height="18" rx="2" fill="white" />
                    <rect x="90" y="20" width="10" height="10" rx="1" fill="#064E3B" />

                    <rect x="10" y="80" width="30" height="30" rx="4" fill="#064E3B" />
                    <rect x="16" y="86" width="18" height="18" rx="2" fill="white" />
                    <rect x="20" y="90" width="10" height="10" rx="1" fill="#064E3B" />

                    {/* QR Matrix Bits */}
                    <rect x="48" y="12" width="6" height="6" rx="1" fill="#064E3B" />
                    <rect x="58" y="12" width="6" height="6" rx="1" fill="#064E3B" />
                    <rect x="68" y="18" width="6" height="6" rx="1" fill="#064E3B" />
                    <rect x="48" y="26" width="12" height="6" rx="1" fill="#064E3B" />

                    <rect x="12" y="48" width="6" height="6" rx="1" fill="#064E3B" />
                    <rect x="24" y="48" width="6" height="12" rx="1" fill="#064E3B" />
                    <rect x="12" y="60" width="18" height="6" rx="1" fill="#064E3B" />

                    {/* Center Core */}
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

                <p className="font-mono font-black text-sm text-slate-900 tracking-wider">
                  {currentBatch.batchCode}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  Scan via Padre Garcia Livestock Checkpoint Mobile Terminal
                </p>
              </div>

              {/* Clearance Details Table */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Species &amp; Breed:</span>
                  <span className="font-bold text-slate-900">{currentBatch.species} • {currentBatch.breed}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Registered Heads:</span>
                  <span className="font-bold text-emerald-700">{currentBatch.individuals.length} Heads (100% Active)</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Housing Enclosure:</span>
                  <span className="font-bold text-slate-900">{currentBatch.housingPen}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Municipal Review:</span>
                  <span className="font-bold">
                    {currentBatch.reviewStatus === "APPROVED" ? (
                      <span className="text-emerald-700">✓ MAO Final Approved</span>
                    ) : currentBatch.reviewStatus === "VERIFIED" ? (
                      <span className="text-blue-700">✓ SIBAT Verified</span>
                    ) : (
                      <span className="text-amber-700">⏳ Verification Pending</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Biosecurity Clearance:</span>
                  <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Ord. 2026-03 Compliant
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsQrCardOpen(false)}
              className="rounded-xl font-bold text-xs flex-1"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                toast.success("Biosecurity Pass ready for print / PDF export.", {
                  description: `Movement Certificate for Batch ${currentBatch?.batchCode} generated.`
                });
                setIsQrCardOpen(false);
              }}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex-1 gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="size-3.5" /> Print Biosecurity Pass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
