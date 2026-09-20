"use client";

import { useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LivestockInventoryItem } from "./page";
import {
  Layers,
  LayoutGrid,
  Table as TableIcon,
  ChevronRight,
  Beef,
  Shield,
  Sparkles,
  Package,
  Egg,
  Tag,
  CheckCircle2,
  Clock,
  HelpCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  pending: number;
}

// Species-specific visual styling & icons
const SPECIES_CONFIG: Record<
  string,
  {
    icon: React.ElementType;
    cardBg: string;
    border: string;
    iconBg: string;
    iconColor: string;
    chip: string;
  }
> = {
  Cattle: {
    icon: Beef,
    cardBg: "bg-emerald-50/40 hover:bg-emerald-50/70",
    border: "border-emerald-900/15",
    iconBg: "bg-emerald-900/10",
    iconColor: "text-emerald-900",
    chip: "bg-emerald-900/10 text-emerald-950 font-bold border-emerald-900/20",
  },
  Carabao: {
    icon: Shield,
    cardBg: "bg-teal-50/40 hover:bg-teal-50/70",
    border: "border-teal-900/15",
    iconBg: "bg-teal-900/10",
    iconColor: "text-teal-900",
    chip: "bg-teal-900/10 text-teal-950 font-bold border-teal-900/20",
  },
  Goat: {
    icon: Sparkles,
    cardBg: "bg-amber-50/40 hover:bg-amber-50/70",
    border: "border-amber-900/15",
    iconBg: "bg-amber-900/10",
    iconColor: "text-amber-900",
    chip: "bg-amber-900/10 text-amber-950 font-bold border-amber-900/20",
  },
  Sheep: {
    icon: Package,
    cardBg: "bg-violet-50/40 hover:bg-violet-50/70",
    border: "border-violet-900/15",
    iconBg: "bg-violet-900/10",
    iconColor: "text-violet-900",
    chip: "bg-violet-900/10 text-violet-950 font-bold border-violet-900/20",
  },
  Swine: {
    icon: Layers,
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

const DEFAULT_SPECIES_CONFIG = {
  icon: Tag,
  cardBg: "bg-slate-50/50 hover:bg-slate-50/80",
  border: "border-slate-900/10",
  iconBg: "bg-slate-900/10",
  iconColor: "text-slate-900",
  chip: "bg-slate-900/10 text-slate-950 font-bold border-slate-900/20",
};

function getSpeciesConfig(name: string) {
  const key = Object.keys(SPECIES_CONFIG).find((k) =>
    name.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SPECIES_CONFIG[key] : DEFAULT_SPECIES_CONFIG;
}

const buildTypeSummaries = (inventories: LivestockInventoryItem[]): TypeSummary[] =>
  Object.values(
    inventories.reduce<Record<string, TypeSummary>>((acc, item) => {
      const name = item.livestockTypeName;
      const entry = (acc[name] ??= {
        name,
        heads: 0,
        batches: 0,
        individuals: 0,
        approved: 0,
        pending: 0,
      });
      entry.heads += item.quantity;
      if (item.entryType === "BATCH") entry.batches += 1;
      else entry.individuals += 1;
      if (item.status === "APPROVED") entry.approved += item.quantity;
      else if (item.status === "PENDING") entry.pending += item.quantity;
      return acc;
    }, {})
  ).sort((a, b) => b.heads - a.heads);

export default function LivestockTypeCards({
  inventories,
  isLoading,
  onSelectType,
}: LivestockTypeCardsProps) {
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const typeSummaries = buildTypeSummaries(inventories);

  return (
    <div className="py-2 space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 py-1">
        <div>
          <h2 className="text-lg font-black text-emerald-950 tracking-tight">Species Breakdown</h2>
          <p className="text-xs font-semibold text-stone-500">
            Click any category to filter records and view individual profiles
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher Buttons */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === "card"
                  ? "bg-white text-emerald-950 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Card View"
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden xs:inline">Cards</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-emerald-950 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Table View"
            >
              <TableIcon className="size-3.5" />
              <span className="hidden xs:inline">Table</span>
            </button>
          </div>

          {/* View All Records Link */}
          <Link href="/livestock-inventory/all">
            <Button
              type="button"
              variant="outline"
              className="gap-2 border border-emerald-900/15 bg-white font-extrabold text-xs text-emerald-950 hover:bg-emerald-50 rounded-xl h-9"
            >
              <Layers className="w-4 h-4 text-emerald-900" /> View All Records
            </Button>
          </Link>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
          {typeSummaries.map((type) => {
            const config = getSpeciesConfig(type.name);
            const Icon = config.icon;
            const approvedRate =
              type.heads > 0 ? Math.round((type.approved / type.heads) * 100) : 0;

            return (
              <Card
                key={type.name}
                onClick={() => onSelectType(type.name)}
                className={`group relative overflow-hidden rounded-2xl border-2 ${config.border} ${config.cardBg} shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between p-4 space-y-3.5`}
              >
                {/* Header: Icon Box + Title + Head Count Pill */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl ${config.iconBg} shrink-0`}>
                      <Icon className={`size-5 ${config.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-xl font-black text-emerald-950 tracking-tight truncate">
                        {type.name}
                      </CardTitle>
                      <CardDescription className="text-xs font-semibold text-stone-600 truncate mt-0.5">
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

                {/* Progress Bar of Approved Ratio */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600">
                    <span>Registry Verification</span>
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
                <Button className="w-full h-9 rounded-xl bg-emerald-950 text-white font-extrabold text-xs hover:bg-emerald-900 transition-colors shadow-xs flex items-center justify-center gap-1.5">
                  Manage {type.name} <ChevronRight className="size-3.5" />
                </Button>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ═══ TABLE VIEW MODE ═══ */
        <Card className="border-2 border-emerald-900/10 bg-white shadow-xs rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
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
                      onClick={() => onSelectType(type.name)}
                      className="cursor-pointer border-b border-slate-100 hover:bg-emerald-50/40 transition-colors"
                    >
                      {/* Livestock Type Name + Icon */}
                      <TableCell className="py-3.5 pl-5">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${config.iconBg} shrink-0`}>
                            <Icon className={`size-4 ${config.iconColor}`} />
                          </div>
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
