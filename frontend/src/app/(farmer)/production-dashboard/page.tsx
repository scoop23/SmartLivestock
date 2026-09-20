"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Baby,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Dna,
  Droplets,
  HeartPulse,
  Info,
  LineChart as LineChartIcon,
  Milk,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import ProductionStats from "./production-stats";
import ProductionCharts from "./production-charts";
import ProductionRecent from "./production-recent";
import ProductionTypeSelector from "./production-type-selector";
import ProductionCalvingTab from "./production-calving-tab";
import ProductionWeightTab from "./production-weight-tab";
import ProductionForecastsTab from "./production-forecasts-tab";

import {
  EMPTY_TYPE_ANALYTICS,
  fetchProductionRecords,
  deleteProductionRecord,
  type ProductionRecordItem,
  type ProductionType,
  useProductionAnalytics,
} from "./production-analytics";
import ProductionWizard from "./production-wizard";
import ProductionDeleteDialog from "./production-delete-dialog";
import type { ProductionPayload } from "./production-wizard";
import { LivestockInventoryItem } from "../livestock-inventory/page";
import api from "@/lib/axios";

export type UnitType = "liters" | "pieces" | "kilograms";

export type UpdateProductionPayload = {
  id: number;
  payload: ProductionPayload;
};

export type WizardMode = "create" | "edit";

export type MainTabKey = "yields" | "calving" | "weights" | "forecasts";

