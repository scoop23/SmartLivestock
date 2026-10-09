"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CloudSun, LoaderCircle, Milk, RotateCcw, Sparkles } from "lucide-react";
import {
  Bar,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MilkForecastResponse = {
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
};

// THI combines air temperature and humidity into an environmental heat-load
// context for cattle. It is not a diagnosis or a measurement of the animal.
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

/** Render the selected animal's approved-record forecast and optional explicit demo view. */
export function LivestockMilkForecastTab({ livestockId }: { livestockId: number }) {
  // Synthetic data is an explicit view choice; it is never used as a fallback for real records.
  const [showDemo, setShowDemo] = useState(false);
  // React Query keeps real and demo responses under different cache keys, so switching
  // sources cannot accidentally keep showing the previous source's chart or readiness.
  const { data, isLoading, error } = useQuery({
    queryKey: ["livestock-milk-forecast", livestockId, showDemo ? "synthetic_demo" : "approved_livestock_records"],
    queryFn: async () => (await api.get<MilkForecastResponse>(
      `analytics/livestock/${livestockId}/milk-forecast/`,
      { timeout: 60_000, params: showDemo ? { source: "synthetic_demo" } : undefined },
    )).data,
    enabled: Number.isInteger(livestockId) && livestockId > 0,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-36 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-600">
        <LoaderCircle className="size-4 animate-spin" /> Loading this animal’s milk forecast…
      </div>
    );
  }

  if (error || !data) {
    const status = (error as { response?: { status?: number; data?: { detail?: string } } } | null)
      ?.response?.status;
    const detail = (error as { response?: { data?: { detail?: string } } } | null)
      ?.response?.data?.detail;
    const message = status === 404
      ? "This livestock record is not available to your account."
      : status === 400 && detail
        ? detail
        : status === 401
          ? "Your session expired. Sign in again to view this forecast."
          : status === 403
            ? "Your account is not authorized to view this forecast."
            : detail || "Could not load this animal’s milk forecast. Check your connection and try again.";
    return (
      <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <span>{message}</span>
      </div>
    );
  }

  const weatherByDate = new Map((data.weather.timeline || []).map((point) => [point.date, point]));
  const chartData = [
    ...data.history.map((point) => ({ date: point.date, historical: point.milk_liters, expected: null as number | null })),
    ...data.forecast.map((point) => ({ date: point.date, historical: null as number | null, expected: point.expected_liters })),
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
  const hasWeatherOverlay = chartData.some((point) => point.thi != null);

  return (
    <Card className="rounded-3xl border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><Milk className="size-5" /></div>
            <div>
              <CardTitle className="text-base font-black text-slate-900">Milk Production Prediction</CardTitle>
              <CardDescription className="mt-1 text-xs">Experimental estimate for {data.livestock.tag_number || `animal #${data.livestock.id}`}</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={data.status === "READY" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}>
              {data.status === "READY" ? "READY" : "INSUFFICIENT DATA"}
            </Badge>
            {data.data_source === "synthetic_demo" ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-950">DEMONSTRATION DATA</Badge>
            ) : (
              <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-900">APPROVED REAL RECORDS</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Info label="Breed" value={data.livestock.breed || "Not recorded"} />
          <Info label="Age" value={data.livestock.age_years == null ? "Not recorded" : `${data.livestock.age_years.toFixed(1)} years`} />
          <Info label="Days since calving" value={data.livestock.days_since_calving == null ? "Not recorded" : `${data.livestock.days_since_calving} days`} />
          <Info label={data.data_source === "synthetic_demo" ? "Demo observations" : "Approved daily records"} value={String(data.observation_count)} />
        </div>

        {data.status === "NOT_READY" ? (
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Insufficient historical data.</strong> {data.reason} Only this animal’s approved milk records count toward a real forecast.
            {data.demonstration_available && !showDemo && (
              <button
                type="button"
                onClick={() => setShowDemo(true)}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 font-semibold text-amber-950 shadow-sm hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
              >
                <Sparkles className="size-4" /> View synthetic demonstration
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">Expected Milk Production — Next 7 Days</h3>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-900">{data.selected_model}</Badge>
            </div>
            <div className="h-64 w-full rounded-xl border border-slate-200 bg-white p-2" role="img" aria-label="Historical milk production and seven-day forecast with Open-Meteo temperature-humidity context">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} barCategoryGap="0%" margin={{ top: 12, right: 14, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  {hasWeatherOverlay && <YAxis yAxisId="weather" domain={[0, 100]} hide />}
                  {hasWeatherOverlay && (
                    <Bar yAxisId="weather" dataKey="weatherBand" name="THI weather context" legendType="none" isAnimationActive={false}>
                      {chartData.map((point) => <Cell key={point.date} fill={thiColor(point.thi)} fillOpacity={0.2} />)}
                    </Bar>
                  )}
                  <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} minTickGap={24} tick={{ fontSize: 10 }} />
                  <YAxis unit=" L" width={48} tick={{ fontSize: 10 }} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as (typeof chartData)[number];
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-lg">
                        <p className="mb-1 font-bold text-slate-900">Date: {label}</p>
                        {point.historical != null && <p className="text-blue-700">Historical: {point.historical.toFixed(2)} L</p>}
                        {point.expected != null && <p className="text-amber-700">Expected: {point.expected.toFixed(2)} L</p>}
                        {point.thi != null && <p className="mt-1 border-t pt-1 text-slate-700">THI context: {point.thi.toFixed(1)} · {point.temperature_c?.toFixed(1)}°C · {point.humidity_pct?.toFixed(0)}% RH</p>}
                      </div>
                    );
                  }} />
                  <Legend />
                  <Line type="monotone" dataKey="historical" name="Historical" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="expected" name="Expected forecast" stroke="#d97706" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs font-semibold text-slate-700">
              Heat in Barangay {data.weather.location_name || "(barangay not available)"} · Open-Meteo daily temperature-humidity context
            </p>
            {hasWeatherOverlay && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600" aria-label="Temperature humidity index context legend">
                <span className="font-semibold text-slate-700">Chart background THI:</span>
                {[ ["#3b82f6", "Cool <60"], ["#22c55e", "Lower heat load 60–67"], ["#eab308", "68–71"], ["#f97316", "72–79"], ["#ef4444", "80+"] ].map(([color, label]) => (
                  <span key={label} className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />{label}</span>
                ))}
                <span className="w-full text-slate-500">THI uses daily mean weather at the barangay centroid; it is environmental context, not a barn measurement or animal health diagnosis.</span>
              </div>
            )}
            {!hasWeatherOverlay && (
              <p className="text-xs text-slate-500">Weather readings for this chart are unavailable, so no heat-color background is shown.</p>
            )}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Expected milk (L)</TableHead></TableRow></TableHeader>
                <TableBody>{data.forecast.map((point) => (
                  <TableRow key={point.date}><TableCell>{point.date}</TableCell><TableCell className="text-right font-semibold">{point.expected_liters.toFixed(2)} L</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </div>
            {data.evaluation && (
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">Chronological model evaluation</h3>
                <p className="text-xs text-slate-600">{data.evaluation.methodology} Training records: {data.evaluation.train_samples}; held-out records: {data.evaluation.test_samples}.</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {data.evaluation.results.map((result) => (
                    <div key={result.name} className="rounded-xl border border-slate-200 p-3 text-xs">
                      <p className="font-bold text-slate-900">{result.name}</p>
                      <p className="mt-1 text-slate-600">MAE {result.mae.toFixed(2)} L · RMSE {result.rmse.toFixed(2)} L{result.r2 == null ? "" : ` · R² ${result.r2.toFixed(2)}`}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {data.data_source === "synthetic_demo" && (
          <div role="note" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="flex items-center gap-2 font-black"><Sparkles className="size-4" /> DEMONSTRATION DATA</p>
            <p className="mt-1">This forecast uses synthetic observations to demonstrate the model. It is not a forecast from this animal’s real production history and is not validated for real-world production.</p>
            <button
              type="button"
              onClick={() => setShowDemo(false)}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 font-semibold hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              <RotateCcw className="size-4" /> Return to approved records
            </button>
          </div>
        )}

        <section className="space-y-1 border-t border-slate-100 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Forecast inputs</h3>
          <p className="text-xs text-slate-600">{data.features_used.join(" · ")}</p>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
            <p className="flex items-center gap-2 font-bold"><CloudSun className="size-4 shrink-0" /> How weather is used</p>
            {data.weather.used_in_forecast ? (
              <p className="mt-1 text-xs leading-relaxed">
                {data.weather.provider} supplies historical weather and the upcoming forecast for the {data.weather.location_source.toLowerCase()}.
                The selected model can use the previous day’s mean temperature, relative humidity, and precipitation as optional context
                alongside milk history. Weather helps describe conditions; it does not guarantee or determine milk output.
              </p>
            ) : data.weather.available ? (
              <p className="mt-1 text-xs leading-relaxed">
                Weather data was available from {data.weather.provider}, but the selected {data.selected_model || "model"} does not use it.
                This forecast is based on the inputs listed above. {data.weather.message}
              </p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed">
                {data.weather.message || `${data.weather.provider} weather was unavailable, so it was omitted. The forecast uses the available milk history and livestock characteristics instead.`}
              </p>
            )}
            <p className="mt-2 text-[11px] text-sky-800">Weather location: {data.weather.location_source}.</p>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">{data.limitations}</p>
        </section>
        {data.history.length > 0 && (
          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">Recent historical records</summary>
            <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-100">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Milk (L)</TableHead></TableRow></TableHeader>
                <TableBody>{data.history.map((point) => (
                  <TableRow key={point.date}><TableCell>{point.date}</TableCell><TableCell className="text-right">{point.milk_liters.toFixed(2)} L</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}
