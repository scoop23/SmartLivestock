"use client";

import React, { useState, useMemo } from "react";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Stethoscope,
  Skull,
  Beef,
  Milk,
  Scale,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  RotateCcw,
  Eye,
  Calendar,
  MapPin,
  Tag,
  User,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  SibatInspectionDialog,
  SibatValidationRecord,
  SibatReportType,
  SibatStatus,
  SibatInspectionData,
} from "./sibat-inspection-dialog";

// ── Seed Data Aligned with Farmer Observation & Django Backend Models ──
const SEED_SIBAT_RECORDS: SibatValidationRecord[] = [
  {
    id: "DIS-001",
    reportType: "DISEASE",
    farmerName: "Juan Dela Cruz",
    barangayName: "Banaba Ibaba",
    purok: "Purok 2",
    farmerContact: "0917-882-9912",
    livestockTag: "B-042",
    livestockBreed: "Brahman Cross",
    livestockType: "Cattle",
    inventoryId: "1",
    name: "Limping / Weak Legs",
    reportedCount: 1,
    reportedDate: "2026-04-21",
    reportedAt: "2026-04-21T08:30:00Z",
    farmerSymptoms: ["Limping / Weak Legs", "Not Eating / Off-Feed"],
    farmerDescription: "Animal refused to stand this morning; left rear hoof is swollen. No open cuts visible.",
    photoName: "swollen_left_hoof.jpg",
    status: "PENDING",
  },
  {
    id: "DIS-002",
    reportType: "DISEASE",
    farmerName: "Elena Vilia",
    barangayName: "Lipay",
    purok: "Purok 4",
    farmerContact: "0928-334-1188",
    livestockTag: "B-011",
    livestockBreed: "Holstein Sahiwal",
    livestockType: "Cattle",
    inventoryId: "2",
    name: "Coughing / Runny Nose",
    reportedCount: 2,
    reportedDate: "2026-04-20",
    reportedAt: "2026-04-20T14:15:00Z",
    farmerSymptoms: ["Coughing / Runny Nose", "High Fever / Hot Ears", "Lethargic / Isolated"],
    farmerDescription: "Two calves wheezing heavily and coughing after sudden rainstorm.",
    status: "VERIFIED",
    inspection: {
      verifiedBy: "Officer R. Mendoza (SIBAT Sector 1)",
      verifiedAt: "2026-04-20 16:45",
      tagConfirmed: true,
      confirmedCount: 2,
      confirmedSymptoms: ["Coughing / Runny Nose", "High Fever / Hot Ears"],
      severity: "MODERATE",
      biosecurityAction: "PEN_ISOLATION",
      remarks: "On-farm physical check completed. Mild pneumonic wheezing. Prescribed oral electrolytes and temporary stall isolation.",
      temperatureCelsius: 39.8,
    },
  },
  {
    id: "MOR-001",
    reportType: "MORTALITY",
    farmerName: "Mateo Dimaculangan",
    barangayName: "San Roque",
    purok: "Purok 1",
    farmerContact: "0919-445-8821",
    livestockTag: "A-099",
    livestockBreed: "Native Murrah",
    livestockType: "Carabao",
    inventoryId: "3",
    name: "Sudden Death / Severe Bloat",
    reportedCount: 1,
    reportedDate: "2026-04-18",
    reportedAt: "2026-04-18T10:00:00Z",
    farmerSymptoms: ["Bloated Belly"],
    farmerDescription: "Carabao died overnight following heavy feeding on damp legumes. Bloat suspected.",
    status: "APPROVED",
    inspection: {
      verifiedBy: "Officer C. Batangas (SIBAT)",
      verifiedAt: "2026-04-18 11:30",
      tagConfirmed: true,
      confirmedCount: 1,
      confirmedSymptoms: ["Bloated Belly"],
      severity: "CRITICAL",
      biosecurityAction: "BIOSECURE_BURIAL",
      remarks: "Carcass verified on site. Severe tympany/bloat with no signs of anthrax. Supervised 2m deep pit burial with lime.",
    },
    maoApproval: {
      approvedBy: "Dr. A. Laurel (MAO Senior Veterinarian)",
      approvedAt: "2026-04-19 09:15",
      remarks: "Official mortality certification issued for municipal indemnity & inventory update.",
    },
  },
  {
    id: "MOR-002",
    reportType: "MORTALITY",
    farmerName: "Ricardo Gomez",
    barangayName: "Quilo-quilo",
    purok: "Purok 3",
    farmerContact: "0939-556-7722",
    livestockTag: "D-055",
    livestockBreed: "Dairy Jersey",
    livestockType: "Cattle",
    inventoryId: "4",
    name: "Calving / Birthing Complications",
    reportedCount: 1,
    reportedDate: "2026-04-21",
    reportedAt: "2026-04-21T06:00:00Z",
    farmerSymptoms: ["Lethargic / Isolated"],
    farmerDescription: "Severe dystocia during unassisted nighttime birth resulting in maternal death.",
    status: "PENDING",
  },
  {
    id: "SLG-001",
    reportType: "SLAUGHTER",
    farmerName: "Pedro Garcia",
    barangayName: "Bukal",
    purok: "Purok 2",
    farmerContact: "0918-223-4411",
    livestockTag: "B-088",
    livestockBreed: "Philippine Native",
    livestockType: "Cattle",
    name: "Emergency Leg Injury Slaughter",
    reportedCount: 1,
    reportedDate: "2026-04-21",
    reportedAt: "2026-04-21T07:15:00Z",
    farmerSymptoms: ["Limping / Weak Legs"],
    farmerDescription: "Fractured hind leg from ditch fall. Emergency meat inspection requested.",
    extraDetails: { liveWeightKg: 380, dressedWeightKg: 235 },
    status: "PENDING",
  },
  {
    id: "MLK-001",
    reportType: "PRODUCTION",
    farmerName: "Maria Santos",
    barangayName: "Banaba Ibaba",
    purok: "Purok 1",
    farmerContact: "0917-111-2233",
    livestockTag: "D-014",
    livestockBreed: "Holstein Cross",
    livestockType: "Dairy Cattle",
    name: "Morning Milk Yield Certification",
    reportedCount: 1,
    reportedDate: "2026-04-21",
    reportedAt: "2026-04-21T06:30:00Z",
    farmerSymptoms: [],
    farmerDescription: "Morning milking yield certified at cooperative bulk tank.",
    extraDetails: { productionQuantity: 45.5, productionUnit: "LITERS" },
    status: "VERIFIED",
    inspection: {
      verifiedBy: "Officer R. Mendoza (SIBAT Sector 1)",
      verifiedAt: "2026-04-21 08:00",
      tagConfirmed: true,
      confirmedCount: 1,
      confirmedSymptoms: [],
      severity: "MILD",
      biosecurityAction: "NONE",
      remarks: "Cooperative chiller tank measurement calibrated and certified.",
    },
  },
];

