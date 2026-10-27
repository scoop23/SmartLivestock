"use client";

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
import { Calendar, DollarSign, Scale, Tag, Users, Wheat } from "lucide-react";
import { useEffect, useState } from "react";
import type { LivestockInventoryItem } from "../../livestock-inventory/page";
import { LivestockPickerField } from "../select-livestock-dialog";

export interface FeedingPayload {
  livestock?: number | null;
  batch?: number | null;
  feeding_date: string;
  feed_type: "FORAGE" | "SILAGE_HAY" | "CONCENTRATE" | "BYPRODUCTS" | "MINERALS";
  feed_name: string;
  quantity_kg: number;
  cost?: number | null;
  feeding_time: "MORNING" | "AFTERNOON" | "EVENING" | "ALL_DAY";
  notes?: string;
}

export interface BatchItem {
  id: number;
  batch_name: string;
  batch_code: string;
  livestock_type_name?: string;
  total_animals?: number;
}

interface FeedingRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventories: LivestockInventoryItem[];
  batches?: BatchItem[];
  onSubmit: (payload: FeedingPayload) => void;
  isSubmitting: boolean;
}

export default function FeedingRegistrationDialog({
  open,
  onOpenChange,
  inventories,
  batches = [],
  onSubmit,
  isSubmitting,
}: FeedingRegistrationDialogProps) {
  const [targetType, setTargetType] = useState<"INDIVIDUAL" | "BATCH">("INDIVIDUAL");
  const [livestockId, setLivestockId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [feedingDate, setFeedingDate] = useState(localCalendarDateToday());
  const [feedType, setFeedType] = useState<FeedingPayload["feed_type"]>("FORAGE");
  const [feedName, setFeedName] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [cost, setCost] = useState("");
  const [feedingTime, setFeedingTime] = useState<FeedingPayload["feeding_time"]>("MORNING");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!open) {
      setLivestockId("");
      setBatchId("");
      setFeedingDate(localCalendarDateToday());
      setFeedType("FORAGE");
      setFeedName("");
      setQuantityKg("");
      setCost("");
      setFeedingTime("MORNING");
      setNotes("");
      setErrorMsg("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (targetType === "INDIVIDUAL" && !livestockId) {
      setErrorMsg("Please select an animal for this feeding log.");
      return;
    }
    if (targetType === "BATCH" && !batchId) {
      setErrorMsg("Please select a herd / batch for this feeding log.");
      return;
    }

    const qty = parseFloat(quantityKg);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg("Please enter a valid feed quantity in kilograms.");
      return;
    }

    const costNum = cost.trim() ? parseFloat(cost) : null;
    if (costNum !== null && (isNaN(costNum) || costNum < 0)) {
      setErrorMsg("Please enter a valid cost or leave it blank.");
      return;
    }

    onSubmit({
      livestock: targetType === "INDIVIDUAL" ? Number(livestockId) : null,
      batch: targetType === "BATCH" ? Number(batchId) : null,
      feeding_date: feedingDate,
      feed_type: feedType,
      feed_name: feedName.trim(),
      quantity_kg: qty,
      cost: costNum,
      feeding_time: feedingTime,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Wheat className="size-6 text-amber-600" />
            <span>Log Feed & Ration</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Record daily feed intake, ration mix, and optional feed cost for your animals or herds.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Target Type Switcher: Animal vs Batch */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Target Feeding Group</Label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setTargetType("INDIVIDUAL")}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                  targetType === "INDIVIDUAL"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Tag className="size-3.5 text-emerald-600" />
                <span>Individual Animal</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType("BATCH")}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                  targetType === "BATCH"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users className="size-3.5 text-sky-600" />
                <span>Herd / Batch</span>
              </button>
            </div>
          </div>

          {/* Individual Animal Selector */}
          {targetType === "INDIVIDUAL" && (
            <div className="space-y-1.5">
              <p className="text-right text-[11px] text-slate-500">{inventories.length} active animals</p>
              <LivestockPickerField
                id="feeding-livestock"
                label="Select Livestock Animal *"
                items={inventories}
                selectedId={livestockId}
                onSelect={(item) => setLivestockId(String(item.id))}
                warnOnActiveDisease
                placeholder="Choose an animal by tag or ID..."
              />
            </div>
          )}

          {/* Herd Batch Selector */}
          {targetType === "BATCH" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Select Herd / Batch <span className="text-rose-500">*</span>
              </Label>
              {batches.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  No herd batches registered yet. You can log feedings for individual animals above.
                </p>
              ) : (
                <Select value={batchId} onValueChange={setBatchId}>
                  <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Choose a herd batch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.batch_name} ({b.batch_code}) {b.livestock_type_name ? `• ${b.livestock_type_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Date & Feeding Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-slate-400" />
                <span>Feeding Date <span className="text-rose-500">*</span></span>
              </Label>
              <Input
                type="date"
                max={localCalendarDateToday()}
                value={feedingDate}
                onChange={(e) => setFeedingDate(e.target.value)}
                className="h-11 rounded-xl bg-slate-50 border-slate-200"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Feeding Schedule / Time</Label>
              <Select value={feedingTime} onValueChange={(val) => setFeedingTime(val as FeedingPayload["feeding_time"])}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MORNING">Morning Ration</SelectItem>
                  <SelectItem value="AFTERNOON">Afternoon Ration</SelectItem>
                  <SelectItem value="EVENING">Evening Ration</SelectItem>
                  <SelectItem value="ALL_DAY">All Day / Free Choice</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Feed Category & Specific Feed Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Feed Category <span className="text-rose-500">*</span>
              </Label>
              <Select value={feedType} onValueChange={(val) => setFeedType(val as FeedingPayload["feed_type"])}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FORAGE">Fresh Forage & Grass</SelectItem>
                  <SelectItem value="SILAGE_HAY">Silage & Hay</SelectItem>
                  <SelectItem value="CONCENTRATE">Concentrates & Mash</SelectItem>
                  <SelectItem value="BYPRODUCTS">Byproducts (Rice Bran / Corn)</SelectItem>
                  <SelectItem value="MINERALS">Minerals & Supplements</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Feed Description / Brand</Label>
              <Input
                placeholder="e.g. Napier Grass, Starter Mash, Darak"
                value={feedName}
                onChange={(e) => setFeedName(e.target.value)}
                className="h-11 rounded-xl bg-slate-50 border-slate-200"
              />
            </div>
          </div>

          {/* Quantity (kg) & Cost (₱) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Scale className="size-3.5 text-emerald-600" />
                <span>Quantity Given (kg) <span className="text-rose-500">*</span></span>
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                placeholder="e.g. 15.5"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                className="h-11 rounded-xl bg-slate-50 border-slate-200 font-semibold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <DollarSign className="size-3.5 text-amber-600" />
                <span>Total Cost (₱, Optional)</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 120.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="h-11 rounded-xl bg-slate-50 border-slate-200"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Feeding Notes (Optional)</Label>
            <Textarea
              placeholder="Appetite observations, feeding mix details, pasture condition..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl bg-slate-50 border-slate-200 text-xs min-h-[70px]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5"
            >
              <Wheat className="size-4" />
              <span>{isSubmitting ? "Saving..." : "Save Feeding Record"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
