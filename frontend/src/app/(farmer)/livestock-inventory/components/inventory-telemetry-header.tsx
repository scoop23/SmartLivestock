"use client";

import { useState, useMemo } from "react";
import {
  Layers,
  CheckCircle2,
  Clock,
  Tag,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import InventoryStats from "../inventory-stats";
import type { LivestockInventoryItem } from "../livestock-inventory";

interface InventoryTelemetryHeaderProps {
  inventories: LivestockInventoryItem[];
  isLoading: boolean;
}

export function InventoryTelemetryHeader({
  inventories,
  isLoading,
}: InventoryTelemetryHeaderProps) {
  const [showStats, setShowStats] = useState(true);

  const totalHeads = useMemo(
    () => inventories.reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );
  const approvedHeads = useMemo(
    () =>
      inventories
        .filter((i) => i.status === "APPROVED")
        .reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );
  const pendingRecords = useMemo(
    () => inventories.filter((i) => i.status === "PENDING").length,
    [inventories]
  );
  const individualTags = useMemo(
    () => inventories.filter((i) => i.entryType === "INDIVIDUAL").length,
    [inventories]
  );
  const vaccinatedHeads = useMemo(
    () =>
      inventories
        .filter((i) => Boolean(i.lastVaccinationDate))
        .reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );
  const vaxRate = totalHeads > 0 ? Math.round((vaccinatedHeads / totalHeads) * 100) : 0;
  const approvalRate = totalHeads > 0 ? Math.round((approvedHeads / totalHeads) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Herd Telemetry & Biometric KPIs
          </h2>
          <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
            • {inventories.length} {inventories.length === 1 ? "record" : "records"} active
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowStats((prev) => !prev)}
          className="h-8 px-3 text-xs font-bold text-slate-600 hover:text-emerald-950 hover:bg-emerald-50/80 hover:border-emerald-300 rounded-xl gap-1.5 transition-all shadow-2xs border-slate-200 bg-white cursor-pointer"
        >
          {showStats ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
              <span>Hide Stats</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              <span>Show Stats</span>
            </>
          )}
        </Button>
      </div>

      {showStats ? (
        <InventoryStats inventories={inventories} isLoading={isLoading} layout="horizontal" />
      ) : (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs">
          <div className="flex items-center gap-3 sm:gap-6 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
              <Layers className="size-3.5 text-emerald-600" />
              <span>{totalHeads.toLocaleString()}</span>
              <span className="text-slate-400 font-medium text-[11px]">Total Heads</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
              <CheckCircle2 className="size-3.5 text-sky-600" />
              <span>{approvedHeads.toLocaleString()}</span>
              <span className="text-slate-400 font-medium text-[11px]">Approved ({approvalRate}%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
              <Clock className="size-3.5 text-amber-600" />
              <span>{pendingRecords.toLocaleString()}</span>
              <span className="text-slate-400 font-medium text-[11px]">Pending</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
              <Tag className="size-3.5 text-orange-600" />
              <span>{individualTags.toLocaleString()}</span>
              <span className="text-slate-400 font-medium text-[11px]">Tagged</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              <span>{vaxRate}%</span>
              <span className="text-slate-400 font-medium text-[11px]">Vaccinated</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowStats(true)}
            className="text-[11px] font-black text-emerald-700 hover:text-emerald-900 hover:underline shrink-0 ml-3 cursor-pointer"
          >
            Expand KPIs
          </button>
        </div>
      )}
    </div>
  );
}
