"use client";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/axios";
import { localCalendarDateToday } from "@/lib/livestock-age";
import { saveAttachedPhoto } from "@/lib/photo-storage";
import { cowHead } from "@lucide/lab";
import { useQueryClient } from "@tanstack/react-query";
import {
Calendar,
Camera,
Icon,
Send,
Skull,
Stethoscope,
X,
} from "lucide-react";
import React,{ useMemo,useState } from "react";
import { toast } from "sonner";
import { useUserInventory } from "../../livestock-inventory/livestock-inventory";
import { FarmerReport,ReportType } from "../report-observation-types";

interface ReportIllnessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: ReportType;
  defaultInventoryId?: string;
  existingReport?: FarmerReport | null;
  mode?: "create" | "edit";
  onSuccess?: () => void;
}

const EASY_SIGNS = [
  { id: "not_eating", label: "Not Eating / Off-Feed", sub: "Refusing food or water" },
  { id: "fever", label: "High Fever / Hot Ears", sub: "Body feels unusually hot" },
  { id: "limping", label: "Limping / Weak Legs", sub: "Difficulty walking or standing" },
  { id: "salivating", label: "Excessive Drooling", sub: "Saliva dripping from mouth" },
  { id: "coughing", label: "Coughing / Runny Nose", sub: "Nasal discharge or wheezing" },
  { id: "bloating", label: "Bloated Belly", sub: "Swollen stomach or gas" },
  { id: "wounds", label: "Skin Sores / Blisters", sub: "Lesions on mouth, feet, or skin" },
  { id: "weak", label: "Lethargic / Weak", sub: "Lying down, isolating from herd" },
];

export const DEFAULT_MORTALITY_CAUSE = "Unknown (Needs Vet Inspection)";

export const EASY_MORTALITY_CAUSES = [
  "Unknown (Needs Vet Inspection)",
  "Sudden Death / Severe Bloat",
  "Severe Respiratory / Lung Infection",
  "Calving / Birthing Complications",
  "Physical Injury / Accident",
  "Old Age / Natural Causes",
];

