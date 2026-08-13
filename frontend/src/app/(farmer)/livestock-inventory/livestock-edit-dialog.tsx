"use client";

import { useState } from "react";
import { Layers, Minus, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
import type { EntryType, LivestockInventoryItem } from "./page";

export interface UpdateInventoryPayload {
  livestock_type: number;
  entry_type: EntryType;
  quantity: number;
  tag_number: string;
  breed: string;
  sex: string;
  weight: number | null;
  last_vaccination_date: string | null;
}

const statusClasses: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
};

interface FormState {
  entryType: EntryType;
  livestockType: string;
  quantity: number;
  tagNumber: string;
  breed: string;
  sex: string;
  weight: string;
  isVaccinated: boolean;
  lastVaccinationDate: string;
}

const toFormState = (item: LivestockInventoryItem): FormState => ({
  entryType: item.entryType,
  livestockType: item.livestockTypeName,
  quantity: item.quantity,
  tagNumber: item.tagNumber,
  breed: item.breed,
  sex: item.sex,
  weight: item.weight != null ? String(item.weight) : "",
  isVaccinated: !!item.lastVaccinationDate,
  lastVaccinationDate: item.lastVaccinationDate ?? "",
});

const EMPTY_FORM: FormState = {
  entryType: "BATCH",
  livestockType: "",
  quantity: 1,
  tagNumber: "",
  breed: "",
  sex: "Female",
  weight: "",
  isVaccinated: false,
  lastVaccinationDate: "",
};

interface LivestockEditDialogProps {
  item: LivestockInventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  livestockTypes: Record<string, number>;
  isSubmitting: boolean;
  onSubmit: (payload: UpdateInventoryPayload) => void;
}

