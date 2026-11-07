"use client";

import { useId, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface PopulationForecast {
  forecast_available: boolean;
  message: string;
  usable_quarters: number;
  required_quarters: number;
  latest_required_quarter: string;
  as_of: string;
  model?: string;
  options: {
    barangays: { id: number; name: string }[];
    species: { id: number; name: string }[];
  };
  history: { quarter: string; heads: number | null }[];
  forecast: { quarter: string; heads: number; lower: number; upper: number }[];
  coverage_gaps: { quarter: string; missing_barangays: string[] }[];
  evaluation: {
    status: string;
    valid_origins: number;
    required_origins?: number;
    models: { name: string; mae_heads: number }[];
  };
  method_note: string;
  range_note: string;
  limitations: string;
}

export function PopulationForecastPanel() {
  const { user } = useAuth();
  const id = useId();
  const [barangay, setBarangay] = useState("all");
  const [species, setSpecies] = useState("all");
  const [horizon, setHorizon] = useState("4");
  const allowed = user?.role === "MAO" || user?.role === "ADMIN";
  const query = useQuery({
    queryKey: ["population-forecast", user?.email, user?.role, user?.accessScope, user?.assignedBarangayId, barangay, species, horizon],
    enabled: allowed,
    placeholderData: keepPreviousData,
    queryFn: async () => (await api.get<PopulationForecast>("analytics/predictive/population/", {
      params: {
        barangay_id: barangay === "all" ? undefined : barangay,
        species_id: species === "all" ? undefined : species,
        horizon,
      },
    })).data,
  });
  const data = query.data;
  const timeline = useMemo(() => {
    if (!data) return [];
    const rows: { quarter: string; actual: number | null; estimate: number | null; range: [number, number] | null }[] =
      data.history.map((row, index) => ({
        quarter: row.quarter,
        actual: row.heads,
        estimate: data.forecast_available && index === data.history.length - 1 ? row.heads : null,
        range: data.forecast_available && index === data.history.length - 1 && row.heads !== null
          ? [row.heads, row.heads] : null,
      }));
    return rows.concat(data.forecast.map((row) => ({
      quarter: row.quarter, actual: null, estimate: row.heads, range: [row.lower, row.upper] as [number, number],
    })));
  }, [data]);

  if (!allowed) return null;

  const selectClass = "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900";
  return (
    <Card className="rounded-2xl border-emerald-200 bg-white shadow-xs">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Livestock population forecast</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        <CardDescription>Quarterly population estimates from approved census records, by species and barangay.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={`${id}-barangay`} className="text-sm font-semibold">Barangay</label>
            <select id={`${id}-barangay`} className={selectClass} value={barangay} onChange={(event) => setBarangay(event.target.value)}>
              <option value="all">All barangays</option>
              {data?.options.barangays.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-species`} className="text-sm font-semibold">Species</label>
            <select id={`${id}-species`} className={selectClass} value={species} onChange={(event) => setSpecies(event.target.value)}>
              <option value="all">All species</option>
              {data?.options.species.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-horizon`} className="text-sm font-semibold">Forecast period</label>
            <select id={`${id}-horizon`} className={selectClass} value={horizon} onChange={(event) => setHorizon(event.target.value)}>
              {[1, 2, 3, 4].map((value) => <option key={value} value={value}>Next {value} quarter{value > 1 ? "s" : ""}</option>)}
            </select>
          </div>
        </div>

        {query.isError ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            Could not load population forecasts. Use Refresh to try again.
          </div>
        ) : query.isPending || query.isPlaceholderData ? (
          <Skeleton className="h-64 w-full rounded-xl" aria-label="Loading population forecast" />
        ) : data ? (
          <>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{data.forecast_available ? "Forecast available" : "More census history needed"}</Badge>
                <span>{data.usable_quarters}/{data.required_quarters} consecutive quarters</span>
                <span className="text-slate-500">Through {data.latest_required_quarter}</span>
              </div>
              <p>{data.message}</p>
              <p className="mt-2 text-xs text-slate-600">{data.method_note}</p>
            </div>

            {data.history.some((row) => row.heads !== null) ? (
              <div className="h-72 w-full" role="img" aria-label="Recorded quarterly census population and available future estimates in heads">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timeline} margin={{ top: 10, right: 15, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quarter" tick={{ fontSize: 11 }} minTickGap={25} />
                    <YAxis allowDecimals={false} domain={[0, "auto"]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Area dataKey="range" name="Planning range (heads)" fill="#a7f3d0" stroke="none" connectNulls={false} />
                    <Line dataKey="actual" name="Approved census (heads)" stroke="#334155" strokeWidth={2} connectNulls={false} />
                    <Line dataKey="estimate" name="Forecast (heads)" stroke="#059669" strokeWidth={2} strokeDasharray="5 5" connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-sm text-slate-500">No complete approved census observations are available for this selection.</p>}

            {data.forecast_available ? (
              <div className="space-y-3">
                <p className="text-sm"><strong>Method:</strong> {data.model}. {data.evaluation.status === "BACKTESTED"
                  ? `Compared over ${data.evaluation.valid_origins} historical forecast origins.`
                  : `Not yet validated: only ${data.evaluation.valid_origins} usable historical forecast origins; at least 3 are required for model selection.`}</p>
                {data.evaluation.models.length > 0 ? <p className="text-xs text-slate-600">
                  Historical mean absolute error: {data.evaluation.models.map((model) => `${model.name}: ${model.mae_heads.toLocaleString()} heads`).join("; ")}
                </p> : null}
                <Table>
                  <TableHeader><TableRow><TableHead>Quarter</TableHead><TableHead>Estimated heads</TableHead><TableHead>Planning range</TableHead></TableRow></TableHeader>
                  <TableBody>{data.forecast.map((row) => <TableRow key={row.quarter}>
                    <TableCell>{row.quarter}</TableCell><TableCell>{row.heads.toLocaleString()}</TableCell>
                    <TableCell>{row.lower.toLocaleString()}–{row.upper.toLocaleString()}</TableCell>
                  </TableRow>)}</TableBody>
                </Table>
                <p className="text-xs text-slate-600">{data.range_note}</p>
              </div>
            ) : null}

            {data.coverage_gaps.length > 0 ? <details className="rounded-lg border border-slate-200 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">Missing census observations ({data.coverage_gaps.length} quarters)</summary>
              <ul className="mt-3 space-y-2 text-xs text-slate-600">{data.coverage_gaps.map((gap) => <li key={gap.quarter}>
                <strong>{gap.quarter}:</strong> {gap.missing_barangays.join(", ") || "No barangays available in this scope"}
              </li>)}</ul>
            </details> : null}
            <p className="text-xs text-slate-500">{data.limitations}</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
