"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, CalendarDays, ChevronDown, Clock3, Info, RefreshCw, SlidersHorizontal, Sparkles, Users } from "lucide-react";
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
  const fieldId = useId();
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
  const lastEstimate = data?.forecast.at(-1);
  const change = lastEstimate && data ? lastEstimate.heads - data.current_heads : null;
  const isScenario = data?.mode === "SCENARIO";
  const progress = data ? Math.min(100, data.usable_months / data.required_months * 100) : 0;

  return (
    <Card className="overflow-hidden rounded-2xl border border-emerald-200/90 bg-white shadow-xs">
      <CardHeader className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-100 p-1.5 text-emerald-700"><Users className="size-4" /></span>
            <CardTitle className="text-base font-bold text-slate-900 sm:text-lg">Active Registered Livestock Population</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span>Method: <strong className="font-mono text-emerald-800">{data?.model ?? "Awaiting history"}</strong></span>
            <span aria-hidden>?</span><span>Unit: <strong className="text-slate-700">animals</strong></span>
            <span aria-hidden>?</span><span>Interval: <strong className="text-slate-700">Monthly</strong></span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
          {data && <Badge variant="outline" className={`font-mono text-[10px] ${isScenario ? "border-sky-200 bg-sky-50 text-sky-800" : data.forecast_available ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {isScenario ? "Planning scenario" : data.forecast_available ? "Estimate available" : "More history needed"}
          </Badge>}
          <Button variant="outline" size="sm" className="h-8 border-slate-200 bg-white font-mono text-xs text-slate-700" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`mr-1.5 size-3.5 text-emerald-600 ${query.isFetching ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><SlidersHorizontal className="size-3.5" />View population for</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-barangay`} className="text-xs font-semibold text-slate-700">Barangay</Label>
              <Select value={barangay} onValueChange={value => {setBarangay(value); reset();}}>
                <SelectTrigger id={`${fieldId}-barangay`} className="w-full rounded-lg border-slate-200 bg-white text-sm"><SelectValue placeholder="All barangays" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All barangays</SelectItem>{data?.options.barangays.map(option => <SelectItem key={option.id} value={String(option.id)}>{option.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-species`} className="text-xs font-semibold text-slate-700">Species</Label>
              <Select value={species} onValueChange={value => {setSpecies(value); reset();}}>
                <SelectTrigger id={`${fieldId}-species`} className="w-full rounded-lg border-slate-200 bg-white text-sm"><SelectValue placeholder="All species" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All species</SelectItem>{data?.options.species.map(option => <SelectItem key={option.id} value={String(option.id)}>{option.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {query.isPending ? <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div> : query.isError ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Could not load population information. Use Refresh to try again.</div>
        ) : data && <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800"><Users className="size-3.5" />Current registered population</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-950">{data.current_heads.toLocaleString()} <span className="text-sm font-medium text-emerald-800">heads</span></p>
              <p className="mt-1 text-[11px] text-slate-500">Approved and active ? as of {data.as_of}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><CalendarDays className="size-3.5" />Recorded monthly history</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{data.usable_months} <span className="text-sm font-medium text-slate-500">months</span></p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Monthly history readiness" aria-valuemin={0} aria-valuemax={data.required_months} aria-valuenow={Math.min(data.usable_months, data.required_months)}><div className="h-full rounded-full bg-emerald-600 transition-all" style={{width: `${progress}%`}} /></div>
              <p className="mt-1.5 text-[11px] text-slate-500">{data.required_months} complete months needed to start</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><ArrowRight className="size-3.5" />{horizon}-month {isScenario ? "scenario" : "estimate"}</p>
              <p className={`mt-2 font-bold tracking-tight ${lastEstimate ? "text-3xl text-slate-900" : "text-lg text-slate-500"}`}>{lastEstimate ? <>{lastEstimate.heads.toLocaleString()} <span className="text-sm font-medium text-slate-500">heads</span></> : "Not available yet"}</p>
              <p className="mt-2 text-[11px] text-slate-500">{change !== null ? `${change > 0 ? "+" : ""}${change.toLocaleString()} heads compared with today` : "An estimate appears when enough history is available."}</p>
            </div>
          </div>

          <div className={`flex gap-3 rounded-xl border p-3 text-xs leading-relaxed ${data.forecast_available ? "border-sky-200 bg-sky-50/60 text-slate-700" : "border-amber-200 bg-amber-50/60 text-amber-900"}`}>
            {data.forecast_available ? <Info className="mt-0.5 size-4 shrink-0 text-sky-600" /> : <Clock3 className="mt-0.5 size-4 shrink-0 text-amber-600" />}
            <div><p className="font-semibold">{isScenario ? "Using your monthly assumptions" : data.forecast_available ? "Automatic monthly forecast" : "Building your forecast history"}</p><p className="mt-1">{data.message}</p></div>
          </div>
          {isScenario && <Button variant="outline" size="sm" onClick={reset}>Return to automatic forecast</Button>}

          {data.forecast_available && <>
            <PopulationForecastChart timeline={timeline} asOf={data.as_of} horizon={horizon} method={data.model ?? "Not selected"} scenario={isScenario} />
            <p className="text-[11px] text-slate-500">Estimates begin {data.as_of} and advance one month at a time.{data.training_through ? ` Completed history ends ${data.training_through}.` : ""} {data.history_note}</p>
            <details className="group rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-xs font-semibold text-slate-700">How the population changes each month<ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
              <div className="overflow-x-auto border-t border-slate-100"><table className="w-full text-xs"><thead className="bg-slate-50"><tr className="text-left"><th className="p-3">Through</th><th className="p-3">Opening</th>{components.map(k => <th className="p-3" key={k}>{k === "births" || k === "registrations" ? "+ " : "? "}{labels[k]}</th>)}<th className="p-3">Closing heads</th></tr></thead><tbody>{data.forecast.map(row => <tr className="border-t border-slate-100" key={row.date}><td className="p-3">{row.date}</td><td className="p-3">{row.opening.toLocaleString()}</td>{components.map(k => <td className="p-3" key={k}>{row[k].toLocaleString()}</td>)}<td className="p-3 font-bold text-emerald-800">{row.heads.toLocaleString()}</td></tr>)}</tbody></table></div>
            </details>
          </>}

          <details className="group rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-xs font-semibold text-slate-700"><span className="flex items-center gap-2"><Sparkles className="size-4 text-emerald-600" />Explore a planning scenario</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
            <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs leading-relaxed text-slate-500">Optional: enter expected counts for each future month. These counts repeat for all {horizon} months and are shown as a scenario. Enter zero explicitly where appropriate.</p>
              <form onSubmit={event => {
                event.preventDefault();
                if (components.some(k => !/^\d+$/.test(draft[k]) || Number(draft[k]) > 10000000)) {setFormError("Enter a whole number from 0 to 10,000,000 for every component."); return;}
                setFormError(""); setAssumptions({...draft});
              }} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{components.map(kind => <div key={kind} className="space-y-1.5"><Label htmlFor={`${fieldId}-${kind}`} className="text-xs text-slate-600">{labels[kind]}</Label><Input id={`${fieldId}-${kind}`} required type="number" min="0" max="10000000" step="1" className="border-slate-200 bg-white text-sm" value={draft[kind]} onChange={event => setDraft({...draft, [kind]: event.target.value})} /></div>)}</div>
                {formError && <p role="alert" className="text-xs text-rose-700">{formError}</p>}
                <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={query.isFetching}>Calculate scenario</Button><Button type="button" size="sm" variant="outline" className="bg-white" onClick={reset}>Use recorded history</Button></div>
              </form>
            </div>
          </details>

          <details className="group rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-xs font-semibold text-slate-700"><span className="flex items-center gap-2"><Info className="size-4 text-slate-400" />Data and forecast details</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
            <div className="space-y-3 border-t border-slate-100 p-4 text-xs leading-relaxed text-slate-500">
              <p className="font-mono text-[11px] text-emerald-800">Current heads + registrations + births ? sales ? deaths ? other removals</p>
              <p>{data.method_note}</p><p>Change tracking began {data.tracking_started_at}.</p>
              {data.evaluation.models.length > 0 && <p>Average error per monthly component: {data.evaluation.models.map(model => `${model.name}: ${model.component_mae_heads} heads`).join("; ")}. These measure component errors, not closing-population accuracy.</p>}
              {data.forecast_available && <p>{data.evaluation.status === "USER_ASSUMPTIONS" ? "The scenario uses your assumptions." : data.evaluation.status === "BACKTESTED" ? `Compared over ${data.evaluation.valid_origins} historical forecast windows.` : "The estimate has not yet been validated against enough historical windows."}</p>}
              {data.history.length > 0 && <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Month</th>{components.map(k => <th className="p-2" key={k}>{labels[k]}</th>)}</tr></thead><tbody>{data.history.map(row => <tr className="border-t border-slate-100" key={row.month}><td className="p-2">{row.month}</td>{components.map(k => <td className="p-2 text-center" key={k}>{row[k]}</td>)}</tr>)}</tbody></table></div>}
              <p>{data.limitations}</p>
            </div>
          </details>
        </>}
      </CardContent>
    </Card>
  );
}
