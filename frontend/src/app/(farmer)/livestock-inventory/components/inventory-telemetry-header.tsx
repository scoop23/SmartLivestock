"use client";

import InventoryStats from "../inventory-stats";
import type { LivestockBatchItem, LivestockInventoryItem } from "../livestock-inventory";

interface InventoryTelemetryHeaderProps {
  inventories: LivestockInventoryItem[];
  batches: LivestockBatchItem[];
  isLoading: boolean;
}

export function InventoryTelemetryHeader({
  inventories,
  batches,
  isLoading,
}: InventoryTelemetryHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Livestock Overview
          </h2>
          <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
            • {inventories.length} {inventories.length === 1 ? "record" : "records"} active
          </span>
        </div>

      </div>

      <InventoryStats inventories={inventories} batches={batches} isLoading={isLoading} layout="vertical" />
    </div>
  );
}
