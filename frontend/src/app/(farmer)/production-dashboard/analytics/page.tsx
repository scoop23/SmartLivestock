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
  data_source: "farmer_recorded_livestock_logs" | "approved_livestock_records" | "synthetic_demo";
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

type AnalyticsDomain = "milk" | "meat" | "breeding" | "feeding";

const DOMAIN_CONFIG: Record<
  AnalyticsDomain,
  {
    title: string;
    badge: string;
    badgeClass: string;
    icon: React.ReactNode;
    description: string;
  }
> = {
  milk: {
    title: "Milk production",
    badge: "Dairy Sector",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: <Milk className="size-6 sm:size-7 text-emerald-700 shrink-0" />,
    description: "Daily milking session yields, supervised ML out-of-sample forecaster with Open-Meteo weather features, and 6-month dairy revenue trajectory.",
  },
  meat: {
    title: "Meat yield",
    badge: "Meat & Biomass",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    icon: <Beef className="size-6 sm:size-7 text-amber-700 shrink-0" />,
    description: "Recorded meat yields, live herd biomass, official DA carcass dressing percentage calculations, and 6-month meat output trajectory.",
  },
  breeding: {
    title: "Breeding & Insemination",
    badge: "Reproduction",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
    icon: <HeartHandshake className="size-6 sm:size-7 text-sky-700 shrink-0" />,
    description: "Active gestations, expected calving countdowns (≤30 days), artificial insemination vs natural bull service, and pregnancy success rates.",
  },
  feeding: {
    title: "Feeding & Rations",
    badge: "Nutrition & Cost",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: <Wheat className="size-6 sm:size-7 text-emerald-700 shrink-0" />,
    description: "Herd daily feed intake trends, 14-day rolling averages, ration category breakdowns, and cumulative feed expenditure tracking.",
  },
};

interface PrescriptiveItem {
  rule: string;
  category: string;
  severity: "HIGH" | "MEDIUM" | "OPTIMAL";
  title: string;
  reason: string;
  evidence: Record<string, string | number>;
  action: string;
  actionHref?: string;
  actionLabel?: string;
}

