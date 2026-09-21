"use client";

import { useState } from "react";
import { Baby, Calendar, Check, Dna, HeartPulse, Scale, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BirthingSpeciesTerminology } from "../production-calving-tab";
import type { LivestockInventoryItem } from "../../livestock-inventory/page";

interface BirthingRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terms: BirthingSpeciesTerminology;
  femaleLivestock: LivestockInventoryItem[];
  onSubmit: (payload: {
    dam: number;
    calf_tag: string;
    calf_sex: "MALE" | "FEMALE";
    birth_weight: number | null;
    sire_tag: string;
    calving_date: string;
    breed: string;
    calving_ease: string;
    notes: string;
  }) => void;
  isSubmitting: boolean;
}

export default function BirthingRegistrationDialog({
  open,
  onOpenChange,
  terms,
  femaleLivestock,
  onSubmit,
  isSubmitting,
}: BirthingRegistrationDialogProps) {
  const [damId, setDamId] = useState<string>("");
  const [calfTag, setCalfTag] = useState("");
  const [calfSex, setCalfSex] = useState<"MALE" | "FEMALE">("FEMALE");
  const [birthWeight, setBirthWeight] = useState<string>("");
  const [sireTag, setSireTag] = useState("");
  const [calvingDate, setCalvingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [breed, setBreed] = useState("");
  const [calvingEase, setCalvingEase] = useState("Normal / Unassisted");
  const [notes, setNotes] = useState("");

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!damId) return;

    const selectedDam = femaleLivestock.find((i) => String(i.id) === damId);

    onSubmit({
      dam: Number(damId),
      calf_tag:
        calfTag.trim() ||
        `${terms.offspringName.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      calf_sex: calfSex,
      birth_weight: birthWeight ? Number(birthWeight) : null,
      sire_tag: sireTag.trim(),
      calving_date: calvingDate,
      breed: breed.trim() || selectedDam?.breed || "Standard Breed",
      calving_ease: calvingEase,
      notes: notes.trim(),
    });

    // Reset local state
    setDamId("");
    setCalfTag("");
    setBirthWeight("");
    setSireTag("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Baby className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Record New {terms.eventName} & Offspring
              </DialogTitle>
              <DialogDescription className="text-xs">
                Log maternal lineage, birth weight, and offspring identity for municipal census records.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
          {/* Mother Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <HeartPulse className="size-3.5 text-rose-500" />
              Select {terms.damName} *
            </Label>
            <Select value={damId} onValueChange={setDamId} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Choose mother (${terms.damName})`} />
              </SelectTrigger>
              <SelectContent>
                {femaleLivestock.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.tagNumber ? `Tag #${item.tagNumber}` : `Batch #${item.id}`} — {item.breed || "Standard"} ({item.livestockTypeName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {femaleLivestock.length === 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                No active female inventory found for this species. Please register female breeding stock in Livestock Inventory first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Offspring Ear Tag */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Tag className="size-3.5 text-emerald-600" />
                {terms.offspringName} Tag / Identifier
              </Label>
              <Input
                placeholder={`e.g. ${terms.offspringName.toUpperCase()}-2026-01`}
                value={calfTag}
                onChange={(e) => setCalfTag(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Offspring Sex */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Offspring Gender *
              </Label>
              <Select
                value={calfSex}
                onValueChange={(val: "MALE" | "FEMALE") => setCalfSex(val)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FEMALE">{terms.femaleOffspring}</SelectItem>
                  <SelectItem value="MALE">{terms.maleOffspring}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Birth Weight */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Scale className="size-3.5 text-amber-600" />
                Birth Weight (kg)
              </Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 28.5"
                value={birthWeight}
                onChange={(e) => setBirthWeight(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Calving Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-blue-600" />
                Date of Birth *
              </Label>
              <Input
                type="date"
                value={calvingDate}
                onChange={(e) => setCalvingDate(e.target.value)}
                required
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Sire / Father Tag */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Dna className="size-3.5 text-purple-600" />
                {terms.sireName} / Tag
              </Label>
              <Input
                placeholder="e.g. Bull #104 / Artificial Insem"
                value={sireTag}
                onChange={(e) => setSireTag(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Calving Ease */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Delivery Ease
              </Label>
              <Select value={calvingEase} onValueChange={setCalvingEase}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal / Unassisted">Normal / Unassisted</SelectItem>
                  <SelectItem value="Easy Assistance">Easy Assistance</SelectItem>
                  <SelectItem value="Difficult / Vet Assisted">Difficult / Vet Assisted</SelectItem>
                  <SelectItem value="Cesarean Section">Cesarean Section</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Breed */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Offspring Breed
            </Label>
            <Input
              placeholder="e.g. Holstein Cross / Boer / Landrace"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Clinical & Observation Notes
            </Label>
            <Textarea
              placeholder="Vitality notes, colostrum feeding status, umbilical care..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs min-h-[60px]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !damId}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5"
            >
              <Check className="size-4" />
              {isSubmitting ? "Saving..." : `Save ${terms.eventName} Record`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
