"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Compass,
  FileSpreadsheet,
  History,
  Layers,
  MapPin,
  QrCode,
  Radar,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeaderMenuButton } from "@/app/components/header-menu-button";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { getSchedules } from "@/lib/community-api";
import {
  useClinicalHealthRecords,
  useSibatSubmissions,
} from "../sibat-analytics";

// ── Types ───────────────────────────────────────────────────────────────────

type ModuleCategory = "ALL" | "VALIDATION" | "REGISTRIES" | "BIOSECURITY" | "FIELD_OPS";

interface WorkspaceModule {
  id: string;
  code: string;
  category: "VALIDATION" | "REGISTRIES" | "BIOSECURITY" | "FIELD_OPS";
  categoryLabel: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  capabilityTags: string[];
  primaryAction: string;
  badgeType: "pending" | "alert" | "cohorts" | "schedules" | "static";
  staticBadgeText?: string;
  staticBadgeColor?: "emerald" | "cyan" | "slate" | "amber";
}

// ── Workspace Modules Definition (Farmer & Field Reviewer Terms) ───────────

const WORKSPACE_MODULES: WorkspaceModule[] = [
  {
    id: "field-overview",
    code: "MOD-01",
    category: "VALIDATION",
    categoryLabel: "FIELD REVIEWS",
    title: "Field Verification & Review Queue",
    description:
      "Review new animal registrations, herd additions, and weight updates submitted by farmers. Check ear tags and photos on-site before submitting your findings to MAO.",
    href: "/sibat",
    icon: ClipboardCheck,
    capabilityTags: ["Ear Tag Check", "Farm Visit", "Photo Verification"],
    primaryAction: "OPEN REVIEW QUEUE",
    badgeType: "pending",
  },
  {
    id: "livestock-registry",
    code: "MOD-02",
    category: "REGISTRIES",
    categoryLabel: "ANIMAL LIST",
    title: "Farmers & Registered Animals",
    description:
      "Look up registered farmers and their animals by ear tag number, species, breed, or barangay within your assigned area.",
    href: "/sibat/livestock-registry",
    icon: Users,
    capabilityTags: ["Ear Tag Lookup", "Farmer Profiles", "Animal Details"],
    primaryAction: "VIEW ANIMAL LIST",
    badgeType: "static",
    staticBadgeText: "BARANGAY DIRECTORY",
    staticBadgeColor: "cyan",
  },
  {
    id: "batches",
    code: "MOD-03",
    category: "REGISTRIES",
    categoryLabel: "HERDS & BATCHES",
    title: "Herd & Batch Monitoring",
    description:
      "Monitor groups of animals, track batch feeding and target weights, and verify newly added animals in each herd.",
    href: "/sibat/batches",
    icon: Layers,
    capabilityTags: ["Herd Batches", "Target Weights", "Feeding Records"],
    primaryAction: "INSPECT HERDS",
    badgeType: "cohorts",
  },
  {
    id: "census-submit",
    code: "MOD-04",
    category: "VALIDATION",
    categoryLabel: "CENSUS",
    title: "Quarterly Livestock Census",
    description:
      "Count and record farm animals per household during the quarterly barangay livestock census to keep official municipal counts accurate.",
    href: "/sibat/census/submit",
    icon: FileSpreadsheet,
    capabilityTags: ["Headcount", "Household Survey", "Animal Counts"],
    primaryAction: "RECORD CENSUS",
    badgeType: "static",
    staticBadgeText: "QUARTERLY CENSUS",
    staticBadgeColor: "emerald",
  },
  {
    id: "census-history",
    code: "MOD-05",
    category: "VALIDATION",
    categoryLabel: "CENSUS HISTORY",
    title: "Census History & Corrections",
    description:
      "View past census submissions, check approval status from MAO, and update any census records that were returned for correction.",
    href: "/sibat/census-submissions",
    icon: History,
    capabilityTags: ["Past Submissions", "MAO Approvals", "Returned Records"],
    primaryAction: "VIEW CENSUS LOGS",
    badgeType: "static",
    staticBadgeText: "SURVEY ARCHIVE",
    staticBadgeColor: "slate",
  },
  {
    id: "health-alerts",
    code: "MOD-06",
    category: "BIOSECURITY",
    categoryLabel: "ANIMAL HEALTH",
    title: "Disease & Mortality Follow-Up",
    description:
      "Check reports of sick or dead livestock from farmers. Visit the farm, check symptoms and ear tags, and report findings to MAO.",
    href: "/sibat-alerts",
    icon: ShieldAlert,
    capabilityTags: ["Disease Reports", "Death Notices", "On-Site Check"],
    primaryAction: "CHECK HEALTH REPORTS",
    badgeType: "alert",
  },
  {
    id: "production-records",
    code: "MOD-07",
    category: "REGISTRIES",
    categoryLabel: "PRODUCTION & SALES",
    title: "Sales, Births & Production Records",
    description:
      "Review farmer records for animal sales, newborn calves, and farm production such as meat, eggs, and wool.",
    href: "/sibat/production-records",
    icon: TrendingUp,
    capabilityTags: ["Animal Sales", "Calf Births", "Farm Production"],
    primaryAction: "VIEW PRODUCTION",
    badgeType: "static",
    staticBadgeText: "SALES & BIRTHS",
    staticBadgeColor: "emerald",
  },
  {
    id: "field-schedules",
    code: "MOD-08",
    category: "FIELD_OPS",
    categoryLabel: "SCHEDULES",
    title: "Barangay Programs & Schedules",
    description:
      "View upcoming municipal schedules for animal vaccination, deworming, farmer meetings, and agricultural assistance.",
    href: "/sibat-scheduling",
    icon: CalendarDays,
    capabilityTags: ["Vaccination Days", "Deworming Schedule", "Farmer Seminars"],
    primaryAction: "VIEW SCHEDULES",
    badgeType: "schedules",
  },
  {
    id: "gis-radar",
    code: "MOD-09",
    category: "FIELD_OPS",
    categoryLabel: "LIVESTOCK MAP",
    title: "Barangay Livestock Map (GIS)",
    description:
      "View farm locations, animal movements, checkpoints, and livestock density across Padre Garcia on an interactive map.",
    href: "/sibat-monitoring",
    icon: Compass,
    capabilityTags: ["Farm Locations", "Movement Paths", "Barangay Map"],
    primaryAction: "OPEN LIVESTOCK MAP",
    badgeType: "static",
    staticBadgeText: "BARANGAY MAP",
    staticBadgeColor: "cyan",
  },
];

