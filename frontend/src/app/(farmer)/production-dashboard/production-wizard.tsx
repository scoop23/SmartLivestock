"use client";

import { useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Milk,
  Package,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";
import ProductionFormFields, {
  type ProductionType,
} from "./production-form-fields";
import SelectLivestockDialog from "./select-livestock-dialog";
import type { LivestockInventoryItem } from "../livestock-inventory/page";

interface ProductionWizardProps {
  productionType: ProductionType;
  onTypeChange: (type: ProductionType) => void;
  clickedInventory: LivestockInventoryItem | null;
  onSelectInventory: (item: LivestockInventoryItem | null) => void;
  formState: Record<string, string | number>;
  onFieldChange: (field: string, val: string | number) => void;
  approvedInventories: LivestockInventoryItem[];
  isLoading: boolean;
  isSubmitting: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
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
  milk: { icon: Milk, label: "Milk", desc: "Log liters collected for the day" },
  eggs: { icon: Milk, label: "Eggs", desc: "Log eggs produced" },
  wool: { icon: Package, label: "Wool", desc: "Log wool produced in kilograms" },
};

const typeDetails: Record<ProductionType, { label: string; value: string }[]> = {
  milk: [
    { label: "Quantity", value: "milkQty" },
    { label: "Time", value: "milkTime" },
  ],
  eggs: [
    { label: "Quantity", value: "eggQty" },
    { label: "Collection Time", value: "collectionTime" },
  ],
  wool: [
    { label: "Quantity", value: "woolQty" },
  ],
};

const livestockTypeToProductionTypes: Record<string, ProductionType[]> = {
  Cattle: ["milk"],
  Carabao: ["milk"],
  Goat: ["milk"],
  Sheep: ["wool"],
  Poultry: ["eggs"],
};

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
  onSubmit,
}: ProductionWizardProps) {
  const [step, setStep] = useState(0);
  const [selectOpen, setSelectOpen] = useState(false);

  const meta = typeMeta[productionType];

  const livestockTypeName = clickedInventory?.livestockTypeName ?? "";
  const availableTypes = livestockTypeToProductionTypes[livestockTypeName] ?? Object.keys(typeMeta);

  const canContinue =
    step === 0
      ? !!clickedInventory
      : step === 1
        ? !!productionType
        : step === 2
          ? true
          : true;

  const buildPayload = (): Record<string, unknown> | null => {
    if (!clickedInventory) return null;
    const unitMap: Record<ProductionType, string> = {
      milk: "LITERS",
      eggs: "PIECES",
      wool: "KILOGRAMS",
    };
    const productionTypeMap: Record<ProductionType, string> = {
      milk: "MILK",
      eggs: "EGGS",
      wool: "WOOL",
    };
    const payload: Record<string, unknown> = {
      livestock: clickedInventory.id,
      production_type: productionTypeMap[productionType],
      quantity: 0,
      unit: unitMap[productionType],
      record_date: formState.prodDate ?? new Date().toISOString().split("T")[0],
    };
    if (productionType === "milk") {
      payload.quantity = Number(formState.milkQty);
    } else if (productionType === "eggs") {
      payload.quantity = Number(formState.eggQty);
    } else if (productionType === "wool") {
      payload.quantity = Number(formState.woolQty);
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
      ? "Log Milk Production"
      : productionType === "eggs"
        ? "Log Egg Production"
        : "Log Wool Production";

  const TypeIcon = meta.icon;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-5 md:p-6">
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
          <div className={cn("p-2.5 rounded-xl", productionType === "milk" ? "bg-emerald-100 text-emerald-700" : productionType === "eggs" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700")}>
            <TypeIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-tight">
              {step === 0
                ? "Select Livestock"
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
                  No approved livestock inventory found. Add livestock in the Livestock Inventory page first.
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
                  onSelect={onSelectInventory}
                />
              </>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(availableTypes as ProductionType[])
              .map((t) => {
                const TIcon = typeMeta[t].icon;
                const isActive = productionType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypePick(t)}
                    className={cn(
                      "p-6 rounded-xl border-2 text-left transition-all",
                      isActive
                        ? "border-[#2D5A27] bg-[#2D5A27]/5"
                        : "border-slate-100 hover:border-slate-300 bg-slate-50",
                    )}
                  >
                    <TIcon className={cn("w-7 h-7 mb-2", isActive ? "text-[#2D5A27]" : "text-slate-400")} />
                    <p className="text-sm font-bold text-slate-900">{typeMeta[t].label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{typeMeta[t].desc}</p>
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
              handleNext();
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

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full mt-5 bg-emerald-700 hover:bg-emerald-800 text-white gap-2 font-medium shadow-sm"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? "Submitting..." : "Submit Record"}
            </Button>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              Submitted records go through LGU validation before approval.
            </p>
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
      </CardContent>
    </Card>
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