"use client";

import { useState } from "react";
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Layers,
  ClipboardCheck,
  Eye,
  Search,
  RotateCcw,
  X,
  SlidersHorizontal,
  Plus,
  FileSpreadsheet,
  Calendar,
  Users,
  MapPin,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import CensusSubmissionDialog, {
  CensusSubmissionRecord,
} from "./census-submission-dialog";
import CensusDetailsDialog from "./census-details-dialog";

/* ── Mock Data: Farmer Daily Activity Records ── */
const pendingRecords = [
  { id: 1, farmer: "Juan Dela Cruz", type: "Mortality Report", breed: "Brahman Bull", count: 1, date: "2026-04-25", status: "pending" },
  { id: 2, farmer: "Maria Santos", type: "Production Update", breed: "Holstein-Friesian", count: 3, date: "2026-04-25", status: "pending" },
  { id: 3, farmer: "Pedro Reyes", type: "Disease Report", breed: "Native Cattle", count: 2, date: "2026-04-24", status: "pending" },
  { id: 4, farmer: "Rosa Garcia", type: "Slaughter Record", breed: "Crossbreed", count: 1, date: "2026-04-24", status: "pending" },
];

const validatedRecords = [
  { id: 5, farmer: "Antonio Cruz", type: "Inventory Update", breed: "Brahman", count: 5, date: "2026-04-23", status: "validated" },
  { id: 6, farmer: "Luz Mendoza", type: "Production Update", breed: "Holstein-Friesian", count: 2, date: "2026-04-22", status: "validated" },
];

/* ── Mock Data: Quarterly Census Submissions ── */
const initialCensusSubmissions: CensusSubmissionRecord[] = [
  {
    id: "CEN-2026-Q2-0081",
    barangay: "Brgy. Lipay",
    reportYear: 2026,
    reportQuarter: 2,
    status: "PENDING",
    submissionDate: "2026-04-25",
    submittedBy: "SIBAT Field Officer (Lipay)",
    totalHeads: 78,
    totalFarmers: 16,
    reviewRemarks: "Comprehensive Q2 inventory sweep across Purok 1 to Purok 5.",
    items: [
      { id: "c-1", farmerName: "Danilo Marasigan", purok: "Purok 1", livestockType: "Cattle (Baka)", numberOfHeads: 12, remarks: "Breeder cows" },
      { id: "c-2", farmerName: "Elena Vilia", purok: "Purok 2", livestockType: "Carabao (Kalabaw)", numberOfHeads: 6, remarks: "Working draft" },
      { id: "c-3", farmerName: "Ramon Castillo", purok: "Purok 3", livestockType: "Swine (Baboy)", numberOfHeads: 42, remarks: "Commercial pen" },
      { id: "c-4", farmerName: "Luzviminda Cruz", purok: "Purok 4", livestockType: "Goat (Kambing)", numberOfHeads: 18, remarks: "Meat type" },
    ],
  },
  {
    id: "CEN-2026-Q1-0043",
    barangay: "Brgy. Lipay",
    reportYear: 2026,
    reportQuarter: 1,
    status: "APPROVED",
    submissionDate: "2026-01-18",
    submittedBy: "SIBAT Field Officer (Lipay)",
    totalHeads: 64,
    totalFarmers: 14,
    reviewRemarks: "Validated and verified by MAO Batangas. Accurate head counts.",
    items: [
      { id: "c-5", farmerName: "Mariano Garcia", purok: "Purok 2", livestockType: "Cattle (Baka)", numberOfHeads: 10, remarks: "Native breed" },
      { id: "c-6", farmerName: "Teresa Hernandez", purok: "Purok 1", livestockType: "Carabao (Kalabaw)", numberOfHeads: 4, remarks: "Dairy cross" },
      { id: "c-7", farmerName: "Joaquin Bautista", purok: "Purok 5", livestockType: "Swine (Baboy)", numberOfHeads: 50, remarks: "Backyard piggery" },
    ],
  },
];

/* ── Tab Keys ── */
type SectionTab = "records" | "census";
type TabKey = "pending" | "validated" | "all";

