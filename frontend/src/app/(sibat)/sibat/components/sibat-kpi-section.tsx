"use client";

import { CheckCircle2, Clock, FileSpreadsheet, Milk, Sparkles, Stethoscope, Tag, HeartHandshake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { UnifiedSubmissionItem, CensusSubmissionRecord } from "../sibat-analytics";
import type { SibatValidationRecord } from "@/app/(sibat)/sibat-validation/sibat-inspection-dialog";

interface SibatKpiSectionProps {
  healthRecords: SibatValidationRecord[];
  submissions: UnifiedSubmissionItem[];
  censuses: CensusSubmissionRecord[];
  isLoadingHealth: boolean;
  isLoadingSubmissions: boolean;
  isLoadingCensus: boolean;
  onSelectTab?: (tab: "health" | "production" | "inventory" | "census") => void;
}

export default function SibatKpiSection({
  healthRecords,
  submissions,
  censuses,
  isLoadingHealth,
  isLoadingSubmissions,
  isLoadingCensus,
  onSelectTab,
}: SibatKpiSectionProps) {
  // Health counts
  const pendingHealthCount = healthRecords.filter((r) => r.status === "PENDING").length;

  // Production counts
  const prodSubmissions = submissions.filter((s) => s.sourceType === "PRODUCTION");
  const pendingProdCount = prodSubmissions.filter((s) => s.status === "PENDING").length;

  // Inventory counts
  const invSubmissions = submissions.filter((s) => s.sourceType === "INVENTORY");
  const pendingInvCount = invSubmissions.filter((s) => s.status === "PENDING").length;

  // Census counts
  const totalCensusHeads = censuses.reduce(
    (sum, c) => sum + (Number(c.totalHeads) || 0),
    0
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Health & Illness Checks */}
      <Card
        onClick={() => onSelectTab?.("health")}
        className="group relative cursor-pointer border-slate-200/80 bg-white hover:border-rose-300 hover:shadow-md transition-all duration-200 rounded-3xl overflow-hidden shadow-2xs"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-400 to-rose-600" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Health Checks
            </span>
            <div className="size-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
              <Stethoscope className="size-5" />
            </div>
          </div>

          {isLoadingHealth ? (
            <Skeleton className="h-8 w-16 mb-2" />
          ) : (
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {pendingHealthCount}
              </span>
              <span className="text-xs font-bold text-slate-400">pending visits</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span
              className={`inline-flex items-center gap-1 font-extrabold text-[11px] px-2 py-0.5 rounded-full ${
                pendingHealthCount > 0
                  ? "bg-rose-100/80 text-rose-800"
                  : "bg-emerald-100/80 text-emerald-800"
              }`}
            >
              {pendingHealthCount > 0 ? "👀 Needs on-farm visit" : "🌟 All healthy!"}
            </span>
            <span className="text-slate-400 font-medium group-hover:text-rose-600 transition-colors">
              View →
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Milk & Harvest Yields */}
      <Card
        onClick={() => onSelectTab?.("production")}
        className="group relative cursor-pointer border-slate-200/80 bg-white hover:border-sky-300 hover:shadow-md transition-all duration-200 rounded-3xl overflow-hidden shadow-2xs"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 to-blue-600" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Milk & Harvest Logs
            </span>
            <div className="size-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
              <Milk className="size-5" />
            </div>
          </div>

          {isLoadingSubmissions ? (
            <Skeleton className="h-8 w-16 mb-2" />
          ) : (
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {pendingProdCount}
              </span>
              <span className="text-xs font-bold text-slate-400">to calibrate</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span
              className={`inline-flex items-center gap-1 font-extrabold text-[11px] px-2 py-0.5 rounded-full ${
                pendingProdCount > 0
                  ? "bg-sky-100/80 text-sky-800"
                  : "bg-emerald-100/80 text-emerald-800"
              }`}
            >
              {pendingProdCount > 0 ? `🥛 ${pendingProdCount} logs to check` : "✨ All calibrated"}
            </span>
            <span className="text-slate-400 font-medium group-hover:text-sky-600 transition-colors">
              View →
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Livestock & Ear Tagging */}
      <Card
        onClick={() => onSelectTab?.("inventory")}
        className="group relative cursor-pointer border-slate-200/80 bg-white hover:border-amber-300 hover:shadow-md transition-all duration-200 rounded-3xl overflow-hidden shadow-2xs"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Ear Tagging & Registry
            </span>
            <div className="size-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
              <Tag className="size-5" />
            </div>
          </div>

          {isLoadingSubmissions ? (
            <Skeleton className="h-8 w-16 mb-2" />
          ) : (
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {pendingInvCount}
              </span>
              <span className="text-xs font-bold text-slate-400">new animals</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span
              className={`inline-flex items-center gap-1 font-extrabold text-[11px] px-2 py-0.5 rounded-full ${
                pendingInvCount > 0
                  ? "bg-amber-100/80 text-amber-800"
                  : "bg-emerald-100/80 text-emerald-800"
              }`}
            >
              {pendingInvCount > 0 ? `🏷️ ${pendingInvCount} to inspect` : "🎉 All tagged"}
            </span>
            <span className="text-slate-400 font-medium group-hover:text-amber-600 transition-colors">
              View →
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Barangay Census Surveys */}
      <Card
        onClick={() => onSelectTab?.("census")}
        className="group relative cursor-pointer border-slate-200/80 bg-white hover:border-emerald-300 hover:shadow-md transition-all duration-200 rounded-3xl overflow-hidden shadow-2xs"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-teal-600" />
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Barangay Census Surveys
            </span>
            <div className="size-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="size-5" />
            </div>
          </div>

          {isLoadingCensus ? (
            <Skeleton className="h-8 w-16 mb-2" />
          ) : (
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {censuses.length}
              </span>
              <span className="text-xs font-bold text-slate-400">surveys submitted</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="inline-flex items-center gap-1 font-extrabold text-[11px] px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800">
              📊 {totalCensusHeads.toLocaleString()} Total Heads
            </span>
            <span className="text-slate-400 font-medium group-hover:text-emerald-600 transition-colors">
              View →
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
