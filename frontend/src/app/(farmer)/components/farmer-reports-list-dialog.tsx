"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Search,
  Stethoscope,
  Skull,
  Clock,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Plus,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import { FarmerReport, BackendStatus } from "../report-observation/report-observation-types";

interface FarmerReportsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectReport: (report: FarmerReport) => void;
  onOpenNewReport: () => void;
}

export default function FarmerReportsListDialog({
  open,
  onOpenChange,
  onSelectReport,
  onOpenNewReport,
}: FarmerReportsListDialogProps) {
  const [search, setSearch] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("ALL");

  // Fetch disease cases & mortality
  const { data: diseaseCases = [], isLoading: isLoadingDiseases } = useQuery({
    queryKey: ["farmer-disease-cases"],
    queryFn: async () => {
      const res = await api.get("diseases/cases/");
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: open,
  });

  const { data: mortalityRecords = [], isLoading: isLoadingMortality } = useQuery({
    queryKey: ["farmer-mortality-records"],
    queryFn: async () => {
      const res = await api.get("diseases/mortality/");
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: open,
  });

  const reports: FarmerReport[] = useMemo(() => {
    const list: FarmerReport[] = [];

    diseaseCases.forEach((dc: any) => {
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
        createdAt: dc.created_at || new Date().toISOString(),
        reviewedBy: dc.reviewed_by,
        reviewedByName: dc.reviewed_by_name,
        reviewedAt: dc.reviewed_at,
        reviewRemarks: dc.review_remarks,
        rawItem: dc,
      });
    });

    mortalityRecords.forEach((m: any) => {
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

  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      const matchSearch =
        rep.cattleTag.toLowerCase().includes(search.toLowerCase()) ||
        rep.name.toLowerCase().includes(search.toLowerCase()) ||
        rep.cattleBreed.toLowerCase().includes(search.toLowerCase()) ||
        rep.id.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      if (filterType === "ALL") return true;
      if (filterType === "DISEASE") return rep.reportType === "DISEASE";
      if (filterType === "MORTALITY") return rep.reportType === "MORTALITY";
      if (filterType === "PENDING") return rep.status === "PENDING";
      if (filterType === "REVISION") return rep.status === "SUBJECT_TO_REVISION";
      if (filterType === "APPROVED") return rep.status === "APPROVED" || rep.status === "VERIFIED";

      return true;
    });
  }, [reports, search, filterType]);

  const isLoading = isLoadingDiseases || isLoadingMortality;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto p-0 rounded-3xl border-0 shadow-2xl">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-[#1E3D1A] via-[#2D5A27] to-emerald-800 text-white relative">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md">
                <Activity className="size-6 text-emerald-200" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-white tracking-tight">
                  My Health & Mortality Reports
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-100/90 font-medium mt-0.5">
                  Track validation status, inspector visits, and official municipal vet findings
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onOpenNewReport();
              }}
              className="rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 text-xs font-black h-9 px-3 gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>New Report</span>
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Filter Pills & Search */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "ALL", label: `All (${reports.length})` },
                { id: "DISEASE", label: "Sick Animals" },
                { id: "MORTALITY", label: "Deceased" },
                { id: "PENDING", label: "Pending Visit" },
                { id: "REVISION", label: "Subject to Revision" },
                { id: "APPROVED", label: "Approved" },
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

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by animal tag, symptom, or ref #..."
                className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium focus:ring-2 focus:ring-[#2D5A27]"
              />
            </div>
          </div>

          {/* List of Reports */}
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1.5 [scrollbar-width:thin]">
            {isLoading ? (
              <div className="space-y-2.5 py-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 animate-pulse space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                <Activity className="size-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-black text-slate-700">No reports found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Any illness or mortality reports filed will appear here.
                </p>
              </div>
            ) : (
              filteredReports.map((rep) => {
                const isMort = rep.reportType === "MORTALITY";
                return (
                  <div
                    key={rep.id}
                    onClick={() => {
                      onOpenChange(false);
                      onSelectReport(rep);
                    }}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-[#2D5A27] hover:shadow-sm transition-all cursor-pointer group flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                          isMort ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isMort ? <Skull className="size-4" /> : <Stethoscope className="size-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 group-hover:text-[#2D5A27] transition-colors">
                            #{rep.cattleTag}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {rep.id}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-slate-700 truncate mt-0.5">
                          {rep.name}
                        </p>

                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {rep.cattleBreed} • {rep.affectedCount} Head{rep.affectedCount > 1 ? "s" : ""} • {rep.recordDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        className={`text-[10px] font-bold px-2 py-0.5 border-0 ${
                          rep.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : rep.status === "VERIFIED"
                            ? "bg-sky-100 text-sky-800"
                            : rep.status === "SUBJECT_TO_REVISION"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {rep.status === "SUBJECT_TO_REVISION" ? "Needs Revision" : rep.status}
                      </Badge>
                      <ChevronRight className="size-4 text-slate-300 group-hover:text-[#2D5A27] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