export default function SibatValidationPage() {
  const [records, setRecords] = useState<SibatValidationRecord[]>(SEED_SIBAT_RECORDS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [barangayFilter, setBarangayFilter] = useState<string>("ALL");

  // Inspection Modal States
  const [selectedRecord, setSelectedRecord] = useState<SibatValidationRecord | null>(null);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);

  // ── KPIs Calculation ──
  const kpis = useMemo(() => {
    const pendingVisits = records.filter((r) => r.status === "PENDING").length;
    const verifiedToday = records.filter((r) => r.status === "VERIFIED").length;
    const approvedMao = records.filter((r) => r.status === "APPROVED").length;
    const flaggedCases = records.filter((r) => r.status === "FLAGGED" || r.status === "FALSE_ALARM").length;

    return { pendingVisits, verifiedToday, approvedMao, flaggedCases };
  }, [records]);

  // ── Unique Barangays for filter ──
  const uniqueBarangays = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => r.barangayName && set.add(r.barangayName));
    return Array.from(set).sort();
  }, [records]);

  // ── Filter Pipeline ──
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        rec.farmerName.toLowerCase().includes(q) ||
        rec.livestockTag.toLowerCase().includes(q) ||
        rec.barangayName.toLowerCase().includes(q) ||
        rec.name.toLowerCase().includes(q) ||
        rec.farmerDescription.toLowerCase().includes(q) ||
        rec.id.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "ALL" || rec.status === statusFilter;
      const matchesType = typeFilter === "ALL" || rec.reportType === typeFilter;
      const matchesBarangay = barangayFilter === "ALL" || rec.barangayName === barangayFilter;

      return matchesSearch && matchesStatus && matchesType && matchesBarangay;
    });
  }, [records, searchQuery, statusFilter, typeFilter, barangayFilter]);

  // ── Open Inspection Modal ──
  const handleOpenInspection = (record: SibatValidationRecord) => {
    setSelectedRecord(record);
    setIsInspectionModalOpen(true);
  };

  // ── Handle SIBAT Verification Confirmation ──
  const handleConfirmInspection = (
    recordId: string,
    action: "VERIFIED" | "FLAGGED" | "FALSE_ALARM",
    inspectionData: SibatInspectionData
  ) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === recordId
          ? {
              ...r,
              status: action,
              inspection: inspectionData,
            }
          : r
      )
    );

    if (action === "VERIFIED") {
      toast.success(`Record ${recordId} verified on-farm!`, {
        description: "Status changed to VERIFIED. Forwarded to MAO for final municipal approval.",
      });
    } else if (action === "FLAGGED") {
      toast.warning(`Record ${recordId} flagged for Vet Review`, {
        description: "Quarantine & provincial lab diagnostic alert logged.",
      });
    } else if (action === "FALSE_ALARM") {
      toast.info(`Record ${recordId} marked as False Alarm / Discrepancy`);
    }
  };

  // ── Helper Badge Renderers ──
  const renderStatusBadge = (status: SibatStatus) => {
    switch (status) {
      case "VERIFIED":
        return (
          <Badge className="bg-sky-100 text-sky-800 border-sky-300 font-black text-[10px] uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-sky-600" />
            Verified (SIBAT)
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-black text-[10px] uppercase flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            MAO Certified
          </Badge>
        );
      case "FLAGGED":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-black text-[10px] uppercase flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Flagged (Needs Vet)
          </Badge>
        );
      case "FALSE_ALARM":
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-black text-[10px] uppercase flex items-center gap-1">
            <X className="w-3 h-3 text-slate-500" />
            False Alarm
          </Badge>
        );
      case "PENDING":
      default:
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-300 font-black text-[10px] uppercase flex items-center gap-1 animate-pulse">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending On-Farm Visit
          </Badge>
        );
    }
  };

  const getReportTypeIcon = (type: SibatReportType) => {
    switch (type) {
      case "DISEASE":
        return {
          icon: <Stethoscope className="size-5 text-emerald-700" />,
          bg: "bg-emerald-50 border-emerald-200",
          label: "Health Observation",
        };
      case "MORTALITY":
        return {
          icon: <Skull className="size-5 text-rose-700" />,
          bg: "bg-rose-50 border-rose-200",
          label: "Mortality Incident",
        };
      case "SLAUGHTER":
        return {
          icon: <Beef className="size-5 text-purple-700" />,
          bg: "bg-purple-50 border-purple-200",
          label: "Slaughter Check",
        };
      case "PRODUCTION":
        return {
          icon: <Milk className="size-5 text-blue-700" />,
          bg: "bg-blue-50 border-blue-200",
          label: "Yield Production",
        };
      case "SALE":
      default:
        return {
          icon: <Scale className="size-5 text-teal-700" />,
          bg: "bg-teal-50 border-teal-200",
          label: "Cattle Sale Transfer",
        };
    }
  };

  return (
    <>
      <PageHeader
        title="SIBAT On-Farm Field Inspection Portal"
        subtitle="Step 2: Conduct on-farm physical examinations, verify clinical signs, and certify records for MAO municipal approval."
        variant="sibat"
        maxWidthClass="max-w-7xl"
        icon={<Stethoscope className="size-6 text-white" />}
      />

      <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 pb-24">
        {/* ══ KPI SUMMARY STRIP ══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <CardContent className="p-4 sm:p-5 flex items-center gap-3">
              <div className="size-11 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                <Clock className="size-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Pending Visit
                </p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 leading-none mt-0.5">
                  {kpis.pendingVisits}
                </p>
                <p className="text-[10px] text-amber-700 font-bold mt-0.5">Needs on-farm check</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <CardContent className="p-4 sm:p-5 flex items-center gap-3">
              <div className="size-11 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700 shrink-0">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Verified by SIBAT
                </p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 leading-none mt-0.5">
                  {kpis.verifiedToday}
                </p>
                <p className="text-[10px] text-sky-700 font-bold mt-0.5">Ready for MAO stamp</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <CardContent className="p-4 sm:p-5 flex items-center gap-3">
              <div className="size-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  MAO Approved
                </p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 leading-none mt-0.5">
                  {kpis.approvedMao}
                </p>
                <p className="text-[10px] text-emerald-700 font-bold mt-0.5">Officially certified</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <CardContent className="p-4 sm:p-5 flex items-center gap-3">
              <div className="size-11 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Flagged / Review
                </p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 leading-none mt-0.5">
                  {kpis.flaggedCases}
                </p>
                <p className="text-[10px] text-rose-700 font-bold mt-0.5">Vet consult needed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ══ WORKFLOW INSTRUCTION BANNER ══ */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#1A365D] to-[#2B6CB0] text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
              <ClipboardCheck className="size-6 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-wide text-white">
                Step 2: SIBAT On-Farm Animal Physical Inspection
              </h3>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Verify the animal ear tag, confirm symptoms or mortality cause, and change status to <span className="font-black text-amber-300 uppercase">VERIFIED</span> so the Municipal Agriculture Office can grant final approval.
              </p>
            </div>
          </div>
          <Badge className="bg-amber-400 text-slate-900 font-black text-[10px] uppercase px-3 py-1.5 shrink-0">
            Field Officer Duty
          </Badge>
        </div>

        {/* ══ FILTER & SEARCH TOOLBAR ══ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search by farmer name, tag #, barangay, or disease..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9.5 pr-8 bg-slate-50 border-slate-200 rounded-xl h-10 text-xs font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Barangay Select */}
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-xl h-10 px-3 text-xs font-bold text-slate-700 outline-none"
            >
              <option value="ALL">All Barangays</option>
              {uniqueBarangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* Clear button if filtered */}
            {(searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL" || barangayFilter !== "ALL") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setTypeFilter("ALL");
                  setBarangayFilter("ALL");
                }}
                className="rounded-xl text-xs font-bold gap-1.5 h-10 shrink-0 text-slate-600"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            )}
          </div>

          <Separator className="opacity-60" />

          {/* Status & Category Quick Filter Chips */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Status Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1 hidden sm:inline">
                Status:
              </span>
              {[
                { id: "ALL", label: "All Statuses" },
                { id: "PENDING", label: "Pending Visit", dot: "bg-amber-500" },
                { id: "VERIFIED", label: "Verified (Field)", dot: "bg-sky-500" },
                { id: "APPROVED", label: "MAO Approved", dot: "bg-emerald-500" },
                { id: "FLAGGED", label: "Flagged", dot: "bg-rose-500" },
              ].map((chip) => {
                const isActive = statusFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setStatusFilter(chip.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? "bg-[#1A365D] text-white border-[#1A365D] shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {chip.dot && <span className={`size-1.5 rounded-full ${chip.dot}`} />}
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Type Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1 hidden sm:inline">
                Category:
              </span>
              {[
                { id: "ALL", label: "All Categories" },
                { id: "DISEASE", label: "Health / Sick" },
                { id: "MORTALITY", label: "Mortality" },
                { id: "SLAUGHTER", label: "Slaughter" },
                { id: "PRODUCTION", label: "Yield" },
              ].map((chip) => {
                const isActive = typeFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setTypeFilter(chip.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══ RECORD QUEUE LIST ══ */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-bold text-slate-500">
              Showing <span className="font-black text-slate-900">{filteredRecords.length}</span>{" "}
              of <span className="font-black text-slate-900">{records.length}</span> field submissions
            </p>
          </div>

          {filteredRecords.length === 0 ? (
            <Card className="py-16 border-dashed border-slate-200 rounded-3xl bg-white text-center">
              <div className="flex flex-col items-center justify-center space-y-3 px-6">
                <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                  <Search className="size-6" />
                </div>
                <h4 className="text-base font-black text-slate-800">No field submissions match your filters</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Try adjusting your search query, status filters, or barangay selection.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredRecords.map((record) => {
                const typeInfo = getReportTypeIcon(record.reportType);
                const isPending = record.status === "PENDING";
                const isVerified = record.status === "VERIFIED";

                return (
                  <Card
                    key={record.id}
                    className={`rounded-2xl sm:rounded-3xl border-2 transition-all hover:shadow-md bg-white overflow-hidden ${
                      isPending
                        ? "border-amber-400/80 bg-gradient-to-r from-amber-50/30 to-white"
                        : isVerified
                        ? "border-sky-300/80"
                        : "border-slate-200/80"
                    }`}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Left Info Group */}
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div
                            className={`size-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-2xs ${typeInfo.bg}`}
                          >
                            {typeInfo.icon}
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black text-slate-400 font-mono">
                                {record.id}
                              </span>
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                                {typeInfo.label}
                              </span>
                              {renderStatusBadge(record.status)}
                            </div>

                            <div className="flex items-baseline gap-2 flex-wrap">
                              <h3 className="text-base font-black text-slate-900 leading-tight">
                                {record.name}
                              </h3>
                              <span className="text-xs font-bold text-slate-500">
                                • {record.reportedCount} Head{record.reportedCount > 1 ? "s" : ""}
                              </span>
                            </div>

                            {/* Animal & Farmer Tags */}
                            <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap pt-0.5">
                              <span className="flex items-center gap-1 font-bold text-slate-800">
                                <Tag className="size-3 text-slate-400" />
                                {record.livestockTag} ({record.livestockBreed} - {record.livestockType})
                              </span>
                              <span className="flex items-center gap-1 text-slate-600">
                                <User className="size-3 text-slate-400" />
                                {record.farmerName}
                              </span>
                              <span className="flex items-center gap-1 text-slate-500">
                                <MapPin className="size-3 text-slate-400" />
                                {record.barangayName} {record.purok ? `(${record.purok})` : ""}
                              </span>
                              <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                                <Calendar className="size-3 text-slate-400" />
                                {record.reportedDate}
                              </span>
                            </div>

                            {/* Symptoms Chips */}
                            {record.farmerSymptoms && record.farmerSymptoms.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                  Signs:
                                </span>
                                {record.farmerSymptoms.map((sym, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                                  >
                                    {sym}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Inspection trail summary if verified */}
                            {record.inspection && (
                              <div className="mt-2 p-2.5 rounded-xl bg-sky-50/70 border border-sky-100 text-xs text-sky-950 flex items-start gap-2">
                                <CheckCircle2 className="size-4 text-sky-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-black text-sky-900">
                                    SIBAT Inspection Verified ({record.inspection.verifiedAt}):
                                  </span>{" "}
                                  <span className="text-sky-800 font-medium italic">
                                    "{record.inspection.remarks}"
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 lg:flex-col lg:items-end shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                          {isPending ? (
                            <Button
                              onClick={() => handleOpenInspection(record)}
                              className="w-full lg:w-auto py-5 px-4 bg-[#1A365D] hover:bg-[#152c4d] text-white rounded-xl font-black text-xs uppercase tracking-wide gap-2 shadow-sm cursor-pointer"
                            >
                              <Stethoscope className="size-4 text-amber-300" />
                              <span>Inspect on Farm (Step 2)</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() => handleOpenInspection(record)}
                              className="w-full lg:w-auto py-5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 rounded-xl font-black text-xs uppercase tracking-wide gap-2 cursor-pointer"
                            >
                              <Eye className="size-4 text-slate-600" />
                              <span>View / Update Inspection</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          SIBAT ON-FARM PHYSICAL INSPECTION DIALOG MODAL
         ══════════════════════════════════════════════════ */}
      <SibatInspectionDialog
        record={selectedRecord}
        open={isInspectionModalOpen}
        onOpenChange={setIsInspectionModalOpen}
        onConfirmInspection={handleConfirmInspection}
      />
    </>
  );
}