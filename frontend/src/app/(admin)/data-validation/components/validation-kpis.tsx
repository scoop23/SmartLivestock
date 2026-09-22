"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import { Clock, CheckCircle2, XCircle, MapPin, ShieldCheck, UserCheck } from "lucide-react";

interface ValidationKpisProps {
  kpis: {
    pending: number;
    verified: number;
    approved: number;
    flagged: number;
    activeBarangays: number;
  };
}

export function ValidationKpis({ kpis }: ValidationKpisProps) {
  return (
    <>
      {/* ── MOBILE COMPACT KPI GRID (under sm) ── */}
      <div className="sm:hidden grid grid-cols-2 gap-2">
        {/* Pending Review */}
        <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-white border border-amber-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              Pending
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 tracking-tight leading-none">
              {kpis.pending}
            </div>
            <p className="text-[10px] font-black text-stone-500 uppercase tracking-wider mt-1 truncate">
              Awaiting SIBAT
            </p>
          </div>
        </div>

        {/* Verified by SIBAT */}
        <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-500/10 via-sky-50/50 to-white border border-sky-200/70 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-1.5 rounded-lg bg-sky-100 text-sky-800 shrink-0">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-sky-700 bg-sky-100/80 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              Ready
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 tracking-tight leading-none">
              {kpis.verified}
            </div>
            <p className="text-[10px] font-black text-sky-700 uppercase tracking-wider mt-1 truncate">
              Verified by SIBAT
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
              MAO Approved
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

        {/* Active Coverage (Full Width on mobile) */}
        <div className="col-span-2 p-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-white shrink-0">
              <MapPin className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                Active Barangay Coverage
              </p>
              <p className="text-xs text-slate-400 font-medium">Municipal reporting coverage</p>
            </div>
          </div>
          <div className="text-right font-mono">
            <span className="text-xl font-black text-white">{kpis.activeBarangays}</span>
            <span className="text-xs text-slate-400 font-bold ml-1">Barangays</span>
          </div>
        </div>
      </div>

      {/* ── DESKTOP & TABLET KPI STRIP (sm and up) ── */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard
          title="Awaiting SIBAT"
          value={kpis.pending}
          variant="amber"
          layout="horizontal"
          icon={<Clock className="w-5 h-5 text-amber-700" />}
          badge={
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-900">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              Pending Check
            </span>
          }
          description="Submissions awaiting SIBAT field check"
        />

        <KpiCard
          title="Verified by SIBAT"
          value={kpis.verified}
          variant="sky"
          layout="horizontal"
          icon={<UserCheck className="w-5 h-5 text-sky-700" />}
          badge={
            <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-900">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              Ready for MAO
            </span>
          }
          description="Field-verified, ready for final MAO certification"
        />

        <KpiCard
          title="MAO Certified"
          value={kpis.approved}
          variant="emerald"
          layout="horizontal"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-700" />}
          badge="Approved"
          description="Official certified municipal records"
        />

        <KpiCard
          title="Flagged / Returned"
          value={kpis.flagged}
          variant="rose"
          layout="horizontal"
          icon={<XCircle className="w-5 h-5 text-rose-700" />}
          badge="Returned"
          description="Requires correction or re-inspection"
        />

        <KpiCard
          title="Active Barangays"
          value={kpis.activeBarangays}
          variant="stone"
          layout="horizontal"
          icon={<MapPin className="w-5 h-5 text-stone-700" />}
          badge="Coverage"
          description="Barangays with recorded entries"
        />
      </div>
    </>
  );
}
