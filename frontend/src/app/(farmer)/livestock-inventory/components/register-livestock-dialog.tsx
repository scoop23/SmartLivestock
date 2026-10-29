"use client";

import type { LivestockBatchItem, CreateInventoryPayload } from "../livestock-inventory";
import { httpError } from "@/lib/http-error";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  HelpCircle,
  Info,
  Layers,
  Minus,
  Plus,
  Sparkles,
  Syringe,
  Tag,
  Trash2,
  Upload,
  Users,
  Wand2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";

import api from "@/lib/axios";
import { localCalendarDateToday } from "@/lib/livestock-age";
import {
  type EntryType,
  getAvatarById,
  getDefaultAvatarForSpecies,
  getSpeciesPreset,
  LIVESTOCK_AVATAR_PRESETS,
} from "../livestock-inventory";

/* ── Inline Information Hover Tooltip ── */
function InfoTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex items-center justify-center text-slate-400 hover:text-emerald-700 transition-colors p-0.5 rounded cursor-help focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 shrink-0"
            aria-label={text}
          >
            <HelpCircle className="size-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs font-medium bg-slate-900 text-white p-2.5 rounded-lg shadow-xl leading-relaxed z-[var(--z-popover-dialog)]"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export interface BatchAnimalFormRow {
  id: string;
  tagNumber: string;
  breed: string;
  sex: "Female" | "Male" | "Castrated" | "";
  weight: string;
  birthDate?: string;
  lastVaccinationDate: string;
}

interface RegisterLivestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  livestockTypes: Record<string, number>;
  userBatches?: LivestockBatchItem[];
  existingTags?: string[];
  onSuccess?: () => void;
}

interface LivestockRegistrationDraft {
  formData: typeof initialFormData;
  batchAnimals: BatchAnimalFormRow[];
  batchPhotoDataUrls?: string[];
  savedAt: string;
}

const initialFormData = {
  entryType: "INDIVIDUAL" as EntryType,
  livestockType: "Cattle",
  quantity: 1,
  tagNumber: "",
  isCustomTag: false,
  customTagName: "",
  batchId: "",
  batchName: "",
  housingPen: "",
  feedType: "",
  isOtherFeed: false,
  customFeed: "",
  breed: "Brahman",
  isOtherBreed: false,
  customBreed: "",
  sex: "Female",
  birthDate: "",
  weight: "",
  isVaccinated: false,
  lastVaccinationDate: "",
  photoDataUrl: "",
  avatarKey: "cow-brahman",
};

