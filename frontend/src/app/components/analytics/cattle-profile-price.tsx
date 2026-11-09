"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Area, Brush, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Database, LineChart as LineChartIcon, RefreshCw, Scale, Table as TableIcon, TrendingUp } from "lucide-react";
import api from "@/lib/axios";
import { LivestockBreedField } from "@/components/livestock-breed-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type SpeciesReadiness = {
  species: { name: string; data_mode: "REAL" | "DEMO"; is_demo: boolean; complete_sales: number; recent_complete_weeks: number; recent_complete_sales: number; status: "INSUFFICIENT_DATA" | "PROFILE_REQUIRED" }[];
  required_sales: number;
  required_weeks: number;
  message: string;
};

type HistoryPoint = {
  date: string;
  recorded_price: number | null;
  similar_price: number | null;
  sales: number;
  similar_sales: number;
};
type ForecastPoint = {
  date: string;
  predicted_price: number;
  profile_min: number;
  profile_max: number;
  lower: number;
  upper: number;
};
type RegressionScore = {
  name: string;
  mae_php: number;
  rmse_php: number;
  r2: number | null;
};
type WeeklyForecast = {
  status: "forecast" | "unavailable";
  message: string;
  model: string;
  assumption: string;
  band_note: string;
  points: ForecastPoint[];
  horizon_weeks: number;
  training_cutoff?: string;
  validation_windows?: number;
  training_weeks?: number;
  training_sales?: number;
  mae_php?: number;
  rmse_php?: number;
  r2?: number | null;
  ridge_baseline_mae_php?: number;
  persistence_baseline_mae_php?: number;
  model_comparison?: RegressionScore[];
  per_horizon?: { week_ahead: number; mae_php: number; rmse_php: number; r2: number | null; comparisons: number }[];
  cutoffs?: { cutoff: string; mae_php: number; rmse_php: number; r2: number | null }[];
  validation_comparisons?: number;
  unique_validation_sales?: number;
  validation_period_start?: string;
  validation_period_end?: string;
  evaluation_note?: string;
};
type ChartPoint = Partial<HistoryPoint> & {
  date: string;
  forecast_price?: number;
  error_band?: [number, number];
};
type Result = {
  data_mode: "REAL" | "DEMO";
  is_demo: boolean;
  status: string;
  records: number;
  comparable_records: number;
  history: HistoryPoint[];
  message: string;
  estimated_price_php?: number;
  is_range: boolean;
  estimated_price_min_php?: number;
  estimated_price_max_php?: number;
  recorded_price_min_php?: number | null;
  recorded_price_max_php?: number | null;
  recorded_price_median_php?: number | null;
  mae_php?: number;
  model?: string;
  training_records?: number;
  validation_records?: number;
  period_start?: string;
  period_end?: string;
  models?: RegressionScore[];
  trait_baseline?: RegressionScore;
  forecast?: WeeklyForecast;
};

const money = (value: number) => value.toLocaleString("en-PH", {
  style: "currency", currency: "PHP", maximumFractionDigits: 0,
});
const dateLabel = (value?: string | null) => {
  // A loading/stale API response may not contain a cutoff yet. Never turn a
  // missing date into the literal "Invalid Date" in the page.
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Not available";
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  }) : "Not available";
};

const errorMoney = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-PH", {
  style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2,
}) : "Not available";
const r2Label = (value: number | null | undefined) => value != null && Number.isFinite(value) ? value.toFixed(6) : "Not available";

function ScoreTable({ rows, caption }: { rows: RegressionScore[]; caption: string }) {
  return <div className="overflow-x-auto">
    <table className="w-full text-left text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead><tr className="border-b border-slate-200"><th scope="col" className="py-2 pr-4">Method</th><th scope="col" className="py-2 pr-4">MAE / head</th><th scope="col" className="py-2 pr-4">RMSE / head</th><th scope="col" className="py-2">R²</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.name} className="border-b border-slate-100"><th scope="row" className="py-2 pr-4 font-medium">{row.name}</th><td className="py-2 pr-4 whitespace-nowrap">{errorMoney(row.mae_php)}</td><td className="py-2 pr-4 whitespace-nowrap">{errorMoney(row.rmse_php)}</td><td className="py-2">{r2Label(row.r2)}</td></tr>)}</tbody>
    </table>
  </div>;
}

