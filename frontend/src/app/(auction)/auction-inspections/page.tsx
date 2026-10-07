"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Plus,
  X,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Send,
  TableIcon,
  LayoutGrid,
  QrCode,
  Loader2,
  Map,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InspectionRecord,
  InspectionStatusTab,
  fetchInspections,
} from "./auction-analytics";
import { InspectionDetailsDialog } from "./inspection-details-dialog";
import { InspectionsListView } from "./inspections-list-view";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";

export default function AuctionInspections() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<InspectionStatusTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // Modal states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null);

  const { data: inspections = [], isLoading, isError } = useQuery<InspectionRecord[]>({
    queryKey: ["inspections"],
    queryFn: () => fetchInspections(),
    staleTime: 30_000,
  });

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["inspections"] });
  };

  // Status counts
  const pendingCount = inspections.filter((i) => i.status === "PENDING").length;
  const verifiedCount = inspections.filter((i) => i.status === "VERIFIED").length;
  const approvedCount = inspections.filter((i) => i.status === "APPROVED").length;
  const revisionCount = inspections.filter(
    (i) => i.status === "SUBJECT_TO_REVISION" || i.status === "REJECTED"
  ).length;

  const tabCounts: Record<InspectionStatusTab, number> = {
    ALL: inspections.length,
    PENDING: pendingCount,
    VERIFIED: verifiedCount,
    APPROVED: approvedCount,
    SUBJECT_TO_REVISION: revisionCount,
  };

  // Filter pipeline
  const query = searchQuery.toLowerCase().trim();
  const filtered = inspections.filter((rec) => {
    const matchesTab =
      activeTab === "ALL" ||
      rec.status === activeTab ||
      (activeTab === "SUBJECT_TO_REVISION" && rec.status === "REJECTED");
    const matchesDate = !dateFilter || rec.inspection_date === dateFilter;
    const matchesSearch =
      !query ||
      rec.control_number.toLowerCase().includes(query) ||
      rec.shipper_name.toLowerCase().includes(query) ||
      rec.destination.toLowerCase().includes(query) ||
      rec.purpose.toLowerCase().includes(query);
    return matchesTab && matchesDate && matchesSearch;
  });

  const getStatusBadge = (status: InspectionRecord["status"], record?: InspectionRecord) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px] uppercase tracking-wider">
            <Clock className="w-3 h-3 mr-1" /> {record?.created_by_role === "FARMER" ? "Awaiting Auction Submission" : "Pending MAO Review"}
          </Badge>
        );
      case "VERIFIED":
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300 font-bold text-[10px] uppercase tracking-wider">
            <Send className="w-3 h-3 mr-1" /> Submitted to MAO
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold text-[10px] uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
          </Badge>
        );
      case "SUBJECT_TO_REVISION":
      case "REJECTED":
        return (
          <Badge className="bg-amber-100 text-amber-950 border-amber-400 font-bold text-[10px] uppercase tracking-wider">
            <RotateCcw className="w-3 h-3 mr-1" /> Subject to Revision
          </Badge>
        );
    }
  };

  return (
    <>
      <PageHeader
        title="Auction Livestock Intake & Movement Logs"
        subtitle="Record livestock movement at the auction house and track MAO decisions"
        variant="auction"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        {/* Header Actions & Mode Switcher */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#7C3AED]" />
              Auction Movement Registry
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Auction records submitted for MAO review. Clearances are issued only after approval.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode("card")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  viewMode === "card"
                    ? "bg-white text-purple-950 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="size-3.5" />
                <span>Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-purple-950 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <TableIcon className="size-3.5" />
                <span>Table</span>
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/auction-gis")}
              className="border-sky-300 text-sky-800 hover:bg-sky-50 text-xs font-black rounded-xl shadow-xs gap-1.5 cursor-pointer"
            >
              <Map className="size-3.5" />
              GIS Map
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsScannerOpen(true)}
              className="border-purple-300 text-[#7C3AED] hover:bg-purple-50 text-xs font-black rounded-xl shadow-xs gap-1.5 cursor-pointer"
            >
              <QrCode className="size-3.5" />
              Scan Gate Pass
            </Button>

            <Button
              size="sm"
              onClick={() => router.push("/auction-inspections/new")}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-black rounded-xl shadow-md gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Movement Log
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search by Control #, Shipper, Destination, Purpose…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 bg-slate-50/60 border-slate-200 rounded-xl h-10 text-sm w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Filter */}
            <div className="relative w-full sm:w-48 shrink-0">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-slate-50/60 border-slate-200 rounded-xl h-10 text-xs font-mono pr-8"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Chips with Real Counts */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {(
                [
                  { id: "ALL", label: "All Records" },
                  { id: "PENDING", label: "Pending Action" },
                  { id: "VERIFIED", label: "Submitted to MAO" },
                  { id: "APPROVED", label: "Approved" },
                  { id: "SUBJECT_TO_REVISION", label: "For Revision" },
                ] as { id: InspectionStatusTab; label: string }[]
              ).map((tab) => {
                const count = tabCounts[tab.id];
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-[#7C3AED] text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table & Cards List View */}
        {isLoading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Loading inspection registry...</p>
          </div>
        ) : isError ? (
          <div className="p-6 text-center bg-rose-50 rounded-2xl border border-rose-200 text-rose-800">
            <p className="text-sm font-bold">Failed to load inspections. Please try refreshing.</p>
          </div>
        ) : (
          <InspectionsListView
            inspections={filtered}
            viewMode={viewMode}
            onSelectInspection={setSelectedInspection}
            getStatusBadge={getStatusBadge}
          />
        )}
      </div>

      {/* Inspection Details Dialog */}
      <InspectionDetailsDialog
        inspection={selectedInspection}
        onClose={() => setSelectedInspection(null)}
        statusBadge={selectedInspection ? getStatusBadge(selectedInspection.status, selectedInspection) : null}
        onActionSuccess={handleSuccess}
        onEdit={() => {
          if (selectedInspection) router.push(`/auction-inspections/new?edit=${selectedInspection.id}`);
          setSelectedInspection(null);
        }}
      />

      {/* Auction QR Gate Scanner Dialog */}
      <UniversalQrScannerDialog
        isOpen={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        role="auction"
      />
    </>
  );
}
