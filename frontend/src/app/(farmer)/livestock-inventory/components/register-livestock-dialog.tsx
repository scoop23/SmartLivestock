"use client";

import { useState, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Tag,
  Layers,
  Wand2,
  Camera,
  Upload,
  Trash2,
  Check,
  Syringe,
  Sparkles,
  Minus,
  Plus,
  Users,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
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

import api from "@/lib/axios";
import {
  type EntryType,
  getSpeciesPreset,
  generateSuggestedTag,
  LIVESTOCK_AVATAR_PRESETS,
  getDefaultAvatarForSpecies,
  getAvatarById,
} from "../livestock-inventory";

export interface BatchAnimalFormRow {
  id: string;
  tagNumber: string;
  breed: string;
  sex: "Female" | "Male" | "Castrated";
  weight: string;
  lastVaccinationDate: string;
}

interface RegisterLivestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  livestockTypes: Record<string, number>;
  userBatches?: any[];
  onSuccess?: () => void;
}

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

export function RegisterLivestockDialog({
  open,
  onOpenChange,
  livestockTypes,
  userBatches = [],
  onSuccess,
}: RegisterLivestockDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState(initialFormData);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAllAvatars, setShowAllAvatars] = useState(false);

  // Batch individual animals state for Add Modal
  const [batchAnimals, setBatchAnimals] = useState<BatchAnimalFormRow[]>([
    { id: "1", tagNumber: "SWN-B1-01", breed: "Large White", sex: "Female", weight: "65.0", lastVaccinationDate: "" },
    { id: "2", tagNumber: "SWN-B1-02", breed: "Large White", sex: "Male", weight: "68.5", lastVaccinationDate: "" },
    { id: "3", tagNumber: "SWN-B1-03", breed: "Large White", sex: "Female", weight: "64.0", lastVaccinationDate: "" },
  ]);

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

  const currentPreset = getSpeciesPreset(formData.livestockType);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
      const wasBatch = formData.entryType === "BATCH";
      const registeredQty = wasBatch ? batchAnimals.length : formData.quantity;
      onOpenChange(false);
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
      onSuccess?.();
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

  const handleModalClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setFormError("");
      setFormData(initialFormData);
      resetBatchAnimalsToPreset(formData.livestockType);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
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
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                    formData.entryType === "INDIVIDUAL"
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
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                    formData.entryType === "BATCH"
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
                      className={`p-2.5 rounded-2xl border text-center transition-all ${
                        isSelected
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

            {/* CONDITIONAL FORM FIELDS BASED ON REGISTRATION MODE */}
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

                {/* Animal Photo & Avatar Selector */}
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
                            className={`relative p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                              isSelected
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
              /* BATCH / HERD REGISTRATION */
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
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                          batchAnimals.length === n
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
                              className={`text-[10px] font-bold uppercase py-0 px-1.5 ${
                                animal.sex === "Female"
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
              onClick={() => handleModalClose(false)}
              className="rounded-xl h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addMutation.isPending}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl h-11 px-6 shadow-sm cursor-pointer"
            >
              {addMutation.isPending ? "Submitting..." : "Submit to Registry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
