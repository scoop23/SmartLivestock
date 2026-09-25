"use client";

import { useState, useEffect } from "react";
import { Layers, Pencil, Tag } from "lucide-react";
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
import { useLivestockBatches } from "./livestock-inventory";

export interface UpdateInventoryPayload {
  livestock_type: number;
  entry_type: EntryType;
  quantity: number;
  tag_number: string;
  breed: string;
  sex: string;
  weight: number | null;
  last_vaccination_date: string | null;
  batch?: number | null;
}

const statusClasses: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  VERIFIED: "bg-sky-100 text-sky-800 border-sky-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  SUBJECT_TO_REVISION: "bg-amber-100 text-amber-900 border-amber-300",
  REJECTED: "bg-amber-100 text-amber-900 border-amber-300",
};

interface FormState {
  batchId: string;
  livestockType: string;
  tagNumber: string;
  breed: string;
  sex: string;
  weight: string;
  isVaccinated: boolean;
  lastVaccinationDate: string;
}

const toFormState = (item: LivestockInventoryItem): FormState => ({
  batchId: item.batchId ? String(item.batchId) : "",
  livestockType: item.livestockTypeName,
  tagNumber: item.tagNumber || "",
  breed: item.breed || "",
  sex: item.sex || "Female",
  weight: item.weight != null ? String(item.weight) : "",
  isVaccinated: !!item.lastVaccinationDate,
  lastVaccinationDate: item.lastVaccinationDate ?? "",
});

const EMPTY_FORM: FormState = {
  batchId: "",
  livestockType: "",
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
  const { data: batches = [] } = useLivestockBatches();
  const [form, setForm] = useState<FormState>(() =>
    item ? toFormState(item) : EMPTY_FORM
  );
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (item) {
      setForm(toFormState(item));
      setFormError("");
    }
  }, [item]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!item) return;

    if (!form.tagNumber.trim()) {
      setFormError("Ear tag / ID number is required.");
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

    const typeId = livestockTypes[form.livestockType];
    if (!typeId) {
      setFormError("Please select a valid livestock species type.");
      return;
    }

    onSubmit({
      livestock_type: typeId,
      entry_type: "INDIVIDUAL",
      quantity: 1,
      tag_number: form.tagNumber.trim(),
      batch: form.batchId ? Number(form.batchId) : null,
      breed: form.breed.trim(),
      sex: form.sex,
      weight: form.weight ? parseFloat(form.weight) : null,
      last_vaccination_date: form.lastVaccinationDate || null,
    });
  };

  const headerTitle = item
    ? item.tagNumber || `Tagged #${item.id}`
    : "Edit Livestock";

  return (
    <Dialog open={open && !!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl max-h-[90vh] overflow-y-auto [&>button]:text-white/70 [&>button]:hover:text-white">
        <DialogHeader className="hidden">
          <DialogTitle>Edit Livestock Entry</DialogTitle>
          <DialogDescription>Update the details of this individual animal</DialogDescription>
        </DialogHeader>

        {item ? (
          <>
            <div className="bg-gradient-to-r from-[#2D5A27] to-[#3E7A36] text-white px-6 pt-6 pb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="shrink-0 p-3 rounded-2xl bg-white/15 backdrop-blur-sm">
                    <Tag className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-xl font-bold text-white leading-tight">
                      {headerTitle}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-white/80 mt-1">
                      {[item.livestockTypeName, item.breed, item.sex]
                        .filter(Boolean)
                        .join(" • ")}
                      {item.batchCode ? ` • Cohort: ${item.batchCode}` : ""}
                    </DialogDescription>
                  </div>
                </div>
                <Badge
                  className={`shrink-0 uppercase tracking-wider bg-white text-slate-800 border-0 hover:bg-white ${(statusClasses[item.status] ?? "").split(" ")[0]}`}
                >
                  {item.status === "VERIFIED"
                    ? "Verified by SIBAT"
                    : (item.status === "SUBJECT_TO_REVISION" || item.status === "REJECTED")
                    ? "Subject to Revision"
                    : item.status}
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
                  <Label htmlFor="editTagNumber">Ear Tag / ID Number</Label>
                  <Input
                    id="editTagNumber"
                    placeholder="e.g. TAG-2026-88"
                    value={form.tagNumber}
                    onChange={(e) => set({ tagNumber: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editLivestockType">Livestock Species</Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editBatch">Assigned Cohort / Batch</Label>
                  <Select
                    value={form.batchId || "none"}
                    onValueChange={(val) => set({ batchId: val === "none" ? "" : val })}
                  >
                    <SelectTrigger id="editBatch">
                      <SelectValue placeholder="Select cohort (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Standalone (No Batch)</SelectItem>
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.batchCode} ({b.batchName || b.livestockTypeName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editBreed">Breed</Label>
                  <Input
                    id="editBreed"
                    placeholder="e.g. Brahman, Holstein"
                    value={form.breed}
                    onChange={(e) => set({ breed: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editSex">Sex / Gender</Label>
                  <Select value={form.sex} onValueChange={(val) => set({ sex: val })}>
                    <SelectTrigger id="editSex">
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Castrated">Castrated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editWeight">Scale Weight (kg)</Label>
                  <Input
                    id="editWeight"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.weight}
                    onChange={(e) => set({ weight: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
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
                    className="text-sm font-semibold cursor-pointer"
                  >
                    Immunization / Vaccination Recorded
                  </Label>
                </div>
                {form.isVaccinated && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="editVaxDate" className="text-xs font-bold text-slate-600">
                      Last Vaccination Date
                    </Label>
                    <Input
                      id="editVaxDate"
                      type="date"
                      max={new Date().toISOString().split("T")[0]}
                      className="flex w-full bg-white"
                      value={form.lastVaccinationDate}
                      onChange={(e) => set({ lastVaccinationDate: e.target.value })}
                      required
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2 font-bold"
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
