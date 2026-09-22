"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Baby, HeartPulse, Plus, Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import api from "@/lib/axios";
import type { LivestockInventoryItem } from "../livestock-inventory/page";
import BirthingRegistrationDialog from "./components/birthing-registration-dialog";
import BirthingRecordsTable from "./components/birthing-records-table";

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

export interface BirthingSpeciesTerminology {
  eventName: string;
  damName: string;
  sireName: string;
  offspringName: string;
  offspringPlural: string;
  femaleOffspring: string;
  maleOffspring: string;
}

export function getBirthingTerminology(species?: string | null): BirthingSpeciesTerminology {
  if (!species || species === "ALL") {
    return {
      eventName: "Birthing",
      damName: "Mother / Dam",
      sireName: "Father / Sire",
      offspringName: "Offspring",
      offspringPlural: "Offspring Born",
      femaleOffspring: "Female Offspring",
      maleOffspring: "Male Offspring",
    };
  }

  const s = species.toLowerCase();
  if (s.includes("goat") || s.includes("kambing") || s.includes("caprine")) {
    return {
      eventName: "Kidding",
      damName: "Doe (Mother Goat)",
      sireName: "Buck (Sire)",
      offspringName: "Kid",
      offspringPlural: "Kids Born",
      femaleOffspring: "Doelings (Female)",
      maleOffspring: "Bucklings (Male)",
    };
  }
  if (s.includes("sheep") || s.includes("tupa") || s.includes("ovine")) {
    return {
      eventName: "Lambing",
      damName: "Ewe (Mother Sheep)",
      sireName: "Ram (Sire)",
      offspringName: "Lamb",
      offspringPlural: "Lambs Born",
      femaleOffspring: "Ewe Lambs (Female)",
      maleOffspring: "Ram Lambs (Male)",
    };
  }
  if (s.includes("swine") || s.includes("pig") || s.includes("baboy") || s.includes("porcine")) {
    return {
      eventName: "Farrowing",
      damName: "Sow (Mother)",
      sireName: "Boar (Sire)",
      offspringName: "Piglet",
      offspringPlural: "Piglets Farrowed",
      femaleOffspring: "Gilts (Female)",
      maleOffspring: "Boar Piglets (Male)",
    };
  }
  if (s.includes("poultry") || s.includes("chicken") || s.includes("manok") || s.includes("duck")) {
    return {
      eventName: "Hatching",
      damName: "Layer Hen",
      sireName: "Rooster (Sire)",
      offspringName: "Chick",
      offspringPlural: "Chicks Hatched",
      femaleOffspring: "Pullets (Female)",
      maleOffspring: "Cockerels (Male)",
    };
  }
  // Default Cattle / Carabao
  return {
    eventName: "Calving",
    damName: "Dam (Mother Cow)",
    sireName: "Sire / Bull",
    offspringName: "Calf",
    offspringPlural: "Calves Born",
    femaleOffspring: "Heifers (Female)",
    maleOffspring: "Bulls (Male)",
  };
}

export default function ProductionCalvingTab({
  approvedInventories,
  selectedSpecies,
}: {
  approvedInventories: LivestockInventoryItem[];
  selectedSpecies?: string | null;
}) {
  const queryClient = useQueryClient();
  const [isRecordOpen, setIsRecordOpen] = useState(false);

  const terms = getBirthingTerminology(selectedSpecies);

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
      toast.success(`${terms.eventName} & birth record logged successfully!`);
      setIsRecordOpen(false);
      queryClient.invalidateQueries({ queryKey: ["calving_records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: () => {
      toast.error(`Failed to record ${terms.eventName.toLowerCase()} details.`);
    },
  });

  const femaleLivestock = approvedInventories.filter((item) => {
    if (selectedSpecies && selectedSpecies !== "ALL") {
      return (
        item.livestockTypeName?.toLowerCase() === selectedSpecies.toLowerCase() &&
        (item.sex?.toUpperCase().includes("F") ||
          item.sex?.toUpperCase().includes("FEMALE") ||
          item.entryType === "BATCH")
      );
    }
    return (
      item.sex?.toUpperCase().includes("F") ||
      item.sex?.toUpperCase().includes("FEMALE") ||
      item.entryType === "BATCH" ||
      item.livestockTypeName?.toLowerCase().includes("cattle")
    );
  });

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
      {/* Top Birthing KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={`Total ${terms.offspringPlural}`}
          value={totalCalves.toString()}
          icon={<Baby className="size-4.5" />}
          badge="Live births"
          variant="emerald"
        />
        <KpiCard
          title={terms.femaleOffspring}
          value={femaleCalves.toString()}
          icon={<HeartPulse className="size-4.5" />}
          badge="Future breeding stock"
          variant="sky"
        />
        <KpiCard
          title={terms.maleOffspring}
          value={maleCalves.toString()}
          icon={<Sparkles className="size-4.5" />}
          badge="Market / Fattening"
          variant="orange"
        />
        <KpiCard
          title="Avg Birth Weight"
          value={avgBirthWeight !== "—" ? `${avgBirthWeight} kg` : "—"}
          icon={<Scale className="size-4.5" />}
          badge="Baseline vitality"
          variant="amber"
        />
      </div>

      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {terms.eventName} & Birth Registry
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Record new born {terms.offspringPlural.toLowerCase()}, pedigree lineage, and birth weights.
          </p>
        </div>
        <Button
          onClick={() => setIsRecordOpen(true)}
          className="bg-[#2D5A27] hover:bg-[#23471f] text-white shadow-xs font-black text-xs rounded-xl h-9 px-4 gap-2 cursor-pointer"
        >
          <Plus className="size-4" /> Record New {terms.eventName}
        </Button>
      </div>

      {/* Birthing History List Table */}
      <BirthingRecordsTable
        records={calvingRecords}
        terms={terms}
        isLoading={isLoading}
        onOpenNew={() => setIsRecordOpen(true)}
      />

      {/* Birthing Registration Modal Dialog */}
      <BirthingRegistrationDialog
        open={isRecordOpen}
        onOpenChange={setIsRecordOpen}
        terms={terms}
        femaleLivestock={femaleLivestock}
        onSubmit={(payload) => recordCalvingMutation.mutate(payload)}
        isSubmitting={recordCalvingMutation.isPending}
      />
    </div>
  );
}