function PrescriptiveCard({
  title,
  description,
  recommendations,
}: {
  title: string;
  description: string;
  recommendations: PrescriptiveItem[];
}) {
  if (recommendations.length === 0) return null;

  return (
    <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-white to-amber-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="size-4.5 text-emerald-700" />
              <span>{title}</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-medium">
              {description}
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] text-emerald-800 bg-emerald-50 border-emerald-200 w-fit">
            {recommendations.length} Active Action{recommendations.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recommendations.map((rec) => {
            const isHigh = rec.severity === "HIGH";
            const isMedium = rec.severity === "MEDIUM";
            const borderClass = isHigh
              ? "border-l-4 border-l-rose-500 border-slate-200"
              : isMedium
              ? "border-l-4 border-l-amber-500 border-slate-200"
              : "border-l-4 border-l-emerald-500 border-slate-200";
            const badgeClass = isHigh
              ? "bg-rose-100 text-rose-900 border-rose-300"
              : isMedium
              ? "bg-amber-100 text-amber-900 border-amber-300"
              : "bg-emerald-100 text-emerald-900 border-emerald-300";
            const badgeLabel = isHigh
              ? "High Priority"
              : isMedium
              ? "Action Recommended"
              : "Optimal / Opportunity";

            return (
              <div
                key={rec.rule}
                className={`rounded-2xl border bg-white p-4 space-y-3 shadow-2xs ${borderClass}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`font-mono text-[10px] font-bold ${badgeClass}`}>
                        {badgeLabel}
                      </Badge>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                        {rec.category}
                      </span>
                    </div>
                    <h4 className="font-display text-sm font-bold text-slate-900">
                      {rec.title}
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/80">
                    {rec.rule}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {rec.reason}
                </p>

                {/* Quantified Live Farm Evidence */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {Object.entries(rec.evidence).map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2 text-xs"
                    >
                      <span className="block text-[10px] font-mono text-slate-500 truncate">
                        {label}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900 block truncate">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Recommended Action */}
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-2 flex-1">
                    <div>
                      <span className="font-bold text-emerald-950 block">
                        Recommended Farm Action:
                      </span>
                      <p className="text-emerald-900 font-medium leading-relaxed mt-0.5">
                        {rec.action}
                      </p>
                    </div>
                    {rec.actionHref && rec.actionLabel && (
                      <div>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 text-[11px] font-bold px-2.5"
                        >
                          <Link href={rec.actionHref}>
                            <span>{rec.actionLabel}</span>
                            <ArrowUpRight className="ml-1 size-3.5 text-emerald-700" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProductionAnalyticsPage() {
  const [selectedDomain, setSelectedDomain] = useState<AnalyticsDomain | null>(null);
  const [clockString, setClockString] = useState<string>("");

  const handleSelectDomain = (domain: AnalyticsDomain | null) => {
    setSelectedDomain(domain);
    if (typeof window !== "undefined") {
      const url = domain ? `/production-dashboard/analytics?domain=${domain}` : "/production-dashboard/analytics";
      window.history.pushState({}, "", url);
    }
  };

  useEffect(() => {
    const syncDomainFromUrl = () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const domain = (params.get("domain") || params.get("type")) as AnalyticsDomain | null;
        if (domain && ["milk", "meat", "breeding", "feeding"].includes(domain)) {
          setSelectedDomain(domain);
        } else {
          setSelectedDomain(null);
        }
      }
    };

    syncDomainFromUrl();
    window.addEventListener("popstate", syncDomainFromUrl);
    return () => window.removeEventListener("popstate", syncDomainFromUrl);
  }, []);

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
    isError: isFeedingError,
    refetch: refetchFeeding,
  } = useQuery<FeedingAnalytics>({
    queryKey: ["feeding_analytics"],
    queryFn: async () => (await api.get("production/feedings/analytics/")).data,
  });

  const feedingTrendChartData = useMemo(
    () => (feedingAnalytics?.daily_trend ?? []).map((point) => ({
      ...point,
      day: new Date(`${point.date}T12:00:00`).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      }),
    })),
    [feedingAnalytics?.daily_trend],
  );

  const feedingTypeChartData = useMemo(() => {
    const shortLabels: Record<string, string> = {
      FORAGE: "Forage",
      SILAGE_HAY: "Silage / Hay",
      CONCENTRATE: "Concentrate",
      BYPRODUCTS: "Byproducts",
      MINERALS: "Minerals",
    };
    return Object.entries(feedingAnalytics?.by_feed_type ?? {}).map(([key, item]) => ({
      type: FEED_TYPE_LABELS[key] || item.label,
      shortType: shortLabels[key] || item.label,
      quantity_kg: Number(item.quantity_kg) || 0,
      cost_php: Number(item.cost_php) || 0,
    }));
  }, [feedingAnalytics?.by_feed_type]);

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

  // Milk & Meat yield forecasting
  const milkRecords = records.filter((r) => r.productionType === "milk");
  const meatRecords = records.filter((r) => r.productionType === "meat");
  const milkSummary = analytics.by_type["milk"]?.summary;
  const meatSummary = analytics.by_type["meat"]?.summary;
  const totalMilkRecent = milkRecords.reduce((acc, r) => acc + Number(r.quantity), 0);
  const femaleCattleCount = activeAnimals.filter(
    (i) =>
      (i.sex?.toUpperCase().startsWith("F") || !i.sex) &&
      (i.livestockTypeName?.toLowerCase().includes("cattle") || i.livestockTypeName?.toLowerCase().includes("carabao"))
  ).length;

  // Farmer-owned run-rate from current recorded milk logs only.
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
  const effectiveCowId = selectedCowId ?? (eligibleDairyCows.length > 0 ? Number(eligibleDairyCows[0].id) : null);

  // Real Machine Learning Out-of-Sample Milk Forecast Query
  const {
    data: milkForecast,
    isLoading: isForecastLoading,
    refetch: refetchMilkForecast,
  } = useQuery({
    queryKey: [
      "livestock-milk-forecast",
      effectiveCowId,
      showDemo ? "synthetic_demo" : "farmer_recorded_livestock_logs",
    ],
    queryFn: async () => {
      if (!effectiveCowId) return null;
      const res = await api.get<MilkForecastResponse>(
        `analytics/livestock/${effectiveCowId}/milk-forecast/`,
        {
          timeout: 60_000,
          params: showDemo ? { source: "synthetic_demo" } : undefined,
        }
      );
      return res.data;
    },
    enabled: (selectedDomain === "milk" || selectedDomain === null) && !!effectiveCowId,
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
      // Real daily baseline from eligible production logs or selected ML model
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

  // Real Prescriptive Decision-Support Engine grounded in the farmer's live datasets
  const prescriptiveRecommendations = useMemo(() => {
    const items: Array<{
      rule: string;
      category: string;
      severity: "HIGH" | "MEDIUM" | "OPTIMAL";
      title: string;
      reason: string;
      evidence: Record<string, string | number>;
      action: string;
      actionHref?: string;
      actionLabel?: string;
    }> = [];

    const nowMs = new Date().getTime();

    // Rule 1: Heat Stress & Dairy Microclimate Management (Open-Meteo THI)
    const thiPoints = mlChartData.filter((p) => p.thi != null);
    if (thiPoints.length > 0) {
      const peakPoint = thiPoints.reduce((max, p) => ((p.thi ?? 0) > (max.thi ?? 0) ? p : max), thiPoints[0]);
      const peakThi = peakPoint.thi ?? 0;
      if (peakThi >= 72) {
        items.push({
          rule: "THI_HEAT_STRESS_MITIGATION",
          category: "Microclimate & Lactation Protection",
          severity: peakThi >= 80 ? "HIGH" : "MEDIUM",
          title: `Elevated Heat Stress Detected (Peak THI ${peakThi.toFixed(1)})`,
          reason: `Open-Meteo weather telemetry for your farm indicates a Temperature-Humidity Index (THI) of ${peakThi.toFixed(1)} on ${peakPoint.date}, crossing the 72.0 dairy heat-stress threshold where dry-matter intake and daily milk yield typically decline.`,
          evidence: {
            "Peak THI": peakThi.toFixed(1),
            "Peak Temp": peakPoint.temperature_c != null ? `${peakPoint.temperature_c.toFixed(1)}°C` : "—",
            "Humidity": peakPoint.humidity_pct != null ? `${peakPoint.humidity_pct.toFixed(0)}% RH` : "—",
            "Threshold": "THI ≥ 72.0",
          },
          action:
            "Shift concentrate feeding to cooler early-morning and late-afternoon hours, ensure continuous shaded electrolyte/clean water access, and increase pen ventilation during midday peaks.",
        });
      }
    }

    // Rule 2: Maternity & Imminent Calving Preparation (Breeding Records)
    const dueSoonDams = breedingRecords.filter(
      (b) =>
        (b.status === "PREGNANT" || b.status === "PENDING_CHECK") &&
        b.days_until_due !== null &&
        b.days_until_due !== undefined &&
        b.days_until_due <= 30
    );
    if (dueSoonDams.length > 0) {
      const nearest = [...dueSoonDams].sort((a, b) => (a.days_until_due ?? 999) - (b.days_until_due ?? 999))[0];
      items.push({
        rule: "MATERNITY_CALVING_READINESS",
        category: "Breeding & Perinatal Care",
        severity: (nearest.days_until_due ?? 30) <= 10 ? "HIGH" : "MEDIUM",
        title: `${dueSoonDams.length} Pregnant Dam${dueSoonDams.length === 1 ? "" : "s"} Approaching Delivery (≤ 30 Days)`,
        reason: `Dam ${nearest.dam_tag || `#${nearest.dam}`} is scheduled to give birth on ${nearest.expected_due_date ? formatCalendarDate(nearest.expected_due_date) : "upcoming due date"} (${nearest.days_until_due ?? 0} days remaining). Each successful calving adds ~12 L/day to your 6-month milk trajectory.`,
        evidence: {
          "Due ≤ 30d": `${dueSoonDams.length} head(s)`,
          "Nearest Dam": nearest.dam_tag || `Dam #${nearest.dam}`,
          "Days Left": `${nearest.days_until_due ?? 0}d`,
          "Expected Due": nearest.expected_due_date || "—",
        },
        action:
          "Prepare a clean, dry maternity pen, transition the dam to a low-calcium pre-calving ration 14–21 days prior to delivery, and stock colostrum supplies for immediate newborn intake.",
      });
    }

    // Rule 3: Herd Vaccination & Biosecurity Booster Compliance (Inventory Records)
    const overdueVaccinationAnimals = activeAnimals.filter((a) => {
      if (!a.lastVaccinationDate) return true;
      const daysSince = (nowMs - new Date(a.lastVaccinationDate).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 180;
    });
    if (activeAnimals.length > 0 && overdueVaccinationAnimals.length > 0) {
      const sampleTags = overdueVaccinationAnimals
        .slice(0, 3)
        .map((a) => a.tagNumber || `#${a.id}`)
        .join(", ");
      const coveragePct = Math.round(((activeAnimals.length - overdueVaccinationAnimals.length) / activeAnimals.length) * 100);
      items.push({
        rule: "BIOSECURITY_VACCINATION_BOOSTER",
        category: "Herd Biosecurity & Immunization",
        severity: coveragePct < 60 ? "HIGH" : "MEDIUM",
        title: `${overdueVaccinationAnimals.length} Active Animal${overdueVaccinationAnimals.length === 1 ? " Requires" : "s Require"} Vaccination Update`,
        reason: `${overdueVaccinationAnimals.length} of ${activeAnimals.length} active animals have no recorded vaccination within the past 180 days (current 6-month coverage: ${coveragePct}%). Unvaccinated stock are ineligible for movement clearance.`,
        evidence: {
          "Overdue / Unlogged": `${overdueVaccinationAnimals.length} / ${activeAnimals.length}`,
          "6-Mo Coverage": `${coveragePct}%`,
          "Sample Tags": sampleTags || "—",
          "Policy Interval": "≤ 180 days",
        },
        action:
          "Log recent vaccination dates in Livestock Inventory (Update → Log Treatment / Medication) or book an upcoming municipal vaccination schedule under Programs.",
        actionHref: "/livestock-inventory",
        actionLabel: "Open Livestock Inventory",
      });
    }

    // Rule 4: Ration Mix & Feed-to-Output Cost Efficiency (Feeding Analytics)
    const totalFeedKg = feedingAnalytics?.total_feed_kg ?? 0;
    const monthFeedCost = feedingAnalytics?.current_month_cost_php ?? 0;
    const concentrateKg = feedingAnalytics?.by_feed_type?.CONCENTRATE?.quantity_kg ?? 0;
    const forageKg =
      (feedingAnalytics?.by_feed_type?.FORAGE?.quantity_kg ?? 0) +
      (feedingAnalytics?.by_feed_type?.SILAGE_HAY?.quantity_kg ?? 0);
    const concentrateSharePct = totalFeedKg > 0 ? Math.round((concentrateKg / totalFeedKg) * 100) : 0;
    const forageSharePct = totalFeedKg > 0 ? Math.round((forageKg / totalFeedKg) * 100) : 0;

    if (totalFeedKg === 0 && activeAnimals.length > 0) {
      items.push({
        rule: "FEED_RATION_LOGGING_GAP",
        category: "Nutrition & Feed Conversion",
        severity: "MEDIUM",
        title: "No Feed Rations Logged for Active Herd",
        reason: `You have ${activeAnimals.length} active animal(s), but 0 kg of feeding rations are currently logged. Without ration records, feed-cost-to-revenue margin and average daily gain (ADG) efficiency cannot be audited.`,
        evidence: {
          "Active Herd": `${activeAnimals.length} head(s)`,
          "Logged Feed": "0 kg",
          "Monthly Feed Cost": "₱0.00",
          "Target Forage": "60–70% DM",
        },
        action:
          "Record daily forage, silage, and concentrate rations under Feeding & Nutrition to track cost per liter/kilogram produced and optimize finishing growth.",
      });
    } else if (concentrateSharePct > 60 || (liveForecast30DaysRevenue > 0 && monthFeedCost > liveForecast30DaysRevenue * 0.55)) {
      items.push({
        rule: "RATION_COST_OPTIMIZATION",
        category: "Nutrition & Feed Conversion",
        severity: "MEDIUM",
        title: `High Concentrate Share (${concentrateSharePct}%) — Optimize Forage Ratio`,
        reason: `Concentrate feeds represent ${concentrateSharePct}% of total logged rations (forage/silage: ${forageSharePct}%), with ₱${monthFeedCost.toLocaleString()} spent this month. Excessive concentrate share increases input cost and rumen acidosis risk in ruminants.`,
        evidence: {
          "Concentrate Share": `${concentrateSharePct}%`,
          "Forage / Silage": `${forageSharePct}%`,
          "Monthly Feed Cost": `₱${monthFeedCost.toLocaleString()}`,
          "Recommended Forage": "≥ 60% of ration",
        },
        action:
          "Increase fresh Napier/forage grass and silage proportion to at least 60% of total ration weight while reserving high-protein concentrates for lactating dams and finishing stock.",
      });
    }

    // Rule 5: Commercial Finishing & Market Dispatch Readiness (Biomass & Weights)
    const finishReadyHeads = activeAnimals.filter((a) => {
      const s = (a.livestockTypeName || "").toLowerCase();
      const targetW = s.includes("swine") || s.includes("pig") ? 80 : s.includes("goat") || s.includes("sheep") ? 25 : 280;
      return Number(a.weight || 0) >= targetW;
    });
    if (finishReadyHeads.length > 0) {
      const readyCarcassKg = Math.round(
        finishReadyHeads.reduce((acc, a) => {
          const s = (a.livestockTypeName || "").toLowerCase();
          const dressing = s.includes("swine") || s.includes("pig") ? 0.74 : s.includes("goat") || s.includes("sheep") ? 0.6 : 0.58;
          return acc + Number(a.weight || 0) * dressing;
        }, 0)
      );
      const readyValuePhp = Math.round(readyCarcassKg * 280);
      items.push({
        rule: "FINISHING_MARKET_DISPATCH",
        category: "Commercial Harvest & Auction Timing",
        severity: "OPTIMAL",
        title: `${finishReadyHeads.length} Head${finishReadyHeads.length === 1 ? " Has" : "s Have"} Reached Market Finishing Weight`,
        reason: `${finishReadyHeads.length} active animal(s) meet or exceed commercial finishing weight thresholds (≥280 kg cattle/carabao, ≥80 kg swine, ≥25 kg goat). Holding finished animals past peak feed conversion increases maintenance feed cost without proportional carcass gain.`,
        evidence: {
          "Finish-Ready": `${finishReadyHeads.length} head(s)`,
          "Est. Carcass": `${readyCarcassKg.toLocaleString()} kg`,
          "Est. Market Value": `₱${readyValuePhp.toLocaleString()}`,
          "Benchmark Rate": "₱280 / kg",
        },
        action:
          "In Production Activities (/production-dashboard): (1) click 'Weight / growth' to log the animal's final pre-market weight, then (2) click 'Declare sale intent' to submit a FOR_SALE, FOR_SLAUGHTER, or FOR_MOVEMENT declaration so Auction or Slaughterhouse personnel can process the inspection clearance and transfer certificate.",
        actionHref: "/production-dashboard",
        actionLabel: "Record Weight / Declare Sale Intent",
      });
    }

    // Rule 6: ML Milk Yield Trajectory & Data Readiness
    if (milkForecast?.status === "READY" && milkForecast.history.length > 0 && milkForecast.forecast.length > 0) {
      const recentHistAvg =
        milkForecast.history.slice(-7).reduce((acc, h) => acc + h.milk_liters, 0) /
        Math.max(1, milkForecast.history.slice(-7).length);
      const next7Avg =
        milkForecast.forecast.reduce((acc, f) => acc + f.expected_liters, 0) /
        Math.max(1, milkForecast.forecast.length);
      const pctDelta = recentHistAvg > 0 ? ((next7Avg - recentHistAvg) / recentHistAvg) * 100 : 0;

      if (pctDelta <= -8) {
        items.push({
          rule: "ML_LACTATION_DECLINE_INTERVENTION",
          category: "Dairy Yield Optimization",
          severity: pctDelta <= -15 ? "HIGH" : "MEDIUM",
          title: `ML Forecaster Projects ${Math.abs(pctDelta).toFixed(1)}% Short-Term Milk Dip for ${milkForecast.livestock.tag_number}`,
          reason: `The ${milkForecast.selected_model || "supervised ML"} model projects a 7-day average of ${next7Avg.toFixed(2)} L/day compared to the recent 7-day observed average of ${recentHistAvg.toFixed(2)} L/day.`,
          evidence: {
            "Dam Tag": milkForecast.livestock.tag_number,
            "Recent 7d Avg": `${recentHistAvg.toFixed(2)} L/day`,
            "ML 7d Forecast": `${next7Avg.toFixed(2)} L/day`,
            "Projected Shift": `${pctDelta.toFixed(1)}%`,
          },
          action:
            "Inspect the dam for subclinical mastitis (California Mastitis Test), verify ad-libitum clean water intake, and supplement energy/mineral top-dressing during milking.",
        });
      } else {
        items.push({
          rule: "ML_LACTATION_STABILITY",
          category: "Dairy Yield Optimization",
          severity: "OPTIMAL",
          title: `Stable 7-Day ML Lactation Outlook for ${milkForecast.livestock.tag_number} (${pctDelta >= 0 ? "+" : ""}${pctDelta.toFixed(1)}%)`,
          reason: `Out-of-sample ${milkForecast.selected_model || "ML"} projections average ${next7Avg.toFixed(2)} L/day against the recent ${recentHistAvg.toFixed(2)} L/day baseline, indicating steady lactation persistence.`,
          evidence: {
            "Dam Tag": milkForecast.livestock.tag_number,
            "Recent 7d Avg": `${recentHistAvg.toFixed(2)} L/day`,
            "ML 7d Forecast": `${next7Avg.toFixed(2)} L/day`,
            "Est. 30d Value": `₱${Math.round(next7Avg * 30 * 50).toLocaleString()}`,
          },
          action:
            "Maintain consistent twice-daily milking intervals, continue logging daily liters to keep the chronological ML training window current, and coordinate cold-storage collection.",
        });
      }
    } else if (milkForecast?.status === "NOT_READY") {
      items.push({
        rule: "ML_HISTORY_COMPLETION",
        category: "Predictive Model Readiness",
        severity: "MEDIUM",
        title: `Complete Daily Milk Logs for ${milkForecast.livestock.tag_number} (${milkForecast.observation_count}/${milkForecast.minimum_history_required} Days)`,
        reason: `Supervised lag features (t-1, t-2, t-3, t-7) require at least ${milkForecast.minimum_history_required} dated daily milk observations before out-of-sample cross-validation unlocks for this dam.`,
        evidence: {
          "Dam Tag": milkForecast.livestock.tag_number,
          "Logged Days": `${milkForecast.observation_count} days`,
          "Required Minimum": `${milkForecast.minimum_history_required} days`,
          "Remaining": `${Math.max(0, milkForecast.minimum_history_required - milkForecast.observation_count)} days`,
        },
        action:
          "Record daily milk yields consecutively in Production Activities (or toggle Synthetic Demo above to inspect a full 14-day trained ML trajectory).",
      });
    }

    return items;
  }, [
    mlChartData,
    breedingRecords,
    activeAnimals,
    feedingAnalytics,
    liveForecast30DaysRevenue,
    milkForecast,
  ]);

  const milkPrescriptive = useMemo(
    () =>
      prescriptiveRecommendations.filter((r) =>
        [
          "THI_HEAT_STRESS_MITIGATION",
          "ML_LACTATION_DECLINE_INTERVENTION",
          "ML_LACTATION_STABILITY",
          "ML_HISTORY_COMPLETION",
        ].includes(r.rule)
      ),
    [prescriptiveRecommendations]
  );

  const meatPrescriptive = useMemo(
    () =>
      prescriptiveRecommendations.filter((r) =>
        [
          "FINISHING_MARKET_DISPATCH",
          "BIOSECURITY_VACCINATION_BOOSTER",
        ].includes(r.rule)
      ),
    [prescriptiveRecommendations]
  );

  const breedingPrescriptive = useMemo(
    () =>
      prescriptiveRecommendations.filter((r) =>
        ["MATERNITY_CALVING_READINESS"].includes(r.rule)
      ),
    [prescriptiveRecommendations]
  );

  const feedingPrescriptive = useMemo(
    () =>
      prescriptiveRecommendations.filter((r) =>
        ["FEED_RATION_LOGGING_GAP", "RATION_COST_OPTIMIZATION"].includes(r.rule)
      ),
    [prescriptiveRecommendations]
  );

  const handleRefreshAll = () => {
    refetchRecords();
    refetchBreeding();
    refetchFeeding();
    refetchWeights();
    refetchCalving();
    if (effectiveCowId) refetchMilkForecast();
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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshAll}
            className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
            title="Refresh Analytics"
          >
            <RefreshCw className={`size-4.5 ${isRecordsFetching ? "animate-spin" : ""}`} />
          </Button>
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
          {/* ── DOMAIN TITLE HEADER (WHEN INSIDE A DOMAIN) ───────────────────── */}
          {selectedDomain !== null && DOMAIN_CONFIG[selectedDomain] && (
            <div className="space-y-1.5 pb-2 animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`font-mono text-[10px] font-bold uppercase tracking-wider ${DOMAIN_CONFIG[selectedDomain].badgeClass}`}
                >
                  {DOMAIN_CONFIG[selectedDomain].badge}
                </Badge>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                {DOMAIN_CONFIG[selectedDomain].icon}
                <span>{DOMAIN_CONFIG[selectedDomain].title}</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-3xl leading-relaxed">
                {DOMAIN_CONFIG[selectedDomain].description}
              </p>
            </div>
          )}

          {/* ── TOP NAVIGATION ACTIONS (ACTIVITIES ON LEFT, HISTORY ON RIGHT) ───────────── */}
          <div className="flex items-center justify-between gap-2">
            {selectedDomain !== null ? (
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-bold shadow-xs cursor-pointer"
              >
                <Link
                  href="/production-dashboard/analytics"
                  onClick={() => handleSelectDomain(null)}
                >
                  <ArrowLeft className="mr-1.5 size-4 text-slate-500" />
                  <span>Activities</span>
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-xl border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-bold shadow-xs cursor-pointer"
              >
                <Link href="/production-dashboard">
                  <ArrowLeft className="mr-1.5 size-4 text-slate-500" />
                  <span>Activities</span>
                </Link>
              </Button>
            )}
            <Button
              asChild
              className="h-10 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 text-xs font-bold shadow-xs cursor-pointer"
            >
              <Link
                href={
                  selectedDomain
                    ? `/production-dashboard/history?domain=${selectedDomain}${
                        selectedDomain === "milk" || selectedDomain === "meat" ? `&type=${selectedDomain}` : ""
                      }`
                    : "/production-dashboard/history?from=analytics"
                }
              >
                <span>History</span>
                <ArrowUpRight className="ml-1.5 size-4 text-emerald-700" />
              </Link>
            </Button>
          </div>


          {/* ── CONDITIONAL VIEWPORT: DOMAIN PICKER VS ACTIVE DOMAIN ─────────── */}
          {selectedDomain === null ? (
            <div className="space-y-6 animate-in fade-in-50 zoom-in-95 duration-300">
              {/* Domain Picker Hero Banner */}
              <div className="relative isolate overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,#123b2c_0%,#1f593e_52%,#39734a_100%)] p-6 text-white shadow-[0_18px_50px_rgba(20,83,45,0.16)] sm:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 -z-10 size-80 rounded-full border-[36px] border-white/[0.06]" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/4 -z-10 size-64 rounded-full bg-lime-200/[0.08] blur-2xl" />
                <div className="max-w-2xl space-y-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-50">
                    <Sparkles className="size-3.5 text-lime-300" /> Production Intelligence &amp; Forecasts
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Choose an Analytics Domain
                  </h2>
                  <p className="text-sm text-emerald-100/90 leading-relaxed font-medium">
                    Pick a production sector or decision engine below to explore targeted performance indicators, supervised ML forecasts, and output projections.
                  </p>
                </div>
              </div>

              {/* Interactive Domain Selection Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. Milk */}
                <button
                  type="button"
                  onClick={() => handleSelectDomain("milk")}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 text-left shadow-holo-card transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-950/10 active:scale-[0.99] flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex size-13 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 group-hover:bg-emerald-100 group-hover:scale-105 transition-all">
                        <Milk className="size-6.5" />
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] font-bold bg-emerald-50 text-emerald-800 border-emerald-200 uppercase tracking-wider">
                        Dairy Sector
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-display text-lg font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                        Milk production
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        Daily milking session yields, supervised ML out-of-sample forecaster with Open-Meteo weather features, and 6-month dairy revenue trajectory.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80">
                        {milkRecords.length} recorded logs
                      </span>
                      {milkForecast?.status === "READY" ? (
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {liveForecast30DaysMilk > 0 ? `${liveForecast30DaysMilk.toLocaleString()} L 30d forecast` : "AI Forecaster Ready"}
                        </span>
                      ) : milkForecast?.status === "NOT_READY" ? (
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                          {`AI: Needs ${milkForecast.minimum_history_required || 7} daily logs (${milkForecast.observation_count ?? 0}/${milkForecast.minimum_history_required || 7})`}
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                          AI: Needs 7 daily logs
                        </span>
                      )}
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                        ₱50/L benchmark
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                    <span>Explore Milk Analytics</span>
                    <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </button>

                {/* 2. Meat */}
                <button
                  type="button"
                  onClick={() => handleSelectDomain("meat")}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 text-left shadow-holo-card transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-500 hover:shadow-xl hover:shadow-amber-950/10 active:scale-[0.99] flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex size-13 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 group-hover:bg-amber-100 group-hover:scale-105 transition-all">
                        <Beef className="size-6.5" />
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] font-bold bg-amber-50 text-amber-800 border-amber-200 uppercase tracking-wider">
                        Meat &amp; Biomass
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-display text-lg font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                        Meat yield
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        Recorded meat yields, live herd biomass, official DA carcass dressing percentage calculations, and 6-month meat output trajectory.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80">
                        {meatRecords.length} meat logs
                      </span>
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                        {totalLiveWeightKg.toLocaleString()} kg biomass
                      </span>
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {projectedCarcassKg.toLocaleString()} kg carcass
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-700 group-hover:text-amber-800">
                    <span>Explore Meat Analytics</span>
                    <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </button>

                {/* 3. Breeding */}
                <button
                  type="button"
                  onClick={() => handleSelectDomain("breeding")}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 text-left shadow-holo-card transition-all duration-300 hover:-translate-y-1.5 hover:border-sky-500 hover:shadow-xl hover:shadow-sky-950/10 active:scale-[0.99] flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex size-13 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 border border-sky-100 group-hover:bg-sky-100 group-hover:scale-105 transition-all">
                        <HeartHandshake className="size-6.5" />
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] font-bold bg-sky-50 text-sky-800 border-sky-200 uppercase tracking-wider">
                        Reproduction
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-display text-lg font-bold text-slate-900 group-hover:text-sky-800 transition-colors">
                        Breeding &amp; Insemination
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        Active gestations, expected calving countdowns (≤30 days), artificial insemination vs natural bull service, and pregnancy success rates.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                        {breedingAnalytics?.active_gestations ?? 0} pregnant dams
                      </span>
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                        {breedingAnalytics?.due_soon ?? 0} due soon
                      </span>
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80">
                        {breedingAnalytics?.conception_rate_pct != null ? `${breedingAnalytics.conception_rate_pct}% success` : "Gestation registry"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-700 group-hover:text-sky-800">
                    <span>Explore Breeding Analytics</span>
                    <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </button>

                {/* 4. Feeding */}
                <button
                  type="button"
                  onClick={() => handleSelectDomain("feeding")}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 text-left shadow-holo-card transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-600 hover:shadow-xl hover:shadow-emerald-950/10 active:scale-[0.99] flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex size-13 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 group-hover:bg-emerald-100 group-hover:scale-105 transition-all">
                        <Wheat className="size-6.5" />
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] font-bold bg-emerald-50 text-emerald-800 border-emerald-200 uppercase tracking-wider">
                        Nutrition &amp; Cost
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-display text-lg font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                        Feeding &amp; Rations
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        Herd daily feed intake trends, 14-day rolling averages, ration category breakdowns, and cumulative feed expenditure tracking.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {(feedingAnalytics?.total_feed_kg || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kg fed
                      </span>
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                        ₱{(feedingAnalytics?.total_cost_php || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} cost
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                    <span>Explore Feeding Analytics</span>
                    <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">


              {/* ── DYNAMIC 4 KPIS PER ACTIVE DOMAIN ─────────────────────────── */}
              <section aria-label="Farm performance metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {selectedDomain === "milk" && (
                  <>
                    <KpiCard
                      title="Milk Production Output"
                      variant="emerald"
                      icon={<Milk className="size-5" />}
                      badge={`${milkSummary?.record_count ?? 0} LOGS RECORDED`}
                      badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 tracking-wider"
                      value={
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {formatQty(milkSummary?.total || 0)}
                          </span>
                          <span className="text-xs font-mono text-emerald-700 font-bold">Liters</span>
                        </div>
                      }
                      description="Cumulative recorded farm milking output"
                      wrapText
                    />

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
                      title="Benchmark Dairy Value"
                      variant="sky"
                      icon={<PhilippinePeso className="size-5" />}
                      badge="OFFICIAL BENCHMARK"
                      badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 tracking-wider"
                      value={
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            ₱{Math.round((milkSummary?.total || 0) * 50).toLocaleString()}
                          </span>
                        </div>
                      }
                      description="Historical dairy revenue valuation (@ ₱50/L)"
                      wrapText
                    />
                  </>
                )}

                {selectedDomain === "meat" && (
                  <>
                    <KpiCard
                      title="Meat Production Output"
                      variant="amber"
                      icon={<Beef className="size-5" />}
                      badge={`${meatSummary?.record_count ?? 0} LOGS RECORDED`}
                      badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 tracking-wider"
                      value={
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {formatQty(meatSummary?.total || 0)}
                          </span>
                          <span className="text-xs font-mono text-amber-700 font-bold">kg Dressed</span>
                        </div>
                      }
                      description="Total recorded carcass / dressed meat logs"
                      wrapText
                    />

                    <KpiCard
                      title="Total Live Biomass"
                      value={
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {totalLiveWeightKg.toLocaleString()}
                          </span>
                          <span className="text-xs font-mono text-emerald-700 font-bold">kg Live</span>
                        </div>
                      }
                      icon={<Scale className="size-5" />}
                      badge="HERD WEIGHT"
                      badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 tracking-wider"
                      variant="emerald"
                      description="Cumulative live weight across active herd"
                      wrapText
                    />

                    <KpiCard
                      title="Dressed Carcass Yield"
                      value={
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {projectedCarcassKg.toLocaleString()}
                          </span>
                          <span className="text-xs font-mono text-amber-700 font-bold">kg</span>
                        </div>
                      }
                      icon={<Beef className="size-5" />}
                      badge="DA DRESSING RATES"
                      badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 tracking-wider"
                      variant="amber"
                      description="58% Cattle/Carabao • 74% Swine • 60% Goat"
                      wrapText
                    />

                    <KpiCard
                      title="Commercial Carcass Value"
                      value={
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            ₱{projectedCarcassRevenue.toLocaleString()}
                          </span>
                        </div>
                      }
                      icon={<PhilippinePeso className="size-5" />}
                      badge="@ ₱280/kg BENCHMARK"
                      badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 tracking-wider"
                      variant="sky"
                      description="Padre Garcia farmgate dressed meat valuation"
                      wrapText
                    />
                  </>
                )}

                {selectedDomain === "breeding" && (
                  <>
                    <KpiCard
                      title="Pregnant Animals (Dams)"
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
                      description="Confirmed pregnant or awaiting check"
                      wrapText
                    />

                    <KpiCard
                      title="Due Soon (≤ 30 Days)"
                      value={
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {isBreedingLoading ? "..." : (breedingAnalytics?.due_soon ?? 0)}
                          </span>
                          <span className="text-xs font-mono text-amber-700 font-bold">Giving Birth Soon</span>
                        </div>
                      }
                      icon={<Clock className="size-5" />}
                      badge="GIVING BIRTH SOON"
                      badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 tracking-wider"
                      variant="amber"
                      description="Expected to give birth within 30 days"
                      wrapText
                    />

                    <KpiCard
                      title="Pregnancy Success Rate"
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
                      badge={`${breedingAnalytics?.calved_count ?? 0} SUCCESSFUL BIRTHS`}
                      badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 tracking-wider"
                      variant="sky"
                      description={`${breedingAnalytics?.total_records ?? 0} total breeding records logged`}
                      wrapText
                    />

                    <KpiCard
                      title="Breeding Methods"
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
                      badge="AI VS NATURAL BULL"
                      badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 tracking-wider"
                      variant="stone"
                      description={`${breedingAnalytics?.by_type.embryo_transfer ?? 0} embryo transfers registered`}
                      wrapText
                    />
                  </>
                )}

                {selectedDomain === "feeding" && (
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
              </section>

              {/* ── DOMAIN 1: MILK INTELLIGENCE & FORECASTS ─────────────────────── */}
              {selectedDomain === "milk" && (
                <div className="space-y-6">
                  {/* Milk Output & Breakdown */}
                  {milkRecords.length === 0 ? (
                    <Card className="border-dashed border-slate-300 bg-white/95 rounded-3xl shadow-holo-card">
                      <CardContent className="p-8 text-center space-y-3">
                        <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                          <Milk className="size-6" />
                        </div>
                        <p className="font-display text-base font-bold text-slate-900">No milk logs recorded yet</p>
                        <p className="mx-auto max-w-md text-xs text-slate-500 font-medium">
                          Record daily milking yields to view live trend charts, or explore the Supervised ML Forecaster below.
                        </p>
                        <Button asChild className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer">
                          <Link href="/production-dashboard">Go to Production Activities</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                      <ProductionCharts type="milk" data={analytics.by_type["milk"] ?? EMPTY_TYPE_ANALYTICS} />

                      <Card className="overflow-hidden rounded-3xl border-slate-200/90 bg-white/95 shadow-holo-card">
                        <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 p-5">
                          <CardTitle className="font-display text-base font-bold text-slate-900">
                            Dairy Output Breakdown
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500 font-medium">
                            Live recorded milking logs and dairy revenue summary for your farm.
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-3 p-5">
                          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                            <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                              <span className="size-2 rounded-full bg-emerald-500" />
                              Dairy Milk ({milkSummary?.record_count ?? 0} {milkSummary?.record_count === 1 ? "log" : "logs"})
                            </span>
                            <span className="font-mono text-sm font-black text-slate-950">
                              {formatQty(milkSummary?.total ?? 0)} L
                            </span>
                          </div>

                          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/70 p-4 space-y-1">
                            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                              Dairy Benchmark Metric
                            </p>
                            <p className="font-display text-base font-black text-slate-950">
                              ₱50.00 / Liter
                            </p>
                            <p className="text-xs leading-relaxed text-slate-600 font-medium">
                              Daily yield trend and indicative market revenue estimates update dynamically based on official Padre Garcia municipal farmgate valuation rates.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </section>
                  )}

                  {/* Supervised ML Out-of-Sample Milk Forecaster */}
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
                            value={effectiveCowId ?? ""}
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
                          `This animal currently has ${milkForecast.observation_count} eligible daily milk observation(s). A minimum of ${milkForecast.minimum_history_required} consecutive dated records are required to train lag features (t-1, t-2, t-3, t-7) and chronological cross-validation without temporal leakage.`}
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


                  {/* 6-Month Projected Milk Output & Dairy Revenue Trajectory */}
              {/* 2. 6-MONTH MILK OUTPUT & REVENUE TRAJECTORY (BAR CHART) */}
              <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="size-4.5 text-emerald-600" />
                        <span>6-Month Projected Milk Output &amp; Dairy Revenue Trajectory</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 font-medium">
                        Multi-month projection combining live daily milk run-rates, calving due dates, and municipal dairy benchmarks
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] text-emerald-800 bg-emerald-50 border-emerald-200 w-fit">
                      6-Month Horizon
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 sm:p-6">
                  {/* Brief Explanation of How the 6-Month Dairy Trajectory is Predicted */}
                  <div className="mb-5 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-emerald-600" />
                        <span>How This 6-Month Dairy Trajectory Is Predicted</span>
                      </p>
                      <span className="font-mono text-[10px] font-semibold text-slate-500">
                        Deterministic Biological + ML Run-Rate Formula
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl border border-emerald-200/80 bg-white p-3 space-y-1">
                        <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-[#10b981]" />
                          1. Projected Milk Yield (L)
                        </p>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                          Starts with your daily milk baseline (<span className="font-mono font-semibold text-slate-800">{avgForecastDaily.toFixed(1)} L/day</span> from the active ML forecast or recorded milk logs <span className="font-mono">× 30 days</span>) and adds <span className="font-mono font-semibold text-emerald-700">+12 L/day (+360 L/mo)</span> in any month where a pregnant dam reaches her expected calving due date.
                        </p>
                      </div>

                      <div className="rounded-xl border border-sky-200/80 bg-white p-3 space-y-1">
                        <p className="font-bold text-sky-800 flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-[#0ea5e9]" />
                          2. Projected Milk Revenue (₱)
                        </p>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                          Multiplies each month&apos;s projected milk liters by the Padre Garcia municipal dairy farmgate benchmark (<span className="font-mono font-semibold text-sky-800">Projected Liters × ₱50/L</span>) to estimate gross monthly dairy cashflow.
                        </p>
                      </div>
                    </div>
                  </div>

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
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Milk Prescriptive Decision Support */}
              <PrescriptiveCard
                title="Milk Prescriptive Analysis & Actions"
                description="Real-time rule-based recommendations evaluated from milk logs, THI heat stress, and ML forecasts"
                recommendations={milkPrescriptive}
              />
            </div>
          )}

              {/* ── DOMAIN 2: MEAT BIOMASS & CARCASS PROJECTIONS ────────────────── */}
              {selectedDomain === "meat" && (
                <div className="space-y-6">
                  {/* Meat Output & Breakdown */}
                  {meatRecords.length === 0 ? (
                    <Card className="border-dashed border-slate-300 bg-white/95 rounded-3xl shadow-holo-card">
                      <CardContent className="p-8 text-center space-y-3">
                        <div className="size-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
                          <Beef className="size-6" />
                        </div>
                        <p className="font-display text-base font-bold text-slate-900">No meat logs recorded yet</p>
                        <p className="mx-auto max-w-md text-xs text-slate-500 font-medium">
                          Record meat yields or review your live herd biomass and carcass dressing projections below.
                        </p>
                        <Button asChild className="rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs cursor-pointer">
                          <Link href="/production-dashboard">Go to Production Activities</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                      <ProductionCharts type="meat" data={analytics.by_type["meat"] ?? EMPTY_TYPE_ANALYTICS} />

                      <Card className="overflow-hidden rounded-3xl border-slate-200/90 bg-white/95 shadow-holo-card">
                        <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-amber-50/60 p-5">
                          <CardTitle className="font-display text-base font-bold text-slate-900">
                            Meat Output Breakdown
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500 font-medium">
                            Live recorded carcass logs and meat valuation summary for your farm.
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-3 p-5">
                          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                            <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                              <span className="size-2 rounded-full bg-amber-500" />
                              Carcass Meat ({meatSummary?.record_count ?? 0} {meatSummary?.record_count === 1 ? "log" : "logs"})
                            </span>
                            <span className="font-mono text-sm font-black text-slate-950">
                              {formatQty(meatSummary?.total ?? 0)} kg
                            </span>
                          </div>

                          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 via-white to-sky-50/70 p-4 space-y-1">
                            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-900">
                              Meat Benchmark Metric
                            </p>
                            <p className="font-display text-base font-black text-slate-950">
                              ₱280.00 / kg
                            </p>
                            <p className="text-xs leading-relaxed text-slate-600 font-medium">
                              Yield trend and indicative market revenue estimates update dynamically based on official Padre Garcia municipal dressed meat valuation rates.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </section>
                  )}

                  {/* Live Herd Biomass & Carcass Meat Projections Matrix */}
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


                  {/* 6-Month Projected Meat Output Trajectory */}
              {/* 2. 6-MONTH MEAT OUTPUT TRAJECTORY (BAR CHART) */}
              <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="size-4.5 text-amber-600" />
                        <span>6-Month Projected Meat Output Trajectory</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 font-medium">
                        Multi-month projection combining measured animal weights, average daily gain (ADG), and DA carcass dressing rates
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] text-amber-800 bg-amber-50 border-amber-200 w-fit">
                      6-Month Horizon
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 sm:p-6">
                  {/* Brief Explanation of How the 6-Month Meat Trajectory is Predicted */}
                  <div className="mb-5 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-amber-600" />
                        <span>How This 6-Month Meat Output Is Projected</span>
                      </p>
                      <span className="font-mono text-[10px] font-semibold text-slate-500">
                        Biological ADG + Carcass Dressing Formula
                      </span>
                    </div>

                    <div className="rounded-xl border border-amber-200/80 bg-white p-3 space-y-1 text-xs">
                      <p className="font-bold text-amber-800 flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#f59e0b]" />
                        Projected Monthly Meat (kg)
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                        Projects each active animal&apos;s live weight forward using a <span className="font-mono font-semibold text-amber-800">+0.6 kg/day (+18 kg/mo)</span> Average Daily Gain (ADG), filters heads reaching finishing weight (<span className="font-mono">≥260kg</span> cattle, <span className="font-mono">≥80kg</span> swine, <span className="font-mono">≥25kg</span> goat), and applies DA carcass dressing rates (<span className="font-mono">58% / 74% / 60%</span>) across the 6-month window.
                      </p>
                    </div>
                  </div>

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
                        <Bar dataKey="projectedMeatKg" name="Projected Monthly Meat (kg)" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Meat Prescriptive Decision Support */}
              <PrescriptiveCard
                title="Meat Prescriptive Analysis & Actions"
                description="Rule-based commercial finishing, market readiness, and herd movement recommendations"
                recommendations={meatPrescriptive}
              />
            </div>
          )}

              {/* ── DOMAIN 3: BREEDING & GESTATION PREDICTIONS ──────────────────── */}
              {selectedDomain === "breeding" && (
                <div className="space-y-6">
              <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                        <Clock className="size-4.5 text-amber-600" />
                        <span>Expected Delivery &amp; Birthing Timeline</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 font-medium">
                        Birth countdown tracker based on species biological cycles (Cattle 283d, Carabao 310d, Goat 150d, Swine 114d)
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
                      <p className="font-display font-bold text-sm text-slate-800">No active pregnancies recorded</p>
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
                                <span>Pregnancy Progress</span>
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

              {/* Breeding Prescriptive Decision Support */}
              <PrescriptiveCard
                title="Breeding Prescriptive Analysis & Actions"
                description="Actionable perinatal care and imminent calving preparation recommendations"
                recommendations={breedingPrescriptive}
              />
            </div>
          )}

              {/* ── DOMAIN 4: FEEDING & NUTRITION TELEMETRY ─────────────────────── */}
              {selectedDomain === "feeding" && (
                <div className="space-y-6">
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

              {isFeedingLoading ? (
                <section aria-label="Loading feeding charts" className="grid gap-5 lg:grid-cols-2">
                  <Skeleton className="h-[340px] rounded-3xl" />
                  <Skeleton className="h-[340px] rounded-3xl" />
                  <Skeleton className="h-[340px] rounded-3xl" />
                  <Skeleton className="h-[340px] rounded-3xl" />
                </section>
              ) : isFeedingError || !feedingAnalytics ? (
                <Card className="rounded-3xl border-rose-200 bg-rose-50/60 shadow-holo-card">
                  <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                    <AlertTriangle className="size-8 text-rose-600" />
                    <div>
                      <p className="font-display font-bold text-slate-900">Feeding analytics could not be loaded</p>
                      <p className="mt-1 text-xs text-slate-600">Retry to load the daily trends and feed category charts.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => void refetchFeeding()}>
                      <RefreshCw className="mr-2 size-4" /> Retry
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <section aria-label="Daily feeding trends" className="grid gap-5 lg:grid-cols-2">
                    <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="font-display text-base font-bold text-slate-900">Daily Feed Intake</CardTitle>
                        <CardDescription className="text-xs">Recorded feed quantity over the last 14 days (kg).</CardDescription>
                      </CardHeader>
                      <CardContent className="h-[280px] px-3 pb-4 sm:px-5">
                        {feedingTrendChartData.some((point) => point.quantity_kg > 0) ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={feedingTrendChartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${value} kg`} />
                              <Tooltip
                                contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                                formatter={(value) => [`${Number(value).toLocaleString()} kg`, "Feed logged"]}
                              />
                              <Line type="monotone" dataKey="quantity_kg" name="Feed logged" stroke="#059669" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500">
                            No feeding quantities were logged in the last 14 days.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="font-display text-base font-bold text-slate-900">Daily Recorded Feed Cost</CardTitle>
                        <CardDescription className="text-xs">Cost amounts entered on feeding logs over the last 14 days.</CardDescription>
                      </CardHeader>
                      <CardContent className="h-[280px] px-3 pb-4 sm:px-5">
                        {feedingTrendChartData.some((point) => point.cost_php > 0) ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={feedingTrendChartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value: number) => `₱${value}`} />
                              <Tooltip
                                contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                                formatter={(value) => [`₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Recorded cost"]}
                              />
                              <Line type="monotone" dataKey="cost_php" name="Recorded cost" stroke="#d97706" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500">
                            No feeding costs were recorded in the last 14 days.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </section>

                  <section aria-label="Feed category charts" className="grid gap-5 lg:grid-cols-2">
                    <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="font-display text-base font-bold text-slate-900">Quantity by Feed Type</CardTitle>
                        <CardDescription className="text-xs">Cumulative logged feed quantity by ration category (kg).</CardDescription>
                      </CardHeader>
                      <CardContent className="h-[300px] px-3 pb-4 sm:px-5">
                        {feedingTypeChartData.some((item) => item.quantity_kg > 0) ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={feedingTypeChartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${value} kg`} />
                              <YAxis type="category" dataKey="shortType" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                              <Tooltip
                                contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                                labelFormatter={(_label, payload) => payload?.[0]?.payload?.type || _label}
                                formatter={(value) => [`${Number(value).toLocaleString()} kg`, "Feed logged"]}
                              />
                              <Bar dataKey="quantity_kg" name="Feed logged" fill="#059669" radius={[0, 6, 6, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500">
                            Feed type totals will appear after feeding logs are recorded.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-slate-200/90 bg-white shadow-holo-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="font-display text-base font-bold text-slate-900">Recorded Cost by Feed Type</CardTitle>
                        <CardDescription className="text-xs">Cumulative costs entered on logs, grouped by ration category.</CardDescription>
                      </CardHeader>
                      <CardContent className="h-[300px] px-3 pb-4 sm:px-5">
                        {feedingTypeChartData.some((item) => item.cost_php > 0) ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={feedingTypeChartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value: number) => `₱${value}`} />
                              <YAxis type="category" dataKey="shortType" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                              <Tooltip
                                contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                                labelFormatter={(_label, payload) => payload?.[0]?.payload?.type || _label}
                                formatter={(value) => [`₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Recorded cost"]}
                              />
                              <Bar dataKey="cost_php" name="Recorded cost" fill="#d97706" radius={[0, 6, 6, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500">
                            No feeding cost amounts have been entered for these categories.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </section>

                  <p className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-900">
                    Charts show saved feeding logs. A day without a log does not prove that no feed was provided, and cost totals include only amounts entered on those logs.
                  </p>

                  {/* Feeding Prescriptive Decision Support */}
                  <PrescriptiveCard
                    title="Feeding Prescriptive Analysis & Actions"
                    description="Actionable ration mix optimization and feed conversion efficiency recommendations"
                    recommendations={feedingPrescriptive}
                  />
                </>
              )}
            </div>
          )}

              {/* ── COMMON FOOTER: PREDICTIVE MODELS & ALGORITHMIC OVERVIEW ─────── */}
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
                        Pregnancy &amp; Meat Yield Calculations
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                        Applies standard pregnancy days (Cattle: 283d, Carabao: 310d, Goat: 150d, Swine: 114d) for birth countdowns, and carcass dressing percentages (58% cattle, 74% swine) for clean meat yield.
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