// ── Main Page Component ─────────────────────────────────────────────────────

export default function BarangayLivestockMonitoringPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ModuleCategory>("ALL");
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Live Telemetry Data Fetching ──────────────────────────────────────────

  const {
    submissions,
    isLoading: isLoadingSubmissions,
    refetch: refetchSubmissions,
  } = useSibatSubmissions();

  const {
    records: healthRecords,
    isLoading: isLoadingHealth,
    refetch: refetchHealth,
  } = useClinicalHealthRecords();

  const {
    data: batchSummary,
    isLoading: isLoadingBatches,
    refetch: refetchBatches,
  } = useQuery({
    queryKey: [
      "sibat-monitoring-batches",
      user?.email,
      user?.accessScope,
      user?.assignedBarangayId,
    ],
    queryFn: async () => {
      const res = await api.get("livestock/batches/", {
        params: { summary: "true", page: 1, page_size: 100 },
      });
      return res.data;
    },
    enabled: Boolean(user?.email),
    staleTime: 30_000,
  });

  const {
    data: schedules,
    refetch: refetchSchedules,
  } = useQuery({
    queryKey: ["sibat-monitoring-schedules", user?.assignedBarangayId],
    queryFn: () => getSchedules(),
    staleTime: 60_000,
  });

  // ── Computed Telemetry KPIs ───────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalBatches =
      batchSummary?.summary?.totalHerds ?? batchSummary?.results?.length ?? 0;
    const totalAnimals = batchSummary?.summary?.totalAnimals ?? 0;
    const verifiedAnimals = batchSummary?.summary?.verifiedAnimals ?? 0;
    const approvedAnimals = batchSummary?.summary?.approvedAnimals ?? 0;

    const pendingSubmissions = (submissions || []).filter(
      (s) => s.status === "PENDING"
    ).length;

    const activeHealthAlerts = (healthRecords || []).filter(
      (r) => r.status === "PENDING" || r.status === "FLAGGED"
    ).length;

    const syncRate =
      totalAnimals > 0
        ? Math.round(((verifiedAnimals + approvedAnimals) / totalAnimals) * 100)
        : 100;

    return {
      totalBatches,
      totalAnimals,
      pendingSubmissions,
      activeHealthAlerts,
      syncRate,
    };
  }, [batchSummary, submissions, healthRecords]);

  // ── Sync Telemetry Handler ────────────────────────────────────────────────

  const handleSyncTelemetry = async () => {
    setIsSyncing(true);
    try {
      await Promise.all([
        refetchSubmissions(),
        refetchHealth(),
        refetchBatches(),
        refetchSchedules(),
      ]);
      toast.success("Records updated", {
        description: "Herds, review items, and health reports are up to date.",
      });
    } catch {
      toast.error("Could not update records", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Filtered Workspaces ───────────────────────────────────────────────────

  const filteredModules = useMemo(() => {
    return WORKSPACE_MODULES.filter((m) => {
      const matchCategory =
        selectedCategory === "ALL" || m.category === selectedCategory;

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.categoryLabel.toLowerCase().includes(q) ||
        m.capabilityTags.some((tag) => tag.toLowerCase().includes(q));

      return matchCategory && matchSearch;
    });
  }, [searchQuery, selectedCategory]);

  const categoryCounts = useMemo(() => {
    return {
      ALL: WORKSPACE_MODULES.length,
      VALIDATION: WORKSPACE_MODULES.filter((m) => m.category === "VALIDATION").length,
      REGISTRIES: WORKSPACE_MODULES.filter((m) => m.category === "REGISTRIES").length,
      BIOSECURITY: WORKSPACE_MODULES.filter((m) => m.category === "BIOSECURITY").length,
      FIELD_OPS: WORKSPACE_MODULES.filter((m) => m.category === "FIELD_OPS").length,
    };
  }, []);

  const assignedSector =
    user?.accessScope === "ALL_BARANGAYS"
      ? "All Barangays (Full Access)"
      : user?.assignedBarangayName || "Padre Garcia";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8 pb-28">
      {/* ── 1. FUTURISTIC COMMAND CENTER HEADER ─────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-6 sm:p-8 text-slate-900 shadow-sm">
        {/* Holographic Glow Orbs */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 size-80 rounded-full bg-teal-200/30 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            {/* Status Breadcrumb */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase tracking-wider font-bold shadow-xs">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
                </span>
                FIELD OFFICE // SIBAT-CBAT
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-700 font-semibold flex items-center gap-1">
                <MapPin className="size-3.5 text-emerald-700" />
                BARANGAY: {assignedSector}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-emerald-800 font-bold flex items-center gap-1">
                <Zap className="size-3 text-emerald-700" />
                MONITORING HUB
              </span>
            </div>

            <div className="flex items-center gap-3">
              <HeaderMenuButton className="lg:hidden shrink-0 size-10 rounded-xl bg-white text-emerald-900 border border-emerald-300 shadow-xs hover:bg-emerald-50 hover:border-emerald-400 transition-colors" />
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight font-sans text-slate-900">
                  Barangay Livestock Monitoring
                </h1>
                <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-xs font-bold px-2.5 py-0.5">
                  FIELD HUB
                </Badge>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
              Monitor registered livestock, review farmer submissions, conduct quarterly census,
              and follow up animal health reports across Padre Garcia.
            </p>
          </div>

          {/* Action Deck */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQrScannerOpen(true)}
              className="h-10 rounded-xl bg-white border-emerald-300 text-emerald-900 font-mono text-xs font-bold hover:bg-emerald-50 hover:border-emerald-400 transition-all shadow-xs gap-2 cursor-pointer"
            >
              <QrCode className="size-4 text-emerald-700" />
              SCAN ANIMAL QR
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSyncTelemetry}
              disabled={isSyncing}
              className="h-10 rounded-xl bg-white border-slate-200 text-slate-700 font-mono text-xs font-bold hover:bg-emerald-50 hover:border-emerald-300 transition-all shadow-xs gap-2 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 text-emerald-700 ${isSyncing ? "animate-spin" : ""}`} />
              REFRESH DATA
            </Button>

            <Link href="/sibat/livestock-registry">
              <Button
                type="button"
                size="sm"
                className="h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-xs font-bold shadow-xs transition-all gap-1.5 cursor-pointer"
              >
                <Users className="size-3.5" />
                ANIMAL LIST
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 2. HOLOGRAPHIC KPI HUD STRIP ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Tile 1: Registered Herds / Batches */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/95 p-4 shadow-holo-card hover:shadow-holo-glow-emerald transition-all duration-300">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>REGISTERED HERDS</span>
            <Layers className="size-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
              {isLoadingBatches ? "--" : kpis.totalBatches}
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
              BATCHES
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1.5">Grouped animal batches</p>
        </div>

        {/* Tile 2: Total Registered Animals */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-white/95 p-4 shadow-holo-card hover:shadow-holo-glow-cyan transition-all duration-300">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>REGISTERED ANIMALS</span>
            <Activity className="size-4 text-cyan-600" />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-900 tracking-tight">
              {isLoadingBatches ? "--" : kpis.totalAnimals}
            </span>
            <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-100 border border-cyan-300 px-2 py-0.5 rounded-md">
              HEADS
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1.5">Animals in barangay</p>
        </div>

        {/* Tile 3: Pending Reviews */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-white/95 p-4 shadow-holo-card hover:shadow-holo-glow-amber transition-all duration-300">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>PENDING REVIEWS</span>
            <Clock
              className={`size-4 ${
                kpis.pendingSubmissions > 0
                  ? "text-amber-600 animate-pulse"
                  : "text-slate-400"
              }`}
            />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                kpis.pendingSubmissions > 0 ? "text-amber-700" : "text-slate-500"
              }`}
            >
              {isLoadingSubmissions ? "--" : kpis.pendingSubmissions}
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                kpis.pendingSubmissions > 0
                  ? "text-amber-800 bg-amber-100 border border-amber-300"
                  : "text-slate-600 bg-slate-100 border border-slate-200"
              }`}
            >
              {kpis.pendingSubmissions > 0 ? "ACTION NEEDED" : "CLEAR"}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1.5">Submissions awaiting review</p>
        </div>

        {/* Tile 4: Health Reports */}
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-white/95 p-4 shadow-holo-card hover:shadow-rose-500/20 transition-all duration-300">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>HEALTH REPORTS</span>
            <ShieldAlert
              className={`size-4 ${
                kpis.activeHealthAlerts > 0
                  ? "text-rose-600 animate-pulse"
                  : "text-slate-400"
              }`}
            />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                kpis.activeHealthAlerts > 0 ? "text-rose-700" : "text-slate-500"
              }`}
            >
              {isLoadingHealth ? "--" : kpis.activeHealthAlerts}
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                kpis.activeHealthAlerts > 0
                  ? "text-rose-800 bg-rose-100 border border-rose-300"
                  : "text-emerald-800 bg-emerald-100 border border-emerald-300"
              }`}
            >
              {kpis.activeHealthAlerts > 0 ? "CHECK NOW" : "HEALTHY"}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1.5">Disease & death cases</p>
        </div>

        {/* Tile 5: Verified by SIBAT */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/95 p-4 shadow-holo-card hover:shadow-holo-glow-emerald transition-all duration-300 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>VERIFIED RATE</span>
            <ShieldCheck className="size-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-800 tracking-tight">
              {isLoadingBatches ? "--" : `${kpis.syncRate}%`}
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
              VERIFIED
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1.5">Passed to MAO review</p>
        </div>
      </div>

      {/* ── 3. SEARCH & CATEGORY FILTER ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white/90 backdrop-blur-xs p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, animal tags, census, herds, or modules (e.g. MOD-01)..."
            className="w-full h-10 pl-10 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { key: "ALL", label: "ALL SERVICES" },
              { key: "VALIDATION", label: "FIELD REVIEWS" },
              { key: "REGISTRIES", label: "LIVESTOCK & HERDS" },
              { key: "BIOSECURITY", label: "HEALTH & ALERTS" },
              { key: "FIELD_OPS", label: "PROGRAMS & MAP" },
            ] as const
          ).map((tab) => {
            const isSelected = selectedCategory === tab.key;
            const count = categoryCounts[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedCategory(tab.key)}
                className={`h-8 px-3 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected
                      ? "bg-emerald-800 text-emerald-100"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. WORKSPACES MATRIX GRID ──────────────────────────────────────── */}
      {filteredModules.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-12 text-center space-y-3">
          <Radar className="size-10 text-slate-400 mx-auto animate-pulse" />
          <h3 className="text-base font-bold text-slate-900 font-mono">
            NO MATCHING SERVICES FOUND
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No monitoring services matched &quot;{searchQuery}&quot; in the &quot;{selectedCategory}&quot; category.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("ALL");
            }}
            className="rounded-xl font-mono text-xs font-bold cursor-pointer"
          >
            RESET FILTERS
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredModules.map((module) => {
            const Icon = module.icon;

            // Dynamic badge text and style
            let badgeText = module.staticBadgeText || "READY";
            let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";

            if (module.badgeType === "pending") {
              if (kpis.pendingSubmissions > 0) {
                badgeText = `${kpis.pendingSubmissions} AWAITING REVIEW`;
                badgeClass = "bg-amber-100 text-amber-900 border-amber-300 animate-pulse";
              } else {
                badgeText = "QUEUE CLEAR";
                badgeClass = "bg-emerald-100 text-emerald-900 border-emerald-300";
              }
            } else if (module.badgeType === "alert") {
              if (kpis.activeHealthAlerts > 0) {
                badgeText = `${kpis.activeHealthAlerts} ACTIVE REPORTS`;
                badgeClass = "bg-rose-100 text-rose-900 border-rose-300 animate-pulse";
              } else {
                badgeText = "NO ALERTS";
                badgeClass = "bg-emerald-100 text-emerald-900 border-emerald-300";
              }
            } else if (module.badgeType === "cohorts") {
              badgeText = `${kpis.totalBatches} BATCHES REGISTERED`;
              badgeClass = "bg-emerald-100 text-emerald-900 border-emerald-300";
            } else if (module.badgeType === "schedules") {
              badgeText = `${schedules?.length || 0} SCHEDULED PROGRAMS`;
              badgeClass = "bg-cyan-100 text-cyan-900 border-cyan-300";
            } else if (module.staticBadgeColor === "emerald") {
              badgeClass = "bg-emerald-100 text-emerald-900 border-emerald-300";
            } else if (module.staticBadgeColor === "cyan") {
              badgeClass = "bg-cyan-100 text-cyan-900 border-cyan-300";
            }

            return (
              <Link
                key={module.id}
                href={module.href}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/80 hover:shadow-holo-card hover:shadow-holo-glow-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                {/* Subtle Hover Gradient Illumination */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-50/0 via-transparent to-teal-50/0 opacity-0 transition-opacity duration-300 group-hover:from-emerald-50/40 group-hover:to-teal-50/30 group-hover:opacity-100" />
                <div className="pointer-events-none absolute right-0 top-0 size-24 bg-radial from-emerald-200/20 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative z-10 space-y-4">
                  {/* Module Header Bar: Code + Category + Dynamic Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-slate-400 group-hover:text-emerald-700 transition-colors">
                        {module.code}
                      </span>
                      <span className="text-slate-300 font-mono text-xs">//</span>
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {module.categoryLabel}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border shadow-2xs ${badgeClass}`}
                    >
                      {badgeText}
                    </span>
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start gap-3.5 pt-1">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-800 border border-emerald-200/80 shadow-xs transition-transform duration-300 group-hover:scale-105 group-hover:border-emerald-400">
                      <Icon className="size-5.5 text-emerald-800" />
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-slate-900 group-hover:text-emerald-900 transition-colors leading-snug">
                        {module.title}
                      </h2>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {module.description}
                      </p>
                    </div>
                  </div>

                  {/* Capability Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {module.capabilityTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-600 border border-slate-200/70 group-hover:border-emerald-200 group-hover:bg-emerald-50/40 group-hover:text-emerald-900 transition-colors"
                      >
                        <Sparkles className="size-2 text-emerald-600" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Action Launchpad Footer */}
                <div className="relative z-10 mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-mono font-bold text-slate-500 group-hover:text-emerald-800 transition-colors">
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-slate-300 group-hover:bg-emerald-500 transition-colors" />
                    {module.primaryAction}
                  </span>
                  <ArrowRight className="size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1.5 group-hover:text-emerald-700" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── 5. MUNICIPAL POLICY & PROTOCOL ADVISORY DECK ───────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 p-5 sm:p-6 text-white shadow-md">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xs">
              <ShieldCheck className="size-5" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  BARANGAY FIELD GUIDELINES // SIBAT & CBAT ROLE
                </span>
                <span className="hidden sm:inline-block size-1 rounded-full bg-slate-400" />
                <span className="hidden sm:inline-block font-mono text-[11px] text-slate-400">
                  PADRE GARCIA MUNICIPAL AGRICULTURE OFFICE
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                SIBAT and CBAT field officers perform on-site inspections, ear tag number verification,
                and quarterly census counts in their assigned barangay. Official approval of registrations,
                sales, and official certificates will be finalized by the Municipal Agriculture Office (MAO).
              </p>
            </div>
          </div>

          <div className="shrink-0 font-mono text-right text-[11px] text-emerald-300/80 border-t md:border-t-0 md:border-l border-emerald-800/60 pt-3 md:pt-0 md:pl-5">
            <div className="flex items-center gap-1.5 justify-start md:justify-end text-emerald-400 font-bold">
              <span className="relative flex size-2">
                <span className="relative inline-flex rounded-full size-2 bg-emerald-400" />
              </span>
              SYSTEM CONNECTED
            </div>
            <div className="text-slate-400 mt-0.5">PADRE GARCIA AGRI-NODE</div>
          </div>
        </div>
      </div>

      {/* ── 6. UNIVERSAL QR SCANNER DIALOG ─────────────────────────────────── */}
      <UniversalQrScannerDialog
        isOpen={isQrScannerOpen}
        onOpenChange={setIsQrScannerOpen}
        role="sibat"
      />
    </div>
  );
}
