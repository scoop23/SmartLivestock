"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import { Clock, CheckCircle2, XCircle, MapPin } from "lucide-react";

interface ValidationKpisProps {
  kpis: {
    pending: number;
    approved: number;
    flagged: number;
    activeBarangays: number;
  };
}

export function ValidationKpis({ kpis }: ValidationKpisProps) {
  return (
    <>
      {/* ── MOBILE COMPACT 2x2 KPI GRID (under sm) ── */}
      <div className="sm:hidden grid grid-cols-2 gap-2">
        {/* Pending Review */}
        <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-white border border-amber-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              Action
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 tracking-tight leading-none">
              {kpis.pending}
            </div>
            <p className="text-[10px] font-black text-stone-500 uppercase tracking-wider mt-1 truncate">
              Pending Review
            </p>
          </div>
        </div>

        {/* Certified Records */}
        <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-50/50 to-white border border-emerald-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-full">
              Certified
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 tracking-tight leading-none">
              {kpis.approved}
            </div>
            <p className="text-[10px] font-black text-stone-500 uppercase tracking-wider mt-1 truncate">
              Approved
            </p>
          </div>
        </div>

        {/* Flagged / Rejected */}
        <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-500/10 via-rose-50/50 to-white border border-rose-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-800 shrink-0">
              <XCircle className="w-3.5 h-3.5" />
            </div>
            <span className="text-[9px] font-black uppercase text-rose-700 bg-rose-100/80 px-1.5 py-0.5 rounded-full">
              Returned
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 tracking-tight leading-none">
              {kpis.flagged}
            </div>
            <p className="text-[10px] font-black text-stone-500 uppercase tracking-wider mt-1 truncate">
              Flagged
            </p>
          </div>
        </div>

        {/* Active Coverage */}
        <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-500/10 via-sky-50/50 to-white border border-sky-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-1.5 rounded-lg bg-sky-100 text-sky-800 shrink-0">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <span className="text-[9px] font-black uppercase text-sky-700 bg-sky-100/80 px-1.5 py-0.5 rounded-full">
              Coverage
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 tracking-tight leading-none">
              {kpis.activeBarangays}
            </div>
            <p className="text-[10px] font-black text-stone-500 uppercase tracking-wider mt-1 truncate">
              Barangays
            </p>
          </div>
        </div>
      </div>

      {/* ── DESKTOP & TABLET KPI STRIP (sm and up) ── */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Pending Review"
          value={kpis.pending}
          variant="amber"
          layout="horizontal"
          icon={<Clock className="w-5 h-5 text-amber-700" />}
          badge={
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-900">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              Action Needed
            </span>
          }
          description="Submissions awaiting MAO review"
        />

        <KpiCard
          title="Certified Records"
          value={kpis.approved}
          variant="emerald"
          layout="horizontal"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-700" />}
          badge="Approved"
          description="Verified against field survey logs"
        />

        <KpiCard
          title="Flagged / Rejected"
          value={kpis.flagged}
          variant="rose"
          layout="horizontal"
          icon={<XCircle className="w-5 h-5 text-rose-700" />}
          badge="Returned"
          description="Rectifications or field re-checks"
        />

        <KpiCard
          title="Active Barangays"
          value={kpis.activeBarangays}
          variant="sky"
          layout="horizontal"
          icon={<MapPin className="w-5 h-5 text-sky-700" />}
          badge="Coverage"
          description="Barangays with recorded entries"
        />
      </div>
    </>
  );
}
