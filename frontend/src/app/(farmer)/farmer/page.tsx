"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/app/components/page-header";
import {
  Bell,
  RefreshCw,
  Skull,
  Stethoscope,
  ClipboardList,
  Sparkles,
  Command as CommandIcon,
  Search,
  Map,
  CalendarDays,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import FarmerStats from "./farmer-stats";
import FarmerCharts from "./farmer-charts";
import FarmerActivityFeed from "./farmer-activity-feed";
import FarmerActionDock from "./components/farmer-action-dock";
import { useFarmerDashboardAnalytics, type FarmerActivityItem } from "./farmer-analytics";
import ReportIllnessDialog from "../report-observation/components/report-illness-dialog";
import ReportDetailDialog from "../report-observation/components/report-detail-dialog";
import FarmerReportsListDialog from "../components/farmer-reports-list-dialog";
import { FarmerReport, BackendStatus, ReportType } from "../report-observation/report-observation-types";

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
      ? "Good morning"
      : currentHour < 18
      ? "Good afternoon"
      : "Good evening";

  // Handle opening illness dialog with specific default type
  const handleOpenReportIllness = (defaultType: "DISEASE" | "MORTALITY" = "DISEASE") => {
    setReportIllnessDefaultType(defaultType);
    setIsReportIllnessOpen(true);
  };

  // Handle clicking on an activity in the feed to open its full dossier
  const handleSelectActivity = (act: FarmerActivityItem) => {
    if (act.type !== "DISEASE" && act.type !== "MORTALITY") return;

    const raw = act.rawItem || {};
    const reportType: ReportType = act.type === "MORTALITY" ? "MORTALITY" : "DISEASE";
    const reportId = String(act.id).replace(/^(dc-|mort-)/, "");

    const report: FarmerReport = {
      id: reportType === "MORTALITY" ? `MOR-${reportId}` : `DIS-${reportId}`,
      reportType,
      inventoryId: String(raw.livestock || ""),
      cattleTag: raw.tag_number || "Animal Record",
      cattleBreed: raw.breed || "Standard",
      cattleType: raw.livestock_type_name || "Livestock",
      name: raw.name || raw.cause || act.title,
      affectedCount: raw.affected_count || raw.death_count || 1,
      recordDate: raw.record_date || act.date.slice(0, 10),
      status: (act.status || "PENDING") as BackendStatus,
      symptoms: [raw.name || raw.cause || act.title],
      description: raw.name || raw.cause || act.description,
      createdAt: raw.created_at || act.date,
      reviewedByName: raw.reviewed_by_name,
      reviewedAt: raw.reviewed_at,
      reviewRemarks: raw.review_remarks || act.remarks,
      rawItem: raw,
    };

    setSelectedReportDetail(report);
    setIsDetailOpen(true);
  };

  return (
    <>
      <PageHeader
        title={`${greeting}, ${farmerName}!`}
        subtitle="Padre Garcia, Batangas — Municipal Livestock Operations & Biosecurity Portal"
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              title="Refresh Dashboard Data"
            >
              <RefreshCw className={`size-4.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/alerts")}
              className="rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              title="View Alerts & Advisories"
            >
              <Bell className="size-4.5" />
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-8 w-full space-y-6 pb-28">
        {/* 1. KEY EXECUTIVE METRICS */}
        {isLoading ? (
          <FarmerStats isLoading />
        ) : isError ? (
          <Card className="p-8 text-center border-red-200 bg-red-50 rounded-3xl">
            <h3 className="font-bold text-red-800 text-base">
              Unable to load farm analytics
            </h3>
            <p className="text-xs text-red-600 mt-1">
              Please check your connection and try again.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-red-700 hover:bg-red-800 text-white rounded-xl gap-1.5"
              onClick={() => refetch()}
            >
              <RefreshCw className="size-3.5" /> Retry
            </Button>
          </Card>
        ) : (
          <FarmerStats data={analytics} />
        )}

        {/* 2. VISUALIZATION & CHARTS MATRIX (4-CHART GRID) */}
        <FarmerCharts data={analytics} isLoading={isLoading} />

        {/* 3. MUNICIPAL RESOURCES STRIP (COMPACT COMPLEMENT TO FLOATING DOCK) */}
        <div className="rounded-2xl bg-slate-50/80 border border-slate-200/80 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
            <Sparkles className="size-4 text-[#2D5A27]" />
            <span>Padre Garcia Municipal Field Services</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/farmer-scheduling")}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-[11px]"
            >
              <CalendarDays className="size-3.5 text-indigo-600" />
              <span>MAO Programs</span>
            </button>

            <button
              onClick={() => router.push("/gis-user-map")}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-[11px]"
            >
              <Map className="size-3.5 text-teal-600" />
              <span>Pasture GIS Map</span>
            </button>

            <button
              onClick={() => router.push("/farmer-announcement")}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-[11px]"
            >
              <Megaphone className="size-3.5 text-amber-600" />
              <span>Announcements</span>
            </button>
          </div>
        </div>

        {/* 4. LIVE FARM ACTIVITY & REVIEW STATUS FEED */}
        <FarmerActivityFeed
          activities={analytics?.recent_activities}
          isLoading={isLoading}
          onSelectActivity={handleSelectActivity}
          onOpenReportIllness={() => handleOpenReportIllness("DISEASE")}
          onOpenReportsList={() => setIsReportsListOpen(true)}
        />
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
