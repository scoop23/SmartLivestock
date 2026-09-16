"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";

export type ReportType = "DISEASE" | "MORTALITY";
export type BackendStatus = "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";

export interface FarmerReport {
  id: string;
  reportType: ReportType;
  inventoryId: string;
  cattleTag: string;
  cattleBreed: string;
  cattleType: string;
  name: string; // Disease / Symptom or Cause
  affectedCount: number;
  recordDate: string;
  status: BackendStatus;
  symptoms: string[];
  description: string;
  photoName?: string;
  createdAt: string;
}

// Simple, clear English symptoms
const EASY_SIGNS = [
  { id: "not_eating", label: "Not Eating / Off-Feed", sub: "Refusing food or water" },
  { id: "fever", label: "High Fever / Hot Ears", sub: "Body feels unusually hot" },
  { id: "limping", label: "Limping / Weak Legs", sub: "Difficulty walking or standing" },
  { id: "salivating", label: "Excessive Drooling", sub: "Saliva dripping from mouth" },
  { id: "coughing", label: "Coughing / Runny Nose", sub: "Nasal discharge or wheezing" },
  { id: "bloating", label: "Bloated Belly", sub: "Swollen stomach or gas" },
  { id: "wounds", label: "Skin Sores / Blisters", sub: "Lesions on mouth, feet, or skin" },
  { id: "weak", label: "Lethargic / Weak", sub: "Lying down, isolating from herd" },
];

const EASY_MORTALITY_CAUSES = [
  "Sudden Death / Severe Bloat",
  "Severe Respiratory / Lung Infection",
  "Calving / Birthing Complications",
  "Physical Injury / Accident",
  "Old Age / Natural Causes",
  "Unknown (Needs Vet Inspection)",
];

const INITIAL_REPORTS: FarmerReport[] = [
  {
    id: "DIS-001",
    reportType: "DISEASE",
    inventoryId: "1",
    cattleTag: "B-042",
    cattleBreed: "Brahman Cross",
    cattleType: "Cattle",
    name: "Limping / Weak Legs",
    affectedCount: 1,
    recordDate: "2026-04-21",
    status: "PENDING",
    symptoms: ["Limping / Weak Legs", "Not Eating / Off-Feed"],
    description: "Animal refused to stand this morning; left rear hoof is swollen.",
    createdAt: "2026-04-21T08:30:00Z",
  },
  {
    id: "DIS-002",
    reportType: "DISEASE",
    inventoryId: "2",
    cattleTag: "B-011",
    cattleBreed: "Holstein Sahiwal",
    cattleType: "Cattle",
    name: "Not Eating / Off-Feed",
    affectedCount: 2,
    recordDate: "2026-04-20",
    status: "VERIFIED",
    symptoms: ["Not Eating / Off-Feed", "Lethargic / Weak"],
    description: "Inspected by SIBAT officer on-farm. Prescribed oral electrolytes.",
    createdAt: "2026-04-20T14:15:00Z",
  },
  {
    id: "MOR-001",
    reportType: "MORTALITY",
    inventoryId: "3",
    cattleTag: "A-099",
    cattleBreed: "Native Murrah",
    cattleType: "Carabao",
    name: "Sudden Death / Severe Bloat",
    affectedCount: 1,
    recordDate: "2026-04-18",
    status: "APPROVED",
    symptoms: ["Bloated Belly"],
    description: "Died overnight following heavy feeding on damp legumes. Verified by MAO vet.",
    createdAt: "2026-04-18T10:00:00Z",
  },
];

