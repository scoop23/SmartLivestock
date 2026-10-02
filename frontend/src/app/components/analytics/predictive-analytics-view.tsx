"use client";

import { useEffect, useState, useMemo } from "react";
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
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  DollarSign,
  HelpCircle,
  Info,
  Layers,
  LineChart as LineChartIcon,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ---------------------------------------------------------------------------
// TYPE DEFINITIONS
// ---------------------------------------------------------------------------

type AnalyticsDomain = "production" | "disease" | "mortality" | "slaughter" | "auction";

interface ModelEvaluation {
  name: string;
  model_type: string;
  status: string;
  description: string;
  mae: number | null;
  rmse: number | null;
  r2: number | null;
  test_predictions?: number[];
  is_selected?: boolean;
}

interface HistoricalTrendPoint {
  date: string;
  month_label: string;
  actual: number;
}

interface EvaluationResponse {
  status: "ready" | "insufficient_data" | "error";
  forecast_available?: boolean;
  domain?: string;
  message?: string;
  target?: {
    domain?: string;
    target?: string;
    production_type?: string;
    unit: string;
    frequency?: string;
  };
  data?: {
    total_observations?: number;
    total_monthly_observations?: number;
    training_observations?: number;
    test_observations?: number;
    is_seeded: boolean;
    seed_marker?: string;
    train_period?: {
      start_month: string;
      end_month: string;
      observations: number;
    };
    test_period?: {
      start_month: string;
      end_month: string;
      observations: number;
      actual_values?: number[];
      months?: string[];
    };
    historical_trend?: HistoricalTrendPoint[];
  };
  historical_trend?: HistoricalTrendPoint[];
  selection?: {
    criterion: string;
    selected_model: string;
    rationale: string;
  };
  models?: ModelEvaluation[];
}

interface ForecastPoint {
  date: string;
  month_label: string;
  predicted: number;
}

interface ChartTimelinePoint {
  date: string;
  month_label: string;
  actual: number | null;
  forecast: number | null;
}

interface ForecastResponse {
  status: "ready" | "insufficient_data" | "error";
  forecast_available?: boolean;
  domain?: string;
  model?: string;
  target?: {
    domain?: string;
    target?: string;
    production_type?: string;
    unit: string;
  };
  metadata?: {
    horizon_months: number;
    is_seeded: boolean;
    seed_marker?: string;
    last_historical_date: string;
    recent_baseline_avg: number;
    forecast_period_avg: number;
    projected_change_pct: number;
  };
  forecast?: ForecastPoint[];
  chart_data?: ChartTimelinePoint[];
  historical_trend?: HistoricalTrendPoint[];
}

interface DescriptiveData {
  descriptive?: {
    disease?: {
      cases: number;
      affected_heads: number;
      trend: Array<{ month: string; cases: number; affected_heads: number }>;
      by_type: Array<{ name: string; cases: number; affected_heads: number }>;
      by_barangay: Array<{ barangay: string; cases: number; affected_heads: number }>;
    };
    mortality?: {
      records: number;
      deaths: number;
      trend: Array<{ month: string; deaths: number }>;
      by_cause: Array<{ cause: string; deaths: number }>;
      by_barangay: Array<{ barangay: string; records: number; deaths: number }>;
      risk_indicator?: {
        level: "LOW" | "MODERATE" | "ELEVATED";
        trend: "DECREASING" | "STABLE" | "INCREASING";
        recent_3m_deaths: number;
        baseline_3m_expected: number;
        ratio_vs_baseline: number;
        methodology_note: string;
      };
    };
    slaughter?: {
      records: number;
      total_heads: number;
      total_carcass_weight_kg: number;
      avg_carcass_weight_kg_per_head: number;
      by_species: Array<{ species: string; records: number; heads: number; carcass_weight_kg: number }>;
      monthly_trend: Array<{ month: string; label: string; heads: number; carcass_weight_kg: number }>;
    };
    sales?: {
      sales: number;
      animals: number;
      recorded_value: number | null;
      priced_sales: number;
      by_method: Array<{ sale_method: string; count: number; animals: number; total_value: number | null }>;
      by_purpose: Array<{ purpose: string; count: number; animals: number }>;
      trend: Array<{ month: string; label: string; transactions: number; animals: number; total_value_php: number }>;
    };
  };
}

// ---------------------------------------------------------------------------
// DOMAINS & COMMODITIES CONFIGURATION
// ---------------------------------------------------------------------------