export default function LivestockEditDialog({
  item,
  open,
  onOpenChange,
  livestockTypes,
  isSubmitting,
  onSubmit,
}: LivestockEditDialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    item ? toFormState(item) : EMPTY_FORM
  );
  const [formError, setFormError] = useState("");

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!item) return;

    if (form.entryType === "INDIVIDUAL" && !form.tagNumber.trim()) {
      setFormError("Tag number is required for individual entries.");
      return;
    }
    if (form.entryType === "BATCH" && (!form.quantity || form.quantity < 1)) {
      setFormError("Quantity must be at least 1 for batch entries.");
      return;
    }
    if (!form.breed.trim()) {
      setFormError("Breed is required.");
      return;
    }
    if (form.isVaccinated && !form.lastVaccinationDate) {
      setFormError("Please provide the last vaccination date or uncheck 'Vaccinated'.");
      return;
    }

    onSubmit({
      livestock_type: livestockTypes[form.livestockType],
      entry_type: form.entryType,
      quantity: form.entryType === "INDIVIDUAL" ? 1 : Number(form.quantity),
      tag_number: form.tagNumber || "",
      breed: form.breed,
      sex: form.sex,
      weight: form.weight ? parseFloat(form.weight) : null,
      last_vaccination_date: form.lastVaccinationDate || null,
    });
  };

  const headerTitle = item
    ? item.entryType === "INDIVIDUAL"
      ? item.tagNumber || "Un-tagged"
      : `${item.quantity}x ${item.livestockTypeName} (Batch)`
    : "";

  return (
    <Dialog open={open && !!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl max-h-[90vh] overflow-y-auto [&>button]:text-white/70 [&>button]:hover:text-white">
        <DialogHeader className="hidden">
          <DialogTitle>Edit Livestock Entry</DialogTitle>
          <DialogDescription>Update the details of this livestock entry</DialogDescription>
        </DialogHeader>

        {item ? (
          <>
            <div className="bg-gradient-to-r from-[#2D5A27] to-[#3E7A36] text-white px-6 pt-6 pb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="shrink-0 p-3 rounded-2xl bg-white/15 backdrop-blur-sm">
                    <Layers className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-xl font-bold text-white leading-tight">
                      {headerTitle}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-white/80 mt-1">
                      {[item.livestockTypeName, item.breed, item.sex]
                        .filter(Boolean)
                        .join(" • ")}
                    </DialogDescription>
                  </div>
                </div>
                <Badge
                  className={`shrink-0 uppercase tracking-wider bg-white text-slate-800 border-0 hover:bg-white ${(statusClasses[item.status] ?? "").split(" ")[0]}`}
                >
                  {item.status}
                </Badge>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editEntryType">Entry Type</Label>
                  <Select
                    value={form.entryType}
                    onValueChange={(val: EntryType) => set({ entryType: val })}
                  >
                    <SelectTrigger id="editEntryType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BATCH">Batch Entry</SelectItem>
                      <SelectItem value="INDIVIDUAL">Individual Tag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editLivestockType">Livestock Type</Label>
                  <Select
                    value={form.livestockType}
                    onValueChange={(val) => set({ livestockType: val })}
                  >
                    <SelectTrigger id="editLivestockType">
                      <SelectValue placeholder="Select animal" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(livestockTypes).map(([name, id]) => (
                        <SelectItem key={id} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.entryType === "INDIVIDUAL" ? (
                <div className="space-y-2">
                  <Label htmlFor="editTagNumber">Ear Tag / ID Number</Label>
                  <Input
                    id="editTagNumber"
                    placeholder="e.g. TAG-2026-88"
                    value={form.tagNumber}
                    onChange={(e) => set({ tagNumber: e.target.value })}
                    required
                  />
                </div>
              ) : (
                <div className="space-y-3 p-4 rounded-[10px] border border-slate-200">
                  <Label htmlFor="editQuantity">Number of Heads</Label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => set({ quantity: Math.max(1, form.quantity - 1) })}
                      className="size-12 flex items-center justify-center rounded-xl border-2 border-[#2D5A27] bg-white text-[#2D5A27] hover:bg-[#2D5A27] hover:text-white transition-colors active:scale-95"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-4xl font-black text-slate-900 tabular-nums">
                        {form.quantity}
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">
                        head{form.quantity !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => set({ quantity: form.quantity + 1 })}
                      className="size-12 flex items-center justify-center rounded-xl border-2 border-[#2D5A27] bg-[#2D5A27] text-white hover:bg-[#2D5A27]/90 transition-colors active:scale-95"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editBreed">Breed</Label>
                  <Input
                    id="editBreed"
                    placeholder="e.g. Brahman, Holstein"
                    value={form.breed}
                    onChange={(e) => set({ breed: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editSex">Sex / Gender</Label>
                  <Select value={form.sex} onValueChange={(val) => set({ sex: val })}>
                    <SelectTrigger id="editSex">
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Mixed">Mixed (Batch)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {form.entryType === "INDIVIDUAL" && (
                  <div className="space-y-2">
                    <Label htmlFor="editWeight">Weight (kg)</Label>
                    <Input
                      id="editWeight"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.weight}
                      onChange={(e) => set({ weight: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="editIsVaccinated"
                      checked={form.isVaccinated}
                      onCheckedChange={(checked) =>
                        set({
                          isVaccinated: !!checked,
                          lastVaccinationDate: checked ? form.lastVaccinationDate : "",
                        })
                      }
                    />
                    <Label
                      htmlFor="editIsVaccinated"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Vaccinated
                    </Label>
                  </div>
                  {form.isVaccinated && (
                    <div className="space-y-2">
                      <Label htmlFor="editVaxDate">Last Vaccination Date</Label>
                      <Input
                        id="editVaxDate"
                        type="date"
                        className="flex w-full"
                        value={form.lastVaccinationDate}
                        onChange={(e) => set({ lastVaccinationDate: e.target.value })}
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    "Saving..."
                  ) : (
                    <>
                      <Pencil className="w-4 h-4" /> Save Changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
