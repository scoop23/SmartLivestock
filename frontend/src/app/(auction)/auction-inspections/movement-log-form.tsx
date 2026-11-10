"use client";

import { LivestockIdentityResult } from "@/components/livestock-identity-result";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import axios from "axios";
import { cowHead } from "@lucide/lab";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Icon,
  Info,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  Save,
  Search,
  Send,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

const CowHeadIcon = ({ className }: { className?: string }) => (
  <Icon iconNode={cowHead} className={className} />
);
import { useRouter } from "next/navigation";
import { useEffect,useMemo,useRef,useState } from "react";
import { createInspection,InspectionRecord,lookupRegisteredLivestock,RegisteredAnimalOption,RegisteredShipperOption,searchRegisteredShippers,updateInspection } from "./auction-analytics";
import { MovementLivestockQrDialog } from "./movement-livestock-qr-dialog";

interface NewInspectionFormProps {
  onSubmitSuccess: () => void;
  inspectionToEdit?: InspectionRecord | null;
  onCancel?: () => void;
  inspectionCount?: number;
  onDraftStatusChange?: (status: "checking" | "prompt" | "ready" | "saving" | "saved" | "error") => void;
}

interface LivestockTypeOption {
  id: number;
  name: string;
}

interface MovementItemDraft {
  livestock_type: number;
  inventory?: number | null;
  quantity: number;
  sex: "MALE" | "FEMALE" | "MIXED";
  classification: "SLAUGHTER" | "BREEDER" | "FATTENING" | "OTHER";
  remarks: string;
}

interface MovementDraft {
  shipperName: string;
  shipperId: number | null;
  shipperAddress: string;
  origin: string;
  destination: string;
  purpose: "SLAUGHTER" | "BREEDING" | "FATTENING" | "OTHER";
  inspectionDate: string;
  plateNumber: string;
  handlerLicense: string;
  items: MovementItemDraft[];
  selectedAnimals: RegisteredAnimalOption[];
}

const DRAFT_KEY_PREFIX = "smartlivestock:auction:movement-draft:v1";
const clearLocalDraft = (key: string) => {
  try { window.localStorage.removeItem(key); } catch { /* Storage may be disabled by the browser. */ }
};
const createInitialItems = (livestockType = 0): MovementItemDraft[] => [{
  livestock_type: livestockType,
  quantity: 1,
  sex: "MALE",
  classification: "SLAUGHTER",
  remarks: "",
}];

