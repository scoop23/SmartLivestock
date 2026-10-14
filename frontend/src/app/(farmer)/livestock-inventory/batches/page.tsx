"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  Plus,
  Scale,
  ShieldCheck,
  AlertTriangle,
  Search,
  Eye,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Tag,
  Clock,
  QrCode,
  LayoutGrid,
  Table as TableIcon,
  Layers,
  Users,
  Sparkles,
  ArrowRight,
  HelpCircle,
  FileText,
  Activity,
  Check,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LivestockBreedField } from "@/components/livestock-breed-field";
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
import api from "@/lib/axios";
import { localCalendarDateToday } from "@/lib/livestock-age";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLivestockBatches,
  getDefaultAvatarForSpecies,
  INVENTORY_QUERY_KEYS,
} from "../livestock-inventory";
import { LivestockPhotoManager } from "../livestock-photo-manager";
import { QrCodePass } from "@/components/qr-code-pass";
import { livestockBatchQrPayload } from "@/lib/livestock-identity";

// ── Types for Individual Animals inside a Batch ──────────────────────────────
export interface BatchIndividual {
  id: string;
  tagNumber: string | null;
  sex: string;
  weightKg: number | null;
  lastVaccinationDate: string | null;
  operationalStatus: string;
  reviewStatus?: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED" | "MIXED" | "NO_ANIMALS";
  isPostApprovalAddition?: boolean;
}

export interface EnrichedBatch {
  id: string;
  batchCode: string;
  batchName: string;
  photoUrl?: string | null;
  species: string;
  breed: string | null;
  activeCount: number;
  targetWeightKg: number | null;
  averageWeightKg: number | null;
  status: string;
  reviewStatus?: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";
  reviewRemarks?: string;
  notes?: string;
  individuals: BatchIndividual[];
}

type BatchActionErrorResponse = {
  error?: string;
  detail?: string;
  livestock?: string[];
  animals?: string[];
  tag_number?: string[];
};

