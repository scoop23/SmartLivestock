"use client";

import { LivestockBreedField } from "@/components/livestock-breed-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { localCalendarDateToday } from "@/lib/livestock-age";
import { Calendar, Dna, HeartHandshake, Sparkles, Tag, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LivestockInventoryItem } from "../../livestock-inventory/page";
import { LivestockPickerField } from "../select-livestock-dialog";

export interface BreedingPayload {
  dam: number;
  breeding_date: string;
  breeding_type: "ARTIFICIAL_INSEMINATION" | "NATURAL" | "EMBRYO_TRANSFER";
  sire_tag_or_code: string;
  sire_breed: string;
  technician_or_inseminator: string;
  gestation_days: number;
  expected_due_date?: string;
  status: "PENDING_CHECK" | "PREGNANT" | "CALVED" | "OPEN";
  notes: string;
}

interface BreedingRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  femaleLivestock: LivestockInventoryItem[];
  onSubmit: (payload: BreedingPayload) => void;
  isSubmitting: boolean;
}

function getSpeciesDefaultGestation(speciesName?: string | null): number {
  const s = (speciesName || "").toLowerCase();
  if (s.includes("carabao") || s.includes("kalabaw") || s.includes("buffalo")) return 310;
  if (s.includes("goat") || s.includes("kambing") || s.includes("caprine")) return 150;
  if (s.includes("sheep") || s.includes("tupa") || s.includes("ovine")) return 147;
  if (s.includes("swine") || s.includes("pig") || s.includes("baboy") || s.includes("hog")) return 114;
  return 283; // Default cattle
}