const DOMAINS: Array<{
  id: AnalyticsDomain;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    id: "production",
    label: "Production",
    icon: "🥛",
    description: "Commodity outputs: Milk, Farmer Meat, Eggs, Wool",
  },
  {
    id: "disease",
    label: "Disease Surveillance",
    icon: "🦠",
    description: "Epidemiological outbreaks & affected animal head counts",
  },
  {
    id: "mortality",
    label: "Mortality Risk",
    icon: "⚠️",
    description: "Mortality records, causes, & empirical surveillance velocity",
  },
  {
    id: "slaughter",
    label: "Slaughterhouse",
    icon: "🥩",
    description: "Abattoir throughput (heads) & meat yield (carcass weight kg)",
  },
  {
    id: "auction",
    label: "Auction & Sales",
    icon: "⚖️",
    description: "Live animal commercial trade throughput & trading volume",
  },
];

const PRODUCTION_COMMODITIES = [
  {
    type: "MILK",
    unit: "LITERS",
    label: "Milk",
    icon: "🥛",
    desc: "Dairy output in Liters",
  },
  {
    type: "MEAT",
    unit: "KILOGRAMS",
    label: "Meat (Farmer)",
    icon: "🥩",
    desc: "Farmer-reported meat (slaughter=NULL)",
  },
  {
    type: "EGGS",
    unit: "PIECES",
    label: "Eggs",
    icon: "🥚",
    desc: "Layer poultry yield in Pieces",
  },
  {
    type: "WOOL",
    unit: "KILOGRAMS",
    label: "Wool",
    icon: "🧶",
    desc: "Fleece output in Kilograms",
  },
];

const MODEL_COLORS: Record<string, string> = {
  "Naive Baseline": "#64748b",
  "Linear Regression": "#2563eb",
  "Random Forest": "#7c3aed",
  ARIMA: "#d97706",
  "Holt-Winters": "#0891b2",
};

