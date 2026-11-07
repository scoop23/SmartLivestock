"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PopulationForecastChart } from "./population-forecast-chart";

const components = ["registrations", "births", "sales", "deaths", "removals"] as const;
type Kind = typeof components[number];
type Assumptions = Record<Kind, string>;
interface PopulationBalance {
  current_heads: number; as_of: string; tracking_started_at: string;
  mode: "AUTOMATIC" | "SCENARIO"; training_through: string | null; history_note: string;
  usable_months: number; required_months: number; forecast_available: boolean;
  message: string; method_note: string; limitations: string; model?: string;
  options: { barangays: {id: number; name: string}[]; species: {id: number; name: string}[] };
  evaluation: {status: string; valid_origins: number; models: {name: string; component_mae_heads: number}[]};
  forecast: ({date: string; period_start: string; lead_months: number; opening: number; heads: number} & Record<Kind, number>)[];
  history: ({date: string; month: string; heads: number | null} & Record<Kind, number>)[];
}

export function usePopulationForecast(horizon: number, barangay = "all", species = "all", assumptions?: Assumptions) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["population-balance", user?.email, user?.accessScope, user?.assignedBarangayId, horizon, barangay, species, assumptions],
    enabled: user?.role === "MAO" || user?.role === "ADMIN",
    queryFn: async () => {
      const params: Record<string, string | number> = {horizon};
      if (barangay !== "all") params.barangay_id = barangay;
      if (species !== "all") params.species_id = species;
      if (assumptions) for (const kind of components) params[`expected_${kind}`] = assumptions[kind];
      return (await api.get<PopulationBalance>("analytics/predictive/population/", {params})).data;
    },
    staleTime: 30_000,
  });
}

