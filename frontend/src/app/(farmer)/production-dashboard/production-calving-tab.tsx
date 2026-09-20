"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Baby,
  Calendar,
  Check,
  ChevronDown,
  Dna,
  HeartPulse,
  Plus,
  Scale,
  Sparkles,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { KpiCard } from "@/components/ui/kpi-card";
import api from "@/lib/axios";
import type { LivestockInventoryItem } from "../livestock-inventory/page";

export interface CalvingRecordItem {
  id: number;
  dam: number;
  dam_tag?: string;
  dam_breed?: string;
  calf_tag: string;
  calf_sex: "MALE" | "FEMALE";
  birth_weight: number | null;
  sire_tag: string;
  calving_date: string;
  breed: string;
  calving_ease: string;
  notes: string;
  created_at: string;
}

export default function ProductionCalvingTab({
  approvedInventories,
}: {
  approvedInventories: LivestockInventoryItem[];
}) {
  const queryClient = useQueryClient();
  const [isRecordOpen, setIsRecordOpen] = useState(false);

  // Form State
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

  const { data: calvingRecords = [], isLoading } = useQuery<CalvingRecordItem[]>({
    queryKey: ["calving_records"],
    queryFn: async () => {
      const res = await api.get("production/calving/");
      return res.data;
    },
  });

  const recordCalvingMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post("production/calving/", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Calving & birth record logged successfully!");
      setIsRecordOpen(false);
      setDamId("");
      setCalfTag("");
      setBirthWeight("");
      setSireTag("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["calving_records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: () => {
      toast.error("Failed to record calving details.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!damId) {
      toast.error("Please select the mother cow (Dam).");
      return;
    }

    const selectedDam = approvedInventories.find((i) => i.id === damId);

    const payload = {
      dam: Number(damId),
      calf_tag: calfTag.trim() || `CALF-${Date.now().toString().slice(-4)}`,
      calf_sex: calfSex,
      birth_weight: birthWeight ? Number(birthWeight) : null,
      sire_tag: sireTag.trim(),
      calving_date: calvingDate,
      breed: breed.trim() || selectedDam?.breed || "Standard Breed",
      calving_ease: calvingEase,
      notes: notes.trim(),
    };

    recordCalvingMutation.mutate(payload);
  };

  const femaleLivestock = approvedInventories.filter(
    (item) =>
      item.sex?.toUpperCase().includes("F") ||
      item.livestockTypeName?.toLowerCase().includes("cattle")
  );

  const totalCalves = calvingRecords.length;
  const femaleCalves = calvingRecords.filter((c) => c.calf_sex === "FEMALE").length;
  const maleCalves = calvingRecords.filter((c) => c.calf_sex === "MALE").length;
  const avgBirthWeight =
    calvingRecords.filter((c) => c.birth_weight).length > 0
      ? (
          calvingRecords.reduce((acc, c) => acc + (Number(c.birth_weight) || 0), 0) /
          calvingRecords.filter((c) => c.birth_weight).length
        ).toFixed(1)
      : "—";

  return (
    <div className="space-y-6">
      {/* Top Calving KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Calves Born"
          value={totalCalves.toString()}
          icon={<Baby className="size-4.5" />}
          badge="Live births"
          variant="emerald"
        />
        <KpiCard
          title="Heifers (Female)"
          value={femaleCalves.toString()}
          icon={<HeartPulse className="size-4.5" />}
          badge="Future breeding herd"
          variant="sky"
        />
        <KpiCard
          title="Bulls (Male)"
          value={maleCalves.toString()}
          icon={<Sparkles className="size-4.5" />}
          badge="Fattening / Bull calves"
          variant="orange"
        />
        <KpiCard
          title="Avg Birth Weight"
          value={avgBirthWeight !== "—" ? `${avgBirthWeight} kg` : "—"}
          icon={<Scale className="size-4.5" />}
          badge="Healthy calf baseline"
          variant="amber"
        />
      </div>

      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Calving & Birth Registry
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Record new born calves, pedigree dam/sire linkage, and birth weight.
          </p>
        </div>
        <Button
          onClick={() => setIsRecordOpen(true)}
          className="bg-emerald-700 hover:bg-[#2D5A27] text-white shadow-sm font-semibold gap-2"
        >
          <Plus className="size-4" /> Record New Calving / Birth
        </Button>
      </div>

      {/* Calving History List */}
      <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Loading calving records...
            </p>
          ) : calvingRecords.length === 0 ? (
            <div className="p-12 text-center">
              <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3 text-emerald-800">
                <Baby className="size-6" />
              </div>
              <h4 className="font-bold text-slate-900">No calving records yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Record your first birth to track maternal lineage, birth weight growth, and herd expansion.
              </p>
              <Button
                onClick={() => setIsRecordOpen(true)}
                className="mt-4 bg-emerald-700 text-white hover:bg-emerald-800"
              >
                <Plus className="size-4" /> Record First Calving
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {calvingRecords.map((record) => (
                <div
                  key={record.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-3 rounded-xl bg-emerald-100/80 text-emerald-800 shrink-0 mt-0.5">
                      <Baby className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-900">
                          {record.calf_tag || `Calf #${record.id}`}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                            record.calf_sex === "FEMALE"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {record.calf_sex === "FEMALE" ? "Heifer (Female)" : "Bull (Male)"}
                        </span>
                        <span className="text-xs text-slate-500">
                          Breed: <strong className="text-slate-700">{record.breed}</strong>
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Dna className="size-3.5 text-slate-400" />
                          Dam: <strong className="text-slate-700">{record.dam_tag || `Dam #${record.dam}`}</strong>
                        </span>
                        {record.sire_tag && (
                          <span className="inline-flex items-center gap-1">
                            Sire: <strong className="text-slate-700">{record.sire_tag}</strong>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3.5 text-slate-400" />
                          Born {record.calving_date}
                        </span>
                        {record.birth_weight && (
                          <span className="inline-flex items-center gap-1">
                            <Scale className="size-3.5 text-slate-400" />
                            {record.birth_weight} kg
                          </span>
                        )}
                      </div>
                      {record.notes && (
                        <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {record.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Calving Dialog */}
      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
        <DialogContent className="sm:max-w-xl p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Baby className="size-5 text-emerald-700" /> Record Birth / Calving
            </DialogTitle>
            <DialogDescription>
              Register newborn calf details, maternal lineage, and birth weight.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="dam-select">Mother Cow (Dam) *</Label>
              <Select value={damId} onValueChange={setDamId}>
                <SelectTrigger id="dam-select" className="bg-slate-50">
                  <SelectValue placeholder="Select Dam from inventory" />
                </SelectTrigger>
                <SelectContent>
                  {femaleLivestock.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.tagNumber || `Batch #${item.id}`} ({item.livestockTypeName} - {item.breed || "Standard"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="calf-tag">Calf Tag / ID</Label>
                <Input
                  id="calf-tag"
                  placeholder="e.g. CALF-2026-01"
                  value={calfTag}
                  onChange={(e) => setCalfTag(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calf-sex">Calf Sex *</Label>
                <Select
                  value={calfSex}
                  onValueChange={(val) => setCalfSex(val as "MALE" | "FEMALE")}
                >
                  <SelectTrigger id="calf-sex" className="bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEMALE">Heifer / Female</SelectItem>
                    <SelectItem value="MALE">Bull / Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="birth-weight">Birth Weight (kg)</Label>
                <Input
                  id="birth-weight"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 28.5"
                  value={birthWeight}
                  onChange={(e) => setBirthWeight(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calving-date">Calving Date *</Label>
                <Input
                  id="calving-date"
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={calvingDate}
                  onChange={(e) => setCalvingDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sire-tag">Father / Sire Tag (Optional)</Label>
                <Input
                  id="sire-tag"
                  placeholder="e.g. BULL-09 or AI Brahman"
                  value={sireTag}
                  onChange={(e) => setSireTag(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calving-ease">Calving Condition</Label>
                <Select value={calvingEase} onValueChange={setCalvingEase}>
                  <SelectTrigger id="calving-ease" className="bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal / Unassisted">Normal / Unassisted</SelectItem>
                    <SelectItem value="Slight Assistance">Slight Assistance</SelectItem>
                    <SelectItem value="Veterinary Assisted / Difficult">Veterinary Assisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="calving-notes">Notes / Observations</Label>
              <Textarea
                id="calving-notes"
                placeholder="Notes on calf vigor, nursing condition, colostrum intake..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRecordOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={recordCalvingMutation.isPending}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                {recordCalvingMutation.isPending ? "Saving..." : "Save Calving Record"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
