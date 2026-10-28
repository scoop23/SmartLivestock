"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/utils";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { getAutomaticTutorialsEnabled, startGuidedTutorial } from "@/lib/tutorial-preferences";
import type { LivestockInventoryItem } from "../livestock-inventory/page";
import type { WizardMode } from "./production-dashboard-view";
import ProductionFormFields,{
ProductionFormState,
} from "./production-form-fields";
import SelectLivestockDialog from "./select-livestock-dialog";

import { type ProductionType,ProductionRecordItem } from "./production-analytics";

export type ProductionPayload = {
  livestock: number;
  selected_animals?: number[];
  production_type: "MILK" | "MEAT" | "EGGS" | "WOOL";
  quantity: number;
  unit: "LITERS" | "PIECES" | "KILOGRAMS";
  record_date: string;
  milking_session?: "MORNING" | "AFTERNOON" | "EVENING";
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
  productionRecords: ProductionRecordItem[];
  isLoadingProductionRecords: boolean;
  /** Start at the details stage when the caller already fixed the animal and production type. */
  profileMode?: boolean;
  /** Keep a wizard opened from a specific activity on that activity's type. */
  fixedProductionType?: ProductionType;
}

const STEP_LABELS = ["Livestock", "Production", "Details", "Review"];
const STEP_SHORT_LABELS = ["Live", "Prod", "Det", "Rev"];

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
  productionRecords,
  isLoadingProductionRecords,
  profileMode = false,
  fixedProductionType,
}: ProductionWizardProps) {
  const firstStep = profileMode || mode === "edit" ? 2 : 0;
  const minimumStep = profileMode ? 2 : 0;
  const [step, setStep] = useState(firstStep);
  const autoTutorialStarted = useRef(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [isCertified, setIsCertified] = useState(false);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<number[]>(() =>
    editingRecord?.slaughterDetails?.animals.map(animal => animal.id) ?? (clickedInventory ? [Number(clickedInventory.id)] : []));

  const startWizardTour = useCallback(() => {
    const steps: DriveStep[] = [
      {
        element: '[data-tour="production-wizard-progress"]',
        popover: {
          title: "Your production entry steps",
          description: "The form guides you from livestock selection through production details to a final review before anything is submitted.",
          side: "bottom",
          align: "center",
        },
      },
      ...(step === 0
        ? [{
            element: '[data-tour="production-wizard-livestock"]',
            popover: { title: "Choose the livestock", description: "Select an MAO-approved, active animal or batch as the source of this production record.", side: "bottom" as const, align: "center" as const },
          }]
        : step === 1
          ? [{
              element: '[data-tour="production-wizard-types"]',
              popover: { title: "Choose the production type", description: "Pick the type that matches what you are reporting. Options depend on the selected livestock.", side: "bottom" as const, align: "center" as const },
            }]
          : step === 2
            ? [
                { element: '[data-tour="production-wizard-date"]', popover: { title: "Set the record date", description: "Choose when the production was collected or the slaughter happened.", side: "bottom" as const, align: "start" as const } },
                { element: '[data-tour="production-wizard-fields"]', popover: { title: "Enter production details", description: "Fill in the quantity and activity-specific details. Meat entries also require selecting the individual animals.", side: "top" as const, align: "center" as const } },
                { element: '[data-tour="production-wizard-notes"]', popover: { title: "Add optional notes", description: "Add context for your own farm history.", side: "top" as const, align: "start" as const } },
              ]
            : [
                { element: '[data-tour="production-wizard-review"]', popover: { title: "Review the entry", description: "Check the livestock, date, and production values before saving.", side: "top" as const, align: "center" as const } },
                { element: '[data-tour="production-wizard-certification"]', popover: { title: "Confirm the declaration", description: "Check this confirmation only when the information reflects what you are reporting.", side: "top" as const, align: "center" as const } },
                { element: '[data-tour="production-wizard-submit"]', popover: { title: "Save farm log", description: "Your production log is saved for your own history. Meat entries also send a separate slaughter notice for official review.", side: "top" as const, align: "center" as const } },
              ]),
      ...(step < 3
        ? [{
            element: '[data-tour="production-wizard-continue"]',
            popover: { title: "Continue when ready", description: "Complete the required fields to move forward. Your record is saved only after final submission.", side: "top" as const, align: "end" as const },
          }]
        : []),
    ];

    startGuidedTutorial({
      showProgress: true,
      animate: true,
      allowClose: true,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Finish",
      progressText: "{{current}} of {{total}}",
      steps,
    });
  }, [step]);

  useEffect(() => {
    if (!open) {
      autoTutorialStarted.current = false;
      return;
    }
    if (mode !== "create" || !getAutomaticTutorialsEnabled() || autoTutorialStarted.current) return;
    const timer = window.setTimeout(() => {
      autoTutorialStarted.current = true;
      startWizardTour();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [mode, open, startWizardTour]);
  const slaughterCandidates = approvedInventories.filter(item => item.quantity === 1 &&
    (clickedInventory?.batchId ? item.batchId === clickedInventory.batchId : item.id === clickedInventory?.id));

  const livestockProductionTypes = getProductionTypesForLivestock(clickedInventory?.livestockTypeName);
  const availableTypes = fixedProductionType
    ? livestockProductionTypes.filter((type) => type === fixedProductionType)
    : livestockProductionTypes;
  const selectorInventories = productionType === "milk"
    ? approvedInventories.filter((item) => {
        const sex = item.sex?.trim().toLowerCase();
        const isFemale = sex === "f" || sex === "female";
        const isOldEnough = item.ageClassification !== "CALF" && item.ageClassification !== "YEARLING";
        return getProductionTypesForLivestock(item.livestockTypeName).includes("milk") && isFemale && isOldEnough;
      })
    : approvedInventories;
  const meta = typeMeta[productionType] ?? typeMeta[availableTypes[0]] ?? typeMeta.milk;

  const milkHistory = clickedInventory?.entryType === "INDIVIDUAL"
    ? productionRecords.filter((record) =>
        record.livestockId === Number(clickedInventory.id)
        && record.productionType === "milk"
        && record.status === "RECORDED"
        && record.id !== editingRecord?.id
        && record.recordDate < String(formState.prodDate ?? new Date().toISOString().slice(0, 10)),
      )
    : [];
  const milkHistoryDates = [...new Set(milkHistory.map((record) => record.recordDate))].sort();
  const milkHistoryDays = milkHistoryDates.length;
  const milkHistoryProgress = Math.min(milkHistoryDays, 5);
  const latestMilkDate = milkHistoryDates[milkHistoryDates.length - 1];
  const assessmentDate = new Date(`${String(formState.prodDate ?? new Date().toISOString().slice(0, 10))}T00:00:00Z`);
  const latestHistoryDate = latestMilkDate ? new Date(`${latestMilkDate}T00:00:00Z`) : null;
  const milkHistoryGapDays = latestHistoryDate
    ? Math.floor((assessmentDate.getTime() - latestHistoryDate.getTime()) / 86_400_000)
    : null;

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
        payload.milking_session = formState.milkTime.toUpperCase() as ProductionPayload["milking_session"];
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
  const handleBack = () => setStep((s) => Math.max(s - 1, minimumStep));

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
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] sm:w-full sm:max-w-4xl sm:max-h-[90dvh] flex flex-col overflow-hidden p-0 gap-0 rounded-2xl sm:rounded-3xl border-0 shadow-2xl bg-slate-50">
        <DialogHeader className="relative overflow-hidden shrink-0 px-4 py-4 sm:px-6 sm:py-5 md:px-7 md:py-6 pr-12 sm:pr-14 md:pr-16 text-left bg-gradient-to-r from-[#244a20] via-[#2D5A27] to-[#3E7A36] text-white">
          <div className="absolute -right-12 -top-16 size-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-3 sm:gap-3.5 min-w-0">
          <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
            <div className="size-9 sm:size-11 rounded-xl sm:rounded-2xl bg-white/15 flex items-center justify-center shrink-0 border border-white/15">
              <Sparkles className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg sm:text-xl md:text-2xl font-black text-white leading-tight break-words">
                {profileMode
                  ? `Record ${meta.label} for ${clickedInventory?.tagNumber || "this livestock"}`
                  : mode === "edit" ? "Correct Production Entry" : "New Production Entry"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-white/80 mt-1 leading-normal break-words">
                {mode === "edit"
                  ? "Update your farm log details and save the correction."
                  : profileMode
                    ? "Enter this animal’s production details, then save your farm log."
                    : "Reporting is optional. Your production entry is saved in your own farm history."}
              </DialogDescription>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={startWizardTour} className="min-h-10 shrink-0 gap-1.5 rounded-xl border-white/30 bg-white/10 px-2.5 text-white hover:bg-white/20 hover:text-white sm:px-3">
            <Sparkles className="size-4" aria-hidden="true" /> <span className="hidden xs:inline">Tutorial</span>
          </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 md:p-7">
          <div data-tour="production-wizard-progress" className={cn("grid gap-1 sm:gap-2.5 mb-4 sm:mb-5", profileMode ? "grid-cols-2" : "grid-cols-4")}>
            {(profileMode ? ["Details", "Review"] : STEP_LABELS).map((label, visibleIndex) => {
              const i = profileMode ? visibleIndex + 2 : visibleIndex;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div
                  key={label}
                  className={cn(
                    "rounded-xl sm:rounded-2xl border px-1 py-1.5 sm:px-3 sm:py-2.5 transition-colors",
                    isActive && "border-[#2D5A27] bg-white shadow-xs sm:shadow-sm",
                    isDone && "border-emerald-200 bg-emerald-50/80",
                    !isDone && !isActive && "border-slate-200 bg-slate-100/60",
                  )}
                >
                  <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2">
                    <div
                      className={cn(
                        "size-6 sm:size-7 rounded-lg sm:rounded-xl flex items-center justify-center text-[10px] sm:text-[11px] font-black transition-colors shrink-0",
                        isDone && "bg-emerald-600 text-white",
                        isActive && "bg-[#2D5A27] text-white ring-2 sm:ring-4 ring-[#2D5A27]/15",
                        !isDone && !isActive && "bg-slate-200 text-slate-500",
                      )}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" /> : i + 1}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] sm:text-xs font-bold leading-tight truncate max-w-full text-center sm:text-left",
                        isActive || isDone ? "text-slate-900" : "text-slate-400",
                      )}
                    >
                      <span className="sm:hidden">{profileMode ? (visibleIndex === 0 ? "Details" : "Review") : STEP_SHORT_LABELS[i]}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mb-3.5 sm:mb-4 px-1 py-1">
            <div
              className={cn(
                "p-2 sm:p-2.5 rounded-xl shrink-0",
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
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words">
                {step === 0
                  ? "Select Approved Livestock"
                  : step === 1
                    ? "Select Production Type"
                    : typeTitle}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 break-words">
                Step {profileMode ? step - 1 : step + 1} of {profileMode ? 2 : STEP_LABELS.length} · Complete the information below
              </p>
            </div>
          </div>

          {step === 0 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">Only MAO-approved, active livestock with a positive head count can be selected. Meat output is recorded in kilograms; animal deaths belong in Mortality.</p>
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
                    data-tour="production-wizard-livestock"
                    type="button"
                    onClick={() => setSelectOpen(true)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3.5 sm:px-5 py-3.5 sm:py-4 rounded-2xl border-2 text-left transition-all bg-white cursor-pointer",
                      clickedInventory
                        ? "border-[#2D5A27] bg-[#2D5A27]/5"
                        : "border-dashed border-slate-300 bg-white hover:border-slate-400",
                    )}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className={cn(
                        "size-10 sm:size-11 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0",
                        clickedInventory ? "bg-[#2D5A27] text-white" : "bg-slate-100 text-slate-500",
                      )}>
                        <Tag className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                      {clickedInventory ? (
                        <>
                          <p className="text-sm font-bold text-slate-900 whitespace-normal break-words">
                            {clickedInventory.entryType === "INDIVIDUAL"
                              ? clickedInventory.tagNumber || "Un-tagged"
                              : `Batch #${clickedInventory.id} (${clickedInventory.quantity} heads)`}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 whitespace-normal break-words">
                            {clickedInventory.livestockTypeName} • {clickedInventory.breed || "Standard Breed"} • {clickedInventory.sex}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-slate-700">Tap to select livestock</p>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">Link a batch or animal to this record</p>
                        </>
                      )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {clickedInventory && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2D5A27]">
                          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden xs:inline">Selected</span>
                        </span>
                      )}
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    </div>
                  </button>
                  <div className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-100 px-3 sm:px-3.5 py-2.5 sm:py-3 text-xs text-sky-900 leading-relaxed">
                    <Info className="size-4 shrink-0 mt-0.5" />
                    <span>Only MAO-approved livestock can be used as the source of a production declaration.</span>
                  </div>

                  <SelectLivestockDialog
                    open={selectOpen}
                    onOpenChange={setSelectOpen}
                    items={selectorInventories}
                    selectedId={clickedInventory?.id ?? null}
                    productionType={productionType}
                    onSelect={handleSelectInventory}
                    excludeSibatVerifiedDisease
                  />
                </>
              )}
            </div>
          )}

          {step === 1 && (
            <div
              data-tour="production-wizard-types"
              className={cn(
                "grid gap-3 sm:gap-3.5",
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
                      "p-4 sm:p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer min-h-[44px]",
                      isActive
                        ? "border-[#2D5A27] bg-[#2D5A27]/5 shadow-sm ring-1 ring-[#2D5A27]/30"
                        : "border-slate-200 hover:border-[#2D5A27]/40 bg-white hover:bg-slate-50/70",
                    )}
                  >
                    <div
                      className={cn(
                        "p-2.5 sm:p-3 rounded-xl w-fit mb-2.5 sm:mb-3 transition-colors",
                        isActive ? "bg-[#2D5A27] text-white" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      <TIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm sm:text-base font-bold text-slate-900 whitespace-normal break-words">{typeMeta[t]?.label ?? t}</p>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2D5A27] shrink-0">
                          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed break-words">{typeMeta[t]?.desc ?? ""}</p>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <form
              className="space-y-4 sm:space-y-5 bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-5 shadow-xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (canContinue) handleNext();
              }}
            >
              <div data-tour="production-wizard-date" className="space-y-2">
                <Label htmlFor="prodDate" className="text-xs font-bold text-slate-700">{productionType === "meat" ? "Slaughter date" : "Date"}</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="prodDate"
                    name="prodDate"
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    className="pl-10 h-11 min-h-[44px] rounded-xl border-slate-200"
                    value={String(formState.prodDate ?? new Date().toISOString().split("T")[0])}
                    onChange={(e) => onFieldChange("prodDate", e.target.value)}
                  />
                </div>
              </div>

              {productionType === "milk" && clickedInventory?.entryType === "INDIVIDUAL" && (
                <section className="space-y-2.5 rounded-xl border border-sky-200 bg-sky-50/70 p-3.5" aria-label="Milk anomaly assessment readiness">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-sky-950">Milk anomaly assessment readiness</p>
                    <span className="text-xs font-bold text-sky-900">
                      {isLoadingProductionRecords ? "Loading…" : `${milkHistoryProgress}/5 days`}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Recorded milk history days"
                    aria-valuemin={0}
                    aria-valuemax={5}
                    aria-valuenow={isLoadingProductionRecords ? 0 : milkHistoryProgress}
                    className="h-2 overflow-hidden rounded-full bg-sky-100"
                  >
                    <div
                      className="h-full rounded-full bg-sky-600 transition-[width] duration-300"
                      style={{ width: `${isLoadingProductionRecords ? 0 : (milkHistoryProgress / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-sky-900">
                    {isLoadingProductionRecords
                      ? "Checking this animal’s recorded milk history."
                      : milkHistoryDays < 5
                        ? `Add ${5 - milkHistoryDays} more distinct recorded milk ${5 - milkHistoryDays === 1 ? "day" : "days"} before a cow-specific advisory assessment can run.`
                        : milkHistoryGapDays !== null && milkHistoryGapDays > 45
                          ? `The five-day minimum is met, but the latest recorded milk entry is ${milkHistoryGapDays} days before this entry. History must be within 45 days for automated assessment.`
                          : "The five-day minimum is met. The system will check history recency and valid values before assessing this entry."}
                  </p>
                </section>
              )}

              {productionType === "meat" && (
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-slate-700">Animals slaughtered ({selectedAnimalIds.length} selected)</Label>
                  <p className="text-xs text-slate-500 leading-relaxed">Select the exact animals. Their inventory changes only after MAO approval; unselected herd members remain active.</p>
                  <div className="max-h-56 sm:max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {slaughterCandidates.map(animal => (
                      <label key={animal.id} className="flex min-h-12 items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50/80 transition-colors">
                        <Checkbox
                          checked={selectedAnimalIds.includes(Number(animal.id))}
                          disabled={animal.id === clickedInventory?.id}
                          onCheckedChange={checked => setSelectedAnimalIds(ids => checked
                            ? [...new Set([...ids, Number(animal.id)])] : ids.filter(id => id !== Number(animal.id)))}
                        />
                        <span className="text-sm font-medium min-w-0 flex-1 truncate">{animal.tagNumber || `Animal #${animal.id}`}<span className="block text-xs font-normal text-slate-500 truncate">{animal.batchCode || animal.livestockTypeName}</span></span>
                      </label>
                    ))}
                  </div>
                  {slaughterCandidates.length === 0 && <p className="text-sm text-amber-700">No eligible individual animals are available. Aggregate head counts cannot identify slaughtered animals.</p>}
                </div>
              )}
              <div data-tour="production-wizard-fields">
                <ProductionFormFields
                  type={productionType}
                  value={formState}
                  onChange={onFieldChange}
                />
              </div>

              <div data-tour="production-wizard-notes" className="space-y-2">
                <Label htmlFor="notes" className="text-xs font-bold text-slate-700">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  maxLength={500}
                  placeholder="Optional notes for your farm history..."
                  className="rounded-xl border-slate-200 min-h-[80px]"
                  value={String(formState.notes ?? "")}
                  onChange={(e) => onFieldChange("notes", e.target.value)}
                />
              </div>
              {validationMessage && (
                <div className="flex items-start sm:items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 break-words leading-relaxed">
                  <Info className="size-4 shrink-0 mt-0.5 sm:mt-0" />
                  <span>{validationMessage}</span>
                </div>
              )}
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div data-tour="production-wizard-review" className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-xs">
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
                {productionType === "meat" && (
                  <ReviewRow
                    label={`Animals slaughtered (${selectedAnimalIds.length})`}
                    value={
                      slaughterCandidates
                        .filter(animal => selectedAnimalIds.includes(Number(animal.id)))
                        .map(animal => animal.tagNumber || `Animal #${animal.id}`)
                        .join(", ") || "—"
                    }
                  />
                )}
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
              <div data-tour="production-wizard-certification" className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200">
                <Checkbox
                  id="certify-production"
                  checked={isCertified}
                  onCheckedChange={(checked) => setIsCertified(checked === true)}
                  className="mt-0.5 shrink-0 border-emerald-600 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27] cursor-pointer"
                />
                <label
                  htmlFor="certify-production"
                  className="min-w-0 flex-1 text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed cursor-pointer select-none"
                >
                  I confirm this farm log reflects the information available to me. A meat entry also sends a separate farmer-reported slaughter notice for official review.
                </label>
              </div>

              <Button
                data-tour="production-wizard-submit"
                onClick={handleSubmit}
                disabled={isSubmitting || !isCertified}
                className="w-full h-12 min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white gap-2 font-bold shadow-sm cursor-pointer disabled:opacity-50 text-sm sm:text-base"
              >
                <Send className="w-4 h-4" />
                {isSubmitting
                  ? "Saving..."
                  : mode === "edit"
                  ? "Update Record"
                  : "Save Record"}
              </Button>
              <p className="text-[11px] text-slate-500 text-center leading-normal">
                Production log: saved to your history{productionType === "meat" ? "; slaughter report: separate official review" : ""}
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                className="w-full sm:w-auto mx-auto min-h-[44px] gap-1.5 text-slate-600 hover:text-slate-900"
              >
                <ChevronLeft className="w-4 h-4" /> Back to details
              </Button>
            </div>
          )}

          {step < 3 && (
            <div className="flex items-center justify-between gap-2 sm:gap-3 mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-slate-200">
              <div className="min-w-[80px] sm:min-w-[88px]">
              {step > minimumStep && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  className="h-10 sm:h-11 min-h-[40px] sm:min-h-[44px] px-2.5 sm:px-4 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:text-slate-900 gap-1 sm:gap-1.5"
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
                data-tour="production-wizard-continue"
                onClick={handleNext}
                disabled={!canContinue}
                className="h-10 sm:h-11 min-h-[40px] sm:min-h-[44px] px-4 sm:px-6 rounded-xl bg-[#2D5A27] hover:bg-[#244a20] text-white gap-1.5 sm:gap-2 font-bold text-xs sm:text-sm shadow-xs min-w-[96px] sm:min-w-[112px]"
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
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4 px-3.5 sm:px-4 py-2.5 sm:py-3">
      <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500 sm:text-slate-400 shrink-0">
        {label}
      </span>
      <span className="text-sm font-medium text-slate-900 text-left sm:text-right min-w-0 break-words whitespace-normal">
        {value}
        {sub && (
          <span className="block text-xs font-normal text-slate-500 mt-0.5 break-words whitespace-normal">
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}