function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card
            key={i}
            className="border border-slate-200 bg-white shadow-xs rounded-3xl"
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="size-9 rounded-2xl" />
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 border-slate-200 shadow-sm rounded-3xl">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-[280px] w-full rounded-2xl" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-4 border-slate-200 shadow-sm rounded-3xl">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-[120px] w-full rounded-2xl" />
            <Skeleton className="h-[120px] w-full rounded-2xl" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ProductionLoggerPage() {
  const [activeMainTab, setActiveMainTab] = useState<MainTabKey>("yields");
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [productionType, setProductionType] = useState<ProductionType>("milk");
  const [clickedInventory, setClickedInventory] = useState<LivestockInventoryItem | null>(null);
  const [formState, setFormState] = useState<Record<string, string | number>>({});
  const [resetSignal, setResetSignal] = useState(0);
  const [analyticsType, setAnalyticsType] = useState<ProductionType | null>(null);
  const [editingRecord, setEditingRecord] = useState<ProductionRecordItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionRecordItem | null>(null);

  const queryClient = useQueryClient();

  const {
    data: analytics,
    isLoading,
    isError,
    refetch,
  } = useProductionAnalytics();

  const { data: inventories = [], isLoading: isInventoryLoading } = useQuery<
    LivestockInventoryItem[]
  >({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await api.get("livestock/inventory/");
      const result: LivestockInventoryItem[] = [];
      for (const item of res.data) {
        result.push({
          id: item.id,
          farmerName: item.farmer_name,
          livestockTypeName: item.livestock_type_name,
          entryType: item.entry_type,
          quantity: item.quantity,
          tagNumber: item.tag_number,
          breed: item.breed,
          sex: item.sex,
          weight: item.weight,
          lastVaccinationDate: item.last_vaccination_date,
          status: item.status,
          reviewRemarks: item.review_remarks,
          createdAt: item.created_at,
        });
      }
      return result;
    },
  });

  const { data: productionRecords = [] } = useQuery<ProductionRecordItem[]>({
    queryKey: ["production"],
    queryFn: fetchProductionRecords,
    staleTime: 30_000,
  });

  const { data: calvingRecords = [] } = useQuery({
    queryKey: ["calving_records"],
    queryFn: async () => {
      const res = await api.get("production/calving/");
      return res.data;
    },
  });

  const { data: weightRecords = [] } = useQuery({
    queryKey: ["weight_records"],
    queryFn: async () => {
      const res = await api.get("production/weights/");
      return res.data;
    },
  });

  const approvedInventories = inventories.filter((item) => item.status === "APPROVED");
  const approvedCattleCount = approvedInventories.filter(
    (i) =>
      i.livestockTypeName?.toLowerCase().includes("cattle") ||
      i.livestockTypeName?.toLowerCase().includes("cow") ||
      i.sex?.toUpperCase().includes("F")
  ).length;

  const handleFieldChange = (field: string, val: string | number) => {
    setFormState((prev) => ({ ...prev, [field]: val }));
  };

  const handleTypeSelect = (type: ProductionType) => {
    setProductionType(type);
  };

  const handleOpenNewWizard = () => {
    setEditingRecord(null);
    setClickedInventory(null);
    setFormState({});
    setProductionType("milk");
    setResetSignal((n) => n + 1);
    setIsWizardOpen(true);
  };

  const handleEditRecord = (record: ProductionRecordItem) => {
    setEditingRecord(record);
    const inventory =
      approvedInventories.find((item) => Number(item.id) === record.livestockId) ?? null;
    setProductionType(record.productionType);
    setClickedInventory(inventory);
    setFormState({
      prodDate: record.recordDate,
      notes: record.notes ?? "",
      ...(record.productionType === "milk" ? { milkQty: record.quantity } : {}),
      ...(record.productionType === "meat" ? { meatQty: record.quantity } : {}),
      ...(record.productionType === "eggs" ? { eggQty: record.quantity } : {}),
      ...(record.productionType === "wool" ? { woolQty: record.quantity } : {}),
    });
    setResetSignal((n) => n + 1);
    setIsWizardOpen(true);
  };

  const submitMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post("production/records/", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Production record submitted for approval");
      setClickedInventory(null);
      setFormState({});
      setProductionType("milk");
      setResetSignal((n) => n + 1);
      setIsWizardOpen(false);
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["production_analytics"] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to submit production record");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: UpdateProductionPayload) => {
      const response = await api.patch(`production/records/${id}/`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Production record updated before approval");
      setIsWizardOpen(false);
      setClickedInventory(null);
      setFormState({});
      setProductionType("milk");
      setResetSignal((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["production_analytics"] });
    },
    onError: (err: Error) => {
      console.log(err);
      toast.error("Failed to update production record");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await deleteProductionRecord(id);
    },
    onSuccess: () => {
      toast.success("Production record deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["production_analytics"] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error ??
        err?.response?.data?.detail ??
        "Failed to delete production record";
      toast.error(msg);
    },
  });

  const handleDeleteRecord = (record: ProductionRecordItem) => {
    if (record.status === "APPROVED") {
      toast.error("Approved records cannot be deleted.");
      return;
    }
    setDeleteTarget(record);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
      },
    });
  };

  const availableTypes = analytics?.available_types ?? [];
  const activeType =
    analyticsType && availableTypes.includes(analyticsType)
      ? analyticsType
      : availableTypes.includes("milk")
        ? "milk"
        : (availableTypes[0] ?? "milk");
  const activeTypeData =
    analytics?.by_type?.[activeType] ?? EMPTY_TYPE_ANALYTICS;

  // Top producing animal calculation
  const milkRecords = productionRecords.filter((r) => r.productionType === "milk");
  const totalMilkLiters = milkRecords.reduce((acc, r) => acc + Number(r.quantity), 0);
  const pendingCount = productionRecords.filter((r) => r.status === "PENDING").length;
  const approvedCount = productionRecords.filter((r) => r.status === "APPROVED").length;

  return (
    <>
      <PageHeader
        title="Farmer Production Dashboard"
        subtitle="Record daily milk yields, register new calves, track cattle weight gains, and monitor herd forecasts."
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        {/* Modern Executive Farm Telemetry Hero Banner */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white p-6 sm:p-8 shadow-lg border border-emerald-900/40">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="size-3.5" /> Livestock Production & Reproductive Output Hub
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Farm Production Performance
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
                Log daily milk collections, register maternal calf births, and monitor calculated weight gain velocity (ADG) for municipal agricultural validation.
              </p>

              {/* Quick Telemetry Chips */}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                  <Users className="size-4 text-emerald-400" />
                  <span><strong>{approvedCattleCount}</strong> Milking / Breeding Stock</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                  <Milk className="size-4 text-sky-400" />
                  <span><strong>{totalMilkLiters.toLocaleString()} L</strong> Total Output</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                  <Baby className="size-4 text-amber-400" />
                  <span><strong>{calvingRecords.length}</strong> Calves Born</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                  <Scale className="size-4 text-teal-400" />
                  <span><strong>{weightRecords.length}</strong> Weigh-ins Logged</span>
                </div>
              </div>
            </div>

            {/* Hero Quick Action Group */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
              <Button
                onClick={handleOpenNewWizard}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-6 rounded-2xl shadow-md gap-2 border border-emerald-400/30"
              >
                <Plus className="size-5" /> Log Daily Milk Yield
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setActiveMainTab("calving")}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold rounded-xl h-10"
                >
                  <Baby className="size-3.5 mr-1 text-emerald-300" />
                  Record Calving
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveMainTab("weights")}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold rounded-xl h-10"
                >
                  <Scale className="size-3.5 mr-1 text-sky-300" />
                  Log Weight
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Unified Modern Segmented Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 overflow-x-auto shadow-xs">
          <button
            type="button"
            onClick={() => setActiveMainTab("yields")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeMainTab === "yields"
                ? "bg-white text-emerald-950 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Milk className="size-4 text-sky-600" />
            Daily Milk Output & Yields
            {productionRecords.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800">
                {productionRecords.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("calving")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeMainTab === "calving"
                ? "bg-white text-emerald-950 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Baby className="size-4 text-emerald-600" />
            Calving & Birth Registry
            {calvingRecords.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                {calvingRecords.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("weights")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeMainTab === "weights"
                ? "bg-white text-emerald-950 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Scale className="size-4 text-amber-600" />
            Weight & Growth Tracker
            {weightRecords.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                {weightRecords.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab("forecasts")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeMainTab === "forecasts"
                ? "bg-white text-emerald-950 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
          >
            <Sparkles className="size-4 text-purple-600" />
            Forecasts & Herd Analytics
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800">
              Auto-Projected
            </span>
          </button>
        </div>

        {/* Tab 1: Daily Milk Output & Executive Production Overview */}
        {activeMainTab === "yields" && (
          <>
            {isLoading ? (
              <AnalyticsLoading />
            ) : isError ? (
              <Card className="p-10 text-center border-red-200 bg-red-50 rounded-3xl">
                <h3 className="font-semibold text-red-700">
                  Unable to load production analytics.
                </h3>
                <p className="text-sm text-red-600 mt-2">Please check your connection and try again.</p>
                <Button className="mt-4 bg-red-700 text-white hover:bg-red-800" onClick={() => refetch()}>
                  <RefreshCw className="size-4 mr-2" /> Retry
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Type Selector (if multi-type present) */}
                {availableTypes.length > 1 && (
                  <div className="flex items-center justify-between">
                    <ProductionTypeSelector
                      types={availableTypes}
                      selected={activeType}
                      onSelect={setAnalyticsType}
                    />
                  </div>
                )}

                {/* Top 4 KPI Metric Cards */}
                <ProductionStats type={activeType} summary={activeTypeData.summary} />

                {/* Main 2-Column Responsive Dashboard Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column (8 Cols): Charts & Recent Feed */}
                  <div className="lg:col-span-8 space-y-6">
                    <ProductionCharts type={activeType} data={activeTypeData} />
                    <ProductionRecent
                      records={productionRecords}
                      showViewMore={true}
                      onEdit={handleEditRecord}
                      onDelete={handleDeleteRecord}
                    />
                  </div>

                  {/* Right Column (4 Cols): Fast Action & Performance Sidebar */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* 4-Step Production Logger Quick Card */}
                    <Card className="border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white shadow-xs rounded-3xl overflow-hidden">
                      <CardHeader className="p-5 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                            <Milk className="size-4.5" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-bold text-slate-900">
                              4-Step Production Logger
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500">
                              Daily yield recording workflow
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-5 pt-0 space-y-3.5 text-xs">
                        <div className="space-y-2 pt-2 border-t border-emerald-100">
                          <div className="flex items-center gap-2.5">
                            <span className="size-5 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
                            <span className="font-semibold text-slate-800">Select Producing Cow / Batch</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="size-5 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
                            <span className="font-semibold text-slate-800">Select Output Type (Milk/Yield)</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="size-5 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
                            <span className="font-semibold text-slate-800">Enter Volume, Date & Notes</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span className="size-5 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-[10px] shrink-0">4</span>
                            <span className="font-semibold text-slate-800">Certify & Submit for SIBAT / MAO</span>
                          </div>
                        </div>

                        <Button
                          onClick={handleOpenNewWizard}
                          className="w-full bg-[#2D5A27] hover:bg-[#244a20] text-white font-bold rounded-xl shadow-xs py-5 mt-1"
                        >
                          <Plus className="size-4 mr-1.5" /> Start 4-Step Record
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Herd Reproduction & Growth Pulse */}
                    <Card className="border-slate-200 shadow-xs rounded-3xl overflow-hidden bg-white">
                      <CardHeader className="p-5 pb-3 border-b border-slate-100">
                        <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <HeartPulse className="size-4 text-emerald-700" />
                          Reproduction & Growth Highlights
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 space-y-3.5 text-xs">
                        <div
                          onClick={() => setActiveMainTab("calving")}
                          className="p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/70 transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                              <Baby className="size-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">New Calvings</p>
                              <p className="text-[11px] text-slate-500">
                                {calvingRecords.length} registered calves
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="size-4 text-slate-400" />
                        </div>

                        <div
                          onClick={() => setActiveMainTab("weights")}
                          className="p-3 rounded-2xl bg-slate-50 hover:bg-amber-50/60 border border-slate-200/70 transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                              <Scale className="size-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">Weight Velocity (ADG)</p>
                              <p className="text-[11px] text-slate-500">
                                {weightRecords.length} scale measurements
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="size-4 text-slate-400" />
                        </div>

                        <div
                          onClick={() => setActiveMainTab("forecasts")}
                          className="p-3 rounded-2xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200/70 transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-purple-100 text-purple-800">
                              <Sparkles className="size-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">Herd Forecasts</p>
                              <p className="text-[11px] text-slate-500">
                                Auto-projected 30/90-day output
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="size-4 text-slate-400" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* SIBAT & Municipal Validation Notice */}
                    <Card className="border-slate-200 shadow-xs rounded-3xl overflow-hidden bg-slate-50/60">
                      <CardContent className="p-5 space-y-2.5 text-xs">
                        <div className="flex items-center gap-2 text-slate-900 font-bold">
                          <ShieldCheck className="size-4 text-emerald-700" />
                          <span>Official LGU Validation Protocol</span>
                        </div>
                        <p className="text-slate-500 leading-relaxed">
                          Submitted daily yields and calving records are verified by the assigned <strong>SIBAT Agricultural Technologist</strong> before aggregation into the Municipal Agriculture Office (MAO) census reports.
                        </p>
                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-600 font-semibold border-t border-slate-200/60">
                          <span>Pending Verification:</span>
                          <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                            {pendingCount} records
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab 2: Calving & Birth Registry */}
        {activeMainTab === "calving" && (
          <ProductionCalvingTab approvedInventories={approvedInventories} />
        )}

        {/* Tab 3: Weight & Growth Tracker (Auto-calculated ADG) */}
        {activeMainTab === "weights" && (
          <ProductionWeightTab approvedInventories={approvedInventories} />
        )}

        {/* Tab 4: Forecasts & Herd Analytics (Auto-calculated Analytics) */}
        {activeMainTab === "forecasts" && (
          <ProductionForecastsTab
            inventories={inventories}
            records={productionRecords}
          />
        )}
      </div>

      {/* Preserved Production Entry Wizard (modal) */}
      <ProductionWizard
        productionType={productionType}
        onTypeChange={handleTypeSelect}
        clickedInventory={clickedInventory}
        onSelectInventory={setClickedInventory}
        formState={formState}
        onFieldChange={handleFieldChange}
        approvedInventories={approvedInventories}
        isLoading={isInventoryLoading}
        isSubmitting={submitMutation.isPending}
        resetSignal={resetSignal}
        onSubmit={(payload) => {
          if (editingRecord) {
            updateMutation.mutate({
              id: editingRecord.id,
              payload,
            });
          } else {
            submitMutation.mutate(payload);
          }
        }}
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        mode={editingRecord ? "edit" : "create"}
        editingRecord={editingRecord}
      />

      <ProductionDeleteDialog
        record={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </>
  );
}

