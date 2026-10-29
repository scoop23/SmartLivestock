"use client";

import { LivestockBreedField } from "@/components/livestock-breed-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/axios";
import { localCalendarDateToday } from "@/lib/livestock-age";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Pencil, Pill, Plus, Syringe, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { EntryType, LivestockInventoryItem } from "./page";

interface TreatmentRecordItem {
  id: number;
  livestock: number;
  treatment_date: string;
  treatment_type: string;
  medication_name: string;
  dosage?: string | null;
  route_of_administration?: string | null;
  administered_by?: string | null;
  reason?: string | null;
  follow_up_date?: string | null;
  notes?: string | null;
}

const TREATMENT_TYPE_LABELS: Record<string, string> = {
  VACCINATION: "Vaccination / Immunization",
  ANTIBIOTIC: "Antibiotic / Anti-infective",
  DEWORMING: "Deworming / Antiparasitic",
  VITAMIN_SUPPLEMENT: "Vitamin / Mineral Supplement",
  WOUND_CARE: "Wound Care / Antiseptic",
  REPRODUCTIVE_THERAPY: "Reproductive / Hormonal",
  CASTRATION: "Castration / Surgical Neutering",
  OTHER: "Other Clinical Treatment",
};

export interface UpdateInventoryPayload {
  livestock_type: number;
  entry_type: EntryType;
  quantity: number;
  tag_number: string;
  breed: string;
  sex: string;
  birth_date: string | null;
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
  birthDate: string;
  weight: string;
  lastVaccinationDate: string;
}

const toFormState = (item: LivestockInventoryItem): FormState => ({
  batchId: item.batchId ? String(item.batchId) : "",
  livestockType: item.livestockTypeName,
  tagNumber: item.tagNumber || "",
  breed: item.breed || "",
  sex: item.sex || "Female",
  birthDate: item.birthDate ?? "",
  weight: item.weight != null ? String(item.weight) : "",
  lastVaccinationDate: item.lastVaccinationDate ?? "",
});

const EMPTY_FORM: FormState = {
  batchId: "",
  livestockType: "",
  tagNumber: "",
  breed: "",
  sex: "Female",
  birthDate: "",
  weight: "",
  lastVaccinationDate: "",
};

interface LivestockEditDialogProps {
  item: LivestockInventoryItem | null;
  open: boolean;
  /** Hide birth date when this dialog is opened from Health & Vaccinations. */
  hideBirthDate?: boolean;
  onOpenChange: (open: boolean) => void;
  livestockTypes: Record<string, number>;
  isSubmitting: boolean;
  onSubmit: (payload: UpdateInventoryPayload) => void;
}

export default function LivestockEditDialog(props: LivestockEditDialogProps) {
  return <LivestockEditDialogContent key={`${props.open}:${props.item?.id}`} {...props} />;
}

