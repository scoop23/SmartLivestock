"use client";

import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Award,
  BarChart2,
  Calendar,
  CheckCircle2,
  Cpu,
  Database,
  HelpCircle,
  Info,
  Layers,
  LineChart as LineChartIcon,
  RefreshCw,
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

interface EvaluationResponse {
  status: "ready" | "insufficient_data" | "error";
  message?: string;
  target?: {
    production_type: string;
    unit: string;
    frequency: string;
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
    };
  };
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
  model?: string;
  target?: {
    production_type: string;
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
}

export default function PredictiveAnalyticsView() {
  const [productionType, setProductionType] = useState<string>("MILK");
  const [unit, setUnit] = useState<string>("LITERS");
  const [horizon, setHorizon] = useState<number>(6);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const [evalData, setEvalData] = useState<EvaluationResponse | null>(null);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [forecastLoading, setForecastLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

  // Fetch model comparison evaluation
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api
      .get<EvaluationResponse>("analytics/predictive/", {
        params: { production_type: productionType, unit },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!active) return;
        setEvalData(data);
        if (data.status === "ready" && data.selection?.selected_model) {
          setSelectedModel(data.selection.selected_model);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          setError("Failed to load predictive model evaluation. Please verify server connectivity.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [productionType, unit, refreshTrigger]);

  // Fetch future forecast whenever selectedModel or horizon changes
  useEffect(() => {
    if (evalData?.status !== "ready") return;

    let active = true;
    const controller = new AbortController();
    setForecastLoading(true);

    api
      .get<ForecastResponse>("analytics/predictive/forecast/", {
        params: {
          production_type: productionType,
          unit,
          horizon,
          model: selectedModel || undefined,
        },
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
  }, [productionType, unit, horizon, selectedModel, evalData?.status]);

  if (loading) {
    return (
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
    );
  }

  if (error) {
    return (
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
    );
  }

  // Insufficient Data State Handling
  if (evalData?.status === "insufficient_data") {
    return (
      <div className="space-y-6">
        <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3 text-amber-900">
              <div className="rounded-xl bg-amber-200 p-2.5">
                <AlertTriangle className="size-6 text-amber-800" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-amber-950">
                  Insufficient Approved Historical Production Data
                </CardTitle>
                <p className="text-sm text-amber-800 mt-1">
                  Honest Model Evaluation Policy: SmartLivestock never fabricates predictive scores or displays mock forecasts.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-amber-900 text-sm">
            <div className="rounded-xl bg-white/80 p-4 border border-amber-200 space-y-2">
              <p className="font-semibold text-slate-800">
                Why is the model not predicting?
              </p>
              <p className="text-slate-600 leading-relaxed">
                {evalData.message}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Target Commodity:</span>
                  <span className="font-bold text-slate-800">{productionType} ({unit})</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Available Monthly Observations:</span>
                  <span className="font-bold text-amber-800">{evalData.data?.total_monthly_observations ?? 0} months</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Minimum Required:</span>
                  <span className="font-bold text-slate-800">12 consecutive months</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-900 text-slate-100 p-4 text-xs font-mono space-y-2">
              <p className="font-sans font-semibold text-emerald-400">
                🛠️ Capstone Development & Testing Instructions:
              </p>
              <p className="text-slate-300 font-sans text-xs">
                To test the predictive analytics pipeline, deterministic model evaluation, and forecasting UI safely:
              </p>
              <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <code>python manage.py seed_productions --months 36</code>
              </div>
              <p className="text-slate-400 font-sans text-[11px]">
                This command generates 36 months of realistic synthetic monthly records marked with <code>AI_SEED::PREDICTIVE_ANALYTICS::V1</code>.
                When finished, remove ONLY the test records with: <code>python manage.py seed_productions --clean</code>. Real farmer data is never touched.
              </p>
            </div>

            <Button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              variant="outline"
              className="border-amber-300 hover:bg-amber-100 text-amber-900"
            >
              <RefreshCw className="mr-2 size-4" /> Check for New Approved Records
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSeeded = evalData?.data?.is_seeded ?? false;
  const models = evalData?.models ?? [];
  const meta = forecastData?.metadata;
  const chartData = forecastData?.chart_data ?? [];

  return (
    <div className="space-y-6">
      {/* 1. SEED DATA WARNING BANNER */}
      {isSeeded && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-l-4 border-amber-500 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Seeded Test Dataset Active (Development & Evaluation Mode)
              </p>
              <p className="text-xs text-amber-700">
                Records carry deterministic marker <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">{evalData?.data?.seed_marker}</code>. Run <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">manage.py seed_productions --clean</code> to revert to authoritative real data.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
            Test Bench
          </Badge>
        </div>
      )}

      {/* 2. EXECUTIVE METRICS & CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-600 p-1.5 text-white">
                <Sparkles className="size-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Municipal Production Forecasting & Model Benchmark
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real chronological out-of-sample evaluation comparing Naive, Linear Regression, Random Forest, ARIMA, and Holt-Winters.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <span className="px-2.5 py-1 text-slate-500">Horizon:</span>
              {[3, 6, 12].map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    horizon === h
                      ? "bg-white font-bold text-slate-900 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  +{h}m
                </button>
              ))}
            </div>

            <Button
              onClick={() => setRefreshTrigger((p) => p + 1)}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <RefreshCw className="size-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Target Commodity & Unit
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {productionType}
              </span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {unit}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Monthly Aggregated Series
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Historical Observations
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {evalData?.data?.total_observations}
              </span>
              <span className="text-xs text-slate-600">months</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Train: {evalData?.data?.training_observations}m | Test: {evalData?.data?.test_observations}m
            </span>
          </div>

          <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-200">
            <span className="text-xs font-medium text-emerald-900 block mb-1 flex items-center gap-1">
              <Award className="size-3.5 text-emerald-600" /> Selected Forecasting Model
            </span>
            <span className="text-xl font-bold text-emerald-950 block truncate">
              {selectedModel || evalData?.selection?.selected_model}
            </span>
            <span className="text-[11px] text-emerald-700 mt-1 block">
              Criterion: {evalData?.selection?.criterion}
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Projected {horizon}-Month Outlook
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold ${
                  (meta?.projected_change_pct ?? 0) >= 0 ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {(meta?.projected_change_pct ?? 0) >= 0 ? "+" : ""}
                {meta?.projected_change_pct}%
              </span>
              {(meta?.projected_change_pct ?? 0) >= 0 ? (
                <TrendingUp className="size-4 text-emerald-600" />
              ) : (
                <TrendingDown className="size-4 text-amber-600" />
              )}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Avg: {meta?.forecast_period_avg} {unit} vs Baseline {meta?.recent_baseline_avg} {unit}
            </span>
          </div>
        </div>
      </div>

      {/* 3. FORECAST TIMELINE CHART */}
      <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <LineChartIcon className="size-4 text-emerald-600" />
                Historical Recorded Yield vs. Out-of-Sample Forecast
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Solid line represents approved historical actuals; dashed line represents future {selectedModel} forecast.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white text-slate-700 font-mono text-[11px]">
                Model: {selectedModel}
              </Badge>
              <Badge variant="outline" className="bg-white text-slate-700 font-mono text-[11px]">
                {unit}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {forecastLoading ? (
            <div className="h-72 flex items-center justify-center">
              <div className="flex items-center gap-3 text-slate-500 text-sm">
                <RefreshCw className="size-5 animate-spin text-emerald-600" />
                Generating {selectedModel} forecast projection...
              </div>
            </div>
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month_label"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    angle={-30}
                    textAnchor="end"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    label={{
                      value: `Output (${unit})`,
                      angle: -90,
                      position: "insideLeft",
                      fontSize: 11,
                      fill: "#64748b",
                    }}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      val !== null ? `${val} ${unit}` : "N/A",
                      name === "actual" ? "Historical Actual" : "Forecast Projection",
                    ]}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: "10px", fontSize: "12px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Historical Actual"
                    stroke="#2D5A27"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#2D5A27" }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Forecast Projection"
                    stroke="#D97706"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: "#D97706" }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Quick Forecast Numerical Breakdown */}
          {forecastData?.forecast && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Out-of-Sample Forecasted Months:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {forecastData.forecast.map((pt) => (
                  <div
                    key={pt.date}
                    className="bg-amber-50/50 border border-amber-200/60 rounded-lg p-2 text-center"
                  >
                    <span className="text-[11px] text-slate-500 block">{pt.month_label}</span>
                    <span className="text-sm font-bold text-amber-900">
                      {pt.predicted} <span className="text-[10px] font-normal text-slate-500">{unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. MODEL COMPARISON BENCHMARK TABLE */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BarChart2 className="size-4 text-indigo-600" />
                Fair Model Evaluation Benchmark ({evalData?.data?.test_observations} Unseen Test Months)
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Every candidate model is evaluated on the exact same chronological test split ({evalData?.data?.test_period?.start_month} to {evalData?.data?.test_period?.end_month}).
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMethodology(!showMethodology)}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              <HelpCircle className="size-3.5 mr-1" />
              {showMethodology ? "Hide Guide" : "Evaluation Guide"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="font-bold text-slate-700 text-xs">Model Name</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Architecture</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-right">
                    MAE ({unit})
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-right">
                    RMSE ({unit})
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-right">R²</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs">Validation Status</TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((m) => {
                  const isCurrentActive = selectedModel === m.name;
                  const isAutoWinner = m.is_selected;

                  return (
                    <TableRow
                      key={m.name}
                      className={isCurrentActive ? "bg-emerald-50/40" : undefined}
                    >
                      <TableCell className="font-semibold text-slate-900 text-xs">
                        <div className="flex items-center gap-1.5">
                          {isAutoWinner && (
                            <span title="Best Validation Score">
                              <Award className="size-4 text-emerald-600" />
                            </span>
                          )}
                          <span>{m.name}</span>
                          {isCurrentActive && (
                            <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-1.5">
                              Active
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs font-mono">
                        {m.model_type}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900 text-xs">
                        {m.mae !== null ? m.mae.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-700 text-xs">
                        {m.rmse !== null ? m.rmse.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-700 text-xs">
                        {m.r2 !== null ? m.r2.toFixed(4) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          {m.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant={isCurrentActive ? "default" : "outline"}
                          className={`text-xs h-7 px-2.5 ${
                            isCurrentActive
                              ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                          onClick={() => setSelectedModel(m.name)}
                        >
                          {isCurrentActive ? "Projecting" : "Use Model"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Educational Methodology Drawer / Card */}
          {showMethodology && (
            <div className="p-5 bg-slate-50 border-t border-slate-200 text-xs text-slate-700 space-y-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Info className="size-4 text-blue-600" />
                How Model Evaluation Works in SmartLivestock
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-800 block mb-1">
                    1. Chronological Split (No Data Leakage)
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    Data is split chronologically: the oldest {evalData?.data?.training_observations} months form the training set, and the newest {evalData?.data?.test_observations} months form the unseen test set. We never randomly shuffle time series data because future observations would leak into training.
                  </p>
                </div>
                <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-800 block mb-1">
                    2. MAE vs. RMSE Error Metrics
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    <strong>MAE (Mean Absolute Error)</strong> measures the average distance from true production in {unit}. <strong>RMSE (Root Mean Squared Error)</strong> squares errors before taking the root, heavily penalizing large individual prediction mistakes.
                  </p>
                </div>
                <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-800 block mb-1">
                    3. Why We Don&apos;t Say &quot;Accuracy %&quot;
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    Accuracy is a classification metric (e.g. healthy vs. sick). In continuous yield forecasting, exact decimal hits are impossible. Regression uses MAE, RMSE, and R² to measure how close predictions are to actual quantities.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