export function NewInspectionForm({
  onSubmitSuccess,
  inspectionToEdit,
  onCancel,
  inspectionCount,
  onDraftStatusChange,
}: NewInspectionFormProps) {
  // Form state represents one inspection and its many livestock lines. Browser
  // drafts are recovery only; create/update APIs persist the actual movement.
  const router = useRouter();
  const { user } = useAuth();
  const draftKey = `${DRAFT_KEY_PREFIX}:${user?.email || "auction-user"}`;
  const [shipperName, setShipperName] = useState(inspectionToEdit?.shipper_name || "");
  const [shipperId, setShipperId] = useState<number | null>(inspectionToEdit?.shipper || null);
  const [shipperOptions, setShipperOptions] = useState<RegisteredShipperOption[]>([]);
  const [selectedAnimals, setSelectedAnimals] = useState<RegisteredAnimalOption[]>(
    inspectionToEdit?.items.filter((item) => item.inventory).map((item) => ({
      id: Number(item.inventory),
      tag_number: item.inventory_tag || String(item.inventory),
      livestock_type: Number(item.livestock_type),
      livestock_type_name: item.livestock_type_name || "",
    })) || []
  );
  const [shipperAddress, setShipperAddress] = useState(inspectionToEdit?.shipper_address || "");
  const [origin, setOrigin] = useState(inspectionToEdit?.origin || "");
  const [destination, setDestination] = useState(inspectionToEdit?.destination || "");
  const [purpose, setPurpose] = useState<"SLAUGHTER" | "BREEDING" | "FATTENING" | "OTHER">(inspectionToEdit?.purpose === "UNKNOWN" ? "OTHER" : inspectionToEdit?.purpose || "SLAUGHTER");
  const [inspectionDate, setInspectionDate] = useState(
    inspectionToEdit?.inspection_date || new Date().toISOString().split("T")[0]
  );
  const [plateNumber, setPlateNumber] = useState(inspectionToEdit?.vehicle_plate_number || "");
  const [handlerLicense, setHandlerLicense] = useState(inspectionToEdit?.livestock_handler_license_no || "");
  const [speciesOptions, setSpeciesOptions] = useState<LivestockTypeOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lookupCodes, setLookupCodes] = useState<string[]>([]);
  const [lookupIndex, setLookupIndex] = useState<number | null>(null);
  const [lookupResult, setLookupResult] = useState<{ index: number; animal: Awaited<ReturnType<typeof lookupRegisteredLivestock>> } | null>(null);
  const [lookupAddError, setLookupAddError] = useState("");

  const [items, setItems] = useState<MovementItemDraft[]>(inspectionToEdit ? inspectionToEdit.items.map((item) => ({
    livestock_type: Number(item.livestock_type),
    inventory: item.inventory || null,
    quantity: item.quantity,
    sex: item.sex,
    classification: item.classification,
    remarks: item.remarks || "",
  })) : createInitialItems());
  const [draftStatus, setDraftStatus] = useState<"checking" | "prompt" | "ready" | "saving" | "saved" | "error">(inspectionToEdit ? "ready" : "checking");
  const [storedDraft, setStoredDraft] = useState<MovementDraft | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrItemIndex, setQrItemIndex] = useState(0);
  const draftRef = useRef<MovementDraft | null>(null);

  const draft: MovementDraft = useMemo(() => ({
    shipperName, shipperId, shipperAddress, origin, destination, purpose,
    inspectionDate, plateNumber, handlerLicense, items, selectedAnimals,
  }), [shipperName, shipperId, shipperAddress, origin, destination, purpose,
    inspectionDate, plateNumber, handlerLicense, items, selectedAnimals]);

  const hasMeaningfulData = useMemo(() => Boolean(
    shipperName.trim() || shipperId || shipperAddress.trim() || origin.trim() ||
    destination.trim() || purpose !== "SLAUGHTER" || plateNumber.trim() ||
    handlerLicense.trim() || items.length > 1 || items.some((item) =>
      item.inventory || item.quantity !== 1 || item.remarks.trim() ||
      item.sex !== "MALE" || item.classification !== "SLAUGHTER" ||
      (speciesOptions[0] && item.livestock_type !== speciesOptions[0].id)
    )
  ), [shipperName, shipperId, shipperAddress, origin, destination, purpose,
    plateNumber, handlerLicense, items, speciesOptions]);

  useEffect(() => {
    if (onDraftStatusChange) {
      onDraftStatusChange(draftStatus);
    }
  }, [draftStatus, onDraftStatusChange]);

  useEffect(() => {
    if (inspectionToEdit) return;
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(draftKey);
        if (raw) {
          const saved = JSON.parse(raw) as MovementDraft;
          if (saved && Array.isArray(saved.items) && saved.items.length) {
            setStoredDraft(saved);
            setDraftStatus("prompt");
            return;
          }
        }
        setDraftStatus("ready");
      } catch {
        clearLocalDraft(draftKey);
        setDraftStatus("ready");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey, inspectionToEdit]);

  useEffect(() => {
    draftRef.current = draft;
    if (inspectionToEdit || draftStatus === "checking" || draftStatus === "prompt") return;
    if (!hasMeaningfulData) {
      clearLocalDraft(draftKey);
      return;
    }
    const savingTimer = window.setTimeout(() => setDraftStatus("saving"), 0);
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftStatus("saved");
      } catch {
        setDraftStatus("error");
      }
    }, 450);
    return () => {
      window.clearTimeout(savingTimer);
      window.clearTimeout(timer);
    };
  }, [draft, draftKey, draftStatus, hasMeaningfulData, inspectionToEdit]);

  useEffect(() => {
    if (inspectionToEdit || !hasMeaningfulData) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      try {
        if (draftRef.current) window.localStorage.setItem(draftKey, JSON.stringify(draftRef.current));
      } catch { /* Leave the browser warning available if local storage is full or blocked. */ }
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmLinkNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.href === window.location.href) return;
      if (!window.confirm("Leave this movement log? Your draft is saved locally and will be available when you return.")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (draftRef.current) {
        try { window.localStorage.setItem(draftKey, JSON.stringify(draftRef.current)); } catch { /* Keep navigation available if storage is full. */ }
      }
    };
    const confirmAppNavigation = (event: Event) => {
      if (!window.confirm("Leave this movement log? Your draft is saved locally and will be available when you return.")) {
        event.preventDefault();
      } else if (draftRef.current) {
        try { window.localStorage.setItem(draftKey, JSON.stringify(draftRef.current)); } catch { /* Keep navigation available if storage is full. */ }
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", confirmLinkNavigation, true);
    window.addEventListener("smartlivestock:guard-navigation", confirmAppNavigation);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", confirmLinkNavigation, true);
      window.removeEventListener("smartlivestock:guard-navigation", confirmAppNavigation);
    };
  }, [draftKey, hasMeaningfulData, inspectionToEdit]);

  // Load available livestock types from backend
  useEffect(() => {
    async function loadTypes() {
      try {
        const res = await api.get<LivestockTypeOption[]>("/livestock/livestock_types/");
        if (Array.isArray(res.data) && res.data.length > 0) {
          const allowedTypes = res.data.filter(type => !/swine|pig|hog|baboy/i.test(type.name));
          setSpeciesOptions(allowedTypes);
          if (!inspectionToEdit) {
            setItems((prev) => prev.map((it) => ({
              ...it, livestock_type: it.livestock_type || allowedTypes[0]?.id || 0,
            })));
          }
        }
      } catch {
        setErrorMsg("Livestock species could not be loaded. Please try again.");
      }
    }
    loadTypes();
  }, [inspectionToEdit]);


  useEffect(() => {
    if (shipperId || shipperName.trim().length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      searchRegisteredShippers(shipperName.trim())
        .then((matches) => { if (active) setShipperOptions(matches); })
        .catch(() => { if (active) setShipperOptions([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [shipperId, shipperName]);

  const selectShipper = (shipper: RegisteredShipperOption) => {
    setShipperId(shipper.id);
    setShipperName(shipper.name);
    setShipperAddress(shipper.address);
    if (!origin) setOrigin(shipper.address);
    setSelectedAnimals(shipper.animals);
    setShipperOptions([]);
    setItems((previous) => previous.map((item) => ({ ...item, inventory: null })));
  };

  const selectAnimal = (index: number, animalId: number | null) => {
    const animal = selectedAnimals.find((option) => option.id === animalId);
    setItems((previous) => previous.map((item, itemIndex) => itemIndex === index
      ? { ...item, inventory: animal?.id || null,
          livestock_type: animal?.livestock_type || item.livestock_type,
          quantity: animal ? 1 : item.quantity }
      : item));
  };

  const addRegisteredAnimal = (animal: Awaited<ReturnType<typeof lookupRegisteredLivestock>>, index: number) => {
    // Treat lookup data as current identity, but enforce server-reported eligibility
    // and keep each movement line linked to the existing inventory primary key.
    if (!animal.eligible) {
      return animal.ineligibility_reason || "This livestock is not eligible to be linked.";
    }
    if (shipperId && shipperId !== animal.owner_id) {
      return "This animal belongs to a different shipper. Create a separate movement log for that shipper.";
    }
    if (items.some((item, itemIndex) => itemIndex !== index && item.inventory === animal.id)) {
      return "This registered animal is already included in another line.";
    }
    setShipperId(animal.owner_id);
    setShipperName(animal.owner_name);
    setShipperAddress(animal.origin);
    if (!origin) setOrigin(animal.origin);
    setSelectedAnimals((previous) => previous.some((entry) => entry.id === animal.id) ? previous : [...previous, animal]);
    setItems((previous) => previous.map((item, itemIndex) => itemIndex === index
      ? { ...item, inventory: animal.id, livestock_type: animal.livestock_type, quantity: 1, sex: animal.sex === "MALE" || animal.sex === "FEMALE" ? animal.sex : "MIXED" }
      : item));
    return null;
  };

  const handleLivestockLookup = async (index: number) => {
    const code = lookupCodes[index]?.trim();
    if (!code) return;
    setLookupIndex(index);
    setErrorMsg(null);
    setLookupResult(null);
    setLookupAddError("");
    try {
      const animal = await lookupRegisteredLivestock(code);
      setLookupResult({ index, animal });
    } catch (error: unknown) {
      const responseData = axios.isAxiosError(error) ? error.response?.data as Record<string, unknown> | undefined : undefined;
      setErrorMsg(typeof responseData?.detail === "string" ? responseData.detail : "Could not find an eligible registered animal for that tag or ID.");
    } finally {
      setLookupIndex(null);
    }
  };

  const restoreDraft = () => {
    if (!storedDraft) return;
    setShipperName(storedDraft.shipperName || "");
    setShipperId(storedDraft.shipperId || null);
    setShipperAddress(storedDraft.shipperAddress || "");
    setOrigin(storedDraft.origin || "");
    setDestination(storedDraft.destination || "");
    setPurpose(storedDraft.purpose || "SLAUGHTER");
    setInspectionDate(storedDraft.inspectionDate || new Date().toISOString().slice(0, 10));
    setPlateNumber(storedDraft.plateNumber || "");
    setHandlerLicense(storedDraft.handlerLicense || "");
    setItems(storedDraft.items || createInitialItems());
    setSelectedAnimals(storedDraft.selectedAnimals || []);
    setStoredDraft(null);
    setDraftStatus("ready");
  };

  const startNewDraft = () => {
    if (!window.confirm("Discard the saved movement log draft and start a new one?")) return;
    clearLocalDraft(draftKey);
    setStoredDraft(null);
    setDraftStatus("ready");
  };

  const cancelForm = () => {
    if (hasMeaningfulData && !window.confirm("Discard this movement log? Its local draft will be cleared.")) return;
    clearLocalDraft(draftKey);
    if (onCancel) onCancel();
    else router.push("/auction-inspections");
  };

  const handleAddItem = () => {
    const defaultTypeId = speciesOptions[0]?.id || 0;
    setItems((prev) => [
      ...prev,
      {
        livestock_type: defaultTypeId,
        quantity: 1,
        sex: "MIXED",
        classification: "SLAUGHTER",
        remarks: "",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setLookupResult(null);
    setLookupAddError("");
    setLookupCodes((previous) => previous.filter((_, i) => i !== index));
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (
    index: number,
    field: "livestock_type" | "quantity" | "sex" | "classification" | "remarks",
    value: number | string
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "livestock_type" || field === "quantity") updated[index].inventory = null;
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setShowSubmitConfirmation(true);
  };

  const submitInspection = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Nested item lines are sent with the inspection in one request. A registered
      // line carries inventory ID; an external line carries null and manual details.
      const payload = {
        shipper: shipperId,
        shipper_name: shipperName.trim(),
        shipper_address: shipperAddress.trim(),
        origin: origin.trim(),
        destination: destination.trim(),
        purpose: purpose,
        inspection_date: inspectionDate,
        vehicle_plate_number: plateNumber.trim(),
        livestock_handler_license_no: handlerLicense.trim(),
        items: items.map((it) => ({
          livestock_type: Number(it.livestock_type),
          inventory: it.inventory || null,
          quantity: Number(it.quantity),
          sex: it.sex,
          classification: it.classification,
          remarks: it.remarks.trim(),
        })),
      };
      if (inspectionToEdit) {
        await updateInspection(inspectionToEdit.id, payload);
      } else {
        // The backend serializer creates inspection, item rows and pending clearance
        // atomically; the Auction Officer submits it for MAO review here.
        await createInspection(payload);
        clearLocalDraft(draftKey);
      }

      onSubmitSuccess();
      setShowSubmitConfirmation(false);
      setSubmitted(true);
    } catch (err: unknown) {
      const respData = axios.isAxiosError(err) ? err.response?.data as Record<string, unknown> | undefined : undefined;
      if (typeof respData === "object" && respData !== null) {
        const firstErrorKey = Object.keys(respData)[0];
        const val = respData[firstErrorKey];
        setErrorMsg(Array.isArray(val) ? val[0] : String(val));
      } else {
        setErrorMsg("Failed to save the auction record. Please check your connection.");
      }
      setShowSubmitConfirmation(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Line item builder state for adding/editing a line matching mockup
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [lineSpecies, setLineSpecies] = useState<number>(0);
  const [lineQuantity, setLineQuantity] = useState<number>(1);
  const [lineSex, setLineSex] = useState<"MALE" | "FEMALE" | "MIXED">("MALE");
  const [lineClassification, setLineClassification] = useState<"SLAUGHTER" | "BREEDER" | "FATTENING" | "OTHER">("SLAUGHTER");
  const [lineRemarks, setLineRemarks] = useState<string>("");

  useEffect(() => {
    if (speciesOptions.length > 0 && !lineSpecies) {
      setLineSpecies(speciesOptions[0].id);
    }
  }, [speciesOptions, lineSpecies]);

  const handleStartAddLine = () => {
    setEditingLineIndex(null);
    setLineSpecies(speciesOptions[0]?.id || 0);
    setLineQuantity(1);
    setLineSex("MALE");
    setLineClassification("SLAUGHTER");
    setLineRemarks("");
  };

  const handleEditLine = (index: number) => {
    const item = items[index];
    if (!item) return;
    setEditingLineIndex(index);
    setLineSpecies(item.livestock_type);
    setLineQuantity(item.quantity);
    setLineSex(item.sex);
    setLineClassification(item.classification);
    setLineRemarks(item.remarks || "");
  };

  const handleSaveLine = () => {
    const effectiveSpecies = lineSpecies || speciesOptions[0]?.id || 0;
    if (editingLineIndex !== null) {
      setItems((prev) => {
        const next = [...prev];
        next[editingLineIndex] = {
          ...next[editingLineIndex],
          livestock_type: effectiveSpecies,
          quantity: lineQuantity,
          sex: lineSex,
          classification: lineClassification,
          remarks: lineRemarks.trim(),
        };
        return next;
      });
      toast.success(`Livestock line #${editingLineIndex + 1} updated.`);
      setEditingLineIndex(null);
    } else {
      setItems((prev) => [
        ...prev,
        {
          livestock_type: effectiveSpecies,
          quantity: lineQuantity,
          sex: lineSex,
          classification: lineClassification,
          remarks: lineRemarks.trim(),
        },
      ]);
      toast.success("Livestock line added to list.");
    }
    setLineQuantity(1);
    setLineRemarks("");
  };

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-4 py-10 sm:px-6">
        <section role="status" aria-live="polite" className="w-full rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-lg sm:p-10">
          <div className="mx-auto flex size-20 animate-[bounce_700ms_ease-in-out_1] items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-11" />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Submission complete</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">{inspectionToEdit ? "Correction sent to MAO" : "Movement log sent to MAO"}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            {inspectionToEdit
              ? "Your corrected movement details are now waiting for MAO review."
              : "Your movement details are now waiting for MAO review. You can check their status in the movement logs."}
          </p>
          <Button type="button" onClick={() => router.replace("/auction-inspections")} className="mt-7 min-h-11 rounded-xl bg-[#0F5A38] px-6 font-bold text-white hover:bg-[#0c482d]">
            Back to movement logs
          </Button>
        </section>
      </main>
    );
  }

  if (draftStatus === "checking") {
    return <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center p-5 text-sm font-semibold text-slate-500">Checking for a saved movement log…</main>;
  }

  if (draftStatus === "prompt") {
    return (
      <main className="w-full px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Unfinished movement log found</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">Your previous draft was saved locally.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Continue where you left off, or discard this saved draft and start fresh. No movement record exists until you submit to MAO.</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={startNewDraft} className="min-h-11 rounded-xl">Start New</Button>
            <Button type="button" onClick={restoreDraft} className="min-h-11 rounded-xl bg-[#0F5A38] text-white hover:bg-[#0c482d]">Continue Draft</Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* Draft Auto-save Indicator (Fallback if parent does not render it) */}
      {!inspectionToEdit && !onDraftStatusChange && (
        <div className="flex justify-end -mb-2">
          <div aria-live="polite" className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-2xs">
            {draftStatus === "saving" ? (
              <><Save className="size-3.5 animate-pulse text-amber-600" /> Saving draft…</>
            ) : draftStatus === "error" ? (
              <><AlertCircle className="size-3.5 text-rose-600" /> Local draft error</>
            ) : (
              <><Save className="size-3.5 text-emerald-600" /> Draft saved locally</>
            )}
          </div>
        </div>
      )}

      {/* 3-Step Horizontal Progress Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Step 1: Movement Information */}
          <div className="flex flex-1 items-center gap-3.5 rounded-xl border border-[#BEE1C6] bg-[#EAF5EC] p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0F4A2F] text-sm font-bold text-white shadow-xs">
              1
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">Movement Information</h2>
              <p className="text-xs text-slate-600 leading-tight">
                Enter shipper and movement details.
              </p>
            </div>
          </div>

          <ChevronRight className="size-5 shrink-0 text-slate-400 hidden md:block" aria-hidden="true" />

          {/* Step 2: Livestock Details */}
          <div className="flex flex-1 items-center gap-3.5 rounded-xl p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#D7EEDD] text-sm font-bold text-[#0F4A2F]">
              2
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">Livestock Details</h2>
              <p className="text-xs text-slate-600 leading-tight">
                Add and review livestock to be moved.
              </p>
            </div>
          </div>

          <ChevronRight className="size-5 shrink-0 text-slate-400 hidden md:block" aria-hidden="true" />

          {/* Step 3: Review & Submit */}
          <div className="flex flex-1 items-center gap-3.5 rounded-xl p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#D7EEDD] text-sm font-bold text-[#0F4A2F]">
              3
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">Review &amp; Submit</h2>
              <p className="text-xs text-slate-600 leading-tight">
                Confirm details and submit to MAO.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 2-Column Main Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT CARD: 1. Shipper & Movement Information (lg:col-span-5) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#EAF5EC] text-[#1E4D2B] flex items-center justify-center shrink-0 shadow-2xs">
                <Truck className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-tight">1. Shipper &amp; Movement Information</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter the shipper&apos;s details and movement information.</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Shipper Name <span className="text-rose-500">*</span></label>
                  <Input
                    placeholder="Juan Dela Cruz"
                    value={shipperName}
                    onChange={(e) => {
                      setShipperName(e.target.value);
                      setShipperId(null);
                      setShipperOptions([]);
                      setSelectedAnimals([]);
                      setItems((previous) => previous.map((item) => ({ ...item, inventory: null })));
                    }}
                    required
                    className="h-10 rounded-xl bg-white border-slate-200 text-xs text-slate-800"
                  />
                  {shipperId ? (
                    <p className="text-[10px] text-emerald-800 font-semibold">
                      Linked to registered farmer #{shipperId}
                      <button
                        type="button"
                        className="ml-2 underline text-rose-600"
                        onClick={() => {
                          setShipperId(null);
                          setSelectedAnimals([]);
                          setItems((previous) => previous.map((item) => ({ ...item, inventory: null })));
                        }}
                      >
                        Unlink
                      </button>
                    </p>
                  ) : shipperOptions.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xs p-1">
                      {shipperOptions.map((shipper) => (
                        <button
                          key={shipper.id}
                          type="button"
                          onClick={() => selectShipper(shipper)}
                          className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-emerald-50 transition-colors"
                        >
                          <span className="font-bold text-slate-900">{shipper.name}</span>
                          <span className="block text-[11px] text-slate-500">{shipper.address}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Purpose <span className="text-rose-500">*</span></label>
                  <Select value={purpose} onValueChange={value => setPurpose(value as "SLAUGHTER" | "BREEDING" | "FATTENING" | "OTHER")}>
                    <SelectTrigger aria-label="Movement purpose" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0F4A2F]"><SelectValue placeholder="Select movement purpose" /></SelectTrigger>
                    <SelectContent className="z-[var(--z-popover-dialog)] rounded-xl">
                      <SelectItem value="SLAUGHTER">Slaughter (Katayan)</SelectItem>
                      <SelectItem value="BREEDING">Breeding (Palahi)</SelectItem>
                      <SelectItem value="FATTENING">Fattening (Papatabain)</SelectItem>
                      <SelectItem value="OTHER">Other Purpose</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Destination <span className="text-rose-500">*</span></label>
                <Input
                  placeholder="Batangas City Slaughterhouse"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  className="h-10 rounded-xl bg-white border-slate-200 text-xs text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Inspection Date <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    type="date"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    required
                    className="h-10 pl-9 rounded-xl bg-white border-slate-200 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Movement Origin <span className="text-rose-500">*</span></label>
                  <Input
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    required
                    placeholder="Padre Garcia, Batangas"
                    className="h-10 rounded-xl bg-white border-slate-200 text-xs text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Vehicle Plate Number</label>
                  <Input
                    placeholder="NDB-8421"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                    className="h-10 rounded-xl bg-white border-slate-200 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Shipper Address</label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Purok 2, Brgy. Manggas, Padre Garcia"
                    value={shipperAddress}
                    onChange={(e) => setShipperAddress(e.target.value)}
                    className="h-10 pl-9 rounded-xl bg-white border-slate-200 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Handler License No.</span>
                  <span className="text-[10px] font-normal text-slate-400">Optional</span>
                </label>
                <Input
                  placeholder="e.g., LHL-2026-4412 (Optional)"
                  value={handlerLicense}
                  onChange={(e) => setHandlerLicense(e.target.value)}
                  className="h-10 rounded-xl bg-white border-slate-200 text-xs text-slate-800"
                />
                <p className="text-[10px] text-slate-400 leading-tight">
                  Commercial livestock byahero license. Backyard farmers without a license can leave this blank.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT CARD: 2. Livestock to be Moved (lg:col-span-7) */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#EAF5EC] text-[#1E4D2B] flex items-center justify-center shrink-0 shadow-2xs">
                  <CowHeadIcon className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">2. Livestock to be Moved</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Add each livestock line for this movement.</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleStartAddLine}
                className="h-8 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 gap-1.5 shadow-2xs"
              >
                <Plus className="size-3.5" />
                <span>Add Livestock Line</span>
              </Button>
            </div>

            {/* Table of added livestock lines */}
            <div className="overflow-hidden rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-xs">
                  <thead className="bg-[#EAF5EC]">
                    <tr>
                      <th scope="col" className="px-3.5 py-2.5 font-bold text-[#1E4D2B]">#</th>
                      <th scope="col" className="px-3.5 py-2.5 font-bold text-[#1E4D2B]">LIVESTOCK</th>
                      <th scope="col" className="px-3.5 py-2.5 font-bold text-[#1E4D2B]">HEAD COUNT</th>
                      <th scope="col" className="px-3.5 py-2.5 font-bold text-[#1E4D2B]">SEX</th>
                      <th scope="col" className="px-3.5 py-2.5 font-bold text-[#1E4D2B]">CLASS</th>
                      <th scope="col" className="px-3.5 py-2.5 font-bold text-[#1E4D2B] text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((item, idx) => {
                      const speciesName = speciesOptions.find((opt) => opt.id === item.livestock_type)?.name || "Cattle";
                      const sexLabel = item.sex === "MALE" ? "Male" : item.sex === "FEMALE" ? "Female" : "Mixed";
                      const classLabel =
                        item.classification === "SLAUGHTER"
                          ? "Slaughter"
                          : item.classification === "BREEDER"
                          ? "Breeder"
                          : item.classification === "FATTENING"
                          ? "Fattening"
                          : "Other";

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-3.5 py-3 font-bold text-slate-700">{idx + 1}</td>
                          <td className="px-3.5 py-3 font-semibold text-slate-900">
                            {speciesName}
                            {item.inventory && (
                              <span className="ml-1.5 text-[10px] text-emerald-700 font-normal">
                                (#{selectedAnimals.find((a) => a.id === item.inventory)?.tag_number || item.inventory})
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-slate-800">{item.quantity}</td>
                          <td className="px-3.5 py-3 text-slate-800">{sexLabel}</td>
                          <td className="px-3.5 py-3 text-slate-800">{classLabel}</td>
                          <td className="px-3.5 py-3 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditLine(idx)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                                title="Edit line"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              {items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                  title="Remove line"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Yellow notice callout */}
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2.5">
              <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                External livestock is recorded for this movement only and will not automatically be added to the livestock registry.
              </p>
            </div>

            {/* Add / Edit Livestock Line subcard */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900">
                  {editingLineIndex !== null ? `Edit Livestock Line #${editingLineIndex + 1}` : "Add Livestock Line"}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQrItemIndex(editingLineIndex ?? (items.length - 1));
                    setIsQrOpen(true);
                  }}
                  className="h-7 text-[11px] font-semibold rounded-lg border-emerald-200 bg-[#EAF5EC] text-[#0F4A2F] hover:bg-emerald-100 gap-1"
                >
                  <QrCode className="size-3" />
                  <span>Scan Animal QR</span>
                </Button>
              </div>

              {/* Grid 4 columns: Species, Head Count, Sex, Class */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600">Species <span className="text-rose-500">*</span></label>
                  <Select value={String(lineSpecies || speciesOptions[0]?.id || "")} onValueChange={value => setLineSpecies(Number(value))}>
                    <SelectTrigger aria-label="Livestock species" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"><SelectValue placeholder="Select livestock species" /></SelectTrigger>
                    <SelectContent className="z-[var(--z-popover-dialog)] rounded-xl">
                      {speciesOptions.map((opt) => (
                        <SelectItem key={opt.id} value={String(opt.id)}>
                          {opt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600">Head Count <span className="text-rose-500">*</span></label>
                  <Input
                    type="number"
                    min="1"
                    value={lineQuantity}
                    onChange={(e) => setLineQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="h-9 rounded-lg bg-white border-slate-200 text-xs font-bold text-slate-800"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600">Sex <span className="text-rose-500">*</span></label>
                  <Select value={lineSex} onValueChange={value => setLineSex(value as "MALE" | "FEMALE" | "MIXED")}>
                    <SelectTrigger aria-label="Animal sex" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"><SelectValue placeholder="Select animal sex" /></SelectTrigger>
                    <SelectContent className="z-[var(--z-popover-dialog)] rounded-xl">
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="MIXED">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600">Class <span className="text-rose-500">*</span></label>
                  <Select value={lineClassification} onValueChange={value => setLineClassification(value as "SLAUGHTER" | "BREEDER" | "FATTENING" | "OTHER")}>
                    <SelectTrigger aria-label="Animal classification" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"><SelectValue placeholder="Select animal classification" /></SelectTrigger>
                    <SelectContent className="z-[var(--z-popover-dialog)] rounded-xl">
                      <SelectItem value="SLAUGHTER">Slaughter</SelectItem>
                      <SelectItem value="BREEDER">Breeder</SelectItem>
                      <SelectItem value="FATTENING">Fattening</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-600">Line Notes / Ear Tags (Optional)</label>
                <Input
                  placeholder="e.g., ear tag number, other remarks"
                  value={lineRemarks}
                  onChange={(e) => setLineRemarks(e.target.value)}
                  className="h-9 rounded-lg bg-white border-slate-200 text-xs text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Registered animal lookup (if needed) */}
              <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
                    <Input
                      value={lookupCodes[editingLineIndex ?? 0] || ""}
                      onChange={(event) =>
                        setLookupCodes((previous) => {
                          const next = [...previous];
                          next[editingLineIndex ?? 0] = event.target.value;
                          return next;
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleLivestockLookup(editingLineIndex ?? 0);
                        }
                      }}
                      placeholder="Optional: Link registered animal by tag or ID..."
                      className="h-8 pl-8 rounded-lg text-[11px]"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!lookupCodes[editingLineIndex ?? 0]?.trim() || lookupIndex !== null}
                    onClick={() => void handleLivestockLookup(editingLineIndex ?? 0)}
                    className="h-8 text-[11px] px-2.5 rounded-lg"
                  >
                    {lookupIndex === (editingLineIndex ?? 0) ? <Loader2 className="size-3 animate-spin" /> : "Link"}
                  </Button>
                </div>
                {lookupResult?.index === (editingLineIndex ?? 0) && (
                  <LivestockIdentityResult
                    record={lookupResult.animal}
                    error={lookupAddError}
                    onAdd={() => {
                      const failure = addRegisteredAnimal(lookupResult.animal, editingLineIndex ?? 0);
                      if (failure) setLookupAddError(failure);
                      else {
                        setLookupResult(null);
                        setLookupAddError("");
                        setLookupCodes((previous) => {
                          const next = [...previous];
                          next[editingLineIndex ?? 0] = "";
                          return next;
                        });
                      }
                    }}
                  />
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={handleSaveLine}
                  className="h-9 rounded-xl bg-[#0F4A2F] text-white hover:bg-[#0B3D26] px-5 text-xs font-bold gap-1.5 shadow-2xs"
                >
                  <Plus className="size-3.5" />
                  <span>{editingLineIndex !== null ? "Update Line" : "Add to List"}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Notice + Action Buttons */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Info className="size-4 text-slate-400 shrink-0" />
            <span>Submitting sends this movement record to MAO for review. Auction staff do not approve movement records.</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (draftRef.current) {
                  try {
                    window.localStorage.setItem(draftKey, JSON.stringify(draftRef.current));
                    toast.success("Draft saved locally.");
                  } catch {
                    toast.error("Could not save draft locally.");
                  }
                }
              }}
              className="h-10 rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold px-5 gap-2 shadow-2xs"
            >
              <Save className="size-4 text-slate-500" />
              <span>Save as Draft</span>
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || speciesOptions.length === 0}
              className="h-10 rounded-xl bg-[#0F4A2F] hover:bg-[#0B3D26] text-white text-xs font-bold px-6 gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Submitting…</span>
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  <span>Submit to MAO</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={showSubmitConfirmation} onOpenChange={(open) => {
        if (!isSubmitting) setShowSubmitConfirmation(open);
      }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{inspectionToEdit ? "Send these corrections to MAO?" : "Submit this movement log?"}</DialogTitle>
            <DialogDescription>
              {inspectionToEdit
                ? "The corrected record will be returned to MAO for review."
                : "This record will be sent to MAO for review. Auction staff do not approve movement records."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p><span className="font-semibold text-slate-500">Shipper:</span> <span className="font-bold text-slate-900">{shipperName || "Not provided"}</span></p>
            <p><span className="font-semibold text-slate-500">Route:</span> <span className="font-bold text-slate-900">{origin || "Origin"} → {destination || "Destination"}</span></p>
            <p><span className="font-semibold text-slate-500">Animals:</span> <span className="font-bold text-slate-900">{items.reduce((total, item) => total + (Number(item.quantity) || 0), 0)} head across {items.length} line{items.length === 1 ? "" : "s"}</span></p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setShowSubmitConfirmation(false)} className="rounded-xl">Review details</Button>
            <Button type="button" disabled={isSubmitting} onClick={() => void submitInspection()} className="rounded-xl bg-[#0F5A38] text-white hover:bg-[#0c482d]">
              {isSubmitting ? <><Loader2 className="mr-2 size-4 animate-spin" /> Sending…</> : "Confirm and send"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <MovementLivestockQrDialog open={isQrOpen} onOpenChange={setIsQrOpen} onFound={(animal) => {
        const failure = addRegisteredAnimal(animal, qrItemIndex);
        if (!failure) setErrorMsg(null);
        return failure;
      }} />
    </div>
  );
}
