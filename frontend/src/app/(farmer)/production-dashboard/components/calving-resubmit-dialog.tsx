"use client";

import { useEffect, useState } from "react";
import { Baby, Calendar, Check, Dna, RotateCcw, Scale, Tag } from "lucide-react";
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
import type { CalvingRecordItem } from "../production-calving-tab";
import { localCalendarDateToday } from "@/lib/livestock-age";

export interface EditableCalvingFields {
  calf_tag: string;
  calf_sex: "MALE" | "FEMALE";
  birth_weight: number | null;
  sire_tag: string;
  calving_date: string;
  breed: string;
  calving_ease: string;
  notes: string;
}

interface CalvingResubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terms: BirthingSpeciesTerminology;
  record: CalvingRecordItem | null;
  onSubmit: (payload: EditableCalvingFields) => void;
  isSubmitting: boolean;
}

export default function CalvingResubmitDialog({
  open,
  onOpenChange,
  terms,
  record,
  onSubmit,
  isSubmitting,
}: CalvingResubmitDialogProps) {
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

  useEffect(() => {
    if (record) {
      setCalfTag(record.calf_tag || "");
      setCalfSex(record.calf_sex === "MALE" ? "MALE" : "FEMALE");
      setBirthWeight(record.birth_weight != null ? String(record.birth_weight) : "");
      setSireTag(record.sire_tag || "");
      setCalvingDate(record.calving_date || localCalendarDateToday());
      setBreed(record.breed || "");
      setCalvingEase(record.calving_ease || "Normal / Unassisted");
      setNotes(record.notes || "");
    }
  }, [record]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;

    onSubmit({
      calf_tag: calfTag.trim(),
      calf_sex: calfSex,
      birth_weight: birthWeight ? Number(birthWeight) : null,
      sire_tag: sireTag.trim(),
      calving_date: calvingDate,
      breed: breed.trim(),
      calving_ease: calvingEase,
      notes: notes.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-xl max-h-[calc(100dvh-1rem)] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Correct & Resubmit {terms.eventName} Record
              </DialogTitle>
              <DialogDescription className="text-xs">
                Fix the details flagged by the reviewer, then resubmit for SIBAT field verification.
              </DialogDescription>
            </div>
          </div>
          {record?.review_remarks && (
            <div className="mt-2 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              Reviewer notes: {record.review_remarks}
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
          {/* Dam reference (read-only on edit) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Baby className="size-3.5 text-emerald-600" />
              {terms.damName}
            </Label>
            <Input
              value={record ? `Tag #${record.dam_tag || record.dam}` : ""}
              readOnly
              disabled
              className="text-xs bg-slate-50 text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              disabled={isSubmitting || !record}
              className="bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs gap-1.5"
            >
              <Check className="size-4" />
              {isSubmitting ? "Resubmitting..." : "Resubmit for Review"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