export default function PredictiveAnalyticsView() {
  // Domain & Parameter States
  const [activeDomain, setActiveDomain] = useState<AnalyticsDomain>("production");
  const [productionType, setProductionType] = useState<string>("MILK");
  const [unit, setUnit] = useState<string>("LITERS");
  const [targetMetric, setTargetMetric] = useState<string>("ALL");
  const [horizon, setHorizon] = useState<number>(6);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Data States
  const [evalData, setEvalData] = useState<EvaluationResponse | null>(null);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [descriptiveData, setDescriptiveData] = useState<DescriptiveData | null>(null);

  // Loading & UI States
  const [loading, setLoading] = useState<boolean>(true);
  const [forecastLoading, setForecastLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

  // Synchronize default target and unit whenever activeDomain changes
  useEffect(() => {
    if (activeDomain === "production") {
      setProductionType("MILK");
      setUnit("LITERS");
      setTargetMetric("MILK");
    } else if (activeDomain === "disease") {
      setTargetMetric("ALL");
      setUnit("CASES");
    } else if (activeDomain === "mortality") {
      setTargetMetric("ALL");
      setUnit("HEADS");
    } else if (activeDomain === "slaughter") {
      setTargetMetric("ALL");
      setUnit("HEADS");
    } else if (activeDomain === "auction") {
      setTargetMetric("ALL");
      setUnit("HEADS");
    }
  }, [activeDomain]);

  // Fetch descriptive dashboard summary for domain breakdowns & risk indicators
  useEffect(() => {
    let active = true;
    api
      .get<DescriptiveData>("analytics/dashboard/")
      .then(({ data }) => {
        if (active) setDescriptiveData(data);
      })
      .catch((err) => {
        console.warn("Descriptive dashboard fetch optional fallback:", err);
      });

    return () => {
      active = false;
    };
  }, [refreshTrigger]);

  // Fetch model evaluation benchmark
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params: Record<string, string> = {
      domain: activeDomain,
      unit,
    };
    if (activeDomain === "production") {
      params.production_type = productionType;
      params.target = productionType;
    } else {
      params.target = targetMetric;
    }

    api
      .get<EvaluationResponse>("analytics/predictive/", {
        params,
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!active) return;
        setEvalData(data);
        if (data.status === "ready" && data.selection?.selected_model) {
          setSelectedModel(data.selection.selected_model);
        } else {
          setSelectedModel(null);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          setError("Failed to load predictive analytics evaluation. Please verify server connectivity.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [activeDomain, productionType, targetMetric, unit, refreshTrigger]);

  // Fetch future forecast whenever selectedModel, horizon, or evaluation data changes
  useEffect(() => {
    if (evalData?.status !== "ready") {
      setForecastData(null);
      return;
    }

    let active = true;
    const controller = new AbortController();
    setForecastLoading(true);

    const params: Record<string, string | number> = {
      domain: activeDomain,
      unit,
      horizon,
    };
    if (activeDomain === "production") {
      params.production_type = productionType;
      params.target = productionType;
    } else {
      params.target = targetMetric;
    }
    if (selectedModel) {
      params.model = selectedModel;
    }

    api
      .get<ForecastResponse>("analytics/predictive/forecast/", {
        params,
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (active) setForecastData(data);
      })
      .catch((err) => {
        if (!active) return;
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          console.error("Forecast fetch error:", err);
        }
      })
      .finally(() => {
        if (active) setForecastLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [activeDomain, productionType, targetMetric, unit, horizon, selectedModel, evalData?.status]);

  // Format unit label helper
  const unitLabel = useMemo(() => {
    if (unit === "LITERS") return "Liters (L)";
    if (unit === "KILOGRAMS") return "Kilograms (kg)";
    if (unit === "PIECES") return "Pieces (pcs)";
    if (unit === "CASES") return "Clinical Cases";
    if (unit === "HEADS") return "Animals (Heads)";
    if (unit === "PHP") return "Philippine Peso (₱)";
    return unit;
  }, [unit]);

  // Prepare Holdout Test Period comparison chart dataset
  const testComparisonData = useMemo(() => {
    if (!evalData?.data?.test_period?.actual_values || !evalData.models) return [];
    const testInfo = evalData.data.test_period;
    const months = testInfo.months || [];
    const actuals = testInfo.actual_values || [];

    return months.map((monthStr, idx) => {
      const row: Record<string, string | number | null> = {
        month: monthStr,
        Actual: actuals[idx] ?? null,
      };
      evalData.models?.forEach((m) => {
        if (m.test_predictions && m.test_predictions[idx] !== undefined) {
          row[m.name] = m.test_predictions[idx];
        }
      });
      return row;
    });
  }, [evalData]);

  // Model Metric Comparison bar datasets
  const modelBarData = useMemo(() => {
    if (!evalData?.models) return [];
    return evalData.models.map((m) => ({
      name: m.name,
      mae: m.mae !== null ? Number(m.mae) : null,
      rmse: m.rmse !== null ? Number(m.rmse) : null,
      // Clamp negative R² for chart visualization with flag
      r2: m.r2 !== null ? Number(m.r2) : null,
      r2_display: m.r2 !== null ? Number(m.r2) : 0,
      isNegativeR2: m.r2 !== null && m.r2 < 0,
      isSelected: m.is_selected ?? false,
    }));
  }, [evalData]);

  // Historical-only chart data when in insufficient-data mode
  const fallbackHistoricalData = useMemo(() => {
    const list = evalData?.historical_trend || evalData?.data?.historical_trend || [];
    return list.map((item) => ({
      date: item.date,
      month_label: item.month_label,
      actual: item.actual,
      forecast: null,
    }));
  }, [evalData]);

  // Rationale text from backend
  const winningModel = evalData?.models?.find((m) => m.is_selected);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* 1. TOP HEADER & DOMAIN SELECTOR */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xl shadow-2xs">
                📈
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Municipal Livestock Predictive Analytics & Forecasting
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                    Capstone Suite
                  </Badge>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Time-based empirical modeling and multi-model benchmark evaluation across production, disease, mortality, slaughter, and market activities.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMethodology((prev) => !prev)}
              className="text-xs font-medium text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <HelpCircle className="size-3.5 mr-1.5 text-slate-500" />
              {showMethodology ? "Hide Methodology Guide" : "Educational Methodology"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              className="text-xs font-medium text-slate-600 border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className="size-3.5 mr-1.5 text-slate-500" />
              Refresh
            </Button>
          </div>
        </div>

        {/* DOMAIN TABS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-5">
          {DOMAINS.map((domain) => {
            const isActive = activeDomain === domain.id;
            return (
              <button
                key={domain.id}
                onClick={() => setActiveDomain(domain.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? "bg-emerald-800 text-white border-emerald-900 shadow-sm ring-2 ring-emerald-600/30"
                    : "bg-slate-50/60 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{domain.icon}</span>
                  <span className="text-xs font-bold leading-tight">{domain.label}</span>
                </div>
                <p
                  className={`text-[11px] mt-1.5 line-clamp-1 leading-snug ${
                    isActive ? "text-emerald-100" : "text-slate-500"
                  }`}
                >
                  {domain.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* DOMAIN-SPECIFIC CONTROLS */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          {/* Production Commodity Selector */}
          {activeDomain === "production" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Commodity & Unit:
              </span>
              {PRODUCTION_COMMODITIES.map((c) => {
                const isSelected = productionType === c.type;
                return (
                  <button
                    key={c.type}
                    onClick={() => {
                      setProductionType(c.type);
                      setUnit(c.unit);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                    <span className="text-[10px] opacity-80">({c.unit})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Disease Metric Selector */}
          {activeDomain === "disease" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Surveillance Metric:
              </span>
              <button
                onClick={() => setUnit("CASES")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  unit === "CASES" ? "bg-emerald-700 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Outbreak Reports (Cases)
              </button>
              <button
                onClick={() => setUnit("HEADS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  unit === "HEADS" ? "bg-emerald-700 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Affected Animals (Heads)
              </button>
            </div>
          )}

          {/* Mortality Metric Selector */}
          {activeDomain === "mortality" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Target Metric:
              </span>
              <Badge className="bg-slate-100 text-slate-800 border-slate-300 font-semibold px-3 py-1 text-xs">
                Total Livestock Deaths (Heads)
              </Badge>
            </div>
          )}

          {/* Slaughter Metric Selector */}
          {activeDomain === "slaughter" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Abattoir Measure:
              </span>
              <button
                onClick={() => setUnit("HEADS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  unit === "HEADS" ? "bg-emerald-700 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Throughput (Heads)
              </button>
              <button
                onClick={() => setUnit("KILOGRAMS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  unit === "KILOGRAMS" ? "bg-emerald-700 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Carcass Weight (Kilograms Meat)
              </button>
            </div>
          )}

          {/* Auction Metric Selector */}
          {activeDomain === "auction" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Market Measure:
              </span>
              <button
                onClick={() => setUnit("HEADS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  unit === "HEADS" ? "bg-emerald-700 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Live Animals Sold (Heads)
              </button>
              <button
                onClick={() => setUnit("PHP")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  unit === "PHP" ? "bg-emerald-700 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Trading Volume (PHP ₱)
              </button>
            </div>
          )}

          {/* Forecast Horizon Selector (Only relevant when forecasting is active) */}
          {evalData?.status === "ready" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Projection Horizon:
              </span>
              {[3, 6, 12].map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    horizon === h
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  +{h}m
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. EDUCATIONAL METHODOLOGY DRAWER */}
      {/* ------------------------------------------------------------------ */}
      {showMethodology && (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/50 shadow-xs animate-in fade-in duration-300">
          <CardHeader className="pb-3 border-b border-emerald-100/80">
            <CardTitle className="text-sm font-bold text-emerald-950 flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-600" />
              Machine Learning & Time-Series Evaluation Principles (Capstone Reference)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-emerald-950/80">
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 space-y-1">
              <span className="font-bold text-emerald-900 block">MAE (Mean Absolute Error)</span>
              <p>
                Calculates the average magnitude of prediction errors: <code className="bg-emerald-50 px-1 py-0.5 rounded">Σ|y - ŷ| / n</code>.
                Expressed in the exact same physical unit (e.g. ±12.4 Liters).
              </p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 space-y-1">
              <span className="font-bold text-emerald-900 block">RMSE (Root Mean Squared Error)</span>
              <p>
                Squares errors before averaging: <code className="bg-emerald-50 px-1 py-0.5 rounded">sqrt(Σ(y - ŷ)² / n)</code>.
                Severely penalizes large deviations, alerting us if a model occasionally makes catastrophic mistakes.
              </p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 space-y-1">
              <span className="font-bold text-emerald-900 block">R² (Coefficient of Determination)</span>
              <p>
                Measures the percentage of variation in the target explained by the model relative to a horizontal mean line.
                Can be negative if a model performs worse than simply predicting the historical average.
              </p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 space-y-1">
              <span className="font-bold text-emerald-900 block">Chronological Train/Test Split</span>
              <p>
                Random shuffling is strictly forbidden in time series because it causes <strong className="text-emerald-950">Data Leakage</strong>.
                Models train strictly on past months (t₀ to t_k) and are validated against unseen future months (t_k+1 to t_n).
              </p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 space-y-1">
              <span className="font-bold text-emerald-900 block">Farmer Meat vs. Slaughterhouse Meat</span>
              <p>
                Farmer meat (<code className="bg-emerald-50 px-1 py-0.5 rounded">slaughter=NULL</code>) is farmgate production.
                Abattoir meat (<code className="bg-emerald-50 px-1 py-0.5 rounded">SlaughterRecord</code>) is facility throughput.
                Keeping them separate prevents counting the same animal twice.
              </p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-emerald-100 space-y-1">
              <span className="font-bold text-emerald-900 block">Analytics (When) vs. GIS (Where)</span>
              <p>
                Predictive Analytics answers <em>"What is happening over time and what may happen next?"</em>
                GIS answers <em>"Where is it happening geographically?"</em>
                They operate as distinct, complementary analytical layers.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. LOADING / ERROR STATES */}
      {/* ------------------------------------------------------------------ */}
      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
            <Skeleton className="h-6 w-64 rounded-md" />
            <Skeleton className="h-4 w-96 rounded-md" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-6 text-red-600" />
            <h3 className="font-bold text-lg">Predictive Analytics Service Error</h3>
          </div>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <Button
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            className="mt-4 bg-red-700 text-white hover:bg-red-800"
            size="sm"
          >
            <RefreshCw className="mr-2 size-4" /> Try Again
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. INSUFFICIENT DATA STATE (ACADEMIC INTEGRITY GUARANTEE) */}
      {/* ------------------------------------------------------------------ */}
      {!loading && !error && evalData?.status === "insufficient_data" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-amber-200 p-6 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                <Info className="size-6" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">
                    Predictive Forecasting Unavailable: Insufficient Historical Observations
                  </h3>
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-semibold text-xs">
                    Academic Integrity Protection
                  </Badge>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {evalData.message ||
                    `At least 12 monthly observations are required to chronologically train, evaluate, and benchmark machine learning models reliably.`}
                </p>
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/60 text-xs text-amber-900 space-y-1">
                  <p className="font-semibold">Why is machine learning disabled?</p>
                  <p>
                    Training regression models on sparse data (&lt; 12 points) leads to severe overfitting, high variance, and fabricated accuracy scores.
                    In SmartLivestock, we never manufacture fake forecast curves or invent random data.
                  </p>
                  <p className="pt-1 font-mono text-[11px] text-amber-800">
                    To test ML models on this domain using deterministic test data:
                    <br />
                    {activeDomain === "production" && (
                      <span className="font-bold">python manage.py seed_productions --months 36</span>
                    )}
                    {activeDomain === "disease" && (
                      <span className="font-bold">python manage.py seed_diseases --months 36</span>
                    )}
                    {activeDomain === "mortality" && (
                      <span className="font-bold">python manage.py seed_mortality --months 36</span>
                    )}
                    {activeDomain === "slaughter" && (
                      <span className="font-bold">python manage.py seed_slaughters --months 36</span>
                    )}
                    {activeDomain === "auction" && (
                      <span className="font-bold">python manage.py seed_analytics_test_data</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* HISTORICAL TREND LINE (EVEN WHEN FORECAST IS UNAVAILABLE) */}
          {fallbackHistoricalData.length > 0 && (
            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <LineChartIcon className="size-5 text-emerald-700" />
                      Recorded Historical Observations ({unitLabel})
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Displaying {fallbackHistoricalData.length} recorded monthly point(s). A minimum of 12 points activates full predictive forecasting.
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-slate-50 text-slate-700 text-xs">
                    Historical Only
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={fallbackHistoricalData} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="month_label"
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        stroke="#cbd5e1"
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        stroke="#cbd5e1"
                        domain={[0, "auto"]}
                        unit={` ${unit === "PHP" ? "₱" : ""}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderRadius: "12px",
                          border: "none",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                        formatter={(val: any) => [`${val} ${unitLabel}`, "Recorded Actual"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="Recorded Actual"
                        stroke="#059669"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#059669", strokeWidth: 1.5, stroke: "#fff" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DOMAIN-SPECIFIC DESCRIPTIVE CARDS */}
          {activeDomain === "disease" && descriptiveData?.descriptive?.disease && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-2xl border-slate-200 shadow-xs">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-800">
                    Disease Outbreaks by Diagnosis
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-2.5">
                    {descriptiveData.descriptive.disease.by_type.map((d) => (
                      <div key={d.name} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-xs">
                        <span className="font-semibold text-slate-800">{d.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{d.cases} cases</span>
                          <Badge variant="outline" className="bg-white text-emerald-800 font-bold">
                            {d.affected_heads} heads
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {descriptiveData.descriptive.disease.by_type.length === 0 && (
                      <p className="text-xs text-slate-400 py-4 text-center">No disease records in current reporting period.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-xs">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-800">
                    Disease Cases by Barangay
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-2.5">
                    {descriptiveData.descriptive.disease.by_barangay.slice(0, 6).map((b) => (
                      <div key={b.barangay} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-xs">
                        <span className="font-semibold text-slate-800">{b.barangay || "Unspecified"}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{b.cases} cases</span>
                          <Badge variant="outline" className="bg-white text-emerald-800 font-bold">
                            {b.affected_heads} heads
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {descriptiveData.descriptive.disease.by_barangay.length === 0 && (
                      <p className="text-xs text-slate-400 py-4 text-center">No barangay disease records found.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* MORTALITY RISK INDICATOR CARD */}
          {activeDomain === "mortality" && descriptiveData?.descriptive?.mortality?.risk_indicator && (
            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="size-5 text-amber-600" />
                    Empirical Mortality Surveillance Risk Indicator
                  </CardTitle>
                  <Badge
                    className={`font-bold px-3 py-1 ${
                      descriptiveData.descriptive.mortality.risk_indicator.level === "ELEVATED"
                        ? "bg-red-600 text-white"
                        : descriptiveData.descriptive.mortality.risk_indicator.level === "MODERATE"
                        ? "bg-amber-500 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    Risk Level: {descriptiveData.descriptive.mortality.risk_indicator.level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500">Recent 3-Month Deaths</span>
                    <p className="text-xl font-bold text-slate-900">
                      {descriptiveData.descriptive.mortality.risk_indicator.recent_3m_deaths} heads
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500">12-Month Expected Baseline</span>
                    <p className="text-xl font-bold text-slate-900">
                      {descriptiveData.descriptive.mortality.risk_indicator.baseline_3m_expected} heads
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500">Velocity Ratio vs Baseline</span>
                    <p className="text-xl font-bold text-slate-900">
                      {descriptiveData.descriptive.mortality.risk_indicator.ratio_vs_baseline}x
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-950">
                  <span className="font-semibold block mb-0.5">Epidemiological Disclosure:</span>
                  {descriptiveData.descriptive.mortality.risk_indicator.methodology_note}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AUCTION BREAKDOWN */}
          {activeDomain === "auction" && descriptiveData?.descriptive?.sales && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-2xl border-slate-200 shadow-xs">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-800">
                    Trading Volume by Sale Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-2.5">
                    {descriptiveData.descriptive.sales.by_method.map((m) => (
                      <div key={m.sale_method} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-xs">
                        <span className="font-semibold text-slate-800">{m.sale_method}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{m.count} sales</span>
                          <Badge variant="outline" className="bg-white text-emerald-800 font-bold">
                            {m.animals} heads
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-xs">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-800">
                    Trading Volume by Purpose
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-2.5">
                    {descriptiveData.descriptive.sales.by_purpose.map((p) => (
                      <div key={p.purpose} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-xs">
                        <span className="font-semibold text-slate-800">{p.purpose}</span>
                        <Badge variant="outline" className="bg-white text-emerald-800 font-bold">
                          {p.animals} heads
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. READY PREDICTIVE ANALYTICS SUITE (7 CHARTS & EVALUATIONS) */}
      {/* ------------------------------------------------------------------ */}
      {!loading && !error && evalData?.status === "ready" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* CHART 6 & SUMMARY METRICS: FORECAST CHANGE VS BASELINE CARD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Selected Model</span>
                  <Award className="size-4 text-emerald-700" />
                </div>
                <div className="text-lg font-bold text-slate-900 truncate">
                  {forecastData?.model || winningModel?.name || "Evaluating..."}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <CheckCircle2 className="size-3 text-emerald-600" /> Lowest Test MAE
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Recent Baseline (3m Avg)</span>
                  <Calendar className="size-4 text-slate-400" />
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {forecastData?.metadata?.recent_baseline_avg ?? "—"} {unitLabel}
                </div>
                <div className="text-[11px] text-slate-500">Historical velocity</div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Forecast Period Average</span>
                  <LineChartIcon className="size-4 text-emerald-700" />
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {forecastData?.metadata?.forecast_period_avg ?? "—"} {unitLabel}
                </div>
                <div className="text-[11px] text-slate-500">Next {horizon} months projected</div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Projected Change</span>
                  {(forecastData?.metadata?.projected_change_pct ?? 0) >= 0 ? (
                    <TrendingUp className="size-4 text-emerald-600" />
                  ) : (
                    <TrendingDown className="size-4 text-amber-600" />
                  )}
                </div>
                <div
                  className={`text-lg font-bold ${
                    (forecastData?.metadata?.projected_change_pct ?? 0) >= 0 ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {(forecastData?.metadata?.projected_change_pct ?? 0) >= 0 ? "+" : ""}
                  {forecastData?.metadata?.projected_change_pct ?? 0}%
                </div>
                <div className="text-[11px] text-slate-500">
                  Projected change (model estimate, not guaranteed outcome)
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DOMAIN SPECIFIC CAUTIONARY NOTES */}
          {activeDomain === "disease" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <Info className="size-4 text-amber-700 shrink-0" />
              <span>
                <strong>Epidemiological Interpretation:</strong> Projected Disease Cases represents municipal outbreak reporting velocity. It does NOT predict which individual cattle or herd will contract illness.
              </span>
            </div>
          )}

          {activeDomain === "mortality" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-center gap-2">
              <Info className="size-4 text-blue-700 shrink-0" />
              <span>
                <strong>Mortality Surveillance Note:</strong> Projected deaths indicate seasonal velocity based on historical reporting trends. Not a biological probability.
              </span>
            </div>
          )}

          {activeDomain === "slaughter" && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-center gap-2">
              <Info className="size-4 text-purple-700 shrink-0" />
              <span>
                <strong>Abattoir Throughput Isolation:</strong> Animal head counts and carcass weight (kg) are distinct metrics and never merged. Slaughterhouse meat is strictly separate from farmer on-farm meat.
              </span>
            </div>
          )}

          {/* CHART 1: HISTORICAL VS FORECAST CONTINUOUS TIMELINE */}
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <LineChartIcon className="size-5 text-emerald-700" />
                    Historical vs. Forecast Continuous Timeline ({unitLabel})
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Solid line depicts recorded municipal observations up to {forecastData?.metadata?.last_historical_date}.
                    Dashed line depicts the +{horizon}-month projection from{" "}
                    <span className="font-semibold text-slate-800">{forecastData?.model || winningModel?.name}</span>.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Forecaster:</span>
                  <select
                    value={selectedModel || winningModel?.name || ""}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="text-xs border border-slate-300 rounded-lg px-2.5 py-1 font-semibold text-slate-700 bg-white"
                  >
                    {evalData.models?.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name} {m.is_selected ? "★ (Best MAE)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-80 w-full">
                {forecastLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Skeleton className="h-full w-full rounded-xl" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecastData?.chart_data || []} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="month_label"
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        stroke="#cbd5e1"
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        stroke="#cbd5e1"
                        domain={[0, "auto"]}
                        unit={` ${unit === "PHP" ? "₱" : ""}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderRadius: "12px",
                          border: "none",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                        formatter={(val: any, name: any) => [`${val} ${unitLabel}`, name]}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="Historical Actual"
                        stroke="#059669"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#059669" }}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        name="Projected Forecast"
                        stroke="#7c3aed"
                        strokeWidth={2.5}
                        strokeDasharray="5 5"
                        dot={{ r: 4, fill: "#7c3aed", strokeWidth: 1.5, stroke: "#fff" }}
                        connectNulls={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* CHARTS 2, 3, 4: MODEL EVALUATION BENCHMARK METRICS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CHART 2: MAE COMPARISON */}
            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>Model MAE (Lower is Better)</span>
                  <Badge variant="outline" className="text-[10px] font-bold text-slate-600">
                    {unit}
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-slate-500">Average absolute prediction deviation on test set.</p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelBarData} margin={{ top: 10, right: 10, left: -10, bottom: 35 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        stroke="#cbd5e1"
                        angle={-30}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#cbd5e1" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderRadius: "10px", color: "#fff", fontSize: "11px" }}
                        formatter={(val: any) => [`${val} ${unitLabel}`, "MAE"]}
                      />
                      <Bar dataKey="mae" radius={[4, 4, 0, 0]}>
                        {modelBarData.map((entry, index) => (
                          <Cell
                            key={`mae-${index}`}
                            fill={entry.isSelected ? "#059669" : MODEL_COLORS[entry.name] || "#94a3b8"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* CHART 3: RMSE COMPARISON */}
            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>Model RMSE (Lower is Better)</span>
                  <Badge variant="outline" className="text-[10px] font-bold text-slate-600">
                    {unit}
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-slate-500">Heavily penalizes occasional large error spikes.</p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelBarData} margin={{ top: 10, right: 10, left: -10, bottom: 35 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        stroke="#cbd5e1"
                        angle={-30}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#cbd5e1" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderRadius: "10px", color: "#fff", fontSize: "11px" }}
                        formatter={(val: any) => [`${val} ${unitLabel}`, "RMSE"]}
                      />
                      <Bar dataKey="rmse" radius={[4, 4, 0, 0]}>
                        {modelBarData.map((entry, index) => (
                          <Cell
                            key={`rmse-${index}`}
                            fill={entry.isSelected ? "#059669" : MODEL_COLORS[entry.name] || "#94a3b8"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* CHART 4: R² COMPARISON */}
            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>Model R² (Closer to 1.0 is Better)</span>
                  <Badge variant="outline" className="text-[10px] font-bold text-slate-600">
                    Ratio
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-slate-500">Proportion of variance explained by model.</p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelBarData} margin={{ top: 10, right: 10, left: -10, bottom: 35 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        stroke="#cbd5e1"
                        angle={-30}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} stroke="#cbd5e1" domain={[0, 1]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderRadius: "10px", color: "#fff", fontSize: "11px" }}
                        formatter={(val: any, _name: any, item: any) => [
                          item.payload.isNegativeR2
                            ? `${item.payload.r2} (Negative R² indicates worse than naive mean)`
                            : item.payload.r2,
                          "R² Score",
                        ]}
                      />
                      <Bar dataKey="r2_display" radius={[4, 4, 0, 0]}>
                        {modelBarData.map((entry, index) => (
                          <Cell
                            key={`r2-${index}`}
                            fill={
                              entry.isNegativeR2
                                ? "#ef4444"
                                : entry.isSelected
                                ? "#059669"
                                : MODEL_COLORS[entry.name] || "#94a3b8"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CHART 5: HOLDOUT TEST PERIOD ACTUAL VS PREDICTED */}
          {testComparisonData.length > 0 && (
            <Card className="rounded-2xl border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Scale className="size-5 text-blue-700" />
                      Holdout Test Period: Actual vs. Model Predictions ({unitLabel})
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Visual audit of model behavior during the chronological evaluation period (
                      {evalData.data?.test_period?.start_month} to {evalData.data?.test_period?.end_month}).
                      This confirms how closely each model matched real, unseen observations.
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs font-semibold">
                    Test Split Validation
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={testComparisonData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} stroke="#cbd5e1" />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} stroke="#cbd5e1" domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderRadius: "12px",
                          border: "none",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                      <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: "11px", paddingBottom: "8px" }} />
                      <Line
                        type="monotone"
                        dataKey="Actual"
                        name="Actual Ground Truth"
                        stroke="#0f172a"
                        strokeWidth={3}
                        dot={{ r: 5, fill: "#0f172a" }}
                      />
                      {evalData.models?.map((m) => (
                        <Line
                          key={m.name}
                          type="monotone"
                          dataKey={m.name}
                          name={m.name}
                          stroke={MODEL_COLORS[m.name] || "#94a3b8"}
                          strokeWidth={m.is_selected ? 2.5 : 1.5}
                          strokeDasharray={m.is_selected ? undefined : "3 3"}
                          dot={{ r: m.is_selected ? 4 : 2 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 7. CANDIDATE MODEL COMPARISON TABLE */}
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Database className="size-5 text-emerald-700" />
                    Candidate Model Performance & Selection Rationale
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chronological holdout split: {evalData.data?.training_observations} train months |{" "}
                    {evalData.data?.test_observations} test months.
                  </p>
                </div>
                {winningModel && (
                  <Badge className="bg-emerald-700 text-white font-semibold">
                    Winner: {winningModel.name}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-xs text-emerald-950 mb-4">
                <span className="font-semibold block mb-0.5">Selection Rationale:</span>
                {evalData.selection?.rationale}
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50/80">
                      <TableHead className="font-bold">Candidate Model</TableHead>
                      <TableHead className="font-bold">Model Family</TableHead>
                      <TableHead className="font-bold text-right">MAE ({unit})</TableHead>
                      <TableHead className="font-bold text-right">RMSE ({unit})</TableHead>
                      <TableHead className="font-bold text-right">R² Score</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {evalData.models?.map((m) => (
                      <TableRow
                        key={m.name}
                        className={m.is_selected ? "bg-emerald-50/50 font-semibold" : "hover:bg-slate-50/50"}
                      >
                        <TableCell className="font-medium flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full inline-block"
                            style={{ backgroundColor: MODEL_COLORS[m.name] || "#94a3b8" }}
                          />
                          {m.name}
                          {m.is_selected && (
                            <Badge className="bg-emerald-700 text-white text-[10px] py-0 px-1.5 font-bold">
                              Selected
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500">{m.model_type}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {m.mae !== null ? m.mae.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {m.rmse !== null ? m.rmse.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {m.r2 !== null ? (
                            <span className={m.r2 < 0 ? "text-red-600 font-bold" : "text-slate-800"}>
                              {m.r2.toFixed(3)}
                              {m.r2 < 0 ? " (!)" : ""}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={
                              m.status === "EVALUATED"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-red-50 text-red-800 border-red-200"
                            }
                          >
                            {m.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