function LivestockEditDialogContent({
  item,
  open,
  hideBirthDate = false,
  onOpenChange,
  livestockTypes,
  isSubmitting,
  onSubmit,
}: LivestockEditDialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    item ? toFormState(item) : EMPTY_FORM
  );
  const [formError, setFormError] = useState("");
  const queryClient = useQueryClient();

  const [isTreatmentPopupOpen, setIsTreatmentPopupOpen] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({
    treatment_date: localCalendarDateToday(),
    treatment_type: "VACCINATION",
    medication_name: "",
    dosage: "",
    route_of_administration: "Intramuscular (IM)",
    administered_by: "",
    reason: "",
    follow_up_date: "",
    notes: "",
  });

  const { data: allTreatments = [] } = useQuery<TreatmentRecordItem[]>({
    queryKey: ["treatments"],
    queryFn: async () => {
      const res = await api.get("production/treatments/");
      return Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    },
    enabled: open && !!item?.id,
  });

  const animalTreatments = item
    ? allTreatments.filter((t) => Number(t.livestock) === Number(item.id))
    : [];

  const logTreatmentMutation = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error("No animal selected.");
      const res = await api.post("production/treatments/", {
        livestock: item.id,
        treatment_date: treatmentForm.treatment_date,
        treatment_type: treatmentForm.treatment_type,
        medication_name: treatmentForm.medication_name.trim(),
        dosage: treatmentForm.dosage.trim(),
        route_of_administration: treatmentForm.route_of_administration,
        administered_by: treatmentForm.administered_by.trim(),
        reason: treatmentForm.reason.trim(),
        follow_up_date: treatmentForm.follow_up_date || null,
        notes: treatmentForm.notes.trim(),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Clinical treatment logged for this animal.");
      if (
        treatmentForm.treatment_type === "VACCINATION" &&
        treatmentForm.treatment_date &&
        (!form.lastVaccinationDate || treatmentForm.treatment_date >= form.lastVaccinationDate)
      ) {
        set({ lastVaccinationDate: treatmentForm.treatment_date });
      }
      queryClient.invalidateQueries({ queryKey: ["treatments"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["user_inventory"] });
      if (item?.id) {
        queryClient.invalidateQueries({ queryKey: ["livestock_reproductive_summary", item.id] });
      }
      setIsTreatmentPopupOpen(false);
      setTreatmentForm({
        treatment_date: localCalendarDateToday(),
        treatment_type: "VACCINATION",
        medication_name: "",
        dosage: "",
        route_of_administration: "Intramuscular (IM)",
        administered_by: "",
        reason: "",
        follow_up_date: "",
        notes: "",
      });
    },
    onError: (err: unknown) => {
      const maybeAxios = err as { response?: { data?: Record<string, unknown> } };
      const detail =
        (typeof maybeAxios?.response?.data?.detail === "string" && maybeAxios.response.data.detail) ||
        "Failed to log clinical treatment. Please verify the inputs.";
      toast.error(detail);
    },
  });



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
      // Keep the existing herd relationship when this dialog edits animal details.
      batch: form.batchId ? Number(form.batchId) : null,
      breed: form.breed.trim(),
      sex: form.sex,
      birth_date: form.birthDate || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      last_vaccination_date: form.lastVaccinationDate || null,
    });
  };

  const headerTitle = item
    ? item.tagNumber || `Tagged #${item.id}`
    : "Edit Livestock";

  return (
    <>
    <Dialog open={open && !!item} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] overflow-y-auto [&>button]:text-white/70 [&>button]:hover:text-white">
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
                      {item.batchCode ? ` • Herd: ${item.batchCode}` : ""}
                    </DialogDescription>
                  </div>
                </div>
                <Badge
                  style={
                    item.status === "VERIFIED"
                      ? { backgroundColor: "#dbeafe", color: "#1e40af", borderColor: "#93c5fd" }
                      : undefined
                  }
                  className={`shrink-0 uppercase tracking-wider border ${
                    statusClasses[item.status] ?? "bg-white text-slate-800 border-0"
                  }`}
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

              {item.status === "SUBJECT_TO_REVISION" && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
                  <p className="font-bold">Reviewer remarks</p>
                  <p className="mt-1 break-words text-xs leading-relaxed">
                    {item.reviewRemarks || "Please correct the livestock details requested by the reviewer."}
                  </p>
                  <p className="mt-2 text-xs text-rose-800">
                    {item.batchId
                      ? "After saving, return to the herd page and resubmit the whole herd."
                      : "Saving these corrections automatically returns this individual record to review."}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editVaxDate">Last Vaccination Date (optional)</Label>
                  <Input
                    id="editVaxDate"
                    type="date"
                    max={localCalendarDateToday()}
                    value={form.lastVaccinationDate}
                    onChange={(e) => set({ lastVaccinationDate: e.target.value })}
                    className="h-11 min-w-0 w-full"
                  />
                </div>
                {!hideBirthDate && (
                  <div className="space-y-2">
                    <Label htmlFor="editBirthDate">Birth Date (optional)</Label>
                    <Input
                      id="editBirthDate"
                      type="date"
                      max={localCalendarDateToday()}
                      value={form.birthDate}
                      onChange={(e) => set({ birthDate: e.target.value })}
                      className="h-11 min-w-0 w-full"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="editTagNumber">Ear Tag / ID Number</Label>
                  <Input
                    id="editTagNumber"
                    placeholder="e.g. NAME-001"
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
                    disabled={!!item.batchId}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <LivestockBreedField
                    id="editBreed"
                    species={form.livestockType}
                    value={form.breed}
                    onChange={(breed) => set({ breed })}
                    required
                    placeholder="Select a breed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editSex">Sex / Gender</Label>
                  <Select value={form.sex} onValueChange={(val) => set({ sex: val })}>
                    <SelectTrigger id="editSex">
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Castrated">Castrated (Steer)</SelectItem>
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

              {/* Clinical Treatments & Medications Section under the Update dialog */}
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                      <Syringe className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                        Clinical Treatments & Medications
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Record vaccinations, deworming, antibiotics, or supplements for {headerTitle}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsTreatmentPopupOpen(true)}
                    className="h-8 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold gap-1.5 rounded-lg shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Log Treatment
                  </Button>
                </div>

                {animalTreatments.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {animalTreatments.slice(0, 4).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 truncate">
                              {t.medication_name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold"
                            >
                              {TREATMENT_TYPE_LABELS[t.treatment_type] || t.treatment_type}
                            </Badge>
                          </div>
                          {(t.dosage || t.route_of_administration || t.reason) && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {[t.dosage, t.route_of_administration, t.reason]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-slate-500 inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {t.treatment_date}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    No clinical treatments recorded for this animal yet. Click &ldquo;Log Treatment&rdquo; to open the treatment popup.
                  </p>
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
                      <Pencil className="w-4 h-4" />
                      {item.status === "SUBJECT_TO_REVISION"
                        ? item.batchId ? "Save Corrections" : "Save Corrections & Resubmit"
                        : "Save Changes"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>

    {/* Treatment Popup Dialog */}
    <Dialog open={isTreatmentPopupOpen && !!item} onOpenChange={setIsTreatmentPopupOpen}>
      <DialogContent
        style={{ maxWidth: "680px" }}
        className="w-[calc(100vw-1rem)] sm:w-[92vw] sm:max-w-[680px] p-0 gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] overflow-y-auto"
      >
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm">
              <Pill className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white">
                Log Clinical Treatment
              </DialogTitle>
              <DialogDescription className="text-xs text-emerald-100 mt-0.5">
                Record veterinary medication, vaccination, or deworming for{" "}
                <span className="font-semibold text-white">{headerTitle}</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!treatmentForm.medication_name.trim()) {
              toast.error("Medication or product name is required.");
              return;
            }
            logTreatmentMutation.mutate();
          }}
          className="px-6 py-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Treatment Date *</Label>
              <Input
                type="date"
                max={localCalendarDateToday()}
                value={treatmentForm.treatment_date}
                onChange={(e) =>
                  setTreatmentForm((p) => ({ ...p, treatment_date: e.target.value }))
                }
                required
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Treatment Category *</Label>
              <Select
                value={treatmentForm.treatment_type}
                onValueChange={(v) =>
                  setTreatmentForm((p) => ({
                    ...p,
                    treatment_type: v,
                  }))
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VACCINATION">Vaccination / Immunization</SelectItem>
                  <SelectItem value="DEWORMING">Deworming / Antiparasitic</SelectItem>
                  <SelectItem value="VITAMIN_SUPPLEMENT">Vitamin / Mineral Supplement</SelectItem>
                  <SelectItem value="ANTIBIOTIC">Antibiotic / Anti-infective</SelectItem>
                  <SelectItem value="WOUND_CARE">Wound Care / Antiseptic</SelectItem>
                  <SelectItem value="REPRODUCTIVE_THERAPY">Reproductive / Hormonal</SelectItem>
                  {["MALE", "M"].includes((item?.sex || "").trim().toUpperCase()) && (
                    <SelectItem value="CASTRATION">Castration / Surgical Neutering</SelectItem>
                  )}
                  <SelectItem value="OTHER">Other Clinical Treatment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {treatmentForm.treatment_type === "CASTRATION" && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-3 text-xs font-medium text-purple-950">
              <strong className="font-bold block mb-0.5">⚲ Automatic Steer Status Update</strong>
              Saving this castration procedure logs the veterinary intervention and automatically updates{" "}
              <span className="font-semibold">{headerTitle}</span>&apos;s sex to{" "}
              <strong>Castrated</strong>, removing him from active bull breeding exposure.
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Medication / Product Name *
            </Label>
            <Input
              placeholder="e.g. Hemorrhagic Septicemia Vaccine, Ivermectin, Oxytetracycline LA"
              value={treatmentForm.medication_name}
              onChange={(e) =>
                setTreatmentForm((p) => ({ ...p, medication_name: e.target.value }))
              }
              required
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Dosage</Label>
              <Input
                placeholder="e.g. 5 mL, 1 bolus"
                value={treatmentForm.dosage}
                onChange={(e) =>
                  setTreatmentForm((p) => ({ ...p, dosage: e.target.value }))
                }
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Route of Administration
              </Label>
              <Select
                value={treatmentForm.route_of_administration}
                onValueChange={(v) =>
                  setTreatmentForm((p) => ({ ...p, route_of_administration: v }))
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Intramuscular (IM)">Intramuscular (IM)</SelectItem>
                  <SelectItem value="Subcutaneous (SC)">Subcutaneous (SC)</SelectItem>
                  <SelectItem value="Oral (Drench/Bolus)">Oral (Drench / Bolus)</SelectItem>
                  <SelectItem value="Topical / Pour-on">Topical / Pour-on</SelectItem>
                  <SelectItem value="Intravenous (IV)">Intravenous (IV)</SelectItem>
                  <SelectItem value="Intrauterine">Intrauterine</SelectItem>
                  <SelectItem value="Surgical / Physical Procedure">Surgical / Physical Procedure</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Administered By (Vet / Technician)
              </Label>
              <Input
                placeholder="e.g. MAO Livestock Technician"
                value={treatmentForm.administered_by}
                onChange={(e) =>
                  setTreatmentForm((p) => ({ ...p, administered_by: e.target.value }))
                }
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Follow-up / Booster Date (optional)
              </Label>
              <Input
                type="date"
                min={treatmentForm.treatment_date || undefined}
                value={treatmentForm.follow_up_date}
                onChange={(e) =>
                  setTreatmentForm((p) => ({ ...p, follow_up_date: e.target.value }))
                }
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Clinical Indication / Reason
            </Label>
            <Input
              placeholder="e.g. Routine immunization, parasite control, post-calving care"
              value={treatmentForm.reason}
              onChange={(e) =>
                setTreatmentForm((p) => ({ ...p, reason: e.target.value }))
              }
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Field Notes (optional)
            </Label>
            <Textarea
              rows={2}
              placeholder="Additional observations or withdrawal period notes..."
              value={treatmentForm.notes}
              onChange={(e) =>
                setTreatmentForm((p) => ({ ...p, notes: e.target.value }))
              }
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTreatmentPopupOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={logTreatmentMutation.isPending || !treatmentForm.medication_name.trim()}
              className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold gap-1.5"
            >
              <Pill className="w-4 h-4" />
              {logTreatmentMutation.isPending ? "Saving Treatment..." : "Save Treatment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
