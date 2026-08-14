"use client";

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import type { LivestockInventoryItem } from "./page";
import {
  Layers,
} from "lucide-react";


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

const typeStyles: Record<string, { gradient: string; chip: string }> = {
  Cattle: { gradient: "from-emerald-600 to-emerald-400", chip: "bg-emerald-100 text-emerald-700" },
  Goat: { gradient: "from-amber-600 to-amber-400", chip: "bg-amber-100 text-amber-700" },
  Swine: { gradient: "from-sky-600 to-sky-400", chip: "bg-sky-100 text-sky-700" },
};

const typeStyleFallback = { gradient: "from-slate-600 to-slate-400", chip: "bg-slate-100 text-slate-700" };

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
        <h2 className="text-lg font-bold text-slate-900 mb-4">Select Livestock Type</h2>
        <Link href="/livestock-inventory/all">
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-slate-300"
          >
            <Layers className="w-4 h-4" /> View All Records
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="size-10 text-emerald-600" />
        </div>
      ) : typeSummaries.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-slate-200">
          <p className="text-slate-500">No livestock records yet. Add your first entry to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {typeSummaries.map((type) => {
            const style = typeStyles[type.name] ?? typeStyleFallback;
            return (
              <Card
                key={type.name}
                onClick={() => onSelectType(type.name)}
                className="group relative overflow-hidden rounded-2xl border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className={`relative h-32 bg-gradient-to-br ${style.gradient}`}>
                  <Icon
                    iconNode={cowHead}
                    className="absolute inset-0 m-auto size-16 text-white/40 transition-transform group-hover:scale-110"
                  />
                  <Badge className={`absolute top-3 right-3 ${style.chip}`}>
                    {type.heads} {type.heads === 1 ? "head" : "heads"}
                  </Badge>
                </div>
                <CardHeader className="p-0 px-4.5">
                  <CardTitle>{type.name}</CardTitle>
                  <CardDescription>
                    {type.batches} {type.batches === 1 ? "batch" : "batches"} •{" "}
                    {type.individuals} {type.individuals === 1 ? "individual" : "individuals"} •{" "}
                    {type.approved} approved
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button className="w-full">View Livestock</Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
