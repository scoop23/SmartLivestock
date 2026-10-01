"use client";

import { useState } from "react";
import {
  Beef,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Egg,
  Info,
  Milk,
  Package,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/components/ui/utils";
import ProductionFormFields, {
  ProductionFormState,
} from "./production-form-fields";
import SelectLivestockDialog from "./select-livestock-dialog";
import type { LivestockInventoryItem } from "../livestock-inventory/page";
import type { WizardMode } from "./production-dashboard-view";

import { type ProductionType, ProductionRecordItem } from "./production-analytics";

export type ProductionPayload = {
  livestock: number;
  selected_animals?: number[];
  production_type: "MILK" | "MEAT" | "EGGS" | "WOOL";
  quantity: number;
  unit: "LITERS" | "PIECES" | "KILOGRAMS";
  record_date: string;
  notes: string;
};

interface ProductionWizardProps {
  productionType: ProductionType;
  onTypeChange: (type: ProductionType) => void;
  clickedInventory: LivestockInventoryItem | null;
  onSelectInventory: (item: LivestockInventoryItem | null) => void;
  formState: ProductionFormState;
  onFieldChange: (field: string, val: string | number) => void;
  approvedInventories: LivestockInventoryItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  resetSignal: number;
  onSubmit: (payload: ProductionPayload) => void;
  open: boolean;
  onClose: () => void;
  mode: WizardMode;
  editingRecord: Partial<ProductionRecordItem> | null;
}

const STEP_LABELS = ["Livestock", "Production", "Details", "Review"];

const formatDate = (date: string | null | undefined) => {
  if (!date) return "Unknown date";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (match) {
    const [, y, m, d] = match;
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short" });
    return `${month} ${Number(d)}, ${y}`;
  }
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const typeMeta: Record<ProductionType, { icon: typeof Milk; label: string; desc: string }> = {
  milk: { icon: Milk, label: "Dairy Milk", desc: "Log liters collected for the day" },
  meat: { icon: Beef, label: "Meat & Carcass", desc: "Log kilograms of butchered / meat yield" },
  eggs: { icon: Egg, label: "Eggs", desc: "Log eggs produced" },
  wool: { icon: Package, label: "Wool", desc: "Log wool produced in kilograms" },
};

const typeDetails: Record<ProductionType, { label: string; value: keyof ProductionFormState }[]> = {
  milk: [
    { label: "Quantity (L)", value: "milkQty" },
    { label: "Milking Session", value: "milkTime" },
  ],
  meat: [
    { label: "Meat Yield (kg)", value: "meatQty" },
    { label: "Purpose", value: "meatPurpose" },
  ],
  eggs: [
    { label: "Quantity (pcs)", value: "eggQty" },
    { label: "Collection Time", value: "collectionTime" },
  ],
  wool: [
    { label: "Quantity (kg)", value: "woolQty" },
  ],
};

export function getProductionTypesForLivestock(livestockTypeName?: string | null): ProductionType[] {
  if (!livestockTypeName) return ["milk", "meat"];
  const name = livestockTypeName.trim().toLowerCase();

  if (
    name.includes("cattle") ||
    name.includes("baka") ||
    name.includes("bovine") ||
    name.includes("cow")
  ) {
    return ["milk", "meat"];
  }
  if (
    name.includes("carabao") ||
    name.includes("kalabaw") ||
    name.includes("buffalo")
  ) {
    return ["milk", "meat"];
  }
  if (
    name.includes("goat") ||
    name.includes("kambing") ||
    name.includes("caprine")
  ) {
    return ["milk", "meat"];
  }
  if (
    name.includes("sheep") ||
    name.includes("tupa") ||
    name.includes("ovine") ||
    name.includes("lamb") ||
    name.includes("ram")
  ) {
    return ["meat", "wool"];
  }
  if (
    name.includes("swine") ||
    name.includes("pig") ||
    name.includes("baboy") ||
    name.includes("hog") ||
    name.includes("porcine")
  ) {
    return ["meat"];
  }
  if (
    name.includes("poultry") ||
    name.includes("chicken") ||
    name.includes("manok") ||
    name.includes("duck") ||
    name.includes("itik") ||
    name.includes("hen") ||
    name.includes("layer")
  ) {
    return ["eggs", "meat"];
  }

  return ["milk", "meat"];
}

function ProductionWizardContent({
  productionType,
  onTypeChange,
  clickedInventory,
  onSelectInventory,
  formState,
  onFieldChange,
  approvedInventories,
  isLoading,
  isSubmitting,
  onSubmit,
  open,
  onClose,
  mode,
  editingRecord,
}: ProductionWizardProps) {
  const [step, setStep] = useState(mode === "edit" ? 2 : 0);
  const [selectOpen, setSelectOpen] = useState(false);
  const [isCertified, setIsCertified] = useState(false);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<number[]>(() =>
    editingRecord?.slaughterDetails?.animals.map(animal => animal.id) ?? (clickedInventory ? [Number(clickedInventory.id)] : []));
  const slaughterCandidates = approvedInventories.filter(item => item.quantity === 1 &&
    (clickedInventory?.batchId ? item.batchId === clickedInventory.batchId : item.id === clickedInventory?.id));

  const availableTypes = getProductionTypesForLivestock(clickedInventory?.livestockTypeName);
  const meta = typeMeta[productionType] ?? typeMeta[availableTypes[0]] ?? typeMeta.milk;

  const handleSelectInventory = (item: LivestockInventoryItem | null) => {
    onSelectInventory(item);
    setSelectedAnimalIds(item ? [Number(item.id)] : []);
    if (item) {
      const allowed = getProductionTypesForLivestock(item.livestockTypeName);
      if (!allowed.includes(productionType)) {
        onTypeChange(allowed[0]);
      }
    }
  };

  const getEnteredQty = () => {
    if (productionType === "milk") return Number(formState.milkQty) || 0;
    if (productionType === "meat") return Number(formState.meatQty) || 0;
    if (productionType === "eggs") return Number(formState.eggQty) || 0;
    if (productionType === "wool") return Number(formState.woolQty) || 0;
    return 0;
  };

  const hasEligibleSelection = selectedAnimalIds.length > 0 && selectedAnimalIds.every(id =>
    slaughterCandidates.some(animal => Number(animal.id) === id));
  const canContinue =
    step === 0
      ? !!clickedInventory
      : step === 1
        ? !!productionType
        : step === 2
          ? getEnteredQty() > 0 && !!String(formState.prodDate ?? "").trim() && (productionType !== "meat" || hasEligibleSelection)
          : true;

  const validationMessage =
    step === 0 && !clickedInventory
      ? "Select an approved animal before continuing."
      : step === 2 && !String(formState.prodDate ?? "").trim()
        ? "Enter the production date."
        : step === 2 && getEnteredQty() <= 0
          ? "Enter a production quantity greater than zero."
          : step === 2 && productionType === "meat" && !hasEligibleSelection
            ? "Select eligible individual animals for this slaughter entry."
            : null;

  const buildPayload = (): ProductionPayload | null => {
    if (!clickedInventory) return null;

    const unitMap: Record<ProductionType, ProductionPayload["unit"]> = {
      milk: "LITERS",
      meat: "KILOGRAMS",
      eggs: "PIECES",
      wool: "KILOGRAMS",
    };

    const productionTypeMap: Record<
      ProductionType,
      ProductionPayload["production_type"]
    > = {
      milk: "MILK",
      meat: "MEAT",
      eggs: "EGGS",
      wool: "WOOL",
    };

    const payload: ProductionPayload = {
      livestock: Number(clickedInventory.id),
      production_type: productionTypeMap[productionType],
      quantity: 0,
      unit: unitMap[productionType],
      record_date:
        String(formState.prodDate ?? new Date().toISOString().split("T")[0]),
      notes: String(formState.notes ?? "").trim(),
    };

    if (productionType === "milk") {
      payload.quantity = Number(formState.milkQty) || 0;
      if (formState.milkTime) {
        payload.notes = `[${formState.milkTime}] ${payload.notes}`.trim();
      }
    } else if (productionType === "meat") {
      payload.quantity = Number(formState.meatQty) || 0;
      payload.selected_animals = selectedAnimalIds;
      if (formState.meatPurpose) {
        payload.notes = `[Purpose: ${formState.meatPurpose}] ${payload.notes}`.trim();
      }
    } else if (productionType === "eggs") {
      payload.quantity = Number(formState.eggQty) || 0;
    } else if (productionType === "wool") {
      payload.quantity = Number(formState.woolQty) || 0;
    }

    return payload;
  };

  const handleNext = () => setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleTypePick = (t: ProductionType) => {
    onTypeChange(t);
    handleNext();
  };

  const handleSubmit = () => {
    const payload = buildPayload();
    if (payload) onSubmit(payload);
  };

  const typeTitle =
    productionType === "milk"
      ? "Log Dairy Milk Production"
      : productionType === "meat"
        ? "Report Slaughter & Carcass Output"
        : productionType === "eggs"
          ? "Log Egg Production"
          : "Log Wool Production";

  const TypeIcon = meta.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-4xl max-h-[94vh] overflow-hidden p-0 gap-0 rounded-3xl border-0 shadow-2xl bg-slate-50">
        <DialogHeader className="relative overflow-hidden px-5 md:px-7 py-5 md:py-6 text-left bg-gradient-to-r from-[#244a20] via-[#2D5A27] to-[#3E7A36] text-white">
          <div className="absolute -right-12 -top-16 size-44 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start gap-3.5">
            <div className="size-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/15">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl md:text-2xl font-black text-white">
                {mode === "edit" ? "Correct Production Entry" : "New Production Entry"}
              </DialogTitle>
              <DialogDescription className="text-sm text-white/75 mt-1">
                {mode === "edit"
                  ? "Update the returned details, review them, and resubmit to SIBAT."
                  : "Reporting is optional. Enter production information you have recorded; SIBAT and MAO will review your submission."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto p-4 sm:p-5 md:p-7">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3 mb-5">
            {STEP_LABELS.map((label, i) => {
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div
                  key={label}
                  className={cn(
                    "rounded-2xl border px-2 py-2.5 sm:px-3 transition-colors",
                    isActive && "border-[#2D5A27] bg-white shadow-sm",
                    isDone && "border-emerald-200 bg-emerald-50",
                    !isDone && !isActive && "border-slate-200 bg-slate-100/70",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "size-7 rounded-xl flex items-center justify-center text-[11px] font-black transition-colors shrink-0",
                        isDone && "bg-emerald-600 text-white",
                        isActive && "bg-[#2D5A27] text-white ring-4 ring-[#2D5A27]/15",
                        !isDone && !isActive && "bg-slate-100 text-slate-400",
                      )}
                    >
                      {isDone ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] sm:text-xs font-bold truncate",
                        isActive || isDone ? "text-slate-900" : "text-slate-400",
                      )}
                    >
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mb-4 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs">
            <div
              className={cn(
                "p-2.5 rounded-xl",
                step === 0
                  ? "bg-slate-100 text-slate-700"
                  : productionType === "milk"
                  ? "bg-sky-100 text-sky-700"
                  : productionType === "meat"
                  ? "bg-rose-100 text-rose-700"
                  : productionType === "eggs"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-stone-200 text-stone-700"
              )}
            >
              {step === 0 ? <Package className="w-5 h-5" /> : <TypeIcon className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">
                {step === 0
                  ? "Select Approved Livestock"
                  : step === 1
                    ? "Select Production Type"
                    : typeTitle}
              </h3>
              <p className="text-xs text-slate-500">
                Step {step + 1} of {STEP_LABELS.length} · Complete the information below
              </p>
            </div>
          </div>

          {step === 0 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Only MAO-approved, active livestock with a positive head count can be selected. Meat output is recorded in kilograms; animal deaths belong in Mortality.</p>
              {isLoading ? (
                <p className="text-sm text-slate-500 py-4">Loading inventory...</p>
              ) : approvedInventories.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-500">
                    No eligible livestock found. Production requires MAO-approved, active livestock with a positive head count.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectOpen(true)}
                    className={cn(
                      "w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 rounded-2xl border-2 text-left transition-all bg-white",
                      clickedInventory
                        ? "border-[#2D5A27] bg-[#2D5A27]/5"
                        : "border-dashed border-slate-300 bg-white hover:border-slate-400",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "size-11 rounded-2xl flex items-center justify-center shrink-0",
                        clickedInventory ? "bg-[#2D5A27] text-white" : "bg-slate-100 text-slate-500",
                      )}>
                        <Tag className="size-5" />
                      </div>
                      <div className="min-w-0">
                      {clickedInventory ? (
                        <>
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {clickedInventory.entryType === "INDIVIDUAL"
                              ? clickedInventory.tagNumber || "Un-tagged"
                              : `Batch #${clickedInventory.id} (${clickedInventory.quantity} heads)`}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {clickedInventory.livestockTypeName} • {clickedInventory.breed || "Standard Breed"} • {clickedInventory.sex}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-slate-700">Tap to select livestock</p>
                          <p className="text-xs text-slate-400 mt-0.5">Link a batch or animal to this record</p>
                        </>
                      )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {clickedInventory && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2D5A27]">
                          <Check className="w-4 h-4" /> Selected
                        </span>
                      )}
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    </div>
                  </button>
                  <div className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-100 px-3.5 py-3 text-xs text-sky-900">
                    <Info className="size-4 shrink-0 mt-0.5" />
                    Only MAO-approved livestock can be used as the source of a production declaration.
                  </div>

                  <SelectLivestockDialog
                    open={selectOpen}
                    onOpenChange={setSelectOpen}
                    items={approvedInventories}
                    selectedId={clickedInventory?.id ?? null}
                    onSelect={handleSelectInventory}
                  />
                </>
              )}
            </div>
          )}

          {step === 1 && (
            <div
              className={cn(
                "grid gap-3.5",
                availableTypes.length === 1
                  ? "grid-cols-1 max-w-md mx-auto"
                  : availableTypes.length === 2
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-3"
              )}
            >
              {availableTypes.map((t) => {
                const TIcon = typeMeta[t]?.icon ?? Milk;
                const isActive = productionType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypePick(t)}
                    className={cn(
                      "p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer",
                      isActive
                        ? "border-[#2D5A27] bg-[#2D5A27]/5 shadow-sm ring-1 ring-[#2D5A27]/30"
                        : "border-slate-200 hover:border-[#2D5A27]/40 bg-white hover:bg-slate-50/70",
                    )}
                  >
                    <div
                      className={cn(
                        "p-3 rounded-xl w-fit mb-3 transition-colors",
                        isActive ? "bg-[#2D5A27] text-white" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      <TIcon className="w-6 h-6" />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-base font-bold text-slate-900">{typeMeta[t]?.label ?? t}</p>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2D5A27]">
                          <Check className="w-4 h-4" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-normal">{typeMeta[t]?.desc ?? ""}</p>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <form
              className="space-y-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (canContinue) handleNext();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="prodDate">{productionType === "meat" ? "Slaughter date" : "Date"}</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="prodDate"
                    name="prodDate"
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    className="pl-10 h-11 rounded-xl"
                    value={String(formState.prodDate ?? new Date().toISOString().split("T")[0])}
                    onChange={(e) => onFieldChange("prodDate", e.target.value)}
                  />
                </div>
              </div>

              {productionType === "meat" && (
                <div className="space-y-3">
                  <Label>Animals slaughtered ({selectedAnimalIds.length} selected)</Label>
                  <p className="text-xs text-slate-500">Select the exact animals. Their inventory changes only after MAO approval; unselected herd members remain active.</p>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {slaughterCandidates.map(animal => (
                      <label key={animal.id} className="flex min-h-12 items-center gap-3 px-3 py-2 cursor-pointer">
                        <Checkbox
                          checked={selectedAnimalIds.includes(Number(animal.id))}
                          disabled={animal.id === clickedInventory?.id}
                          onCheckedChange={checked => setSelectedAnimalIds(ids => checked
                            ? [...new Set([...ids, Number(animal.id)])] : ids.filter(id => id !== Number(animal.id)))}
                        />
                        <span className="text-sm font-medium">{animal.tagNumber || `Animal #${animal.id}`}<span className="block text-xs font-normal text-slate-500">{animal.batchCode || animal.livestockTypeName}</span></span>
                      </label>
                    ))}
                  </div>
                  {slaughterCandidates.length === 0 && <p className="text-sm text-amber-700">No eligible individual animals are available. Aggregate head counts cannot identify slaughtered animals.</p>}
                </div>
              )}
              <ProductionFormFields
                type={productionType}
                value={formState}
                onChange={onFieldChange}
              />

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  maxLength={500}
                  placeholder="Optional context for SIBAT and MAO reviewers..."
                  value={String(formState.notes ?? "")}
                  onChange={(e) => onFieldChange("notes", e.target.value)}
                />
              </div>
              {validationMessage && (
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <Info className="size-4 shrink-0" />
                  {validationMessage}
                </div>
              )}
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-xs">
                <ReviewRow label="Livestock" value={
                  clickedInventory
                    ? clickedInventory.entryType === "INDIVIDUAL"
                      ? clickedInventory.tagNumber || "Un-tagged"
                      : `Batch #${clickedInventory.id} (${clickedInventory.quantity} heads)`
                    : "—"
                }
                  sub={
                    clickedInventory
                      ? `${clickedInventory.livestockTypeName} • ${clickedInventory.breed || "Standard Breed"} • ${clickedInventory.sex}`
                      : undefined
                  }
                />
                <ReviewRow label="Production Type" value={meta.label} />
                {productionType === "meat" && <ReviewRow label={`Animals slaughtered (${selectedAnimalIds.length})`} value={slaughterCandidates.filter(animal => selectedAnimalIds.includes(Number(animal.id))).map(animal => animal.tagNumber || `Animal #${animal.id}`).join(", ")} />}
                <ReviewRow
                  label="Date"
                  value={formatDate(String(formState.prodDate ?? new Date().toISOString().split("T")[0]))}
                />
                {typeDetails[productionType].map((d) => {
                  const val = formState[d.value];
                  return (
                    <ReviewRow
                      key={d.value}
                      label={d.label}
                      value={val != null && val !== "" ? String(val) : "—"}
                    />
                  );
                })}
                {formState.notes && (
                  <ReviewRow label="Notes" value={String(formState.notes)} />
                )}
              </div>

              {/* Farmer Production Declaration Banner */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <Checkbox
                  id="certify-production"
                  checked={isCertified}
                  onCheckedChange={(checked) => setIsCertified(checked === true)}
                  className="mt-0.5 border-emerald-600 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27] cursor-pointer"
                />
                <label
                  htmlFor="certify-production"
                  className="text-xs font-semibold text-slate-800 leading-snug cursor-pointer select-none"
                >
                  I confirm this report reflects the information available to me and may be reviewed first by <span className="font-extrabold text-emerald-950">SIBAT</span>, then officially approved by MAO.
                </label>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !isCertified}
                className="w-full h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white gap-2 font-bold shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSubmitting
                  ? "Saving..."
                  : mode === "edit"
                  ? "Update Record"
                  : "Submit Record"}
              </Button>
              <p className="text-[11px] text-slate-500 text-center">
                Workflow: Farmer submission → SIBAT verification → MAO approval
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                className="gap-1.5 text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            </div>
          )}

          {step < 3 && (
            <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-200">
              <div className="min-w-[88px]">
              {step > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  className="gap-1.5 text-slate-600"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
              )}
              </div>
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Saved only after final submission
              </div>
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canContinue}
                className="h-10 rounded-xl bg-[#2D5A27] hover:bg-[#244a20] text-white gap-2 font-bold min-w-[112px]"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductionWizard(props: ProductionWizardProps) {
  return (
    <ProductionWizardContent
      key={`${props.mode}-${props.resetSignal}-${props.open ? "open" : "closed"}`}
      {...props}
    />
  );
}

function ReviewRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm font-medium text-slate-900 text-right min-w-0">
        {value}
        {sub && <span className="block text-xs font-normal text-slate-500 mt-0.5">{sub}</span>}
      </span>
    </div>
  );
}
