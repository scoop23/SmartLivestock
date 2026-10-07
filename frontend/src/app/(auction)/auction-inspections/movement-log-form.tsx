"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Plus, Trash2, Loader2, AlertCircle, Search, ArrowLeft, Save, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createInspection, updateInspection, searchRegisteredShippers, lookupRegisteredLivestock, InspectionRecord, RegisteredShipperOption, RegisteredAnimalOption } from "./auction-analytics";
import api from "@/lib/axios";
import axios from "axios";
import { useAuth } from "@/contexts/auth-context";
import { MovementLivestockQrDialog } from "./movement-livestock-qr-dialog";

interface NewInspectionFormProps {
  onSubmitSuccess: () => void;
  inspectionToEdit?: InspectionRecord | null;
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
}: NewInspectionFormProps) {
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lookupCodes, setLookupCodes] = useState<string[]>([]);
  const [lookupIndex, setLookupIndex] = useState<number | null>(null);

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
          setSpeciesOptions(res.data);
          if (!inspectionToEdit) {
            setItems((prev) => prev.map((it) => ({
              ...it, livestock_type: it.livestock_type || res.data[0].id,
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
    if (animal.registration_status !== "APPROVED" || animal.operational_status !== "ACTIVE") {
      return `This animal cannot be added (registration: ${animal.registration_status}; operational status: ${animal.operational_status}). Use external intake only when the animal is genuinely unregistered.`;
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
    try {
      const animal = await lookupRegisteredLivestock(code);
      const addError = addRegisteredAnimal(animal, index);
      if (addError) {
        setErrorMsg(addError);
      } else {
        setLookupCodes((previous) => { const next = [...previous]; next[index] = ""; return next; });
      }
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
    router.push("/auction-inspections");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
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
        await createInspection(payload);
        clearLocalDraft(draftKey);
      }

      onSubmitSuccess();
      router.replace("/auction-inspections");

      // Reset Form
      setShipperName("");
      setShipperId(null);
      setShipperOptions([]);
      setSelectedAnimals([]);
      setShipperAddress("");
      setOrigin("");
      setDestination("");
      setPlateNumber("");
      setHandlerLicense("");
      setItems(createInitialItems(speciesOptions[0]?.id || 0));
    } catch (err: unknown) {
      const respData = axios.isAxiosError(err) ? err.response?.data as Record<string, unknown> | undefined : undefined;
      if (typeof respData === "object" && respData !== null) {
        const firstErrorKey = Object.keys(respData)[0];
        const val = respData[firstErrorKey];
        setErrorMsg(Array.isArray(val) ? val[0] : String(val));
      } else {
        setErrorMsg("Failed to save the auction record. Please check your connection.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (draftStatus === "checking") {
    return <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center p-5 text-sm font-semibold text-slate-500">Checking for a saved movement log…</main>;
  }

  if (draftStatus === "prompt") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <section className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-wider text-violet-700">Unfinished movement log found</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">Your previous draft was saved locally.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Continue where you left off, or discard this saved draft and start fresh. No movement record exists until you submit to MAO.</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={startNewDraft} className="min-h-11 rounded-xl">Start New</Button>
            <Button type="button" onClick={restoreDraft} className="min-h-11 rounded-xl bg-[#7C3AED] text-white hover:bg-[#6D28D9]">Continue Draft</Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 pb-10 sm:px-6 lg:px-8 lg:py-8 2xl:px-12">
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button type="button" variant="ghost" onClick={cancelForm} className="-ml-3 mb-3 min-h-10 gap-2 px-3 text-slate-600">
            <ArrowLeft className="size-4" /> Back to movement logs
          </Button>
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-800"><ClipboardCheck className="size-5" /></span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{inspectionToEdit ? "Correct Movement Log" : "New Movement Log"}</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Record livestock entering or moving through the auction house. Registered livestock can be found by tag or QR; external livestock can be entered manually.</p>
            </div>
          </div>
        </div>
        {!inspectionToEdit && (
          <div aria-live="polite" className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
            {draftStatus === "saving" ? <><Save className="size-3.5 animate-pulse" /> Saving draft…</> : draftStatus === "error" ? <><AlertCircle className="size-3.5 text-rose-600" /> Local draft could not be saved</> : <><Save className="size-3.5 text-emerald-600" /> Draft saved locally</>}
          </div>
        )}
      </div>

      {!inspectionToEdit && <div className="mb-6 flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="rounded-full bg-violet-100 px-3 py-1.5 text-violet-900">Draft</span><span className="text-slate-300">→</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">Submitted to MAO</span><span className="text-slate-300">→</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">MAO Review</span>
      </div>}

      <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Shipper & Transit details */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-sm font-black text-slate-900">1. Shipper and movement information</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Shipper Name *</label>
                <Input
                  placeholder="e.g. Juan Dela Cruz"
                  value={shipperName}
                  onChange={(e) => {
                    setShipperName(e.target.value);
                    setShipperId(null);
                    setShipperOptions([]);
                    setSelectedAnimals([]);
                    setItems((previous) => previous.map((item) => ({ ...item, inventory: null })));
                  }}
                  required
                  className="h-10 rounded-xl bg-slate-50"
                />
                {shipperId ? (
                  <p className="text-[10px] text-emerald-800 font-semibold">
                    Linked to registered farmer #{shipperId}
                    <button type="button" className="ml-2 underline" onClick={() => {
                      setShipperId(null); setSelectedAnimals([]);
                      setItems((previous) => previous.map((item) => ({ ...item, inventory: null })));
                    }}>Use unregistered shipper</button>
                  </p>
                ) : shipperOptions.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {shipperOptions.map((shipper) => (
                      <button key={shipper.id} type="button" onClick={() => selectShipper(shipper)}
                        className="block w-full px-3 py-2 text-left text-xs hover:bg-purple-50">
                        {shipper.name} — {shipper.address}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Destination *</label>
                <Input
                  placeholder="e.g. Batangas City Slaughterhouse"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Purpose *</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as "SLAUGHTER" | "BREEDING" | "FATTENING" | "OTHER")}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold"
                >
                  <option value="SLAUGHTER">Slaughter (Katayan)</option>
                  <option value="BREEDING">Breeding (Palahi)</option>
                  <option value="FATTENING">Fattening (Papatabain)</option>
                  <option value="OTHER">Other Purpose</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Inspection Date *</label>
                <Input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  required
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>

              <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                <label className="text-[10px] font-bold uppercase text-slate-500">Shipper Address</label>
                <Input
                  placeholder="e.g. Purok 2, Brgy. Manggas, Padre Garcia"
                  value={shipperAddress}
                  onChange={(e) => setShipperAddress(e.target.value)}
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>

              <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                <label className="text-[10px] font-bold uppercase text-slate-500">Movement Origin *</label>
                <Input value={origin} onChange={(e) => setOrigin(e.target.value)} required
                  placeholder="e.g. Tanauan, Batangas" className="h-10 rounded-xl bg-slate-50" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Vehicle Plate Number</label>
                <Input
                  placeholder="e.g. NDB-8421"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Handler License No.</label>
                <Input
                  placeholder="e.g. LHL-2026-4412"
                  value={handlerLicense}
                  onChange={(e) => setHandlerLicense(e.target.value)}
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>
            </div>
          </section>

          {/* Livestock items breakdown */}
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div><h2 className="text-sm font-black text-slate-900">2. Livestock ({items.length} line{items.length === 1 ? "" : "s"})</h2><p className="mt-1 text-xs text-slate-500">Each line is either linked to registered livestock or encoded for this movement only.</p></div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="rounded-xl text-xs font-bold gap-1 text-[#7C3AED] border-purple-200 hover:bg-purple-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Add External Livestock</span><span className="sm:hidden">Add External</span>
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className={`min-w-0 rounded-2xl border p-3.5 space-y-3 ${item.inventory ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/40"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700">Item #{idx + 1} · {item.inventory ? "Registered livestock" : "External / unregistered"}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>

                  {shipperId && selectedAnimals.length > 0 && (
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Registered Animal (optional)</label>
                      <select value={item.inventory || ""} onChange={(e) => selectAnimal(idx, e.target.value ? Number(e.target.value) : null)}
                        className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs">
                        <option value="">Batch or unregistered livestock</option>
                        {selectedAnimals.map((animal) => (
                          <option key={animal.id} value={animal.id}>
                            {animal.tag_number} — {animal.livestock_type_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Registered livestock lookup</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input value={lookupCodes[idx] || ""} onChange={(event) => setLookupCodes((previous) => { const next = [...previous]; next[idx] = event.target.value; return next; })}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleLivestockLookup(idx); } }}
                        placeholder="Search by tag or inventory ID" className="h-10 min-w-0 flex-1 rounded-lg text-xs" />
                      <div className="flex gap-2">
                      <Button type="button" variant="outline" disabled={!lookupCodes[idx]?.trim() || lookupIndex !== null}
                        onClick={() => void handleLivestockLookup(idx)} className="h-10 flex-1 rounded-lg gap-1 text-xs sm:flex-none">
                        {lookupIndex === idx ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />} Search
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setQrItemIndex(idx); setIsQrOpen(true); }} className="h-10 flex-1 rounded-lg gap-1 text-xs sm:flex-none"><QrCode className="size-3.5" /> Scan QR</Button>
                      </div>
                    </div>
                    {item.inventory && <p className="text-xs font-semibold text-emerald-800">Linked to registered animal {selectedAnimals.find((animal) => animal.id === item.inventory)?.tag_number || `#${item.inventory}`}. The database remains authoritative.</p>}
                    {!item.inventory && <p className="text-xs leading-5 text-amber-900">External livestock is recorded for this movement only and will not automatically be added to the livestock registry.</p>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Species</label>
                      <select
                        value={item.livestock_type}
                        onChange={(e) => handleUpdateItem(idx, "livestock_type", Number(e.target.value))}
                        disabled={!!item.inventory}
                        className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                      >
                        {speciesOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Head Count</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(idx, "quantity", Number(e.target.value))}
                        disabled={!!item.inventory}
                        className="h-9 rounded-lg bg-white text-xs font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Sex</label>
                      <select
                        value={item.sex}
                        onChange={(e) => handleUpdateItem(idx, "sex", e.target.value)}
                        className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="MIXED">Mixed</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Class</label>
                      <select
                        value={item.classification}
                        onChange={(e) => handleUpdateItem(idx, "classification", e.target.value)}
                        className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                      >
                        <option value="SLAUGHTER">Slaughter</option>
                        <option value="BREEDER">Breeder</option>
                        <option value="FATTENING">Fattening</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>

                  <Input
                    placeholder="Optional line notes / ear tags"
                    value={item.remarks}
                    onChange={(e) => handleUpdateItem(idx, "remarks", e.target.value)}
                    className="h-8 rounded-lg bg-white text-xs"
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-xs leading-5 text-slate-500">Submitting sends this record to MAO. Auction staff do not approve movement records.</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={cancelForm}
              disabled={isSubmitting}
              className="min-h-11 rounded-xl cursor-pointer w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || speciesOptions.length === 0}
              className="min-h-11 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold cursor-pointer w-full sm:w-auto gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                inspectionToEdit ? "Save Corrections" : "Submit to MAO"
              )}
            </Button>
            </div>
          </div>
      </form>
      <MovementLivestockQrDialog open={isQrOpen} onOpenChange={setIsQrOpen} onFound={(animal) => {
        const failure = addRegisteredAnimal(animal, qrItemIndex);
        if (!failure) setErrorMsg(null);
        return failure;
      }} />
    </main>
  );
}