function normalizeTagName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function nextOwnerTag(prefix: string, usedTags: string[]) {
  const pattern = new RegExp(`^${prefix}-(\\d{3,})$`, "i");
  const highest = usedTags.reduce((max, tag) => {
    const match = tag.trim().match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

function createDefaultBatchAnimals(): BatchAnimalFormRow[] {
  return [];
}

function resolveBreed(species: string, breed?: string | null) {
  return breed?.trim() || getSpeciesPreset(species).commonBreeds?.[0] || "Standard";
}

function getSpeciesIllustration(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("cattle") || lower.includes("cow")) return "🐂";
  if (lower.includes("swine") || lower.includes("pig")) return "🐖";
  if (lower.includes("sheep")) return "🐑";
  if (lower.includes("carabao") || lower.includes("buffalo")) return "🐃";
  if (lower.includes("goat")) return "🐐";
  if (lower.includes("poultry") || lower.includes("chicken")) return "🐔";
  return "🏷️";
}

const WIZARD_STEPS = [
  {
    step: 1,
    title: "Livestock Species",
    shortTitle: "Livestock Species",
    bannerTitle: "Add Livestock",
    bannerSubtitle: "Add an animal or a group of animals to your livestock.",
    icon: Tag,
    optional: false,
  },
  {
    step: 2,
    title: "Herd Profile (optional)",
    shortTitle: "Herd Profile",
    bannerTitle: "Herd Profile",
    bannerSubtitle: "Assign an identifiable herd name and housing details.",
    icon: Layers,
    optional: true,
  },
  {
    step: 3,
    title: "Individual Livestock Details",
    shortTitle: "Animal Details",
    bannerTitle: "Individual Livestock Details",
    bannerSubtitle: "Edit individual tags, breed, sex, weight, and vaccination per animal.",
    icon: Users,
    optional: false,
  },
  {
    step: 4,
    title: "Review & Submit",
    shortTitle: "Review & Submit",
    bannerTitle: "Review & Submit",
    bannerSubtitle: "Please check the details before submitting.",
    icon: ClipboardCheck,
    optional: false,
  },
] as const;

export function RegisterLivestockDialog(props: RegisterLivestockDialogProps) {
  const { user } = useAuth();
  const identity = [user?.firstName, user?.lastName, user?.username].join(":");
  return <RegisterLivestockDialogContent key={`${props.open}:${identity}`} {...props} />;
}

function RegisterLivestockDialogContent({
  open,
  onOpenChange,
  livestockTypes,
  userBatches = [],
  existingTags = [],
  onSuccess,
}: RegisterLivestockDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ownerTagPrefix = normalizeTagName(
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || ""
  );

  // Draft persistence in localStorage
  const draftStorageKey = useMemo(() => {
    return `smartlivestock_livestock_draft_${user?.username || "default"}`;
  }, [user?.username]);

  const initialDraft = useMemo(() => {
    try {
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as LivestockRegistrationDraft;
        if (parsed?.savedAt) return parsed;
      }
    } catch {
      // Ignore
    }
    return null;
  }, [draftStorageKey]);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [formError, setFormError] = useState("");
  const [submittedLivestock, setSubmittedLivestock] = useState<{ id: string; tagNumber: string } | null>(null);
  const [formData, setFormData] = useState(() => {
    if (initialDraft?.formData) {
      const restored = { ...initialFormData, ...initialDraft.formData };
      if (!restored.isOtherBreed) {
        restored.breed = resolveBreed(restored.livestockType, restored.breed);
      }
      return restored;
    }
    return {
      ...initialFormData,
      tagNumber: ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, existingTags) : "",
    };
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [batchPhotoFiles, setBatchPhotoFiles] = useState<File[]>([]);
  const [batchPhotoDataUrls, setBatchPhotoDataUrls] = useState<string[]>(() => {
    if (initialDraft?.batchPhotoDataUrls && Array.isArray(initialDraft.batchPhotoDataUrls)) {
      return initialDraft.batchPhotoDataUrls;
    }
    return [];
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const [showAllAvatars, setShowAllAvatars] = useState(false);
  const [expandedAnimalIndex, setExpandedAnimalIndex] = useState<number | null>(0);
  const [isReviewConfirmed, setIsReviewConfirmed] = useState(false);

  // Batch individual animals state for Add Modal
  const [batchAnimals, setBatchAnimals] = useState<BatchAnimalFormRow[]>(() => {
    if (initialDraft?.batchAnimals && Array.isArray(initialDraft.batchAnimals) && initialDraft.batchAnimals.length > 0) {
      return initialDraft.batchAnimals;
    }
    return [];
  });

  const [hasDraft, setHasDraft] = useState(() => Boolean(initialDraft?.savedAt));
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(() => initialDraft?.savedAt || null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "idle">(() => initialDraft?.savedAt ? "saved" : "idle");

  // Debounced auto-save effect whenever form data or animals change
  useEffect(() => {
    const hasMeaningfulContent =
      formData.batchName.trim().length > 0 ||
      formData.housingPen.trim().length > 0 ||
      formData.feedType.trim().length > 0 ||
      formData.customBreed.trim().length > 0 ||
      formData.weight.trim().length > 0 ||
      formData.birthDate.trim().length > 0 ||
      formData.lastVaccinationDate.trim().length > 0 ||
      formData.photoDataUrl.length > 0 ||
      batchPhotoDataUrls.length > 0 ||
      batchAnimals.some((a) => a.weight || a.lastVaccinationDate || a.birthDate || a.breed) ||
      batchAnimals.length > 0 ||
      hasDraft;

    if (!hasMeaningfulContent) return;

    const timeout = setTimeout(() => {
      setAutoSaveStatus("saving");
      try {
        const now = new Date().toISOString();
        const draftFormData = {
          ...formData,
          breed: formData.isOtherBreed ? formData.breed : resolveBreed(formData.livestockType, formData.breed),
        };
        const draft: LivestockRegistrationDraft = {
          formData: draftFormData,
          batchAnimals,
          batchPhotoDataUrls: batchPhotoDataUrls.slice(0, 3),
          savedAt: now,
        };
        try {
          localStorage.setItem(draftStorageKey, JSON.stringify(draft));
        } catch {
          const leanDraft: LivestockRegistrationDraft = {
            formData: { ...draftFormData, photoDataUrl: "" },
            batchAnimals,
            batchPhotoDataUrls: [],
            savedAt: now,
          };
          localStorage.setItem(draftStorageKey, JSON.stringify(leanDraft));
        }
        setHasDraft(true);
        setDraftSavedAt(now);
        setAutoSaveStatus("saved");
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 700);

    return () => clearTimeout(timeout);
  }, [formData, batchAnimals, batchPhotoDataUrls, draftStorageKey, hasDraft]);

  const handleSaveDraft = () => {
    try {
      const now = new Date().toISOString();
      const draftFormData = {
        ...formData,
        breed: formData.isOtherBreed ? formData.breed : resolveBreed(formData.livestockType, formData.breed),
      };
      const draft: LivestockRegistrationDraft = {
        formData: draftFormData,
        batchAnimals,
        batchPhotoDataUrls: batchPhotoDataUrls.slice(0, 3),
        savedAt: now,
      };
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      } catch {
        const leanDraft: LivestockRegistrationDraft = {
          formData: { ...draftFormData, photoDataUrl: "" },
          batchAnimals,
          batchPhotoDataUrls: [],
          savedAt: now,
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(leanDraft));
      }
      setHasDraft(true);
      setDraftSavedAt(now);
      setAutoSaveStatus("saved");
      toast.success("Draft saved! You can resume editing anytime.");
    } catch (err) {
      console.error("Failed to save draft:", err);
      toast.error("Could not save draft to local storage.");
    }
  };

  const handleStartFresh = () => {
    try {
      localStorage.removeItem(draftStorageKey);
      setHasDraft(false);
      setDraftSavedAt(null);
      setAutoSaveStatus("idle");
      setCurrentStep(1);
      setIsReviewConfirmed(false);
      setFormData({
        ...initialFormData,
        tagNumber: ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, existingTags) : "",
      });
      setBatchAnimals([]);
      setPhotoFile(null);
      setBatchPhotoFiles([]);
      setBatchPhotoDataUrls([]);
      setFormError("");
      toast.info("Draft discarded. Started with a fresh form.");
    } catch (err) {
      console.error("Failed to discard draft:", err);
    }
  };

  const tagError = (tag: string, otherTags: string[] = [], isCustom: boolean = false) => {
    const normalizedTag = tag.trim().toUpperCase();
    if (!normalizedTag) {
      return "Ear tag / identifier is required.";
    }
    if ([...existingTags, ...otherTags].some((existing) => existing.trim().toUpperCase() === normalizedTag)) {
      return "This ear tag is already registered, including pending or approved records. Please change it.";
    }
    if (isCustom) {
      if (normalizedTag.length < 2) {
        return "Custom name or tag must be at least 2 characters.";
      }
      if (!/^[A-Z0-9][A-Z0-9\-_]{0,49}$/.test(normalizedTag)) {
        return "Use letters, numbers, and hyphens (up to 50 characters).";
      }
      return "";
    }
    if (!ownerTagPrefix) return "Your account name is unavailable. Refresh the page and try again.";
    if (new RegExp(`^${ownerTagPrefix}-\\d{3,}$`).test(normalizedTag)) {
      return "";
    }
    if (/^[A-Z0-9][A-Z0-9\-_]{1,49}$/.test(normalizedTag)) {
      return "";
    }
    return `Use ${ownerTagPrefix}-001 format for your ear tag, or select Custom from the dropdown.`;
  };

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

  const handleBatchPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 5MB. Please choose smaller images.`);
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;

    const combinedFiles = [...batchPhotoFiles, ...validFiles].slice(0, 10);
    setBatchPhotoFiles(combinedFiles);

    let loadedCount = 0;
    const newUrls: string[] = [];
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        newUrls.push(dataUrl);
        loadedCount++;
        if (loadedCount === validFiles.length) {
          setBatchPhotoDataUrls((prev) => {
            const combined = [...prev, ...newUrls].slice(0, 10);
            if (combined.length > 0) {
              setFormData((f) => ({ ...f, photoDataUrl: combined[0] }));
            }
            return combined;
          });
          toast.success(`${validFiles.length} herd photo${validFiles.length > 1 ? "s" : ""} attached!`);
        }
      };
      reader.readAsDataURL(file);
    });

    if (batchFileInputRef.current) batchFileInputRef.current.value = "";
  };

  const handleRemoveSingleBatchPhoto = (index: number) => {
    setBatchPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setBatchPhotoDataUrls((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setFormData((f) => ({ ...f, photoDataUrl: next[0] || "" }));
      return next;
    });
    toast.info("Photo removed from herd.");
  };

  const handleRemoveAllBatchPhotos = () => {
    setBatchPhotoFiles([]);
    setBatchPhotoDataUrls([]);
    setFormData((prev) => ({ ...prev, photoDataUrl: "" }));
    if (batchFileInputRef.current) batchFileInputRef.current.value = "";
    toast.info("All herd photos removed.");
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
    const clamped = Math.max(0, Math.min(newQty, 100));
    setFormData((prev) => ({ ...prev, quantity: clamped }));

    setBatchAnimals((prev) => {
      const next = [...prev];
      if (clamped > next.length) {
        const usedTags = [...existingTags, ...next.map((animal) => animal.tagNumber)];
        for (let i = next.length + 1; i <= clamped; i++) {
          const tagNumber = ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, usedTags) : "";
          usedTags.push(tagNumber);
          next.push({
            id: String(Date.now() + i),
            tagNumber,
            breed: "",
            sex: "",
            weight: "",
            birthDate: "",
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
    const usedTags = [...existingTags, ...batchAnimals.map((animal) => animal.tagNumber)];
    const newAnimal: BatchAnimalFormRow = {
      id: String(Date.now()),
      tagNumber: ownerTagPrefix
        ? nextOwnerTag(ownerTagPrefix, usedTags)
        : "",
      breed: "",
      sex: "",
      weight: "",
      birthDate: "",
      lastVaccinationDate: "",
    };
    const updated = [...batchAnimals, newAnimal];
    setBatchAnimals(updated);
    setFormData((prev) => ({ ...prev, quantity: updated.length }));
    setExpandedAnimalIndex(updated.length - 1);
  };

  const removeBatchAnimalRow = (index: number) => {
    const updated = batchAnimals.filter((_, i) => i !== index);
    setBatchAnimals(updated);
    setFormData((prev) => ({ ...prev, quantity: updated.length }));
    if (expandedAnimalIndex === index) {
      setExpandedAnimalIndex(updated.length > 0 ? Math.max(0, index - 1) : null);
    } else if (expandedAnimalIndex !== null && expandedAnimalIndex > index) {
      setExpandedAnimalIndex(expandedAnimalIndex - 1);
    }
  };

  const handleClearAllBatchAnimals = () => {
    setBatchAnimals([]);
    setFormData((prev) => ({ ...prev, quantity: 0 }));
    setExpandedAnimalIndex(null);
    toast.info("Cleared animal roster. Reset to 0 animals.");
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

  const syncVaccinationDateToAllAnimals = () => {
    const firstVaccinationDate = batchAnimals[0]?.lastVaccinationDate;
    if (!firstVaccinationDate) {
      toast.info("Please enter a vaccination date for Animal #1 first.");
      return;
    }
    setBatchAnimals((prev) =>
      prev.map((animal) => ({ ...animal, lastVaccinationDate: firstVaccinationDate }))
    );
    toast.success(`Applied Animal #1's vaccination date to all ${batchAnimals.length} animals.`);
  };

  const reTagAllBatchAnimals = () => {
    if (batchAnimals.length === 0) {
      toast.info("No animals in herd roster to tag.");
      return;
    }
    const used = [...existingTags];
    setBatchAnimals((previous) => previous.map((animal) => {
      const tagNumber = ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, used) : "";
      used.push(tagNumber);
      return { ...animal, tagNumber };
    }));
    toast.success(`Auto-generated sequential tags for ${batchAnimals.length} animals.`);
  };

  const resetBatchAnimalsToPreset = () => {
    setBatchAnimals([]);
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

  const batchSpeciesById = useMemo(() => {
    return Object.fromEntries(
      userBatches.map((b) => [String(b.id), b.livestockTypeName])
    );
  }, [userBatches]);

  const matchingBatches = useMemo(
    () => userBatches.filter((b) => b.livestockTypeName === formData.livestockType),
    [userBatches, formData.livestockType]
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      const typeId = livestockTypes[formData.livestockType];
      if (!typeId) {
        throw new Error("Selected livestock type is invalid or not found in system.");
      }

      if (formData.entryType === "INDIVIDUAL") {
        const rawBatchId = String(formData.batchId || "").trim();
        const batchId = rawBatchId && rawBatchId !== "none" ? Number(rawBatchId) : null;
        if (batchId !== null && (!Number.isSafeInteger(batchId) || batchId <= 0)) {
          throw new Error("Choose a valid herd or select Individual Animal (No Batch).");
        }

        const finalBreed = formData.isOtherBreed
          ? (formData.customBreed?.trim() || "Mixed / Crossbred")
          : resolveBreed(formData.livestockType, formData.breed);

        let response;
        if (photoFile) {
          const body = new FormData();
          body.append("livestock_type", String(typeId));
          body.append("entry_type", "INDIVIDUAL");
          body.append("quantity", "1");
          body.append("tag_number", formData.tagNumber.trim());
          body.append("breed", finalBreed);
          body.append("sex", formData.sex);
          if (formData.birthDate) body.append("birth_date", formData.birthDate);
          if (formData.weight) body.append("weight", formData.weight);
          if (formData.lastVaccinationDate) body.append("last_vaccination_date", formData.lastVaccinationDate);
          if (batchId !== null) body.append("batch", String(batchId));
          if (formData.avatarKey) body.append("avatar_key", formData.avatarKey);
          body.append("photo", photoFile);

          response = await api.post("/livestock/inventory/", body, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          const payload: CreateInventoryPayload & { batch?: number | null; avatar_key?: string } = {
            livestock_type: typeId,
            entry_type: "INDIVIDUAL",
            quantity: 1,
            tag_number: formData.tagNumber.trim(),
            breed: finalBreed,
            sex: formData.sex,
            birth_date: formData.birthDate || null,
            weight: formData.weight ? parseFloat(formData.weight) : null,
            last_vaccination_date: formData.lastVaccinationDate || null,
            batch: batchId,
          };
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
        const avgWeight = batchAnimals.length > 0
          ? Math.round(
            (batchAnimals.reduce((acc, a) => acc + (parseFloat(a.weight) || 0), 0) / batchAnimals.length) * 10
          ) / 10
          : null;
        const mainBreed = formData.isOtherBreed
          ? (formData.customBreed?.trim() || "Mixed / Herd Hybrid")
          : (formData.breed?.trim() || batchAnimals[0]?.breed?.trim() || "Standard Herd");
        const batchTag = `BATCH-${formData.livestockType.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const batchName = formData.batchName?.trim() || `${formData.livestockType} Herd (${batchAnimals.length} Heads)`;
        const resolvedFeedType = formData.isOtherFeed
          ? formData.customFeed?.trim() || ""
          : formData.feedType?.trim() || "";

        const response = await api.post("/livestock/batches/", {
          livestock_type: typeId,
          batch_name: batchName,
          batch_code: batchTag,
          housing_pen: formData.housingPen?.trim() || "Standard Pen",
          feed_type: resolvedFeedType,
          target_weight: avgWeight ? Math.round(avgWeight * 1.3) : null,
          animals: batchAnimals.map((a) => ({
            tag_number: a.tagNumber.trim(),
            breed: (a.breed?.trim() && a.breed !== "Others") ? a.breed.trim() : mainBreed,
            sex: a.sex,
            weight: a.weight ? parseFloat(a.weight) : null,
            birth_date: a.birthDate || null,
            last_vaccination_date: a.lastVaccinationDate || null,
          })),
        });

        if (response.data?.id) {
          if (batchPhotoFiles.length > 0) {
            try {
              const photoForm = new FormData();
              batchPhotoFiles.forEach((file) => {
                photoForm.append("photos", file);
              });
              photoForm.append("photo", batchPhotoFiles[0]);
              await api.patch(`/livestock/batches/${response.data.id}/`, photoForm, {
                headers: { "Content-Type": "multipart/form-data" },
              });
            } catch (pErr) {
              console.error("Batch photos upload error:", pErr);
            }
          }
          try {
            if (batchPhotoDataUrls.length > 0) {
              localStorage.setItem(`batch_photos_${response.data.id}`, JSON.stringify(batchPhotoDataUrls));
              localStorage.setItem(`batch_photo_${response.data.id}`, batchPhotoDataUrls[0]);
            }
            const formattedAnimals = batchAnimals.map((a, idx) => ({
              id: `${response.data.id}-${idx + 1}`,
              tagNumber: a.tagNumber.trim(),
              name: `Livestock #${idx + 1}`,
              sex: a.sex,
              birthDate: batchAnimals[idx].birthDate || null,
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
    onSuccess: (createdRecord) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
      const wasBatch = formData.entryType === "BATCH";
      const registeredQty = wasBatch ? batchAnimals.length : formData.quantity;
      onOpenChange(false);
      setFormData(initialFormData);
      setCurrentStep(1);
      setIsReviewConfirmed(false);
      setPhotoFile(null);

      try {
        localStorage.removeItem(draftStorageKey);
        setHasDraft(false);
        setDraftSavedAt(null);
      } catch {
        // ignore
      }

      if (wasBatch) {
        toast.success(`Herd of ${registeredQty} heads created!`, {
          description: "Individual animals saved. Would you like to view their herd roster?",
          action: {
            label: "Open Herd Roster",
            onClick: () => router.push("/livestock-inventory/batches"),
          },
        });
      } else {
        toast.success("Your livestock is now pending for review.");
        if (createdRecord?.id) {
          setSubmittedLivestock({
            id: String(createdRecord.id),
            tagNumber: createdRecord.tag_number || formData.tagNumber,
          });
        }
      }
      onSuccess?.();
    },
    onError: (err: unknown) => {
      console.error(err);
      const response = httpError(err)?.response;
      const body = response?.data;
      const additionalErrors = body && typeof body === "object"
        ? Object.entries(body).flatMap(([field, value]) => {
            if (field === "detail" || field === "error") return [];
            if (typeof value === "string") return [`${field}: ${value}`];
            if (Array.isArray(value)) {
              return value.filter((message): message is string => typeof message === "string")
                .map((message) => `${field}: ${message}`);
            }
            return [];
          })
        : [];
      const msg = body?.detail || body?.error || body?.non_field_errors?.[0] || additionalErrors[0] ||
        (response
          ? `Livestock registration failed (HTTP ${response.status}). Please try again.`
          : "Failed to add livestock entry. Please check required fields.");
      toast.error(msg);
      setFormError(msg);
    },
  });

  const validateStep = (stepNumber: number): boolean => {
    setFormError("");
    if (stepNumber === 1) {
      if (!formData.livestockType) {
        setFormError("Please select a livestock species.");
        return false;
      }
      if (formData.entryType === "INDIVIDUAL") {
        const earTagError = tagError(formData.tagNumber, [], formData.isCustomTag);
        if (earTagError) {
          setFormError(earTagError);
          return false;
        }
        if (!formData.tagNumber.trim()) {
          setFormError("Ear Tag number is required for individual animals.");
          return false;
        }
      }
      return true;
    }
    if (stepNumber === 2) {
      // Herd Profile is optional
      return true;
    }
    if (stepNumber === 3) {
      if (formData.entryType === "INDIVIDUAL") {
        const selectedBreed = formData.isOtherBreed
          ? formData.customBreed.trim()
          : resolveBreed(formData.livestockType, formData.breed);
        if (!selectedBreed) {
          setFormError("Breed is required.");
          return false;
        }
        if (formData.isVaccinated && !formData.lastVaccinationDate) {
          setFormError("Please select the last vaccination date or uncheck 'Vaccinated'.");
          return false;
        }
        if (formData.lastVaccinationDate && formData.lastVaccinationDate > localCalendarDateToday()) {
          setFormError("Vaccination date cannot be in the future.");
          return false;
        }
      } else {
        if (batchAnimals.length < 1) {
          setFormError("At least 1 animal is required in a batch.");
          return false;
        }
        for (let i = 0; i < batchAnimals.length; i++) {
          const otherTags = batchAnimals
            .filter((_, index) => index !== i)
            .map((animal) => animal.tagNumber);
          const earTagError = tagError(batchAnimals[i].tagNumber, otherTags);
          if (earTagError) {
            setFormError(`Animal #${i + 1}: ${earTagError}`);
            return false;
          }
          if (!batchAnimals[i].tagNumber.trim()) {
            setFormError(`Ear Tag is required for Animal #${i + 1}.`);
            return false;
          }
          if (batchAnimals[i].lastVaccinationDate && batchAnimals[i].lastVaccinationDate > localCalendarDateToday()) {
            setFormError(`Vaccination date for Animal #${i + 1} cannot be in the future.`);
            return false;
          }
        }
      }
      return true;
    }
    return true;
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
      }
    }
  };

  const handleBack = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setFormError("");
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Guard: Do not submit to the backend on steps 1-3.
    // If the form is triggered (e.g. via Enter key or Next click), simply advance to next step.
    if (currentStep < 4) {
      handleNext();
      return;
    }

    if (!isReviewConfirmed) {
      setFormError("Please check the confirmation box before submitting.");
      return;
    }

    if (!validateStep(1) || !validateStep(3)) {
      return;
    }
    addMutation.mutate();
  };

  const handleModalClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setCurrentStep(1);
      setIsReviewConfirmed(false);
      setFormError("");
      setFormData(initialFormData);
      setPhotoFile(null);
      setBatchPhotoFiles([]);
      setBatchPhotoDataUrls([]);
      resetBatchAnimalsToPreset();
    }
  };

  const currentStepConfig = WIZARD_STEPS[currentStep - 1];
  const CurrentStepIcon = currentStepConfig.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={handleModalClose}>
        <DialogContent className="w-full max-w-[96vw] sm:max-w-3xl md:max-w-4xl h-[92vh] sm:h-[88vh] max-h-[880px] flex flex-col rounded-3xl p-0 border-0 shadow-2xl overflow-hidden bg-white">
          {/* Header Banner */}
          <div className="shrink-0 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white p-4 sm:p-5 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-emerald-300 border border-white/10 shadow-xs">
                  <CurrentStepIcon className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded-full bg-emerald-500/30 text-emerald-300 text-[11px] font-black flex items-center justify-center">
                      {currentStep}
                    </span>
                    <DialogTitle className="text-lg sm:text-xl font-black text-white tracking-tight">
                      {currentStepConfig.bannerTitle}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="text-xs text-emerald-200/90 mt-0.5">
                    {currentStepConfig.bannerSubtitle}
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleModalClose(false)}
                className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Stepper Progress Navigation Bar */}
          <div className="shrink-0 bg-slate-50 border-b border-slate-200/80 px-4 sm:px-6 py-2.5">
            <div className="flex items-center justify-between gap-1 sm:gap-2 max-w-2xl mx-auto overflow-x-auto">
              {WIZARD_STEPS.map((s) => {
                const isCurrent = currentStep === s.step;
                const isCompleted = currentStep > s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => {
                      if (s.step < currentStep) {
                        setCurrentStep(s.step as 1 | 2 | 3 | 4);
                      } else if (s.step > currentStep) {
                        if (validateStep(currentStep)) {
                          setCurrentStep(s.step as 1 | 2 | 3 | 4);
                        }
                      }
                    }}
                    className={`flex items-center gap-1.5 sm:gap-2 text-left transition-all p-1 rounded-xl shrink-0 ${
                      isCurrent
                        ? "text-emerald-950 font-black"
                        : isCompleted
                          ? "text-emerald-700 font-bold hover:text-emerald-900 cursor-pointer"
                          : "text-slate-400 font-medium cursor-not-allowed opacity-60"
                    }`}
                  >
                    <div
                      className={`size-7 rounded-full flex items-center justify-center text-xs transition-all ${
                        isCurrent
                          ? "bg-emerald-700 text-white font-black shadow-xs ring-2 ring-emerald-600/30 ring-offset-1"
                          : isCompleted
                            ? "bg-emerald-100 text-emerald-800 font-black border border-emerald-300"
                            : "bg-slate-200/80 text-slate-500 border border-slate-300"
                      }`}
                    >
                      {isCompleted ? <Check className="size-3.5 stroke-[3]" /> : s.step}
                    </div>
                    <span className="hidden sm:inline text-xs font-bold leading-tight">
                      {s.shortTitle}
                    </span>
                    {s.step < 4 && (
                      <ChevronRight className="size-3.5 text-slate-300 hidden sm:inline ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Content Area */}
          <form onSubmit={handleAddSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Error Alert */}
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-bold flex items-center gap-2 animate-in fade-in-50 duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Discard / Start Fresh Action */}
              {hasDraft && currentStep === 1 && (
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleStartFresh}
                    className="h-8 px-2.5 rounded-xl text-rose-700 hover:bg-rose-50 text-xs font-bold gap-1.5 cursor-pointer border border-rose-200/80 hover:border-rose-300 shadow-2xs transition-colors"
                  >
                    <Trash2 className="size-3.5 text-rose-600" />
                    <span>Discard / Start Fresh</span>
                  </Button>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  STEP 1: SELECT LIVESTOCK SPECIES & TAG IDENTIFIER (WITH PHOTO)
              ────────────────────────────────────────────────────────── */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in-50 duration-200">
                  {/* Entry Mode Toggle */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Entry Mode
                      </Label>
                      <InfoTooltip text="Choose whether you are registering a single animal with its own tag, or a group of animals raised together as a herd." />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, entryType: "INDIVIDUAL" })}
                        className={`flex min-h-11 items-center justify-center gap-2 px-2 py-2 rounded-xl text-xs font-black transition-all ${
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
                        className={`flex min-h-11 items-center justify-center gap-2 px-2 py-2 rounded-xl text-xs font-black transition-all ${
                          formData.entryType === "BATCH"
                            ? "bg-white text-emerald-950 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <Layers className="w-4 h-4 text-teal-700" />
                        Herd (Batch of Animals)
                      </button>
                    </div>
                  </div>

                  {/* Livestock Species Selection - 2 Column Pill Layout */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-black tracking-tight text-slate-800">
                        Livestock Species
                      </Label>
                      <InfoTooltip text="Select the animal species category (e.g. Cattle, Swine, Sheep, Carabao, Goat, Poultry)." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(livestockTypes).map(([name]) => {
                        const isSelected = formData.livestockType === name;
                        const preset = getSpeciesPreset(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              const defAvatar = getDefaultAvatarForSpecies(name);
                              const defBreed = preset.commonBreeds?.[0] || "";
                              setFormData((prev) => ({
                                ...prev,
                                livestockType: name,
                                breed: defBreed,
                                isOtherBreed: false,
                                customBreed: "",
                                feedType: "",
                                isOtherFeed: false,
                                customFeed: "",
                                batchId:
                                  batchSpeciesById[String(prev.batchId)] &&
                                  batchSpeciesById[String(prev.batchId)] !== name
                                    ? ""
                                    : prev.batchId,
                                avatarKey: prev.photoDataUrl ? prev.avatarKey : defAvatar.id,
                                tagNumber:
                                  prev.entryType === "INDIVIDUAL" && !prev.tagNumber
                                    ? ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, existingTags) : ""
                                    : prev.tagNumber,
                                batchName: prev.batchName ? prev.batchName : `${name} Herd #${Math.floor(100 + Math.random() * 900)}`,
                              }));

                            }}
                            className={`h-13 sm:h-14 px-4 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer ${
                              isSelected
                                ? "border-2 border-emerald-500 bg-emerald-50/70 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-500/30"
                                : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold"
                            }`}
                          >
                            <div
                              className={`size-8 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                                isSelected ? "bg-emerald-100" : "bg-slate-100"
                              }`}
                            >
                              {getSpeciesIllustration(name)}
                            </div>
                            <span className="text-sm font-bold truncate">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ear Tag / Identification Name */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Label
                          htmlFor="tagNamingSelect"
                          className="text-xs font-black tracking-tight text-slate-800"
                        >
                          Ear Tag / Identification Name
                        </Label>
                        <InfoTooltip text="Unique identification placed on the animal's ear tag or RFID chip. Keep standard format or specify a custom tag." />
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {formData.isCustomTag ? "Custom Name Mode" : "Standard Name-Number"}
                      </span>
                    </div>

                    <Select
                      value={formData.isCustomTag ? "CUSTOM" : "STANDARD"}
                      onValueChange={(val) => {
                        if (val === "CUSTOM") {
                          setFormData((prev) => ({
                            ...prev,
                            isCustomTag: true,
                            tagNumber: prev.customTagName || "",
                          }));
                        } else {
                          setFormData((prev) => ({
                            ...prev,
                            isCustomTag: false,
                            tagNumber: ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, existingTags) : "",
                          }));
                        }
                      }}
                    >
                      <SelectTrigger id="tagNamingSelect" className="h-12 rounded-2xl bg-white border-slate-200 font-bold text-sm">
                        <SelectValue placeholder="Select tag naming format..." />
                      </SelectTrigger>
                      <SelectContent className="z-[var(--z-popover-dialog)] rounded-2xl">
                        <SelectItem value="STANDARD" className="font-bold text-sm">
                          🏷️ Standard ({ownerTagPrefix ? `${ownerTagPrefix}-` : "NAME-"})
                        </SelectItem>
                        <SelectItem value="CUSTOM" className="font-bold text-sm text-emerald-800">
                          ➕ Custom (Specify custom name or tag)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tag Number (Auto-generated) */}
                  {!formData.isCustomTag ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Label
                            htmlFor="tagNumber"
                            className="text-xs font-black tracking-tight text-slate-800"
                          >
                            Tag Number (Auto-generated)
                          </Label>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                tagNumber: ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, existingTags) : "",
                              })
                            }
                            className="text-emerald-600 hover:text-emerald-700 p-0.5 rounded cursor-pointer transition-transform active:scale-95"
                            title="Auto-generate Tag"
                          >
                            <Wand2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <Input
                        id="tagNumber"
                        placeholder="e.g. NAME-001"
                        value={formData.tagNumber}
                        readOnly
                        className={`h-13 rounded-2xl font-mono font-black text-sm sm:text-base border-0 bg-slate-100 text-slate-900 px-4 tracking-wider ${
                          tagError(formData.tagNumber, [], false) ? "ring-2 ring-rose-500 bg-rose-50/30" : ""
                        }`}
                        required
                      />
                      {tagError(formData.tagNumber, [], false) ? (
                        <p className="text-xs font-medium text-rose-700" role="alert">
                          {tagError(formData.tagNumber, [], false)}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Use your name followed by a number, such as {ownerTagPrefix || "YOUR-NAME"}-001. The next number is generated for you.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5 animate-in fade-in-50 duration-200">
                      <Label
                        htmlFor="customTagName"
                        className="text-xs font-bold text-emerald-800 flex items-center gap-1"
                      >
                        Specify Custom Name or Ear Tag:
                      </Label>
                      <Input
                        id="customTagName"
                        placeholder="e.g. BESSIE-001, BELLA, or TAG-99"
                        value={formData.tagNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tagNumber: e.target.value.toUpperCase(),
                            customTagName: e.target.value.toUpperCase(),
                          })
                        }
                        className={`h-13 rounded-2xl font-mono font-black text-sm sm:text-base border-emerald-300 focus-visible:ring-emerald-500/20 bg-white ${
                          tagError(formData.tagNumber, [], true) ? "border-rose-500 focus-visible:ring-rose-500" : ""
                        }`}
                        required
                        autoFocus
                      />
                      {tagError(formData.tagNumber, [], true) ? (
                        <p className="text-xs font-medium text-rose-700" role="alert">
                          {tagError(formData.tagNumber, [], true)}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Enter an optional custom name or identifier for this animal (letters, numbers, hyphens).
                        </p>
                      )}
                    </div>
                  )}

                  {/* Animal Photo & Visual Avatar (Optional) - Merged into Step 1 */}
                  <div className="pt-4 border-t border-slate-200/80 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <Camera className="size-3.5 text-emerald-700" />
                            Animal Photo & Visual Avatar
                          </Label>
                          <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-300 font-bold">
                            Optional
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
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

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    {/* Upload Card / Tap to upload */}
                    {formData.photoDataUrl ? (
                      <div className="p-4 bg-white rounded-2xl border border-emerald-300 shadow-xs flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative size-24 rounded-2xl overflow-hidden border-2 border-emerald-600 shadow-sm shrink-0">
                          <img
                            src={formData.photoDataUrl}
                            alt="Livestock Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 text-center sm:text-left space-y-2">
                          <p className="text-xs font-bold text-slate-800">Custom Photo Uploaded</p>
                          <p className="text-[11px] text-slate-500">
                            This photo will represent your livestock record.
                          </p>
                          <div className="flex items-center justify-center sm:justify-start gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              className="h-8 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold gap-1.5 shadow-xs"
                            >
                              <Upload className="size-3.5" /> Change Photo
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleRemovePhoto}
                              className="h-8 px-3 rounded-xl border-slate-300 text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold"
                            >
                              <Trash2 className="size-3.5 mr-1" /> Use Preset Avatar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full p-6 sm:p-7 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-600 bg-slate-50/50 hover:bg-emerald-50/40 transition-colors flex flex-col items-center justify-center gap-2 text-center cursor-pointer group shadow-2xs"
                      >
                        <div className="size-12 rounded-2xl bg-white text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs border border-slate-200">
                          <Upload className="size-6" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800">
                            Tap to upload a photo
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            JPG, PNG, WebP (Max 5MB)
                          </p>
                        </div>
                      </button>
                    )}

                    {/* Preset Avatars Selection */}
                    <div className="space-y-2 pt-2 border-t border-slate-200/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                          or choose a preset avatar
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAllAvatars(!showAllAvatars)}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          {showAllAvatars ? "Show Species Only" : `Browse All (${LIVESTOCK_AVATAR_PRESETS.length})`}
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
                              className={`relative p-2 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                                isSelected
                                  ? "border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-600 shadow-xs scale-102"
                                  : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                              }`}
                            >
                              <div
                                className={`size-10 rounded-xl flex items-center justify-center bg-gradient-to-br border ${av.bgGradient}`}
                              >
                                <span className="text-xl">{av.emoji}</span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-700 truncate w-full">
                                {av.name}
                              </span>
                              {isSelected && (
                                <span className="absolute -top-1 -right-1 size-4.5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[10px] shadow-xs">
                                  <Check className="size-3 stroke-[3]" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>



                    {/* Herd Gallery Photos for Batch (Optional) */}
                    {formData.entryType === "BATCH" && (
                      <div className="pt-2 border-t border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-700">
                            Herd Gallery Photos ({batchPhotoDataUrls.length})
                          </Label>
                          {batchPhotoDataUrls.length > 0 && (
                            <button
                              type="button"
                              onClick={handleRemoveAllBatchPhotos}
                              className="text-[10px] font-bold text-rose-700 hover:underline"
                            >
                              Clear All Photos
                            </button>
                          )}
                        </div>
                        <input
                          type="file"
                          multiple
                          ref={batchFileInputRef}
                          onChange={handleBatchPhotoUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {batchPhotoDataUrls.map((url, idx) => (
                            <div key={url} className="relative size-15 rounded-xl overflow-hidden border border-emerald-500 shrink-0 group">
                              <img src={url} alt={`Herd ${idx + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleRemoveSingleBatchPhoto(idx)}
                                className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="size-3.5 text-rose-300" />
                              </button>
                            </div>
                          ))}
                          {batchPhotoDataUrls.length < 10 && (
                            <button
                              type="button"
                              onClick={() => batchFileInputRef.current?.click()}
                              className="size-15 rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-600 bg-white text-emerald-700 flex flex-col items-center justify-center gap-0.5 shrink-0"
                            >
                              <Plus className="size-4" />
                              <span className="text-[9px] font-bold">Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  STEP 2: HERD PROFILE (OPTIONAL)
              ────────────────────────────────────────────────────────── */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-in fade-in-50 duration-200">
                  <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                        <Layers className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800">
                          Herd Profile
                        </h3>
                        <p className="text-xs text-slate-500">
                          Assign an identifiable herd name and housing details.
                        </p>
                      </div>
                    </div>

                    {formData.entryType === "BATCH" ? (
                      <div className="space-y-3.5">
                        {/* Herd Name */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="batchName" className="text-xs font-bold text-slate-700">
                              Herd Name (Optional)
                            </Label>
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  batchName: `${prev.livestockType} Herd #${Math.floor(100 + Math.random() * 900)}`,
                                }))
                              }
                              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="size-3.5" /> Auto-suggest Name
                            </button>
                          </div>
                          <Input
                            id="batchName"
                            placeholder={`e.g. Pen 3 Fattening ${formData.livestockType}, East Barn Herd`}
                            value={formData.batchName}
                            onChange={(e) => setFormData({ ...formData, batchName: e.target.value })}
                            className="h-11 rounded-xl bg-white font-medium"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="assignedBatch" className="text-xs font-bold text-slate-700">
                            Assigned Herd (Optional)
                          </Label>
                          <InfoTooltip text="Group this animal under an existing herd or leave blank if raised as a standalone livestock." />
                        </div>
                        <Select
                          value={formData.batchId || "none"}
                          onValueChange={(val) => setFormData({ ...formData, batchId: val === "none" ? "" : val })}
                        >
                          <SelectTrigger id="assignedBatch" className="h-11 rounded-xl bg-white">
                            <SelectValue placeholder="Individual Animal (No Batch)" />
                          </SelectTrigger>
                          <SelectContent className="z-[var(--z-popover-dialog)]">
                            <SelectItem value="none">Individual Animal (No Batch)</SelectItem>
                            {matchingBatches.map((b) => (
                              <SelectItem key={b.id} value={String(b.id)}>
                                {b.batchCode} ({b.batchName || b.livestockTypeName})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Housing Pen / Facility */}
                    <div className="space-y-1.5">
                      <Label htmlFor="housingPen" className="text-xs font-bold text-slate-700">
                        Housing Pen / Facility (Optional)
                      </Label>
                      <Input
                        id="housingPen"
                        placeholder="e.g. East Barn / Pen 3 Fattening"
                        value={formData.housingPen}
                        onChange={(e) => setFormData({ ...formData, housingPen: e.target.value })}
                        className="h-11 rounded-xl bg-white text-sm"
                      />
                    </div>

                    {/* Feed Formulation / Ration */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="feedType" className="text-xs font-bold text-slate-700">
                          Feed Formulation / Ration (Optional)
                        </Label>
                        <span className="text-[11px] text-slate-400 font-semibold">
                          {currentPreset?.name} suggestions
                        </span>
                      </div>
                      <Select
                        value={formData.isOtherFeed ? "OTHER" : formData.feedType || "NOT_SPECIFIED"}
                        onValueChange={(val) => {
                          if (val === "OTHER") {
                            setFormData((prev) => ({ ...prev, isOtherFeed: true }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              feedType: val === "NOT_SPECIFIED" ? "" : val,
                              isOtherFeed: false,
                              customFeed: "",
                            }));
                          }
                        }}
                      >
                        <SelectTrigger id="feedType" className="h-11 rounded-xl bg-white text-sm font-medium">
                          <SelectValue placeholder="Select feed formulation..." />
                        </SelectTrigger>
                        <SelectContent className="z-[var(--z-popover-dialog)] rounded-xl max-h-60">
                          <SelectItem value="NOT_SPECIFIED" className="text-sm text-slate-500">
                            Not specified
                          </SelectItem>
                          {currentPreset?.commonFeeds?.map((f) => (
                            <SelectItem key={f} value={f} className="text-sm">
                              {f}
                            </SelectItem>
                          ))}
                          <SelectItem value="OTHER" className="text-sm font-bold text-emerald-800">
                            ➕ Others (Specify custom feed)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {formData.isOtherFeed && (
                        <div className="pt-1 animate-in fade-in-50 duration-200">
                          <Input
                            id="customFeed"
                            maxLength={100}
                            placeholder="e.g. Finisher Pellets, Napier Grass"
                            value={formData.customFeed}
                            onChange={(e) => setFormData({ ...formData, customFeed: e.target.value })}
                            className="h-10 rounded-xl bg-white text-sm"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  STEP 3: INDIVIDUAL LIVESTOCK DETAILS
              ────────────────────────────────────────────────────────── */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-in fade-in-50 duration-200">
                  {formData.entryType === "BATCH" ? (
                    /* Herd Individual Roster Editor */
                    <div className="space-y-4">
                      {/* Top Action Bar */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={reTagAllBatchAnimals}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <Sparkles className="size-3.5 text-emerald-600" />
                            Auto-Tag
                          </button>
                          {batchAnimals.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearAllBatchAnimals}
                              className="px-3 py-1.5 text-xs font-bold rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <Trash2 className="size-3.5 text-rose-600" />
                              Clear All ({batchAnimals.length})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleSaveDraft}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <Check className="size-3.5 text-emerald-600" />
                            <span>{hasDraft ? "Auto-Saved" : "Save Draft"}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">
                            Total: <strong className="text-emerald-950 font-black">{batchAnimals.length} head(s)</strong>
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            onClick={addBatchAnimalRow}
                            className="h-8 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold gap-1 shadow-xs cursor-pointer"
                          >
                            <Plus className="size-3.5" /> Add Animal
                          </Button>
                        </div>
                      </div>

                      {/* Head count quick stepper */}
                      <div className="flex items-center justify-between bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200/80">
                        <span className="text-xs font-bold text-emerald-900">
                          Herd Size
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleBatchQuantityChange(Math.max(0, batchAnimals.length - 1))}
                            disabled={batchAnimals.length <= 0}
                            className="size-7 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={batchAnimals.length}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                handleBatchQuantityChange(0);
                                return;
                              }
                              const val = parseInt(raw, 10);
                              if (!Number.isNaN(val)) {
                                handleBatchQuantityChange(val);
                              }
                            }}
                            className="h-7.5 w-16 text-center font-mono font-black text-sm bg-white rounded-lg border-slate-300 px-1 shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleBatchQuantityChange(Math.min(100, batchAnimals.length + 1))}
                            className="size-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center hover:bg-emerald-800 cursor-pointer"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Animal Cards Accordion List or Empty State */}
                      {batchAnimals.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center">
                          <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                            <Users className="size-6" />
                          </div>
                          <h4 className="text-sm font-black text-slate-800 mb-1">No animals in herd roster</h4>
                          <p className="text-xs text-slate-500 max-w-xs mb-4">
                            Use the herd size input above or click below to add individual animals with auto-generated ear tags.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            onClick={addBatchAnimalRow}
                            className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Plus className="size-3.5" /> Add First Animal
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                          {batchAnimals.map((animal, idx) => {
                            const isExpanded = expandedAnimalIndex === idx;
                            return (
                              <div
                                key={animal.id || idx}
                                className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all"
                              >
                                {/* Card Header (Accordion toggle) */}
                                <div
                                  onClick={() => setExpandedAnimalIndex(isExpanded ? null : idx)}
                                  className="p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="size-6 rounded-full bg-emerald-700 text-white font-black text-xs flex items-center justify-center shrink-0">
                                      #{idx + 1}
                                    </span>
                                    <span className="font-mono text-xs font-black text-slate-900 truncate">
                                      {animal.tagNumber || `Animal #${idx + 1}`}
                                    </span>
                                    {animal.sex ? (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] font-bold uppercase py-0.5 px-2 ${
                                          animal.sex === "Female"
                                            ? "text-rose-700 bg-rose-50 border-rose-200 font-black"
                                            : animal.sex === "Male"
                                              ? "text-blue-700 bg-blue-50 border-blue-200 font-black"
                                              : "text-amber-700 bg-amber-50 border-amber-200 font-black"
                                        }`}
                                      >
                                        {animal.sex}
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] font-medium text-slate-400 bg-slate-50 border-slate-200 py-0.5 px-2"
                                      >
                                        Sex not set
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeBatchAnimalRow(idx);
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="Remove animal"
                                    >
                                      <Trash2 className="size-4" />
                                    </button>
                                    {isExpanded ? (
                                      <ChevronUp className="size-4 text-slate-400" />
                                    ) : (
                                      <ChevronDown className="size-4 text-slate-400" />
                                    )}
                                  </div>
                                </div>

                                {/* Card Body (Expanded Inputs) */}
                                {isExpanded && (
                                  <div className="p-3.5 pt-0 border-t border-slate-100 space-y-3 bg-slate-50/50">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                      {/* Tag number */}
                                      <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-600">
                                          Tag Number
                                        </Label>
                                        <Input
                                          value={animal.tagNumber}
                                          onChange={(e) => updateBatchAnimalField(idx, "tagNumber", e.target.value.toUpperCase())}
                                          placeholder="e.g. NAME-001"
                                          className="h-10 text-xs font-mono font-bold rounded-xl bg-white"
                                          required
                                        />
                                      </div>

                                      {/* Breed */}
                                      <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-600">
                                          Breed / Strain
                                        </Label>
                                        <Select
                                          value={
                                            currentPreset?.commonBreeds?.includes(animal.breed)
                                              ? animal.breed
                                              : animal.breed === "Others" || (animal.breed && !currentPreset?.commonBreeds?.includes(animal.breed))
                                                ? "OTHER"
                                                : ""
                                          }
                                          onValueChange={(val) => {
                                            if (val === "OTHER") {
                                              updateBatchAnimalField(idx, "breed", "Others");
                                            } else {
                                              updateBatchAnimalField(idx, "breed", val);
                                            }
                                          }}
                                        >
                                          <SelectTrigger className="h-10 text-xs rounded-xl bg-white">
                                            <SelectValue placeholder="Select breed" />
                                          </SelectTrigger>
                                          <SelectContent className="z-[var(--z-popover-dialog)] rounded-xl max-h-56">
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
                                        {(animal.breed === "Others" || (!currentPreset?.commonBreeds?.includes(animal.breed) && animal.breed !== "")) && (
                                          <Input
                                            value={animal.breed === "Others" ? "" : animal.breed}
                                            onChange={(e) => updateBatchAnimalField(idx, "breed", e.target.value || "Others")}
                                            placeholder="Type custom breed"
                                            className="h-9 text-xs rounded-xl mt-1.5 bg-white border-emerald-400 font-medium"
                                            required
                                          />
                                        )}
                                      </div>

                                      {/* Sex */}
                                      <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-600">
                                          Sex
                                        </Label>
                                        <Select
                                          value={animal.sex}
                                          onValueChange={(val) => {
                                            if (val === "Male" || val === "Female" || val === "Castrated") {
                                              updateBatchAnimalField(idx, "sex", val);
                                            }
                                          }}
                                        >
                                          <SelectTrigger className="h-10 text-xs rounded-xl bg-white">
                                            <SelectValue placeholder="Select sex" />
                                          </SelectTrigger>
                                          <SelectContent className="z-[var(--z-popover-dialog)]">
                                            <SelectItem value="Female">Female</SelectItem>
                                            <SelectItem value="Male">Male</SelectItem>
                                            <SelectItem value="Castrated">Castrated / Barrow</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                    {/* Weight */}
                                    <div className="space-y-1">
                                      <Label className="text-xs font-bold text-slate-600">
                                        Weight (kg)
                                      </Label>
                                      <Input
                                        type="number"
                                        step="0.1"
                                        value={animal.weight}
                                        onChange={(e) => updateBatchAnimalField(idx, "weight", e.target.value)}
                                        placeholder="e.g. 65"
                                        className="h-10 text-xs font-bold rounded-xl bg-white"
                                      />
                                    </div>

                                    {/* Birth Date */}
                                    <div className="space-y-1">
                                      <Label className="text-xs font-bold text-slate-600">
                                        Birth Date (Optional)
                                      </Label>
                                      <Input
                                        type="date"
                                        max={localCalendarDateToday()}
                                        value={animal.birthDate || ""}
                                        onChange={(e) => updateBatchAnimalField(idx, "birthDate", e.target.value)}
                                        className="h-10 text-xs rounded-xl bg-white"
                                      />
                                    </div>

                                    {/* Vaccination Date */}
                                    <div className="space-y-1">
                                      <Label className="text-xs font-bold text-slate-600">
                                        Vaccination Date (Optional)
                                      </Label>
                                      <Input
                                        type="date"
                                        max={localCalendarDateToday()}
                                        value={animal.lastVaccinationDate}
                                        onChange={(e) => updateBatchAnimalField(idx, "lastVaccinationDate", e.target.value)}
                                        className="h-10 text-xs rounded-xl bg-white"
                                      />
                                    </div>
                                  </div>

                                  {/* Sync buttons */}
                                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                                    <button
                                      type="button"
                                      onClick={syncBreedToAllAnimals}
                                      className="text-[11px] font-bold text-emerald-700 hover:underline"
                                    >
                                      Apply Breed to All Animals
                                    </button>
                                    <span className="text-slate-300">•</span>
                                    <button
                                      type="button"
                                      onClick={syncVaccinationDateToAllAnimals}
                                      className="text-[11px] font-bold text-emerald-700 hover:underline"
                                    >
                                      Apply Vax Date to All
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  ) : (
                    /* Individual Animal Details Form */
                    <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4">
                      {/* Breed */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="breedSelect" className="text-xs font-bold text-slate-700">
                            Breed / Pedigree
                          </Label>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {formData.isOtherBreed ? "Custom Breed" : "Standard Species Breed"}
                          </span>
                        </div>
                        <Select
                          value={formData.isOtherBreed ? "OTHER" : resolveBreed(formData.livestockType, formData.breed)}
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
                          <SelectContent className="z-[var(--z-popover-dialog)] rounded-xl max-h-60">
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
                        {formData.isOtherBreed && (
                          <div className="pt-1 animate-in fade-in-50 duration-200">
                            <Input
                              id="customBreed"
                              placeholder="e.g. Belgian Blue Cross, Native Batangas Hybrid"
                              value={formData.customBreed}
                              onChange={(e) => setFormData({ ...formData, customBreed: e.target.value })}
                              className="h-11 rounded-xl border-emerald-300 bg-white font-medium"
                              required
                              autoFocus
                            />
                          </div>
                        )}
                      </div>

                      {/* Sex & Weight */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="sex" className="text-xs font-bold text-slate-700">
                            Sex / Gender
                          </Label>
                          <Select
                            value={formData.sex}
                            onValueChange={(val) => setFormData({ ...formData, sex: val })}
                          >
                            <SelectTrigger id="sex" className="h-11 rounded-xl bg-white">
                              <SelectValue placeholder="Select sex" />
                            </SelectTrigger>
                            <SelectContent className="z-[var(--z-popover-dialog)]">
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Male">Male</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="weight" className="text-xs font-bold text-slate-700">
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
                            placeholder="e.g. 65"
                            value={formData.weight}
                            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                            className="h-11 rounded-xl bg-white"
                          />
                        </div>
                      </div>

                      {/* Birth Date */}
                      <div className="space-y-1.5">
                        <Label htmlFor="birthDate" className="text-xs font-bold text-slate-700">
                          Birth Date (Optional)
                        </Label>
                        <Input
                          id="birthDate"
                          type="date"
                          max={localCalendarDateToday()}
                          value={formData.birthDate}
                          onChange={(e) => setFormData((prev) => ({ ...prev, birthDate: e.target.value }))}
                          className="h-11 rounded-xl bg-white"
                        />
                      </div>

                      {/* Vaccination Checkbox & Date */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-3">
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
                            <Label htmlFor="vaxDate" className="text-xs font-bold text-slate-600">
                              Last Vaccination Date
                            </Label>
                            <Input
                              id="vaxDate"
                              type="date"
                              max={localCalendarDateToday()}
                              value={formData.lastVaccinationDate}
                              onChange={(e) => setFormData({ ...formData, lastVaccinationDate: e.target.value })}
                              className="h-10 rounded-xl bg-white"
                              required
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  STEP 4: REVIEW & SUBMIT
              ────────────────────────────────────────────────────────── */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-in fade-in-50 duration-200">
                  {/* Identification Card */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex items-center gap-2">
                      <Tag className="size-4 text-emerald-700" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Identification
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium block">Tag Number</span>
                        <span className="font-mono font-black text-slate-900 text-sm">
                          {formData.entryType === "INDIVIDUAL"
                            ? (formData.tagNumber || "Unassigned")
                            : `Batch (${batchAnimals.length} head tags)`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Tag Format</span>
                        <span className="font-bold text-slate-900">
                          {formData.isCustomTag ? "Custom Mode" : `Standard (${ownerTagPrefix || "NAME"}-)`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Species</span>
                        <span className="font-bold text-slate-900">{formData.livestockType}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Entry Mode</span>
                        <span className="font-bold text-slate-900">
                          {formData.entryType === "INDIVIDUAL" ? "Individual Animal" : "Herd"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Herd Profile Card */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-teal-700" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Herd Profile
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium block">Herd Name</span>
                        <span className="font-bold text-slate-900">
                          {formData.entryType === "BATCH"
                            ? (formData.batchName || "Not specified")
                            : (matchingBatches.find((b) => String(b.id) === formData.batchId)?.batchName || "Individual Animal (No Batch)")}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Housing Pen / Facility</span>
                        <span className="font-bold text-slate-900">
                          {formData.housingPen || "Not specified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block">Feed Formulation / Ration</span>
                        <span className="font-bold text-slate-900">
                          {(formData.isOtherFeed ? formData.customFeed : formData.feedType) || "Not specified"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Animals in Batch or Individual Details Card */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-emerald-700" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                          {formData.entryType === "BATCH" ? "Animals in Batch" : "Animal Specifications"}
                        </h4>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-bold">
                        {formData.entryType === "BATCH" ? `${batchAnimals.length} head(s)` : "1 head"}
                      </Badge>
                    </div>

                    {formData.entryType === "BATCH" ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-200">
                          <span>Avg Weight: <strong>~{batchMetrics.avgWeight} kg</strong></span>
                          <span>Total Biomass: <strong>~{batchMetrics.totalWeight} kg</strong></span>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                          {batchAnimals.map((a, idx) => (
                            <div
                              key={a.id || idx}
                              className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className="size-5 rounded-full bg-emerald-700 text-white font-black text-[10px] flex items-center justify-center">
                                  #{idx + 1}
                                </span>
                                <span className="font-mono font-bold text-slate-900">{a.tagNumber}</span>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-700">{a.breed || "Standard"}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-500">
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {a.sex || "Unspecified"}
                                </Badge>
                                <span>{a.weight ? `${a.weight} kg` : "No weight"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 font-medium block">Breed</span>
                          <span className="font-bold text-slate-900">
                            {formData.isOtherBreed ? formData.customBreed : formData.breed}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Sex</span>
                          <span className="font-bold text-slate-900">{formData.sex}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Weight</span>
                          <span className="font-bold text-slate-900">{formData.weight ? `${formData.weight} kg` : "Not specified"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Vaccination</span>
                          <span className="font-bold text-slate-900">
                            {formData.isVaccinated ? `Vaccinated (${formData.lastVaccinationDate})` : "None"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Photo or Avatar summary thumbnail */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center gap-3">
                    {formData.photoDataUrl ? (
                      <img
                        src={formData.photoDataUrl}
                        alt="Photo preview"
                        className="size-12 rounded-xl object-cover border border-emerald-300 shrink-0"
                      />
                    ) : (
                      <div className={`size-12 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br border shrink-0 ${selectedAvatarOption.bgGradient}`}>
                        {selectedAvatarOption.emoji}
                      </div>
                    )}
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 block">
                        {formData.photoDataUrl ? "Attached Custom Photo" : `Preset Avatar: ${selectedAvatarOption.name}`}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Visual badge applied to this livestock entry.
                      </span>
                    </div>
                  </div>

                  {/* Information Banner */}
                  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-2.5 text-xs text-blue-900 font-medium">
                    <Info className="size-4 text-blue-600 shrink-0" />
                    <span>You can still edit this record after submission (if not yet verified).</span>
                  </div>

                  {/* Accuracy Confirmation Checkbox */}
                  <div className="p-4 rounded-2xl border-2 border-emerald-600/30 bg-emerald-50/60 flex items-start gap-3 transition-colors">
                    <Checkbox
                      id="confirmAccuracy"
                      checked={isReviewConfirmed}
                      onCheckedChange={(checked) => setIsReviewConfirmed(Boolean(checked))}
                      className="size-5 rounded-md border-emerald-600 data-[state=checked]:bg-emerald-700 data-[state=checked]:text-white mt-0.5 cursor-pointer"
                    />
                    <div className="space-y-0.5 cursor-pointer" onClick={() => setIsReviewConfirmed(!isReviewConfirmed)}>
                      <Label
                        htmlFor="confirmAccuracy"
                        className="text-xs font-black text-emerald-950 cursor-pointer select-none"
                      >
                        I confirm that the information provided above is complete and accurate.
                      </Label>
                      <p className="text-[11px] text-emerald-800/80 leading-relaxed select-none">
                        Checking this box certifies that all ear tags, breeds, and livestock specifications are verified and ready for official submission.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Footer Navigation Bar */}
            <div className="shrink-0 p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleStartFresh}
                  className="h-9 px-2.5 rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold gap-1.5 cursor-pointer border border-slate-200 hover:border-rose-200 transition-colors"
                  title="Clear all fields and discard draft"
                >
                  <Trash2 className="size-3.5 text-slate-400" />
                  Discard / Start Fresh
                </Button>
                <div className="flex items-center gap-2 text-xs">
                  {autoSaveStatus === "saving" ? (
                    <span className="flex items-center gap-1.5 text-amber-700 font-bold animate-pulse">
                      <Sparkles className="size-3.5 text-amber-600" />
                      Saving draft...
                    </span>
                  ) : draftSavedAt ? (
                    <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                      <Check className="size-3.5 text-emerald-600" />
                      Draft auto-saved
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">Auto-saves as you type</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {currentStep > 1 && (
                  <Button
                    key="wizard-btn-back"
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="rounded-xl h-11 px-4 font-bold border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <ArrowLeft className="size-4 mr-1.5" /> Back
                  </Button>
                )}

                {currentStep < 4 ? (
                  <Button
                    key={`wizard-btn-next-step-${currentStep}`}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNext(e);
                    }}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl h-12 px-7 shadow-sm cursor-pointer text-sm"
                  >
                    Next <ArrowRight className="size-4 ml-1.5" />
                  </Button>
                ) : (
                  <Button
                    key="wizard-btn-submit-final"
                    type="submit"
                    disabled={!isReviewConfirmed || addMutation.isPending}
                    className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl h-11 px-6 shadow-sm cursor-pointer min-w-36 transition-all"
                  >
                    {addMutation.isPending ? "Submitting..." : "Submit for Review"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog after Submission */}
      <Dialog
        open={Boolean(submittedLivestock)}
        onOpenChange={(nextOpen) => !nextOpen && setSubmittedLivestock(null)}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-6">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
            <Check className="size-7" aria-hidden="true" />
          </div>
          <div className="space-y-2 text-center">
            <DialogTitle className="text-xl font-bold text-slate-900">Your livestock is pending for review</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-600">
              Ear tag <span className="font-semibold text-slate-900">{submittedLivestock?.tagNumber}</span> was submitted and is waiting for official review.
            </DialogDescription>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-xl"
              onClick={() => setSubmittedLivestock(null)}
            >
              Close
            </Button>
            <Button
              type="button"
              className="min-h-11 rounded-xl bg-emerald-700 font-semibold text-white hover:bg-emerald-800"
              onClick={() => {
                const livestockId = submittedLivestock?.id;
                setSubmittedLivestock(null);
                if (livestockId) router.push(`/livestock-inventory/${livestockId}`);
              }}
            >
              View Livestock
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