function ReportIllnessDialogContent({
  onOpenChange,
  defaultType = "DISEASE",
  defaultInventoryId,
  existingReport,
  mode = "create",
  onSuccess,
}: ReportIllnessDialogProps) {
  const queryClient = useQueryClient();
  const { data: inventories = [] } = useUserInventory();
  const isEditMode = mode === "edit" && !!existingReport;

  const reportType = isEditMode && existingReport ? (existingReport.reportType || defaultType) : defaultType;
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>(() => {
    if (isEditMode && existingReport) {
      return String(existingReport.inventoryId || existingReport.rawItem?.livestock || defaultInventoryId || "");
    }
    return defaultInventoryId || (inventories[0] ? String(inventories[0].id) : "");
  });
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>(() => {
    if (isEditMode && existingReport) {
      const affected = existingReport.rawItem && "affected_animals" in existingReport.rawItem
        ? existingReport.rawItem.affected_animals : undefined;
      if (Array.isArray(affected) && affected.length) {
        return affected.map((animal: { id: number }) => String(animal.id));
      }
      const id = existingReport.inventoryId || existingReport.rawItem?.livestock || defaultInventoryId;
      return id ? [String(id)] : [];
    }
    return defaultInventoryId ? [String(defaultInventoryId)] : [];
  });
  const [conditionName, setConditionName] = useState<string>(() => {
    if (isEditMode && existingReport) return existingReport.name || "";
    return defaultType === "MORTALITY" ? DEFAULT_MORTALITY_CAUSE : "";
  });
  const [affectedCount, setAffectedCount] = useState<number>(() =>
    isEditMode && existingReport ? (existingReport.affectedCount || 1) : 1
  );
  const [recordDate, setRecordDate] = useState<string>(() =>
    isEditMode && existingReport ? (existingReport.recordDate || localCalendarDateToday()) : localCalendarDateToday()
  );
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(() =>
    isEditMode && existingReport && Array.isArray(existingReport.symptoms) ? existingReport.symptoms : []
  );
  const [description, setDescription] = useState<string>(() =>
    isEditMode && existingReport && existingReport.description && existingReport.description !== existingReport.name
      ? existingReport.description
      : ""
  );
  const [photoName, setPhotoName] = useState<string>(() =>
    isEditMode && existingReport ? (existingReport.photoName || (existingReport.photoUrl ? "existing_report_photo" : "")) : ""
  );
  const [photoDataUrl, setPhotoDataUrl] = useState<string>(() =>
    isEditMode && existingReport ? (existingReport.photoUrl || "") : ""
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [animalSort, setAnimalSort] = useState<"TYPE" | "TAG" | "OLDEST" | "YOUNGEST">("TYPE");

  const selectedCattle = useMemo(() => {
    return inventories.find((inv) => String(inv.id) === String(selectedInventoryId));
  }, [inventories, selectedInventoryId]);

  const selectableAnimals = useMemo(
    () =>
      inventories.filter(
        (inventory) =>
          inventory.entryType === "INDIVIDUAL" &&
          inventory.quantity === 1 &&
          (inventory.status === "VERIFIED" || inventory.status === "APPROVED") &&
          (reportType !== "MORTALITY" ||
            (inventory.status === "APPROVED" && inventory.operationalStatus === "ACTIVE")),
      ),
    [inventories, reportType],
  );
  const sortedSelectableAnimals = useMemo(
    () => [...selectableAnimals].sort((a, b) => {
      const tagA = a.tagNumber || `Animal #${a.id}`;
      const tagB = b.tagNumber || `Animal #${b.id}`;
      const typeA = a.livestockTypeName || "Livestock";
      const typeB = b.livestockTypeName || "Livestock";
      const tagOrder = () => tagA.localeCompare(tagB) || typeA.localeCompare(typeB);
      if (animalSort === "TYPE") return typeA.localeCompare(typeB) || tagA.localeCompare(tagB);
      if (animalSort === "TAG") return tagOrder();

      const ageA = a.age?.total_months ?? null;
      const ageB = b.age?.total_months ?? null;
      if (ageA === null && ageB !== null) return 1;
      if (ageA !== null && ageB === null) return -1;
      if (ageA !== null && ageB !== null && ageA !== ageB) {
        return animalSort === "OLDEST" ? ageB - ageA : ageA - ageB;
      }
      return tagOrder();
    }),
    [animalSort, selectableAnimals],
  );
  const editableInventoryOptions = selectableAnimals;
  const effectiveInventoryId = selectedInventoryId || (selectableAnimals[0] ? String(selectableAnimals[0].id) : "");
  const selectedAnimals = useMemo(
    () => selectableAnimals.filter((inventory) => selectedInventoryIds.includes(String(inventory.id))),
    [selectableAnimals, selectedInventoryIds],
  );

  const toggleAnimal = (id: string) => {
    setSelectedInventoryIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  };

  const toggleSymptom = (label: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoDataUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
      toast.success(`Photo "${file.name}" attached.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetInventoryIds = isEditMode
      ? reportType === "MORTALITY"
        ? selectedAnimals.map((animal) => String(animal.id))
        : selectableAnimals.some((animal) => String(animal.id) === String(effectiveInventoryId))
          ? [effectiveInventoryId]
          : []
      : selectedAnimals.map((animal) => String(animal.id));

    if (targetInventoryIds.length === 0) {
      toast.error(
        reportType === "MORTALITY"
          ? "Select an approved, active individual animal to report as deceased."
          : "Select at least one verified or approved individual animal from your livestock.",
      );
      return;
    }

    if (recordDate > localCalendarDateToday()) {
      toast.error("Date noticed / occurred cannot be in the future.");
      return;
    }

    if (
      reportType === "DISEASE" &&
      selectedSymptoms.length === 0 &&
      !conditionName.trim()
    ) {
      toast.error("Select at least one observed sign or enter a custom diagnosis.");
      return;
    }

    const mainName =
      conditionName.trim() ||
      (selectedSymptoms.length > 0
        ? selectedSymptoms.join(", ")
        : DEFAULT_MORTALITY_CAUSE);

    setIsSubmitting(true);
    let submittedCount = 0;
    const submittedInventoryIds: string[] = [];

    try {
      // A shared death event is one reviewable report; disease cases retain
      // their existing one-report-per-animal behavior.
      const submissionGroups = reportType === "MORTALITY"
        ? [targetInventoryIds]
        : targetInventoryIds.map((inventoryId) => [inventoryId]);
      for (const inventoryGroup of submissionGroups) {
        const requestData = new FormData();
        if (reportType === "MORTALITY") {
          inventoryGroup.forEach((inventoryId) => requestData.append("livestocks", inventoryId));
        } else {
          requestData.append("livestock", inventoryGroup[0]);
        }
        if (reportType === "DISEASE") {
          requestData.append("name", mainName);
          requestData.append("affected_count", String(isEditMode ? affectedCount : 1));
        } else {
          requestData.append("cause", mainName);
          requestData.append("death_count", String(inventoryGroup.length));
        }
        requestData.append("record_date", recordDate);
        if (description.trim()) requestData.append("description", description.trim());
        if (photoFile) requestData.append("photo", photoFile);

        let response;
        if (isEditMode && existingReport) {
          const endpointId = existingReport.rawItem?.id ?? existingReport.id.replace(/^DIS-|^MOR-/, "");
          const endpoint = reportType === "DISEASE"
            ? `diseases/cases/${endpointId}/`
            : `diseases/mortality/${endpointId}/`;
          response = await api.patch(endpoint, requestData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } else {
          const endpoint = reportType === "DISEASE" ? "diseases/cases/" : "diseases/mortality/";
          response = await api.post(endpoint, requestData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
        submittedCount += reportType === "MORTALITY" ? inventoryGroup.length : 1;
        submittedInventoryIds.push(...inventoryGroup);

        const activeUrl = response.data?.photo_url || response.data?.photo || photoDataUrl;
        if (activeUrl && response.data?.id) {
          const reportPrefix = reportType === "DISEASE" ? "DIS" : "MOR";
          saveAttachedPhoto(`${reportPrefix}-${response.data.id}`, {
            photoUrl: activeUrl,
            photoName: photoName || (isDisease ? "farmer_attached_evidence.jpg" : "mortality_evidence_photo.jpg"),
            timestamp: new Date().toISOString(),
            uploaderRole: "FARMER",
          });
        }
      }

      if (reportType === "DISEASE") {
        queryClient.invalidateQueries({ queryKey: ["farmer-disease-cases"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-disease-cases"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-validation-cases"] });
        queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
        queryClient.invalidateQueries({ queryKey: ["farmer-dashboard-analytics"] });
        toast.success(isEditMode
          ? "Report resubmitted successfully. Your report has been returned to the validation queue."
          : `${submittedCount} disease report${submittedCount === 1 ? "" : "s"} submitted. SIBAT field officers and MAO have been notified.`);
      } else {
        queryClient.invalidateQueries({ queryKey: ["farmer-mortality-records"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-mortality-records"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-validation-mortality"] });
        queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
        queryClient.invalidateQueries({ queryKey: ["farmer-dashboard-analytics"] });
        toast.success(isEditMode
          ? "Mortality report resubmitted successfully. Your report has been returned to the validation queue."
          : `One mortality report logged for ${submittedCount} animal${submittedCount === 1 ? "" : "s"}. SIBAT and MAO will review the shared incident.`);
      }

      setConditionName(defaultType === "MORTALITY" ? DEFAULT_MORTALITY_CAUSE : "");
      setAffectedCount(1);
      setDescription("");
      setSelectedSymptoms([]);
      setPhotoName("");
      setPhotoDataUrl("");
      setPhotoFile(null);
      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Failed to submit observation:", err);
      const axiosErr = err as {
        response?: { data?: Record<string, unknown> };
      };
      const responseData = axiosErr.response?.data;
      const validationMessages = responseData
        ? Object.entries(responseData)
            .filter(([key]) => key !== "error" && key !== "detail")
            .flatMap(([field, value]) => {
              const messages = Array.isArray(value) ? value : [value];
              return messages
                .filter((message): message is string => typeof message === "string")
                .map((message) => (field === "non_field_errors" ? message : `${field}: ${message}`));
            })
            .join(" ")
        : "";
      const msg =
        (typeof responseData?.error === "string" && responseData.error) ||
        (typeof responseData?.detail === "string" && responseData.detail) ||
        validationMessages ||
        "Submission failed.";
      if (submittedCount > 0) {
        if (reportType === "DISEASE") {
          queryClient.invalidateQueries({ queryKey: ["farmer-disease-cases"] });
          queryClient.invalidateQueries({ queryKey: ["sibat-disease-cases"] });
          queryClient.invalidateQueries({ queryKey: ["sibat-validation-cases"] });
        } else {
          queryClient.invalidateQueries({ queryKey: ["farmer-mortality-records"] });
          queryClient.invalidateQueries({ queryKey: ["sibat-mortality-records"] });
          queryClient.invalidateQueries({ queryKey: ["sibat-validation-mortality"] });
        }
        queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
        queryClient.invalidateQueries({ queryKey: ["farmer-dashboard-analytics"] });
        // Keep the form open after a partial batch so the farmer can retry only
        // the animals whose requests failed, without duplicating saved reports.
        setSelectedInventoryIds((current) =>
          current.filter((id) => !submittedInventoryIds.includes(id)),
        );
        onSuccess?.();
        toast.error(
          `${submittedCount} animal${submittedCount === 1 ? "" : "s"} saved before a submission failed. Review the message and retry only animals not yet submitted. ${msg}`,
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisease = reportType === "DISEASE";

  return (
    <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain p-0 rounded-2xl border-0 shadow-2xl sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:max-h-[90dvh] sm:rounded-3xl">
        {/* Header uses the report type selected from the observation page. */}
        <div
          className={`p-4 text-white transition-colors relative overflow-hidden sm:p-6 ${
            isDisease
              ? "bg-gradient-to-br from-[#1E3D1A] via-[#2D5A27] to-emerald-800"
              : "bg-gradient-to-br from-rose-950 via-rose-800 to-rose-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md">
                {isDisease ? (
                  <Stethoscope className="size-6 text-emerald-200" />
                ) : (
                  <Skull className="size-6 text-rose-200" />
                )}
              </div>
              <div>
                <DialogTitle className="break-words text-base font-black text-white tracking-tight sm:text-lg">
                  {isEditMode
                    ? `Edit ${isDisease ? "Disease Report" : "Mortality Report"}`
                    : isDisease
                      ? "Report Sick or Injured Animal"
                      : "Report Deceased Animal"}
                </DialogTitle>
                <DialogDescription className="text-xs text-white/80 font-medium mt-0.5">
                  {isEditMode
                    ? "Update the existing declaration and return it to the review queue."
                    : "Send this report to the local livestock team for follow-up."}
                </DialogDescription>
              </div>
            </div>

          </div>
        </div>

        {isEditMode && existingReport?.reviewRemarks && (
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">MAO Revision Request</p>
              <p className="mt-1 text-xs font-medium">“{existingReport.reviewRemarks}”</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* Mortality groups affected animals into one incident; disease remains per-animal. */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Icon iconNode={cowHead} className="size-3.5 text-[#2D5A27]" />
                1. Affected Animals
              </span>
              {isEditMode && selectedCattle && (
                <span className="text-[10px] font-bold text-slate-400">
                  {selectedCattle.batchCode ? `Herd: ${selectedCattle.batchCode}` : "Individual Animal"}
                </span>
              )}
            </Label>

            {isEditMode && isDisease ? (
              <Select value={effectiveInventoryId} onValueChange={setSelectedInventoryId}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-[#2D5A27]">
                  <SelectValue placeholder="Select livestock from your herd..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-56">
                  {editableInventoryOptions.map((inv) => (
                    <SelectItem key={inv.id} value={String(inv.id)} className="text-xs font-semibold py-2 cursor-pointer">
                      #{inv.tagNumber || `TAG-${inv.id}`} • {inv.livestockTypeName || "Livestock"} ({inv.breed || "Standard"}, {inv.sex || "Female"})
                      {inv.batchCode ? ` • [Herd: ${inv.batchCode}]` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {selectableAnimals.length === 0 ? (
                  <p className="p-3 text-xs text-slate-600">
                    {reportType === "MORTALITY"
                      ? "No approved, active individual animals are available to report as deceased."
                      : "No verified or approved individual animals are available to select."}
                  </p>
                ) : (
                  <>
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2">
                    <span className="text-xs font-semibold text-slate-600">Sort by</span>
                    <Select value={animalSort} onValueChange={(value) => setAnimalSort(value as typeof animalSort)}>
                      <SelectTrigger className="h-8 w-40 rounded-lg border-slate-200 text-xs font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="TYPE" className="text-xs">Livestock type</SelectItem>
                        <SelectItem value="TAG" className="text-xs">Ear tag</SelectItem>
                        <SelectItem value="OLDEST" className="text-xs">Oldest first</SelectItem>
                        <SelectItem value="YOUNGEST" className="text-xs">Youngest first</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="max-h-48 divide-y divide-slate-200 overflow-y-auto">
                    {sortedSelectableAnimals.map((animal) => {
                      const id = String(animal.id);
                      const checked = selectedInventoryIds.includes(id);
                      return (
                        <label key={id} className="flex min-h-12 cursor-pointer items-center gap-3 bg-white px-3 py-2 hover:bg-emerald-50/60">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAnimal(id)}
                            className="size-4 shrink-0 accent-[#2D5A27]"
                          />
                          <span className="min-w-0 text-xs font-semibold text-slate-800">
                            <span className="block break-words">{animal.tagNumber || `Animal #${animal.id}`} · {animal.livestockTypeName || "Livestock"}</span>
                            <span className="block text-[11px] font-normal text-slate-500">{animal.breed || "Breed not recorded"} · {animal.sex || "Sex not recorded"}{animal.batchCode ? ` · Herd ${animal.batchCode}` : " · Individual"}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  </>
                )}
                <p className="border-t border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                  {selectedAnimals.length} animal{selectedAnimals.length === 1 ? "" : "s"} selected
                </p>
              </div>
            )}
            {!isEditMode && (
              <p className="text-xs leading-relaxed text-slate-500">
                {isDisease
                  ? "A separate disease report is created for each selected animal."
                  : "Animals from the same death event are grouped into one report. Select each ear tag involved."}
              </p>
            )}
          </div>

          {/* Step 2: Symptoms or Cause */}
          {isDisease ? (
            <div className="space-y-2.5">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>2. Select Observed Signs / Symptoms</span>
                <span className="text-[10px] font-bold text-slate-400">Tap all that apply</span>
              </Label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EASY_SIGNS.map((sign) => {
                  const isChecked = selectedSymptoms.includes(sign.label);
                  return (
                    <button
                      key={sign.id}
                      type="button"
                      onClick={() => toggleSymptom(sign.label)}
                      className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer flex flex-col justify-between ${
                        isChecked
                          ? "bg-[#2D5A27] text-white border-[#2D5A27] shadow-xs"
                          : "bg-emerald-50/80 text-slate-700 border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      <span>{sign.label}</span>
                      <span
                        className={`text-[9px] mt-1 font-normal ${
                          isChecked ? "text-emerald-100" : "text-slate-400"
                        }`}
                      >
                        {sign.sub}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-1">
                <Input
                  value={conditionName}
                  onChange={(e) => setConditionName(e.target.value)}
                  placeholder="Or enter custom diagnosis / disease name (e.g. Mastitis, FMD, Bloat)..."
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-[#2D5A27]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-700">
                2. Suspected Cause of Death
              </Label>
              <Select value={conditionName} onValueChange={setConditionName}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-rose-700">
                  <SelectValue placeholder="Choose primary cause or circumstance..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {EASY_MORTALITY_CAUSES.map((cause) => (
                    <SelectItem key={cause} value={cause} className="text-xs font-semibold py-2">
                      {cause}
                    </SelectItem>
                  ))}
                  {conditionName && !EASY_MORTALITY_CAUSES.includes(conditionName) && (
                    <SelectItem value={conditionName} className="text-xs font-semibold py-2">
                      {conditionName}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Step 3: Date. The number of reported animals comes from the selection above. */}
          <div className="space-y-1.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-[#2D5A27]" />
                3. Date Noticed / Occurred
              </Label>
              <Input
                type="date"
                value={recordDate}
                max={localCalendarDateToday()}
                onChange={(e) => setRecordDate(e.target.value)}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-[#2D5A27]"
              />
            </div>
          </div>

          {/* Step 4: Notes & Photo */}
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-wider text-slate-700">
              4. Additional Details & Clinical Notes (Optional)
            </Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Animal refused feed since 6 AM, isolated in clean pen with fresh water..."
              className="rounded-xl bg-slate-50 border-slate-200 text-xs focus:ring-2 focus:ring-[#2D5A27]"
            />

            {/* Photo upload button & preview */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 hover:border-emerald-600 rounded-xl bg-slate-50 cursor-pointer transition-colors text-xs font-bold text-slate-600 hover:text-emerald-700">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>{photoName ? `Photo: ${photoName}` : "Attach Photo of Animal or Symptoms (Optional)"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>

              {photoDataUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-emerald-200 bg-slate-900/5 p-2 flex items-center gap-3">
                  <img
                    src={photoDataUrl}
                    alt="Attached preview"
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                  />
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-bold text-slate-900 truncate">{photoName}</p>
                    <p className="text-[11px] text-emerald-700 font-semibold">
                      Photo attached & ready for SIBAT validation
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setPhotoName("");
                      setPhotoDataUrl("");
                      setPhotoFile(null);
                    }}
                    className="text-slate-400 hover:text-rose-600 rounded-xl"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-bold h-10 px-4 cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || selectedAnimals.length === 0}
              className={`rounded-xl text-white text-xs font-black h-10 px-6 gap-2 shadow-sm cursor-pointer ${
                isDisease
                  ? "bg-[#2D5A27] hover:bg-[#22441d]"
                  : "bg-rose-700 hover:bg-rose-800"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  <span>
                    {isEditMode
                      ? "Save & Resubmit"
                      : isDisease
                        ? "Submit Illness Report"
                        : "Log Mortality Record"}
                  </span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
  );
}

export default function ReportIllnessDialog(props: ReportIllnessDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <ReportIllnessDialogContent
        key={`${props.mode}-${props.existingReport?.id ?? "new"}-${props.defaultType}-${props.open ? "open" : "closed"}`}
        {...props}
      />
    </Dialog>
  );
}
