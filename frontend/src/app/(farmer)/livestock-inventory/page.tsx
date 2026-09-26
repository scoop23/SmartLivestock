"use client";

import { useState, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/app/components/page-header";
import { toast } from "sonner";

// Lucide Icons
import {
  ArrowLeft,
  Plus,
  Layers,
  FileDown,
  Minus,
  CheckCircle2,
  Clock,
  Tag,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Beef,
  Shield,
  Package,
  Egg,
  Eye,
  AlertCircle,
  Wand2,
  Syringe,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Activity,
  HeartPulse,
  RefreshCw,
  Trash2,
  Users,
  Camera,
  Upload,
  Image as ImageIcon,
  Check,
  X,
} from "lucide-react";

// shadcn/ui primitives
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import LivestockDetailsDialog from "./livestock-details-dialog";
import LivestockEditDialog from "./livestock-edit-dialog";
import LivestockRecordList from "./livestock-record-list";
import LivestockTypeCards from "./livestock-type-cards";
import InventoryStats from "./inventory-stats";
import HealthTrackerTab from "./health-tracker-tab";
import api from "@/lib/axios";
import {
  type EntryType,
  type StatusType,
  type LivestockInventoryItem,
  type LivestockType,
  type InventoryApiItem,
  type CreateInventoryPayload,
  type UpdateInventoryPayload,
  useLivestockTypes,
  useUserInventory,
  useLivestockBatches,
  SPECIES_PRESETS,
  getSpeciesPreset,
  generateSuggestedTag,
  LIVESTOCK_AVATAR_PRESETS,
  getDefaultAvatarForSpecies,
  getAvatarById,
  type LivestockAvatarOption,
} from "./livestock-inventory";

// Re-export types for any existing consumers
export type { EntryType, StatusType, LivestockInventoryItem, LivestockType, InventoryApiItem };

export default function LivestockInventoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"types" | "all" | "health">("types");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LivestockInventoryItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<LivestockInventoryItem | null>(null);
  const [editTarget, setEditTarget] = useState<LivestockInventoryItem | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showHeroBanner, setShowHeroBanner] = useState(false);
  const [showStats, setShowStats] = useState(true);

  const { data: livestockTypes = {} } = useLivestockTypes();
  const { data: inventories = [], isLoading, refetch, isFetching } = useUserInventory();
  const { data: userBatches = [] } = useLivestockBatches();

  // Form State matching Django LivestockInventory
  const initialFormData = {
    entryType: "INDIVIDUAL" as EntryType,
    livestockType: "Cattle",
    quantity: 1,
    tagNumber: "",
    batchId: "",
    batchName: "",
    housingPen: "",
    feedType: "",
    breed: "Brahman",
    isOtherBreed: false,
    customBreed: "",
    sex: "Female",
    weight: "",
    isVaccinated: false,
    lastVaccinationDate: "",
    photoDataUrl: "",
    avatarKey: "cow-brahman",
  };
  const [formData, setFormData] = useState(initialFormData);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAllAvatars, setShowAllAvatars] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo exceeds 5MB. Please choose a smaller image.");
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setFormData((prev) => ({ ...prev, photoDataUrl: dataUrl }));
      toast.success("Livestock photo attached!");
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setFormData((prev) => ({ ...prev, photoDataUrl: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.info("Photo removed. Preset avatar will be used.");
  };

  const handleSelectAvatar = (avatarId: string) => {
    setPhotoFile(null);
    setFormData((prev) => ({
      ...prev,
      avatarKey: avatarId,
      photoDataUrl: "",
    }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success("Avatar selected!");
  };

  const selectedAvatarOption = useMemo(() => {
    return getAvatarById(formData.avatarKey, formData.livestockType);
  }, [formData.avatarKey, formData.livestockType]);

  const relevantAvatars = useMemo(() => {
    if (showAllAvatars) return LIVESTOCK_AVATAR_PRESETS;
    const current = formData.livestockType.toLowerCase();
    const matched = LIVESTOCK_AVATAR_PRESETS.filter((a) =>
      a.species.toLowerCase().includes(current)
    );
    return matched.length > 0 ? matched : LIVESTOCK_AVATAR_PRESETS;
  }, [formData.livestockType, showAllAvatars]);

  // Batch individual animals state for Add Modal
  interface BatchAnimalFormRow {
    id: string;
    tagNumber: string;
    breed: string;
    sex: "Female" | "Male" | "Castrated";
    weight: string;
    lastVaccinationDate: string;
  }

  const [batchAnimals, setBatchAnimals] = useState<BatchAnimalFormRow[]>([
    { id: "1", tagNumber: "SWN-B1-01", breed: "Large White", sex: "Female", weight: "65.0", lastVaccinationDate: "" },
    { id: "2", tagNumber: "SWN-B1-02", breed: "Large White", sex: "Male", weight: "68.5", lastVaccinationDate: "" },
    { id: "3", tagNumber: "SWN-B1-03", breed: "Large White", sex: "Female", weight: "64.0", lastVaccinationDate: "" },
  ]);

  const handleBatchQuantityChange = (newQty: number) => {
    const clamped = Math.max(1, Math.min(newQty, 50));
    setFormData((prev) => ({ ...prev, quantity: clamped }));
    const preset = getSpeciesPreset(formData.livestockType);
    const defaultBreed = batchAnimals[0]?.breed || preset.commonBreeds?.[0] || "Standard";
    const defaultWeight = batchAnimals[0]?.weight || "65";

    setBatchAnimals((prev) => {
      const next = [...prev];
      if (clamped > next.length) {
        for (let i = next.length + 1; i <= clamped; i++) {
          next.push({
            id: String(i),
            tagNumber: `${preset.tagPrefix}-B1-${i.toString().padStart(2, "0")}`,
            breed: defaultBreed,
            sex: i % 2 === 0 ? "Female" : i % 3 === 0 ? "Castrated" : "Male",
            weight: defaultWeight,
            lastVaccinationDate: "",
          });
        }
      } else if (clamped < next.length) {
        return next.slice(0, clamped);
      }
      return next;
    });
  };

  const updateBatchAnimalField = (
    index: number,
    field: keyof BatchAnimalFormRow,
    value: string
  ) => {
    setBatchAnimals((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addBatchAnimalRow = () => {
    const nextIdx = batchAnimals.length + 1;
    const preset = getSpeciesPreset(formData.livestockType);
    const newAnimal: BatchAnimalFormRow = {
      id: String(Date.now()),
      tagNumber: `${preset.tagPrefix}-B1-${nextIdx.toString().padStart(2, "0")}`,
      breed: batchAnimals[0]?.breed || preset.commonBreeds?.[0] || "Standard",
      sex: nextIdx % 2 === 0 ? "Female" : "Male",
      weight: batchAnimals[0]?.weight || "65",
      lastVaccinationDate: "",
    };
    const updated = [...batchAnimals, newAnimal];
    setBatchAnimals(updated);
    setFormData((prev) => ({ ...prev, quantity: updated.length }));
  };

  const removeBatchAnimalRow = (index: number) => {
    if (batchAnimals.length <= 1) return;
    const updated = batchAnimals.filter((_, i) => i !== index);
    setBatchAnimals(updated);
    setFormData((prev) => ({ ...prev, quantity: updated.length }));
  };

  const syncBreedToAllAnimals = () => {
    const firstBreed = batchAnimals[0]?.breed?.trim();
    if (!firstBreed) {
      toast.info("Please enter a breed on Animal #1 first.");
      return;
    }
    setBatchAnimals((prev) => prev.map((a) => ({ ...a, breed: firstBreed })));
    toast.success(`Applied breed "${firstBreed}" to all ${batchAnimals.length} animals.`);
  };

  const reTagAllBatchAnimals = () => {
    const preset = getSpeciesPreset(formData.livestockType);
    const prefix = preset.tagPrefix || formData.livestockType.slice(0, 3).toUpperCase();
    const batchCode = Math.floor(100 + Math.random() * 900);
    setBatchAnimals((prev) =>
      prev.map((a, idx) => ({
        ...a,
        tagNumber: `${prefix}-B${batchCode}-${(idx + 1).toString().padStart(2, "0")}`,
      }))
    );
    toast.success(`Auto-generated sequential tags for ${batchAnimals.length} animals.`);
  };

  const resetBatchAnimalsToPreset = (species: string = "Swine") => {
    const preset = getSpeciesPreset(species);
    const prefix = preset.tagPrefix || species.slice(0, 3).toUpperCase();
    const defBreed = preset.commonBreeds?.[0] || "Standard";
    const defWeight = preset.suggestedWeightKg ? String(preset.suggestedWeightKg) : "65";
    setBatchAnimals([
      { id: "1", tagNumber: `${prefix}-B1-01`, breed: defBreed, sex: "Female", weight: defWeight, lastVaccinationDate: "" },
      { id: "2", tagNumber: `${prefix}-B1-02`, breed: defBreed, sex: "Male", weight: defWeight, lastVaccinationDate: "" },
      { id: "3", tagNumber: `${prefix}-B1-03`, breed: defBreed, sex: "Female", weight: defWeight, lastVaccinationDate: "" },
    ]);
  };

  const batchMetrics = useMemo(() => {
    if (batchAnimals.length === 0) return { avgWeight: 0, totalWeight: 0 };
    const totalWeight = batchAnimals.reduce(
      (sum, a) => sum + (parseFloat(a.weight) || 0),
      0
    );
    const avgWeight = Math.round((totalWeight / batchAnimals.length) * 10) / 10;
    return { avgWeight, totalWeight: Math.round(totalWeight * 10) / 10 };
  }, [batchAnimals]);

  // Suggested breeds for currently selected species
  const currentPreset = getSpeciesPreset(formData.livestockType);

  // Overall Farm Telemetry Metrics
  const totalHeads = useMemo(
    () => inventories.reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );
  const approvedHeads = useMemo(
    () =>
      inventories
        .filter((i) => i.status === "APPROVED")
        .reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );
  const pendingRecords = useMemo(
    () => inventories.filter((i) => i.status === "PENDING").length,
    [inventories]
  );
  const individualTags = useMemo(
    () => inventories.filter((i) => i.entryType === "INDIVIDUAL").length,
    [inventories]
  );
  const vaccinatedHeads = useMemo(
    () =>
      inventories
        .filter((i) => Boolean(i.lastVaccinationDate))
        .reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );
  const vaxRate = totalHeads > 0 ? Math.round((vaccinatedHeads / totalHeads) * 100) : 0;
  const approvalRate = totalHeads > 0 ? Math.round((approvedHeads / totalHeads) * 100) : 0;
  const speciesCount = useMemo(() => {
    const set = new Set(inventories.map((i) => i.livestockTypeName).filter(Boolean));
    return set.size || Object.keys(livestockTypes).length;
  }, [inventories, livestockTypes]);

  // Filtered inventories when a specific species is clicked
  const typeFilteredInventories = selectedType
    ? inventories.filter((item) => item.livestockTypeName === selectedType)
    : inventories;

  // Mutations
  const addMutation = useMutation({
    mutationFn: async () => {
      const typeId = livestockTypes[formData.livestockType];
      if (!typeId) {
        throw new Error("Selected livestock type is invalid or not found in system.");
      }

      if (formData.entryType === "INDIVIDUAL") {
        const finalBreed = formData.isOtherBreed
          ? (formData.customBreed?.trim() || "Mixed / Crossbred")
          : (formData.breed?.trim() || "Standard");

        let response;
        if (photoFile) {
          const body = new FormData();
          body.append("livestock_type", String(typeId));
          body.append("entry_type", "INDIVIDUAL");
          body.append("quantity", "1");
          body.append("tag_number", formData.tagNumber.trim());
          body.append("breed", finalBreed);
          body.append("sex", formData.sex);
          if (formData.weight) body.append("weight", formData.weight);
          if (formData.lastVaccinationDate) body.append("last_vaccination_date", formData.lastVaccinationDate);
          if (formData.batchId) body.append("batch", String(formData.batchId));
          if (formData.avatarKey) body.append("avatar_key", formData.avatarKey);
          body.append("photo", photoFile);

          response = await api.post("/livestock/inventory/", body, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          const payload: any = {
            livestock_type: typeId,
            entry_type: "INDIVIDUAL",
            quantity: 1,
            tag_number: formData.tagNumber.trim(),
            breed: finalBreed,
            sex: formData.sex,
            weight: formData.weight ? parseFloat(formData.weight) : null,
            last_vaccination_date: formData.lastVaccinationDate || null,
          };
          if (formData.batchId) payload.batch = Number(formData.batchId);
          if (formData.avatarKey) payload.avatar_key = formData.avatarKey;

          response = await api.post("/livestock/inventory/", payload);
        }

        if (response.data?.id) {
          try {
            if (formData.photoDataUrl) {
              localStorage.setItem(`livestock_photo_${response.data.id}`, formData.photoDataUrl);
            }
            if (formData.avatarKey) {
              localStorage.setItem(`livestock_avatar_${response.data.id}`, formData.avatarKey);
            }
          } catch (e) {
            console.error("Local storage photo cache error:", e);
          }
        }
        return response.data;
      } else {
        // BATCH submission:
        const avgWeight = batchAnimals.length > 0
          ? Math.round(
            (batchAnimals.reduce((acc, a) => acc + (parseFloat(a.weight) || 0), 0) / batchAnimals.length) * 10
          ) / 10
          : null;
        const mainBreed = formData.isOtherBreed
          ? (formData.customBreed?.trim() || "Mixed / Cohort Hybrid")
          : (formData.breed?.trim() || batchAnimals[0]?.breed?.trim() || "Standard Cohort");
        const batchTag = `BATCH-${formData.livestockType.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const batchName = formData.batchName?.trim() || `${formData.livestockType} Cohort (${batchAnimals.length} Heads)`;

        // Post to /livestock/batches/ to create both the LivestockBatch and individual child animals atomically
        const response = await api.post("/livestock/batches/", {
          livestock_type: typeId,
          batch_name: batchName,
          batch_code: batchTag,
          housing_pen: formData.housingPen?.trim() || "Standard Pen",
          feed_type: formData.feedType?.trim() || "Standard Rations",
          target_weight: avgWeight ? Math.round(avgWeight * 1.3) : null,
          animals: batchAnimals.map((a) => ({
            tag_number: a.tagNumber.trim(),
            breed: (a.breed?.trim() && a.breed !== "Others") ? a.breed.trim() : mainBreed,
            sex: a.sex,
            weight: a.weight ? parseFloat(a.weight) : null,
            last_vaccination_date: a.lastVaccinationDate || null,
          })),
        });

        if (response.data?.id) {
          try {
            const formattedAnimals = batchAnimals.map((a, idx) => ({
              id: `${response.data.id}-${idx + 1}`,
              tagNumber: a.tagNumber.trim(),
              name: `Livestock #${idx + 1}`,
              sex: a.sex,
              ageMonths: 4,
              weightKg: parseFloat(a.weight) || 65,
              adgKgDay: 0.72,
              healthStatus: a.lastVaccinationDate ? ("Vaccinated" as const) : ("Healthy" as const),
              lastWeighedDate: new Date().toISOString().split("T")[0],
            }));
            localStorage.setItem(
              `batch_individuals_${response.data.id}`,
              JSON.stringify(formattedAnimals)
            );
          } catch (e) {
            console.error("Local storage save error:", e);
          }
        }
        return response.data;
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
      const wasBatch = formData.entryType === "BATCH";
      const registeredQty = wasBatch ? batchAnimals.length : formData.quantity;
      setIsAddOpen(false);
      setFormData(initialFormData);

      if (wasBatch) {
        toast.success(`Batch cohort of ${registeredQty} heads created!`, {
          description: "Individual animals saved. Would you like to view their cohort roster?",
          action: {
            label: "Open Batch Roster",
            onClick: () => router.push("/livestock-inventory/batches"),
          },
        });
      } else {
        toast.success("Livestock entry submitted for official review");
      }
    },
    onError: (err: any) => {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.tag_number?.[0] ||
        "Failed to add livestock entry. Please check required fields.";
      toast.error(msg);
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/livestock/inventory/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Livestock record deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete livestock record");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateInventoryPayload) => {
      if (!editTarget) throw new Error("No record selected");
      const response = await api.put(`/livestock/inventory/${editTarget.id}/`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setEditTarget(null);
      toast.success("Livestock entry updated successfully");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to update livestock entry");
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (formData.entryType === "INDIVIDUAL") {
      if (!formData.tagNumber.trim()) {
        setFormError("Ear Tag number is required for individual animals.");
        return;
      }
      if (!formData.breed.trim()) {
        setFormError("Breed is required.");
        return;
      }
      if (formData.isVaccinated && !formData.lastVaccinationDate) {
        setFormError("Please select the last vaccination date or uncheck 'Vaccinated'.");
        return;
      }
    } else {
      // BATCH validation
      if (batchAnimals.length < 1) {
        setFormError("At least 1 animal is required in a batch.");
        return;
      }
      for (let i = 0; i < batchAnimals.length; i++) {
        if (!batchAnimals[i].tagNumber.trim()) {
          setFormError(`Ear Tag is required for Animal #${i + 1}.`);
          return;
        }
        if (!batchAnimals[i].breed.trim()) {
          setFormError(`Breed is required for Animal #${i + 1}.`);
          return;
        }
      }
    }

    addMutation.mutate();
  };

  // CSV Export with UTF-8 BOM and RFC 4180 escaping
  const exportCSV = () => {
    if (inventories.length === 0) {
      toast.error("No livestock records available to export");
      return;
    }

    const headers = [
      "Ear Tag / ID",
      "Livestock Type",
      "Entry Mode",
      "Quantity",
      "Breed",
      "Sex",
      "Weight (kg)",
      "Vaccinated",
      "Last Vaccination Date",
      "Registry Status",
      "Review Remarks",
      "Registration Date",
    ];

    const rows = inventories.map((item) => [
      `"${(item.tagNumber || "").replace(/"/g, '""')}"`,
      `"${(item.livestockTypeName || "").replace(/"/g, '""')}"`,
      `"${(item.entryType || "").replace(/"/g, '""')}"`,
      item.quantity,
      `"${(item.breed || "").replace(/"/g, '""')}"`,
      `"${(item.sex || "").replace(/"/g, '""')}"`,
      item.weight ?? "",
      item.lastVaccinationDate ? "Yes" : "No",
      item.lastVaccinationDate ?? "",
      `"${(item.status || "").replace(/"/g, '""')}"`,
      `"${(item.reviewRemarks || "").replace(/"/g, '""')}"`,
      `"${new Date(item.createdAt).toLocaleDateString()}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `livestock_registry_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Livestock registry exported successfully as CSV");
  };

  return (
    <>
      <PageHeader
        title="Livestock Inventory"
        subtitle="Manage your livestock entries, track biometrics, and monitor herd health"
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
            title="Refresh Inventory Records"
          >
            <RefreshCw className={`size-5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <div className="p-4 md:p-8 w-full space-y-2">
        {/* ═══════════════════════════════════════════════════════════════
            EXECUTIVE FARM TELEMETRY HERO BANNER (COLLAPSIBLE)
        ═══════════════════════════════════════════════════════════════ */}
        {/* 1. Collapsed Top Ribbon (Slides in/out smoothly) */}
        <div
          className={`grid transition-[grid-template-rows,opacity,margin] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${!showHeroBanner
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none -mb-6"
            }`}
        >
          <div className="overflow-hidden min-h-0">
            <div
              className={`flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white border border-emerald-800/40 shadow-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${!showHeroBanner ? "translate-y-0 scale-100 opacity-100" : "-translate-y-4 scale-[0.98] opacity-0"
                }`}
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full backdrop-blur-md">
                  <Activity className="w-3 h-3 mr-1 text-emerald-400" />
                  Live Herd Registry
                </Badge>
                <span className="text-xs font-black text-white">
                  Livestock Inventory & Biometric Surveillance
                </span>
                <span className="text-xs font-medium text-emerald-200/70 hidden md:inline">
                  • {inventories.length} Registered Records
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCSV}
                  className="gap-1.5 border-emerald-700/50 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl h-9 px-3 text-xs backdrop-blur-md transition-all active:scale-95"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-300" />
                  Export CSV
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black gap-1.5 rounded-xl h-9 px-3.5 text-xs shadow-md shadow-emerald-950/40 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  Register Livestock
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHeroBanner(true)}
                  className="group relative overflow-hidden gap-1.5 border-emerald-400/40 hover:border-emerald-300/80 bg-gradient-to-r from-emerald-500/20 via-emerald-400/25 to-teal-500/20 hover:from-emerald-500/35 hover:via-emerald-400/35 hover:to-teal-500/30 text-emerald-100 hover:text-white rounded-xl h-9 px-3 text-xs font-black shadow-xs hover:shadow-md hover:shadow-emerald-950/40 backdrop-blur-md transition-all duration-300 active:scale-95 cursor-pointer"
                >
                  {/* Ambient Shimmer Sweep Animation */}
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                  {/* Pulsing Live Beacon Dot */}
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300" />
                  </span>

                  <span className="tracking-tight">Show Overview</span>

                  {/* Animated Chevron Bounce */}
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-300 transition-transform duration-300 ease-out group-hover:translate-y-0.5 group-hover:text-emerald-100" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Expanded Hero Banner (Slides down seamlessly) */}
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${showHeroBanner
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
            }`}
        >
          <div className="overflow-hidden min-h-0">
            <div
              className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white p-6 sm:p-8 border border-emerald-800/40 shadow-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${showHeroBanner
                  ? "translate-y-0 scale-100 opacity-100"
                  : "-translate-y-8 scale-[0.98] opacity-0"
                }`}
            >
              {/* Subtle Ambient Background Gradients */}
              <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                {/* Left Title & Status Header */}
                <div className="space-y-3 max-w-2xl">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full backdrop-blur-md">
                      <Activity className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Live Herd Registry
                    </Badge>
                    <span className="text-xs font-semibold text-emerald-200/70">
                      {inventories.length} Registered Records
                    </span>
                  </div>

                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                      Livestock Inventory & Biometric Surveillance
                    </h1>
                    <p className="text-sm text-emerald-100/80 font-medium mt-1">
                      Trace ear tags, monitor herd growth, track pedigree breeds, and maintain
                      up-to-date biosecurity vaccination compliance.
                    </p>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={exportCSV}
                    className="gap-2 border-emerald-700/50 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl h-12 px-5 backdrop-blur-md transition-all active:scale-95"
                  >
                    <FileDown className="w-4 h-4 text-emerald-300" />
                    Export CSV
                  </Button>

                  <Button
                    onClick={() => setIsAddOpen(true)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black gap-2 rounded-2xl h-12 px-6 shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
                  >
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                    Register Livestock
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => setShowHeroBanner(false)}
                    className="group relative overflow-hidden gap-1.5 border border-emerald-700/50 hover:border-emerald-600 bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white font-bold rounded-2xl h-12 px-4.5 backdrop-blur-md transition-all duration-300 active:scale-95 cursor-pointer"
                  >
                    <ChevronUp className="w-4 h-4 text-emerald-300 transition-transform duration-300 ease-out group-hover:-translate-y-0.5" />
                    Hide Overview
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ REGISTRATION MODAL ═══ */}
        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setFormError("");
              setFormData(initialFormData);
              resetBatchAnimalsToPreset(formData.livestockType);
            }
          }}
        >
          <DialogContent className="w-full max-w-[96vw] sm:max-w-3xl md:max-w-4xl h-[90vh] sm:h-[86vh] max-h-[850px] flex flex-col rounded-3xl p-0 border-0 shadow-2xl overflow-hidden bg-white">
            {/* Modal Header */}
            <div className="shrink-0 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md">
                  <Tag className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-white">
                    Register Livestock
                  </DialogTitle>
                  <DialogDescription className="text-xs text-emerald-200/80 mt-0.5">
                    Submit new animal records into the municipal verification registry.
                  </DialogDescription>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
              <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Entry Mode Toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Entry Mode
                </Label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, entryType: "INDIVIDUAL" })}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${formData.entryType === "INDIVIDUAL"
                        ? "bg-white text-emerald-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    <Tag className="w-4 h-4 text-emerald-700" />
                    Individual Animal (Tagged)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, entryType: "BATCH" })}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${formData.entryType === "BATCH"
                        ? "bg-white text-emerald-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    <Layers className="w-4 h-4 text-teal-700" />
                    Batch / Herd Group
                  </button>
                </div>
              </div>

              {/* Species Selection with Preset Chips */}
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Livestock Species
                </Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {Object.entries(livestockTypes).map(([name]) => {
                    const isSelected = formData.livestockType === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          const preset = getSpeciesPreset(name);
                          const defAvatar = getDefaultAvatarForSpecies(name);
                          const defBreed = preset.commonBreeds?.[0] || "";
                          setFormData((prev) => ({
                            ...prev,
                            livestockType: name,
                            breed: defBreed,
                            isOtherBreed: false,
                            customBreed: "",
                            avatarKey: prev.photoDataUrl ? prev.avatarKey : defAvatar.id,
                            tagNumber:
                              prev.entryType === "INDIVIDUAL" && !prev.tagNumber
                                ? generateSuggestedTag(name)
                                : prev.tagNumber,
                            batchName: prev.batchName ? prev.batchName : `${name} Cohort #${Math.floor(100 + Math.random() * 900)}`,
                          }));
                          if (formData.entryType === "BATCH") {
                            const prefix = preset.tagPrefix || name.slice(0, 3).toUpperCase();
                            const defWeight = preset.suggestedWeightKg ? String(preset.suggestedWeightKg) : "65";
                            setBatchAnimals((prev) =>
                              prev.map((a, idx) => ({
                                ...a,
                                tagNumber: `${prefix}-B1-${(idx + 1).toString().padStart(2, "0")}`,
                                breed: defBreed,
                                weight: defWeight,
                              }))
                            );
                          }
                        }}
                        className={`p-2.5 rounded-2xl border text-center transition-all ${isSelected
                            ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-600/30"
                            : "border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700 font-bold text-xs"
                          }`}
                      >
                        <span className="block text-xs truncate">{name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ══════════════════════════════════════════════════════════
                        CONDITIONAL FORM FIELDS BASED ON REGISTRATION MODE
                        - INDIVIDUAL: Shows Tag, Photo/Avatar, Breed, Sex, Weight, Vaccinated
                        - BATCH: Hides individual Breed/Sex/Weight/Vaccinated,
                                 Shows interactive batch animal roster editor
                    ══════════════════════════════════════════════════════════ */}
              {formData.entryType === "INDIVIDUAL" ? (
                <div className="space-y-4">
                  {/* Ear Tag / RFID Number */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="tagNumber"
                        className="text-xs font-black uppercase tracking-wider text-slate-500"
                      >
                        Ear Tag / RFID Number
                      </Label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            tagNumber: generateSuggestedTag(formData.livestockType),
                          })
                        }
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                      >
                        <Wand2 className="w-3 h-3" /> Auto-generate Tag
                      </button>
                    </div>
                    <Input
                      id="tagNumber"
                      placeholder="e.g. CAT-2026-104"
                      value={formData.tagNumber}
                      onChange={(e) => setFormData({ ...formData, tagNumber: e.target.value })}
                      className="h-11 rounded-xl font-mono font-bold"
                      required
                    />
                  </div>

                  {/* ── Animal Photo & Avatar Selector ── */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-emerald-700" />
                          Animal Photo & Visual Avatar
                        </Label>
                        <p className="text-[11px] text-slate-500">
                          Upload a photo from your device, or choose a preset avatar below.
                        </p>
                      </div>
                      {formData.photoDataUrl ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                          Photo Attached
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-bold">
                          Avatar Active
                        </Badge>
                      )}
                    </div>

                    {/* Upload / Preview Card */}
                    <div className="flex items-center gap-3.5 p-3 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                      <div className="relative shrink-0">
                        {formData.photoDataUrl ? (
                          <div className="relative size-16 rounded-2xl overflow-hidden border-2 border-emerald-600 shadow-xs group">
                            <img
                              src={formData.photoDataUrl}
                              alt="Livestock Preview"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                              title="Remove Photo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className={`size-16 rounded-2xl flex flex-col items-center justify-center bg-gradient-to-br border-2 shadow-xs transition-transform ${selectedAvatarOption.bgGradient}`}
                          >
                            <span className="text-2xl">{selectedAvatarOption.emoji}</span>
                            <span className="text-[9px] font-black uppercase tracking-tighter truncate max-w-[56px] text-center">
                              {selectedAvatarOption.badge}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handlePhotoUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-8 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold gap-1.5 shadow-xs"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            {formData.photoDataUrl ? "Change Photo" : "Upload Photo"}
                          </Button>
                          {formData.photoDataUrl && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleRemovePhoto}
                              className="h-8 px-2.5 rounded-xl border-slate-300 text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold"
                            >
                              Use Avatar
                            </Button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Supports JPG, PNG, WebP up to 5MB from mobile camera or gallery.
                        </p>
                      </div>
                    </div>

                    {/* Preset Avatars Selector */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                          Select Animal Avatar ({relevantAvatars.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAllAvatars(!showAllAvatars)}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          {showAllAvatars ? "Show Species Only" : "Browse All 15+ Avatars"}
                        </button>
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-0.5">
                        {relevantAvatars.map((av) => {
                          const isSelected = !formData.photoDataUrl && formData.avatarKey === av.id;
                          return (
                            <button
                              key={av.id}
                              type="button"
                              onClick={() => handleSelectAvatar(av.id)}
                              className={`relative p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${isSelected
                                  ? "border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-600 shadow-xs scale-102"
                                  : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                                }`}
                            >
                              <div
                                className={`size-9 rounded-lg flex items-center justify-center bg-gradient-to-br border ${av.bgGradient}`}
                              >
                                <span className="text-lg">{av.emoji}</span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-700 truncate w-full">
                                {av.name}
                              </span>
                              {isSelected && (
                                <span className="absolute -top-1 -right-1 size-4 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] shadow-xs">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Assigned Batch / Cohort (Optional) */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="assignedBatch"
                      className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center justify-between"
                    >
                      <span>Cohort / Batch Group (Optional)</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Assign to batch</span>
                    </Label>
                    <Select
                      value={formData.batchId || "none"}
                      onValueChange={(val) => setFormData({ ...formData, batchId: val === "none" ? "" : val })}
                    >
                      <SelectTrigger id="assignedBatch" className="h-11 rounded-xl">
                        <SelectValue placeholder="Standalone Animal (No Batch)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Standalone Animal (No Batch)</SelectItem>
                        {userBatches.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.batchCode} ({b.batchName || b.livestockTypeName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Individual Breed Selection (Dropdown + Others) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="breedSelect"
                        className="text-xs font-black uppercase tracking-wider text-slate-500"
                      >
                        Breed / Pedigree
                      </Label>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {formData.isOtherBreed ? "Custom Breed Mode" : "Standard Species Breed"}
                      </span>
                    </div>

                    <Select
                      value={formData.isOtherBreed ? "OTHER" : (formData.breed || (currentPreset?.commonBreeds?.[0] ?? ""))}
                      onValueChange={(val) => {
                        if (val === "OTHER") {
                          setFormData({ ...formData, isOtherBreed: true });
                        } else {
                          setFormData({ ...formData, breed: val, isOtherBreed: false, customBreed: "" });
                        }
                      }}
                    >
                      <SelectTrigger id="breedSelect" className="h-11 rounded-xl bg-white font-medium">
                        <SelectValue placeholder="Select breed..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-60">
                        {currentPreset?.commonBreeds?.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                        <SelectItem value="OTHER" className="font-bold text-emerald-800">
                          ➕ Others (Specify custom breed)
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {/* If Others is selected, show custom breed input */}
                    {formData.isOtherBreed && (
                      <div className="space-y-1 pt-1 animate-in fade-in-50 duration-200">
                        <Label
                          htmlFor="customBreed"
                          className="text-[11px] font-bold text-emerald-800 flex items-center gap-1"
                        >
                          <span>Specify Custom Breed / Crossbreed Name:</span>
                        </Label>
                        <Input
                          id="customBreed"
                          placeholder="e.g. Belgian Blue Cross, Native Batangas Hybrid"
                          value={formData.customBreed}
                          onChange={(e) => setFormData({ ...formData, customBreed: e.target.value })}
                          className="h-10 rounded-xl border-emerald-300 focus-visible:ring-emerald-500/20 bg-emerald-50/30 font-medium"
                          required
                          autoFocus
                        />
                      </div>
                    )}
                  </div>

                  {/* Individual Sex & Weight */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="sex"
                        className="text-xs font-black uppercase tracking-wider text-slate-500"
                      >
                        Sex / Gender
                      </Label>
                      <Select
                        value={formData.sex}
                        onValueChange={(val) => setFormData({ ...formData, sex: val })}
                      >
                        <SelectTrigger id="sex" className="h-11 rounded-xl">
                          <SelectValue placeholder="Select sex" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Female">Female (Cow / Doe / Sow)</SelectItem>
                          <SelectItem value="Male">Male (Bull / Buck / Boar)</SelectItem>
                          <SelectItem value="Mixed">Mixed (Batch Group)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="weight"
                          className="text-xs font-black uppercase tracking-wider text-slate-500"
                        >
                          Weight (kg)
                        </Label>
                        {currentPreset?.suggestedWeightKg && (
                          <span className="text-[10px] text-slate-400 font-semibold">
                            ~{currentPreset.suggestedWeightKg} kg
                          </span>
                        )}
                      </div>
                      <Input
                        id="weight"
                        type="number"
                        step="0.1"
                        placeholder="e.g. 380"
                        value={formData.weight}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Individual Vaccination */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="isVaccinated"
                        checked={formData.isVaccinated}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            isVaccinated: !!checked,
                            lastVaccinationDate: checked ? formData.lastVaccinationDate : "",
                          })
                        }
                      />
                      <Label
                        htmlFor="isVaccinated"
                        className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5"
                      >
                        <Syringe className="w-3.5 h-3.5 text-emerald-700" />
                        Animal has active vaccination records on file
                      </Label>
                    </div>

                    {formData.isVaccinated && (
                      <div className="space-y-1.5 pt-1">
                        <Label
                          htmlFor="vaxDate"
                          className="text-xs font-black uppercase tracking-wider text-slate-500"
                        >
                          Last Vaccination Date
                        </Label>
                        <Input
                          id="vaxDate"
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          value={formData.lastVaccinationDate}
                          onChange={(e) =>
                            setFormData({ ...formData, lastVaccinationDate: e.target.value })
                          }
                          className="h-10 rounded-xl bg-white"
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── BATCH / HERD REGISTRATION ── */
                <div className="space-y-4">
                  {/* 1. Batch Identity & Facilities */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                          <Layers className="size-4" />
                        </div>
                        <div>
                          <Label className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Batch Cohort Profile
                          </Label>
                          <p className="text-[11px] text-slate-500">
                            Assign an identifiable cohort name and housing details
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-bold">
                        Group Enrollment
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Batch Name */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="batchName" className="text-xs font-black uppercase tracking-wider text-slate-600">
                            Batch Name / Cohort Title <span className="text-rose-500">*</span>
                          </Label>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                batchName: `${prev.livestockType} Cohort #${Math.floor(100 + Math.random() * 900)}`,
                              }))
                            }
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                          >
                            <Sparkles className="size-3" /> Auto-suggest Name
                          </button>
                        </div>
                        <Input
                          id="batchName"
                          placeholder={`e.g. Pen 3 Fattening Swine, Spring ${formData.livestockType} Herd`}
                          value={formData.batchName}
                          onChange={(e) => setFormData({ ...formData, batchName: e.target.value })}
                          className="h-10 rounded-xl bg-white font-medium"
                          required
                        />
                      </div>

                      {/* Housing Pen */}
                      <div className="space-y-1.5">
                        <Label htmlFor="housingPen" className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                          Housing Pen / Facility
                        </Label>
                        <Input
                          id="housingPen"
                          placeholder="e.g. Pen 3 Fattening / East Barn"
                          value={formData.housingPen}
                          onChange={(e) => setFormData({ ...formData, housingPen: e.target.value })}
                          className="h-9.5 rounded-xl bg-white text-xs"
                        />
                      </div>

                      {/* Feed Formulation */}
                      <div className="space-y-1.5">
                        <Label htmlFor="feedType" className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                          Feed Formulation / Rations
                        </Label>
                        <Input
                          id="feedType"
                          placeholder="e.g. Finisher Pellets, Napier Grass"
                          value={formData.feedType}
                          onChange={(e) => setFormData({ ...formData, feedType: e.target.value })}
                          className="h-9.5 rounded-xl bg-white text-xs"
                        />
                      </div>
                    </div>

                    {/* Batch Primary Breed Dropdown with Others */}
                    <div className="pt-2 border-t border-slate-200/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="batchPrimaryBreed" className="text-xs font-black uppercase tracking-wider text-slate-600">
                          Primary Cohort Breed
                        </Label>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Applies to all animals in this cohort
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1">
                          <Select
                            value={formData.isOtherBreed ? "OTHER" : (formData.breed || (currentPreset?.commonBreeds?.[0] ?? ""))}
                            onValueChange={(val) => {
                              if (val === "OTHER") {
                                setFormData((prev) => ({ ...prev, isOtherBreed: true }));
                              } else {
                                setFormData((prev) => ({ ...prev, breed: val, isOtherBreed: false, customBreed: "" }));
                                setBatchAnimals((prev) => prev.map((a) => ({ ...a, breed: val })));
                              }
                            }}
                          >
                            <SelectTrigger id="batchPrimaryBreed" className="h-10 rounded-xl bg-white text-xs font-medium">
                              <SelectValue placeholder="Select common cohort breed..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl max-h-60">
                              {currentPreset?.commonBreeds?.map((b) => (
                                <SelectItem key={b} value={b} className="text-xs">
                                  {b}
                                </SelectItem>
                              ))}
                              <SelectItem value="OTHER" className="text-xs font-bold text-emerald-800">
                                ➕ Others (Specify custom breed)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {formData.isOtherBreed && (
                          <div className="flex-1 animate-in fade-in-50 duration-200">
                            <Input
                              placeholder="Specify custom breed name..."
                              value={formData.customBreed}
                              onChange={(e) => {
                                const custom = e.target.value;
                                setFormData((prev) => ({ ...prev, customBreed: custom }));
                                setBatchAnimals((prev) => prev.map((a) => ({ ...a, breed: custom || "Others" })));
                              }}
                              className="h-10 rounded-xl bg-white border-emerald-300 text-xs font-medium"
                              required
                              autoFocus
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Batch Head Count Stepper & Quick Chips */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-600">
                        Batch Cohort Size
                      </Label>
                      <span className="text-xs font-bold text-emerald-700">
                        {batchAnimals.length} Individual Animal{batchAnimals.length !== 1 ? "s" : ""} in Roster
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleBatchQuantityChange(Math.max(1, batchAnimals.length - 1))}
                        className="size-11 flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors active:scale-95 shadow-xs"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="flex-1 text-center bg-white py-2 rounded-xl border border-slate-200 shadow-xs">
                        <span className="text-3xl font-black text-slate-900 tabular-nums">
                          {batchAnimals.length}
                        </span>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                          heads
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleBatchQuantityChange(Math.min(50, batchAnimals.length + 1))}
                        className="size-11 flex items-center justify-center rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 transition-colors active:scale-95 shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex gap-2 flex-wrap pt-1 items-center">
                      <span className="text-[11px] font-bold text-slate-400">Batch presets:</span>
                      {[3, 5, 10, 20, 30].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleBatchQuantityChange(n)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${batchAnimals.length === n
                              ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                            }`}
                        >
                          {n} heads
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Batch Cohort Individual Animals Roster Editor */}
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-700" />
                          Individual Livestock in Batch ({batchAnimals.length} heads)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Edit individual tags, breed, sex, weight, and vaccination per animal.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={syncBreedToAllAnimals}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors shadow-xs"
                          title="Applies breed from Animal #1 to all other animals"
                        >
                          Sync Breed #1
                        </button>
                        <button
                          type="button"
                          onClick={reTagAllBatchAnimals}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors shadow-xs"
                          title="Auto-generates sequential ear tags for all animals"
                        >
                          <Sparkles className="w-3 h-3 inline mr-1 text-emerald-600" />
                          Auto-Tag
                        </button>
                        <button
                          type="button"
                          onClick={addBatchAnimalRow}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors flex items-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3 h-3" /> Add Animal
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Animal Roster Cards */}
                    <div className="h-72 sm:h-80 overflow-y-auto pr-1.5 space-y-2.5 border border-slate-200/90 rounded-2xl p-2.5 bg-slate-50/50">
                      {batchAnimals.map((animal, idx) => (
                        <div
                          key={animal.id || idx}
                          className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5 hover:border-emerald-300 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="size-6 rounded-full bg-emerald-100 text-emerald-900 font-black text-xs flex items-center justify-center">
                                #{idx + 1}
                              </span>
                              <span className="font-mono text-xs font-black text-slate-900">
                                {animal.tagNumber || `Animal #${idx + 1}`}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold uppercase py-0 px-1.5 ${animal.sex === "Female"
                                    ? "text-rose-700 bg-rose-50 border-rose-200"
                                    : animal.sex === "Male"
                                      ? "text-blue-700 bg-blue-50 border-blue-200"
                                      : "text-amber-700 bg-amber-50 border-amber-200"
                                  }`}
                              >
                                {animal.sex}
                              </Badge>
                            </div>

                            {batchAnimals.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeBatchAnimalRow(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Remove this animal"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-black uppercase text-slate-400">
                                Ear Tag / RFID
                              </Label>
                              <Input
                                value={animal.tagNumber}
                                onChange={(e) => updateBatchAnimalField(idx, "tagNumber", e.target.value)}
                                placeholder="e.g. SWN-B1-01"
                                className="h-8 text-xs font-mono font-bold rounded-lg"
                                required
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] font-black uppercase text-slate-400">
                                Breed / Strain
                              </Label>
                              <Select
                                value={
                                  currentPreset?.commonBreeds?.includes(animal.breed)
                                    ? animal.breed
                                    : "OTHER"
                                }
                                onValueChange={(val) => {
                                  if (val === "OTHER") {
                                    updateBatchAnimalField(idx, "breed", "Others");
                                  } else {
                                    updateBatchAnimalField(idx, "breed", val);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs rounded-lg bg-white">
                                  <SelectValue placeholder="Breed" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl max-h-56">
                                  {currentPreset?.commonBreeds?.map((b) => (
                                    <SelectItem key={b} value={b} className="text-xs">
                                      {b}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="OTHER" className="text-xs font-bold text-emerald-800">
                                    Others (Custom)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              {(!currentPreset?.commonBreeds?.includes(animal.breed) || animal.breed === "Others") && (
                                <Input
                                  value={animal.breed === "Others" ? "" : animal.breed}
                                  onChange={(e) => updateBatchAnimalField(idx, "breed", e.target.value || "Others")}
                                  placeholder="Type custom breed"
                                  className="h-7 text-[11px] rounded-lg mt-1 bg-white border-emerald-300 font-medium"
                                  required
                                />
                              )}
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] font-black uppercase text-slate-400">
                                Sex
                              </Label>
                              <Select
                                value={animal.sex}
                                onValueChange={(val: any) => updateBatchAnimalField(idx, "sex", val)}
                              >
                                <SelectTrigger className="h-8 text-xs rounded-lg">
                                  <SelectValue placeholder="Sex" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Female">Female</SelectItem>
                                  <SelectItem value="Male">Male</SelectItem>
                                  <SelectItem value="Castrated">Castrated / Barrow</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[10px] font-black uppercase text-slate-400">
                                Weight (kg)
                              </Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={animal.weight}
                                onChange={(e) => updateBatchAnimalField(idx, "weight", e.target.value)}
                                placeholder="e.g. 65"
                                className="h-8 text-xs font-semibold rounded-lg"
                              />
                            </div>
                          </div>

                          <div className="pt-1 flex items-center justify-between border-t border-slate-100">
                            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                              <Syringe className="w-3 h-3 text-slate-400" /> Vaccination Date (optional):
                            </span>
                            <Input
                              type="date"
                              max={new Date().toISOString().split("T")[0]}
                              value={animal.lastVaccinationDate}
                              onChange={(e) =>
                                updateBatchAnimalField(idx, "lastVaccinationDate", e.target.value)
                              }
                              className="h-7 w-36 text-[11px] rounded-lg py-0 px-2 bg-slate-50/50"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Live Preview Card */}
              <div className="p-3.5 rounded-2xl border border-emerald-900/10 bg-emerald-50/40 text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900/60 block mb-1">
                  Registry Live Card Preview
                </span>
                {formData.entryType === "INDIVIDUAL" ? (
                  <div className="flex items-center gap-3">
                    {formData.photoDataUrl ? (
                      <img
                        src={formData.photoDataUrl}
                        alt="Tag preview"
                        className="size-11 rounded-xl object-cover border border-emerald-200 shadow-2xs shrink-0"
                      />
                    ) : (
                      <div
                        className={`size-11 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br border shadow-2xs shrink-0 ${selectedAvatarOption.bgGradient}`}
                      >
                        {selectedAvatarOption.emoji}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between font-bold text-emerald-950">
                        <span className="font-mono text-sm">
                          {formData.tagNumber || "TAG-PENDING"}
                        </span>
                        <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px]">
                          Pending Review
                        </Badge>
                      </div>
                      <p className="text-slate-600 mt-0.5 truncate">
                        {formData.livestockType} • {formData.breed || "Unspecified Breed"} •{" "}
                        {formData.sex} {formData.weight ? `• ${formData.weight} kg` : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between font-bold text-emerald-950">
                      <span className="text-sm font-black flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-700" />
                        Batch Cohort: {batchAnimals.length} Heads of {formData.livestockType}
                      </span>
                      <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px]">
                        Batch Entry
                      </Badge>
                    </div>
                    <p className="text-slate-600 mt-0.5 font-medium">
                      Primary Breed: <strong>{batchAnimals[0]?.breed || "Mixed Hybrid"}</strong> • Avg Weight:{" "}
                      <strong>~{batchMetrics.avgWeight} kg</strong> • Biomass: <strong>~{batchMetrics.totalWeight} kg</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono mt-1 truncate">
                      Tags: {batchAnimals.slice(0, 4).map((a) => a.tagNumber || "unassigned").join(", ")}
                      {batchAnimals.length > 4 ? ` +${batchAnimals.length - 4} more` : ""}
                    </p>
                  </>
                )}
              </div>
              </div>

              <div className="shrink-0 p-4 sm:p-5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddOpen(false);
                    setFormData(initialFormData);
                    resetBatchAnimalsToPreset(formData.livestockType);
                  }}
                  className="rounded-xl h-11"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl h-11 px-6 shadow-sm"
                >
                  {addMutation.isPending ? "Submitting..." : "Submit to Registry"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ═══════════════════════════════════════════════════════════════
            HERD TELEMETRY & STATS CONSOLE (COLLAPSIBLE)
        ═══════════════════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
                Herd Telemetry & Biometric KPIs
              </h2>
              <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                • {inventories.length} {inventories.length === 1 ? "record" : "records"} active
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowStats((prev) => !prev)}
              className="h-8 px-3 text-xs font-bold text-slate-600 hover:text-emerald-950 hover:bg-emerald-50/80 hover:border-emerald-300 rounded-xl gap-1.5 transition-all shadow-2xs border-slate-200 bg-white"
            >
              {showStats ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  <span>Hide Stats</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  <span>Show Stats</span>
                </>
              )}
            </Button>
          </div>

          {showStats ? (
            <InventoryStats inventories={inventories} isLoading={isLoading} layout="horizontal" />
          ) : (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs">
              <div className="flex items-center gap-3 sm:gap-6 flex-wrap text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Layers className="size-3.5 text-emerald-600" />
                  <span>{totalHeads.toLocaleString()}</span>
                  <span className="text-slate-400 font-medium text-[11px]">Total Heads</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <CheckCircle2 className="size-3.5 text-sky-600" />
                  <span>{approvedHeads.toLocaleString()}</span>
                  <span className="text-slate-400 font-medium text-[11px]">Approved ({approvalRate}%)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Clock className="size-3.5 text-amber-600" />
                  <span>{pendingRecords.toLocaleString()}</span>
                  <span className="text-slate-400 font-medium text-[11px]">Pending</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Tag className="size-3.5 text-orange-600" />
                  <span>{individualTags.toLocaleString()}</span>
                  <span className="text-slate-400 font-medium text-[11px]">Tagged</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  <span>{vaxRate}%</span>
                  <span className="text-slate-400 font-medium text-[11px]">Vaccinated</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowStats(true)}
                className="text-[11px] font-black text-emerald-700 hover:text-emerald-900 hover:underline shrink-0 ml-3 cursor-pointer"
              >
                Expand KPIs
              </button>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            MAIN VIEW CONTENT / SPECIES DRILL-DOWN
        ═══════════════════════════════════════════════════════════════ */}
        {selectedType ? (
          /* Species Specific Drill-Down View */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedType(null)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{selectedType} Registry</h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Viewing all {selectedType.toLowerCase()} records in your herd
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-800 border-0 font-bold px-3 py-1">
                  {typeFilteredInventories.reduce((acc, i) => acc + i.quantity, 0)} Total Heads
                </Badge>
                <Badge className="bg-slate-100 text-slate-700 border-0 font-bold px-3 py-1">
                  {typeFilteredInventories.length} Records
                </Badge>
              </div>
            </div>

            <LivestockRecordList
              items={typeFilteredInventories}
              isLoading={isLoading}
              livestockTypes={livestockTypes}
              onView={(item) => setDetailTarget(item)}
              onEdit={(item) => setEditTarget(item)}
              onDelete={(item) => setDeleteTarget(item)}
              onAddRecord={() => setIsAddOpen(true)}
            />
          </div>
        ) : (
          /* Main Tabbed View */
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as any)}
            className="-space-y-2 pt-2"
          >
            {/* Elevated Modern Segmented Tab Console */}
            <TabsList className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs h-auto">
              {/* Tab 1: Species Breakdown */}
              <TabsTrigger
                value="types"
                className="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left border border-transparent data-[state=active]:bg-white data-[state=active]:border-emerald-200/80 data-[state=active]:shadow-sm data-[state=active]:text-emerald-950 text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer h-auto"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-emerald-100/80 text-emerald-800 group-data-[state=active]:bg-emerald-700 group-data-[state=active]:text-white shadow-2xs">
                    <Layers className="size-4.5" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-black tracking-tight leading-tight">Species Breakdown</p>
                    <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-emerald-700/80 truncate">
                      Herd Categories & Distribution
                    </p>
                  </div>
                </div>
                <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-colors bg-slate-200/70 text-slate-700 group-data-[state=active]:bg-emerald-100 group-data-[state=active]:text-emerald-800 shrink-0 border border-transparent group-data-[state=active]:border-emerald-200/60">
                  {speciesCount > 0 ? `${speciesCount} Species` : "Species"}
                </span>
              </TabsTrigger>

              {/* Tab 2: Complete Herd Registry */}
              <TabsTrigger
                value="all"
                className="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left border border-transparent data-[state=active]:bg-white data-[state=active]:border-teal-200/80 data-[state=active]:shadow-sm data-[state=active]:text-teal-950 text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer h-auto"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-teal-100/80 text-teal-800 group-data-[state=active]:bg-teal-700 group-data-[state=active]:text-white shadow-2xs">
                    <Tag className="size-4.5" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-black tracking-tight leading-tight">Complete Herd Registry</p>
                    <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-teal-700/80 truncate">
                      Ear Tags, Biometrics & Actions
                    </p>
                  </div>
                </div>
                <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-colors bg-slate-200/70 text-slate-700 group-data-[state=active]:bg-teal-100 group-data-[state=active]:text-teal-800 shrink-0 border border-transparent group-data-[state=active]:border-teal-200/60">
                  {inventories.length} {inventories.length === 1 ? "Record" : "Records"}
                </span>
              </TabsTrigger>

              {/* Tab 3: Health & Immunization Tracker */}
              <TabsTrigger
                value="health"
                className="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left border border-transparent data-[state=active]:bg-white data-[state=active]:border-emerald-200/80 data-[state=active]:shadow-sm data-[state=active]:text-emerald-950 text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer h-auto"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-emerald-100/80 text-emerald-800 group-data-[state=active]:bg-[#2D5A27] group-data-[state=active]:text-white shadow-2xs">
                    <ShieldCheck className="size-4.5" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-black tracking-tight leading-tight">Health & Immunization</p>
                    <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-emerald-700/80 truncate">
                      Surveillance & Biosecurity
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-colors bg-emerald-50 text-emerald-800 shrink-0 border border-emerald-200/60">
                  <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {vaxRate}% Vax
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="types" className="space-y-4 pt-2 outline-hidden w-full">
              <LivestockTypeCards
                inventories={inventories}
                isLoading={isLoading}
                onSelectType={setSelectedType}
              />
            </TabsContent>

            <TabsContent value="all" className="space-y-4 pt-2 outline-hidden">
              <LivestockRecordList
                items={inventories}
                isLoading={isLoading}
                livestockTypes={livestockTypes}
                onView={(item) => setDetailTarget(item)}
                onEdit={(item) => setEditTarget(item)}
                onDelete={(item) => setDeleteTarget(item)}
                onAddRecord={() => setIsAddOpen(true)}
              />
            </TabsContent>

            <TabsContent value="health" className="space-y-4 pt-2 outline-hidden">
              <HealthTrackerTab
                inventories={inventories}
                isLoading={isLoading}
                onView={(item) => setDetailTarget(item)}
                onEdit={(item) => setEditTarget(item)}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* ═══ Confirm Delete Dialog ═══ */}
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900">
                Delete Livestock Record
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this record from your registry? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            {deleteTarget && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-1">
                <p className="font-bold text-slate-900">
                  {deleteTarget.entryType === "INDIVIDUAL"
                    ? deleteTarget.tagNumber || "Un-tagged"
                    : `${deleteTarget.quantity}x ${deleteTarget.livestockTypeName} (Batch)`}
                </p>
                <p className="text-slate-500 text-xs">
                  {deleteTarget.livestockTypeName} • {deleteTarget.breed} • {deleteTarget.sex}
                </p>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!deleteTarget) return;
                  deleteMutation.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="rounded-xl font-bold"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Record"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══ Details & Edit Dialogs ═══ */}
        <LivestockDetailsDialog
          livestock={detailTarget}
          open={!!detailTarget}
          onOpenChange={() => setDetailTarget(null)}
        />

        <LivestockEditDialog
          key={editTarget?.id ?? "closed"}
          item={editTarget}
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          livestockTypes={livestockTypes}
          isSubmitting={updateMutation.isPending}
          onSubmit={(payload) => updateMutation.mutate(payload)}
        />
      </div>
    </>
  );
}
