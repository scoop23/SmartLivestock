"use client";

import { useState } from "react";
import {
  ClipboardCheck,
  Plus,
  X,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  TableIcon,
  LayoutGrid,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InspectionRecord,
  InspectionStatusTab,
  INITIAL_INSPECTIONS,
} from "./auction-analytics";
import { NewInspectionDialog } from "./new-inspection-dialog";
import { InspectionDetailsDialog } from "./inspection-details-dialog";
import { InspectionsListView } from "./inspections-list-view";

export default function AuctionInspections() {
  const [inspections, setInspections] = useState<InspectionRecord[]>(INITIAL_INSPECTIONS);
  const [activeTab, setActiveTab] = useState<InspectionStatusTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // Modal states
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null);

  const handleCreateSuccess = (newRecord: InspectionRecord) => {
    setInspections((prev) => [newRecord, ...prev]);
  };

  // Filter pipeline
  const query = searchQuery.toLowerCase().trim();
  const filtered = inspections.filter((rec) => {
    const matchesTab = activeTab === "ALL" || rec.status === activeTab;
    const matchesSearch =
      !query ||
      rec.control_number.toLowerCase().includes(query) ||
      rec.shipper_name.toLowerCase().includes(query) ||
      rec.destination.toLowerCase().includes(query) ||
      rec.purpose.toLowerCase().includes(query);
    return matchesTab && matchesSearch;
  });

  const getStatusBadge = (status: InspectionRecord["status"]) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold text-[10px] uppercase tracking-wider">
            <Clock className="w-3 h-3 mr-1" /> Pending
          </Badge>
        );
      case "VERIFIED":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-bold text-[10px] uppercase tracking-wider">
            <Send className="w-3 h-3 mr-1" /> Verified
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-[10px] uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200 font-bold text-[10px] uppercase tracking-wider">
            <AlertCircle className="w-3 h-3 mr-1" /> Rejected
          </Badge>
        );
    }
  };

  return (
    <>
      <PageHeader
        title="Livestock Inspections & Clearances"
        subtitle="Market trade checkpoints, veterinary clearance permits, and transport inspections"
        variant="auction"
        maxWidthClass="max-w-7xl"
      />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header Actions & Mode Switcher */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#7C3AED]" />
              Inspection Registry
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Official livestock transport clearances issued by the Padre Garcia inspection unit.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode("card")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${viewMode === "card"
                    ? "bg-white text-purple-950 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                  }`}
              >
                <LayoutGrid className="size-3.5" />
                <span className="hidden xs:inline">Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${viewMode === "table"
                    ? "bg-white text-purple-950 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                  }`}
              >
                <TableIcon className="size-3.5" />
                <span className="hidden xs:inline">Table</span>
              </button>
            </div>

            <Button
              size="sm"
              onClick={() => setIsNewDialogOpen(true)}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-black rounded-xl shadow-md gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Inspection
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search by Control #, Shipper Name, Destination, Purpose…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 bg-slate-50/60 border-slate-200 rounded-xl h-10 text-sm"
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

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(["ALL", "PENDING", "VERIFIED", "APPROVED", "REJECTED"] as InspectionStatusTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${activeTab === tab
                      ? "bg-[#7C3AED] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                >
                  {tab === "ALL" ? "All Clearances" : tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table & Cards List View */}
        <InspectionsListView
          inspections={filtered}
          viewMode={viewMode}
          onSelectInspection={setSelectedInspection}
          getStatusBadge={getStatusBadge}
        />
      </div>

      {/* New Inspection Dialog */}
      <NewInspectionDialog
        isOpen={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
        onSubmitSuccess={handleCreateSuccess}
        nextId={inspections.length + 1}
      />

      {/* Inspection Details Dialog */}
      <InspectionDetailsDialog
        inspection={selectedInspection}
        onClose={() => setSelectedInspection(null)}
        statusBadge={selectedInspection ? getStatusBadge(selectedInspection.status) : null}
      />
    </>
  );
}
