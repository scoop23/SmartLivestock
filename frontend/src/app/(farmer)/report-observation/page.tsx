"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { KpiCard, type KpiVariant } from "@/components/ui/kpi-card";
import { useUserInventory } from "../livestock-inventory/livestock-inventory";
import { toast } from "sonner";
import {
  Stethoscope,
  Send,
  Camera,
  Search,
  CheckCircle2,
  Clock,
  Plus,
  X,
  FileText,
  Activity,
  HeartPulse,
  Skull,
  ShieldCheck,
  Calendar,
  RotateCcw,
  ChevronRight,
  Filter,
  RefreshCw,
} from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";

import api from "@/lib/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FarmerReport,
  ReportType,
  BackendStatus,
} from "./report-observation-types";
import ReportIllnessDialog from "./components/report-illness-dialog";
import ReportDetailDialog from "./components/report-detail-dialog";
import { getAttachedPhoto } from "@/lib/photo-storage";

export default function ReportObservationPage() {
  const queryClient = useQueryClient();

  // ── Dialog States ──
  const [isReportIllnessOpen, setIsReportIllnessOpen] = useState<boolean>(false);
  const [reportIllnessDefaultType, setReportIllnessDefaultType] = useState<ReportType>("DISEASE");
  const [selectedReport, setSelectedReport] = useState<FarmerReport | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  const handleOpenReportIllness = (type: ReportType = "DISEASE") => {
    setReportIllnessDefaultType(type);
    setIsReportIllnessOpen(true);
  };

  // ── Live Queries for Farmer's Previous Reports ──
  const {
    data: diseaseCases = [],
    isLoading: isLoadingDiseases,
    refetch: refetchDiseases,
    isFetching: isFetchingDiseases,
  } = useQuery({
    queryKey: ["farmer-disease-cases"],
    queryFn: async () => {
      const res = await api.get("diseases/cases/");
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const {
    data: mortalityRecords = [],
    isLoading: isLoadingMortality,
    refetch: refetchMortality,
    isFetching: isFetchingMortality,
  } = useQuery({
    queryKey: ["farmer-mortality-records"],
    queryFn: async () => {
      const res = await api.get("diseases/mortality/");
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const isRefreshing = isFetchingDiseases || isFetchingMortality;

  const handleRefresh = () => {
    refetchDiseases();
    refetchMortality();
    toast.success("Health surveillance records updated.");
  };

  // ── Consolidated Reports from Database ──
  const reports: FarmerReport[] = useMemo(() => {
    const list: FarmerReport[] = [];

    diseaseCases.forEach((dc: any) => {
      const attached = getAttachedPhoto(`DIS-${dc.id}`, dc.tag_number);
      const photoUrl = dc.photo_url || dc.photo || (attached.isFarmerUpload ? attached.photoUrl : undefined);
      const photoName = (dc.photo_url || dc.photo) ? "Attached Field Photo" : (attached.isFarmerUpload ? attached.photoName : undefined);
      list.push({
        id: `DIS-${dc.id}`,
        reportType: "DISEASE",
        inventoryId: String(dc.livestock),
        cattleTag: dc.tag_number || `Animal #${dc.livestock}`,
        cattleBreed: dc.breed || "Standard",
        cattleType: dc.livestock_type_name || "Livestock",
        name: dc.name || "Disease Case",
        affectedCount: dc.affected_count || 1,
        recordDate: dc.record_date || (dc.created_at ? dc.created_at.slice(0, 10) : ""),
        status: (dc.status || "PENDING").toUpperCase() as BackendStatus,
        symptoms: [dc.name],
        description: dc.name,
        photoUrl,
        photoName,
        createdAt: dc.created_at || new Date().toISOString(),
        reviewedBy: dc.reviewed_by,
        reviewedByName: dc.reviewed_by_name,
        reviewedAt: dc.reviewed_at,
        reviewRemarks: dc.review_remarks,
        rawItem: dc,
      });
    });

    mortalityRecords.forEach((m: any) => {
      const attached = getAttachedPhoto(`MOR-${m.id}`, m.tag_number);
      const photoUrl = m.photo_url || m.photo || (attached.isFarmerUpload ? attached.photoUrl : undefined);
      const photoName = (m.photo_url || m.photo) ? "Mortality Photo Evidence" : (attached.isFarmerUpload ? attached.photoName : undefined);
      list.push({
        id: `MOR-${m.id}`,
        reportType: "MORTALITY",
        inventoryId: String(m.livestock),
        cattleTag: m.tag_number || `Animal #${m.livestock}`,
        cattleBreed: m.breed || "Standard",
        cattleType: m.livestock_type_name || "Livestock",
        name: m.cause || "Mortality Record",
        affectedCount: m.death_count || 1,
        recordDate: m.record_date || (m.created_at ? m.created_at.slice(0, 10) : ""),
        status: (m.status || "PENDING").toUpperCase() as BackendStatus,
        symptoms: [m.cause],
        description: m.cause,
        photoUrl,
        photoName,
        createdAt: m.created_at || new Date().toISOString(),
        reviewedBy: m.reviewed_by,
        reviewedByName: m.reviewed_by_name,
        reviewedAt: m.reviewed_at,
        reviewRemarks: m.review_remarks,
        rawItem: m,
      });
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [diseaseCases, mortalityRecords]);

  // ── Filter State ──
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("ALL");

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      const matchesSearch =
        rep.cattleTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.cattleBreed.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === "ALL") return true;
      if (filterType === "DISEASE") return rep.reportType === "DISEASE";
      if (filterType === "MORTALITY") return rep.reportType === "MORTALITY";
      if (filterType === "PENDING") return rep.status === "PENDING";
      if (filterType === "REVISION") return rep.status === "SUBJECT_TO_REVISION";
      if (filterType === "APPROVED") return rep.status === "APPROVED" || rep.status === "VERIFIED";

      return true;
    });
  }, [reports, searchQuery, filterType]);

  // KPI Metrics
  const totalDiseaseCases = reports.filter((r) => r.reportType === "DISEASE").length;
  const totalMortality = reports.filter((r) => r.reportType === "MORTALITY").length;
  const pendingVerification = reports.filter((r) => r.status === "PENDING").length;
  const approvedCases = reports.filter(
    (r) => r.status === "APPROVED" || r.status === "VERIFIED"
  ).length;

  const kpis: {
    label: string;
    value: string | number;
    sub: string;
    icon: React.ReactNode;
    variant: KpiVariant;
  }[] = [
    {
      label: "Sick Animals Reported",
      value: totalDiseaseCases,
      sub: "Active health incidents",
      icon: <Stethoscope className="size-4.5" />,
      variant: "amber",
    },
    {
      label: "Deceased Animals",
      value: totalMortality,
      sub: "Mortality records",
      icon: <Skull className="size-4.5" />,
      variant: "rose",
    },
    {
      label: "Waiting for SIBAT",
      value: pendingVerification,
      sub: "Pending field inspection",
      icon: <Clock className="size-4.5" />,
      variant: "sky",
    },
    {
      label: "Verified & Approved",
      value: approvedCases,
      sub: "Certified by MAO Vet",
      icon: <ShieldCheck className="size-4.5" />,
      variant: "emerald",
    },
  ];

  return (
    <>
      <PageHeader
        title="Livestock Health & Mortality Surveillance"
        subtitle="Padre Garcia Municipal Agriculture Office • Rapid Disease Reporting & SIBAT Inspection System"
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
              title="Refresh Surveillance Feed"
            >
              <RefreshCw className={`size-5 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        {/* ── TOP KPI STATS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              title={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              badge={kpi.sub}
              variant={kpi.variant}
            />
          ))}
        </div>

        {/* ── ACTION BANNER ── */}
        <div className="rounded-3xl bg-gradient-to-br from-[#1E3D1A] via-[#2D5A27] to-emerald-800 p-5 sm:p-6 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-emerald-700/30">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Activity className="size-5 text-emerald-200" />
              Municipal Biosecurity Surveillance Hub
            </h3>
            <p className="text-xs text-emerald-100/85 font-medium max-w-xl leading-relaxed">
              Timely reporting helps the Padre Garcia Municipal Agriculture Office prevent disease outbreaks. SIBAT validators are deployed within 24 hours of report lodgement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0">
            <Button
              onClick={() => handleOpenReportIllness("MORTALITY")}
              className="flex-1 sm:flex-none rounded-xl bg-rose-600/25 hover:bg-rose-600/40 text-rose-100 text-xs font-bold h-10 px-4 gap-1.5 border border-rose-400/30 cursor-pointer"
            >
              <Skull className="size-4 text-rose-300" />
              <span>Report Mortality</span>
            </Button>

            <Button
              onClick={() => handleOpenReportIllness("DISEASE")}
              className="flex-1 sm:flex-none rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-black h-10 px-4 gap-1.5 shadow-sm cursor-pointer"
            >
              <Stethoscope className="size-4" />
              <span>Report Sickness</span>
            </Button>
          </div>
        </div>

        {/* ── INTERACTIVE REPORTS SURVEILLANCE LEDGER ── */}
        <Card className="border-2 border-emerald-900/10 bg-white shadow-xs rounded-3xl overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-4">
            {/* Header with Title & Live Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Activity className="size-5 text-emerald-700" />
                  Your Lodged Health & Mortality Reports
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Click on any report to inspect the SIBAT field validation dossier, inspector findings, and official MAO review remarks
                </p>
              </div>

              <span className="text-xs font-bold text-slate-400 self-start sm:self-center">
                Showing {filteredReports.length} of {reports.length} reports
              </span>
            </div>

            {/* Filter Pills & Live Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "ALL", label: `All (${reports.length})` },
                  { id: "DISEASE", label: `Sick Animals (${totalDiseaseCases})` },
                  { id: "MORTALITY", label: `Deceased (${totalMortality})` },
                  { id: "PENDING", label: `Pending Visit (${pendingVerification})` },
                  { id: "REVISION", label: "Subject to Revision" },
                  { id: "APPROVED", label: `Approved (${approvedCases})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      filterType === tab.id
                        ? "bg-[#2D5A27] text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tag #, symptoms, diagnosis..."
                  className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium focus:ring-2 focus:ring-[#2D5A27]"
                />
              </div>
            </div>

            {/* Grid of Report Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {isLoadingDiseases || isLoadingMortality ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 animate-pulse space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-8 bg-slate-100 rounded w-full" />
                  </div>
                ))
              ) : filteredReports.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                  <HeartPulse className="size-10 mx-auto mb-2.5 text-slate-300" />
                  <p className="text-sm font-black text-slate-700">No reports found</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchQuery || filterType !== "ALL"
                      ? "No records match your active search or filter criteria."
                      : "You haven't submitted any disease or mortality reports yet."}
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setIsReportIllnessOpen(true)}
                      className="bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-bold rounded-xl h-8 px-3.5"
                    >
                      + File Incident Report
                    </Button>
                  </div>
                </div>
              ) : (
                filteredReports.map((rep) => {
                  const isMortality = rep.reportType === "MORTALITY";

                  // Status Badge Styles
                  const statusInfo = {
                    APPROVED: {
                      badgeClass: "bg-emerald-100 text-emerald-800 border-0",
                      icon: <CheckCircle2 className="size-3 text-emerald-600" />,
                      label: "MAO Approved",
                    },
                    VERIFIED: {
                      badgeClass: "bg-sky-100 text-sky-800 border-0",
                      icon: <ShieldCheck className="size-3 text-sky-600" />,
                      label: "SIBAT Verified",
                    },
                    SUBJECT_TO_REVISION: {
                      badgeClass: "bg-amber-100 text-amber-900 border-0",
                      icon: <RotateCcw className="size-3 text-amber-700" />,
                      label: "Needs Revision",
                    },
                    REJECTED: {
                      badgeClass: "bg-amber-100 text-amber-900 border-0",
                      icon: <RotateCcw className="size-3 text-amber-700" />,
                      label: "Needs Revision",
                    },
                    PENDING: {
                      badgeClass: "bg-amber-50 text-amber-800 border border-amber-200",
                      icon: <Clock className="size-3 text-amber-600" />,
                      label: "Pending SIBAT Visit",
                    },
                  }[rep.status] || {
                    badgeClass: "bg-slate-100 text-slate-700 border-0",
                    icon: <Clock className="size-3 text-slate-500" />,
                    label: "Pending",
                  };

                  return (
                    <div
                      key={rep.id}
                      onClick={() => {
                        setSelectedReport(rep);
                        setIsDetailOpen(true);
                      }}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#2D5A27] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-3"
                    >
                      {/* Top Row: Animal Info & Date */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`p-2 rounded-xl shrink-0 ${
                                isMortality
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {isMortality ? (
                                <Skull className="size-4" />
                              ) : (
                                <Icon iconNode={cowHead} className="size-4" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900 group-hover:text-[#2D5A27] transition-colors">
                                #{rep.cattleTag}
                              </p>
                              <p className="text-[10px] text-slate-500 font-semibold">
                                {rep.cattleBreed} • {rep.cattleType}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] font-mono text-slate-400 font-medium">
                            {rep.recordDate}
                          </span>
                        </div>

                        {/* Symptoms / Diagnosis */}
                        <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100/80">
                          <p className="text-xs font-black text-slate-900 line-clamp-1">
                            {rep.name}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Affected: <strong className="text-slate-800">{rep.affectedCount}</strong> Head{rep.affectedCount > 1 ? "s" : ""}
                          </p>
                        </div>

                        {/* Revision Callout if Subject to Revision */}
                        {rep.status === "SUBJECT_TO_REVISION" && rep.reviewRemarks && (
                          <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-900 font-medium line-clamp-2">
                            <strong>Validator Note:</strong> {rep.reviewRemarks}
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Status Badge & Dossier Button */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <Badge className={`text-[10px] font-extrabold px-2 py-0.5 gap-1 ${statusInfo.badgeClass}`}>
                          {statusInfo.icon}
                          <span>{statusInfo.label}</span>
                        </Badge>

                        <span className="text-xs font-black text-[#2D5A27] group-hover:underline flex items-center gap-0.5">
                          <span>Dossier</span>
                          <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── MODALS ── */}
      <ReportIllnessDialog
        open={isReportIllnessOpen}
        onOpenChange={setIsReportIllnessOpen}
        defaultType={reportIllnessDefaultType}
        onSuccess={handleRefresh}
      />

      <ReportDetailDialog
        report={selectedReport}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </>
  );
}