export default function ReportObservationPage() {
  // ── Fetch Cattle Inventory from Backend API ──
  const { data: inventories = [], isLoading: isLoadingInventory } = useUserInventory();

  // ── Form State ──
  const [reportType, setReportType] = useState<ReportType>("DISEASE");
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>("");
  const [conditionName, setConditionName] = useState<string>("");
  const [affectedCount, setAffectedCount] = useState<number>(1);
  const [recordDate, setRecordDate] = useState<string>(
    () => new Date().toISOString().split("T")[0]
  );
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [description, setDescription] = useState<string>("");
  const [photoName, setPhotoName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ── Log & Filter State ──
  const [reports, setReports] = useState<FarmerReport[]>(INITIAL_REPORTS);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("ALL");

  // Selected Cattle Object
  const selectedCattle = useMemo(() => {
    return inventories.find((inv) => String(inv.id) === String(selectedInventoryId));
  }, [inventories, selectedInventoryId]);

  const maxAvailableCount = selectedCattle?.quantity || 1;

  const handleCattleSelect = (id: string) => {
    setSelectedInventoryId(id);
    setAffectedCount(1);
  };

  const toggleSymptom = (label: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(label)
        ? prev.filter((s) => s !== label)
        : [...prev, label]
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoName(file.name);
      toast.success(`Photo "${file.name}" attached successfully`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInventoryId) {
      toast.error("Please select an animal from your inventory first.");
      return;
    }

    const mainName =
      conditionName.trim() ||
      (selectedSymptoms.length > 0
        ? selectedSymptoms[0]
        : reportType === "DISEASE"
        ? "General Health Concern"
        : "Unspecified Cause");

    setIsSubmitting(true);

    const tagDisplay = selectedCattle?.tagNumber || `Animal #${selectedInventoryId}`;
    const idPrefix = reportType === "DISEASE" ? "DIS" : "MOR";

    const newRecord: FarmerReport = {
      id: `${idPrefix}-${String(reports.length + 1).padStart(3, "0")}`,
      reportType,
      inventoryId: String(selectedInventoryId),
      cattleTag: tagDisplay,
      cattleBreed: selectedCattle?.breed || "Livestock",
      cattleType: selectedCattle?.livestockTypeName || "Livestock",
      name: mainName,
      affectedCount,
      recordDate,
      status: "PENDING",
      symptoms: selectedSymptoms,
      description: description.trim(),
      photoName: photoName || undefined,
      createdAt: new Date().toISOString(),
    };

    setTimeout(() => {
      setReports((prev) => [newRecord, ...prev]);
      setIsSubmitting(false);

      // Reset form
      setSelectedInventoryId("");
      setConditionName("");
      setAffectedCount(1);
      setDescription("");
      setSelectedSymptoms([]);
      setPhotoName("");

      toast.success(
        reportType === "DISEASE"
          ? "Report submitted! SIBAT & MAO have been notified for farm inspection."
          : "Mortality record logged! SIBAT & MAO will review this incident."
      );
    }, 500);
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      const matchesSearch =
        rep.cattleTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.cattleBreed.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        filterType === "ALL" || rep.reportType === filterType;

      return matchesSearch && matchesType;
    });
  }, [reports, searchQuery, filterType]);

  // KPI Metrics
  const totalDiseaseCases = reports.filter((r) => r.reportType === "DISEASE").length;
  const totalMortality = reports.filter((r) => r.reportType === "MORTALITY").length;
  const pendingVerification = reports.filter((r) => r.status === "PENDING").length;
  const approvedCases = reports.filter((r) => r.status === "APPROVED" || r.status === "VERIFIED").length;

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
      sub: "Active health cases",
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
      label: "Waiting for Inspector",
      value: pendingVerification,
      sub: "Pending SIBAT check",
      icon: <Clock className="size-4.5" />,
      variant: "sky",
    },
    {
      label: "Verified & Approved",
      value: approvedCases,
      sub: "Confirmed by MAO",
      icon: <ShieldCheck className="size-4.5" />,
      variant: "emerald",
    },
  ];

  return (
    <>
      <PageHeader
        title="Report Sick or Dead Animal"
        subtitle="Quickly notify SIBAT inspectors and MAO municipal vets about sick or deceased livestock"
        variant="farmer"
        maxWidthClass="max-w-7xl"
      />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
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

        {/* ── MAIN 2-COLUMN LAYOUT: FORM (LEFT) + EASY HISTORY (RIGHT) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ════ LEFT: SIMPLE STEP-BY-STEP REPORT FORM ════ */}
          <div className="lg:col-span-6 space-y-6">
            <Card className="border-2 border-emerald-900/10 shadow-sm rounded-3xl overflow-hidden bg-white">
              {/* Form Top Title */}
              <div
                className={`p-5 sm:p-6 text-white transition-all duration-300 ${
                  reportType === "DISEASE"
                    ? "bg-[#2D5A27]"
                    : "bg-rose-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20">
                    {reportType === "DISEASE" ? (
                      <Stethoscope className="size-6 text-emerald-200" />
                    ) : (
                      <Skull className="size-6 text-rose-200" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">
                      {reportType === "DISEASE"
                        ? "Report Sick or Injured Animal"
                        : "Report Deceased Animal"}
                    </h2>
                    <p className="text-xs text-white/80 font-medium">
                      Easy step-by-step report for municipal veterinary assistance
                    </p>
                  </div>
                </div>
              </div>

              <CardContent className="p-5 sm:p-6 space-y-6">
                {/* ══ STEP 1: SELECT SICK OR DECEASED ══ */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                    <span className="flex items-center justify-center size-5 rounded-full bg-emerald-700 text-white text-[11px]">
                      1
                    </span>
                    <span>What happened to the animal?</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setReportType("DISEASE");
                        setConditionName("");
                      }}
                      className={`p-4 rounded-2xl text-left border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        reportType === "DISEASE"
                          ? "border-emerald-700 bg-emerald-50/70 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Stethoscope
                          className={`size-6 ${
                            reportType === "DISEASE" ? "text-emerald-700" : "text-slate-400"
                          }`}
                        />
                        {reportType === "DISEASE" && (
                          <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-700 text-white rounded-full">
                            Selected
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Sick / Injured Animal</p>
                        <p className="text-[11px] text-slate-500 font-medium">Disease or symptoms</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setReportType("MORTALITY");
                        setConditionName("");
                      }}
                      className={`p-4 rounded-2xl text-left border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        reportType === "MORTALITY"
                          ? "border-rose-700 bg-rose-50/70 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Skull
                          className={`size-6 ${
                            reportType === "MORTALITY" ? "text-rose-700" : "text-slate-400"
                          }`}
                        />
                        {reportType === "MORTALITY" && (
                          <span className="text-[10px] font-black px-2 py-0.5 bg-rose-700 text-white rounded-full">
                            Selected
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Deceased Animal</p>
                        <p className="text-[11px] text-slate-500 font-medium">Animal passed away</p>
                      </div>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* ══ STEP 2: SELECT ANIMAL / BATCH (POWERED BY API) ══ */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                        <span className="flex items-center justify-center size-5 rounded-full bg-emerald-700 text-white text-[11px]">
                          2
                        </span>
                        <span>Which animal or batch?</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-bold">
                        {inventories.length} in your inventory
                      </span>
                    </div>

                    {isLoadingInventory ? (
                      <div className="flex items-center gap-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600 shrink-0" />
                        <span>Loading your livestock list...</span>
                      </div>
                    ) : inventories.length === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2">
                        <p className="font-semibold">No animals found in your inventory.</p>
                        <Link
                          href="/livestock-inventory"
                          className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                        >
                          <Plus className="size-3.5" /> Add livestock first
                        </Link>
                      </div>
                    ) : (
                      <Select
                        value={selectedInventoryId}
                        onValueChange={handleCattleSelect}
                      >
                        <SelectTrigger
                          id="cattle-select"
                          className="w-full py-6 rounded-2xl border-slate-200 bg-slate-50 hover:bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600"
                        >
                          <SelectValue placeholder="Click to select Tag # or animal..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-64 rounded-2xl">
                          {inventories.map((inv) => (
                            <SelectItem
                              key={String(inv.id)}
                              value={String(inv.id)}
                              className="py-3 rounded-xl cursor-pointer"
                            >
                              <div className="flex items-center justify-between w-full gap-4">
                                <span className="font-black text-slate-900">
                                  {inv.tagNumber ? `Tag #${inv.tagNumber}` : `Record #${inv.id}`}
                                </span>
                                <span className="text-xs text-slate-500 font-medium">
                                  {inv.breed || inv.livestockTypeName}
                                </span>
                                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                  Qty: {inv.quantity}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Simple summary card of selected animal */}
                    {selectedCattle && (
                      <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-xs space-y-1">
                        <div className="flex items-center justify-between font-black text-emerald-950">
                          <span className="text-sm">
                            {selectedCattle.tagNumber
                              ? `Tag #${selectedCattle.tagNumber}`
                              : `Animal #${selectedCattle.id}`}
                          </span>
                          <Badge className="bg-emerald-200 text-emerald-900 text-[10px] font-bold">
                            {selectedCattle.livestockTypeName}
                          </Badge>
                        </div>
                        <p className="text-slate-600 font-medium pt-1">
                          Breed: <span className="font-bold text-slate-800">{selectedCattle.breed || "Not specified"}</span> • Total in herd:{" "}
                          <span className="font-bold text-slate-800">{selectedCattle.quantity} heads</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ══ STEP 3: HOW MANY ARE AFFECTED & DATE ══ */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                        <span className="flex items-center justify-center size-5 rounded-full bg-emerald-700 text-white text-[11px]">
                          3
                        </span>
                        <span>How many animals affected?</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAffectedCount((prev) => Math.max(1, prev - 1))}
                          className="h-12 w-12 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 font-black text-lg text-slate-700 flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <Input
                          type="number"
                          min={1}
                          max={maxAvailableCount}
                          value={affectedCount}
                          onChange={(e) =>
                            setAffectedCount(
                              Math.min(
                                maxAvailableCount,
                                Math.max(1, parseInt(e.target.value) || 1)
                              )
                            )
                          }
                          className="text-center font-black text-lg py-5 rounded-xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-emerald-600"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setAffectedCount((prev) =>
                              Math.min(maxAvailableCount, prev + 1)
                            )
                          }
                          className="h-12 w-12 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 font-black text-lg text-slate-700 flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        (Maximum: {maxAvailableCount} head{maxAvailableCount > 1 ? "s" : ""})
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                        <Calendar className="size-4 text-emerald-700" />
                        <span>When did you notice it?</span>
                      </div>
                      <Input
                        type="date"
                        value={recordDate}
                        onChange={(e) => setRecordDate(e.target.value)}
                        className="py-5.5 rounded-xl border-slate-200 bg-slate-50 font-bold text-sm focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  {/* ══ STEP 4: SYMPTOMS OR REASON OBSERVED ══ */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                      <span className="flex items-center justify-center size-5 rounded-full bg-emerald-700 text-white text-[11px]">
                        4
                      </span>
                      <span>
                        {reportType === "DISEASE"
                          ? "Select what signs you noticed:"
                          : "Suspected cause of death:"}
                      </span>
                    </div>

                    {reportType === "DISEASE" ? (
                      /* Easy symptom chips in English */
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {EASY_SIGNS.map((sign) => {
                          const isSelected = selectedSymptoms.includes(sign.label);
                          return (
                            <button
                              key={sign.id}
                              type="button"
                              onClick={() => toggleSymptom(sign.label)}
                              className={`p-3 rounded-xl text-left border-2 transition-all cursor-pointer flex items-start gap-2 ${
                                isSelected
                                  ? "bg-emerald-700 text-white border-emerald-700 shadow-2xs"
                                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              <span className="text-base font-bold">
                                {isSelected ? "✓" : "○"}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-black leading-tight">
                                  {sign.label}
                                </p>
                                <p
                                  className={`text-[10px] font-medium leading-tight mt-0.5 ${
                                    isSelected ? "text-emerald-100" : "text-slate-400"
                                  }`}
                                >
                                  {sign.sub}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Easy cause selector for mortality */
                      <div className="space-y-2 pt-1">
                        <Select
                          value={conditionName}
                          onValueChange={(val) => setConditionName(val)}
                        >
                          <SelectTrigger className="w-full py-5 rounded-xl border-slate-200 bg-slate-50 text-sm font-bold">
                            <SelectValue placeholder="Select suspected cause..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {EASY_MORTALITY_CAUSES.map((cause) => (
                              <SelectItem
                                key={cause}
                                value={cause}
                                className="py-2.5 rounded-lg font-medium text-xs cursor-pointer"
                              >
                                {cause}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* ══ STEP 5: NOTES & PHOTO (OPTIONAL) ══ */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                      <span className="flex items-center justify-center size-5 rounded-full bg-emerald-700 text-white text-[11px]">
                        5
                      </span>
                      <span>Additional Notes & Photo (Optional)</span>
                    </div>

                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Animal refused to stand this morning, isolated in clean pen with fresh water..."
                      className="min-h-[85px] rounded-2xl border-slate-200 text-sm bg-slate-50/60 focus:ring-2 focus:ring-emerald-600"
                    />

                    {/* Simple Camera / Photo Button */}
                    <div className="flex items-center gap-3">
                      <label className="flex-1 flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-2xl bg-slate-50 cursor-pointer transition-colors text-xs font-bold text-slate-600 hover:text-emerald-700">
                        <Camera className="w-4 h-4 text-emerald-600" />
                        <span>{photoName ? photoName : "Take or Attach Photo"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                      </label>
                      {photoName && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setPhotoName("")}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* ══ BIG FRIENDLY SUBMIT BUTTON ══ */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-6.5 rounded-2xl font-black text-base tracking-wide shadow-md cursor-pointer flex items-center justify-center gap-2 text-white transition-all ${
                      reportType === "DISEASE"
                        ? "bg-[#2D5A27] hover:bg-[#23471f]"
                        : "bg-rose-700 hover:bg-rose-800"
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        <span>Sending Report...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>Send Report to SIBAT & MAO</span>
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ════ RIGHT: EASY-TO-READ STATUS LOG OF YOUR REPORTS ════ */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white p-5 rounded-3xl border-2 border-emerald-900/10 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Activity className="size-5 text-emerald-700" />
                    Status of Your Reports
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Track inspector visits and official approval status
                  </p>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex gap-2">
                {[
                  { id: "ALL", label: "All Reports" },
                  { id: "DISEASE", label: "Sick Animals" },
                  { id: "MORTALITY", label: "Deceased" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      filterType === tab.id
                        ? "bg-[#2D5A27] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Tag # or symptoms..."
                  className="pl-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* List of Simple Cards */}
              <div className="space-y-3 pt-1">
                {filteredReports.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    <HeartPulse className="size-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-bold">No reports found.</p>
                  </div>
                ) : (
                  filteredReports.map((rep) => {
                    const isMortality = rep.reportType === "MORTALITY";

                    // Easy Status Info
                    const statusConfig = {
                      PENDING: {
                        bg: "bg-amber-50 border-amber-200 text-amber-900",
                        icon: <Clock className="size-3.5 text-amber-600" />,
                        title: "Waiting for Inspector",
                        desc: "SIBAT validator will visit your farm soon.",
                      },
                      VERIFIED: {
                        bg: "bg-sky-50 border-sky-200 text-sky-900",
                        icon: <ShieldCheck className="size-3.5 text-sky-600" />,
                        title: "Inspected by SIBAT",
                        desc: "Farm visit completed; awaiting MAO vet sign-off.",
                      },
                      APPROVED: {
                        bg: "bg-emerald-50 border-emerald-200 text-emerald-900",
                        icon: <CheckCircle2 className="size-3.5 text-emerald-600" />,
                        title: "Approved by MAO",
                        desc: "Official municipal livestock record updated.",
                      },
                      REJECTED: {
                        bg: "bg-rose-50 border-rose-200 text-rose-900",
                        icon: <X className="size-3.5 text-rose-600" />,
                        title: "Not Approved",
                        desc: "Please visit the MAO office for assistance.",
                      },
                    }[rep.status];

                    return (
                      <div
                        key={rep.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-700/40 transition-all space-y-2.5 shadow-2xs"
                      >
                        {/* Animal Tag & Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-2 rounded-xl ${
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
                              <p className="text-sm font-black text-slate-900">
                                {rep.cattleTag}
                              </p>
                              <p className="text-[11px] text-slate-500 font-semibold">
                                {rep.cattleBreed} • {rep.affectedCount} head{rep.affectedCount > 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>

                          <span className="text-[11px] text-slate-400 font-mono">
                            {rep.recordDate}
                          </span>
                        </div>

                        {/* Symptoms or Cause reported */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                          <p className="font-black text-slate-900">
                            {rep.name}
                          </p>
                          {rep.description && (
                            <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                              {rep.description}
                            </p>
                          )}
                        </div>

                        {/* Easy Status Bar */}
                        <div
                          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${statusConfig.bg}`}
                        >
                          <div className="flex items-center gap-1.5 font-black">
                            {statusConfig.icon}
                            <span>{statusConfig.title}</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500">
                            Ref: {rep.id}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