// High-contrast, Senior-Citizen Friendly Regulatory Review Badge
function getReviewStatusBadge(status?: string) {
  if (status === "MIXED") {
    return (
      <Badge
        variant="outline"
        className="min-h-9 border-2 border-slate-300 bg-slate-100 px-3.5 text-xs sm:text-sm font-bold text-slate-900"
      >
        May Iba-ibang Katayuan (Mixed)
      </Badge>
    );
  }
  if (status === "NO_ANIMALS") {
    return (
      <Badge
        variant="outline"
        className="min-h-9 border-2 border-slate-300 bg-slate-100 px-3.5 text-xs sm:text-sm font-bold text-slate-700"
      >
        Wala pang hayop (No animals)
      </Badge>
    );
  }
  if (status === "APPROVED") {
    return (
      <Badge
        variant="outline"
        className="min-h-9 gap-1.5 border-2 border-emerald-400 bg-emerald-50 px-3.5 text-xs sm:text-sm font-black text-emerald-950"
      >
        <ShieldCheck className="size-4.5 text-emerald-700" />
        Aprubado (Approved)
      </Badge>
    );
  }
  if (status === "VERIFIED") {
    return (
      <Badge
        variant="outline"
        className="min-h-9 gap-1.5 border-2 border-sky-400 bg-sky-50 px-3.5 text-xs sm:text-sm font-black text-sky-950"
      >
        <CheckCircle2 className="size-4.5 text-sky-700" />
        Na-inspeksyon (Field Checked)
      </Badge>
    );
  }
  if (status === "SUBJECT_TO_REVISION") {
    return (
      <Badge
        variant="outline"
        className="min-h-9 gap-1.5 border-2 border-amber-400 bg-amber-50 px-3.5 text-xs sm:text-sm font-black text-amber-950"
      >
        <AlertTriangle className="size-4.5 text-amber-700" />
        May Pagwawasto (Revision Needed)
      </Badge>
    );
  }
  if (status === "REJECTED") {
    return (
      <Badge
        variant="outline"
        className="min-h-9 gap-1.5 border-2 border-rose-400 bg-rose-50 px-3.5 text-xs sm:text-sm font-black text-rose-950"
      >
        <AlertTriangle className="size-4.5 text-rose-700" />
        Tinanggihan (Rejected)
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="min-h-9 gap-1.5 border-2 border-amber-300 bg-amber-50 px-3.5 text-xs sm:text-sm font-black text-amber-950"
    >
      <Clock className="size-4.5 text-amber-700" />
      Nire-rebyu (Waiting for Review)
    </Badge>
  );
}

export default function BatchOverviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const livestockTypeReturn = searchParams?.get("livestockType");
  const livestockReturnUrl = livestockTypeReturn
    ? `/livestock-inventory?livestockType=${encodeURIComponent(livestockTypeReturn)}`
    : "/livestock-inventory";

  const {
    data: backendBatches = [],
    error: batchesError,
    isLoading: isBatchesLoading,
    isError: isBatchesError,
    refetch: refetchBatches,
  } = useLivestockBatches();

  const herdLoadStatus =
    typeof batchesError === "object" && batchesError !== null && "response" in batchesError
      ? (batchesError as { response?: { status?: number } }).response?.status
      : undefined;

  const herdLoadMessage =
    herdLoadStatus === 401
      ? "Nag-expire ang iyong sesyon. Mag-sign in muli upang makita ang iyong mga pangkat."
      : herdLoadStatus === 403
        ? "Wala kang pahintulot na tingnan ang talaan ng pangkat."
        : "Hindi ma-load ang mga talaan ng pangkat. Paki-subukan muli.";

  // Local state for interactive enhancements
  const initialBatchId = searchParams?.get("batch") || "";
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId);
  const [isHerdDetailsOpen, setIsHerdDetailsOpen] = useState(Boolean(initialBatchId));
  // Default to cards on smaller viewports for easier senior citizen reading
  const [rosterView, setRosterView] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [herdSearchQuery, setHerdSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("ALL");

  // Dialog States
  const [isAddIndividualOpen, setIsAddIndividualOpen] = useState(false);
  const [isHerdQrOpen, setIsHerdQrOpen] = useState(false);
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
  const [weighTarget, setWeighTarget] = useState<BatchIndividual | null>(null);
  const [newWeightInput, setNewWeightInput] = useState<string>("");

  // Form for adding individual to batch
  const [isSavingAnimal, setIsSavingAnimal] = useState(false);
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [newAnimalData, setNewAnimalData] = useState({
    tagNumber: "",
    breed: "",
    sex: "FEMALE",
    weight: "",
    birthDate: "",
    lastVaccinationDate: "",
  });

  // Mapped Persisted Herds
  const batches: EnrichedBatch[] = useMemo(() => {
    return backendBatches.map((b) => ({
      id: String(b.id),
      batchCode: b.batchCode,
      batchName: b.batchName,
      photoUrl: b.photoUrl || null,
      species: b.livestockTypeName,
      breed: b.animals?.find((animal) => animal.breed)?.breed || null,
      activeCount: b.totalAnimals,
      targetWeightKg: b.targetWeight,
      averageWeightKg: b.averageWeight,
      status: b.status,
      reviewStatus: b.reviewStatus,
      reviewRemarks: b.reviewRemarks,
      notes: b.notes,
      individuals: (b.animals || []).map((animal) => ({
        id: String(animal.id),
        tagNumber: animal.tagNumber || null,
        sex: animal.sex || "Not recorded",
        weightKg: animal.weight == null ? null : Number(animal.weight),
        lastVaccinationDate: animal.lastVaccinationDate,
        operationalStatus: animal.operationalStatus,
        reviewStatus: animal.status,
        isPostApprovalAddition: animal.isPostApprovalAddition,
      })),
    }));
  }, [backendBatches]);

  // Overall Statistics for Telemetry Ribbon
  const totalHerdsCount = batches.length;
  const totalAnimalsInHerds = useMemo(
    () => batches.reduce((sum, b) => sum + b.activeCount, 0),
    [batches]
  );
  const approvedHerdsCount = useMemo(
    () => batches.filter((b) => b.reviewStatus === "APPROVED").length,
    [batches]
  );
  const totalWeighedInHerds = useMemo(
    () =>
      batches.reduce(
        (sum, b) =>
          sum +
          b.individuals.filter(
            (i) => i.operationalStatus === "ACTIVE" && i.weightKg !== null
          ).length,
        0
      ),
    [batches]
  );

  // Filtered Herds
  const filteredBatches = useMemo(() => {
    if (!herdSearchQuery.trim()) return batches;
    const query = herdSearchQuery.toLowerCase();
    return batches.filter(
      (b) =>
        b.batchName.toLowerCase().includes(query) ||
        b.batchCode.toLowerCase().includes(query) ||
        b.species.toLowerCase().includes(query) ||
        (b.breed && b.breed.toLowerCase().includes(query))
    );
  }, [batches, herdSearchQuery]);

  // Active selected batch
  const currentBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null;
    const found = batches.find((b) => b.id === selectedBatchId);
    return found || batches[0];
  }, [batches, selectedBatchId]);

  const handleBatchSelect = (batchId: string) => {
    setSelectedBatchId(batchId);
    setIsHerdDetailsOpen(true);
  };

  const canAddAnimalsToCurrentBatch = currentBatch?.status === "ACTIVE";

  const individualReviewSummary = currentBatch?.individuals.reduce(
    (summary, animal) => {
      const status = (animal.reviewStatus || "PENDING").toUpperCase();
      if (status === "APPROVED") summary.approved += 1;
      else if (status === "VERIFIED") summary.awaitingMao += 1;
      else if (
        status === "SUBJECT_TO_REVISION" ||
        status === "SUBJECT_FOR_REVISION"
      )
        summary.returned += 1;
      else if (status === "REJECTED") summary.rejected += 1;
      else summary.awaitingSibat += 1;
      return summary;
    },
    { approved: 0, awaitingMao: 0, awaitingSibat: 0, returned: 0, rejected: 0 }
  );

  // Filter individuals inside current batch
  const filteredIndividuals = useMemo(() => {
    if (!currentBatch) return [];
    return currentBatch.individuals.filter((animal) => {
      if (animal.operationalStatus !== "ACTIVE") return false;
      const matchSearch =
        (animal.tagNumber || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        animal.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchGender =
        genderFilter === "ALL" ||
        animal.sex.toUpperCase() === genderFilter.toUpperCase();
      return matchSearch && matchGender;
    });
  }, [currentBatch, searchQuery, genderFilter]);

  // Calculations for Batch Yield
  const yieldMetrics = useMemo(() => {
    if (!currentBatch)
      return { totalBiomass: null, readinessPct: null, weighedAnimalCount: 0 };
    const weighedActiveAnimals = currentBatch.individuals.filter(
      (animal) =>
        animal.operationalStatus === "ACTIVE" && animal.weightKg !== null
    );
    const totalBiomass =
      weighedActiveAnimals.length > 0
        ? Math.round(
            weighedActiveAnimals.reduce(
              (acc, animal) => acc + (animal.weightKg || 0),
              0
            ) * 10
          ) / 10
        : null;

    const readinessPct =
      currentBatch.averageWeightKg !== null && currentBatch.targetWeightKg
        ? Math.min(
            Math.round(
              (currentBatch.averageWeightKg / currentBatch.targetWeightKg) * 100
            ),
            100
          )
        : null;

    return {
      totalBiomass,
      readinessPct,
      weighedAnimalCount: weighedActiveAnimals.length,
    };
  }, [currentBatch]);

  // Handlers
  const handleOpenWeighModal = (animal: BatchIndividual) => {
    setWeighTarget(animal);
    setNewWeightInput(animal.weightKg === null ? "" : String(animal.weightKg));
    setIsWeighModalOpen(true);
  };

  const handleSaveWeight = async () => {
    if (!weighTarget || !currentBatch) return;
    const weightNum = parseFloat(newWeightInput);
    if (isNaN(weightNum) || weightNum <= 0) {
      toast.error("Maglagay ng wastong timbang sa kilo (hal. 65.5).");
      return;
    }

    setIsSavingWeight(true);
    try {
      await api.post("production/weights/", {
        livestock: Number(weighTarget.id),
        weight: weightNum,
        weighing_date: new Date().toISOString().split("T")[0],
      });
      await queryClient.invalidateQueries({ queryKey: ["weight_records"] });
      await queryClient.invalidateQueries({
        queryKey: INVENTORY_QUERY_KEYS.inventory,
      });
      await queryClient.invalidateQueries({
        queryKey: INVENTORY_QUERY_KEYS.batches,
      });
      toast.success(
        `Matagumpay na naitabi ang timbang para sa ${weighTarget.tagNumber || "hayop"}: ${weightNum} kg`
      );
      setIsWeighModalOpen(false);
    } catch (error: unknown) {
      const response = isAxiosError<BatchActionErrorResponse>(error)
        ? error.response?.data
        : undefined;
      toast.error(
        response?.livestock?.[0] ||
          response?.detail ||
          "Hindi maitala ang timbang. Subukan muli."
      );
    } finally {
      setIsSavingWeight(false);
    }
  };

  const handleAddIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBatch) return;

    if (!newAnimalData.tagNumber.trim()) {
      toast.error("Kinakailangan ang Ear Tag Number ng hayop.");
      return;
    }
    if (!newAnimalData.breed.trim()) {
      toast.error("Kinakailangan ang Lahi (Breed) ng hayop.");
      return;
    }

    setIsSavingAnimal(true);
    try {
      await api.post(`livestock/batches/${currentBatch.id}/animals/`, {
        animals: [
          {
            tag_number: newAnimalData.tagNumber.trim().toUpperCase(),
            breed: newAnimalData.breed.trim(),
            sex: newAnimalData.sex,
            weight: newAnimalData.weight || null,
            birth_date: newAnimalData.birthDate || null,
            last_vaccination_date: newAnimalData.lastVaccinationDate || null,
          },
        ],
      });
      await queryClient.invalidateQueries({
        queryKey: INVENTORY_QUERY_KEYS.batches,
      });
      await queryClient.invalidateQueries({
        queryKey: INVENTORY_QUERY_KEYS.inventory,
      });
      toast.success(
        `Naidagdag ang hayop (${newAnimalData.tagNumber.trim().toUpperCase()}) sa pangkat ${currentBatch.batchName || currentBatch.batchCode}.`
      );
      setIsAddIndividualOpen(false);
      setNewAnimalData({
        tagNumber: "",
        breed: "",
        sex: "FEMALE",
        weight: "",
        birthDate: "",
        lastVaccinationDate: "",
      });
    } catch (error: unknown) {
      const response = isAxiosError<BatchActionErrorResponse>(error)
        ? error.response?.data
        : undefined;
      toast.error(
        response?.error ||
          response?.detail ||
          response?.animals?.[0] ||
          response?.tag_number?.[0] ||
          "Hindi maidagdag ang hayop sa pangkat na ito."
      );
    } finally {
      setIsSavingAnimal(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Pamamahala ng Pangkat (My Herds)"
        subtitle="Subaybayan ang iyong mga kawan, timbang, at kalusugan ng bawat grupo ng hayop."
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="mx-auto w-full max-w-[1600px] space-y-6 sm:space-y-8 p-3 sm:p-6 xl:p-8">
        {/* ── 1. PREMIUM HERO BANNER (Consistent with Inventory) ───────────── */}
        <section className="relative overflow-hidden rounded-3xl border border-emerald-800/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 p-5 sm:p-7 text-white shadow-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-teal-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge className="rounded-full border-emerald-400/30 bg-emerald-500/20 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-emerald-300 backdrop-blur-md">
                  <Layers className="mr-1.5 size-4 text-emerald-400" />
                  Pangkat at Kawan · Herd Management
                </Badge>
                <span className="text-xs sm:text-sm font-bold text-emerald-200">
                  • {totalHerdsCount} {totalHerdsCount === 1 ? "Pangkat" : "mga Pangkat"} nakatala
                </span>
              </div>

              <div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
                  Talaan ng mga Pangkat ng Hayop
                </h1>
                <p className="mt-1.5 text-sm sm:text-base font-medium leading-relaxed text-emerald-100/90">
                  Madaling masusubaybayan ang paglaki, timbang, at indibidwal na impormasyon ng bawat hayop sa iyong mga kawan.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href={livestockReturnUrl} className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="min-h-12 w-full sm:w-auto gap-2.5 rounded-2xl border-2 border-emerald-400/30 bg-white/10 px-5 text-sm sm:text-base font-black text-white hover:bg-white/20 hover:text-white"
                >
                  <ArrowLeft className="size-5" />
                  Bumalik sa Talaan (Inventory)
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── 2. SENIOR CITIZEN FRIENDLY TELEMETRY RIBBON ──────────────────── */}
        <section
          aria-label="Buod ng Pangkat"
          className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          {/* Card 1: Kabuuang Pangkat */}
          <Card className="rounded-2xl sm:rounded-3xl border-2 border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-emerald-300">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-600">
                Kabuuang Pangkat
              </span>
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <Layers className="size-5" />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-4xl font-black text-slate-950">
              {totalHerdsCount}
            </p>
            <p className="mt-1 text-xs sm:text-sm font-bold text-slate-600">
              {totalHerdsCount === 1 ? "Aktibong grupo" : "Mga aktibong grupo"}
            </p>
          </Card>

          {/* Card 2: Kabuuang Hayop */}
          <Card className="rounded-2xl sm:rounded-3xl border-2 border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-emerald-300">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-600">
                Kabuuang Hayop
              </span>
              <div className="flex size-10 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                <Users className="size-5" />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-4xl font-black text-emerald-900">
              {totalAnimalsInHerds}
            </p>
            <p className="mt-1 text-xs sm:text-sm font-bold text-slate-600">
              Ulo ng hayop sa kawan
            </p>
          </Card>

          {/* Card 3: Aprubadong Pangkat */}
          <Card className="rounded-2xl sm:rounded-3xl border-2 border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-emerald-300">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-600">
                Aprubado ng MAO
              </span>
              <div className="flex size-10 items-center justify-center rounded-xl bg-sky-100 text-sky-800">
                <ShieldCheck className="size-5" />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-4xl font-black text-sky-950">
              {approvedHerdsCount}
            </p>
            <p className="mt-1 text-xs sm:text-sm font-bold text-slate-600">
              Opisyal na rehistrado
            </p>
          </Card>

          {/* Card 4: May Tala ng Timbang */}
          <Card className="rounded-2xl sm:rounded-3xl border-2 border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-emerald-300">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-600">
                May Tala ng Timbang
              </span>
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                <Scale className="size-5" />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-4xl font-black text-amber-950">
              {totalWeighedInHerds}
            </p>
            <p className="mt-1 text-xs sm:text-sm font-bold text-slate-600">
              Hayop na natimbang na
            </p>
          </Card>
        </section>

        {/* ── 3. HERD LISTING SECTION ──────────────────────────────────────── */}
        <section aria-labelledby="herd-list-title" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="herd-list-title"
                className="text-xl sm:text-3xl font-black tracking-tight text-slate-950"
              >
                Pumili ng Pangkat (Select a Herd)
              </h2>
              <p className="mt-1 text-sm sm:text-base leading-relaxed text-slate-700">
                Pindutin ang alinmang kahon sa ibaba upang makita ang buong talaan ng mga hayop at timbang.
              </p>
            </div>

            {/* Quick Search for Herds */}
            {batches.length > 3 && (
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Maghanap ng pangkat..."
                  value={herdSearchQuery}
                  onChange={(e) => setHerdSearchQuery(e.target.value)}
                  className="min-h-12 rounded-2xl border-2 border-slate-300 pl-11 text-sm sm:text-base font-semibold"
                />
              </div>
            )}
          </div>

          {/* Loading / Error States */}
          {isBatchesLoading && (
            <Card className="rounded-3xl border-2 border-slate-200 p-8 text-center">
              <RefreshCw className="mx-auto size-8 animate-spin text-emerald-700" />
              <p className="mt-3 text-base sm:text-lg font-bold text-slate-700">
                Ikinakarga ang iyong mga pangkat ng hayop...
              </p>
            </Card>
          )}

          {!isBatchesLoading && isBatchesError && (
            <Card className="rounded-3xl border-2 border-rose-300 bg-rose-50/70 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <AlertTriangle className="size-8 shrink-0 text-rose-600" />
                <div>
                  <h3 className="text-lg font-black text-rose-950">Hindi ma-load ang talaan</h3>
                  <p className="mt-1 text-base text-rose-900">{herdLoadMessage}</p>
                  {herdLoadStatus === 401 ? (
                    <Button
                      type="button"
                      onClick={() => router.push("/login")}
                      className="mt-4 min-h-12 rounded-2xl bg-emerald-700 px-6 text-base font-bold text-white hover:bg-emerald-800"
                    >
                      Mag-sign in muli
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void refetchBatches()}
                      className="mt-4 min-h-12 rounded-2xl border-2 border-rose-400 px-6 text-base font-bold text-rose-900 hover:bg-rose-100"
                    >
                      <RefreshCw className="mr-2 size-5" /> Subukan muli
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {!isBatchesLoading && !isBatchesError && batches.length === 0 && (
            <Card className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-emerald-100 text-4xl">
                🐄
              </div>
              <h3 className="mt-4 text-xl sm:text-2xl font-black text-slate-900">
                Wala pang nakatalang pangkat (No Herds Found)
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm sm:text-base leading-relaxed text-slate-600">
                Kapag nagrehistro ka ng kawan o pangkat sa Talaan ng Hayop, awtomatiko itong lalabas dito kasama ang mga detalye.
              </p>
              <div className="mt-6">
                <Link href="/livestock-inventory">
                  <Button className="min-h-12 rounded-2xl bg-emerald-700 px-6 text-base font-black text-white hover:bg-emerald-800">
                    Buksan ang Talaan ng Hayop
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Herd Cards Grid */}
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredBatches.map((batch) => {
              const isSelected = currentBatch?.id === batch.id;
              const avatar = getDefaultAvatarForSpecies(batch.species);
              const readiness =
                batch.averageWeightKg !== null && batch.targetWeightKg
                  ? Math.min(
                      Math.round(
                        (batch.averageWeightKg / batch.targetWeightKg) * 100
                      ),
                      100
                    )
                  : null;

              return (
                <Card
                  key={batch.id}
                  className={`group relative overflow-hidden rounded-3xl border-2 transition-all shadow-sm ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50/60 ring-4 ring-emerald-500/20 shadow-md"
                      : "border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md"
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`Piliin ang ${batch.batchName || "pangkat"}, ${batch.activeCount} hayop`}
                    onClick={() => handleBatchSelect(batch.id)}
                    className="flex min-h-[170px] w-full flex-col justify-between p-4 sm:p-6 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40"
                  >
                    {/* Top Row: Avatar + Titles + Animal Count Box */}
                    <div className="flex items-start gap-4">
                      {batch.photoUrl ? (
                        <Image
                          src={batch.photoUrl}
                          alt=""
                          width={88}
                          height={88}
                          unoptimized
                          className="size-16 sm:size-20 shrink-0 rounded-2xl border-2 border-slate-200 object-cover shadow-xs"
                        />
                      ) : (
                        <div
                          className="flex size-16 sm:size-20 shrink-0 items-center justify-center rounded-2xl border-2 border-emerald-200 bg-emerald-100 text-3xl sm:text-4xl shadow-xs"
                          aria-hidden="true"
                        >
                          {avatar.emoji}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="break-words text-lg sm:text-xl font-black leading-snug text-slate-950">
                              {batch.batchName || "Walang Pangalang Pangkat"}
                            </h3>
                            <p className="mt-0.5 inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                              {batch.batchCode}
                            </p>
                          </div>

                          {/* Large Animal Count Pill */}
                          <div className="shrink-0 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center shadow-xs">
                            <span className="block text-xl sm:text-2xl font-black leading-none text-emerald-950">
                              {batch.activeCount}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-bold text-emerald-800 uppercase tracking-tight">
                              ulo / animals
                            </span>
                          </div>
                        </div>

                        <p className="mt-2 text-sm sm:text-base font-bold text-slate-800">
                          {batch.species}
                          {batch.breed ? (
                            <span className="font-semibold text-slate-600"> · {batch.breed}</span>
                          ) : (
                            <span className="font-normal text-slate-500"> · Walang lahi</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Progress to target weight if set */}
                    {readiness !== null && (
                      <div className="mt-4 w-full rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-2.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-emerald-950">
                          <span>Pag-unlad sa Target na Timbang</span>
                          <span className="font-black">{readiness}%</span>
                        </div>
                        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-emerald-200/60">
                          <div
                            className="h-full rounded-full bg-emerald-600 transition-all"
                            style={{ width: `${readiness}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Bottom Row: Status Badge & Open Button */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {getReviewStatusBadge(batch.reviewStatus)}
                      </div>

                      <span
                        className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-black transition-colors ${
                          isSelected
                            ? "bg-emerald-700 text-white shadow-xs"
                            : "bg-slate-100 text-slate-900 group-hover:bg-emerald-100 group-hover:text-emerald-950"
                        }`}
                      >
                        {isSelected ? "Naka-select" : "Tingnan ang Pangkat"}
                        {isSelected ? (
                          <Check className="size-4.5 stroke-[3]" />
                        ) : (
                          <ArrowRight className="size-4.5" />
                        )}
                      </span>
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ── 4. HERD DETAILS DIALOG (MOBILE & SENIOR FRIENDLY MODAL) ─────── */}
        <Dialog open={isHerdDetailsOpen} onOpenChange={setIsHerdDetailsOpen}>
          {currentBatch && (
            <DialogContent className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-slate-200 bg-slate-50 p-0 shadow-2xl sm:h-[92dvh] sm:max-h-[92dvh] sm:w-[94vw] sm:max-w-5xl sm:rounded-3xl">
              {/* Sticky Header with high contrast */}
              <DialogHeader className="shrink-0 border-b-2 border-slate-200 bg-white px-4 py-4 pr-14 text-left sm:px-6">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold text-xs uppercase">
                    Pangkat ng Hayop
                  </Badge>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    ID: {currentBatch.batchCode}
                  </span>
                </div>
                <DialogTitle className="mt-1 text-xl sm:text-2xl font-black text-slate-950">
                  {currentBatch.batchName || "Mga Detalye ng Pangkat"}
                </DialogTitle>
                <DialogDescription className="text-sm sm:text-base font-medium text-slate-700">
                  {currentBatch.species} · {currentBatch.breed || "Lahi hindi naitala"} · {currentBatch.activeCount} aktibong hayop
                </DialogDescription>
              </DialogHeader>

              {/* Scrollable Modal Body */}
              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 space-y-5">
                {/* Header Action Card */}
                <Card className="rounded-3xl border-2 border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      {currentBatch.photoUrl ? (
                        <Image
                          src={currentBatch.photoUrl}
                          alt={`${currentBatch.batchName} herd`}
                          width={100}
                          height={100}
                          unoptimized
                          className="size-20 sm:size-24 shrink-0 rounded-2xl border-2 border-slate-200 object-cover shadow-xs"
                        />
                      ) : (
                        <div
                          className="flex size-20 sm:size-24 shrink-0 items-center justify-center rounded-2xl border-2 border-emerald-200 bg-emerald-100 text-4xl sm:text-5xl shadow-xs"
                          aria-hidden="true"
                        >
                          {getDefaultAvatarForSpecies(currentBatch.species).emoji}
                        </div>
                      )}

                      <div className="min-w-0">
                        <span className="inline-block text-xs font-black uppercase tracking-wider text-emerald-800">
                          Naka-select na Pangkat
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
                          {currentBatch.batchName || "Walang Pangalan"}
                        </h2>
                        <p className="mt-1 text-sm sm:text-base font-bold text-slate-700">
                          {currentBatch.species} · {currentBatch.breed || "Lahi hindi naitala"}
                        </p>
                        <p className="font-mono text-xs font-semibold text-slate-500">
                          Herd Code: {currentBatch.batchCode}
                        </p>
                      </div>
                    </div>

                    {/* Big Easy-to-Tap Action Buttons */}
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsHerdQrOpen(true)}
                        className="min-h-12 gap-2 rounded-2xl border-2 border-slate-300 px-4 text-base font-bold text-slate-800 hover:bg-slate-100"
                      >
                        <QrCode className="size-5 text-emerald-700" /> Herd QR Code
                      </Button>

                      {backendBatches.some((batch) => String(batch.id) === currentBatch.id) && (
                        <LivestockPhotoManager
                          title="Litrato ng Pangkat"
                          subject="herd"
                          currentPhotoUrl={currentBatch.photoUrl}
                          allowAvatar={false}
                          fallback={
                            <div className="flex size-36 items-center justify-center rounded-2xl bg-emerald-50 text-6xl">
                              {getDefaultAvatarForSpecies(currentBatch.species).emoji}
                            </div>
                          }
                          onSave={async ({ file, removePhoto }) => {
                            let payload: FormData | { photo?: null };
                            if (file) {
                              const formData = new FormData();
                              formData.append("photo", file);
                              payload = formData;
                            } else {
                              payload = removePhoto ? { photo: null } : {};
                            }
                            await api.patch(`livestock/batches/${currentBatch.id}/`, payload);
                            await queryClient.invalidateQueries({
                              queryKey: INVENTORY_QUERY_KEYS.batches,
                            });
                            toast.success("Nai-update ang litrato ng pangkat.");
                          }}
                        />
                      )}

                      {backendBatches.some((batch) => String(batch.id) === currentBatch.id) && (
                        <Button
                          type="button"
                          onClick={() => setIsAddIndividualOpen(true)}
                          disabled={!canAddAnimalsToCurrentBatch}
                          className="min-h-12 gap-2 rounded-2xl bg-emerald-700 px-5 text-base font-black text-white hover:bg-emerald-800 shadow-md disabled:bg-slate-300"
                        >
                          <Plus className="size-5 stroke-[3]" /> Magdagdag ng Hayop
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Status Strip & Official Notes */}
                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t-2 border-slate-100 pt-4">
                    <Badge variant="outline" className="min-h-9 px-3.5 text-sm font-bold border-2">
                      {currentBatch.status === "ACTIVE"
                        ? "Aktibong Kawan"
                        : currentBatch.status || "Katayuan hindi naitala"}
                    </Badge>
                    {getReviewStatusBadge(currentBatch.reviewStatus)}
                    {!canAddAnimalsToCurrentBatch && (
                      <p className="text-sm font-medium text-slate-600">
                        Maaaring magdagdag ng hayop kapag aktibo ang pangkat.
                      </p>
                    )}
                  </div>

                  {currentBatch.reviewRemarks && (
                    <div className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                      <p className="text-sm font-black text-amber-950">
                        Opisyal na Tala ng Tagasuri (Review Remarks):
                      </p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-amber-900">
                        {currentBatch.reviewRemarks}
                      </p>
                    </div>
                  )}

                  {/* Animal Review Progress Tiles */}
                  <div className="mt-5 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3">
                      <h4 className="text-sm sm:text-base font-black text-slate-950">
                        Katayuan ng Rebyu ng mga Hayop sa Pangkat
                      </h4>
                      <p className="text-xs sm:text-sm font-medium text-slate-600">
                        Bilang ng mga hayop sa bawat hakbang ng pagpapatunay.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {[
                        {
                          label: "Aprubado (Approved)",
                          count: individualReviewSummary?.approved ?? 0,
                          color: "bg-emerald-600",
                          text: "text-emerald-950",
                          border: "border-emerald-300",
                        },
                        {
                          label: "Pagsusuri sa Bukid (SIBAT)",
                          count: individualReviewSummary?.awaitingSibat ?? 0,
                          color: "bg-sky-600",
                          text: "text-sky-950",
                          border: "border-sky-300",
                        },
                        {
                          label: "Opisina ng Agrikultura (MAO)",
                          count: individualReviewSummary?.awaitingMao ?? 0,
                          color: "bg-amber-600",
                          text: "text-amber-950",
                          border: "border-amber-300",
                        },
                        {
                          label: "Kailangang Iwasto",
                          count: individualReviewSummary?.returned ?? 0,
                          color: "bg-orange-600",
                          text: "text-orange-950",
                          border: "border-orange-300",
                        },
                        {
                          label: "Tinanggihan (Rejected)",
                          count: individualReviewSummary?.rejected ?? 0,
                          color: "bg-rose-600",
                          text: "text-rose-950",
                          border: "border-rose-300",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`flex min-h-20 items-start gap-2.5 rounded-2xl border-2 ${item.border} bg-white p-3 shadow-2xs`}
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-1 size-3 shrink-0 rounded-full ${item.color}`}
                          />
                          <div className="min-w-0">
                            <p className={`text-xl sm:text-2xl font-black tabular-nums leading-none ${item.text}`}>
                              {item.count}
                            </p>
                            <p className="mt-1 text-xs font-bold leading-tight text-slate-700">
                              {item.label}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* 4 Metric Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Metric 1 */}
                  <Card className="rounded-2xl sm:rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-xs">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-600">
                      Aktibong Hayop
                    </span>
                    <p className="mt-2 text-2xl sm:text-4xl font-black text-slate-950">
                      {currentBatch.activeCount}
                    </p>
                    <p className="mt-1 text-xs sm:text-sm font-bold text-slate-600">
                      Nasa pangkat sa kasalukuyan
                    </p>
                  </Card>

                  {/* Metric 2 */}
                  <Card className="rounded-2xl sm:rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-xs">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-600">
                      Katamtamang Timbang
                    </span>
                    <p className="mt-2 text-2xl sm:text-4xl font-black text-slate-950">
                      {currentBatch.averageWeightKg === null ? (
                        <span className="text-slate-400 text-lg">Wala pa</span>
                      ) : (
                        <>
                          {currentBatch.averageWeightKg} <span className="text-base font-bold text-slate-500">kg</span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs sm:text-sm font-bold text-slate-600">
                      Target: {currentBatch.targetWeightKg == null ? "Hindi naitala" : `${currentBatch.targetWeightKg} kg`}
                    </p>
                  </Card>

                  {/* Metric 3 */}
                  <Card className="rounded-2xl sm:rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-xs">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-600">
                      Kabuuang Timbang
                    </span>
                    <p className="mt-2 text-2xl sm:text-4xl font-black text-emerald-900">
                      {yieldMetrics.totalBiomass === null ? (
                        <span className="text-slate-400 text-lg">Wala pa</span>
                      ) : (
                        <>
                          {yieldMetrics.totalBiomass} <span className="text-base font-bold text-slate-500">kg</span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs sm:text-sm font-bold text-slate-600">
                      Mula sa {yieldMetrics.weighedAnimalCount} natimbang na hayop
                    </p>
                  </Card>

                  {/* Metric 4 */}
                  <Card className="rounded-2xl sm:rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-xs">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-600">
                      Target Readiness
                    </span>
                    <p className="mt-2 text-2xl sm:text-4xl font-black text-slate-950">
                      {yieldMetrics.readinessPct === null ? (
                        <span className="text-slate-400 text-lg">—</span>
                      ) : (
                        `${yieldMetrics.readinessPct}%`
                      )}
                    </p>
                    <div className="mt-2 h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${yieldMetrics.readinessPct ?? 0}%` }}
                      />
                    </div>
                  </Card>
                </div>

                {/* Optional Notes */}
                {currentBatch.notes && (
                  <Card className="rounded-3xl border-2 border-slate-200 bg-white shadow-xs">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
                        <ClipboardList className="size-5 text-emerald-700" />
                        Mga Tala ukol sa Pangkat (Notes)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="whitespace-pre-wrap text-sm sm:text-base font-medium leading-relaxed text-slate-800">
                        {currentBatch.notes}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* ── INDIVIDUAL ROSTER CARD ───────────────────────────────── */}
                <Card className="rounded-3xl border-2 border-slate-200 bg-white shadow-xs overflow-hidden">
                  <CardHeader className="flex flex-col gap-4 border-b-2 border-slate-100 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <CardTitle className="text-xl sm:text-2xl font-black text-slate-950">
                          Talaan ng mga Hayop sa Pangkat
                        </CardTitle>
                        <Badge className="bg-emerald-100 text-emerald-950 border-emerald-300 font-bold text-sm px-3">
                          {filteredIndividuals.length} hayop
                        </Badge>
                      </div>
                      <CardDescription className="mt-1 text-sm sm:text-base font-medium text-slate-600">
                        Maghanap gamit ang Ear Tag o i-filter ayon sa kasarian.
                      </CardDescription>
                    </div>

                    {/* View Controls & Filters */}
                    <div className="flex flex-col gap-3 w-full lg:w-auto sm:flex-row sm:items-center">
                      {/* View Switcher: Cards vs Table */}
                      <div
                        role="group"
                        aria-label="Talaan view"
                        className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-slate-200 bg-slate-100 p-1"
                      >
                        <Button
                          type="button"
                          variant={rosterView === "cards" ? "default" : "ghost"}
                          onClick={() => setRosterView("cards")}
                          className={`min-h-11 gap-2 rounded-xl text-sm font-bold ${
                            rosterView === "cards"
                              ? "bg-white text-emerald-950 shadow-xs border border-slate-200"
                              : "text-slate-700 hover:text-slate-950"
                          }`}
                        >
                          <LayoutGrid className="size-4.5 text-emerald-700" /> Cards
                        </Button>
                        <Button
                          type="button"
                          variant={rosterView === "table" ? "default" : "ghost"}
                          onClick={() => setRosterView("table")}
                          className={`min-h-11 gap-2 rounded-xl text-sm font-bold ${
                            rosterView === "table"
                              ? "bg-white text-emerald-950 shadow-xs border border-slate-200"
                              : "text-slate-700 hover:text-slate-950"
                          }`}
                        >
                          <TableIcon className="size-4.5 text-teal-700" /> Table
                        </Button>
                      </div>

                      {/* Search Input */}
                      <div className="relative flex-1 sm:w-60">
                        <Search className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="Hanapin ang Tag #..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="min-h-11 rounded-2xl border-2 border-slate-300 pl-10 text-sm font-semibold"
                        />
                      </div>

                      {/* Sex Filter */}
                      <div className="w-full sm:w-44">
                        <Select value={genderFilter} onValueChange={setGenderFilter}>
                          <SelectTrigger className="min-h-11 rounded-2xl border-2 border-slate-300 text-sm font-bold text-slate-900">
                            <SelectValue placeholder="Lahat ng Kasarian" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">Lahat (All Sexes)</SelectItem>
                            <SelectItem value="FEMALE">Babae (Female)</SelectItem>
                            <SelectItem value="MALE">Lalaki (Male)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    {/* ── OPTION A: CARDS VIEW (SENIOR CITIZEN & MOBILE OPTIMIZED) ─ */}
                    {rosterView === "cards" && (
                      <div className="p-4 sm:p-6 space-y-4">
                        {filteredIndividuals.length === 0 ? (
                          <div className="rounded-3xl border-2 border-dashed border-slate-300 p-8 text-center text-base font-semibold text-slate-600">
                            Walang hayop na tumutugma sa iyong paghahanap.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {filteredIndividuals.map((animal) => {
                              const hasInventoryRecord = /^\d+$/.test(animal.id);
                              const reviewColor =
                                animal.reviewStatus === "APPROVED"
                                  ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                                  : animal.reviewStatus === "VERIFIED"
                                    ? "bg-sky-100 text-sky-950 border-sky-300"
                                    : animal.reviewStatus === "REJECTED"
                                      ? "bg-rose-100 text-rose-950 border-rose-300"
                                      : animal.reviewStatus === "SUBJECT_TO_REVISION"
                                        ? "bg-amber-100 text-amber-950 border-amber-300"
                                        : "bg-slate-100 text-slate-800 border-slate-300";

                              const reviewLabel =
                                animal.reviewStatus === "APPROVED"
                                  ? "Aprubado (Approved)"
                                  : animal.reviewStatus === "VERIFIED"
                                    ? "Na-inspeksyon (Field Checked)"
                                    : animal.reviewStatus === "REJECTED"
                                      ? "Tinanggihan (Rejected)"
                                      : animal.reviewStatus === "SUBJECT_TO_REVISION"
                                        ? "Kailangang Iwasto"
                                        : "Nire-rebyu (Pending)";

                              return (
                                <div
                                  key={animal.id}
                                  className="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md"
                                >
                                  {/* Top Line: Tag & Sex */}
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      {hasInventoryRecord ? (
                                        <Link
                                          href={`/livestock-inventory/${animal.id}`}
                                          className="flex items-center gap-2 text-lg sm:text-xl font-black text-emerald-800 hover:text-emerald-950 hover:underline"
                                        >
                                          <Tag className="size-5 text-emerald-600 shrink-0" />
                                          <span className="break-all">{animal.tagNumber || "Walang Tag #"}</span>
                                        </Link>
                                      ) : (
                                        <div className="flex items-center gap-2 text-lg sm:text-xl font-black text-slate-800">
                                          <Tag className="size-5 text-slate-400 shrink-0" />
                                          <span className="break-all">{animal.tagNumber || "Walang Tag #"}</span>
                                        </div>
                                      )}
                                      {animal.isPostApprovalAddition && (
                                        <span className="mt-1 inline-block text-xs font-bold text-indigo-700">
                                          Bagong Hayop · Naka-hiwalay ang Rebyu
                                        </span>
                                      )}
                                    </div>

                                    <Badge
                                      variant="secondary"
                                      className={`min-h-8 shrink-0 px-3 text-xs font-black uppercase ${
                                        animal.sex.toUpperCase() === "FEMALE"
                                          ? "bg-rose-100 text-rose-900 border-rose-300"
                                          : animal.sex.toUpperCase() === "MALE"
                                            ? "bg-blue-100 text-blue-900 border-blue-300"
                                            : "bg-slate-100 text-slate-800 border-slate-300"
                                      }`}
                                    >
                                      {animal.sex === "FEMALE"
                                        ? "Babae (Female)"
                                        : animal.sex === "MALE"
                                          ? "Lalaki (Male)"
                                          : animal.sex}
                                    </Badge>
                                  </div>

                                  {/* Data Grid: High Contrast */}
                                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border-2 border-slate-100 bg-slate-50/70 p-3 text-sm">
                                    <div>
                                      <span className="block text-xs font-bold text-slate-500 uppercase">
                                        Timbang (Weight)
                                      </span>
                                      <span className="text-base font-black text-slate-950">
                                        {animal.weightKg === null ? (
                                          <span className="text-rose-700">Wala pa</span>
                                        ) : (
                                          `${animal.weightKg} kg`
                                        )}
                                      </span>
                                    </div>

                                    <div>
                                      <span className="block text-xs font-bold text-slate-500 uppercase">
                                        Huling Bakuna (Vaccine)
                                      </span>
                                      <span className="text-base font-bold text-slate-900">
                                        {animal.lastVaccinationDate || (
                                          <span className="text-slate-500">Wala</span>
                                        )}
                                      </span>
                                    </div>

                                    <div className="col-span-2 mt-1 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                                      <span className="text-xs font-bold text-slate-600 uppercase">
                                        Rebyu:
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black border ${reviewColor}`}
                                      >
                                        <span className="size-2 rounded-full bg-current" />
                                        {reviewLabel}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Easy Touch Action Buttons */}
                                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                    {animal.operationalStatus === "ACTIVE" && hasInventoryRecord && (
                                      <Button
                                        onClick={() => handleOpenWeighModal(animal)}
                                        variant="outline"
                                        className="min-h-12 flex-1 rounded-2xl border-2 border-emerald-300 bg-emerald-50 text-sm sm:text-base font-bold text-emerald-950 hover:bg-emerald-100"
                                      >
                                        <Scale className="mr-2 size-5 text-emerald-700" />
                                        Itala ang Timbang
                                      </Button>
                                    )}

                                    {hasInventoryRecord ? (
                                      <Link href={`/livestock-inventory/${animal.id}`} className="flex-1">
                                        <Button
                                          variant="ghost"
                                          className="min-h-12 w-full rounded-2xl bg-slate-100 text-sm sm:text-base font-bold text-slate-900 hover:bg-slate-200"
                                        >
                                          <Eye className="mr-2 size-5 text-slate-700" />
                                          Tingnan ang Profile
                                        </Button>
                                      </Link>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        disabled
                                        className="min-h-12 flex-1 rounded-2xl bg-slate-100 text-sm font-bold text-slate-500"
                                      >
                                        Walang Profile
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── OPTION B: TABLE VIEW (DESKTOP FRIENDLY) ─────────────── */}
                    {rosterView === "table" && (
                      <div className="overflow-x-auto">
                        <Table className="min-w-[850px]">
                          <TableHeader className="bg-slate-100 border-b-2 border-slate-200">
                            <TableRow>
                              <TableHead className="py-4 text-sm font-black text-slate-900">
                                Ear Tag / ID
                              </TableHead>
                              <TableHead className="py-4 text-sm font-black text-slate-900">
                                Kasarian (Sex)
                              </TableHead>
                              <TableHead className="py-4 text-sm font-black text-slate-900">
                                Timbang (Weight)
                              </TableHead>
                              <TableHead className="py-4 text-sm font-black text-slate-900">
                                Huling Bakuna
                              </TableHead>
                              <TableHead className="py-4 text-sm font-black text-slate-900">
                                Rebyu ng Tanggapan
                              </TableHead>
                              <TableHead className="py-4 pr-6 text-right text-sm font-black text-slate-900">
                                Aksyon
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredIndividuals.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={6}
                                  className="py-12 text-center text-base font-bold text-slate-600"
                                >
                                  Walang hayop na tumutugma sa kasalukuyang filter.
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredIndividuals.map((animal) => {
                                const hasInventoryRecord = /^\d+$/.test(animal.id);
                                return (
                                  <TableRow
                                    key={animal.id}
                                    onClick={(event) => {
                                      const target = event.target as HTMLElement;
                                      if (hasInventoryRecord && !target.closest("a, button")) {
                                        router.push(`/livestock-inventory/${animal.id}`);
                                      }
                                    }}
                                    className={`transition-colors hover:bg-emerald-50/50 ${
                                      hasInventoryRecord ? "cursor-pointer" : ""
                                    }`}
                                  >
                                    <TableCell className="py-4 text-base font-black text-slate-950">
                                      {hasInventoryRecord ? (
                                        <Link
                                          href={`/livestock-inventory/${animal.id}`}
                                          className="flex items-center gap-2 text-emerald-800 hover:text-emerald-950 hover:underline"
                                        >
                                          <Tag className="size-4 text-emerald-600" />
                                          <span>{animal.tagNumber || "Walang Tag #"}</span>
                                        </Link>
                                      ) : (
                                        <span className="flex items-center gap-2 text-slate-500">
                                          <Tag className="size-4 text-slate-400" />
                                          <span>{animal.tagNumber || "Walang Tag #"}</span>
                                        </span>
                                      )}
                                    </TableCell>

                                    <TableCell className="py-4">
                                      <Badge
                                        variant="secondary"
                                        className={`px-3 py-1 text-xs font-black uppercase ${
                                          animal.sex.toUpperCase() === "FEMALE"
                                            ? "bg-rose-100 text-rose-900 border-rose-300"
                                            : animal.sex.toUpperCase() === "MALE"
                                              ? "bg-blue-100 text-blue-900 border-blue-300"
                                              : "bg-slate-100 text-slate-800 border-slate-300"
                                        }`}
                                      >
                                        {animal.sex === "FEMALE"
                                          ? "Babae"
                                          : animal.sex === "MALE"
                                            ? "Lalaki"
                                            : animal.sex}
                                      </Badge>
                                    </TableCell>

                                    <TableCell className="py-4 text-base font-black text-slate-950">
                                      {animal.weightKg === null ? (
                                        <span className="text-rose-700 font-bold">Wala pa</span>
                                      ) : (
                                        `${animal.weightKg} kg`
                                      )}
                                    </TableCell>

                                    <TableCell className="py-4 text-sm font-bold text-slate-800">
                                      {animal.lastVaccinationDate || (
                                        <span className="text-slate-400">Hindi naitala</span>
                                      )}
                                    </TableCell>

                                    <TableCell className="py-4">
                                      <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black border ${
                                          animal.reviewStatus === "APPROVED"
                                            ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                                            : animal.reviewStatus === "VERIFIED"
                                              ? "bg-sky-100 text-sky-950 border-sky-300"
                                              : animal.reviewStatus === "REJECTED"
                                                ? "bg-rose-100 text-rose-950 border-rose-300"
                                                : animal.reviewStatus === "SUBJECT_TO_REVISION"
                                                  ? "bg-amber-100 text-amber-950 border-amber-300"
                                                  : "bg-slate-100 text-slate-800 border-slate-300"
                                        }`}
                                      >
                                        <span className="size-2 rounded-full bg-current" />
                                        {animal.reviewStatus === "APPROVED"
                                          ? "Aprubado"
                                          : animal.reviewStatus === "VERIFIED"
                                            ? "Field Checked"
                                            : animal.reviewStatus === "REJECTED"
                                              ? "Tinanggihan"
                                              : animal.reviewStatus === "SUBJECT_TO_REVISION"
                                                ? "Pagwawasto"
                                                : "Pending"}
                                      </span>
                                    </TableCell>

                                    <TableCell className="py-4 text-right pr-6">
                                      <div className="inline-flex items-center gap-2">
                                        {animal.operationalStatus === "ACTIVE" && hasInventoryRecord && (
                                          <Button
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleOpenWeighModal(animal);
                                            }}
                                            variant="outline"
                                            className="min-h-11 px-3.5 text-sm rounded-xl font-bold border-2 border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
                                          >
                                            <Scale className="size-4 mr-1.5 text-emerald-700" />
                                            Magtala ng Timbang
                                          </Button>
                                        )}

                                        {hasInventoryRecord && (
                                          <Link
                                            href={`/livestock-inventory/${animal.id}`}
                                            onClick={(event) => event.stopPropagation()}
                                          >
                                            <Button
                                              variant="ghost"
                                              className="min-h-11 px-3.5 text-sm rounded-xl font-bold text-slate-800 hover:bg-slate-200"
                                            >
                                              <Eye className="size-4 mr-1.5 text-slate-600" />
                                              Tingnan
                                            </Button>
                                          </Link>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>

      {/* ── DIALOG: HERD QR CODE (SENIOR & MOBILE FRIENDLY) ──────────────── */}
      <Dialog open={isHerdQrOpen} onOpenChange={setIsHerdQrOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl bg-white p-5 sm:p-7 shadow-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-xl sm:text-2xl font-black text-slate-950">
              <QrCode className="size-6 text-emerald-700" />
              <span>Opisyal na QR Code ng Pangkat</span>
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base font-medium leading-relaxed text-slate-700">
              I-scan ang code na ito upang mabilis na matukoy ang talaan ng pangkat ({currentBatch?.batchName || "kawan"}).
            </DialogDescription>
          </DialogHeader>
          {currentBatch && (
            <div className="py-2">
              <QrCodePass
                code={currentBatch.batchCode || currentBatch.id}
                qrPayload={livestockBatchQrPayload(currentBatch.id)}
                title={currentBatch.batchName || "Livestock herd"}
                subtitle="Canonical herd identity"
                specie={currentBatch.species}
                headCount={currentBatch.activeCount}
                status={currentBatch.status}
                compact
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: RECORD WEIGHT (SENIOR FRIENDLY INPUT) ─────────────────── */}
      <Dialog open={isWeighModalOpen} onOpenChange={setIsWeighModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] rounded-3xl border-2 border-slate-200 bg-white p-5 sm:p-7 shadow-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-xl sm:text-2xl font-black text-slate-950">
              <Scale className="size-6 text-emerald-700" />
              <span>Itala ang Bagong Timbang</span>
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base font-medium leading-relaxed text-slate-700">
              Ilagay ang kasalukuyang timbang sa kilo (kg) para sa hayop na may tag{" "}
              <strong className="font-bold text-slate-950">{weighTarget?.tagNumber || "na ito"}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="flex items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-base">
              <span className="font-bold text-slate-700">Dating Timbang:</span>
              <span
                className={`text-lg font-black ${
                  weighTarget?.weightKg == null ? "text-rose-700" : "text-slate-950"
                }`}
              >
                {weighTarget?.weightKg == null ? "Wala pang tala" : `${weighTarget.weightKg} kg`}
              </span>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="new-herd-animal-weight"
                className="text-base font-black text-slate-900"
              >
                Bagong Timbang (sa Kilograms / kg)
              </Label>
              <Input
                id="new-herd-animal-weight"
                type="number"
                step="0.1"
                min="0.1"
                value={newWeightInput}
                onChange={(e) => setNewWeightInput(e.target.value)}
                placeholder="Halimbawa: 72.5"
                className="min-h-13 rounded-2xl border-2 border-slate-300 text-lg sm:text-xl font-black text-slate-950 focus:border-emerald-600"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsWeighModalOpen(false)}
              className="min-h-12 flex-1 rounded-2xl border-2 border-slate-300 text-base font-bold text-slate-800 hover:bg-slate-100"
            >
              Kanselahin (Cancel)
            </Button>
            <Button
              type="button"
              onClick={handleSaveWeight}
              disabled={isSavingWeight}
              className="min-h-12 flex-1 rounded-2xl bg-emerald-700 text-base font-black text-white hover:bg-emerald-800 shadow-md"
            >
              {isSavingWeight ? "Itinatabi..." : "I-save ang Timbang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: ADD ANIMAL TO BATCH (SENIOR & MOBILE FRIENDLY FORM) ───── */}
      <Dialog open={isAddIndividualOpen} onOpenChange={setIsAddIndividualOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl bg-white p-5 sm:p-7 shadow-2xl sm:max-h-[92dvh] sm:max-w-lg">
          <form onSubmit={handleAddIndividual} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-xl sm:text-2xl font-black text-slate-950">
                <Plus className="size-6 text-emerald-700" />
                <span>Magdagdag ng Hayop sa Pangkat</span>
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base font-medium leading-relaxed text-slate-700">
                Idagdag ang impormasyon ng hayop sa pangkat na{" "}
                <strong className="text-slate-950">{currentBatch?.batchName || "ito"}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4 py-2 text-base sm:grid-cols-2">
              {/* Tag Number */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label
                  htmlFor="new-herd-animal-tag"
                  className="text-base font-black text-slate-900"
                >
                  Numero ng Ear Tag <span className="text-rose-600">*</span>
                </Label>
                <Input
                  id="new-herd-animal-tag"
                  value={newAnimalData.tagNumber}
                  onChange={(e) =>
                    setNewAnimalData({ ...newAnimalData, tagNumber: e.target.value })
                  }
                  placeholder="Halimbawa: TAG-001"
                  className="min-h-12 rounded-2xl border-2 border-slate-300 text-base font-bold uppercase"
                  required
                />
              </div>

              {/* Sex */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="new-herd-animal-sex"
                  className="text-base font-black text-slate-900"
                >
                  Kasarian (Sex) <span className="text-rose-600">*</span>
                </Label>
                <Select
                  value={newAnimalData.sex}
                  onValueChange={(sex) => setNewAnimalData({ ...newAnimalData, sex })}
                >
                  <SelectTrigger
                    id="new-herd-animal-sex"
                    className="min-h-12 rounded-2xl border-2 border-slate-300 text-base font-bold text-slate-900"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEMALE">Babae (Female)</SelectItem>
                    <SelectItem value="MALE">Lalaki (Male)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Breed */}
              <LivestockBreedField
                id="batch-animal-breed"
                species={currentBatch?.species}
                value={newAnimalData.breed}
                onChange={(breed) => setNewAnimalData({ ...newAnimalData, breed })}
                required
                className="text-base font-bold"
              />

              {/* Weight */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="new-herd-animal-weight-optional"
                  className="text-sm font-bold text-slate-800"
                >
                  Timbang sa kilo (Opsiyonal)
                </Label>
                <Input
                  id="new-herd-animal-weight-optional"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={newAnimalData.weight}
                  onChange={(e) =>
                    setNewAnimalData({ ...newAnimalData, weight: e.target.value })
                  }
                  placeholder="Hal. 65"
                  className="min-h-12 rounded-2xl border-2 border-slate-300 text-base font-semibold"
                />
              </div>

              {/* Birth Date */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="new-herd-animal-birth-date"
                  className="text-sm font-bold text-slate-800"
                >
                  Kaarawan (Opsiyonal)
                </Label>
                <Input
                  id="new-herd-animal-birth-date"
                  type="date"
                  max={localCalendarDateToday()}
                  value={newAnimalData.birthDate}
                  onChange={(e) =>
                    setNewAnimalData({ ...newAnimalData, birthDate: e.target.value })
                  }
                  className="min-h-12 w-full rounded-2xl border-2 border-slate-300 text-base font-semibold"
                />
              </div>

              {/* Vaccination Date */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label
                  htmlFor="new-herd-animal-vaccination-date"
                  className="text-sm font-bold text-slate-800"
                >
                  Huling Petsa ng Bakuna (Opsiyonal)
                </Label>
                <Input
                  id="new-herd-animal-vaccination-date"
                  type="date"
                  max={localCalendarDateToday()}
                  value={newAnimalData.lastVaccinationDate}
                  onChange={(e) =>
                    setNewAnimalData({
                      ...newAnimalData,
                      lastVaccinationDate: e.target.value,
                    })
                  }
                  className="min-h-12 w-full rounded-2xl border-2 border-slate-300 text-base font-semibold"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddIndividualOpen(false)}
                className="min-h-12 flex-1 rounded-2xl border-2 border-slate-300 text-base font-bold text-slate-800 hover:bg-slate-100"
              >
                Kanselahin
              </Button>
              <Button
                type="submit"
                disabled={isSavingAnimal}
                className="min-h-12 flex-1 rounded-2xl bg-emerald-700 text-base font-black text-white hover:bg-emerald-800 shadow-md"
              >
                {isSavingAnimal ? "Itinatabi..." : "I-save ang Hayop"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
