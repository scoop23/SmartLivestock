"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import type { LivestockInventoryItem } from "./page";
import { Layers } from "lucide-react";

import Link from "next/link";

interface LivestockTypeCardsProps {
  inventories: LivestockInventoryItem[];
  isLoading: boolean;
  onSelectType: (name: string) => void;
}

interface TypeSummary {
  name: string;
  heads: number;
  batches: number;
  individuals: number;
  approved: number;
}

const typeStyles: Record<
  string,
  { cardBg: string; border: string; iconBg: string; iconColor: string; chip: string }
> = {
  Cattle: {
    cardBg: "bg-emerald-50/30 hover:bg-emerald-50/60",
    border: "border-emerald-900/10",
    iconBg: "bg-emerald-900/10",
    iconColor: "text-emerald-900",
    chip: "bg-emerald-900/10 text-emerald-950 font-bold border-emerald-900/20",
  },
  Goat: {
    cardBg: "bg-amber-50/30 hover:bg-amber-50/60",
    border: "border-amber-900/10",
    iconBg: "bg-amber-900/10",
    iconColor: "text-amber-900",
    chip: "bg-amber-900/10 text-amber-950 font-bold border-amber-900/20",
  },
  Swine: {
    cardBg: "bg-sky-50/30 hover:bg-sky-50/60",
    border: "border-sky-900/10",
    iconBg: "bg-sky-900/10",
    iconColor: "text-sky-900",
    chip: "bg-sky-900/10 text-sky-950 font-bold border-sky-900/20",
  },
};

const typeStyleFallback = {
  cardBg: "bg-slate-50/30 hover:bg-slate-50/60",
  border: "border-slate-900/10",
  iconBg: "bg-slate-900/10",
  iconColor: "text-slate-900",
  chip: "bg-slate-900/10 text-slate-950 font-bold border-slate-900/20",
};

const buildTypeSummaries = (inventories: LivestockInventoryItem[]): TypeSummary[] =>
  Object.values(
    inventories.reduce<Record<string, TypeSummary>>((acc, item) => {
      const name = item.livestockTypeName;
      const entry = (acc[name] ??= { name, heads: 0, batches: 0, individuals: 0, approved: 0 });
      entry.heads += item.quantity;
      if (item.entryType === "BATCH") entry.batches += 1;
      else entry.individuals += 1;
      if (item.status === "APPROVED") entry.approved += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.heads - a.heads);

export default function LivestockTypeCards({ inventories, isLoading, onSelectType }: LivestockTypeCardsProps) {
  const typeSummaries = buildTypeSummaries(inventories);

  return (
    <div className="py-2">
      <div className="flex justify-between py-2 items-center">
        <h2 className="text-lg font-black text-emerald-950 tracking-tight">Select Livestock Type</h2>
        <Link href="/livestock-inventory/all">
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-2 border-emerald-900/10 bg-white/70 font-extrabold text-xs text-emerald-950 hover:bg-emerald-900/10 rounded-xl"
          >
            <Layers className="w-4 h-4 text-emerald-900" /> View All Records
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-10 text-emerald-600" />
        </div>
      ) : typeSummaries.length === 0 ? (
        <Card className="p-8 text-center border-2 border-dashed border-emerald-900/10 bg-emerald-50/20 rounded-2xl">
          <p className="text-stone-600 font-semibold text-sm">No livestock records yet. Add your first entry to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {typeSummaries.map((type) => {
            const style = typeStyles[type.name] ?? typeStyleFallback;
            return (
              <Card
                key={type.name}
                onClick={() => onSelectType(type.name)}
                className={`group relative overflow-hidden rounded-2xl border-2 ${style.border} ${style.cardBg} shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between p-4 space-y-3`}
              >
                {/* Header: Icon Box + Title + Head Count Pill */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl ${style.iconBg} shrink-0`}>
                      <Icon iconNode={cowHead} className={`size-5 ${style.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-xl font-black text-emerald-950 tracking-tight truncate">
                        {type.name}
                      </CardTitle>
                      <CardDescription className="text-xs font-semibold text-stone-600 truncate mt-0.5">
                        {type.approved} approved
                      </CardDescription>
                    </div>
                  </div>

                  <Badge className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${style.chip}`}>
                    {type.heads} {type.heads === 1 ? "head" : "heads"}
                  </Badge>
                </div>

                {/* Inner Stat Pill Cards */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2 rounded-xl bg-white/70 border border-emerald-900/10 shadow-2xs flex flex-col">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Batches</span>
                    <span className="font-extrabold text-emerald-950 leading-tight">{type.batches}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/70 border border-emerald-900/10 shadow-2xs flex flex-col">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Individuals</span>
                    <span className="font-extrabold text-emerald-950 leading-tight">{type.individuals}</span>
                  </div>
                </div>

                {/* Bottom Action Button */}
                <Button className="w-full h-9 rounded-xl bg-emerald-950 text-white font-extrabold text-xs hover:bg-emerald-900 transition-colors shadow-xs">
                  View Livestock
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
