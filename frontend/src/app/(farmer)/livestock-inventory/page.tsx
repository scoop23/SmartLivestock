"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { toast } from "sonner";

// Lucide Icons
import {
  ArrowLeft,
  Plus,
  Layers,
  FileDown,
  Minus,
  CheckCircle2,
  Clock,
  Tag,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Beef,
  Shield,
  Package,
  Egg,
  Eye,
  AlertCircle,
  Wand2,
  Syringe,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Activity,
  HeartPulse,
} from "lucide-react";

// shadcn/ui primitives
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import LivestockDetailsDialog from "./livestock-details-dialog";
import LivestockEditDialog from "./livestock-edit-dialog";
import LivestockRecordList from "./livestock-record-list";
import LivestockTypeCards from "./livestock-type-cards";
import InventoryStats from "./inventory-stats";
import HealthTrackerTab from "./health-tracker-tab";
import api from "@/lib/axios";
import {
  type EntryType,
  type StatusType,
  type LivestockInventoryItem,
  type LivestockType,
  type InventoryApiItem,
  type CreateInventoryPayload,
  type UpdateInventoryPayload,
  useLivestockTypes,
  useUserInventory,
  SPECIES_PRESETS,
  getSpeciesPreset,
  generateSuggestedTag,
} from "./livestock-inventory";

// Re-export types for any existing consumers
export type { EntryType, StatusType, LivestockInventoryItem, LivestockType, InventoryApiItem };

