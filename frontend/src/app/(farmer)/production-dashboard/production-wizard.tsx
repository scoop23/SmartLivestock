"use client";

import { useState } from "react";
import {
  Beef,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Egg,
  Milk,
  Package,
  Send,
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
import type { UpdateProductionPayload, WizardMode } from "./production-dashboard-view";

import { type ProductionType, ProductionRecordItem } from "./production-analytics";

export type ProductionPayload = {
  livestock: number;
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

export default function ProductionWizard({
  productionType,
  onTypeChange,
  clickedInventory,
  onSelectInventory,
  formState,
  onFieldChange,
  approvedInventories,
  isLoading,
  isSubmitting,
  resetSignal,
  onSubmit,
  open,
  onClose,
  mode,
  editingRecord,
}: ProductionWizardProps) {
  const [step, setStep] = useState(0);
  const [selectOpen, setSelectOpen] = useState(false);
  const [isCertified, setIsCertified] = useState(false);
  const [prevResetSignal, setPrevResetSignal] = useState(resetSignal);
  const [prevOpen, setPrevOpen] = useState(open);

  if (resetSignal !== prevResetSignal) {
    setPrevResetSignal(resetSignal);
    setStep(mode === "edit" ? 2 : 0);
    setSelectOpen(false);
    setIsCertified(mode === "edit");
  }

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep(mode === "edit" ? 2 : 0);
      setSelectOpen(false);
      setIsCertified(mode === "edit");
    }
  }

  const availableTypes = getProductionTypesForLivestock(clickedInventory?.livestockTypeName);
  const meta = typeMeta[productionType] ?? typeMeta[availableTypes[0]] ?? typeMeta.milk;

  const handleSelectInventory = (item: LivestockInventoryItem | null) => {
    onSelectInventory(item);
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

  const canContinue =
    step === 0
      ? !!clickedInventory
      : step === 1
        ? !!productionType
        : step === 2
          ? getEnteredQty() > 0
          : true;

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
        ? "Log Meat & Carcass Yield"
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-slate-200 shadow-2xl">
        <DialogHeader className="px-5 md:px-6 pt-5 md:pt-6 pb-3 border-b border-slate-100 text-left">
          <DialogTitle className="text-xl font-bold text-slate-900">
            {mode === "edit" ? "Edit Production Record" : "Log Production"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-1">
            {mode === "edit"
              ? "Update production yield details and notes"
              : "Record milk, meat, eggs, and wool production"}
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 md:p-6">
          <div className="flex items-center gap-0 mb-6">
            {STEP_LABELS.map((label, i) => {
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={label} className={cn("flex items-center", i < STEP_LABELS.length - 1 && "flex-1")}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        "size-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                        isDone && "bg-emerald-600 text-white",
                        isActive && "bg-[#2D5A27] text-white ring-4 ring-[#2D5A27]/15",
                        !isDone && !isActive && "bg-slate-100 text-slate-400",
                      )}
                    >
                      {isDone ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-medium whitespace-nowrap",
                        isActive || isDone ? "text-slate-900" : "text-slate-400",
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={cn("flex-1 h-0.5 mx-2 mt-[-18px] rounded", i < step ? "bg-emerald-600" : "bg-slate-200")} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mb-5">
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
                Step {step + 1} of {STEP_LABELS.length} — {STEP_LABELS[step]}
              </p>
            </div>
          </div>

          {step === 0 && (
            <div>
              {isLoading ? (
                <p className="text-sm text-slate-500 py-4">Loading inventory...</p>
              ) : approvedInventories.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-500">
                    No approved livestock found. Only livestock approved by SIBAT / MAO can be logged for production.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectOpen(true)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all",
                      clickedInventory
                        ? "border-[#2D5A27] bg-[#2D5A27]/5"
                        : "border-dashed border-slate-300 bg-white hover:border-slate-400",
                    )}
                  >
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
                    <div className="flex items-center gap-2 shrink-0">
                      {clickedInventory && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2D5A27]">
                          <Check className="w-4 h-4" /> Selected
                        </span>
                      )}
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    </div>
                  </button>

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
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (canContinue) handleNext();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="prodDate">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="prodDate"
                    name="prodDate"
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    className="pl-10"
                    value={String(formState.prodDate ?? new Date().toISOString().split("T")[0])}
                    onChange={(e) => onFieldChange("prodDate", e.target.value)}
                  />
                </div>
              </div>

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
                  rows={2}
                  placeholder="Optional details..."
                  value={String(formState.notes ?? "")}
                  onChange={(e) => onFieldChange("notes", e.target.value)}
                />
              </div>
            </form>
          )}

          {step === 3 && (
            <div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 divide-y divide-slate-100 overflow-hidden">
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
              <div className="flex items-start gap-3 p-3.5 mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
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
                  I certify that the recorded yield was harvested from my registered livestock on this date and is ready for field verification by the assigned <span className="font-extrabold text-emerald-950">SIBAT Agricultural Technologist</span> and MAO.
                </label>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !isCertified}
                className="w-full mt-4 bg-emerald-700 p-6 hover:bg-emerald-800 text-white gap-2 font-medium shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSubmitting
                  ? "Saving..."
                  : mode === "edit"
                  ? "Update Record"
                  : "Submit Record"}
              </Button>
              <p className="text-[11px] text-slate-400 text-center mt-2">
                Submitted records go through LGU validation before approval.
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
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
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
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-slate-300" />
                <span className="text-xs text-slate-400">{step + 1} of {STEP_LABELS.length}</span>
              </div>
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canContinue}
                className="bg-[#2D5A27] hover:bg-[#244a20] text-white gap-2"
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