function ModelPerformance({ result }: { result: Result }) {
  const forecast = result.forecast;
  // These are backend evaluation scores. Opening this view or zooming the graph
  // does not retrain the model or recompute scores from the displayed chart.
  return <details className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
    <summary className="cursor-pointer text-sm font-bold text-slate-900">Model performance (optional): MAE, RMSE, R²</summary>
    <div className="mt-4 space-y-5 text-sm text-slate-600">
      {result.is_demo && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950"><strong>Synthetic demonstration scores.</strong> The seed has deliberately constructed patterns. These values demonstrate the checks and do not measure real market accuracy.</p>}
      <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed">
        <li><strong>MAE:</strong> Average size of the price error in pesos per head. Lower is better.</li>
        <li><strong>RMSE:</strong> Price error in pesos per head, with more weight given to large mistakes. Lower is better.</li>
        <li><strong>R²:</strong> How much variation across evaluated sale prices the predictions explain. A score of 1 is perfect; 0 matches the evaluation-set mean; negative is worse. It is not percentage accuracy. Constant actual prices give no meaningful R².</li>
      </ul>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">Weekly forecast: rolling historical checks</h4>
        {forecast?.model_comparison?.length ? <>
          <ScoreTable rows={forecast.model_comparison} caption="Weekly forecast and baseline comparison" />
          <p className="text-xs">{forecast.validation_windows} cutoff checks | {forecast.unique_validation_sales} distinct sales | {forecast.validation_comparisons} prediction comparisons | Evaluation weeks: {dateLabel(forecast.validation_period_start)} - {dateLabel(forecast.validation_period_end)}</p>
          <p className="text-xs leading-relaxed">{forecast.evaluation_note} These describe the selected sale source, not an accuracy guarantee for one individual animal. Zooming the graph does not change these scores.</p>
          {forecast.per_horizon?.length ? <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="mb-2 text-left font-semibold text-slate-800">Error by forecast distance</caption>
              <thead><tr className="border-b border-slate-200"><th scope="col" className="py-2 pr-4">Weeks ahead</th><th scope="col" className="py-2 pr-4">MAE / head</th><th scope="col" className="py-2 pr-4">RMSE / head</th><th scope="col" className="py-2 pr-4">R²</th><th scope="col" className="py-2">Comparisons</th></tr></thead>
              <tbody>{forecast.per_horizon.map(row => <tr key={row.week_ahead} className="border-b border-slate-100"><td className="py-2 pr-4">{row.week_ahead}</td><td className="py-2 pr-4 whitespace-nowrap">{errorMoney(row.mae_php)}</td><td className="py-2 pr-4 whitespace-nowrap">{errorMoney(row.rmse_php)}</td><td className="py-2 pr-4">{r2Label(row.r2)}</td><td className="py-2">{row.comparisons}</td></tr>)}</tbody>
            </table>
          </div> : null}
          {forecast.cutoffs?.length ? <details className="rounded-lg border border-slate-100 p-3">
            <summary className="cursor-pointer text-xs font-semibold">See each historical cutoff</summary>
            <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Model retrained using records available before each cutoff</caption><thead><tr className="border-b"><th scope="col" className="py-2 pr-4">Training before</th><th scope="col" className="py-2 pr-4">MAE / head</th><th scope="col" className="py-2 pr-4">RMSE / head</th><th scope="col" className="py-2">R²</th></tr></thead><tbody>{forecast.cutoffs.map(row => <tr key={row.cutoff} className="border-b border-slate-100"><td className="py-2 pr-4 whitespace-nowrap">{dateLabel(row.cutoff)}</td><td className="py-2 pr-4 whitespace-nowrap">{errorMoney(row.mae_php)}</td><td className="py-2 pr-4 whitespace-nowrap">{errorMoney(row.rmse_php)}</td><td className="py-2">{r2Label(row.r2)}</td></tr>)}</tbody></table></div>
          </details> : null}
        </> : <p className="text-xs">Scores appear after enough valid historical checks are available. {forecast?.message}</p>}
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-slate-900">Trait-only estimates: separate later-sales check</h4>
        {result.models?.length ? <>
          <ScoreTable rows={[...result.models, ...(result.trait_baseline ? [result.trait_baseline] : [])]} caption="Trait-only model and median-price comparison" />
          <p className="text-xs">Earlier training sales: {result.training_records} | Later comparison sales: {result.validation_records}. These scores weight each sale equally and use a different evaluation from the weekly forecasts. Compare methods within each table.</p>
        </> : <p className="text-xs">Trait-only scores need enough complete sales and a supported animal profile.</p>}
      </section>
    </div>
  </details>;
}

const controlClass = "h-11 data-[size=default]:h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-2xs focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20";
const labelClass = "h-5 text-xs font-bold leading-5 text-slate-600";
const ageRanges = [
  ["1:11", "Under 1 year"], ["12:23", "1 to under 2 years"],
  ["24:47", "2 to under 4 years"], ["48:83", "4 to under 7 years"],
  ["84:119", "7 to under 10 years"], ["120:360", "10 years or older"],
] as const;
const weightRanges = [
  ["1:9.99", "Under 10 kg"], ["10:29.99", "10 to under 30 kg"],
  ["30:59.99", "30 to under 60 kg"], ["60:99.99", "60 to under 100 kg"],
  ["100:199.99", "100 to under 200 kg"], ["200:349.99", "200 to under 350 kg"],
  ["350:499.99", "350 to under 500 kg"], ["500:699.99", "500 to under 700 kg"],
  ["700:9999", "700 kg or more"],
] as const;

function traitPayload(selection: string, fields: FormData, exact: string, lower: string, upper: string): Record<string, number> {
  if (selection === "unknown") return {};
  if (selection === "exact") return { [exact]: Number(fields.get(exact)) };
  const [min, max] = selection === "custom"
    ? [Number(fields.get(lower)), Number(fields.get(upper))]
    : selection.split(":").map(Number);
  return { [lower]: min, [upper]: max };
}

export function CattleProfilePrice({ source }: { source: "REGISTERED" | "EXTERNAL" }) {
  const { user } = useAuth();
  const [species, setSpecies] = useState("Cattle");
  const [dataMode, setDataMode] = useState<"AUTO" | "REAL" | "DEMO">("AUTO");
  const speciesQuery = useQuery({
    queryKey: ["livestock-price-species", user?.email, user?.role, user?.accessScope, user?.assignedBarangayId, source, dataMode],
    enabled: Boolean(user),
    queryFn: async () => (await api.get<SpeciesReadiness>("analytics/predictive/livestock-price-species/", { params: { source, data_mode: dataMode } })).data,
  });
  const selectedSpecies = speciesQuery.data?.species.find((item) => item.name.toLowerCase() === species.toLowerCase());
  const [breed, setBreed] = useState("Brahman");
  const [sex, setSex] = useState("MALE");
  const [ageSelection, setAgeSelection] = useState("24:47");
  const [weightSelection, setWeightSelection] = useState("350:499.99");
  const [horizonWeeks, setHorizonWeeks] = useState(6);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoomRange, setZoomRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [showTableView, setShowTableView] = useState(false);
  const [tablePage, setTablePage] = useState(0);
  const clearResult = () => { setResult(null); setError(""); setZoomRange(null); };

  // History is observed data; future points come only from the forecast API.
  // Insert empty calendar weeks so gaps are visible instead of compressing time.
  const chartData = useMemo(() => {
    if (!result) return [];
    const byDate = new Map<string, ChartPoint>();
    for (const point of result.history) byDate.set(point.date, point);
    for (const point of result.forecast?.points ?? []) {
      byDate.set(point.date, {
        date: point.date, forecast_price: point.predicted_price,
        error_band: [point.lower, point.upper],
      });
    }
    const dates = [...byDate.keys()].sort();
    if (!dates.length) return [];
    const points: ChartPoint[] = [];
    const cursor = new Date(`${dates[0]}T00:00:00Z`);
    const end = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
    while (cursor <= end) {
      const day = cursor.toISOString().slice(0, 10);
      points.push(byDate.get(day) ?? { date: day });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return points;
  }, [result]);

  // The brush changes only the visible date window, not the backend forecast.
  // Quick views retain the future points so the projection stays easy to see.
  const lastChartIndex = Math.max(0, chartData.length - 1);
  const zoomStart = Math.min(zoomRange?.startIndex ?? 0, lastChartIndex);
  const zoomEnd = Math.max(zoomStart, Math.min(zoomRange?.endIndex ?? lastChartIndex, lastChartIndex));
  const isZoomed = zoomStart > 0 || zoomEnd < lastChartIndex;
  const tablePageSize = 10;
  const tableRowCount = Math.max(0, zoomEnd - zoomStart + 1);
  const tablePageCount = Math.max(1, Math.ceil(tableRowCount / tablePageSize));
  const currentTablePage = Math.min(tablePage, tablePageCount - 1);
  const visibleTableRows = chartData.slice(
    zoomStart + currentTablePage * tablePageSize,
    Math.min(zoomEnd + 1, zoomStart + (currentTablePage + 1) * tablePageSize),
  );
  const showRecentWeeks = (weeks: number) => {
    let historyEnd = lastChartIndex;
    while (historyEnd > 0 && chartData[historyEnd]?.recorded_price == null && chartData[historyEnd]?.similar_price == null) historyEnd -= 1;
    setZoomRange({ startIndex: Math.max(0, historyEnd - weeks + 1), endIndex: lastChartIndex });
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    if (!breed.trim()) {
      setError("Select a livestock breed or enter a custom breed.");
      return;
    }
    const age = traitPayload(ageSelection, fields, "age_months", "age_min_months", "age_max_months");
    const weight = traitPayload(weightSelection, fields, "weight_kg", "weight_min_kg", "weight_max_kg");
    if ((age.age_min_months !== undefined && age.age_min_months > age.age_max_months) ||
        (weight.weight_min_kg !== undefined && weight.weight_min_kg > weight.weight_max_kg)) {
      setError("The minimum age or weight must not exceed the maximum.");
      return;
    }
    setLoading(true);
    setResult(null);
    setZoomRange(null);
    setTablePage(0);
    setError("");
    try {
      const { data } = await api.post<Result>("analytics/predictive/livestock-profile-price/", {
        source, species, sex, breed: breed.trim(), ...age, ...weight, horizon_weeks: horizonWeeks, data_mode: dataMode,
      });
      setResult(data);
    } catch {
      setError("Could not prepare the price comparison. Check your inputs and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-800"><TrendingUp className="size-4" aria-hidden="true" /></div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Livestock price forecast</h2>
          </div>
          <p className="max-w-2xl text-xs leading-relaxed text-slate-500">Compare recorded prices and estimate future weekly prices for your selected animal profile.</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>Source: <strong className="text-slate-700">{source === "REGISTERED" ? "Registered" : "External"}</strong></span>
            <span>Unit: <strong className="text-slate-700">PHP / head</strong></span>
            <span>Interval: <strong className="text-slate-700">Weekly</strong></span>
          </div>
        </div>
        <span className="self-start rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{species}</span>
      </div>
      <div className="space-y-5 p-4 sm:p-5">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600"><Database className="size-3.5 text-emerald-700" aria-hidden="true" /> Sales history &amp; readiness</div>
          <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="livestock-price-data-mode" className={labelClass}>Sales data</Label>
            <Select value={dataMode} disabled={loading} onValueChange={(value) => { if (value === "AUTO" || value === "REAL" || value === "DEMO") { setDataMode(value); clearResult(); } }}>
              <SelectTrigger id="livestock-price-data-mode" className={controlClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Automatic — recorded sales, otherwise demo</SelectItem>
                <SelectItem value="DEMO">Demo sales</SelectItem>
                <SelectItem value="REAL">Recorded real sales</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="livestock-price-species" className={labelClass}>Livestock species</Label>
            <Select value={selectedSpecies?.name ?? species} disabled={loading || speciesQuery.isPending} onValueChange={(value) => {
              setSpecies(value);
              setBreed(value.toLowerCase() === "cattle" ? "Brahman" : "");
              setAgeSelection(value.toLowerCase() === "cattle" ? "24:47" : "unknown");
              setWeightSelection(value.toLowerCase() === "cattle" ? "350:499.99" : "unknown");
              setTablePage(0);
              clearResult();
            }}>
              <SelectTrigger id="livestock-price-species" className={controlClass}><SelectValue placeholder="Choose a species" /></SelectTrigger>
              <SelectContent>{speciesQuery.data?.species.filter((item) => !["sheep", "poultry", "swine"].includes(item.name.trim().toLowerCase())).map((item) => <SelectItem key={item.name} value={item.name}>
                {item.name}{item.is_demo ? " (Demo)" : ""} — {item.status === "INSUFFICIENT_DATA" ? "Insufficient data" : "Check profile"}
              </SelectItem>)}</SelectContent>
            </Select>
          </div>
          </div>
          {speciesQuery.isPending ? <p role="status" className="text-sm text-slate-600">Checking recorded sales for each species…</p> : null}
          {speciesQuery.isError ? <div role="alert" className="text-sm text-rose-700">Could not load species readiness. <button type="button" onClick={() => void speciesQuery.refetch()} className="underline">Try again</button></div> : null}
          {selectedSpecies && speciesQuery.data ? <div aria-live="polite" className="space-y-1 text-sm text-slate-700">
            {selectedSpecies.is_demo ? <p className="font-semibold text-amber-800">Using synthetic demo sales for {selectedSpecies.name}. Forecasts and scores demonstrate the model, not actual market accuracy.</p> : null}
            <p className="font-semibold">{selectedSpecies.name}: {selectedSpecies.status === "INSUFFICIENT_DATA" ? "Insufficient data for a future price forecast" : "History requirements met — select a profile to check the forecast"}</p>
            <div className="grid gap-3 py-3 sm:grid-cols-3">
              {[
                { label: "Recent complete sales", value: selectedSpecies.recent_complete_sales.toLocaleString(), note: `${speciesQuery.data.required_sales} required`, icon: Database },
                { label: "Consecutive weeks", value: selectedSpecies.recent_complete_weeks.toLocaleString(), note: `${speciesQuery.data.required_weeks} required`, icon: CalendarDays },
                { label: "Complete sales overall", value: selectedSpecies.complete_sales.toLocaleString(), note: selectedSpecies.is_demo ? "Synthetic demo records" : "Recorded real sales", icon: Scale },
              ].map(({ label, value, note, icon: Icon }) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-slate-500">{label}</span><Icon className="size-4 shrink-0 text-emerald-600" aria-hidden="true" /></div>
                <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">{value}</p>
                <p className="mt-1 text-[11px] text-slate-500">{note}</p>
              </div>)}
            </div>
            <p className="text-xs text-slate-500">{speciesQuery.data.message} Prices use PHP per head; species and pricing units are kept separate.</p>
          </div> : null}
        </div>
        {result?.is_demo && <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><strong>Using synthetic sample sales.</strong> The graph uses the selected marked demo sales. Prices and error scores are demonstration examples. Automatic mode prefers real sales; choose Demo sales to inspect sample records separately.</div>}
        <form onSubmit={submit} onChange={clearResult} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600"><Scale className="size-3.5 text-emerald-700" aria-hidden="true" /> Animal profile</div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2.5" role="group" aria-label="Profile price forecast horizon">
            <span className="mr-1 text-sm font-medium text-slate-700">Forecast ahead:</span>
            {[1, 3, 6, 12].map(weeks => (
              <button key={weeks} type="button" disabled={loading} aria-pressed={horizonWeeks === weeks} onClick={() => { setHorizonWeeks(weeks); clearResult(); }} className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${horizonWeeks === weeks ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
                {weeks} {weeks === 1 ? "week" : "weeks"}
              </button>
            ))}
          </div>
          <fieldset disabled={loading} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="cattle-price-sex" className={labelClass}>Sex</Label>
              <Select value={sex} onValueChange={(value) => { setSex(value); clearResult(); }} disabled={loading}>
                <SelectTrigger id="cattle-price-sex" className={controlClass}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="MALE">Male</SelectItem><SelectItem value="FEMALE">Female</SelectItem></SelectContent>
              </Select>
            </div>
            <LivestockBreedField
              id="cattle-price-breed"
              species={species}
              key={species}
              value={breed}
              required
              controlClassName={controlClass}
              labelClassName={labelClass}
              onChange={(value) => {
                setBreed(value);
                setResult(null);
                setError("");
              }}
            />
            <div className="space-y-1.5">
              <Label htmlFor="cattle-price-age" className={labelClass}>Age at sale</Label>
              <Select value={ageSelection} onValueChange={(value) => { setAgeSelection(value); clearResult(); }} disabled={loading}>
                <SelectTrigger id="cattle-price-age" className={controlClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Any / unknown age</SelectItem>
                  {ageRanges.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  <SelectItem value="exact">Enter exact age</SelectItem>
                  <SelectItem value="custom">Enter a range</SelectItem>
                </SelectContent>
              </Select>
              {ageSelection === "exact" && <input aria-label="Exact age in months" name="age_months" type="number" required min={1} max={360} placeholder="Age in months" className={controlClass} />}
              {ageSelection === "custom" && <div className="flex gap-2">
                <input aria-label="Minimum age in months" name="age_min_months" type="number" required min={1} max={360} placeholder="Min months" className={`${controlClass} min-w-0`} />
                <input aria-label="Maximum age in months" name="age_max_months" type="number" required min={1} max={360} placeholder="Max months" className={`${controlClass} min-w-0`} />
              </div>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cattle-price-weight" className={labelClass}>Weight at sale</Label>
              <Select value={weightSelection} onValueChange={(value) => { setWeightSelection(value); clearResult(); }} disabled={loading}>
                <SelectTrigger id="cattle-price-weight" className={controlClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Any / unknown weight</SelectItem>
                  {weightRanges.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  <SelectItem value="exact">Enter exact weight</SelectItem>
                  <SelectItem value="custom">Enter a range</SelectItem>
                </SelectContent>
              </Select>
              {weightSelection === "exact" && <input aria-label="Exact weight in kilograms" name="weight_kg" type="number" required min={1} max={9999} step="0.01" placeholder="Weight in kg" className={controlClass} />}
              {weightSelection === "custom" && <div className="flex gap-2">
                <input aria-label="Minimum weight in kilograms" name="weight_min_kg" type="number" required min={1} max={9999} step="0.01" placeholder="Min kg" className={`${controlClass} min-w-0`} />
                <input aria-label="Maximum weight in kilograms" name="weight_max_kg" type="number" required min={1} max={9999} step="0.01" placeholder="Max kg" className={`${controlClass} min-w-0`} />
              </div>}
            </div>
            <p className="text-xs leading-relaxed text-slate-500 sm:col-span-2 lg:col-span-4">Select the traits of the livestock you are comparing. All prices are in pesos per head and use only the selected species and sale source. Not sure of exact values? Choose a range or Any / unknown to view recorded comparisons.</p>
            <button disabled={loading} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-emerald-800 disabled:opacity-50 sm:col-span-2 lg:col-span-4">
              {loading && <RefreshCw className="size-4 animate-spin" />}
              {loading ? "Checking history and past forecasts..." : ageSelection === "unknown" || weightSelection === "unknown" ? "Show recorded price comparison" : "Show price history & weekly forecast"}
            </button>
          </fieldset>
        </form>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><LineChartIcon className="size-4 text-emerald-700" aria-hidden="true" /> Livestock prices over time</h3>
            {chartData.length > 0 && <button
              type="button"
              onClick={() => setShowTableView(value => !value)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              aria-label={showTableView ? "Show visual chart" : "Inspect numbers"}
            >
              {showTableView ? <LineChartIcon aria-hidden="true" className="size-4 text-emerald-700" /> : <TableIcon aria-hidden="true" className="size-4 text-emerald-700" />}
              {showTableView ? "Show Visual Chart" : "Inspect Numbers"}
            </button>}
          </div>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p><strong className="text-slate-700">Gray line:</strong> Average price of all livestock in the selected {source === "REGISTERED" ? "Registered" : "External"} sale records, including other breeds, sexes, ages, and weights.</p>
            <p><strong className="text-teal-800">Teal line:</strong> Average price of only the animals matching the breed, sex, age, and weight you selected.</p>
          </div>
          <details className="mt-2 text-xs text-slate-500">
            <summary className="w-fit cursor-pointer font-medium">How animals are matched</summary>
            <p className="mt-1 leading-relaxed">Only approved sales with complete price and trait details are included. Selected ranges use their stated limits. An exact age includes animals within 12 months of that age; an exact weight allows a 15% difference. Any / unknown includes all recorded values for that trait. A gap means there were no matching records that week. The current week may be incomplete.</p>
          </details>
        </div>
        {chartData.length ? showTableView ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="px-3 py-3 font-mono font-medium">Period</th>
                    <th scope="col" className="px-3 py-3 font-mono font-medium">Record type</th>
                    <th scope="col" className="px-3 py-3 text-right font-mono font-medium">Average price of all livestock</th>
                    <th scope="col" className="px-3 py-3 text-right font-mono font-medium">Average price of matching livestock</th>
                    <th scope="col" className="px-3 py-3 text-right font-mono font-medium">Profile estimate</th>
                    <th scope="col" className="px-3 py-3 text-right font-mono font-medium">Low estimate</th>
                    <th scope="col" className="px-3 py-3 text-right font-mono font-medium">High estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTableRows.map(row => {
                    const hasForecast = row.forecast_price != null;
                    const hasHistory = row.recorded_price != null || row.similar_price != null;
                    return <tr key={row.date} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <th scope="row" className="whitespace-nowrap px-3 py-3 font-mono font-semibold text-slate-900">Week of {dateLabel(row.date)}</th>
                      <td className="px-3 py-3">{hasForecast ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-mono text-emerald-800">Forecast</span> : <span className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-mono text-slate-600">{hasHistory ? "Historical" : "No records"}</span>}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-slate-700">{row.recorded_price != null ? money(row.recorded_price) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-slate-700">{row.similar_price != null ? money(row.similar_price) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold text-emerald-700">{row.forecast_price != null ? money(row.forecast_price) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-slate-500">{row.error_band ? money(row.error_band[0]) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-slate-500">{row.error_band ? money(row.error_band[1]) : "—"}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 py-2.5 text-sm text-slate-600">
              <span>Showing {tableRowCount ? currentTablePage * tablePageSize + 1 : 0}–{Math.min((currentTablePage + 1) * tablePageSize, tableRowCount)} of {tableRowCount} weeks</span>
              <div className="flex items-center gap-3">
                <button type="button" disabled={currentTablePage === 0} onClick={() => setTablePage(currentTablePage - 1)} className="rounded-md border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span>Page {currentTablePage + 1} of {tablePageCount}</span>
                <button type="button" disabled={currentTablePage + 1 >= tablePageCount} onClick={() => setTablePage(currentTablePage + 1)} className="rounded-md border border-slate-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Chart date zoom">
                <button type="button" onClick={() => showRecentWeeks(8)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50">Forecast focus</button>
                <button type="button" onClick={() => showRecentWeeks(26)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50">Past 26 weeks + forecast</button>
                <button type="button" onClick={() => showRecentWeeks(52)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50">Past 52 weeks + forecast</button>
                <button type="button" onClick={() => setZoomRange(null)} disabled={!isZoomed} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50">Reset zoom</button>
              </div>
              <p className="text-xs font-semibold text-slate-600" aria-live="polite">{dateLabel(chartData[zoomStart]?.date)} - {dateLabel(chartData[zoomEnd]?.date)}</p>
            </div>
          <div className="h-80 w-full sm:h-96" role="img" aria-label="Recorded weekly livestock prices and future prices for the selected fixed profile">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 25, right: 20, bottom: 20, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={45} tick={{ fontSize: 11 }} />
                <YAxis width={75} domain={isZoomed ? ["auto", "auto"] : [0, "auto"]} tickFormatter={(value: number) => money(value)} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(value) => `Week starting ${dateLabel(String(value))}`} formatter={(value, name) => [Array.isArray(value) ? `${money(Number(value[0]))} - ${money(Number(value[1]))}` : money(Number(value)), String(name)]} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12, lineHeight: "20px", paddingBottom: 12 }} />
                <Area dataKey="error_band" name="Past-error band + profile span" stroke="none" fill="#10b981" fillOpacity={0.15} connectNulls={false} />
                <Line dataKey="recorded_price" name="Average price of all livestock" stroke="#94a3b8" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                <Line dataKey="similar_price" name="Average price of matching livestock" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                <Line dataKey="forecast_price" name="Fixed-profile weekly forecast" stroke="#059669" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 4 }} connectNulls={false} />
                {result?.forecast?.points[0] && <ReferenceLine x={result.forecast.points[0].date} stroke="#d97706" strokeDasharray="3 3" label={{ value: "Forecast starts", position: "insideTopRight", fill: "#b45309", fontSize: 11 }} />}
                <Brush
                  dataKey="date"
                  height={32}
                  travellerWidth={10}
                  stroke="#059669"
                  fill="#f8fafc"
                  tickFormatter={dateLabel}
                  startIndex={zoomStart}
                  endIndex={zoomEnd}
                  onChange={({ startIndex, endIndex }) => {
                    if (startIndex === undefined || endIndex === undefined) return;
                    setZoomRange(previous => previous?.startIndex === startIndex && previous?.endIndex === endIndex ? previous : { startIndex, endIndex });
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
            <p className="text-xs text-slate-500">Drag the green handles below the graph to zoom into dates, or drag the selected window to move it. The price scale adjusts when zoomed.</p>
          </div>
        ) : (
          <div role="status" className="grid h-64 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            {loading ? "Loading recorded price history..." : result ? result.is_demo ? "No livestock-price demo seed records were found for this source." : "No eligible real livestock prices are available to plot for this source." : "Enter an animal profile to load the price history graph."}
          </div>
        )}
        {result?.forecast && (
          <div aria-live="polite" className={`space-y-3 rounded-xl border p-4 ${result.forecast.status === "forecast" ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}>
            <h3 className="font-bold text-slate-900">{result.is_demo ? "Synthetic demo: " : ""}{result.forecast.status === "forecast" ? `${result.forecast.horizon_weeks}-week profile price forecast` : "Weekly forecast not available yet"}</h3>
            <p className="text-sm">{result.forecast.message}</p>
            <p className="text-xs text-slate-600">{result.forecast.assumption} Future weeks start next Monday. {result.forecast.training_cutoff && dateLabel(result.forecast.training_cutoff) !== "Not available" ? `Training uses records available before ${dateLabel(result.forecast.training_cutoff)}.` : "Training date is not available yet."}</p>
            {result.forecast.training_sales !== undefined && <p className="text-xs text-slate-600">Historical checks: {result.forecast.validation_windows} | Training: {result.forecast.training_sales} sales over {result.forecast.training_weeks} weeks. Error scores are in Model performance below.</p>}
            {result.forecast.status === "forecast" && <>
              <p className="text-xs text-slate-600">{result.forecast.band_note}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">Future weekly prices and past-error bands</caption>
                  <thead><tr className="border-b border-slate-200 bg-white/70 text-slate-600"><th scope="col" className="py-2 pr-4">Week starting</th><th scope="col" className="py-2 pr-4">{result.is_range ? "Scenario center" : "Price per head"}</th><th scope="col" className="py-2">Past-error band + profile span</th></tr></thead>
                  <tbody>{result.forecast.points.map(point => <tr key={point.date} className="border-b border-slate-200/70"><td className="py-2 pr-4 whitespace-nowrap">{dateLabel(point.date)}</td><td className="py-2 pr-4">{money(point.predicted_price)}</td><td className="py-2 whitespace-nowrap">{money(point.lower)} - {money(point.upper)}</td></tr>)}</tbody>
                </table>
              </div>
            </>}
          </div>
        )}
        {result && (
          <div aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
            <h3 className="font-bold">{result.status === "estimated" ? result.is_range ? "Trait-only price span (before weekly adjustment)" : "Trait-only price estimate (before weekly adjustment)" : result.status === "history_only" ? "Recorded price comparison" : "Trait-only estimate unavailable"}</h3>
            {result.estimated_price_php !== undefined && <p className="text-3xl font-bold text-emerald-800">{money(result.estimated_price_php)}</p>}
            {result.estimated_price_min_php !== undefined && result.estimated_price_max_php !== undefined && <p className="text-2xl font-bold text-emerald-800">{money(result.estimated_price_min_php)} - {money(result.estimated_price_max_php)} per head</p>}
            <p className="text-sm">{result.message}</p>
            <p className="text-sm">Complete {result.is_demo ? "synthetic demo" : "real"} sales: {result.records} | Animals matching your selections: {result.comparable_records}</p>
            {result.recorded_price_min_php != null && result.recorded_price_max_php != null && <p className="text-sm">{result.is_demo ? "Synthetic matching prices" : "Recorded matching prices"}: {money(result.recorded_price_min_php)} - {money(result.recorded_price_max_php)} per head. Median: {money(result.recorded_price_median_php ?? 0)}. {result.is_demo ? "Constructed demonstration values." : "These are historical sale values."}</p>}
            {result.model && <p className="text-sm">Method: {result.model}. Error scores are in Model performance below.</p>}
            {result.period_start && <p className="text-xs">Records: {result.period_start} to {result.period_end} | Earlier training sales: {result.training_records} | Later comparison sales: {result.validation_records}</p>}
          </div>
        )}
        {result && <ModelPerformance result={result} />}
        <p className="text-xs text-slate-500">History covers up to 104 recorded weeks. Ridge learns the relationship between traits and price; ARIMA forecasts the remaining weekly price movement. Automatic mode prefers real approved sales and falls back to marked demo sales when none are present. You can also choose Demo sales directly. Synthetic samples are labelled and kept separate from real-sales training.</p>
      </div>
    </section>
  );
}