export function PopulationForecastPanel({horizon = 6}: {horizon?: number}) {
  const [barangay, setBarangay] = useState("all");
  const [species, setSpecies] = useState("all");
  const [draft, setDraft] = useState<Assumptions>({registrations: "", births: "", sales: "", deaths: "", removals: ""});
  const [assumptions, setAssumptions] = useState<Assumptions>();
  const query = usePopulationForecast(horizon, barangay, species, assumptions);
  const data = query.data;
  const timeline: {date: string; actual: number | null; forecast: number | null}[] = data ? [
    ...data.history.map(row => ({date: row.date, actual: row.heads, forecast: null})),
    {date: data.as_of, actual: data.current_heads, forecast: data.forecast_available ? data.current_heads : null},
    ...data.forecast.map(row => ({date: row.date, actual: null, forecast: row.heads})),
  ] : [];
  const [formError, setFormError] = useState("");
  const labels: Record<Kind, string> = {registrations: "Registrations", births: "Births", sales: "Sales", deaths: "Deaths", removals: "Other removals"};
  const reset = () => {setAssumptions(undefined); setDraft({registrations: "", births: "", sales: "", deaths: "", removals: ""}); setFormError("");};
  return <Card className="rounded-2xl border-emerald-200 bg-white">
    <CardHeader><div className="flex flex-wrap justify-between gap-3"><CardTitle>Active Registered Livestock Population</CardTitle><Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh</Button></div>
      <p className="text-sm text-slate-600">Current registered heads + registrations + births − sales − deaths − other removals.</p>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Barangay<select aria-label="Population barangay" className="mt-1 h-10 w-full rounded-lg border px-3" value={barangay} onChange={e => {setBarangay(e.target.value); reset();}}><option value="all">All barangays</option>{data?.options.barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Species<select aria-label="Population species" className="mt-1 h-10 w-full rounded-lg border px-3" value={species} onChange={e => {setSpecies(e.target.value); reset();}}><option value="all">All species</option>{data?.options.species.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      </div>
      {query.isPending ? <p>Loading registered population…</p> : query.isError ? <p role="alert" className="text-rose-700">Could not load population information. Refresh to retry.</p> : data && <>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm">Current approved, active registered animals</p><p className="text-3xl font-bold text-emerald-900">{data.current_heads.toLocaleString()} heads</p><p className="text-xs text-slate-600">As of {data.as_of}. Change tracking began {data.tracking_started_at}; {data.usable_months} complete months available.</p></div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-slate-50 p-3">
          <p className="text-sm font-semibold">{data.mode === "AUTOMATIC" ? "Automatic monthly forecast" : "Monthly planning scenario"}</p>
          {data.mode === "SCENARIO" && <Button variant="outline" size="sm" onClick={reset}>Return to automatic forecast</Button>}
          <p className="w-full text-xs text-slate-600">{data.mode === "AUTOMATIC" ? `The system estimates future changes from completed monthly records, then calculates the population ${horizon} month${horizon === 1 ? "" : "s"} ahead. No manual counts are required.` : "Uses your entered counts instead of forecasts learned from history."}</p>
        </div>
        <p className="text-sm">{data.message}</p>
        <p className="text-xs text-slate-600">{data.method_note}</p>
        <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Explore your own monthly assumptions</summary>
          <p className="my-3 text-sm text-slate-600">Enter expected counts for each future month. The same counts repeat for all {horizon} months. This is a planning scenario, not a validated prediction. Enter zero explicitly where appropriate.</p>
          <form onSubmit={e => {e.preventDefault(); if (components.some(k => !/^\d+$/.test(draft[k]) || Number(draft[k]) > 10000000)) {setFormError("Enter a whole number from 0 to 10,000,000 for every component."); return;} setFormError(""); setAssumptions({...draft});}}>
            <div className="grid gap-3 sm:grid-cols-5">{components.map(kind => <label key={kind} className="text-xs font-semibold">{labels[kind]}<input required type="number" min="0" max="10000000" step="1" className="mt-1 h-10 w-full rounded-lg border px-2" value={draft[kind]} onChange={e => setDraft({...draft, [kind]: e.target.value})}/></label>)}</div>
            {formError && <p role="alert" className="mt-2 text-sm text-rose-700">{formError}</p>}
            <div className="mt-3 flex gap-2"><Button type="submit" disabled={query.isFetching}>Calculate scenario</Button><Button type="button" variant="outline" onClick={reset}>Use recorded history</Button></div>
          </form>
        </details>
        {data.forecast_available && <>
          <p className="text-sm"><strong>Method:</strong> {data.model}. {data.evaluation.status === "USER_ASSUMPTIONS" ? "Uses your entered assumptions." : data.evaluation.status === "BACKTESTED" ? `Compared over ${data.evaluation.valid_origins} historical forecast windows.` : "Not yet validated against enough historical windows."}</p>
          <PopulationForecastChart timeline={timeline} asOf={data.as_of} horizon={horizon} method={data.model ?? "Not selected"} scenario={data.mode === "SCENARIO"} />
          <p className="text-xs text-slate-500">Forecasts run from {data.as_of} in successive one-month periods.{data.training_through ? ` Completed training history ends ${data.training_through}.` : ""} {data.history_note}</p>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Through</th><th className="p-2">Opening</th>{components.map(k => <th className="p-2" key={k}>{k === "births" || k === "registrations" ? "+ " : "− "}{labels[k]}</th>)}<th className="p-2">Closing heads</th></tr></thead><tbody>{data.forecast.map(row => <tr className="border-b" key={row.date}><td className="p-2">{row.date}</td><td className="p-2">{row.opening.toLocaleString()}</td>{components.map(k => <td className="p-2" key={k}>{row[k].toLocaleString()}</td>)}<td className="p-2 font-bold text-emerald-800">{row.heads.toLocaleString()}</td></tr>)}</tbody></table></div>
        </>}
        {data.evaluation.models.length > 0 && <p className="text-xs text-slate-600">Average error per monthly component: {data.evaluation.models.map(m => `${m.name}: ${m.component_mae_heads} heads`).join("; ")}. These are component errors, not measured closing-population accuracy.</p>}
        {data.history.length > 0 && <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Recorded monthly changes</summary><div className="overflow-x-auto"><table className="mt-3 w-full text-sm"><thead><tr><th>Month</th>{components.map(k => <th key={k}>{labels[k]}</th>)}</tr></thead><tbody>{data.history.map(row => <tr key={row.month}><td>{row.month}</td>{components.map(k => <td className="text-center" key={k}>{row[k]}</td>)}</tr>)}</tbody></table></div></details>}
        <p className="text-xs text-slate-500">{data.limitations}</p>
      </>}
    </CardContent>
  </Card>;
}
