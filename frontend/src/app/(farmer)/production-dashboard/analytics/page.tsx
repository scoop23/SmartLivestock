"use client";

import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/axios";
import { formatCalendarDate } from "@/lib/livestock-age";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Beef,
  Calendar,
  CheckCircle2,
  Clock,
  CloudSun,
  Dna,
  DollarSign,
  Egg,
  HeartHandshake,
  Layers,
  LineChart as LineChartIcon,
  Milk,
  Package,
  PhilippinePeso,
  RefreshCw,
  RotateCcw,
  Scale,
  Sparkles,
  Tag,
  TrendingUp,
  Users,
  Wheat,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useUserInventory } from "../../livestock-inventory/livestock-inventory";
import ProductionCharts from "../production-charts";
import {
  EMPTY_TYPE_ANALYTICS,
  PRODUCTION_TYPE_LABELS,
  PRODUCTION_TYPE_UNITS,
  computeProductionAnalytics,
  fetchProductionRecords,
  formatPeso,
  formatQty,
  type ProductionType,
} from "../production-analytics";
import { getProductionTypesForLivestock } from "../production-wizard";

const TYPE_ICON = {
  milk: Milk,
  meat: Beef,
  eggs: Egg,
  wool: Package,
} satisfies Record<ProductionType, typeof Milk>;

interface BreedingAnalytics {
  total_records: number;
  active_gestations: number;
  due_soon: number;
  calved_count: number;
  open_count: number;
  conception_rate_pct: number | null;
  by_type: {
    artificial_insemination: number;
    natural_service: number;
    embryo_transfer: number;
  };
}

interface BreedingItem {
  id: number;
  dam: number;
  dam_tag?: string;
  breeding_date: string;
  breeding_type: string;
  sire_tag_or_code: string;
  technician_or_inseminator: string;
  expected_due_date?: string;
  days_until_due?: number | null;
  gestation_progress_pct?: number;
  status: string;
  notes: string;
}

interface FeedingAnalytics {
  total_feed_kg: number;
  total_cost_php: number;
  current_month_feed_kg: number;
  current_month_cost_php: number;
  by_feed_type: Record<
    string,
    {
      label: string;
      quantity_kg: number;
      cost_php: number;
      logs_count: number;
    }
  >;
  daily_trend: Array<{
    date: string;
    quantity_kg: number;
    cost_php: number;
  }>;
}

interface MilkForecastResponse {
  status: "READY" | "NOT_READY";
  data_source: "approved_livestock_records" | "synthetic_demo";
  demonstration_available?: boolean;
  livestock: {
    id: number;
    tag_number: string;
    livestock_type: string;
    breed: string | null;
    sex: string | null;
    age_years: number | null;
    days_since_calving: number | null;
  };
  observation_count: number;
  observation_unit?: string;
  missing_calendar_intervals?: number;
  missing_calendar_days?: number;
  missing_calendar_dates?: string[];
  missing_calendar_dates_truncated?: boolean;
  minimum_history_required: number;
  horizon_days: number;
  history: Array<{ date: string; milk_liters: number }>;
  forecast: Array<{ date: string; expected_liters: number }>;
  selected_model?: string;
  baseline_model?: string;
  features_used: string[];
  reason?: string;
  limitations: string;
  evaluation: null | {
    methodology: string;
    train_samples: number;
    test_samples: number;
    results: Array<{ name: string; mae: number; rmse: number; r2: number | null }>;
  };
  weather: {
    provider: string;
    location_source: string;
    location_name?: string | null;
    available: boolean;
    used_in_forecast: boolean;
    message: string | null;
    timeline?: Array<{
      date: string;
      temperature_c: number | null;
      humidity_pct: number | null;
      precipitation_mm: number | null;
    }>;
  };
}

function calculateThi(temperatureC: number | null | undefined, humidity: number | null | undefined) {
  if (temperatureC == null || humidity == null) return null;
  const temperatureF = (temperatureC * 9) / 5 + 32;
  return temperatureF - (0.55 - 0.0055 * humidity) * (temperatureF - 58);
}

function thiColor(thi: number | null) {
  if (thi == null) return "#cbd5e1";
  if (thi < 60) return "#3b82f6";
  if (thi < 68) return "#22c55e";
  if (thi < 72) return "#eab308";
  if (thi < 80) return "#f97316";
  return "#ef4444";
}

const FEED_TYPE_LABELS: Record<string, string> = {
  FORAGE: "Fresh Forage & Grass",
  SILAGE_HAY: "Silage & Hay",
  CONCENTRATE: "Concentrate & Mash",
  BYPRODUCTS: "Agricultural Byproducts",
  MINERALS: "Minerals & Supplements",
};

