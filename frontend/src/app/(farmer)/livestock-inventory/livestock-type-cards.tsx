"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardDescription,CardTitle } from "@/components/ui/card";
import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from "@/components/ui/table";
import {
Beef,
ChevronRight,
Egg,
Layers,
LayoutGrid,
Package,
Shield,
Sparkles,
Table as TableIcon,
Tag
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { LivestockBatchItem } from "./livestock-inventory";
import type { LivestockInventoryItem } from "./page";

interface LivestockTypeCardsProps {
  inventories: LivestockInventoryItem[];
  batches: LivestockBatchItem[];
  isLoading: boolean;
  highlightedType?: string | null;
  onSelectType: (name: string) => void;
}

interface TypeSummary {
  name: string;
  heads: number;
  batches: number;
  individuals: number;
  approved: number;
  pending: number;
}

interface SpeciesVisualConfig {
  icon: React.ElementType;
  image?: string;
  cardBg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  chip: string;
}

// Species-specific visual styling & icons
const SPECIES_CONFIG: Record<string, SpeciesVisualConfig> = {
  Cattle: {
    icon: Beef,
    image: "/images/species-cattle.jpg",
    cardBg: "bg-emerald-50/40 hover:bg-emerald-50/70",
    border: "border-emerald-900/15",
    iconBg: "bg-emerald-900/10",
    iconColor: "text-emerald-900",
    chip: "bg-emerald-900/10 text-emerald-950 font-bold border-emerald-900/20",
  },
  Carabao: {
    icon: Shield,
    image: "/images/species-carabao.jpg",
    cardBg: "bg-teal-50/40 hover:bg-teal-50/70",
    border: "border-teal-900/15",
    iconBg: "bg-teal-900/10",
    iconColor: "text-teal-900",
    chip: "bg-teal-900/10 text-teal-950 font-bold border-teal-900/20",
  },
  Goat: {
    icon: Sparkles,
    image: "/images/species-goat.jpg",
    cardBg: "bg-amber-50/40 hover:bg-amber-50/70",
    border: "border-amber-900/15",
    iconBg: "bg-amber-900/10",
    iconColor: "text-amber-900",
    chip: "bg-amber-900/10 text-amber-950 font-bold border-amber-900/20",
  },
  Sheep: {
    icon: Package,
    image: "/images/sheep2.jfif",
    cardBg: "bg-violet-50/40 hover:bg-violet-50/70",
    border: "border-violet-900/15",
    iconBg: "bg-violet-900/10",
    iconColor: "text-violet-900",
    chip: "bg-violet-900/10 text-violet-950 font-bold border-violet-900/20",
  },
  Swine: {
    icon: Layers,
    image: "/images/species-swine.jpg",
    cardBg: "bg-sky-50/40 hover:bg-sky-50/70",
    border: "border-sky-900/15",
    iconBg: "bg-sky-900/10",
    iconColor: "text-sky-900",
    chip: "bg-sky-900/10 text-sky-950 font-bold border-sky-900/20",
  },
  Poultry: {
    icon: Egg,
    cardBg: "bg-orange-50/40 hover:bg-orange-50/70",
    border: "border-orange-900/15",
    iconBg: "bg-orange-900/10",
    iconColor: "text-orange-900",
    chip: "bg-orange-900/10 text-orange-950 font-bold border-orange-900/20",
  },
};

const DEFAULT_SPECIES_CONFIG: SpeciesVisualConfig = {
  icon: Tag,
  cardBg: "bg-slate-50/50 hover:bg-slate-50/80",
  border: "border-slate-900/10",
  iconBg: "bg-slate-900/10",
  iconColor: "text-slate-900",
  chip: "bg-slate-900/10 text-slate-950 font-bold border-slate-900/20",
};

function getSpeciesConfig(name: string): SpeciesVisualConfig {
  const key = Object.keys(SPECIES_CONFIG).find((k) =>
    name.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SPECIES_CONFIG[key] : DEFAULT_SPECIES_CONFIG;
}

const buildTypeSummaries = (
  inventories: LivestockInventoryItem[],
  batches: LivestockBatchItem[],
): TypeSummary[] => {
  const summaries = inventories.reduce<Record<string, TypeSummary>>((acc, item) => {
    const name = item.livestockTypeName?.trim() || "Livestock";
    const key = name.toLowerCase();
    const entry = (acc[key] ??= {
      name,
      heads: 0,
      batches: 0,
      individuals: 0,
      approved: 0,
      pending: 0,
    });
    entry.heads += item.quantity;
    // Keep legacy aggregate inventory entries visible as groups too.
    if (item.entryType === "BATCH") entry.batches += 1;
    else entry.individuals += 1;
    if (item.status === "APPROVED") entry.approved += item.quantity;
    else if (item.status === "PENDING") entry.pending += item.quantity;
    return acc;
  }, {});

  // A real herd is a LivestockBatch row whose roster contains individual
  // inventory records; those members do not have entry_type="BATCH".
  for (const batch of batches) {
    const name = batch.livestockTypeName?.trim() || "Livestock";
    const key = name.toLowerCase();
    const entry = (summaries[key] ??= {
      name,
      heads: 0,
      batches: 0,
      individuals: 0,
      approved: 0,
      pending: 0,
    });
    entry.batches += 1;
  }

  return Object.values(summaries).sort((a, b) => b.heads - a.heads);
};

export default function LivestockTypeCards({
  inventories,
  batches,
  isLoading,
  highlightedType,
  onSelectType,
}: LivestockTypeCardsProps) {
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const typeSummaries = buildTypeSummaries(inventories, batches);

  return (
    <div className="w-full min-w-0 max-w-full py-2 space-y-4">
      {/* Elevated Header Control Strip */}
      <div className="flex min-w-0 flex-col justify-between gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:px-4 sm:py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs border border-emerald-200/60">
            <Layers className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-emerald-950 tracking-tight">
                Species Explorer
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200/60 shrink-0">
                {typeSummaries.length} {typeSummaries.length === 1 ? "Category" : "Categories"}
              </span>
            </div>
            <p className="text-xs font-medium leading-snug text-slate-500 sm:truncate">
              Choose a livestock type to view your animals.
            </p>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
          {/* View Mode Switcher */}
          <div className="flex w-full min-w-0 items-center rounded-xl border border-slate-200/80 bg-slate-100/90 p-1 shadow-2xs sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition-all cursor-pointer sm:flex-initial sm:px-3 sm:py-1.5 ${
                viewMode === "card"
                  ? "bg-white text-emerald-950 shadow-xs border border-slate-200/80 font-extrabold"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/40"
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="size-3.5 text-emerald-700" />
              <span>Cards</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition-all cursor-pointer sm:flex-initial sm:px-3 sm:py-1.5 ${
                viewMode === "table"
                  ? "bg-white text-emerald-950 shadow-xs border border-slate-200/80 font-extrabold"
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/40"
              }`}
              title="Tabular Matrix View"
            >
              <TableIcon className="size-3.5 text-teal-700" />
              <span>Table</span>
            </button>
          </div>

          {/* View All Records Link */}
          <Button
            asChild
            variant="outline"
            className="h-11 w-full gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-bold text-emerald-950 shadow-2xs transition-all hover:border-emerald-300 hover:bg-emerald-50/80 cursor-pointer sm:h-9 sm:w-auto"
          >
            <Link href="/livestock-inventory/all">
              <Layers className="size-3.5 text-emerald-700" />
              <span>All Records</span>
              <ChevronRight className="-ml-1 size-3 text-slate-400" />
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : typeSummaries.length === 0 ? (
        <Card className="p-8 text-center border-2 border-dashed border-emerald-900/10 bg-emerald-50/20 rounded-2xl">
          <p className="text-stone-600 font-semibold text-sm">
            No livestock records yet. Add your first entry to get started.
          </p>
        </Card>
      ) : viewMode === "card" ? (
        /* ═══ CARD VIEW MODE ═══ */
        <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {typeSummaries.map((type) => {
            const config = getSpeciesConfig(type.name);
            const Icon = config.icon;
            const approvedRate =
              type.heads > 0 ? Math.round((type.approved / type.heads) * 100) : 0;

            return (
              <Card
                key={type.name}
                data-livestock-type={type.name}
                onClick={() => onSelectType(type.name)}
                className={`group relative w-full min-w-0 overflow-hidden rounded-2xl border-2 ${config.border} ${config.cardBg} shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between ${highlightedType?.toLowerCase() === type.name.toLowerCase() ? "!border-emerald-500 ring-4 ring-emerald-300/70 shadow-lg shadow-emerald-200" : ""}`}
              >
                {/* Visual Image Banner (if available) */}
                {config.image ? (
                  <div className="relative w-full h-36 overflow-hidden bg-slate-100 shrink-0">
                    <img
                      src={config.image}
                      alt={type.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/85 via-emerald-950/25 to-transparent" />

                    {/* Top Head Count Pill */}
                    <div className="absolute top-2.5 right-2.5">
                      <Badge
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md shadow-xs ${config.chip}`}
                      >
                        {type.heads} {type.heads === 1 ? "head" : "heads"}
                      </Badge>
                    </div>

                    {/* Bottom Overlay Title + Icon */}
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-center gap-2.5 min-w-0">
                      <div className={`p-1.5 rounded-lg ${config.iconBg} bg-white/95 backdrop-blur-md shrink-0 shadow-xs border border-white/60`}>
                        <Icon className={`size-4 ${config.iconColor}`} />
                      </div>
                      <div className="min-w-0 text-white drop-shadow-sm">
                        <CardTitle className="text-lg font-black tracking-tight leading-tight text-white whitespace-normal break-words">
                          {type.name}
                        </CardTitle>
                        <CardDescription className="text-[11px] font-medium text-white/85 whitespace-normal break-words">
                          {type.approved} verified • {type.batches + type.individuals} entries
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard Header: Icon Box + Title + Head Count Pill */
                  <div className="p-4 pb-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl ${config.iconBg} shrink-0`}>
                        <Icon className={`size-5 ${config.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-xl font-black text-emerald-950 tracking-tight whitespace-normal break-words">
                          {type.name}
                        </CardTitle>
                        <CardDescription className="text-xs font-semibold text-stone-600 whitespace-normal break-words mt-0.5">
                          {type.approved} verified • {type.batches + type.individuals} entries
                        </CardDescription>
                      </div>
                    </div>

                    <Badge
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider shrink-0 ${config.chip}`}
                    >
                      {type.heads} {type.heads === 1 ? "head" : "heads"}
                    </Badge>
                  </div>
                )}

                {/* Card Body Details */}
                <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                  {/* Progress Bar of Approved Ratio */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600">
                      <span>Review Status</span>
                      <span className="font-bold text-emerald-950">{approvedRate}%</span>
                    </div>
                    <div className="w-full bg-black/5 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${approvedRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Inner Stat Pill Cards */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-white/80 border border-emerald-900/10 shadow-2xs flex flex-col">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
                        Batches
                      </span>
                      <span className="font-extrabold text-emerald-950 leading-tight">
                        {type.batches} groups
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/80 border border-emerald-900/10 shadow-2xs flex flex-col">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
                        Individual Tags
                      </span>
                      <span className="font-extrabold text-emerald-950 leading-tight">
                        {type.individuals} tagged
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Button */}
                  <Button className="w-full h-9 rounded-xl bg-emerald-950 text-white font-extrabold text-xs hover:bg-emerald-900 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer">
                    Manage {type.name} <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ═══ TABLE VIEW MODE ═══ */
        <Card className="w-full min-w-0 max-w-full border-2 border-emerald-900/10 bg-white shadow-xs rounded-2xl overflow-hidden">
          <div className="w-full min-w-0 max-w-full overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader className="bg-emerald-950/5">
                <TableRow className="border-b border-emerald-900/10 hover:bg-transparent">
                  <TableHead className="font-black text-xs uppercase tracking-wider text-emerald-950 py-3.5 pl-5">
                    Livestock Type
                  </TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-wider text-emerald-950 py-3.5 text-center">
                    Total Heads
                  </TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-wider text-emerald-950 py-3.5 text-center">
                    Batches
                  </TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-wider text-emerald-950 py-3.5 text-center">
                    Individuals
                  </TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-wider text-emerald-950 py-3.5 text-center">
                    Approved Heads
                  </TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-wider text-emerald-950 py-3.5 text-right pr-5">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {typeSummaries.map((type) => {
                  const config = getSpeciesConfig(type.name);
                  const Icon = config.icon;
                  return (
                    <TableRow
                      key={type.name}
                      data-livestock-type={type.name}
                      onClick={() => onSelectType(type.name)}
                      className={`cursor-pointer border-b border-slate-100 hover:bg-emerald-50/40 transition-colors ${highlightedType?.toLowerCase() === type.name.toLowerCase() ? "bg-emerald-100 ring-2 ring-inset ring-emerald-500" : ""}`}
                    >
                      {/* Livestock Type Name + Icon + Thumbnail */}
                      <TableCell className="py-3 pl-5">
                        <div className="flex items-center gap-3">
                          {config.image ? (
                            <div className="relative size-10 rounded-xl overflow-hidden shrink-0 border border-slate-200/90 shadow-2xs">
                              <img
                                src={config.image}
                                alt={type.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className={`p-2 rounded-xl ${config.iconBg} shrink-0`}>
                              <Icon className={`size-4 ${config.iconColor}`} />
                            </div>
                          )}
                          <div>
                            <p className="font-black text-sm text-emerald-950">{type.name}</p>
                            <p className="text-[11px] font-semibold text-stone-500">
                              {type.batches + type.individuals} total records
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Total Heads */}
                      <TableCell className="text-center py-3.5">
                        <Badge
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-extrabold font-mono ${config.chip}`}
                        >
                          {type.heads} {type.heads === 1 ? "head" : "heads"}
                        </Badge>
                      </TableCell>

                      {/* Batches */}
                      <TableCell className="text-center py-3.5">
                        <span className="font-extrabold text-xs text-slate-700 font-mono bg-slate-100 px-2.5 py-1 rounded-lg">
                          {type.batches}
                        </span>
                      </TableCell>

                      {/* Individuals */}
                      <TableCell className="text-center py-3.5">
                        <span className="font-extrabold text-xs text-slate-700 font-mono bg-slate-100 px-2.5 py-1 rounded-lg">
                          {type.individuals}
                        </span>
                      </TableCell>

                      {/* Approved Heads */}
                      <TableCell className="text-center py-3.5">
                        <span className="inline-flex items-center text-xs font-extrabold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg font-mono">
                          {type.approved} heads
                        </span>
                      </TableCell>

                      {/* Action Button */}
                      <TableCell className="text-right py-3.5 pr-5">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectType(type.name);
                          }}
                          className="rounded-xl h-8 px-3 text-xs font-extrabold bg-emerald-950 text-white hover:bg-emerald-900 transition-colors shadow-2xs gap-1"
                        >
                          Manage <ChevronRight className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