export default function LivestockInventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"types" | "all" | "health">("types");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LivestockInventoryItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<LivestockInventoryItem | null>(null);
  const [editTarget, setEditTarget] = useState<LivestockInventoryItem | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showHeroBanner, setShowHeroBanner] = useState(false);
  const [showStats, setShowStats] = useState(true);

  const { data: livestockTypes = {} } = useLivestockTypes();
  const { data: inventories = [], isLoading } = useUserInventory();

  // Form State matching Django LivestockInventory
  const initialFormData = {
    entryType: "INDIVIDUAL" as EntryType,
    livestockType: "Cattle",
    quantity: 1,
    tagNumber: "",
    breed: "",
    sex: "Female",
    weight: "",
    isVaccinated: false,
    lastVaccinationDate: "",
  };
  const [formData, setFormData] = useState(initialFormData);

  // Suggested breeds for currently selected species
  const currentPreset = getSpeciesPreset(formData.livestockType);

  // Overall Farm Telemetry Metrics
  const totalHeads = useMemo(
    () => inventories.reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );
  const approvedHeads = useMemo(
    () =>
      inventories
        .filter((i) => i.status === "APPROVED")
        .reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );
  const pendingRecords = useMemo(
    () => inventories.filter((i) => i.status === "PENDING").length,
    [inventories]
  );
  const individualTags = useMemo(
    () => inventories.filter((i) => i.entryType === "INDIVIDUAL").length,
    [inventories]
  );
  const vaccinatedHeads = useMemo(
    () =>
      inventories
        .filter((i) => Boolean(i.lastVaccinationDate))
        .reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );
  const vaxRate = totalHeads > 0 ? Math.round((vaccinatedHeads / totalHeads) * 100) : 0;
  const approvalRate = totalHeads > 0 ? Math.round((approvedHeads / totalHeads) * 100) : 0;
  const speciesCount = useMemo(() => {
    const set = new Set(inventories.map((i) => i.livestockTypeName).filter(Boolean));
    return set.size || Object.keys(livestockTypes).length;
  }, [inventories, livestockTypes]);

  // Filtered inventories when a specific species is clicked
  const typeFilteredInventories = selectedType
    ? inventories.filter((item) => item.livestockTypeName === selectedType)
    : inventories;

  // Mutations
  const addMutation = useMutation({
    mutationFn: async () => {
      const typeId = livestockTypes[formData.livestockType];
      if (!typeId) {
        throw new Error("Selected livestock type is invalid or not found in system.");
      }

      const response = await api.post("/livestock/inventory/", {
        livestock_type: typeId,
        entry_type: formData.entryType,
        quantity: formData.entryType === "INDIVIDUAL" ? 1 : Number(formData.quantity),
        tag_number: formData.tagNumber.trim(),
        breed: formData.breed.trim(),
        sex: formData.sex,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        last_vaccination_date: formData.lastVaccinationDate || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setIsAddOpen(false);
      setFormData(initialFormData);
      toast.success("Livestock entry submitted for official review");
    },
    onError: (err: any) => {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.tag_number?.[0] ||
        "Failed to add livestock entry. Please check required fields.";
      toast.error(msg);
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/livestock/inventory/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Livestock record deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete livestock record");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateInventoryPayload) => {
      if (!editTarget) throw new Error("No record selected");
      const response = await api.put(`/livestock/inventory/${editTarget.id}/`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setEditTarget(null);
      toast.success("Livestock entry updated successfully");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to update livestock entry");
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (formData.entryType === "INDIVIDUAL" && !formData.tagNumber.trim()) {
      setFormError("Ear Tag number is required for individual animals.");
      return;
    }
    if (formData.entryType === "BATCH" && (!formData.quantity || formData.quantity < 1)) {
      setFormError("Quantity must be at least 1 for batch entries.");
      return;
    }
    if (!formData.breed.trim()) {
      setFormError("Breed is required.");
      return;
    }
    if (formData.isVaccinated && !formData.lastVaccinationDate) {
      setFormError("Please select the last vaccination date or uncheck 'Vaccinated'.");
      return;
    }

    addMutation.mutate();
  };

  // CSV Export with UTF-8 BOM and RFC 4180 escaping
  const exportCSV = () => {
    if (inventories.length === 0) {
      toast.error("No livestock records available to export");
      return;
    }

    const headers = [
      "Ear Tag / ID",
      "Livestock Type",
      "Entry Mode",
      "Quantity",
      "Breed",
      "Sex",
      "Weight (kg)",
      "Vaccinated",
      "Last Vaccination Date",
      "Registry Status",
      "Review Remarks",
      "Registration Date",
    ];

    const rows = inventories.map((item) => [
      `"${(item.tagNumber || "").replace(/"/g, '""')}"`,
      `"${(item.livestockTypeName || "").replace(/"/g, '""')}"`,
      `"${(item.entryType || "").replace(/"/g, '""')}"`,
      item.quantity,
      `"${(item.breed || "").replace(/"/g, '""')}"`,
      `"${(item.sex || "").replace(/"/g, '""')}"`,
      item.weight ?? "",
      item.lastVaccinationDate ? "Yes" : "No",
      item.lastVaccinationDate ?? "",
      `"${(item.status || "").replace(/"/g, '""')}"`,
      `"${(item.reviewRemarks || "").replace(/"/g, '""')}"`,
      `"${new Date(item.createdAt).toLocaleDateString()}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `livestock_registry_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Livestock registry exported successfully as CSV");
  };

  return (
    <>
      <PageHeader
        title="Livestock Inventory"
        subtitle="Manage your livestock entries, track biometrics, and monitor herd health"
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        {/* ═══════════════════════════════════════════════════════════════
            EXECUTIVE FARM TELEMETRY HERO BANNER (COLLAPSIBLE)
        ═══════════════════════════════════════════════════════════════ */}
        {/* 1. Collapsed Top Ribbon (Slides in/out smoothly) */}
        <div
          className={`grid transition-[grid-template-rows,opacity,margin] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            !showHeroBanner
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none -mb-6"
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div
              className={`flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white border border-emerald-800/40 shadow-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                !showHeroBanner ? "translate-y-0 scale-100 opacity-100" : "-translate-y-4 scale-[0.98] opacity-0"
              }`}
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full backdrop-blur-md">
                  <Activity className="w-3 h-3 mr-1 text-emerald-400" />
                  Live Herd Registry
                </Badge>
                <span className="text-xs font-black text-white">
                  Livestock Inventory & Biometric Surveillance
                </span>
                <span className="text-xs font-medium text-emerald-200/70 hidden md:inline">
                  • {inventories.length} Registered Records
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCSV}
                  className="gap-1.5 border-emerald-700/50 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl h-9 px-3 text-xs backdrop-blur-md transition-all active:scale-95"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-300" />
                  Export CSV
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black gap-1.5 rounded-xl h-9 px-3.5 text-xs shadow-md shadow-emerald-950/40 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  Register Livestock
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHeroBanner(true)}
                  className="group relative overflow-hidden gap-1.5 border-emerald-400/40 hover:border-emerald-300/80 bg-gradient-to-r from-emerald-500/20 via-emerald-400/25 to-teal-500/20 hover:from-emerald-500/35 hover:via-emerald-400/35 hover:to-teal-500/30 text-emerald-100 hover:text-white rounded-xl h-9 px-3 text-xs font-black shadow-xs hover:shadow-md hover:shadow-emerald-950/40 backdrop-blur-md transition-all duration-300 active:scale-95 cursor-pointer"
                >
                  {/* Ambient Shimmer Sweep Animation */}
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                  {/* Pulsing Live Beacon Dot */}
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300" />
                  </span>

                  <span className="tracking-tight">Show Overview</span>

                  {/* Animated Chevron Bounce */}
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-300 transition-transform duration-300 ease-out group-hover:translate-y-0.5 group-hover:text-emerald-100" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Expanded Hero Banner (Slides down seamlessly) */}
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            showHeroBanner
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 pointer-events-none"
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div
              className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white p-6 sm:p-8 border border-emerald-800/40 shadow-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                showHeroBanner
                  ? "translate-y-0 scale-100 opacity-100"
                  : "-translate-y-8 scale-[0.98] opacity-0"
              }`}
            >
              {/* Subtle Ambient Background Gradients */}
              <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                {/* Left Title & Status Header */}
                <div className="space-y-3 max-w-2xl">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full backdrop-blur-md">
                      <Activity className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Live Herd Registry
                    </Badge>
                    <span className="text-xs font-semibold text-emerald-200/70">
                      {inventories.length} Registered Records
                    </span>
                  </div>

                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                      Livestock Inventory & Biometric Surveillance
                    </h1>
                    <p className="text-sm text-emerald-100/80 font-medium mt-1">
                      Trace ear tags, monitor herd growth, track pedigree breeds, and maintain
                      up-to-date biosecurity vaccination compliance.
                    </p>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={exportCSV}
                    className="gap-2 border-emerald-700/50 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl h-12 px-5 backdrop-blur-md transition-all active:scale-95"
                  >
                    <FileDown className="w-4 h-4 text-emerald-300" />
                    Export CSV
                  </Button>

                  <Button
                    onClick={() => setIsAddOpen(true)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black gap-2 rounded-2xl h-12 px-6 shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
                  >
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                    Register Livestock
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => setShowHeroBanner(false)}
                    className="group relative overflow-hidden gap-1.5 border border-emerald-700/50 hover:border-emerald-600 bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white font-bold rounded-2xl h-12 px-4.5 backdrop-blur-md transition-all duration-300 active:scale-95 cursor-pointer"
                  >
                    <ChevronUp className="w-4 h-4 text-emerald-300 transition-transform duration-300 ease-out group-hover:-translate-y-0.5" />
                    Hide Overview
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ REGISTRATION MODAL ═══ */}
        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setFormError("");
              setFormData(initialFormData);
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-0 shadow-2xl">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md">
                  <Tag className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-white">
                    Register Livestock
                  </DialogTitle>
                  <DialogDescription className="text-xs text-emerald-200/80 mt-0.5">
                    Submit new animal records into the municipal verification registry.
                  </DialogDescription>
                </div>
              </div>
            </div>

                  <form onSubmit={handleAddSubmit} className="p-6 space-y-5 bg-white">
                    {formError && (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Entry Mode Toggle */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Entry Mode
                      </Label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, entryType: "INDIVIDUAL" })}
                          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                            formData.entryType === "INDIVIDUAL"
                              ? "bg-white text-emerald-950 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <Tag className="w-4 h-4 text-emerald-700" />
                          Individual Animal (Tagged)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, entryType: "BATCH" })}
                          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                            formData.entryType === "BATCH"
                              ? "bg-white text-emerald-950 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          <Layers className="w-4 h-4 text-teal-700" />
                          Batch / Herd Group
                        </button>
                      </div>
                    </div>

                    {/* Species Selection with Preset Chips */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Livestock Species
                      </Label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {Object.entries(livestockTypes).map(([name]) => {
                          const isSelected = formData.livestockType === name;
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  livestockType: name,
                                  breed: "",
                                  tagNumber:
                                    formData.entryType === "INDIVIDUAL" && !formData.tagNumber
                                      ? generateSuggestedTag(name)
                                      : formData.tagNumber,
                                });
                              }}
                              className={`p-2.5 rounded-2xl border text-center transition-all ${
                                isSelected
                                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-xs ring-1 ring-emerald-600/30"
                                  : "border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700 font-bold text-xs"
                              }`}
                            >
                              <span className="block text-xs truncate">{name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Ear Tag or Batch Count */}
                    {formData.entryType === "INDIVIDUAL" ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor="tagNumber"
                            className="text-xs font-black uppercase tracking-wider text-slate-500"
                          >
                            Ear Tag / RFID Number
                          </Label>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                tagNumber: generateSuggestedTag(formData.livestockType),
                              })
                            }
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                          >
                            <Wand2 className="w-3 h-3" /> Auto-generate Tag
                          </button>
                        </div>
                        <Input
                          id="tagNumber"
                          placeholder="e.g. CAT-2026-104"
                          value={formData.tagNumber}
                          onChange={(e) => setFormData({ ...formData, tagNumber: e.target.value })}
                          className="h-11 rounded-xl font-mono font-bold"
                          required
                        />
                      </div>
                    ) : (
                      <div className="space-y-2 p-4 rounded-2xl border border-slate-200 bg-slate-50/60">
                        <Label
                          htmlFor="quantity"
                          className="text-xs font-black uppercase tracking-wider text-slate-500"
                        >
                          Batch Head Count
                        </Label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                quantity: Math.max(1, formData.quantity - 1),
                              })
                            }
                            className="size-11 flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors active:scale-95"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <div className="flex-1 text-center">
                            <span className="text-3xl font-black text-slate-900 tabular-nums">
                              {formData.quantity}
                            </span>
                            <p className="text-[11px] text-slate-400 font-semibold">
                              head{formData.quantity !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, quantity: formData.quantity + 1 })
                            }
                            className="size-11 flex items-center justify-center rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 transition-colors active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex gap-2 flex-wrap pt-1">
                          {[5, 10, 25, 50, 100].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setFormData({ ...formData, quantity: n })}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                                formData.quantity === n
                                  ? "bg-emerald-700 text-white border-emerald-700"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              +{n}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Breed & Suggested Chips */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="breed"
                        className="text-xs font-black uppercase tracking-wider text-slate-500"
                      >
                        Breed / Pedigree
                      </Label>
                      <Input
                        id="breed"
                        placeholder="e.g. Brahman, Murrah, Boer, Native"
                        value={formData.breed}
                        onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                        className="h-11 rounded-xl"
                        required
                      />
                      {currentPreset?.commonBreeds && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                            Common Breeds:
                          </span>
                          {currentPreset.commonBreeds.slice(0, 5).map((b) => (
                            <button
                              key={b}
                              type="button"
                              onClick={() => setFormData({ ...formData, breed: b })}
                              className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 transition-colors"
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sex & Weight */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="sex"
                          className="text-xs font-black uppercase tracking-wider text-slate-500"
                        >
                          Sex / Gender
                        </Label>
                        <Select
                          value={formData.sex}
                          onValueChange={(val) => setFormData({ ...formData, sex: val })}
                        >
                          <SelectTrigger id="sex" className="h-11 rounded-xl">
                            <SelectValue placeholder="Select sex" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Female">Female (Cow / Doe / Sow)</SelectItem>
                            <SelectItem value="Male">Male (Bull / Buck / Boar)</SelectItem>
                            <SelectItem value="Mixed">Mixed (Batch Group)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor="weight"
                            className="text-xs font-black uppercase tracking-wider text-slate-500"
                          >
                            Weight (kg)
                          </Label>
                          {currentPreset?.suggestedWeightKg && (
                            <span className="text-[10px] text-slate-400 font-semibold">
                              ~{currentPreset.suggestedWeightKg} kg
                            </span>
                          )}
                        </div>
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          placeholder="e.g. 380"
                          value={formData.weight}
                          onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Health & Vaccination */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="isVaccinated"
                          checked={formData.isVaccinated}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              isVaccinated: !!checked,
                              lastVaccinationDate: checked ? formData.lastVaccinationDate : "",
                            })
                          }
                        />
                        <Label
                          htmlFor="isVaccinated"
                          className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5"
                        >
                          <Syringe className="w-3.5 h-3.5 text-emerald-700" />
                          Animal has active vaccination records on file
                        </Label>
                      </div>

                      {formData.isVaccinated && (
                        <div className="space-y-1.5 pt-1">
                          <Label
                            htmlFor="vaxDate"
                            className="text-xs font-black uppercase tracking-wider text-slate-500"
                          >
                            Last Vaccination Date
                          </Label>
                          <Input
                            id="vaxDate"
                            type="date"
                            max={new Date().toISOString().split("T")[0]}
                            value={formData.lastVaccinationDate}
                            onChange={(e) =>
                              setFormData({ ...formData, lastVaccinationDate: e.target.value })
                            }
                            className="h-10 rounded-xl bg-white"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* Live Preview Card */}
                    <div className="p-3.5 rounded-2xl border border-emerald-900/10 bg-emerald-50/40 text-xs">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900/60 block mb-1">
                        Registry Live Card Preview
                      </span>
                      <div className="flex items-center justify-between font-bold text-emerald-950">
                        <span className="font-mono text-sm">
                          {formData.entryType === "INDIVIDUAL"
                            ? formData.tagNumber || "TAG-PENDING"
                            : `${formData.quantity}x ${formData.livestockType}`}
                        </span>
                        <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px]">
                          Pending Review
                        </Badge>
                      </div>
                      <p className="text-slate-600 mt-0.5">
                        {formData.livestockType} • {formData.breed || "Unspecified Breed"} •{" "}
                        {formData.sex} {formData.weight ? `• ${formData.weight} kg` : ""}
                      </p>
                    </div>

                    <DialogFooter className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddOpen(false);
                          setFormData(initialFormData);
                        }}
                        className="rounded-xl h-11"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={addMutation.isPending}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl h-11 px-6 shadow-sm"
                      >
                        {addMutation.isPending ? "Submitting..." : "Submit to Registry"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

        {/* ═══════════════════════════════════════════════════════════════
            HERD TELEMETRY & STATS CONSOLE (COLLAPSIBLE)
        ═══════════════════════════════════════════════════════════════ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
                Herd Telemetry & Biometric KPIs
              </h2>
              <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                • {inventories.length} {inventories.length === 1 ? "record" : "records"} active
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowStats((prev) => !prev)}
              className="h-8 px-3 text-xs font-bold text-slate-600 hover:text-emerald-950 hover:bg-emerald-50/80 hover:border-emerald-300 rounded-xl gap-1.5 transition-all shadow-2xs border-slate-200 bg-white"
            >
              {showStats ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  <span>Hide Stats</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  <span>Show Stats</span>
                </>
              )}
            </Button>
          </div>

          {showStats ? (
            <InventoryStats inventories={inventories} isLoading={isLoading} layout="horizontal" />
          ) : (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs">
              <div className="flex items-center gap-3 sm:gap-6 flex-wrap text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Layers className="size-3.5 text-emerald-600" />
                  <span>{totalHeads.toLocaleString()}</span>
                  <span className="text-slate-400 font-medium text-[11px]">Total Heads</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <CheckCircle2 className="size-3.5 text-sky-600" />
                  <span>{approvedHeads.toLocaleString()}</span>
                  <span className="text-slate-400 font-medium text-[11px]">Approved ({approvalRate}%)</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Clock className="size-3.5 text-amber-600" />
                  <span>{pendingRecords.toLocaleString()}</span>
                  <span className="text-slate-400 font-medium text-[11px]">Pending</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Tag className="size-3.5 text-orange-600" />
                  <span>{individualTags.toLocaleString()}</span>
                  <span className="text-slate-400 font-medium text-[11px]">Tagged</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  <span>{vaxRate}%</span>
                  <span className="text-slate-400 font-medium text-[11px]">Vaccinated</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowStats(true)}
                className="text-[11px] font-black text-emerald-700 hover:text-emerald-900 hover:underline shrink-0 ml-3 cursor-pointer"
              >
                Expand KPIs
              </button>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            MAIN VIEW CONTENT / SPECIES DRILL-DOWN
        ═══════════════════════════════════════════════════════════════ */}
        {selectedType ? (
          /* Species Specific Drill-Down View */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedType(null)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{selectedType} Registry</h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Viewing all {selectedType.toLowerCase()} records in your herd
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-800 border-0 font-bold px-3 py-1">
                  {typeFilteredInventories.reduce((acc, i) => acc + i.quantity, 0)} Total Heads
                </Badge>
                <Badge className="bg-slate-100 text-slate-700 border-0 font-bold px-3 py-1">
                  {typeFilteredInventories.length} Records
                </Badge>
              </div>
            </div>

            <LivestockRecordList
              items={typeFilteredInventories}
              isLoading={isLoading}
              livestockTypes={livestockTypes}
              onView={(item) => setDetailTarget(item)}
              onEdit={(item) => setEditTarget(item)}
              onDelete={(item) => setDeleteTarget(item)}
              onAddRecord={() => setIsAddOpen(true)}
            />
          </div>
        ) : (
          /* Main Tabbed View */
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as any)}
            className="space-y-4"
          >
            {/* Elevated Modern Segmented Tab Console */}
            <TabsList className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs h-auto">
              {/* Tab 1: Species Breakdown */}
              <TabsTrigger
                value="types"
                className="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left border border-transparent data-[state=active]:bg-white data-[state=active]:border-emerald-200/80 data-[state=active]:shadow-sm data-[state=active]:text-emerald-950 text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer h-auto"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-emerald-100/80 text-emerald-800 group-data-[state=active]:bg-emerald-700 group-data-[state=active]:text-white shadow-2xs">
                    <Layers className="size-4.5" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-black tracking-tight leading-tight">Species Breakdown</p>
                    <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-emerald-700/80 truncate">
                      Herd Categories & Distribution
                    </p>
                  </div>
                </div>
                <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-colors bg-slate-200/70 text-slate-700 group-data-[state=active]:bg-emerald-100 group-data-[state=active]:text-emerald-800 shrink-0 border border-transparent group-data-[state=active]:border-emerald-200/60">
                  {speciesCount > 0 ? `${speciesCount} Species` : "Species"}
                </span>
              </TabsTrigger>

              {/* Tab 2: Complete Herd Registry */}
              <TabsTrigger
                value="all"
                className="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left border border-transparent data-[state=active]:bg-white data-[state=active]:border-teal-200/80 data-[state=active]:shadow-sm data-[state=active]:text-teal-950 text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer h-auto"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-teal-100/80 text-teal-800 group-data-[state=active]:bg-teal-700 group-data-[state=active]:text-white shadow-2xs">
                    <Tag className="size-4.5" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-black tracking-tight leading-tight">Complete Herd Registry</p>
                    <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-teal-700/80 truncate">
                      Ear Tags, Biometrics & Actions
                    </p>
                  </div>
                </div>
                <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-colors bg-slate-200/70 text-slate-700 group-data-[state=active]:bg-teal-100 group-data-[state=active]:text-teal-800 shrink-0 border border-transparent group-data-[state=active]:border-teal-200/60">
                  {inventories.length} {inventories.length === 1 ? "Record" : "Records"}
                </span>
              </TabsTrigger>

              {/* Tab 3: Health & Immunization Tracker */}
              <TabsTrigger
                value="health"
                className="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left border border-transparent data-[state=active]:bg-white data-[state=active]:border-emerald-200/80 data-[state=active]:shadow-sm data-[state=active]:text-emerald-950 text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer h-auto"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-emerald-100/80 text-emerald-800 group-data-[state=active]:bg-[#2D5A27] group-data-[state=active]:text-white shadow-2xs">
                    <ShieldCheck className="size-4.5" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-black tracking-tight leading-tight">Health & Immunization</p>
                    <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-emerald-700/80 truncate">
                      Surveillance & Biosecurity
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-colors bg-emerald-50 text-emerald-800 shrink-0 border border-emerald-200/60">
                  <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {vaxRate}% Vax
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="types" className="space-y-4 pt-2 outline-hidden w-full">
              <LivestockTypeCards
                inventories={inventories}
                isLoading={isLoading}
                onSelectType={setSelectedType}
              />
            </TabsContent>

            <TabsContent value="all" className="space-y-4 pt-2 outline-hidden">
              <LivestockRecordList
                items={inventories}
                isLoading={isLoading}
                livestockTypes={livestockTypes}
                onView={(item) => setDetailTarget(item)}
                onEdit={(item) => setEditTarget(item)}
                onDelete={(item) => setDeleteTarget(item)}
                onAddRecord={() => setIsAddOpen(true)}
              />
            </TabsContent>

            <TabsContent value="health" className="space-y-4 pt-2 outline-hidden">
              <HealthTrackerTab
                inventories={inventories}
                isLoading={isLoading}
                onView={(item) => setDetailTarget(item)}
                onEdit={(item) => setEditTarget(item)}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* ═══ Confirm Delete Dialog ═══ */}
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-900">
                Delete Livestock Record
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this record from your registry? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            {deleteTarget && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-1">
                <p className="font-bold text-slate-900">
                  {deleteTarget.entryType === "INDIVIDUAL"
                    ? deleteTarget.tagNumber || "Un-tagged"
                    : `${deleteTarget.quantity}x ${deleteTarget.livestockTypeName} (Batch)`}
                </p>
                <p className="text-slate-500 text-xs">
                  {deleteTarget.livestockTypeName} • {deleteTarget.breed} • {deleteTarget.sex}
                </p>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!deleteTarget) return;
                  deleteMutation.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="rounded-xl font-bold"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Record"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══ Details & Edit Dialogs ═══ */}
        <LivestockDetailsDialog
          livestock={detailTarget}
          open={!!detailTarget}
          onOpenChange={() => setDetailTarget(null)}
        />

        <LivestockEditDialog
          key={editTarget?.id ?? "closed"}
          item={editTarget}
          open={!!editTarget}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          livestockTypes={livestockTypes}
          isSubmitting={updateMutation.isPending}
          onSubmit={(payload) => updateMutation.mutate(payload)}
        />
      </div>
    </>
  );
}