export default function BreedingRegistrationDialog({
  open,
  onOpenChange,
  femaleLivestock,
  onSubmit,
  isSubmitting,
}: BreedingRegistrationDialogProps) {
  const [damId, setDamId] = useState<string>("");
  const [breedingDate, setBreedingDate] = useState(localCalendarDateToday());
  const [breedingType, setBreedingType] = useState<"ARTIFICIAL_INSEMINATION" | "NATURAL" | "EMBRYO_TRANSFER">("ARTIFICIAL_INSEMINATION");
  const [sireTagOrCode, setSireTagOrCode] = useState("");
  const [sireBreed, setSireBreed] = useState("");
  const [technician, setTechnician] = useState("");
  const [status, setStatus] = useState<"PENDING_CHECK" | "PREGNANT" | "CALVED" | "OPEN">("PENDING_CHECK");
  const [notes, setNotes] = useState("");

  const selectedDam = femaleLivestock.find((item) => String(item.id) === damId);
  const gestationDays = useMemo(
    () => getSpeciesDefaultGestation(selectedDam?.livestockTypeName),
    [selectedDam?.livestockTypeName]
  );

  const calculatedDueDate = useMemo(() => {
    if (!breedingDate) return "";
    const [y, m, d] = breedingDate.split("-").map(Number);
    if (!y || !m || !d) return "";
    const bDate = new Date(y, m - 1, d);
    bDate.setDate(bDate.getDate() + gestationDays);
    const resY = bDate.getFullYear();
    const resM = String(bDate.getMonth() + 1).padStart(2, "0");
    const resD = String(bDate.getDate()).padStart(2, "0");
    return `${resY}-${resM}-${resD}`;
  }, [breedingDate, gestationDays]);

  const dueDateFormatted = useMemo(() => {
    if (!calculatedDueDate) return "—";
    const [y, m, d] = calculatedDueDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }, [calculatedDueDate]);

  useEffect(() => {
    if (!open) {
      setDamId("");
      setBreedingDate(localCalendarDateToday());
      setBreedingType("ARTIFICIAL_INSEMINATION");
      setSireTagOrCode("");
      setSireBreed("");
      setTechnician("");
      setStatus("PENDING_CHECK");
      setNotes("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!damId) return;

    onSubmit({
      dam: Number(damId),
      breeding_date: breedingDate,
      breeding_type: breedingType,
      sire_tag_or_code: sireTagOrCode.trim(),
      sire_breed: sireBreed.trim(),
      technician_or_inseminator: technician.trim(),
      gestation_days: gestationDays,
      expected_due_date: calculatedDueDate || undefined,
      status,
      notes: notes.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8 bg-white">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-violet-100 text-violet-800 flex items-center justify-center font-bold">
              <HeartHandshake className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-slate-900">
                Log Breeding or Insemination Event
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Record artificial insemination (AI) or natural service and track expected gestation.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Section 1: Dam Picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Mother / Breeding Dam <span className="text-rose-500">*</span>
            </Label>
            <LivestockPickerField
              items={femaleLivestock}
              id="breeding-dam-select"
              selectedId={damId}
              onSelect={(item) => {
                setDamId(String(item.id));
              }}
              warnOnActiveDisease
              label="Breeding Dam"
              placeholder="Select active female animal..."
              dialogTitle="Select Breeding Dam"
              dialogDescription="Choose an active registered female animal from your inventory."
              emptyStateText="No active female livestock found. Register female breeding stock in Livestock Inventory first."
            />
            {selectedDam && (
              <div className="p-2.5 rounded-xl bg-violet-50/70 border border-violet-100 flex items-center justify-between text-xs text-violet-900 font-semibold">
                <span>{selectedDam.livestockTypeName} — {selectedDam.tagNumber || `ID #${selectedDam.id}`}</span>
                <span className="text-[11px] text-violet-700 font-normal">Gestation: ~{gestationDays} days</span>
              </div>
            )}
          </div>

          {/* Section 2: Breeding Date & Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Breeding / Insemination Date <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  type="date"
                  value={breedingDate}
                  max={localCalendarDateToday()}
                  onChange={(e) => setBreedingDate(e.target.value)}
                  className="pl-9 h-10 rounded-xl text-xs bg-slate-50/70"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Breeding Method</Label>
              <Select value={breedingType} onValueChange={(val: any) => setBreedingType(val)}>
                <SelectTrigger className="h-10 rounded-xl text-xs bg-slate-50/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ARTIFICIAL_INSEMINATION">Artificial Insemination (AI)</SelectItem>
                  <SelectItem value="NATURAL">Natural Service / Bull Mating</SelectItem>
                  <SelectItem value="EMBRYO_TRANSFER">Embryo Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 3: Sire Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Sire Bull Tag / AI Semen Straw ID
              </Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  placeholder="e.g. PH-BULL-094 or Straw #A12"
                  value={sireTagOrCode}
                  onChange={(e) => setSireTagOrCode(e.target.value)}
                  className="pl-9 h-10 rounded-xl text-xs bg-slate-50/70"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Sire Breed</Label>
              <LivestockBreedField
                id="breeding-sire-breed"
                species={selectedDam?.livestockTypeName || "Cattle"}
                value={sireBreed}
                onChange={setSireBreed}
                placeholder="e.g. Brahman, Holstein-Friesian"
              />
            </div>
          </div>

          {/* Section 4: Technician / Inseminator & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Technician / AI Officer / Inseminator
              </Label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  placeholder="e.g. Dr. Santos / MAO AI Tech"
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  className="pl-9 h-10 rounded-xl text-xs bg-slate-50/70"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Current Status</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="h-10 rounded-xl text-xs bg-slate-50/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="PENDING_CHECK">Inseminated / Awaiting Check</SelectItem>
                  <SelectItem value="PREGNANT">Confirmed Pregnant / Gestating</SelectItem>
                  <SelectItem value="CALVED">Calved / Delivered</SelectItem>
                  <SelectItem value="OPEN">Open / Failed / Re-bred</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Calculated Expected Due Date Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-5 text-amber-700 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-950">Calculated Expected Due Date</p>
                <p className="text-[11px] text-amber-800">Based on standard biological gestation ({gestationDays} days)</p>
              </div>
            </div>
            <span className="text-sm font-black text-amber-900 bg-amber-100 px-3 py-1 rounded-xl border border-amber-300">
              {dueDateFormatted}
            </span>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Breeding Notes (optional)</Label>
            <Textarea
              placeholder="e.g. Second AI attempt, semen straw source, or morning standing heat details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl text-xs min-h-[64px] bg-slate-50/70"
              maxLength={500}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-10 px-4 text-xs font-bold border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!damId || isSubmitting}
              className="rounded-xl h-10 px-5 text-xs font-black bg-[#2D5A27] hover:bg-[#23471f] text-white shadow-xs"
            >
              {isSubmitting ? "Saving..." : "Save Breeding Event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