const TAB_CHIPS: { value: TabKey; label: string; activeClass: string; dotClass: string }[] = [
  { value: "all", label: "All Records", activeClass: "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20", dotClass: "bg-slate-400" },
  { value: "pending", label: "Pending", activeClass: "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25", dotClass: "bg-amber-500" },
  { value: "validated", label: "Validated", activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25", dotClass: "bg-emerald-500" },
];

/* ── Type badge colors ── */
const getTypeBadge = (type: string) => {
  const map: Record<string, { bg: string; text: string }> = {
    "Mortality Report": { bg: "bg-rose-100 border-rose-200", text: "text-rose-800" },
    "Production Update": { bg: "bg-blue-100 border-blue-200", text: "text-blue-800" },
    "Disease Report": { bg: "bg-red-100 border-red-200", text: "text-red-800" },
    "Slaughter Record": { bg: "bg-orange-100 border-orange-200", text: "text-orange-800" },
    "Inventory Update": { bg: "bg-emerald-100 border-emerald-200", text: "text-emerald-800" },
  };
  const style = map[type] ?? { bg: "bg-slate-100 border-slate-200", text: "text-slate-800" };
  return (
    <Badge className={`${style.bg} ${style.text} hover:${style.bg} border font-bold text-[10px] uppercase tracking-wider`}>
      {type}
    </Badge>
  );
};

export default function SibatPortal() {
  const [sectionTab, setSectionTab] = useState<SectionTab>("records");
  const [selectedRecords, setSelectedRecords] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Census dialog states
  const [isCensusDialogOpen, setIsCensusDialogOpen] = useState(false);
  const [censusSubmissions, setCensusSubmissions] = useState<CensusSubmissionRecord[]>(initialCensusSubmissions);
  const [selectedCensusForDetail, setSelectedCensusForDetail] = useState<CensusSubmissionRecord | null>(null);

  const allRecords = [...pendingRecords, ...validatedRecords];

  const toggleRecord = (id: number) => {
    setSelectedRecords((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  /* Filter pipeline for Farmer submissions */
  const query = searchQuery.toLowerCase().trim();
  const filteredRecords = allRecords.filter((record) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "pending" && record.status === "pending") ||
      (activeTab === "validated" && record.status === "validated");
    const matchesSearch =
      !query ||
      record.farmer.toLowerCase().includes(query) ||
      record.type.toLowerCase().includes(query) ||
      record.breed.toLowerCase().includes(query);
    return matchesTab && matchesSearch;
  });

  /* Filter pipeline for Census submissions */
  const filteredCensus = censusSubmissions.filter((cen) => {
    if (!query) return true;
    return (
      cen.barangay.toLowerCase().includes(query) ||
      `q${cen.reportQuarter}`.includes(query) ||
      cen.reportYear.toString().includes(query) ||
      cen.id.toString().toLowerCase().includes(query)
    );
  });

  const tabCounts: Record<string, number> = {
    all: allRecords.length,
    pending: pendingRecords.length,
    validated: validatedRecords.length,
  };

  // Census totals
  const totalCensusHeads = censusSubmissions.reduce((sum, c) => sum + c.totalHeads, 0);

  const stats = [
    {
      label: "Pending Validation",
      value: pendingRecords.length,
      icon: Clock,
      iconBg: "bg-amber-100/80",
      iconClass: "text-amber-700",
      accentBar: "bg-amber-500",
    },
    {
      label: "Validated Today",
      value: validatedRecords.length,
      icon: CheckCircle2,
      iconBg: "bg-emerald-100/80",
      iconClass: "text-emerald-700",
      accentBar: "bg-emerald-500",
    },
    {
      label: "Quarterly Census Total",
      value: `${totalCensusHeads} Heads`,
      icon: FileSpreadsheet,
      iconBg: "bg-purple-100/80",
      iconClass: "text-purple-700",
      accentBar: "bg-purple-500",
    },
    {
      label: "Sent to MAO",
      value: 12 + censusSubmissions.length,
      icon: Send,
      iconBg: "bg-blue-100/80",
      iconClass: "text-blue-700",
      accentBar: "bg-blue-500",
    },
  ];

  const handleCensusSubmissionSuccess = (newRecord: CensusSubmissionRecord) => {
    setCensusSubmissions((prev) => [newRecord, ...prev]);
    setSectionTab("census");
  };

  return (
    <>
      <PageHeader
        title="SIBAT Dashboard"
        subtitle="Cooperative & Barangay Livestock Portal — Padre Garcia, Batangas"
        variant="sibat"
        maxWidthClass="max-w-6xl"
      />

      {/* Barangay lockdown indicator */}
      <div className="bg-amber-400/90 border-l-4 border-[#1A365D]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-[#1A365D]/10 shrink-0">
              <Shield className="w-4 h-4 text-[#1A365D]" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-[#1A365D]">
                Barangay Sector Active — Assigned: Brgy. Lipay
              </p>
              <p className="text-[10px] font-semibold text-[#1A365D]/70">
                Quarterly census surveys and field validations are filtered for your cooperative sector.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setIsCensusDialogOpen(true)}
            className="bg-[#1A365D] hover:bg-[#152944] text-white text-xs font-black rounded-xl shadow-md gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" />
            New Census Submission
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        {/* ═══ Stat Cards ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              className="relative overflow-hidden border border-slate-200 bg-white shadow-sm rounded-2xl"
            >
              <div className={`absolute left-0 top-0 h-full w-1 ${stat.accentBar}`} />
              <CardContent className="p-4 pl-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl ${stat.iconBg}`}>
                    <stat.icon className={`w-4 h-4 ${stat.iconClass}`} />
                  </div>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ═══ Main Section Switcher Tabs ═══ */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl max-w-fit border border-slate-200">
          <button
            type="button"
            onClick={() => setSectionTab("records")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${sectionTab === "records"
                ? "bg-[#1A365D] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Layers className="w-4 h-4" />
            Farmer Activity Submissions ({allRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setSectionTab("census")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${sectionTab === "census"
                ? "bg-[#1A365D] text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-300" />
            Quarterly Census Submissions ({censusSubmissions.length})
          </button>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: FARMER ACTIVITY SUBMISSIONS */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {sectionTab === "records" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#1A365D]" />
                  Farmer Daily Reports & Activity
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Review mortality, production, and disease logs submitted by farmers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedRecords.length === 0}
                  className="gap-1.5 border-slate-300 text-xs font-bold"
                  onClick={() => setSelectedRecords(pendingRecords.map((r) => r.id))}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Select All Pending
                </Button>
                <Button
                  size="sm"
                  disabled={selectedRecords.length === 0}
                  className="gap-1.5 bg-[#1A365D] hover:bg-[#152944] text-white text-xs font-bold"
                >
                  <Send className="w-3.5 h-3.5" />
                  Push to MAO ({selectedRecords.length})
                </Button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Row 1: Search */}
              <div className="p-3 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    placeholder="Search farmer, type, breed…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9 bg-slate-50/60 border-slate-200 rounded-xl h-10 text-sm focus-visible:ring-blue-500/30"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {(searchQuery || activeTab !== "all") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setSearchQuery(""); setActiveTab("all"); }}
                    className="rounded-xl text-xs font-bold gap-1.5 h-10 shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear
                  </Button>
                )}
              </div>

              <Separator className="opacity-60" />

              {/* Row 2: Status chips */}
              <div className="px-3 py-2.5 flex items-center gap-1.5 flex-wrap">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 mr-0.5 shrink-0 hidden sm:block" />
                {TAB_CHIPS.map((chip) => {
                  const isActive = activeTab === chip.value;
                  const count = tabCounts[chip.value] ?? 0;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setActiveTab(chip.value)}
                      className={`
                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                        border transition-all duration-200 active:scale-95 cursor-pointer
                        ${isActive
                          ? chip.activeClass
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }
                      `}
                    >
                      {!isActive && <span className={`w-1.5 h-1.5 rounded-full ${chip.dotClass}`} />}
                      {chip.label}
                      <span className={`
                        text-[10px] font-extrabold tabular-nums ml-0.5 px-1.5 py-0.5 rounded-full leading-none
                        ${isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"}
                      `}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-slate-500">
                Showing <span className="text-slate-900 font-extrabold tabular-nums">{filteredRecords.length}</span> of <span className="text-slate-900 font-extrabold tabular-nums">{allRecords.length}</span> record{allRecords.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Record Cards */}
            <div className="space-y-3">
              {filteredRecords.length === 0 ? (
                <Card className="py-12 border-dashed border-slate-200 rounded-2xl">
                  <div className="flex flex-col items-center text-center space-y-3 px-6">
                    <div className="p-3 rounded-2xl bg-slate-100">
                      <Search className="w-6 h-6 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-700">No records found</p>
                      <p className="text-xs text-slate-500 max-w-xs">
                        {searchQuery
                          ? `No results for "${searchQuery}".`
                          : "Try adjusting your filters."}
                      </p>
                    </div>
                  </div>
                </Card>
              ) : (
                filteredRecords.map((record) => {
                  const isPending = record.status === "pending";
                  return (
                    <Card
                      key={record.id}
                      className={`relative overflow-hidden border-2 shadow-xs hover:shadow-sm rounded-2xl transition-all duration-200 ${isPending
                        ? "border-amber-200/60 bg-amber-50/20 hover:bg-amber-50/40"
                        : "border-emerald-200/60 bg-emerald-50/20 hover:bg-emerald-50/40"
                        }`}
                    >
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* Checkbox */}
                        {isPending && (
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer shrink-0 accent-[#1A365D]"
                            checked={selectedRecords.includes(record.id)}
                            onChange={() => toggleRecord(record.id)}
                          />
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-black text-slate-900 tracking-tight">
                              {record.farmer}
                            </h3>
                            {getTypeBadge(record.type)}
                            <Badge className={`font-bold text-[10px] uppercase tracking-wider ${isPending
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : "bg-emerald-100 text-emerald-800 border-emerald-200"
                              }`}>
                              {isPending ? (
                                <><Clock className="w-3 h-3 mr-1" />Pending</>
                              ) : (
                                <><CheckCircle2 className="w-3 h-3 mr-1" />Validated</>
                              )}
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold text-slate-500">
                            {record.breed} • {record.count} head{record.count !== 1 ? "s" : ""} • {record.date}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl h-8 px-3 text-xs font-extrabold text-[#1A365D] hover:bg-blue-50"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Review
                          </Button>
                          {isPending && (
                            <Button
                              size="sm"
                              className="rounded-xl h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                              Validate
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: QUARTERLY CENSUS SUBMISSIONS */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {sectionTab === "census" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#1A365D]" />
                  Barangay Livestock Census Submissions
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Official quarterly livestock population counts submitted to the Municipal Agriculture Office.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsCensusDialogOpen(true)}
                className="bg-[#1A365D] hover:bg-[#152944] text-white text-xs font-black rounded-xl shadow-md gap-1.5"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                Submit New Census Batch
              </Button>
            </div>

            {/* Census Search & Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="Search by Barangay, Quarter (e.g. Q2), Year, Batch ID…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 bg-slate-50/60 border-slate-200 rounded-xl h-10 text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Census Batch Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCensus.length === 0 ? (
                <Card className="col-span-full py-12 border-dashed border-slate-200 rounded-2xl">
                  <div className="flex flex-col items-center text-center space-y-3 px-6">
                    <div className="p-3 rounded-2xl bg-slate-100">
                      <FileSpreadsheet className="w-6 h-6 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-700">No census submissions found</p>
                      <p className="text-xs text-slate-500 max-w-xs">
                        Click &ldquo;Submit New Census Batch&rdquo; to record your barangay&apos;s quarterly animal headcount.
                      </p>
                    </div>
                  </div>
                </Card>
              ) : (
                filteredCensus.map((census) => {
                  const isApproved = census.status === "APPROVED";
                  return (
                    <Card
                      key={census.id}
                      className="border border-slate-200 hover:border-slate-300 rounded-2xl bg-white shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between"
                    >
                      <div className="p-5 space-y-4">
                        {/* Top banner of the card */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-[#1A365D] text-white hover:bg-[#1A365D] font-black text-xs px-2.5 py-0.5">
                                Q{census.reportQuarter} {census.reportYear}
                              </Badge>
                              <span className="text-xs font-black text-slate-900">
                                {census.barangay}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 mt-1 font-semibold">
                              Batch: {census.id}
                            </p>
                          </div>

                          <Badge
                            className={`font-bold text-[10px] uppercase tracking-wider ${isApproved
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-amber-100 text-amber-800 border-amber-200"
                              }`}
                          >
                            {isApproved ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 mr-1" /> Pending MAO
                              </>
                            )}
                          </Badge>
                        </div>

                        {/* Counts Highlight */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500">
                              Total Population
                            </span>
                            <p className="text-xl font-black text-slate-900 tabular-nums">
                              {census.totalHeads}{" "}
                              <span className="text-xs font-semibold text-slate-500">Heads</span>
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500">
                              Surveyed Farmers
                            </span>
                            <p className="text-xl font-black text-slate-900 tabular-nums">
                              {census.totalFarmers}{" "}
                              <span className="text-xs font-semibold text-slate-500">Holders</span>
                            </p>
                          </div>
                        </div>

                        {/* Item previews */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] uppercase font-bold text-slate-400">
                            Species Breakdown Preview
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {census.items.slice(0, 4).map((it, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-[10px] font-bold bg-white text-slate-700 border-slate-200"
                              >
                                {it.livestockType.split(" ")[0]}: {it.numberOfHeads}
                              </Badge>
                            ))}
                            {census.items.length > 4 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-bold bg-slate-100 text-slate-500 border-slate-200"
                              >
                                +{census.items.length - 4} more
                              </Badge>
                            )}
                          </div>
                        </div>

                        {census.reviewRemarks && (
                          <p className="text-xs text-slate-500 font-medium italic line-clamp-2">
                            &ldquo;{census.reviewRemarks}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[11px] font-semibold text-slate-500">
                          Submitted: {census.submissionDate}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCensusForDetail(census)}
                          className="h-8 px-3 rounded-xl text-xs font-extrabold text-[#1A365D] hover:bg-blue-50"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          View Details
                        </Button>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Modal Dialogs ═══ */}
      <CensusSubmissionDialog
        open={isCensusDialogOpen}
        onOpenChange={setIsCensusDialogOpen}
        onSubmissionSuccess={handleCensusSubmissionSuccess}
      />

      <CensusDetailsDialog
        submission={selectedCensusForDetail}
        open={!!selectedCensusForDetail}
        onOpenChange={(open) => {
          if (!open) setSelectedCensusForDetail(null);
        }}
      />
    </>
  );
}