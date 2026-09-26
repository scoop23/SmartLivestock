"use client";

import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import LivestockRecordList from "../livestock-record-list";
import type { LivestockInventoryItem } from "../livestock-inventory";

interface SpeciesDrilldownViewProps {
  selectedType: string;
  items: LivestockInventoryItem[];
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
  isLoading,
  livestockTypes,
  onBack,
  onView,
  onEdit,
  onDelete,
  onAddRecord,
}: SpeciesDrilldownViewProps) {
  const totalHeads = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors cursor-pointer"
            title="Back to all species"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900">{selectedType} Registry</h2>
            <p className="text-xs font-semibold text-slate-500">
              Viewing all {selectedType.toLowerCase()} records in your herd
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-100 text-emerald-800 border-0 font-bold px-3 py-1">
            {totalHeads} Total Heads
          </Badge>
          <Badge className="bg-slate-100 text-slate-700 border-0 font-bold px-3 py-1">
            {items.length} Records
          </Badge>
        </div>
      </div>

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
