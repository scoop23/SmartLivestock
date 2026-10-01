"use client";

import { Info, PhilippinePeso } from "lucide-react";
import type { ProductionRecordItem } from "./production-analytics";

const formatPeso = (val: string | number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(val) || 0);

export default function ProductionValuation({
  record,
  compact = false,
}: {
  record: ProductionRecordItem;
  compact?: boolean;
}) {
  const snapshot = record.valuationSnapshot;

  if (!snapshot) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap text-xs text-emerald-900">
        <span className="font-bold text-emerald-950">
          Est. {formatPeso(snapshot.estimated_value)}
        </span>
        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 font-medium">
          PSA {snapshot.reference_period}
        </span>
      </div>
    );
  }

  const isPreviousPeriod = snapshot.price_match === "PREVIOUS_PERIOD";

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-emerald-50/50 to-teal-50/40 p-3.5 space-y-2.5 shadow-2xs">
      {/* Top Row: Metric & Rate */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
            <PhilippinePeso className="size-3 text-emerald-600" />
            Estimated Production Value
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight">
              {formatPeso(snapshot.estimated_value)}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100/90 text-emerald-900 border border-emerald-200/80 text-[10px] font-bold">
            {formatPeso(snapshot.price)} / {snapshot.unit.toLowerCase()}
          </span>
          <p className="text-[10px] text-slate-500 mt-0.5">
            PSA {snapshot.reference_period}
            {isPreviousPeriod && " (prior)"}
          </p>
        </div>
      </div>

      {/* Calculation Formula */}
      <div className="text-[11px] text-emerald-900/80 flex items-center justify-between gap-2 flex-wrap bg-white/70 px-2.5 py-1 rounded-lg border border-emerald-100">
        <span>
          {record.quantity.toLocaleString()} {record.unit.toLowerCase()} × {formatPeso(snapshot.price)} / {snapshot.unit.toLowerCase()}
        </span>
        {snapshot.source_url ? (
          <a
            href={snapshot.source_url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${snapshot.source_title} (${snapshot.geography})`}
            className="text-[10px] font-medium text-emerald-700 hover:text-emerald-900 underline underline-offset-2 flex items-center gap-0.5 shrink-0"
          >
            PSA Ref ↗
          </a>
        ) : (
          <span className="text-[10px] text-slate-400">PSA benchmark</span>
        )}
      </div>

      {/* Farmer Friendly Note */}
      <div className="pt-2 border-t border-emerald-200/60 flex items-start gap-1.5 text-[11px] text-emerald-900 leading-snug">
        <span className="text-sm shrink-0">🌾</span>
        <p>
          <strong className="font-semibold text-emerald-950">Farmer Note:</strong>{" "}
          This is an estimated guide value based on official PSA benchmark farmgate rates to help evaluate harvest worth — this is not actual cash sales or guaranteed income.
        </p>
      </div>
    </div>
  );
}

