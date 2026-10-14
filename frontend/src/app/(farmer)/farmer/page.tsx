"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/app/components/page-header";
import {
  RefreshCw,
  Sparkles,
  Map,
  MapPin,
  CalendarDays,
  Megaphone,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import FarmerStats from "./farmer-stats";
import FarmerCharts from "./farmer-charts";
import FarmerProgramsVisits from "./components/farmer-programs-visits";
import FarmerActivityFeed from "./farmer-activity-feed";
import { useFarmerDashboardAnalytics } from "./farmer-analytics";
import ReportIllnessDialog from "../report-observation/components/report-illness-dialog";
import ReportDetailDialog from "../report-observation/components/report-detail-dialog";
import FarmerReportsListDialog from "../components/farmer-reports-list-dialog";
import { FarmerReport } from "../report-observation/report-observation-types";

export default function FarmerDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    data: analytics,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useFarmerDashboardAnalytics();

  // ── Dialog States ──
  const [isReportIllnessOpen, setIsReportIllnessOpen] = useState(false);
  const [reportIllnessDefaultType, setReportIllnessDefaultType] = useState<"DISEASE" | "MORTALITY">("DISEASE");
  const [isReportsListOpen, setIsReportsListOpen] = useState(false);
  const [selectedReportDetail, setSelectedReportDetail] = useState<FarmerReport | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const farmerName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : "Farmer";

  // Dynamic greeting based on current local hour
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good Morning"
      : currentHour < 18
      ? "Good Afternoon"
      : "Good Evening";

  // Handle opening illness dialog with specific default type
  const handleOpenReportIllness = (defaultType: "DISEASE" | "MORTALITY" = "DISEASE") => {
    setReportIllnessDefaultType(defaultType);
    setIsReportIllnessOpen(true);
  };

  return (
    <>
      <PageHeader
        title={`${greeting}, ${farmerName}!`}
        subtitle="Your livestock, farm records, and updates in one place."
        variant="farmer"
        maxWidthClass="w-full"
        mobileActionsRow
        action={
          <>
            {user?.barangay ? (
              <span
                className="inline-flex items-center gap-1.5 h-11 max-w-[38vw] sm:max-w-none px-2.5 sm:px-3 rounded-xl bg-white/15 border border-white/20 text-white text-[11px] sm:text-xs font-bold backdrop-blur-xs shadow-xs min-w-0"
                title="Your registered barangay"
              >
                <MapPin className="size-4 shrink-0" />
                <span className="truncate">Brgy. {user.barangay}</span>
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
              title="Refresh Dashboard Data"
            >
              <RefreshCw className={`size-5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        <section aria-label="Quick actions" className="space-y-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Quick actions</h2>
            <p className="mt-0.5 text-sm text-slate-600">Common tasks for managing your farm</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <button type="button" onClick={() => router.push("/production-dashboard")} className="flex min-h-24 min-w-0 items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4 text-left shadow-xs transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><Sparkles className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-snug text-slate-900 sm:text-base">Record an activity</span><span className="mt-1 block break-words text-sm leading-snug text-slate-600">Milk, birth, weight, and more</span></span>
            </button>
            <button type="button" onClick={() => router.push("/livestock-inventory")} className="flex min-h-24 min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-emerald-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><MapPin className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-snug text-slate-900 sm:text-base">My livestock</span><span className="mt-1 block break-words text-sm leading-snug text-slate-600">Find an animal or update its details</span></span>
            </button>
            <button type="button" onClick={() => handleOpenReportIllness("DISEASE")} className="flex min-h-24 min-w-0 items-center gap-3 rounded-2xl border border-amber-200 bg-white p-4 text-left shadow-xs transition hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><Stethoscope className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-snug text-slate-900 sm:text-base">Report an animal health issue</span><span className="mt-1 block break-words text-sm leading-snug text-slate-600">Tell the livestock office what happened</span></span>
            </button>
          </div>
        </section>

        {/* Important record-review work stays visible; only the detailed chart matrix moves behind a request. */}
        {isLoading ? (
          <FarmerStats isLoading />
        ) : isError ? (
          <Card className="p-8 text-center border-red-200 bg-red-50 rounded-3xl">
            <h3 className="font-bold text-red-800 text-base">Unable to load farm analytics</h3>
            <p className="text-xs text-red-600 mt-1">Please check your connection and try again.</p>
            <Button size="sm" className="mt-4 bg-red-700 hover:bg-red-800 text-white rounded-xl gap-2 h-10 px-4 text-xs font-bold active:scale-95 transition-all shadow-xs cursor-pointer" onClick={() => refetch()}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          </Card>
        ) : (
          <FarmerStats data={analytics} />
        )}

        <FarmerActivityFeed
          activities={analytics?.recent_activities}
          isLoading={isLoading}
        />

        <FarmerProgramsVisits />

        <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <summary className="cursor-pointer list-none rounded-lg font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3"><span>Farm summary and charts</span><span className="text-sm font-medium text-emerald-800 group-open:hidden">View</span><span className="hidden text-sm font-medium text-emerald-800 group-open:inline">Hide</span></span>
            <span className="mt-1 block text-sm font-normal text-slate-600">Production trends, livestock breakdown, and record status.</span>
          </summary>
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <FarmerCharts data={analytics} isLoading={isLoading} />
          </div>
        </details>

        <details className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 [&::-webkit-details-marker]:hidden">
            <span>Farm services and links</span>
            <span className="font-semibold text-emerald-800 group-open:hidden">Show</span><span className="hidden font-semibold text-emerald-800 group-open:inline">Hide</span>
          </summary>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
            <Sparkles className="size-4 text-[#2D5A27]" />
            <span>Farm Services</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/farmer-scheduling")}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-[11px]"
            >
              <CalendarDays className="size-3.5 text-indigo-600" />
              <span>Programs & Visits</span>
            </button>

            <button
              onClick={() => router.push("/gis-user-map")}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-[11px]"
            >
              <Map className="size-3.5 text-teal-600" />
              <span>Farm Map</span>
            </button>

            <button
              onClick={() => router.push("/farmer-announcement")}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-[11px]"
            >
              <Megaphone className="size-3.5 text-amber-600" />
              <span>Activities</span>
            </button>
          </div>
          </div>
        </details>
      </div>

      {/* ── MODAL DIALOGS ── */}

      <ReportIllnessDialog
        open={isReportIllnessOpen}
        onOpenChange={setIsReportIllnessOpen}
        defaultType={reportIllnessDefaultType}
        onSuccess={() => refetch()}
      />

      <FarmerReportsListDialog
        open={isReportsListOpen}
        onOpenChange={setIsReportsListOpen}
        onSelectReport={(rep) => {
          setSelectedReportDetail(rep);
          setIsDetailOpen(true);
        }}
        onOpenNewReport={() => handleOpenReportIllness("DISEASE")}
      />

      <ReportDetailDialog
        report={selectedReportDetail}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </>
  );
}
