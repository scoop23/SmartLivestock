"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Stethoscope,
  Skull,
  Send,
  Camera,
  Calendar,
  X,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import { toast } from "sonner";
import api from "@/lib/axios";
import { useQueryClient } from "@tanstack/react-query";
import { useUserInventory } from "../../livestock-inventory/livestock-inventory";
import { ReportType } from "../report-observation-types";
import { saveAttachedPhoto } from "@/lib/photo-storage";

interface ReportIllnessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: ReportType;
  defaultInventoryId?: string;
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

const EASY_MORTALITY_CAUSES = [
  "Sudden Death / Severe Bloat",
  "Severe Respiratory / Lung Infection",
  "Calving / Birthing Complications",
  "Physical Injury / Accident",
  "Old Age / Natural Causes",
  "Unknown (Needs Vet Inspection)",
];

export default function ReportIllnessDialog({
  open,
  onOpenChange,
  defaultType = "DISEASE",
  defaultInventoryId,
  onSuccess,
}: ReportIllnessDialogProps) {
  const queryClient = useQueryClient();
  const { data: inventories = [], isLoading: isLoadingInventory } = useUserInventory();

  const [reportType, setReportType] = useState<ReportType>(defaultType);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>(defaultInventoryId || "");
  const [conditionName, setConditionName] = useState<string>("");
  const [affectedCount, setAffectedCount] = useState<number>(1);
  const [recordDate, setRecordDate] = useState<string>(
    () => new Date().toISOString().split("T")[0]
  );
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [description, setDescription] = useState<string>("");
  const [photoName, setPhotoName] = useState<string>("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  React.useEffect(() => {
    if (defaultType) setReportType(defaultType);
  }, [defaultType]);

  React.useEffect(() => {
    if (defaultInventoryId) {
      setSelectedInventoryId(defaultInventoryId);
    } else if (inventories.length > 0 && !selectedInventoryId) {
      setSelectedInventoryId(String(inventories[0].id));
    }
  }, [defaultInventoryId, inventories, selectedInventoryId]);

  const selectedCattle = useMemo(() => {
    return inventories.find((inv) => String(inv.id) === String(selectedInventoryId));
  }, [inventories, selectedInventoryId]);

  const maxAvailableCount = selectedCattle?.quantity || 1;

  const toggleSymptom = (label: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

    if (!selectedInventoryId) {
      toast.error("Please select an animal from your livestock registry first.");
      return;
    }

    const mainName =
      conditionName.trim() ||
      (selectedSymptoms.length > 0
        ? selectedSymptoms.join(", ")
        : reportType === "DISEASE"
        ? "General Health Concern"
        : "Unspecified Cause");

    setIsSubmitting(true);

    try {
      if (reportType === "DISEASE") {
        const res = await api.post("diseases/cases/", {
          livestock: Number(selectedInventoryId),
          name: mainName,
          affected_count: Math.min(Math.max(1, affectedCount), maxAvailableCount),
          record_date: recordDate,
        });

        // Persist attached photo for SIBAT and Admin inspection
        if (photoDataUrl && res.data?.id) {
          saveAttachedPhoto(`DIS-${res.data.id}`, {
            photoUrl: photoDataUrl,
            photoName: photoName || "farmer_attached_evidence.jpg",
            timestamp: new Date().toISOString(),
            uploaderRole: "FARMER",
          });
          if (selectedCattle?.tagNumber) {
            saveAttachedPhoto(`tag_${selectedCattle.tagNumber}`, {
              photoUrl: photoDataUrl,
              photoName: photoName || "farmer_attached_evidence.jpg",
              timestamp: new Date().toISOString(),
              uploaderRole: "FARMER",
            });
          }
        }

        queryClient.invalidateQueries({ queryKey: ["farmer-disease-cases"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-disease-cases"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-validation-cases"] });
        queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
        queryClient.invalidateQueries({ queryKey: ["farmer-dashboard-analytics"] });
        toast.success("Disease report submitted! SIBAT field officers and MAO have been notified.");
      } else {
        const res = await api.post("diseases/mortality/", {
          livestock: Number(selectedInventoryId),
          cause: mainName,
          death_count: Math.min(Math.max(1, affectedCount), maxAvailableCount),
          record_date: recordDate,
        });

        // Persist attached photo for SIBAT and Admin inspection
        if (photoDataUrl && res.data?.id) {
          saveAttachedPhoto(`MOR-${res.data.id}`, {
            photoUrl: photoDataUrl,
            photoName: photoName || "mortality_evidence_photo.jpg",
            timestamp: new Date().toISOString(),
            uploaderRole: "FARMER",
          });
          if (selectedCattle?.tagNumber) {
            saveAttachedPhoto(`tag_${selectedCattle.tagNumber}`, {
              photoUrl: photoDataUrl,
              photoName: photoName || "mortality_evidence_photo.jpg",
              timestamp: new Date().toISOString(),
              uploaderRole: "FARMER",
            });
          }
        }

        queryClient.invalidateQueries({ queryKey: ["farmer-mortality-records"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-mortality-records"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-validation-mortality"] });
        queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
        queryClient.invalidateQueries({ queryKey: ["farmer-dashboard-analytics"] });
        toast.success("Mortality record logged! SIBAT & MAO will review this incident.");
      }

      // Reset
      setConditionName("");
      setAffectedCount(1);
      setDescription("");
      setSelectedSymptoms([]);
      setPhotoName("");
      setPhotoDataUrl("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Failed to submit observation report:", err);
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.affected_count?.[0] ||
        err?.response?.data?.death_count?.[0] ||
        err?.response?.data?.detail ||
        "Failed to submit report. Please check required fields.";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisease = reportType === "DISEASE";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border-0 shadow-2xl">
        {/* Header with Type Switcher */}
        <div
          className={`p-6 text-white transition-colors relative overflow-hidden ${
            isDisease
              ? "bg-gradient-to-br from-[#1E3D1A] via-[#2D5A27] to-emerald-800"
              : "bg-gradient-to-br from-rose-950 via-rose-800 to-rose-700"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md">
                {isDisease ? (
                  <Stethoscope className="size-6 text-emerald-200" />
                ) : (
                  <Skull className="size-6 text-rose-200" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white tracking-tight">
                  {isDisease ? "Report Sick or Injured Animal" : "Report Deceased Animal"}
                </DialogTitle>
                <DialogDescription className="text-xs text-white/80 font-medium mt-0.5">
                  Notify SIBAT validators and MAO municipal vets for rapid field assistance
                </DialogDescription>
              </div>
            </div>

            {/* Type Selector Pills */}
            <div className="flex bg-black/20 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setReportType("DISEASE")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  isDisease ? "bg-white text-emerald-950 shadow-sm" : "text-white/70 hover:text-white"
                }`}
              >
                Sick Animal
              </button>
              <button
                type="button"
                onClick={() => setReportType("MORTALITY")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  !isDisease ? "bg-white text-rose-950 shadow-sm" : "text-white/70 hover:text-white"
                }`}
              >
                Deceased
              </button>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* Step 1: Select Animal */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Icon iconNode={cowHead} className="size-3.5 text-[#2D5A27]" />
                1. Affected Animal / Batch
              </span>
              {selectedCattle && (
                <span className="text-[10px] font-bold text-slate-400">
                  Total in Batch: {selectedCattle.quantity}
                </span>
              )}
            </Label>

            <Select value={selectedInventoryId} onValueChange={setSelectedInventoryId}>
              <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-[#2D5A27]">
                <SelectValue placeholder="Select livestock from your herd..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-56">
                {inventories.map((inv) => (
                  <SelectItem
                    key={inv.id}
                    value={String(inv.id)}
                    className="text-xs font-semibold py-2 cursor-pointer"
                  >
                    #{inv.tagNumber || `ID-${inv.id}`} • {inv.livestockTypeName || "Livestock"} (
                    {inv.breed || "Standard"}) — {inv.quantity} Head{inv.quantity > 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
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
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Step 3: Date & Head Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-[#2D5A27]" />
                3. Date Noticed / Occurred
              </Label>
              <Input
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-[#2D5A27]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Number of Heads {isDisease ? "Sick" : "Deceased"}
              </Label>
              <Input
                type="number"
                min={1}
                max={maxAvailableCount}
                value={affectedCount}
                onChange={(e) => setAffectedCount(Math.max(1, parseInt(e.target.value) || 1))}
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
              disabled={isSubmitting || !selectedInventoryId}
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
                  <span>{isDisease ? "Submit Illness Report" : "Log Mortality Record"}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
