"use client";

import type { LivestockBatchItem, CreateInventoryPayload } from "../livestock-inventory";
import { httpError } from "@/lib/http-error";
import { useMutation,useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect,useMemo,useRef,useState } from "react";
import { toast } from "sonner";

import {
AlertCircle,
Camera,
Check,
Download,
FileText,
HelpCircle,
Layers,
Minus,
Plus,
Save,
Sparkles,
Syringe,
Tag,
Trash2,
Upload,
Users,
Wand2
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
  sex: "Female" | "Male" | "Castrated";
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

type AnimalSide = "left" | "right";
type SidePhotoFiles = Record<AnimalSide, File | null>;
type SidePhotoPreviews = Record<AnimalSide, string>;

const initialFormData = {
  entryType: "INDIVIDUAL" as EntryType,
  livestockType: "Cattle",
  quantity: 1,
  tagNumber: "",
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
  // The prefix is normalized to letters, digits, and hyphens, so it is safe in this pattern.
  const pattern = new RegExp(`^${prefix}-(\\d{3,})$`, "i");
  const highest = usedTags.reduce((max, tag) => {
    const match = tag.trim().match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

function createDefaultBatchAnimals(prefix: string, usedTags: string[]): BatchAnimalFormRow[] {
  const used = [...usedTags];
  const defaults: BatchAnimalFormRow[] = [
    { id: "1", tagNumber: "", breed: "Large White", sex: "Female", weight: "65.0", lastVaccinationDate: "" },
    { id: "2", tagNumber: "", breed: "Large White", sex: "Male", weight: "68.5", lastVaccinationDate: "" },
    { id: "3", tagNumber: "", breed: "Large White", sex: "Female", weight: "64.0", lastVaccinationDate: "" },
  ];
  return defaults.map((animal) => {
    const tagNumber = prefix ? nextOwnerTag(prefix, used) : "";
    used.push(tagNumber);
    return { ...animal, tagNumber };
  });
}

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

  const [formError, setFormError] = useState("");
  const [submittedLivestock, setSubmittedLivestock] = useState<{ id: string; tagNumber: string } | null>(null);
  const [formData, setFormData] = useState(() => ({ ...initialFormData, tagNumber: ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, existingTags) : "" }));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [sidePhotoFiles, setSidePhotoFiles] = useState<SidePhotoFiles>({ left: null, right: null });
  const [sidePhotoPreviews, setSidePhotoPreviews] = useState<SidePhotoPreviews>({ left: "", right: "" });
  const sidePhotoInputRefs = useRef<Record<AnimalSide, HTMLInputElement | null>>({ left: null, right: null });
  const [batchPhotoFiles, setBatchPhotoFiles] = useState<File[]>([]);
  const [batchPhotoDataUrls, setBatchPhotoDataUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const [showAllAvatars, setShowAllAvatars] = useState(false);

  // Batch individual animals state for Add Modal
  const [batchAnimals, setBatchAnimals] = useState<BatchAnimalFormRow[]>(() =>
    createDefaultBatchAnimals(ownerTagPrefix, existingTags)
  );

  // Draft persistence in localStorage
  const draftStorageKey = useMemo(() => {
    return `smartlivestock_livestock_draft_${user?.username || "default"}`;
  }, [user?.username]);

  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving" | "idle">("idle");

  // Auto-restore draft on mount if available
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as LivestockRegistrationDraft;
        if (parsed?.savedAt) {
          if (parsed.formData) {
            setFormData(parsed.formData);
          }
          if (parsed.batchAnimals && Array.isArray(parsed.batchAnimals) && parsed.batchAnimals.length > 0) {
            setBatchAnimals(parsed.batchAnimals);
          }
          if (parsed.batchPhotoDataUrls && Array.isArray(parsed.batchPhotoDataUrls)) {
            setBatchPhotoDataUrls(parsed.batchPhotoDataUrls);
          }
          setHasDraft(true);
          setDraftSavedAt(parsed.savedAt);
          setAutoSaveStatus("saved");
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [draftStorageKey]);

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
      batchAnimals.some((a) => (a.weight !== "65.0" && a.weight !== "65") || a.lastVaccinationDate || a.birthDate) ||
      batchAnimals.length !== 3 ||
      hasDraft;

    if (!hasMeaningfulContent) return;

    setAutoSaveStatus("saving");
    const timeout = setTimeout(() => {
      try {
        const now = new Date().toISOString();
        const draft: LivestockRegistrationDraft = {
          formData,
          batchAnimals,
          batchPhotoDataUrls: batchPhotoDataUrls.slice(0, 3),
          savedAt: now,
        };
        try {
          localStorage.setItem(draftStorageKey, JSON.stringify(draft));
        } catch {
          const leanDraft: LivestockRegistrationDraft = {
            formData: { ...formData, photoDataUrl: "" },
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
      const draft: LivestockRegistrationDraft = {
        formData,
        batchAnimals,
        batchPhotoDataUrls: batchPhotoDataUrls.slice(0, 3),
        savedAt: now,
      };
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      } catch {
        const leanDraft: LivestockRegistrationDraft = {
          formData: { ...formData, photoDataUrl: "" },
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
      setFormData({
        ...initialFormData,
        tagNumber: ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, existingTags) : "",
      });
      setBatchAnimals(createDefaultBatchAnimals(ownerTagPrefix, existingTags));
      setPhotoFile(null);
      clearSidePhotos();
      setBatchPhotoFiles([]);
      setBatchPhotoDataUrls([]);
      setFormError("");
      toast.info("Draft discarded. Started with a fresh form.");
    } catch (err) {
      console.error("Failed to discard draft:", err);
    }
  };

  const tagError = (tag: string, otherTags: string[] = []) => {
    const normalizedTag = tag.trim().toUpperCase();
    if (!ownerTagPrefix) return "Your account name is unavailable. Refresh the page and try again.";
    if (!new RegExp(`^${ownerTagPrefix}-\\d{3,}$`).test(normalizedTag)) {
      return `Use ${ownerTagPrefix}-001 format for your ear tag.`;
    }
    if ([...existingTags, ...otherTags].some((existing) => existing.trim().toUpperCase() === normalizedTag)) {
      return "This ear tag is already registered, including pending or approved records. Please change it.";
    }
    return "";
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

  const handleSidePhotoUpload = (side: AnimalSide, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Each side photo must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type.toLowerCase())) {
      toast.error("Side photos must be JPEG, PNG, or WebP images.");
      e.target.value = "";
      return;
    }

    setSidePhotoFiles((current) => ({ ...current, [side]: file }));
    const reader = new FileReader();
    reader.onload = (event) => {
      setSidePhotoPreviews((current) => ({ ...current, [side]: String(event.target?.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSidePhoto = (side: AnimalSide) => {
    setSidePhotoFiles((current) => ({ ...current, [side]: null }));
    setSidePhotoPreviews((current) => ({ ...current, [side]: "" }));
    if (sidePhotoInputRefs.current[side]) sidePhotoInputRefs.current[side]!.value = "";
  };

  const clearSidePhotos = () => {
    setSidePhotoFiles({ left: null, right: null });
    setSidePhotoPreviews({ left: "", right: "" });
    Object.values(sidePhotoInputRefs.current).forEach((input) => {
      if (input) input.value = "";
    });
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
    const clamped = Math.max(1, Math.min(newQty, 50));
    setFormData((prev) => ({ ...prev, quantity: clamped }));
    const preset = getSpeciesPreset(formData.livestockType);
    const defaultBreed = batchAnimals[0]?.breed || preset.commonBreeds?.[0] || "Standard";
    const defaultWeight = batchAnimals[0]?.weight || "65";

    setBatchAnimals((prev) => {
      const next = [...prev];
      if (clamped > next.length) {
        const usedTags = [...existingTags, ...next.map((animal) => animal.tagNumber)];
        for (let i = next.length + 1; i <= clamped; i++) {
          const tagNumber = ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, usedTags) : "";
          usedTags.push(tagNumber);
          next.push({
            id: String(i),
            tagNumber,
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
      tagNumber: ownerTagPrefix
        ? nextOwnerTag(ownerTagPrefix, [...existingTags, ...batchAnimals.map((animal) => animal.tagNumber)])
        : "",
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

  const handleClearAllBatchAnimals = () => {
    const preset = getSpeciesPreset(formData.livestockType);
    const defBreed = preset.commonBreeds?.[0] || "Standard";
    const defWeight = preset.suggestedWeightKg ? String(preset.suggestedWeightKg) : "65";
    const singleAnimal: BatchAnimalFormRow = {
      id: "1",
      tagNumber: ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, existingTags) : "",
      breed: defBreed,
      sex: "Female",
      weight: defWeight,
      lastVaccinationDate: "",
    };
    setBatchAnimals([singleAnimal]);
    setFormData((prev) => ({ ...prev, quantity: 1 }));
    toast.info("Cleared animal roster. Reset to 1 animal.");
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
    const used = [...existingTags];
    setBatchAnimals((previous) => previous.map((animal) => {
      const tagNumber = ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, used) : "";
      used.push(tagNumber);
      return { ...animal, tagNumber };
    }));
    toast.success(`Auto-generated sequential tags for ${batchAnimals.length} animals.`);
  };

  const resetBatchAnimalsToPreset = (species: string = "Swine") => {
    const preset = getSpeciesPreset(species);
    const used = [...existingTags];
    const defBreed = preset.commonBreeds?.[0] || "Standard";
    const defWeight = preset.suggestedWeightKg ? String(preset.suggestedWeightKg) : "65";
    const defaultAnimals: BatchAnimalFormRow[] = [
      { id: "1", tagNumber: "", breed: defBreed, sex: "Female", weight: defWeight, lastVaccinationDate: "" },
      { id: "2", tagNumber: "", breed: defBreed, sex: "Male", weight: defWeight, lastVaccinationDate: "" },
      { id: "3", tagNumber: "", breed: defBreed, sex: "Female", weight: defWeight, lastVaccinationDate: "" },
    ];
    setBatchAnimals(defaultAnimals.map((animal) => {
      const tagNumber = ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, used) : "";
      used.push(tagNumber);
      return { ...animal, tagNumber };
    }));
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

  // Species gate: herds keep a single species, so an individual animal may only
  // be assigned to a herd whose livestock type matches the selected species.
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
        const finalBreed = formData.isOtherBreed
          ? (formData.customBreed?.trim() || "Mixed / Crossbred")
          : (formData.breed?.trim() || "Standard");

        let response;
        if (photoFile || sidePhotoFiles.left || sidePhotoFiles.right) {
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
          if (formData.batchId) body.append("batch", String(formData.batchId));
          if (formData.avatarKey) body.append("avatar_key", formData.avatarKey);
          if (photoFile) body.append("photo", photoFile);
          if (sidePhotoFiles.left) body.append("left_side_photo", sidePhotoFiles.left);
          if (sidePhotoFiles.right) body.append("right_side_photo", sidePhotoFiles.right);

          response = await api.post("/livestock/inventory/", body, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          const payload: CreateInventoryPayload & { batch?: number; avatar_key?: string } = {
            livestock_type: typeId,
            entry_type: "INDIVIDUAL",
            quantity: 1,
            tag_number: formData.tagNumber.trim(),
            breed: finalBreed,
            sex: formData.sex,
            birth_date: formData.birthDate || null,
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
      queryClient.invalidateQueries({ queryKey: ["inventory"] }); // refresh
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] }); // refresh
      const wasBatch = formData.entryType === "BATCH";
      const registeredQty = wasBatch ? batchAnimals.length : formData.quantity;
      onOpenChange(false);
      setFormData(initialFormData);
      setPhotoFile(null);
      clearSidePhotos();

      // Clear draft on successful submission
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
      const msg =
        httpError(err)?.response?.data?.detail ||
        httpError(err)?.response?.data?.tag_number?.[0] ||
        httpError(err)?.response?.data?.animals?.[0] ||
        "Failed to add livestock entry. Please check required fields.";
      toast.error(msg);
      setFormError(msg);
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (formData.entryType === "INDIVIDUAL") {
      const earTagError = tagError(formData.tagNumber);
      if (earTagError) {
        setFormError(earTagError);
        return;
      }
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
        const otherTags = batchAnimals
          .filter((_, index) => index !== i)
          .map((animal) => animal.tagNumber);
        const earTagError = tagError(batchAnimals[i].tagNumber, otherTags);
        if (earTagError) {
          setFormError(`Animal #${i + 1}: ${earTagError}`);
          return;
        }
        if (!batchAnimals[i].tagNumber.trim()) {
          setFormError(`Ear Tag is required for Animal #${i + 1}.`);
          return;
        }
        if (!batchAnimals[i].breed.trim()) {
          setFormError(`Breed is required for Animal #${i + 1}.`);
          return;
        }
        if (batchAnimals[i].lastVaccinationDate > localCalendarDateToday()) {
          setFormError(`Vaccination date for Animal #${i + 1} cannot be in the future.`);
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
      setPhotoFile(null);
      clearSidePhotos();
      setBatchPhotoFiles([]);
      setBatchPhotoDataUrls([]);
      resetBatchAnimalsToPreset(formData.livestockType);
    }
  };

  return (
    <>
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
                Add Livestock
              </DialogTitle>
              <DialogDescription className="text-xs text-emerald-200/80 mt-0.5">
                Add an animal or a group of animals to your livestock.
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleAddSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {hasDraft && (
              <div className="p-3 sm:p-3.5 bg-emerald-50/90 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs animate-in fade-in-50 duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Check className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-emerald-950">
                        Auto-Saved Draft Active
                      </p>
                      <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                        Auto-Saved
                      </Badge>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Your inputs are automatically saved{draftSavedAt ? ` (last saved ${new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})` : ""}.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleStartFresh}
                    className="h-8 px-2.5 rounded-xl text-rose-700 hover:bg-rose-100/60 text-xs font-bold gap-1 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" /> Discard / Start Fresh
                  </Button>
                </div>
              </div>
            )}

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
                  className={`flex min-h-11 items-center justify-center gap-2 px-2 py-2.5 rounded-xl text-xs font-black transition-all ${formData.entryType === "INDIVIDUAL"
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
                  className={`flex min-h-11 items-center justify-center gap-2 px-2 py-2.5 rounded-xl text-xs font-black transition-all ${formData.entryType === "BATCH"
                    ? "bg-white text-emerald-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <Layers className="w-4 h-4 text-teal-700" />
                  Herd
                </button>
              </div>
            </div>

            {/* Species Selection with Preset Chips */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Livestock Species
                </Label>
                <InfoTooltip text="Select the animal species category (e.g. Cattle, Carabao, Swine, Goat, Sheep)." />
              </div>
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
                        if (formData.entryType === "BATCH") {
                          const defWeight = preset.suggestedWeightKg ? String(preset.suggestedWeightKg) : "65";
                          const used = [...existingTags];
                          setBatchAnimals((prev) => prev.map((animal) => {
                            const tagNumber = ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, used) : "";
                            used.push(tagNumber);
                            return { ...animal, tagNumber, breed: defBreed, weight: defWeight };
                          }));
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

            {/* CONDITIONAL FORM FIELDS BASED ON REGISTRATION MODE */}
            {formData.entryType === "INDIVIDUAL" ? (
              <div className="space-y-4">
                {/* Ear Tag / RFID Number */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label
                        htmlFor="tagNumber"
                        className="text-xs font-black uppercase tracking-wider text-slate-500"
                      >
                        Ear Tag / RFID Number
                      </Label>
                      <InfoTooltip text="Unique identification number placed on the animal's ear tag or RFID chip (e.g. YOURNAME-001)." />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          tagNumber: ownerTagPrefix ? nextOwnerTag(ownerTagPrefix, existingTags) : "",
                        })
                      }
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <Wand2 className="w-3 h-3" /> Auto-generate Tag
                    </button>
                  </div>
                  <Input
                    id="tagNumber"
                    placeholder="e.g. NAME-001"
                    value={formData.tagNumber}
                    onChange={(e) => setFormData({ ...formData, tagNumber: e.target.value.toUpperCase() })}
                    className={`h-11 rounded-xl font-mono font-bold ${tagError(formData.tagNumber) ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
                    required
                  />
                  {tagError(formData.tagNumber) ? (
                    <p className="text-xs font-medium text-rose-700" role="alert">{tagError(formData.tagNumber)}</p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Use your name followed by a number, such as {ownerTagPrefix || "YOUR-NAME"}-001. The next number is generated for you.
                    </p>
                  )}
                </div>

                {/* Animal Photo & Avatar Selector */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-emerald-700" />
                          Animal Photo & Visual Avatar
                        </Label>
                        <InfoTooltip text="Upload a clear photograph or pick an illustrated species avatar to represent this animal." />
                      </div>
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

                {/* Animal side identification photos */}
                <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-labelledby="animal-side-photos-title">
                  <div>
                    <h3 id="animal-side-photos-title" className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Left and Right Side Photos <span className="font-semibold normal-case text-slate-400">(Optional)</span>
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Add one full-body photo from each side for identification. JPEG, PNG, or WebP up to 5 MB per photo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(["left", "right"] as const).map((side) => (
                      <div key={side} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-xs font-bold capitalize text-slate-700">{side} side</Label>
                          {sidePhotoPreviews[side] && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSidePhoto(side)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 hover:underline"
                            >
                              <Trash2 className="size-3" /> Remove
                            </button>
                          )}
                        </div>
                        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white">
                          {sidePhotoPreviews[side] ? (
                            <img src={sidePhotoPreviews[side]} alt={`${side} side view preview`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-center text-slate-400">
                              <Camera className="size-7" />
                              <span className="text-[10px] font-semibold">No {side} view added</span>
                            </div>
                          )}
                        </div>
                        <input
                          ref={(input) => { sidePhotoInputRefs.current[side] = input; }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          className="hidden"
                          onChange={(event) => handleSidePhotoUpload(side, event)}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => sidePhotoInputRefs.current[side]?.click()}
                          className="w-full rounded-lg border-slate-300 text-xs font-bold"
                        >
                          <Upload className="mr-1.5 size-3.5" />
                          {sidePhotoPreviews[side] ? "Change photo" : `Add ${side} side photo`}
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Assigned Herd (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label
                        htmlFor="assignedBatch"
                        className="text-xs font-black uppercase tracking-wider text-slate-500"
                      >
                        Herd (Optional)
                      </Label>
                      <InfoTooltip text="Group this animal under an existing herd or leave blank if raised as a standalone livestock." />
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">Assign to batch</span>
                  </div>
                  <Select
                    value={formData.batchId || "none"}
                    onValueChange={(val) => setFormData({ ...formData, batchId: val === "none" ? "" : val })}
                  >
                    <SelectTrigger id="assignedBatch" className="h-11 rounded-xl">
                      <SelectValue placeholder="Standalone Animal (No Batch)" />
                    </SelectTrigger>
                    <SelectContent className="z-[var(--z-popover-dialog)]">
                      <SelectItem value="none">Standalone Animal (No Batch)</SelectItem>
                      {matchingBatches.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.batchCode} ({b.batchName || b.livestockTypeName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {userBatches.length > 0 ? (
                    matchingBatches.length > 0 ? (
                      <p className="text-[10px] font-medium text-slate-400">
                        Only {formData.livestockType} herds are listed — each herd keeps a single species.
                      </p>
                    ) : (
                      <p className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        No {formData.livestockType} herds yet. Switch to Herd mode to create one, or register this livestock as a standalone animal.
                      </p>
                    )
                  ) : null}
                </div>

                {/* Individual Breed Selection (Dropdown + Others) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label
                        htmlFor="breedSelect"
                        className="text-xs font-black uppercase tracking-wider text-slate-500"
                      >
                        Breed / Pedigree
                      </Label>
                      <InfoTooltip text="Select the official breed or choose 'Others' to specify a crossbreed or native Batangas breed." />
                    </div>
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
                    <div className="flex items-center gap-1.5">
                      <Label
                        htmlFor="sex"
                        className="text-xs font-black uppercase tracking-wider text-slate-500"
                      >
                        Sex / Gender
                      </Label>
                      <InfoTooltip text="Biological sex of the livestock (Female or Male)." />
                    </div>
                    <Select
                      value={formData.sex}
                      onValueChange={(val) => setFormData({ ...formData, sex: val })}
                    >
                      <SelectTrigger id="sex" className="h-11 rounded-xl">
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent className="z-[var(--z-popover-dialog)]">
                        <SelectItem value="Female">Female (Cow / Doe / Sow)</SelectItem>
                        <SelectItem value="Male">Male (Bull / Buck / Boar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Label
                          htmlFor="weight"
                          className="text-xs font-black uppercase tracking-wider text-slate-500"
                        >
                          Weight (kg)
                        </Label>
                        <InfoTooltip text="Live body weight of the animal in kilograms (scale or weight band estimate)." />
                      </div>
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

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="birthDate" className="text-xs font-black uppercase tracking-wider text-slate-500">Birth Date (optional)</Label>
                    <InfoTooltip text="Estimated or recorded date when the animal was born to automatically track its age." />
                  </div>
                  <Input id="birthDate" type="date" max={localCalendarDateToday()} value={formData.birthDate} onChange={(e) => setFormData((prev) => ({ ...prev, birthDate: e.target.value }))} className="h-11 min-w-0 w-full rounded-xl px-3 pr-12 text-left [&::-webkit-date-and-time-value]:min-h-[1.5rem] [&::-webkit-date-and-time-value]:text-left" />
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
                    <div className="flex items-center gap-1.5">
                      <Label
                        htmlFor="isVaccinated"
                        className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5"
                      >
                        <Syringe className="w-3.5 h-3.5 text-emerald-700" />
                        Animal has active vaccination records on file
                      </Label>
                      <InfoTooltip text="Check this box if this animal has received protective vaccinations (e.g. Hemorrhagic Septicemia, Anthrax, Hog Cholera)." />
                    </div>
                  </div>

                  {formData.isVaccinated && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Label
                          htmlFor="vaxDate"
                          className="text-xs font-black uppercase tracking-wider text-slate-500"
                        >
                          Last Vaccination Date
                        </Label>
                        <InfoTooltip text="The date when the last vaccine dose was administered to this animal." />
                      </div>
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
                          Herd Profile
                        </Label>
                        <p className="text-[11px] text-slate-500">
                          Assign an identifiable herd name and housing details
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-bold">
                      Group Enrollment
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Herd Name */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="batchName" className="text-xs font-black uppercase tracking-wider text-slate-600">
                            Herd Name <span className="text-rose-500">*</span>
                          </Label>
                          <InfoTooltip text="Descriptive name or identifier for this herd (e.g. Pen 3 Fattening Swine, Batangas Cattle Lot A)." />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              batchName: `${prev.livestockType} Herd #${Math.floor(100 + Math.random() * 900)}`,
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
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="housingPen" className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                          Housing Pen / Facility
                        </Label>
                        <InfoTooltip text="The physical barn, paddock, corral, or pen number where this herd is housed." />
                      </div>
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="feedType" className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                            Feed Formulation / Rations
                          </Label>
                          <InfoTooltip text="Primary diet or feed formula provided to this herd (e.g., Napier Grass, Starter Mash, Concentrates)." />
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Optional · {currentPreset?.name} suggestions
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1">
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
                            <SelectTrigger id="feedType" className="h-9.5 rounded-xl bg-white text-xs font-medium">
                              <SelectValue placeholder="Select a common feed formulation (optional)..." />
                            </SelectTrigger>
                            <SelectContent className="z-[var(--z-popover-dialog)] rounded-xl max-h-60">
                              <SelectItem value="NOT_SPECIFIED" className="text-xs text-slate-500">
                                Not specified
                              </SelectItem>
                              {currentPreset?.commonFeeds?.map((f) => (
                                <SelectItem key={f} value={f} className="text-xs">
                                  {f}
                                </SelectItem>
                              ))}
                              <SelectItem value="OTHER" className="text-xs font-bold text-emerald-800">
                                ➕ Others (Specify custom feed)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {formData.isOtherFeed ? (
                          <div className="flex-1 animate-in fade-in-50 duration-200">
                            <Input
                              id="customFeed"
                              maxLength={100}
                              placeholder="e.g. Finisher Pellets, Napier Grass"
                              value={formData.customFeed}
                              onChange={(e) => setFormData({ ...formData, customFeed: e.target.value })}
                              className="h-9.5 rounded-xl bg-white text-xs"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Herd Group Cover & Gallery Photos Upload */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-emerald-700" />
                          Herd Photos (Optional)
                          <InfoTooltip text="Upload multiple pictures of the herd, pen, grazing area, or different angles for complete visual documentation." />
                        </Label>
                        <p className="text-[11px] text-slate-500">
                          Attach photos of this herd, housing pen, or grazing area (supports multiple photos).
                        </p>
                      </div>
                      {batchPhotoDataUrls.length > 0 ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                          {batchPhotoDataUrls.length} Photo{batchPhotoDataUrls.length > 1 ? "s" : ""} Attached
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-medium">
                          No Photos
                        </Badge>
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

                    {batchPhotoDataUrls.length > 0 ? (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-0.5">
                          {batchPhotoDataUrls.map((url, idx) => (
                            <div
                              key={url}
                              className="relative size-18 rounded-2xl overflow-hidden border-2 border-emerald-600/80 shadow-xs group shrink-0"
                            >
                              <img
                                src={url}
                                alt={`Herd photo #${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute top-1 left-1 px-1.5 py-0.2 rounded-md bg-black/70 text-white font-bold text-[9px] backdrop-blur-xs">
                                {idx === 0 ? "Cover" : `#${idx + 1}`}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSingleBatchPhoto(idx)}
                                className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold cursor-pointer"
                                title={`Remove photo #${idx + 1}`}
                              >
                                <Trash2 className="w-4 h-4 text-rose-300" />
                              </button>
                            </div>
                          ))}

                          {batchPhotoDataUrls.length < 10 && (
                            <button
                              type="button"
                              onClick={() => batchFileInputRef.current?.click()}
                              className="size-18 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 flex flex-col items-center justify-center gap-1 transition-colors shrink-0 cursor-pointer"
                              title="Add more photos"
                            >
                              <Plus className="size-4.5" />
                              <span className="text-[9px] font-bold">Add More</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-100">
                          <span>Hover over any photo to remove it. First image serves as the herd cover.</span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={handleRemoveAllBatchPhotos}
                              className="h-6 px-2 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold cursor-pointer"
                            >
                              Clear All ({batchPhotoDataUrls.length})
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => batchFileInputRef.current?.click()}
                              className="h-7 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold gap-1 shadow-xs cursor-pointer"
                            >
                              <Upload className="size-3" /> Add Photos
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3.5 p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-xs">
                        <div className="size-16 rounded-2xl flex flex-col items-center justify-center bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400 shrink-0">
                          <Camera className="size-6 text-slate-400" />
                          <span className="text-[9px] font-bold uppercase mt-0.5">Herd</span>
                        </div>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => batchFileInputRef.current?.click()}
                              className="h-8 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Upload Herd Photos
                            </Button>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Upload one or multiple photos (JPG, PNG, WebP up to 5MB each). You can attach up to 10 photos.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Batch Head Count Stepper & Quick Chips */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-600">
                        Herd Size
                      </Label>
                      <InfoTooltip text="Total number of animals in this herd. Changing this automatically updates the individual animal roster rows below." />
                    </div>
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

                {/* Interactive Herd Individual Animals Roster Editor */}
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-700" />
                          Individual Livestock in Batch ({batchAnimals.length} heads)
                        </h4>
                        <InfoTooltip text="Roster of all animals within this herd. Each animal gets an individual tag, sex, breed, and vaccination record." />
                      </div>
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
                        onClick={syncVaccinationDateToAllAnimals}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 bg-white hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors shadow-xs"
                        title="Applies the vaccination date from Animal #1 to every animal in this batch"
                      >
                        Sync Vaccination Date #1
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
                      {batchAnimals.length > 1 && (
                        <button
                          type="button"
                          onClick={handleClearAllBatchAnimals}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Clear all animals and reset roster to 1 animal"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600" />
                          Clear All ({batchAnimals.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                        title="Draft saves automatically as you type. Click to save now."
                      >
                        {autoSaveStatus === "saving" ? (
                          <>
                            <Sparkles className="w-3 h-3 text-amber-600 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{hasDraft ? "Auto-Saved" : "Save Draft"}</span>
                          </>
                        )}
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
                  <div className="h-72 sm:h-80 overflow-y-auto p-3 space-y-3 rounded-2xl border-2 border-emerald-600/25 bg-slate-100/90 shadow-inner [scrollbar-width:thin] [scrollbar-color:#059669_#cbd5e1] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-slate-200/90 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-600 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-emerald-700">
                    {batchAnimals.map((animal, idx) => (
                      <div
                        key={animal.id || idx}
                        className="p-3.5 bg-white rounded-xl border border-slate-200/90 border-l-4 border-l-emerald-600 shadow-sm space-y-3 hover:border-emerald-400 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="size-6 rounded-full bg-emerald-700 text-white font-black text-xs flex items-center justify-center shadow-xs">
                              #{idx + 1}
                            </span>
                            <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {animal.tagNumber || `Animal #${idx + 1}`}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold uppercase py-0.5 px-2 ${animal.sex === "Female"
                                ? "text-rose-700 bg-rose-50 border-rose-200 font-black"
                                : animal.sex === "Male"
                                  ? "text-blue-700 bg-blue-50 border-blue-200 font-black"
                                  : "text-amber-700 bg-amber-50 border-amber-200 font-black"
                                }`}
                            >
                              {animal.sex}
                            </Badge>
                          </div>

                          {batchAnimals.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBatchAnimalRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove this animal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                Ear Tag / RFID
                              </Label>
                              <InfoTooltip text="Unique identification tag or RFID for this individual animal in the herd." />
                            </div>
                            <Input
                              value={animal.tagNumber}
                              onChange={(e) => updateBatchAnimalField(idx, "tagNumber", e.target.value.toUpperCase())}
                              placeholder="e.g. NAME-001"
                              className={`h-8 text-xs font-mono font-bold rounded-lg border-slate-300 bg-white ${tagError(animal.tagNumber, batchAnimals.filter((_, index) => index !== idx).map((row) => row.tagNumber)) ? "border-rose-500" : ""}`}
                              required
                            />
                            {tagError(animal.tagNumber, batchAnimals.filter((_, index) => index !== idx).map((row) => row.tagNumber)) && (
                              <p className="text-[10px] font-medium text-rose-700" role="alert">
                                {tagError(animal.tagNumber, batchAnimals.filter((_, index) => index !== idx).map((row) => row.tagNumber))}
                              </p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                Breed / Strain
                              </Label>
                              <InfoTooltip text="Breed or pedigree strain of this animal." />
                            </div>
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
                              <SelectTrigger className="h-8 text-xs rounded-lg bg-white border-slate-300">
                                <SelectValue placeholder="Breed" />
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
                            {(!currentPreset?.commonBreeds?.includes(animal.breed) || animal.breed === "Others") && (
                              <Input
                                value={animal.breed === "Others" ? "" : animal.breed}
                                onChange={(e) => updateBatchAnimalField(idx, "breed", e.target.value || "Others")}
                                placeholder="Type custom breed"
                                className="h-7 text-[11px] rounded-lg mt-1 bg-white border-emerald-400 font-medium"
                                required
                              />
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                Sex
                              </Label>
                              <InfoTooltip text="Sex of this individual animal (Female, Male, or Castrated)." />
                            </div>
                            <Select
                              value={animal.sex}
                              onValueChange={(val) => { if (val === "Male" || val === "Female") updateBatchAnimalField(idx, "sex", val); }}
                            >
                              <SelectTrigger className="h-8 text-xs rounded-lg bg-white border-slate-300">
                                <SelectValue placeholder="Sex" />
                              </SelectTrigger>
                              <SelectContent className="z-[var(--z-popover-dialog)]">
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Castrated">Castrated / Barrow</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                Weight (kg)
                              </Label>
                              <InfoTooltip text="Weight in kg for this individual animal." />
                            </div>
                            <Input
                              type="number"
                              step="0.1"
                              value={animal.weight}
                              onChange={(e) => updateBatchAnimalField(idx, "weight", e.target.value)}
                              placeholder="e.g. 65"
                              className="h-8 text-xs font-semibold rounded-lg bg-white border-slate-300"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">Birth Date (optional)</Label>
                              <InfoTooltip text="Birth date of this animal to track its age." />
                            </div>
                            <Input type="date" max={localCalendarDateToday()} value={animal.birthDate || ""} onChange={(e) => updateBatchAnimalField(idx, "birthDate", e.target.value)} className="h-11 min-w-0 w-full text-xs rounded-lg bg-white border-slate-300" />
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                          <span className="text-[11px] text-slate-600 font-bold flex items-center gap-1.5">
                            <Syringe className="w-3.5 h-3.5 text-emerald-700" /> Vaccination Date (optional):
                            <InfoTooltip text="Date this member received its most recent vaccination dose." />
                          </span>
                          <Input
                            type="date"
                            max={localCalendarDateToday()}
                            value={animal.lastVaccinationDate}
                            onChange={(e) =>
                              updateBatchAnimalField(idx, "lastVaccinationDate", e.target.value)
                            }
                            className="h-7 w-36 text-[11px] rounded-lg py-0 px-2 bg-white border-slate-300 text-slate-800"
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
                Preview
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
                <div className="flex items-center gap-3">
                  {batchPhotoDataUrls.length > 0 ? (
                    <div className="relative size-12 rounded-xl overflow-hidden border border-emerald-300 shadow-2xs shrink-0 group">
                      <img
                        src={batchPhotoDataUrls[0]}
                        alt="Herd cover preview"
                        className="w-full h-full object-cover"
                      />
                      {batchPhotoDataUrls.length > 1 && (
                        <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] font-bold text-white text-center py-0.2">
                          +{batchPhotoDataUrls.length - 1}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="size-11 rounded-xl flex items-center justify-center bg-teal-100 text-teal-800 border border-teal-200 shadow-2xs shrink-0">
                      <Layers className="size-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between font-bold text-emerald-950">
                      <span className="text-sm font-black flex items-center gap-1.5 truncate">
                        Herd: {batchAnimals.length} Heads of {formData.livestockType}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {batchPhotoDataUrls.length > 0 && (
                          <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-[9px] font-semibold">
                            📷 {batchPhotoDataUrls.length} photo{batchPhotoDataUrls.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                        <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px]">
                          Batch Entry
                        </Badge>
                      </div>
                    </div>
                    <p className="text-slate-600 mt-0.5 font-medium truncate">
                      Avg Weight: <strong>~{batchMetrics.avgWeight} kg</strong> • Biomass: <strong>~{batchMetrics.totalWeight} kg</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                      Tags: {batchAnimals.slice(0, 4).map((a) => a.tagNumber || "unassigned").join(", ")}
                      {batchAnimals.length > 4 ? ` +${batchAnimals.length - 4} more` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 p-4 sm:p-5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2.5 flex-wrap">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleStartFresh}
                className="h-9 px-2.5 rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold gap-1.5 cursor-pointer border border-slate-200 hover:border-rose-200 transition-colors"
                title="Clear all fields, photos, and discard draft"
              >
                <Trash2 className="size-3.5 text-slate-400" />
                Clear All
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
                    <span className="text-[11px] font-normal text-slate-500">
                      ({new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">Auto-saves as you type</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
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
                {addMutation.isPending ? "Submitting..." : "Submit for Review"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