export default function ProductionAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<"yields" | "breeding" | "feeding" | "forecasts">("yields");
  const [clockString, setClockString] = useState<string>("");

  // Live Manila PHT clock (identical to /farmer)
  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const updateTime = () => setClockString(`${formatter.format(new Date())} PHT`);
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 1. Fetch user inventory to dynamically filter eligible production types
  const { data: inventories = [], isLoading: isInventoryLoading } = useUserInventory();

  const ownedSpecies = useMemo(
    () => Array.from(new Set(inventories.map((i) => i.livestockTypeName?.trim()).filter(Boolean) as string[])),
    [inventories]
  );

  // Strictly remove eggs and wool unless existing livestock can produce them!
  const eligibleProductionTypes = useMemo(() => {
    const types: ProductionType[] = [];
    const allTypes: ProductionType[] = ["milk", "meat", "eggs", "wool"];

    for (const pType of allTypes) {
      const eligibleOwned = ownedSpecies.filter((name) =>
        getProductionTypesForLivestock(name).includes(pType)
      );

      // Eggs and wool are ONLY added if there is existing eligible livestock
      if (["eggs", "wool"].includes(pType)) {
        if (eligibleOwned.length > 0) {
          types.push(pType);
        }
      } else {
        if (eligibleOwned.length > 0 || ownedSpecies.length === 0) {
          types.push(pType);
        }
      }
    }
    return types.length > 0 ? types : (["milk", "meat"] as ProductionType[]);
  }, [ownedSpecies]);

  const [activeType, setActiveType] = useState<ProductionType>(eligibleProductionTypes[0] || "milk");

  useEffect(() => {
    if (!eligibleProductionTypes.includes(activeType)) {
      setActiveType(eligibleProductionTypes[0] || "milk");
    }
  }, [eligibleProductionTypes, activeType]);

  // 2. Fetch Production Records
  const {
    data: records = [],
    isLoading: isRecordsLoading,
    isError: isRecordsError,
    refetch: refetchRecords,
    isFetching: isRecordsFetching,
  } = useQuery({
    queryKey: ["production_records"],
    queryFn: fetchProductionRecords,
  });

  // 3. Fetch Breeding Analytics & Records
  const {
    data: breedingAnalytics,
    isLoading: isBreedingLoading,
    refetch: refetchBreeding,
  } = useQuery<BreedingAnalytics>({
    queryKey: ["breeding_analytics"],
    queryFn: async () => (await api.get("production/breeding/analytics/")).data,
  });

  const { data: breedingRecords = [] } = useQuery<BreedingItem[]>({
    queryKey: ["breeding_records"],
    queryFn: async () => (await api.get("production/breeding/")).data,
  });

  // 4. Fetch Feeding Analytics
  const {
    data: feedingAnalytics,
    isLoading: isFeedingLoading,
    refetch: refetchFeeding,
  } = useQuery<FeedingAnalytics>({
    queryKey: ["feeding_analytics"],
    queryFn: async () => (await api.get("production/feedings/analytics/")).data,
  });

  // 5. Fetch Weight Records
  const { data: weightRecords = [], refetch: refetchWeights } = useQuery<Array<{
    id: number;
    livestock: number;
    weight: string | number;
    weighing_date: string;
  }>>({
    queryKey: ["production_weights"],
    queryFn: async () => (await api.get("production/weights/")).data,
  });

  // 6. Fetch Calving & Offspring Records
  const { data: calvingRecords = [], refetch: refetchCalving } = useQuery<Array<{
    id: number;
    calving_date: string;
    calf_sex: string;
    birth_weight?: string | number | null;
  }>>({
    queryKey: ["calving_records"],
    queryFn: async () => (await api.get("production/calving/")).data,
  });

  // Computed Production Metrics
  const analytics = useMemo(() => computeProductionAnalytics(records), [records]);
  const summaries = eligibleProductionTypes.map((type) => ({
    type,
    summary: analytics.by_type[type]?.summary,
  }));

  const totalCount = records.length;
  const completedCount = records.filter((r) => ["RECORDED", "APPROVED"].includes(r.status)).length;
  const pendingCount = records.filter((r) => ["PENDING", "VERIFIED"].includes(r.status)).length;
  const revisionCount = records.filter((r) => r.status === "SUBJECT_TO_REVISION").length;

  // Real indicative benchmark valuation
  const BENCHMARK_RATES: Record<string, number> = {
    milk: 50,
    meat: 280,
    eggs: 8,
    wool: 150,
  };

  const totalEstimatedValue = useMemo(() => {
    return records.reduce((sum, r) => {
      if (r.valuationSnapshot?.estimated_value) {
        return sum + Number(r.valuationSnapshot.estimated_value);
      }
      const rate = BENCHMARK_RATES[r.productionType] || 0;
      return sum + (Number(r.quantity) || 0) * rate;
    }, 0);
  }, [records]);

  const currentAnalytics = analytics.by_type[activeType] ?? EMPTY_TYPE_ANALYTICS;

  // Predictive Forecasting Metrics from Real Livestock & Output Data
  const activeAnimals = useMemo(
    () => inventories.filter((i) => (i.operationalStatus || "ACTIVE") === "ACTIVE"),
    [inventories]
  );
  const activeHerdCount = activeAnimals.length;

  // Actual total live weight and carcass yield
  const totalLiveWeightKg = useMemo(() => {
    return activeAnimals.reduce((acc, animal) => {
      const w = animal.weight ? Number(animal.weight) : 0;
      return acc + w;
    }, 0);
  }, [activeAnimals]);

  const projectedCarcassKg = useMemo(() => {
    return Math.round(activeAnimals.reduce((acc, animal) => {
      const s = (animal.livestockTypeName || "").toLowerCase();
      const dressingPct = s.includes("swine") || s.includes("pig") ? 0.74 : (s.includes("goat") || s.includes("sheep") ? 0.60 : 0.58);
      const w = animal.weight ? Number(animal.weight) : (s.includes("swine") ? 85 : 320);
      return acc + (w * dressingPct);
    }, 0) * 10) / 10;
  }, [activeAnimals]);

  const projectedCarcassRevenue = Math.round(projectedCarcassKg * 280);

  // Milk yield forecasting
  const milkRecords = records.filter((r) => r.productionType === "milk");
  const totalMilkRecent = milkRecords.reduce((acc, r) => acc + Number(r.quantity), 0);
  const femaleCattleCount = activeAnimals.filter(
    (i) =>
      (i.sex?.toUpperCase().startsWith("F") || !i.sex) &&
      (i.livestockTypeName?.toLowerCase().includes("cattle") || i.livestockTypeName?.toLowerCase().includes("carabao"))
  ).length;

  // Real milk run-rate from actual approved production records
  const avgDailyMilk = milkRecords.length > 0
    ? totalMilkRecent / Math.max(milkRecords.length, 1)
    : 0;

  const forecast30DaysMilk = Math.round(avgDailyMilk * 30);
  const forecast90DaysMilk = Math.round(avgDailyMilk * 90);
  const forecast30DaysRevenue = Math.round(forecast30DaysMilk * 50);
  const forecast90DaysRevenue = Math.round(forecast90DaysMilk * 50);

  // Active Gestations list
  const activePregnantList = useMemo(() => {
    return breedingRecords
      .filter((b) => b.status === "PREGNANT" || b.status === "PENDING_CHECK")
      .slice(0, 6);
  }, [breedingRecords]);

  // Eligible dairy animals for individual predictive ML forecasting
  const eligibleDairyCows = useMemo(() => {
    return inventories.filter((animal) => {
      const type = (animal.livestockTypeName || "").toLowerCase();
      const isBovine =
        type.includes("cattle") ||
        type.includes("cow") ||
        type.includes("carabao") ||
        type.includes("buffalo");
      const isFemale = (animal.sex || "").toUpperCase().startsWith("F");
      const isIndividual = animal.entryType === "INDIVIDUAL";
      const isApproved = animal.status === "APPROVED";
      const isActive = animal.operationalStatus === "ACTIVE";
      return isBovine && isFemale && isIndividual && isApproved && isActive;
    });
  }, [inventories]);

  const [selectedCowId, setSelectedCowId] = useState<number | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (!selectedCowId && eligibleDairyCows.length > 0) {
      setSelectedCowId(Number(eligibleDairyCows[0].id));
    }
  }, [eligibleDairyCows, selectedCowId]);

  // Real Machine Learning Out-of-Sample Milk Forecast Query
  const {
    data: milkForecast,
    isLoading: isForecastLoading,
    refetch: refetchMilkForecast,
  } = useQuery({
    queryKey: [
      "livestock-milk-forecast",
      selectedCowId,
      showDemo ? "synthetic_demo" : "approved_livestock_records",
    ],
    queryFn: async () => {
      if (!selectedCowId) return null;
      const res = await api.get<MilkForecastResponse>(
        `analytics/livestock/${selectedCowId}/milk-forecast/`,
        {
          timeout: 60_000,
          params: showDemo ? { source: "synthetic_demo" } : undefined,
        }
      );
      return res.data;
    },
    enabled: !!selectedCowId,
    retry: false,
  });

  // Calculate live 30-day forecast based on real ML output if ready
  const avgForecastDaily = useMemo(() => {
    if (
      milkForecast?.status === "READY" &&
      milkForecast.forecast &&
      milkForecast.forecast.length > 0
    ) {
      const sum = milkForecast.forecast.reduce((acc, f) => acc + f.expected_liters, 0);
      return sum / milkForecast.forecast.length;
    }
    return avgDailyMilk;
  }, [milkForecast, avgDailyMilk]);

  const liveForecast30DaysMilk = Math.round(avgForecastDaily * 30);
  const liveForecast30DaysRevenue = Math.round(liveForecast30DaysMilk * 50);

  // 6-Month Trajectory grounded in Real Biological Events (Calving Schedules & Feeding Growth)
  const forecastData = useMemo(() => {
    const months = ["Current", "M +1", "M +2", "M +3", "M +4", "M +5", "M +6"];
    const now = new Date();

    return months.map((m, idx) => {
      // 1. Biological Calvings due by this month
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() + idx, 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + idx + 1, 1);

      const newlyCalvedDamsInMonth = breedingRecords.filter((b) => {
        if (!b.expected_due_date || b.status === "CALVED" || b.status === "FAILED") return false;
        const dueDate = new Date(b.expected_due_date);
        return dueDate >= targetMonthDate && dueDate < nextMonthDate;
      }).length;

      const cumulativeNewCalves = breedingRecords.filter((b) => {
        if (!b.expected_due_date || b.status === "FAILED") return false;
        const dueDate = new Date(b.expected_due_date);
        return dueDate < nextMonthDate && dueDate >= now;
      }).length;

      // 2. Milk yield:
      // Real daily baseline from approved records or selected ML model
      let dailyLiters = avgForecastDaily || avgDailyMilk;

      // When a pregnant dam delivers in month idx, early lactation adds ~12 L/day
      if (newlyCalvedDamsInMonth > 0) {
        dailyLiters += newlyCalvedDamsInMonth * 12;
      }

      // If the farm has 0 milk records and 0 calving events due, milk yield is 0 L
      const monthlyMilkYield = Math.round(dailyLiters * 30);
      const monthlyMilkRevenue = Math.round(monthlyMilkYield * 50);

      // 3. Meat yield with biological average daily gain (ADG: ~0.6 kg/day finishing gain)
      const finishReadyAnimals = activeAnimals.filter((a) => {
        const s = (a.livestockTypeName || "").toLowerCase();
        const minW = s.includes("swine") ? 80 : (s.includes("goat") ? 25 : 260);
        const currentW = a.weight ? Number(a.weight) : 0;
        const projectedW = currentW + (0.6 * 30 * idx);
        return projectedW >= minW;
      });

      const projectedMonthlyMeatKg = Math.round(
        finishReadyAnimals.reduce((acc, a) => {
          const s = (a.livestockTypeName || "").toLowerCase();
          const dressing = s.includes("swine") ? 0.74 : (s.includes("goat") ? 0.60 : 0.58);
          const currentW = a.weight ? Number(a.weight) : (s.includes("swine") ? 85 : 300);
          const projectedW = currentW + (0.6 * 30 * idx);
          return acc + (projectedW * dressing / 6);
        }, 0)
      );

      return {
        month: m,
        projectedYield: monthlyMilkYield,
        projectedRevenue: monthlyMilkRevenue,
        projectedMeatKg: projectedMonthlyMeatKg > 0 ? projectedMonthlyMeatKg : Math.round(projectedCarcassKg / 6),
        projectedHerd: activeHerdCount + cumulativeNewCalves,
      };
    });
  }, [
    avgForecastDaily,
    avgDailyMilk,
    breedingRecords,
    activeAnimals,
    activeHerdCount,
    projectedCarcassKg,
  ]);

  // Chart data for ML forecast
  const mlChartData = useMemo(() => {
    if (!milkForecast) return [];
    const weatherByDate = new Map(
      (milkForecast.weather?.timeline || []).map((point) => [point.date, point])
    );
    return [
      ...(milkForecast.history || []).map((point) => ({
        date: point.date,
        historical: point.milk_liters,
        expected: null as number | null,
      })),
      ...(milkForecast.forecast || []).map((point) => ({
        date: point.date,
        historical: null as number | null,
        expected: point.expected_liters,
      })),
    ].map((point) => {
      const weather = weatherByDate.get(point.date);
      const thi = calculateThi(weather?.temperature_c, weather?.humidity_pct);
      return {
        ...point,
        temperature_c: weather?.temperature_c ?? null,
        humidity_pct: weather?.humidity_pct ?? null,
        precipitation_mm: weather?.precipitation_mm ?? null,
        thi,
        weatherBand: thi == null ? null : 100,
      };
    });
  }, [milkForecast]);

  const hasWeatherOverlay = mlChartData.some((point) => point.thi != null);

  const handleRefreshAll = () => {
    refetchRecords();
    refetchBreeding();
    refetchFeeding();
    refetchWeights();
    refetchCalving();
    if (selectedCowId) refetchMilkForecast();
  };

  return (
    <>
      {/* ── STANDARD LIGHT PAGE HEADER (IDENTICAL TO /farmer) ─────────────── */}
      <PageHeader
        title="Production Analytics & Predictions"
        subtitle="Explore your farm’s recorded output, breeding countdowns, feeding rations, and predictive forecasting."
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-xl bg-white/15 border-white/20 text-white hover:bg-white/25 hover:text-white text-xs font-bold cursor-pointer"
            >
              <Link href="/production-dashboard">
                <ArrowLeft className="mr-1.5 size-4" />
                <span>Activities</span>
              </Link>
            </Button>
            <Button
              asChild
              className="h-11 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 text-xs font-bold shadow-xs cursor-pointer"
            >
              <Link href="/production-dashboard/history">
                <span>History</span>
                <ArrowUpRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefreshAll}
              className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
              title="Refresh Analytics"
            >
              <RefreshCw className={`size-4.5 ${isRecordsFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {/* ── LIGHT FUTURISTIC CLOCK STRIP (IDENTICAL TO /farmer) ─────────────── */}
      <div className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 py-2 sm:px-6 md:px-8">
        <div className="w-full flex items-center justify-between gap-3 font-mono text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-700 uppercase tracking-wider font-mono text-[10px]">
              Live Farm Intelligence Engine
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700">
            <Clock className="size-3.5 text-slate-400" />
            <span className="tabular-nums font-bold">
              {clockString || "Loading Manila time…"}
            </span>
          </div>
        </div>
      </div>

      {/* ── LIGHT AMBIENT MATRIX VIEWPORT (IDENTICAL TO /farmer) ─────────────── */}
      <div className="nexus-ambient-bg min-h-screen">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* ── DOMAIN SELECTION TABS (FUTURISTIC LIGHT CAROUSEL) ───────────── */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/90 pb-3">
            {[
              { id: "yields", label: "Daily Output Yields", icon: Milk },
              { id: "breeding", label: "Breeding & Gestation Predictions", icon: HeartHandshake },
              { id: "feeding", label: "Feeding & Nutrition Analytics", icon: Wheat },
              { id: "forecasts", label: "Predictive Projections (AI)", icon: LineChartIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-2xs cursor-pointer ${
                    isActive
                      ? "bg-emerald-800 text-white shadow-emerald-950/20"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/90"
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ── DYNAMIC 4 KPIS PER ACTIVE TAB ──────────────────────────────── */}
          <section aria-label="Farm performance metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeTab === "yields" && (
              <>
                <KpiCard
                  title="Production Output"
                  variant="emerald"
                  icon={<Milk className="size-5" />}
                  badge={`${completedCount} APPROVED • ${pendingCount} PENDING`}
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 tracking-wider"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {completedCount.toLocaleString()}
                      </span>
                      <span className="text-xs font-mono text-emerald-700 font-bold">Approved Logs</span>
                    </div>
                  }
                  description={`${totalCount} total production records logged`}
                  wrapText
                />

                <KpiCard
                  title="Pending Certification"
                  variant="amber"
                  icon={<Clock className="size-5" />}
                  badge={revisionCount > 0 ? `${revisionCount} NEEDS REVISION` : "REVIEW QUEUE"}
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 tracking-wider"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {pendingCount.toLocaleString()}
                      </span>
                      <span className="text-xs font-mono text-amber-700 font-bold">Awaiting Review</span>
                    </div>
                  }
                  description="Pending field or MAO inspection"
                  wrapText
                />

                <KpiCard
                  title="Total Recorded Volume"
                  variant="stone"
                  icon={<Scale className="size-5" />}
                  badge={`${summaries.length} ACTIVE OUTPUT TYPES`}
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 tracking-wider"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {formatQty(summaries.reduce((sum, s) => sum + (s.summary?.total || 0), 0))}
                      </span>
                      <span className="text-xs font-mono text-slate-700 font-bold">Units Total</span>
                    </div>
                  }
                  description="Cumulative farm harvests across types"
                  wrapText
                />

                <KpiCard
                  title="Benchmark Farm Value"
                  variant="sky"
                  icon={<PhilippinePeso className="size-5" />}
                  badge="OFFICIAL BENCHMARK"
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 tracking-wider"
                  value={
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {totalEstimatedValue > 0 ? formatPeso(totalEstimatedValue) : "₱0"}
                      </span>
                    </div>
                  }
                  description="Indicative commercial output valuation"
                  wrapText
                />
              </>
            )}

            {activeTab === "breeding" && (
              <>
                <KpiCard
                  title="Active Gestations"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {isBreedingLoading ? "..." : (breedingAnalytics?.active_gestations ?? 0)}
                      </span>
                      <span className="text-xs font-mono text-emerald-700 font-bold">Dams Pregnant</span>
                    </div>
                  }
                  icon={<HeartHandshake className="size-5" />}
                  badge="PREGNANT / BRED"
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 tracking-wider"
                  variant="emerald"
                  description="Currently pregnant or awaiting check"
                  wrapText
                />

                <KpiCard
                  title="Parturition Imminent (≤ 30d)"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {isBreedingLoading ? "..." : (breedingAnalytics?.due_soon ?? 0)}
                      </span>
                      <span className="text-xs font-mono text-amber-700 font-bold">Dams Due</span>
                    </div>
                  }
                  icon={<Clock className="size-5" />}
                  badge="IMMINENT PARTURITION"
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 tracking-wider"
                  variant="amber"
                  description="Expected calving within 30 days"
                  wrapText
                />

                <KpiCard
                  title="Conception Success Rate"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {breedingAnalytics?.conception_rate_pct !== null && breedingAnalytics?.conception_rate_pct !== undefined
                          ? `${breedingAnalytics.conception_rate_pct}%`
                          : "—"}
                      </span>
                    </div>
                  }
                  icon={<TrendingUp className="size-5" />}
                  badge={`${breedingAnalytics?.calved_count ?? 0} CONFIRMED DELIVERIES`}
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 tracking-wider"
                  variant="sky"
                  description={`${breedingAnalytics?.total_records ?? 0} total registered breeding events`}
                  wrapText
                />

                <KpiCard
                  title="Insemination Methods"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        {breedingAnalytics
                          ? `${breedingAnalytics.by_type.artificial_insemination} AI • ${breedingAnalytics.by_type.natural_service} Nat`
                          : "—"}
                      </span>
                    </div>
                  }
                  icon={<Dna className="size-5" />}
                  badge="PROTOCOL DISTRIBUTION"
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 tracking-wider"
                  variant="stone"
                  description={`${breedingAnalytics?.by_type.embryo_transfer ?? 0} embryo transfers registered`}
                  wrapText
                />
              </>
            )}

            {activeTab === "feeding" && (
              <>
                <KpiCard
                  title="Total Feed Given"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {isFeedingLoading ? "..." : (feedingAnalytics?.total_feed_kg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                      <span className="text-xs font-mono text-emerald-700 font-bold">kg Fed</span>
                    </div>
                  }
                  icon={<Wheat className="size-5" />}
                  badge="CUMULATIVE RATIONS"
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 tracking-wider"
                  variant="emerald"
                  description="Lifetime recorded feed weight"
                  wrapText
                />

                <KpiCard
                  title="Monthly Intake"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {isFeedingLoading ? "..." : (feedingAnalytics?.current_month_feed_kg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                      <span className="text-xs font-mono text-amber-700 font-bold">kg</span>
                    </div>
                  }
                  icon={<Calendar className="size-5" />}
                  badge="CURRENT MONTH"
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 tracking-wider"
                  variant="amber"
                  description="Rations provided this calendar month"
                  wrapText
                />

                <KpiCard
                  title="Total Feed Cost"
                  value={
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {isFeedingLoading
                          ? "..."
                          : `₱${(feedingAnalytics?.total_cost_php || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  }
                  icon={<DollarSign className="size-5" />}
                  badge={
                    feedingAnalytics?.current_month_cost_php
                      ? `₱${Number(feedingAnalytics.current_month_cost_php).toLocaleString()} THIS MONTH`
                      : "FEED EXPENDITURE"
                  }
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 tracking-wider"
                  variant="sky"
                  description="Cumulative input ration expenditures"
                  wrapText
                />

                <KpiCard
                  title="Daily Average Ration"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {feedingAnalytics?.daily_trend && feedingAnalytics.daily_trend.length > 0
                          ? `${(
                              feedingAnalytics.daily_trend.reduce((sum, d) => sum + d.quantity_kg, 0) /
                              feedingAnalytics.daily_trend.length
                            ).toFixed(1)}`
                          : "—"}
                      </span>
                      <span className="text-xs font-mono text-slate-700 font-bold">kg/day</span>
                    </div>
                  }
                  icon={<Scale className="size-5" />}
                  badge="14-DAY AVERAGE"
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 tracking-wider"
                  variant="stone"
                  description="Rolling herd daily consumption rate"
                  wrapText
                />
              </>
            )}

            {activeTab === "forecasts" && (
              <>
                <KpiCard
                  title="30-Day Milk Forecast"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {liveForecast30DaysMilk.toLocaleString()}
                      </span>
                      <span className="text-xs font-mono text-emerald-700 font-bold">Liters</span>
                    </div>
                  }
                  icon={<Milk className="size-5" />}
                  badge={
                    milkForecast?.status === "READY"
                      ? `AI: ${(milkForecast.selected_model || "Random Forest").toUpperCase()}`
                      : liveForecast30DaysMilk > 0
                      ? "PREDICTED DAIRY YIELD"
                      : "NO MILK LOGS"
                  }
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 tracking-wider"
                  variant="emerald"
                  description={
                    liveForecast30DaysMilk > 0
                      ? "30-day projection from biological ML run-rate"
                      : "Record daily milk sessions or run ML demo"
                  }
                  wrapText
                />

                <KpiCard
                  title="30-Day Estimated Revenue"
                  value={
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        ₱{liveForecast30DaysRevenue.toLocaleString()}
                      </span>
                    </div>
                  }
                  icon={<PhilippinePeso className="size-5" />}
                  badge="@ ₱50/L BENCHMARK"
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 tracking-wider"
                  variant="sky"
                  description="Predicted gross monthly dairy cashflow"
                  wrapText
                />

                <KpiCard
                  title="Projected Meat Yield"
                  value={
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {projectedCarcassKg.toLocaleString()}
                      </span>
                      <span className="text-xs font-mono text-amber-700 font-bold">kg Carcass</span>
                    </div>
                  }
                  icon={<Beef className="size-5" />}
                  badge={`DA DRESSING (${activeAnimals.length} ANIMALS)`}
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 tracking-wider"
                  variant="amber"
                  description="Dressing yield from live animal weights"
                  wrapText
                />

                <KpiCard
                  title="Commercial Meat Value"
                  value={
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        ₱{projectedCarcassRevenue.toLocaleString()}
                      </span>
                    </div>
                  }
                  icon={<DollarSign className="size-5" />}
                  badge="@ ₱280/kg BENCHMARK"
                  badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 tracking-wider"
                  variant="stone"
                  description="Padre Garcia municipal meat valuation"
                  wrapText
                />
              </>
            )}
          </section>

          {/* ── TAB 1: DAILY OUTPUT YIELDS (FILTERED BY OWNED SPECIES) ───────── */}
          {activeTab === "yields" && (
            <div className="space-y-6">
              {/* Output Type Cards - EGGS AND WOOL ARE REMOVED UNLESS OWNED */}
              <section aria-label="Output by production type" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {summaries.map(({ type, summary }) => {
                  const Icon = TYPE_ICON[type];
                  const isActive = activeType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setActiveType(type)}
                      aria-pressed={isActive}
                      className={`group rounded-2xl border p-4.5 text-left transition-all duration-200 cursor-pointer shadow-holo-card ${
                        isActive
                          ? "border-emerald-600 bg-emerald-950 text-white shadow-md shadow-emerald-950/15"
                          : "border-slate-200/90 bg-white text-slate-900 hover:border-emerald-400 hover:bg-emerald-50/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`flex size-11 items-center justify-center rounded-xl transition-all ${
                            isActive
                              ? "bg-white/10 text-emerald-300"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-100 group-hover:bg-emerald-100"
                          }`}
                        >
                          <Icon className="size-5.5" />
                        </span>
                        <Sparkles className={`size-4 ${isActive ? "text-emerald-300" : "text-slate-300"}`} />
                      </div>

                      <span className="mt-4 block font-mono text-[10px] font-bold uppercase tracking-wider opacity-75">
                        {PRODUCTION_TYPE_LABELS[type]}
                      </span>

                      <span className="mt-1 block font-display text-2xl font-black tracking-tight">
                        {summary?.has_records ? `${formatQty(summary.total)} ${PRODUCTION_TYPE_UNITS[type]}` : `0 ${PRODUCTION_TYPE_UNITS[type]}`}
                      </span>

                      <span className="mt-1 block font-mono text-xs opacity-70">
                        {summary?.record_count ?? 0} {summary?.record_count === 1 ? "record" : "records"} logged
                      </span>
                    </button>
                  );
                })}
              </section>

              {totalCount === 0 ? (
                <Card className="border-dashed border-slate-300 bg-white/95 rounded-3xl shadow-holo-card">
                  <CardContent className="p-10 text-center space-y-3">
                    <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                      <Milk className="size-6" />
                    </div>
                    <p className="font-display text-lg font-bold text-slate-900">No production logs recorded yet</p>
                    <p className="mx-auto max-w-md text-xs text-slate-500 font-medium">
                      Record daily milking yields, meat processing, or harvest outputs to activate live trend charts.
                    </p>
                    <Button asChild className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer">
                      <Link href="/production-dashboard">Go to Production Activities</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <ProductionCharts type={activeType} data={currentAnalytics} />

                  <Card className="overflow-hidden rounded-3xl border-slate-200/90 bg-white/95 shadow-holo-card">
                    <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 p-5">
                      <CardTitle className="font-display text-base font-bold text-slate-900">
                        Validation &amp; Certification Status
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 font-medium">
                        State of your saved entries in the official municipal registry
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 p-5">
                      {[
                        { label: "Recorded / Approved", value: completedCount, color: "bg-emerald-500" },
                        { label: "Pending / Verified", value: pendingCount, color: "bg-amber-400" },
                        { label: "Needs Revision", value: revisionCount, color: "bg-rose-500" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                        >
                          <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <span className={`size-2 rounded-full ${item.color}`} />
                            {item.label}
                          </span>
                          <span className="font-mono text-sm font-black text-slate-950">{item.value}</span>
                        </div>
                      ))}

                      <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/80 via-white to-emerald-50/70 p-4 space-y-1">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-900">
                          Active Metric Focus
                        </p>
                        <p className="font-display text-base font-black text-slate-950">
                          {PRODUCTION_TYPE_LABELS[activeType]}
                        </p>
                        <p className="text-xs leading-relaxed text-slate-600 font-medium">
                          Yield trend and indicative market revenue estimates update dynamically based on official municipal valuation rates.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}
            </div>
          )}

          {/* ── TAB 2: BREEDING & GESTATION PREDICTIONS ──────────────────────── */}
          {activeTab === "breeding" && (
            <div className="space-y-6">
              {/* Predictive Gestation Timeline Cards */}
              <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                        <Clock className="size-4.5 text-amber-600" />
                        <span>Predictive Parturition &amp; Delivery Timeline</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 font-medium">
                        AI gestation tracker based on species biological cycles (Cattle 283d, Carabao 310d, Goat 150d, Swine 114d)
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] text-amber-800 bg-amber-50 border-amber-200">
                      Predictive Model
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5">
                  {activePregnantList.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <HeartHandshake className="size-10 text-slate-300 mx-auto" />
                      <p className="font-display font-bold text-sm text-slate-800">No active gestations recorded</p>
                      <p className="text-xs text-slate-500 font-medium">
                        Record mating or artificial insemination logs in the Breeding tab to track countdowns and expected due dates.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activePregnantList.map((item) => {
                        const progress = item.gestation_progress_pct ?? 0;
                        const daysLeft = item.days_until_due;
                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-3 hover:bg-white hover:shadow-xs transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-display font-black text-sm text-slate-900 flex items-center gap-1.5">
                                <Tag className="size-3.5 text-emerald-600" />
                                {item.dam_tag || `Dam #${item.dam}`}
                              </span>
                              <Badge
                                variant="outline"
                                className={`font-mono text-[10px] font-bold ${
                                  daysLeft !== undefined && daysLeft !== null && daysLeft <= 30
                                    ? "bg-amber-100 text-amber-900 border-amber-300"
                                    : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                }`}
                              >
                                {daysLeft !== undefined && daysLeft !== null
                                  ? daysLeft <= 0
                                    ? "Due / Overdue"
                                    : `${daysLeft}d left`
                                  : "In Progress"}
                              </Badge>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                                <span>Gestation Progress</span>
                                <span className="font-mono font-bold text-emerald-700">{progress}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-emerald-600 h-2 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
                                />
                              </div>
                            </div>

                            <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-200/60 font-mono">
                              <p>Bred: {formatCalendarDate(item.breeding_date)} ({item.breeding_type})</p>
                              <p>Expected Due: {item.expected_due_date ? formatCalendarDate(item.expected_due_date) : "—"}</p>
                              {item.sire_tag_or_code && <p>Sire Code: {item.sire_tag_or_code}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── TAB 3: FEEDING & NUTRITION TELEMETRY ─────────────────────────── */}
          {activeTab === "feeding" && (
            <div className="space-y-6">
              {/* Feed Distribution Matrix */}
              {feedingAnalytics?.by_feed_type && (
                <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="size-4 text-amber-600" />
                      <span>Ration Mix &amp; Category Expenditure Breakdown</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 font-medium">
                      Nutritional allocation across forages, concentrates, byproducts, and minerals
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                      {Object.entries(feedingAnalytics.by_feed_type).map(([key, data]) => {
                        const total = feedingAnalytics.total_feed_kg || 1;
                        const pct = Math.round((data.quantity_kg / total) * 100);
                        return (
                          <div
                            key={key}
                            className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2 hover:bg-white hover:border-emerald-300 transition-all shadow-2xs"
                          >
                            <span className="text-xs font-bold text-slate-600 block truncate">
                              {FEED_TYPE_LABELS[key] || data.label}
                            </span>
                            <p className="font-display text-xl font-black text-slate-900">
                              {data.quantity_kg.toLocaleString(undefined, { maximumFractionDigits: 1 })}{" "}
                              <span className="text-xs font-mono font-normal text-slate-500">kg</span>
                            </p>
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600">
                              <span>{pct}% share</span>
                              {data.cost_php > 0 && (
                                <span className="font-bold text-amber-700">₱{data.cost_php.toLocaleString()}</span>
                              )}
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-amber-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── TAB 4: PREDICTIVE PROJECTIONS & FORECASTING ──────────────────── */}
          {activeTab === "forecasts" && (
            <div className="space-y-6">
              {/* 1. REAL MACHINE LEARNING DAIRY FORECASTING ENGINE */}
              <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card overflow-hidden">
                <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-emerald-100/70 p-2.5 text-emerald-800 border border-emerald-200/80">
                        <Sparkles className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>Supervised ML Out-of-Sample Milk Forecaster</span>
                          {milkForecast?.status === "READY" && (
                            <Badge variant="outline" className="font-mono text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">
                              {milkForecast.selected_model}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 font-medium">
                          Predictive daily milk yields evaluated with chronological cross-validation and Open-Meteo weather features
                        </CardDescription>
                      </div>
                    </div>

                    {/* Animal Selector & Source Toggle */}
                    <div className="flex flex-wrap items-center gap-2">
                      {eligibleDairyCows.length > 0 ? (
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                          <Tag className="size-3.5 text-slate-400" />
                          <label htmlFor="cow-select" className="sr-only">Select Dairy Dam</label>
                          <select
                            id="cow-select"
                            value={selectedCowId ?? ""}
                            onChange={(e) => setSelectedCowId(Number(e.target.value))}
                            className="bg-transparent font-bold text-slate-800 outline-none text-xs cursor-pointer pr-1"
                          >
                            {eligibleDairyCows.map((cow) => (
                              <option key={cow.id} value={cow.id}>
                                {cow.tagNumber || `Dam #${cow.id}`} ({cow.breed || cow.livestockTypeName})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <Badge variant="outline" className="font-mono text-xs bg-slate-100 text-slate-700">
                          Demo Benchmark Cow Active
                        </Badge>
                      )}

                      {showDemo ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDemo(false)}
                          className="h-8 text-xs font-semibold rounded-xl border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 cursor-pointer"
                        >
                          <RotateCcw className="size-3.5 mr-1" />
                          Real Records
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDemo(true)}
                          className="h-8 text-xs font-semibold rounded-xl border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 cursor-pointer"
                        >
                          <Sparkles className="size-3.5 mr-1" />
                          Synthetic Demo
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 sm:p-6 space-y-6">
                  {isForecastLoading ? (
                    <div className="flex min-h-48 items-center justify-center gap-2 text-xs font-bold text-slate-500">
                      <RefreshCw className="size-4.5 animate-spin text-emerald-600" />
                      <span>Running chronological ML model evaluation and Open-Meteo weather sync…</span>
                    </div>
                  ) : !milkForecast ? (
                    <div className="text-center py-12 space-y-2">
                      <Milk className="size-10 text-slate-300 mx-auto" />
                      <p className="font-display font-bold text-sm text-slate-800">No eligible dairy dam selected</p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Individual ML milk forecasts require an approved female cattle or carabao. Choose an animal or run the synthetic demonstration to preview.
                      </p>
                    </div>
                  ) : milkForecast.status === "NOT_READY" ? (
                    <div className="rounded-2xl border border-amber-200/90 bg-amber-50/70 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                          <AlertTriangle className="size-4.5 text-amber-600" />
                          <span>Predictive Model Training Readiness</span>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px] bg-amber-100 text-amber-900 border-amber-300">
                          {milkForecast.observation_count} / {milkForecast.minimum_history_required} Days Logged
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed font-medium">
                        {milkForecast.reason ||
                          `This animal currently has ${milkForecast.observation_count} approved daily milk observation(s). A minimum of ${milkForecast.minimum_history_required} consecutive dated records are required to train lag features (t-1, t-2, t-3, t-7) and chronological cross-validation without temporal leakage.`}
                      </p>

                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[11px] font-mono font-bold text-amber-900">
                          <span>Historical Data Progress</span>
                          <span>{Math.round((milkForecast.observation_count / milkForecast.minimum_history_required) * 100)}%</span>
                        </div>
                        <div className="w-full bg-amber-200/80 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-amber-600 h-2.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(5, (milkForecast.observation_count / milkForecast.minimum_history_required) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <p className="text-[11px] text-slate-600">
                          Want to inspect how the Random Forest and Ridge Regression models forecast ahead?
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setShowDemo(true)}
                          className="h-8 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs"
                        >
                          <Sparkles className="size-3.5 mr-1" />
                          Launch Real ML Simulation
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Live ML Evaluation & Forecast Timeline Chart */}
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                              <span>Expected Daily Milk Yield — Next 7 Days</span>
                              <Badge variant="outline" className="font-mono text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">
                                {milkForecast.selected_model} Winner
                              </Badge>
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                              Recursive one-day-ahead projection with Open-Meteo heat load (THI) background
                            </p>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
                            <span className="flex items-center gap-1.5">
                              <span className="size-2.5 rounded-full bg-blue-600" />
                              Historical
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="size-2.5 rounded-full bg-amber-600" />
                              ML Expected Forecast
                            </span>
                          </div>
                        </div>

                        <div className="h-72 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mlChartData} margin={{ top: 12, right: 14, bottom: 4, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              {hasWeatherOverlay && <YAxis yAxisId="weather" domain={[0, 100]} hide />}
                              {hasWeatherOverlay && (
                                <Bar yAxisId="weather" dataKey="weatherBand" legendType="none" isAnimationActive={false}>
                                  {mlChartData.map((point) => (
                                    <Cell key={point.date} fill={thiColor(point.thi)} fillOpacity={0.15} />
                                  ))}
                                </Bar>
                              )}
                              <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} minTickGap={20} tick={{ fontSize: 10 }} />
                              <YAxis unit=" L" width={48} tick={{ fontSize: 10 }} />
                              <Tooltip
                                content={({ active, payload, label }) => {
                                  if (!active || !payload?.length) return null;
                                  const point = payload[0].payload as (typeof mlChartData)[number];
                                  return (
                                    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-xs space-y-1 font-mono">
                                      <p className="font-bold text-slate-900 border-b pb-1 font-display">Date: {label}</p>
                                      {point.historical != null && (
                                        <p className="text-blue-700 font-bold">Historical Actual: {point.historical.toFixed(2)} L</p>
                                      )}
                                      {point.expected != null && (
                                        <p className="text-amber-700 font-bold">ML Expected Yield: {point.expected.toFixed(2)} L</p>
                                      )}
                                      {point.thi != null && (
                                        <p className="text-slate-600 pt-1 border-t text-[11px]">
                                          THI: {point.thi.toFixed(1)} · {point.temperature_c?.toFixed(1)}°C · {point.humidity_pct?.toFixed(0)}% RH
                                        </p>
                                      )}
                                    </div>
                                  );
                                }}
                              />
                              <Legend />
                              <Line type="monotone" dataKey="historical" name="Historical Observed (L)" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
                              <Line
                                type="monotone"
                                dataKey="expected"
                                name="ML Predicted Yield (L)"
                                stroke="#d97706"
                                strokeWidth={2.5}
                                strokeDasharray="6 4"
                                dot={{ r: 4, fill: "#d97706" }}
                                connectNulls
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Open-Meteo Heat Stress Weather Context Strip */}
                        {hasWeatherOverlay && (
                          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 font-medium">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <CloudSun className="size-3.5 text-amber-600" />
                              Open-Meteo THI Heat Stress:
                            </span>
                            <div className="flex flex-wrap items-center gap-3">
                              {[
                                ["#3b82f6", "Cool (<60)"],
                                ["#22c55e", "Mild (60–67)"],
                                ["#eab308", "Moderate (68–71)"],
                                ["#f97316", "High (72–79)"],
                                ["#ef4444", "Severe (80+)"],
                              ].map(([color, label]) => (
                                <span key={label} className="inline-flex items-center gap-1 font-mono text-[10px]">
                                  <span className="size-2 rounded-xs" style={{ backgroundColor: color }} />
                                  {label}
                                </span>
                              ))}
                            </div>
                            <span className="text-[10px] text-slate-500">
                              Location: {milkForecast.weather?.location_name || "Padre Garcia Centroid"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Chronological Model Cross-Validation Comparison Cards */}
                      {milkForecast.evaluation && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-display text-sm font-bold text-slate-900">
                                Chronological Model Validation &amp; Benchmark Comparison
                              </h4>
                              <p className="text-xs text-slate-500 font-medium">
                                Earliest 80% used for model fitting ({milkForecast.evaluation.train_samples} days); latest 20% held out for forward out-of-sample testing ({milkForecast.evaluation.test_samples} days).
                              </p>
                            </div>
                            <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 border-slate-200 text-slate-700">
                              No Temporal Leakage
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {milkForecast.evaluation.results.map((result) => {
                              const isWinner = result.name === milkForecast.selected_model;
                              return (
                                <div
                                  key={result.name}
                                  className={`rounded-2xl border p-4 space-y-2 transition-all ${
                                    isWinner
                                      ? "border-emerald-300 bg-emerald-50/50 shadow-xs"
                                      : "border-slate-200 bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-display text-xs font-bold text-slate-900">{result.name}</span>
                                    {isWinner && (
                                      <Badge variant="outline" className="font-mono text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">
                                        Best Fit
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-tight">
                                    {result.name === "Random Forest"
                                      ? "Non-linear multi-tree ensemble using lag signals and cow traits."
                                      : result.name === "Linear Regression"
                                      ? "Ridge regularized linear slope across previous-day yields."
                                      : "Naive baseline persistence (repeats latest known yield)."}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                                    <div className="p-2 rounded-lg bg-white border border-slate-100">
                                      <span className="text-[10px] text-slate-400 block uppercase">MAE</span>
                                      <span className="font-bold text-slate-800">{result.mae.toFixed(2)} L</span>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white border border-slate-100">
                                      <span className="text-[10px] text-slate-400 block uppercase">RMSE</span>
                                      <span className="font-bold text-slate-800">{result.rmse.toFixed(2)} L</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Forecast Numerical Table & Input Features Used */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                        {/* Daily Forecast Run-Rate */}
                        <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                          <h4 className="font-display text-xs font-bold text-slate-900 flex items-center justify-between">
                            <span>Predicted 7-Day Schedule</span>
                            <span className="text-[11px] font-mono text-emerald-700">@ ₱50/L Benchmark</span>
                          </h4>
                          <div className="overflow-x-auto rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Date</TableHead>
                                  <TableHead className="text-right text-xs">Expected Yield</TableHead>
                                  <TableHead className="text-right text-xs">Est. Value</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {milkForecast.forecast.map((f) => (
                                  <TableRow key={f.date} className="font-mono text-xs">
                                    <TableCell>{f.date}</TableCell>
                                    <TableCell className="text-right font-bold text-slate-900">
                                      {f.expected_liters.toFixed(2)} L
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-emerald-700">
                                      ₱{(f.expected_liters * 50).toFixed(0)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* Input Features Trained */}
                        <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                          <h4 className="font-display text-xs font-bold text-slate-900">
                            Machine Learning Features Employed
                          </h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            These signals were dynamically assembled from database records and Open-Meteo context to train the forecasting model:
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {milkForecast.features_used.map((feat) => (
                              <Badge
                                key={feat}
                                variant="outline"
                                className="font-mono text-[10px] bg-slate-50 text-slate-700 border-slate-200"
                              >
                                {feat}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* 2. 6-MONTH HERD OUTPUT & REVENUE TRAJECTORY (BAR CHART) */}
              <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="size-4.5 text-emerald-600" />
                        <span>6-Month Herd Output &amp; Revenue Trajectory</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 font-medium">
                        Multi-month projection combining live daily run-rates, finished carcass weight, and market benchmarks
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] text-emerald-800 bg-emerald-50 border-emerald-200 w-fit">
                      6-Month Horizon
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 sm:p-6">
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={forecastData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(255, 255, 255, 0.95)",
                            borderRadius: "16px",
                            border: "1px solid #e2e8f0",
                            color: "#0f172a",
                            fontSize: "12px",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="projectedYield" name="Projected Milk Yield (L)" fill="#10b981" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="projectedRevenue" name="Projected Milk Revenue (₱)" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="projectedMeatKg" name="Projected Monthly Meat (kg)" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* 3. REAL HERD MEAT FINISHING & CARCASS BIOMASS MATRIX */}
              <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                        <Beef className="size-4.5 text-amber-600" />
                        <span>Live Herd Biomass &amp; Carcass Meat Projections</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 font-medium">
                        DA livestock carcass dressing percentage calculations applied to measured live herd weights
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] text-amber-800 bg-amber-50 border-amber-200 w-fit">
                      {activeAnimals.length} Active Animals
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                        Total Live Biomass
                      </span>
                      <p className="font-display text-2xl font-black text-slate-900">
                        {totalLiveWeightKg.toLocaleString()} <span className="text-xs font-mono font-normal text-slate-500">kg</span>
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">Cumulative live herd weight</p>
                    </div>

                    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 space-y-1">
                      <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider font-mono">
                        Dressed Carcass Yield
                      </span>
                      <p className="font-display text-2xl font-black text-amber-950">
                        {projectedCarcassKg.toLocaleString()} <span className="text-xs font-mono font-normal text-amber-700">kg</span>
                      </p>
                      <p className="text-[11px] text-amber-800 font-medium">
                        58% Cattle/Carabao • 74% Swine • 60% Goat
                      </p>
                    </div>

                    <div className="rounded-2xl border border-sky-200/80 bg-sky-50/50 p-4 space-y-1">
                      <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider font-mono">
                        Commercial Farm Gate Value
                      </span>
                      <p className="font-display text-2xl font-black text-sky-950">
                        ₱{projectedCarcassRevenue.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-sky-800 font-medium">@ Padre Garcia benchmark ₱280/kg</p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 space-y-1">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider font-mono">
                        Finish Ready Potential
                      </span>
                      <p className="font-display text-2xl font-black text-emerald-950">
                        {activeAnimals.filter((a) => (a.weight || 0) >= 280).length} <span className="text-xs font-mono font-normal text-emerald-700">Heads</span>
                      </p>
                      <p className="text-[11px] text-emerald-800 font-medium">Heads reaching finishing weight (≥280kg)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 4. PREDICTIVE MODELS & ARCHITECTURE OVERVIEW */}
              <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                        <LineChartIcon className="size-4.5 text-emerald-600" />
                        <span>Predictive Models &amp; Algorithmic Pipeline</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 font-medium">
                        Overview of predictive methodologies deployed across SmartLivestock
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] text-emerald-800 bg-emerald-50 border-emerald-200 w-fit">
                      ML Pipeline
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                        <Dna className="size-4" />
                        <span>1. Supervised Machine Learning</span>
                      </div>
                      <p className="font-display text-sm font-bold text-slate-900">
                        Random Forest &amp; Ridge Regression
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                        Uses multi-lag features (t-1, t-2, t-3, t-7), rolling 3-day and 7-day moving averages, animal age, measured weight, and weather parameters to predict yields with chronological time-series cross-validation.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sky-800 font-bold text-xs">
                        <LineChartIcon className="size-4" />
                        <span>2. Classical Time-Series</span>
                      </div>
                      <p className="font-display text-sm font-bold text-slate-900">
                        ARIMA &amp; Holt-Winters Smoothing
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                        Discovers recurring seasonal patterns, cyclical calendar trends, and multi-month trajectories for municipal production planning and quarterly census reconciliation.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                        <Scale className="size-4" />
                        <span>3. Deterministic Biological Models</span>
                      </div>
                      <p className="font-display text-sm font-bold text-slate-900">
                        Gestation &amp; Dressing Equations
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                        Applies biological species constants (Cattle: 283d, Carabao: 310d, Goat: 150d, Swine: 114d) for parturition countdowns, and standard carcass dressing factors (58% cattle, 74% swine) for meat yield.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
