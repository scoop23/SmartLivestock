"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Layers,
  ArrowLeft,
  Plus,
  Scale,
  ShieldCheck,
  AlertTriangle,
  Search,
  Eye,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Beef,
  RefreshCw,
  Tag,
  Clock,
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
import api from "@/lib/axios";
import { localCalendarDateToday } from "@/lib/livestock-age";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLivestockBatches,
  getDefaultAvatarForSpecies,
  INVENTORY_QUERY_KEYS,
} from "../livestock-inventory";
import { LivestockPhotoManager } from "../livestock-photo-manager";

// ── Types for Individual Animals inside a Batch ──────────────────────────────
export interface BatchIndividual {
  id: string;
  tagNumber: string | null;
  sex: string;
  weightKg: number | null;
  lastVaccinationDate: string | null;
  operationalStatus: string;
  reviewStatus?: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";
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

// Helper to render official regulatory review badge for herds
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
  if (status === "REJECTED") {
    return (
      <Badge variant="outline" className="bg-rose-50 text-rose-800 border-rose-300 text-[10px] font-black px-1.5 py-0 gap-1 shrink-0">
        Rejected
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
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
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
  const herdLoadMessage = herdLoadStatus === 401
    ? "Your session has expired. Sign in again to view herd records."
    : herdLoadStatus === 403
      ? "You don't have permission to view herd records."
      : "Unable to load herd records. Please try again.";

  // Local state for interactive enhancements
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("ALL");

  // Dialog States
  const [isAddIndividualOpen, setIsAddIndividualOpen] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
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

  // Auto-select batch from ?batch=<id> query param (e.g. coming from livestock profile)
  useEffect(() => {
    const batchFromQuery = searchParams?.get("batch");
    if (batchFromQuery) {
      setSelectedBatchId(batchFromQuery);
    }
  }, [searchParams]);

  // This page lists persisted herd records only; it never synthesizes demo herds or animals.
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
        })),
      }));
  }, [backendBatches]);

  // Active selected batch
  const currentBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null;
    const found = batches.find((b) => b.id === selectedBatchId);
    return found || batches[0];
  }, [batches, selectedBatchId]);

  const canAddAnimalsToCurrentBatch =
    currentBatch?.status === "ACTIVE" && currentBatch.reviewStatus === "PENDING";

  // Filter individuals inside current batch
  const filteredIndividuals = useMemo(() => {
    if (!currentBatch) return [];
    return currentBatch.individuals.filter((animal) => {
      const matchSearch =
        (animal.tagNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        animal.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchGender = genderFilter === "ALL" || animal.sex.toUpperCase() === genderFilter.toUpperCase();
      return matchSearch && matchGender;
    });
  }, [currentBatch, searchQuery, genderFilter]);

  // Calculations for Batch Yield
  const yieldMetrics = useMemo(() => {
    if (!currentBatch) return { totalBiomass: null, readinessPct: null, weighedAnimalCount: 0 };
    const weighedActiveAnimals = currentBatch.individuals.filter(
      (animal) => animal.operationalStatus === "ACTIVE" && animal.weightKg !== null,
    );
    const totalBiomass = weighedActiveAnimals.length > 0
      ? Math.round(weighedActiveAnimals.reduce((acc, animal) => acc + (animal.weightKg || 0), 0) * 10) / 10
      : null;

    const readinessPct = currentBatch.averageWeightKg !== null && currentBatch.targetWeightKg
      ? Math.min(Math.round((currentBatch.averageWeightKg / currentBatch.targetWeightKg) * 100), 100)
      : null;

    return { totalBiomass, readinessPct, weighedAnimalCount: weighedActiveAnimals.length };
  }, [currentBatch]);

  // Handlers
  const handleResubmitHerd = async () => {
    if (!currentBatch || !backendBatches.some((batch) => String(batch.id) === currentBatch.id)) return;
    setIsResubmitting(true);
    try {
      await api.patch(`livestock/batches/${currentBatch.id}/`, { resubmit: true });
      await queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Whole herd resubmitted to SIBAT for verification.");
    } catch (error) {
      console.error("Herd resubmission failed:", error);
      toast.error("Could not resubmit the herd. Check that every member is returned for revision.");
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleOpenWeighModal = (animal: BatchIndividual) => {
    setWeighTarget(animal);
    setNewWeightInput(animal.weightKg === null ? "" : String(animal.weightKg));
    setIsWeighModalOpen(true);
  };

  const handleSaveWeight = async () => {
    if (!weighTarget || !currentBatch) return;
    const weightNum = parseFloat(newWeightInput);
    if (isNaN(weightNum) || weightNum <= 0) {
      toast.error("Please enter a valid weight in kilograms.");
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
      await queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.inventory });
      await queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.batches });
      toast.success(`Weight recorded for ${weighTarget.tagNumber}: ${weightNum} kg`);
      setIsWeighModalOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.livestock?.[0] || error.response?.data?.detail || "Could not save the weight record.");
    } finally {
      setIsSavingWeight(false);
    }
  };

  const handleAddIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBatch) return;

    if (!newAnimalData.tagNumber.trim()) {
      toast.error("Ear Tag Number is required.");
      return;
    }

    setIsSavingAnimal(true);
    try {
      await api.post(`livestock/batches/${currentBatch.id}/animals/`, {
        animals: [{
          tag_number: newAnimalData.tagNumber.trim().toUpperCase(),
          breed: newAnimalData.breed.trim(),
          sex: newAnimalData.sex,
          weight: newAnimalData.weight || null,
          birth_date: newAnimalData.birthDate || null,
          last_vaccination_date: newAnimalData.lastVaccinationDate || null,
        }],
      });
      await queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.batches });
      await queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.inventory });
      toast.success(`Animal ${newAnimalData.tagNumber.trim().toUpperCase()} registered to ${currentBatch.batchCode}.`);
      setIsAddIndividualOpen(false);
      setNewAnimalData({
        tagNumber: "",
        breed: "",
        sex: "FEMALE",
        weight: "",
        birthDate: "",
        lastVaccinationDate: "",
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.response?.data?.detail || "Could not add the animal to this herd.");
    } finally {
      setIsSavingAnimal(false);
    }
  };

  return (
    <>
      <PageHeader
        title="My Herds"
        subtitle="View your herds and the animals in each group."
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="w-full max-w-none space-y-6 p-4 md:p-6 xl:p-8">
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
              <span>{batches.length} Herds on Record</span>
            </div>
          </div>

          {currentBatch && backendBatches.some((batch) => String(batch.id) === currentBatch.id) && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  onClick={() => setIsAddIndividualOpen(true)}
                  disabled={!canAddAnimalsToCurrentBatch}
                  size="sm"
                  className="min-h-11 w-full rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-sm disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:w-auto"
                >
                  <Plus className="size-4" /> Add Animal to Batch
                </Button>
                {!canAddAnimalsToCurrentBatch && (
                  <p className="self-center text-xs text-slate-500 sm:max-w-64">
                    Animals can only be added while a herd is active and before verification begins.
                  </p>
                )}
              </div>
            )}
        </div>

        {/* On desktop, keep herd selection beside its details to use the wide page area. */}
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(17rem,0.8fr)_minmax(0,2fr)]">
        {/* ── BATCH SELECTOR CARDS ────────────────────────────────────────── */}
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
          {isBatchesLoading && <Card className="rounded-2xl border-slate-200 p-6 text-sm text-slate-500">Loading your herd records…</Card>}
          {!isBatchesLoading && isBatchesError && (
            <Card className="rounded-2xl border-rose-200 p-6 text-sm text-rose-700">
              <p role="alert">{herdLoadMessage}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void refetchBatches()}
                className="mt-3 min-h-10 border-rose-200 text-rose-800 hover:bg-rose-50"
              >
                <RefreshCw className="mr-2 size-4" /> Try again
              </Button>
            </Card>
          )}
          {!isBatchesLoading && !isBatchesError && batches.length === 0 && (
            <Card className="rounded-2xl border-slate-200 p-6">
              <h2 className="font-bold text-slate-900">No herds recorded</h2>
              <p className="mt-1 text-sm text-slate-600">Registered herds will appear here with their saved livestock records.</p>
              <Link href="/livestock-inventory" className="mt-3 inline-flex text-sm font-semibold text-emerald-700 hover:underline">Open Livestock Inventory</Link>
            </Card>
          )}
          {batches.map((batch) => {
            const isSelected = currentBatch?.id === batch.id;
            const avatar = getDefaultAvatarForSpecies(batch.species);
            const headCount = batch.activeCount;
            return (
              <Card
                key={batch.id}
                onClick={() => setSelectedBatchId(batch.id)}
                className={`group relative cursor-pointer transition-all duration-200 rounded-2xl border-2 overflow-hidden flex flex-col justify-between ${isSelected
                  ? "border-emerald-600 bg-gradient-to-b from-emerald-50/50 via-white to-emerald-50/20 shadow-md ring-2 ring-emerald-500/20"
                  : "border-slate-200 hover:border-emerald-300 hover:shadow-md bg-white hover:-translate-y-0.5"
                  }`}
              >
                {/* Top Ambient Glow / Accent Strip */}
                <div
                  className={`h-1.5 w-full transition-colors ${isSelected
                    ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500"
                    : "bg-transparent group-hover:bg-emerald-400/40"
                    }`}
                />

                <CardContent className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {batch.photoUrl ? (
                        <img src={batch.photoUrl} alt={`${batch.batchName} herd`} className="size-14 shrink-0 rounded-xl border border-slate-200 object-cover" />
                      ) : (
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-3xl" aria-hidden="true">{avatar.emoji}</div>
                      )}
                      <div className="min-w-0">
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase text-emerald-900">
                        <span aria-hidden="true">{avatar.emoji}</span>
                        <span className="break-words">{batch.species}</span>
                      </span>
                      <h2 className="mt-3 break-words text-lg font-black leading-snug text-slate-900 group-hover:text-emerald-800">
                        {batch.batchName || "Unnamed herd"}
                      </h2>
                      <p className="mt-1 break-words text-sm text-slate-600">{batch.breed || "Breed not recorded"}</p>
                      <p className="mt-2 inline-block break-all rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600">
                        {batch.batchCode}
                      </p>
                      </div>
                    </div>
                    <div className="shrink-0 rounded-2xl bg-emerald-50 px-3 py-2 text-center">
                      <p className="text-2xl font-black leading-none text-emerald-900">{headCount}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Active</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <Badge variant="outline" className="max-w-full whitespace-normal break-words">
                      {batch.status || "Status not recorded"}
                    </Badge>
                    {getReviewStatusBadge(batch.reviewStatus)}
                  </div>

                  <Button
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedBatchId(batch.id);
                    }}
                    className={`mt-auto min-h-11 w-full rounded-xl font-bold ${isSelected ? "bg-emerald-700 text-white hover:bg-emerald-800" : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"}`}
                  >
                    {isSelected ? "Viewing this herd" : "View Herd"}
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── ACTIVE BATCH OVERVIEW HERO & KPIS ───────────────────────────── */}
        {currentBatch && (
          <div className="min-w-0 space-y-6">
            {/* Banner Header */}
            <div className="bg-gradient-to-r from-[#1E4D2B] via-[#245833] to-[#1a4425] text-white p-6 rounded-3xl shadow-lg border border-emerald-800/40 relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  {currentBatch.photoUrl ? (
                    <img src={currentBatch.photoUrl} alt={`${currentBatch.batchName} herd`} className="size-20 shrink-0 rounded-2xl border-2 border-white/30 object-cover sm:size-24" />
                  ) : (
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl border-2 border-white/20 bg-white/10 text-5xl sm:size-24" aria-hidden="true">{getDefaultAvatarForSpecies(currentBatch.species).emoji}</div>
                  )}
                  <div className="min-w-0 space-y-1.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-bold uppercase tracking-wider backdrop-blur-xs border border-white/10">
                    <Beef className="size-3.5" />
                    <span>Herd Code: {currentBatch.batchCode}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                    {currentBatch.batchName || "Unnamed herd"}
                  </h2>
                  <p className="text-xs text-emerald-100/80 font-medium">
                    {currentBatch.batchCode} &bull; {currentBatch.species} &bull; {currentBatch.breed || "Breed not recorded"}
                  </p>
                  {currentBatch.reviewRemarks && (
                    <div className="inline-block mt-1">
                      <p className="text-[11px] text-emerald-200/90 italic bg-black/25 px-2.5 py-1 rounded-lg border border-white/10 max-w-xl">
                        Official LGU Note: &ldquo;{currentBatch.reviewRemarks}&rdquo;
                      </p>
                    </div>
                  )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {backendBatches.some((batch) => String(batch.id) === currentBatch.id) && (
                    <LivestockPhotoManager
                      title="Herd Photo"
                      subject="herd"
                      currentPhotoUrl={currentBatch.photoUrl}
                      allowAvatar={false}
                      fallback={<div className="flex size-36 items-center justify-center rounded-2xl bg-emerald-50 text-6xl">{getDefaultAvatarForSpecies(currentBatch.species).emoji}</div>}
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
                        await queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.batches });
                        toast.success("Herd photo updated.");
                      }}
                    />
                  )}
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

                  {currentBatch.reviewStatus === "SUBJECT_TO_REVISION" &&
                    backendBatches.some((batch) => String(batch.id) === currentBatch.id) && (
                      <Button
                        type="button"
                        disabled={isResubmitting}
                        onClick={handleResubmitHerd}
                        className="bg-amber-400 text-amber-950 hover:bg-amber-300 rounded-xl text-xs font-bold"
                      >
                        <RefreshCw className="size-3.5 mr-1.5" />
                        {isResubmitting ? "Resubmitting..." : "Resubmit Whole Herd"}
                      </Button>
                    )}

                </div>
              </div>
            </div>

            {/* Batch Notes (audit trail from farmer + SIBAT/MAO reviewers) */}
            <Card className="rounded-2xl border-slate-200 shadow-xs bg-white overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ClipboardList className="size-3.5 text-emerald-600" /> Batch Notes
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-400">
                  Registration details and official audit trail from SIBAT / MAO.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <pre className="text-xs text-slate-600 font-sans whitespace-pre-wrap leading-relaxed">
                  {currentBatch.notes || "No notes recorded for this batch yet."}
                </pre>
              </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Head Count</span>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-black text-slate-900">
                      {currentBatch.activeCount}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">Active animals in the herd</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Average Weight</span>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-black text-slate-900">
                      {currentBatch.averageWeightKg ?? "Not recorded"} {currentBatch.averageWeightKg !== null && <span className="text-sm font-semibold text-slate-400">kg</span>}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">Target: {currentBatch.targetWeightKg == null ? "Not recorded" : `${currentBatch.targetWeightKg} kg`}</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Total Live Biomass</span>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-black text-emerald-700">
                      {yieldMetrics.totalBiomass ?? "Not recorded"} {yieldMetrics.totalBiomass !== null && <span className="text-sm font-semibold text-slate-400">kg</span>}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">From {yieldMetrics.weighedAnimalCount} active animals with weight records</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400">Harvest Readiness</span>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-black text-slate-900">
                      {yieldMetrics.readinessPct === null ? "Not recorded" : `${yieldMetrics.readinessPct}%`}
                    </p>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-emerald-600 h-1.5 rounded-full"
                      style={{ width: `${yieldMetrics.readinessPct ?? 0}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">Based on recorded average and target weights</p>
                </CardContent>
              </Card>
            </div>

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
                    Individual records linked to this herd, using saved livestock details.
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
                        <TableHead className="font-bold text-xs text-slate-600">Gender</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Weight (kg)</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Last Vaccination</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600">Review Status</TableHead>
                        <TableHead className="font-bold text-xs text-slate-600 text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIndividuals.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-400 font-medium">
                            {currentBatch.individuals.length === 0
                              ? "No individual livestock records are linked to this herd."
                              : "No livestock records matched the current filters."}
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
                              className={`transition-colors hover:bg-slate-50/60 ${hasInventoryRecord ? "cursor-pointer" : ""}`}
                            >
                              <TableCell className="font-black text-xs text-slate-900">
                                {hasInventoryRecord ? <Link
                                  href={`/livestock-inventory/${animal.id}`}
                                  className="text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1.5"
                                >
                                  <Tag className="size-3 text-emerald-600" />
                                  <span>{animal.tagNumber || "No tag recorded"}</span>
                                </Link> : <span className="flex items-center gap-1.5 text-slate-500">
                                  <Tag className="size-3 text-slate-400" />
                                  <span>{animal.tagNumber || "No tag recorded"}</span>
                                </span>}
                              </TableCell>

                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] font-black uppercase ${animal.sex.toUpperCase() === "FEMALE"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : animal.sex.toUpperCase() === "MALE"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                >
                                  {animal.sex}
                                </Badge>
                              </TableCell>

                              <TableCell className="text-xs text-slate-600 font-medium">
                                {animal.weightKg === null ? "Not recorded" : `${animal.weightKg} kg`}
                              </TableCell>

                              <TableCell className="text-xs text-slate-600 font-medium">
                                {animal.lastVaccinationDate || "Not recorded"}
                              </TableCell>

                              <TableCell>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    animal.reviewStatus === "APPROVED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : animal.reviewStatus === "VERIFIED"
                                        ? "bg-blue-100 text-blue-800"
                                      : animal.reviewStatus === "REJECTED"
                                        ? "bg-rose-100 text-rose-800"
                                        : animal.reviewStatus === "SUBJECT_TO_REVISION"
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  <span className="size-1.5 rounded-full bg-current" />
                                  {animal.reviewStatus === "SUBJECT_TO_REVISION"
                                    ? "For Revision"
                                      : animal.reviewStatus === "REJECTED"
                                        ? "Rejected"
                                        : animal.reviewStatus === "VERIFIED"
                                          ? "Verified"
                                          : animal.reviewStatus === "APPROVED"
                                            ? "Approved"
                                            : "Pending"}
                                </span>
                              </TableCell>

                              <TableCell className="text-right pr-6">
                                <div className="inline-flex items-center gap-1.5">
                                  {animal.operationalStatus === "ACTIVE" && hasInventoryRecord && <Button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleOpenWeighModal(animal);
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px] rounded-lg font-bold border-slate-200 hover:bg-emerald-50 hover:text-emerald-800"
                                    title="Quick Log Weight"
                                  >
                                    <Scale className="size-3 mr-1 text-emerald-600" /> Weigh
                                  </Button>}

                                  {hasInventoryRecord ? <Link href={`/livestock-inventory/${animal.id}`} onClick={(event) => event.stopPropagation()}>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-[11px] rounded-lg font-bold text-slate-700 hover:bg-slate-100"
                                    >
                                      <Eye className="size-3 mr-1 text-slate-500" /> Details
                                    </Button>
                                  </Link> : <Button size="sm" variant="ghost" disabled title="No saved individual animal record is linked to this herd row.">
                                    <Eye className="size-3 mr-1" /> Details
                                  </Button>}
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
              This creates a weight record and updates the animal&apos;s current weight.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
              <span className="font-bold text-slate-600">Previous Recorded Weight:</span>
              <span className="font-black text-slate-900">{weighTarget?.weightKg == null ? "Not recorded" : `${weighTarget.weightKg} kg`}</span>
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
              disabled={isSavingWeight}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
            >
              {isSavingWeight ? "Saving…" : "Save Weigh Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: ADD INDIVIDUAL TO BATCH ───────────────────────────────── */}
      <Dialog open={isAddIndividualOpen} onOpenChange={setIsAddIndividualOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:max-h-[90dvh] sm:max-w-lg sm:p-6">
          <form onSubmit={handleAddIndividual}>
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Plus className="size-5 text-emerald-600" />
                <span>Add Animal to {currentBatch?.batchCode}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Create a real individual livestock record in this herd. The animal will appear after it is saved.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3.5 py-4 text-xs sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
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
                <Label className="font-bold text-slate-700">Sex</Label>
                <Select
                  value={newAnimalData.sex}
                  onValueChange={(sex) => setNewAnimalData({ ...newAnimalData, sex })}
                >
                  <SelectTrigger className="rounded-xl border-slate-300 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="MALE">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Breed</Label>
                <Input
                  value={newAnimalData.breed}
                  onChange={(e) => setNewAnimalData({ ...newAnimalData, breed: e.target.value })}
                  className="rounded-xl border-slate-300"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Weight (kg, optional)</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={newAnimalData.weight}
                  onChange={(e) => setNewAnimalData({ ...newAnimalData, weight: e.target.value })}
                  placeholder="e.g. 65"
                  className="min-w-0 rounded-xl border-slate-300"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-slate-700">Birth Date (optional)</Label>
                <Input
                  type="date"
                  max={localCalendarDateToday()}
                  value={newAnimalData.birthDate}
                  onChange={(e) => setNewAnimalData({ ...newAnimalData, birthDate: e.target.value })}
                  className="h-11 min-w-0 w-full rounded-xl border-slate-300"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="font-bold text-slate-700">Last Vaccination Date (optional)</Label>
                <Input
                  type="date"
                  max={localCalendarDateToday()}
                  value={newAnimalData.lastVaccinationDate}
                  onChange={(e) => setNewAnimalData({ ...newAnimalData, lastVaccinationDate: e.target.value })}
                  className="h-11 min-w-0 w-full rounded-xl border-slate-300"
                />
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
                disabled={isSavingAnimal}
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
              >
                {isSavingAnimal ? "Saving…" : "Save to Herd"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </>
  );
}
