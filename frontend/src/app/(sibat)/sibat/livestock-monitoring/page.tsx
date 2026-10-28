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
  Cpu,
  ExternalLink,
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
  telemetryTags: string[];
  primaryAction: string;
  badgeType: "pending" | "alert" | "cohorts" | "schedules" | "static";
  staticBadgeText?: string;
  staticBadgeColor?: "emerald" | "cyan" | "slate" | "amber";
}

// ── Workspace Matrix Definition ─────────────────────────────────────────────

const WORKSPACE_MODULES: WorkspaceModule[] = [
  {
    id: "field-overview",
    code: "MOD-01",
    category: "VALIDATION",
    categoryLabel: "FIELD AUDIT",
    title: "Field Validation & Review Queue",
    description:
      "Review incoming farmer livestock registrations, post-approval animal additions, and weight updates. Perform on-site inspection and forward verified records for MAO review.",
    href: "/sibat",
    icon: ClipboardCheck,
    telemetryTags: ["RFID Inspection", "Physical Audit", "Photo Verification"],
    primaryAction: "OPEN AUDIT QUEUE",
    badgeType: "pending",
  },
  {
    id: "livestock-registry",
    code: "MOD-02",
    category: "REGISTRIES",
    categoryLabel: "SECTOR REGISTRY",
    title: "Farmers & Registered Animals",
    description:
      "Search registered farmers, physical RFID ear tags, breed pedigrees, and biometric profiles strictly scoped within your assigned barangay jurisdiction.",
    href: "/sibat/livestock-registry",
    icon: Users,
    telemetryTags: ["RFID Ledger", "Owner Profiles", "Biometric Passports"],
    primaryAction: "SEARCH REGISTRY",
    badgeType: "static",
    staticBadgeText: "SECTOR DIRECTORY",
    staticBadgeColor: "cyan",
  },
  {
    id: "batches",
    code: "MOD-03",
    category: "REGISTRIES",
    categoryLabel: "HERD COHORTS",
    title: "Herd Cohort Operations Matrix",
    description:
      "Continuous surveillance of registered livestock herds, aggregate cohort telemetry, feeding records, target weight milestones, and bulk batch verification ledgers.",
    href: "/sibat/batches",
    icon: Layers,
    telemetryTags: ["Cohort Telemetry", "Target Weights", "Pen Management"],
    primaryAction: "INSPECT HERDS",
    badgeType: "cohorts",
  },
  {
    id: "census-submit",
    code: "MOD-04",
    category: "VALIDATION",
    categoryLabel: "CENSUS SURVEY",
    title: "Quarterly Census Headcount Audit",
    description:
      "Conduct on-site headcount enumerations across sector households and submit verified livestock counts through the official municipal census pipeline.",
    href: "/sibat/census/submit",
    icon: FileSpreadsheet,
    telemetryTags: ["Enumeration", "Household Tally", "Species Matrix"],
    primaryAction: "SUBMIT CENSUS",
    badgeType: "static",
    staticBadgeText: "QUARTERLY AUDIT",
    staticBadgeColor: "emerald",
  },
  {
    id: "census-history",
    code: "MOD-05",
    category: "VALIDATION",
    categoryLabel: "AUDIT TRAIL",
    title: "Census Submissions & Corrections",
    description:
      "Inspect historical census filings, monitor MAO approval decisions, and rapidly resolve census survey records returned with field revision notices.",
    href: "/sibat/census-submissions",
    icon: History,
    telemetryTags: ["MAO Ratification", "Revision Protocol", "Survey Ledgers"],
    primaryAction: "VIEW CENSUS LOGS",
    badgeType: "static",
    staticBadgeText: "SURVEY ARCHIVE",
    staticBadgeColor: "slate",
  },
  {
    id: "health-alerts",
    code: "MOD-06",
    category: "BIOSECURITY",
    categoryLabel: "BIOSECURITY",
    title: "Clinical Health & Alert Follow-Up",
    description:
      "Investigate farmer-reported disease symptoms and mortality occurrences. Record biosecurity actions, confirm physical ear tags, and submit clinical findings.",
    href: "/sibat-alerts",
    icon: ShieldAlert,
    telemetryTags: ["Symptom Audit", "Mortality Reports", "Quarantine Protocol"],
    primaryAction: "BIOSECURITY RADAR",
    badgeType: "alert",
  },
  {
    id: "production-records",
    code: "MOD-07",
    category: "REGISTRIES",
    categoryLabel: "COMMERCE & YIELD",
    title: "Yield, Offspring & Sales Ledger",
    description:
      "Review farmer-reported commercial animal sales, calving offspring births, and direct agricultural yields (meat, eggs, wool) without abattoir slaughter dependency.",
    href: "/sibat/production-records",
    icon: TrendingUp,
    telemetryTags: ["Live Sales", "Calving Telemetry", "Farmgate Yields"],
    primaryAction: "INSPECT COMMERCE",
    badgeType: "static",
    staticBadgeText: "COMMERCE LEDGER",
    staticBadgeColor: "emerald",
  },
  {
    id: "field-schedules",
    code: "MOD-08",
    category: "FIELD_OPS",
    categoryLabel: "FIELD LOGISTICS",
    title: "Field Programs & Veterinary Calendar",
    description:
      "Synchronize with municipal agricultural initiatives, scheduled vaccination drives, deworming operations, and community farmer assistance programs.",
    href: "/sibat-scheduling",
    icon: CalendarDays,
    telemetryTags: ["Vaccination Drives", "Deworming Ops", "Farmer Seminars"],
    primaryAction: "FIELD CALENDAR",
    badgeType: "schedules",
  },
  {
    id: "gis-radar",
    code: "MOD-09",
    category: "FIELD_OPS",
    categoryLabel: "GIS RADAR",
    title: "GIS Sector Monitoring & Movement Map",
    description:
      "Interactive geospatial radar visualizing farm coordinates, transport clearances, Padre Garcia checkpoint inspections, and sector quarantine boundaries.",
    href: "/sibat-monitoring",
    icon: Compass,
    telemetryTags: ["Vector Tracking", "Padre Garcia Checkpoints", "Spatial Density"],
    primaryAction: "LAUNCH GIS RADAR",
    badgeType: "static",
    staticBadgeText: "LIVE 2D RADAR",
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
      toast.success("Sector telemetry synchronized", {
        description: "All cohort states, audit queues, and clinical alerts are up to date.",
      });
    } catch {
      toast.error("Failed to sync telemetry", {
        description: "Please check your network connection and retry.",
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
        m.telemetryTags.some((tag) => tag.toLowerCase().includes(q));

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
      ? "ALL BARANGAYS (MUNICIPAL MATRIX)"
      : user?.assignedBarangayName || "PADRE GARCIA SECTOR";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8 pb-28">
      {/* ── 1. FUTURISTIC CYBERNETIC COMMAND CENTER HEADER ─────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-6 sm:p-8 text-slate-900 shadow-sm">
        {/* Holographic Blurred Glow Orbs */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 size-80 rounded-full bg-teal-200/30 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            {/* Live Node Telemetry Breadcrumb */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase tracking-wider font-bold shadow-xs">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
                </span>
                LIVE NODE // SIBAT-CBAT
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-700 font-semibold flex items-center gap-1">
                <Compass className="size-3.5 text-emerald-700" />
                SECTOR: {assignedSector}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-emerald-800 font-bold flex items-center gap-1">
                <Zap className="size-3 text-emerald-700" />
                TELEMETRY v4.2
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight font-sans text-slate-900 flex items-center gap-3">
                Barangay Livestock Telemetry Matrix
              </h1>
              <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-xs font-bold px-2.5 py-0.5">
                CORE HUB
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
              Unified command interface for field validation, RFID cohort surveillance,
              quarterly headcount census, and biosecurity tracking across Padre Garcia livestock raisers.
            </p>
          </div>

          {/* Futuristic Control Deck */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQrScannerOpen(true)}
              className="h-10 rounded-xl bg-white border-emerald-300 text-emerald-900 font-mono text-xs font-bold hover:bg-emerald-50 hover:border-emerald-400 transition-all shadow-xs gap-2 cursor-pointer"
            >
              <QrCode className="size-4 text-emerald-700" />
              QUICK RFID SCANNER
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
              SYNC TELEMETRY
            </Button>

            <Link href="/sibat/livestock-registry">
              <Button
                type="button"
                size="sm"
                className="h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-xs font-bold shadow-xs transition-all gap-1.5 cursor-pointer"
              >
                <Users className="size-3.5" />
                SECTOR REGISTRY
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── 2. HOLOGRAPHIC TELEMETRY KPI HUD STRIP ─────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Tile 1: Registered Cohorts */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/95 p-4 shadow-holo-card hover:shadow-holo-glow-emerald transition-all duration-300">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>REGISTERED COHORTS</span>
            <Layers className="size-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
              {isLoadingBatches ? "--" : kpis.totalBatches}
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
              ACTIVE
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1.5">Grouped herd matrix</p>
        </div>

        {/* Tile 2: Biomass Heads */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-white/95 p-4 shadow-holo-card hover:shadow-holo-glow-cyan transition-all duration-300">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>BIOMASS TELEMETRY</span>
            <Cpu className="size-4 text-cyan-600" />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-900 tracking-tight">
              {isLoadingBatches ? "--" : kpis.totalAnimals}
            </span>
            <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-100 border border-cyan-300 px-2 py-0.5 rounded-md">
              HEADS
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1.5">Sector animal tags</p>
        </div>

        {/* Tile 3: Pending Field Audits */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-white/95 p-4 shadow-holo-card hover:shadow-holo-glow-amber transition-all duration-300">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>PENDING AUDITS</span>
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
              {kpis.pendingSubmissions > 0 ? "ACTION REQ" : "CLEAR"}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1.5">Farmer review queue</p>
        </div>

        {/* Tile 4: Biosecurity Alerts */}
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-white/95 p-4 shadow-holo-card hover:shadow-rose-500/20 transition-all duration-300">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>HEALTH SURVEILLANCE</span>
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
              {kpis.activeHealthAlerts > 0 ? "INVESTIGATE" : "STABLE"}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1.5">Disease & mortality</p>
        </div>

        {/* Tile 5: Field Verification Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-white/95 p-4 shadow-holo-card hover:shadow-holo-glow-emerald transition-all duration-300 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>VERIFICATION SYNC</span>
            <ShieldCheck className="size-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-800 tracking-tight">
              {isLoadingBatches ? "--" : `${kpis.syncRate}%`}
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
              MAO SYNC
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 mt-1.5">Sector progress rate</p>
        </div>
      </div>

      {/* ── 3. SEARCH & INTERACTIVE CATEGORY FILTER DECK ───────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white/90 backdrop-blur-xs p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Search Bar with Monospace Accent */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search operations matrix, keywords, or codes (e.g. MOD-01, census, herds)..."
            className="w-full h-10 pl-10 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { key: "ALL", label: "ALL MODULES" },
              { key: "VALIDATION", label: "VALIDATION" },
              { key: "REGISTRIES", label: "REGISTRIES" },
              { key: "BIOSECURITY", label: "BIOSECURITY" },
              { key: "FIELD_OPS", label: "FIELD OPS & GIS" },
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

      {/* ── 4. FUTURISTIC WORKSPACES MATRIX GRID ───────────────────────────── */}
      {filteredModules.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-12 text-center space-y-3">
          <Radar className="size-10 text-slate-400 mx-auto animate-pulse" />
          <h3 className="text-base font-bold text-slate-900 font-mono">
            NO MATCHING TELEMETRY MODULES FOUND
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No operational modules matched your search query &quot;{searchQuery}&quot; in the &quot;{selectedCategory}&quot; category.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("ALL");
            }}
            className="rounded-xl font-mono text-xs font-bold"
          >
            RESET MATRIX FILTERS
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredModules.map((module) => {
            const Icon = module.icon;

            // Dynamic badge text and style
            let badgeText = module.staticBadgeText || "ONLINE";
            let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";

            if (module.badgeType === "pending") {
              if (kpis.pendingSubmissions > 0) {
                badgeText = `${kpis.pendingSubmissions} PENDING REVIEW`;
                badgeClass = "bg-amber-100 text-amber-900 border-amber-300 animate-pulse";
              } else {
                badgeText = "QUEUE CLEAR";
                badgeClass = "bg-emerald-100 text-emerald-900 border-emerald-300";
              }
            } else if (module.badgeType === "alert") {
              if (kpis.activeHealthAlerts > 0) {
                badgeText = `${kpis.activeHealthAlerts} ACTIVE ALERTS`;
                badgeClass = "bg-rose-100 text-rose-900 border-rose-300 animate-pulse";
              } else {
                badgeText = "SURVEILLANCE CLEAR";
                badgeClass = "bg-emerald-100 text-emerald-900 border-emerald-300";
              }
            } else if (module.badgeType === "cohorts") {
              badgeText = `${kpis.totalBatches} COHORTS ENROLLED`;
              badgeClass = "bg-emerald-100 text-emerald-900 border-emerald-300";
            } else if (module.badgeType === "schedules") {
              badgeText = `${schedules?.length || 0} PROGRAM SCHEDULES`;
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

                  {/* Telemetry Feature Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {module.telemetryTags.map((tag) => (
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
                  MUNICIPAL FIELD PROTOCOL // JURISDICTION NOTICE
                </span>
                <span className="hidden sm:inline-block size-1 rounded-full bg-slate-400" />
                <span className="hidden sm:inline-block font-mono text-[11px] text-slate-400">
                  PADRE GARCIA MAO DIRECTIVE
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                SIBAT and CBAT field officers perform frontline registration verification,
                physical RFID ear-tagging confirmation, and quarterly census audits. All official
                ownership mutations and final registry updates require municipal review and MAO ratification.
              </p>
            </div>
          </div>

          <div className="shrink-0 font-mono text-right text-[11px] text-emerald-300/80 border-t md:border-t-0 md:border-l border-emerald-800/60 pt-3 md:pt-0 md:pl-5">
            <div className="flex items-center gap-1.5 justify-start md:justify-end text-emerald-400 font-bold">
              <span className="relative flex size-2">
                <span className="relative inline-flex rounded-full size-2 bg-emerald-400" />
              </span>
              ENCRYPTION ACTIVE
            </div>
            <div className="text-slate-400 mt-0.5">SHA-256 AGRI-LEDGER PROTOCOL</div>
          </div>
        </div>
      </div>

      {/* ── 6. UNIVERSAL QR / RFID SCANNER DIALOG ──────────────────────────── */}
      <UniversalQrScannerDialog
        isOpen={isQrScannerOpen}
        onOpenChange={setIsQrScannerOpen}
        role="sibat"
      />
    </div>
  );
}
