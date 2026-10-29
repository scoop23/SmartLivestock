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
import { Baby,Calendar,Check,Dna,Scale,Sparkles,Tag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { getAutomaticTutorialsEnabled, startGuidedTutorial } from "@/lib/tutorial-preferences";
import { useAutomaticTutorialsEnabled } from "@/hooks/use-automatic-tutorials-enabled";
import type { LivestockInventoryItem } from "../../livestock-inventory/page";
import { LivestockPickerField } from "../select-livestock-dialog";
import type { BirthingSpeciesTerminology } from "../production-calving-tab";

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
  const tutorialsEnabled = useAutomaticTutorialsEnabled();
  const [damId, setDamId] = useState<string>("");
  const [calfTag, setCalfTag] = useState("");
  const [calfSex, setCalfSex] = useState<"MALE" | "FEMALE">("FEMALE");
  const [birthWeight, setBirthWeight] = useState<string>("");
  const [sireTag, setSireTag] = useState("");
  const [calvingDate, setCalvingDate] = useState(
    localCalendarDateToday()
  );
  const [breed, setBreed] = useState("");
  const [calvingEase, setCalvingEase] = useState("Normal / Unassisted");
  const [notes, setNotes] = useState("");

  const eligibleFemaleLivestock = useMemo(() => {
    return femaleLivestock.filter((item) => {
      // Must be an individual animal, not a herd batch
      if (item.entryType && item.entryType !== "INDIVIDUAL") return false;

      // Must be female (strictly exclude male cattle/animals)
      const sex = (item.sex || "").trim().toUpperCase();
      const isFemale = sex === "F" || sex === "FEMALE" || sex.startsWith("FEM");
      const isMale = sex === "M" || sex === "MALE" || sex.startsWith("M");
      if (isMale || !isFemale) return false;

      // Calves and immature animals cannot give birth
      if (item.ageClassification === "CALF") return false;
      if (item.age?.total_months != null && item.age.total_months < 12) return false;

      // Must be active
      if (item.operationalStatus && item.operationalStatus !== "ACTIVE") return false;

      return true;
    });
  }, [femaleLivestock]);

  const selectedDam = eligibleFemaleLivestock.find((item) => String(item.id) === damId);

  const startBirthTutorial = useCallback(() => {
    const steps: DriveStep[] = [
      { element: '[data-tour="birth-record-dam"]', popover: { title: `Choose the ${terms.damName.toLowerCase()}`, description: "Select the mother from your active female livestock inventory.", side: "bottom", align: "center" } },
      { element: '[data-tour="birth-record-offspring"]', popover: { title: "Enter the newborn details", description: "Add an identifier if available and choose the newborn’s sex. The identifier can be generated automatically when left blank.", side: "bottom", align: "center" } },
      { element: '[data-tour="birth-record-birth-details"]', popover: { title: "Record birth information", description: "Add the birth weight when known and enter the birth date. The date is required.", side: "bottom", align: "center" } },
      { element: '[data-tour="birth-record-care"]', popover: { title: "Record lineage and delivery", description: "Add the sire details and select how difficult or assisted the delivery was.", side: "bottom", align: "center" } },
      { element: '[data-tour="birth-record-breed-notes"]', popover: { title: "Add breed and observations", description: "Set the offspring’s breed and add optional clinical, vitality, or care notes.", side: "top", align: "center" } },
      { element: '[data-tour="birth-record-save"]', popover: { title: "Save the birth record", description: "Save the newborn and its birth details for review.", side: "top", align: "end" } },
    ];
    startGuidedTutorial({ showProgress: true, animate: true, allowClose: true, nextBtnText: "Next", prevBtnText: "Back", doneBtnText: "Finish", progressText: "{{current}} of {{total}}", steps });
  }, [terms.damName]);

  useEffect(() => {
    if (!open || !getAutomaticTutorialsEnabled()) return;
    const timer = window.setTimeout(startBirthTutorial, 500);
    return () => window.clearTimeout(timer);
  }, [open, startBirthTutorial]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!damId) return;

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
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-xl max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Baby className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Record New {terms.eventName} & Offspring
              </DialogTitle>
              <DialogDescription className="text-xs">
                Record the newborn animal, its parent, and birth weight.
              </DialogDescription>
            </div>
          </div>
          {tutorialsEnabled && (
            <Button type="button" variant="outline" onClick={startBirthTutorial} className="shrink-0 gap-1.5 rounded-xl">
              <Sparkles className="size-4" aria-hidden="true" /> Tutorial
            </Button>
          )}
          </div>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
          {/* Mother Selection */}
          <div data-tour="birth-record-dam" className="space-y-1.5">
            <LivestockPickerField
              items={eligibleFemaleLivestock}
              id="calving-dam"
              selectedId={damId}
              onSelect={(item) => setDamId(String(item.id))}
              label={`Select ${terms.damName} *`}
              placeholder={`Choose mother (${terms.damName})`}
              dialogTitle={`Choose ${terms.damName}`}
              dialogDescription={`Select an eligible adult female mother (${terms.damName}) from your inventory. Calves and male animals are excluded.`}
              emptyStateText={`No active, eligible female ${terms.damName.toLowerCase()}s found. Calves and male animals cannot be selected as mothers.`}
            />
            {eligibleFemaleLivestock.length === 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                No eligible female breeding stock found for this species. Calves and male animals are not eligible to be chosen as mothers.
              </p>
            )}
          </div>

          <div data-tour="birth-record-offspring" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <div data-tour="birth-record-birth-details" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                Calving / Birth Date *
              </Label>
              <Input
                type="date"
                max={localCalendarDateToday()}
                value={calvingDate}
                onChange={(e) => setCalvingDate(e.target.value)}
                required
                className="h-11 min-w-0 w-full text-xs"
              />
            </div>
          </div>

          <div data-tour="birth-record-care" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div data-tour="birth-record-breed-notes">
          <LivestockBreedField
              id="offspring-breed"
              species={selectedDam?.livestockTypeName}
              label="Offspring Breed"
              value={breed}
              onChange={setBreed}
              placeholder="Select offspring breed"
              customPlaceholder="Enter offspring breed"
              className="text-xs"
          />

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
              data-tour="birth-record-save"
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
