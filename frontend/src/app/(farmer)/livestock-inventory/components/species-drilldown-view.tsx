"use client";

import { ArrowLeft, ChevronRight, Layers } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LivestockRecordList from "../livestock-record-list";
import type { LivestockBatchItem, LivestockInventoryItem } from "../livestock-inventory";

interface SpeciesDrilldownViewProps {
  selectedType: string;
  items: LivestockInventoryItem[];
  batches?: LivestockBatchItem[];
  isLoading: boolean;
  livestockTypes: Record<string, number>;
  onBack: () => void;
  onView: (item: LivestockInventoryItem) => void;
  onEdit: (item: LivestockInventoryItem) => void;
  onDelete: (item: LivestockInventoryItem) => void;
  onAddRecord: () => void;
}

export function SpeciesDrilldownView({
  selectedType,
  items,
  batches,
  isLoading,
  livestockTypes,
  onBack,
  onView,
  onEdit,
  onDelete,
  onAddRecord,
}: SpeciesDrilldownViewProps) {
  const totalHeads = items.reduce((acc, i) => acc + i.quantity, 0);
  const speciesBatches = batches ?? [];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors cursor-pointer"
            title="Back to livestock types"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900">{selectedType}</h2>
            <p className="text-xs font-semibold text-slate-500">
              Your {selectedType.toLowerCase()} and their details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-100 text-emerald-800 border-0 font-bold px-3 py-1">
            {totalHeads} Animals
          </Badge>
          <Badge className="bg-slate-100 text-slate-700 border-0 font-bold px-3 py-1">
            {items.length} Records
          </Badge>
          {speciesBatches.length > 0 && (
            <Badge className="bg-teal-100 text-teal-800 border-0 font-bold px-3 py-1">
              {speciesBatches.length} {speciesBatches.length === 1 ? "Herd" : "Herds"}
            </Badge>
          )}
        </div>
      </div>

      {speciesBatches.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-4 rounded-2xl bg-teal-50/40 border border-teal-900/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-xl bg-teal-900/10 text-teal-900 flex items-center justify-center shrink-0">
                <Layers className="size-4.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-teal-950 tracking-tight">
                  {selectedType} Herds
                </h3>
                <p className="text-xs font-medium text-slate-500 truncate">
                  Animals raised together as one herd
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-900 border border-teal-200/60 shrink-0">
                {speciesBatches.length}
              </span>
            </div>
            <Link href="/livestock-inventory/batches" className="shrink-0">
              <Button
                type="button"
                variant="outline"
                className="gap-2 bg-white hover:bg-teal-50 border border-teal-900/15 hover:border-teal-300 text-teal-950 font-bold text-xs rounded-xl h-9 px-3.5 transition-colors cursor-pointer"
              >
                <Layers className="size-3.5 text-teal-700" />
                <span>View Herds</span>
                <ChevronRight className="size-3 text-slate-400 -ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      <LivestockRecordList
        items={items}
        isLoading={isLoading}
        livestockTypes={livestockTypes}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddRecord={onAddRecord}
      />
    </div>
  );
}
