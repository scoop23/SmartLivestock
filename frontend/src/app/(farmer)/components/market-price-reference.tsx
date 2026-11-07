"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, CircleDollarSign, Info, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "@/lib/axios";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WeekPrice {
  week_start: string; week_end: string; average_price: number | null;
  average_live_weight_kg: number | null; price_per_live_kg: number | null; sales_with_weight: number | null;
  sales: number | null; middle_low: number | null; middle_high: number | null; partial_week: boolean;
}
interface MarketData {
  as_of: string; last_updated: string | null; is_demo: boolean; demo_available: boolean; minimum_sales: number;
  latest: WeekPrice | null; change_from_previous_week: number | null; history: WeekPrice[];
  breed_options: {value: string; label: string}[];
  forecast: {available: boolean; model: string | null; checked_windows?: number; average_error_php?: number;
    message: string; points: {week_start: string; price: number}[]} | null;
  price_basis: string; filter_note: string; privacy_note: string; data_notice: string;
}

const peso = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-PH", {style: "currency", currency: "PHP", maximumFractionDigits: 0}).format(value);
const dateText = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("en-PH", {month: "short", day: "numeric", year: "numeric"});
function priceChange(value: number | null) {
  if (value === null) return "No previous-week average to compare.";
  if (value === 0) return "Same average as the previous week.";
  return `${peso(Math.abs(value))} ${value > 0 ? "higher" : "lower"} than the previous week`;
}

function useMarketPrices({breed = "ALL", weight = "ALL", mode = "AUTO", forecast = true} = {}) {
  const {user} = useAuth();
  return useQuery({
    queryKey: ["farmer-market-prices", user?.email, breed, weight, mode, forecast],
    enabled: user?.role === "FARMER" || user?.role === "MAO" || user?.role === "ADMIN",
    queryFn: async () => (await api.get<MarketData>("analytics/market-prices/", {
      params: {breed, weight_band: weight, data_mode: mode, include_forecast: forecast},
    })).data,
    staleTime: 60_000,
    refetchInterval: forecast ? false : 60_000,
  });
}

export function FarmerMarketPriceCard() {
  const light = useMarketPrices({weight: "UNDER_300", forecast: false});
  const medium = useMarketPrices({weight: "300_TO_499", forecast: false});
  const heavy = useMarketPrices({weight: "500_PLUS", forecast: false});
  const groups = [
    {label: "Under 300 kg", query: light},
    {label: "300 to under 500 kg", query: medium},
    {label: "500 kg and above", query: heavy},
  ];
  const refreshing = groups.some(({query}) => query.isFetching);
  return <Card className="gap-0 overflow-hidden rounded-xl border-emerald-200 bg-white shadow-sm">
    <CardContent className="space-y-1.5 p-2 sm:p-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CircleDollarSign className="size-4 text-emerald-700" />Auction cattle prices by weight</h2>
        <Button variant="ghost" size="icon" className="size-6" aria-label="Refresh auction cattle prices" disabled={refreshing} onClick={() => {void light.refetch(); void medium.refetch(); void heavy.refetch();}}><RefreshCw className={`size-3.5 text-emerald-700 ${refreshing ? "animate-spin" : ""}`} /></Button>
      </div>
      <div className="grid grid-cols-1 gap-1.5 min-[400px]:grid-cols-3">
        {groups.map(({label, query}) => <div key={label} className="min-w-0 rounded-lg bg-emerald-50 px-2.5 py-1.5">
          <p className="text-xs font-semibold text-slate-700">{label}</p>
          {query.isPending ? <Skeleton className="mt-1 h-7 w-full" /> : query.isError ? <p role="alert" className="mt-1 text-xs text-slate-500">Unable to load prices</p> : query.data?.latest ? <>
            <p className="mt-0.5 text-lg leading-tight font-bold tracking-tight text-emerald-950 sm:text-xl">{peso(query.data.latest.average_price)}<span className="ml-1 text-[10px] font-normal text-slate-500">/ head</span></p>
            <p className="mt-0.5 text-[10px] text-slate-500">Week of {dateText(query.data.latest.week_start)}{query.data.latest.partial_week ? " · week so far" : ""}</p>
          </> : <p className="mt-1 text-xs text-slate-500">Needs {query.data?.minimum_sales ?? 5} priced sales in a week</p>}
        </div>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>Average selling price per head</span>
        <Link className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline" href="/production-dashboard/Cattle?activity=sales&mode=history&eligibleSpecies=Cattle&market=1#market-price-reference">View prices<ArrowRight className="size-3" /></Link>
      </div>
    </CardContent>
  </Card>;
}
export default function MarketPriceReference() {
  const [breed, setBreed] = useState("ALL");
  const [weight, setWeight] = useState("ALL");
  const [mode, setMode] = useState("AUTO");
  const [historyWeeks, setHistoryWeeks] = useState(26);
  const query = useMarketPrices({breed, weight, mode});
  const data = query.data;
  const chart: {date: string; recorded: number | null; estimated: number | null}[] = data ? data.history.slice(-historyWeeks).map(row => ({
    date: row.week_start, recorded: row.average_price,
    estimated: data.forecast?.available && row.week_start === data.latest?.week_start ? row.average_price : null,
  })) : [];
  if (data?.forecast?.available) chart.push(...data.forecast.points.map(row => ({date: row.week_start, recorded: null, estimated: row.price})));
  const resetFilters = () => {setBreed("ALL"); setWeight("ALL");};
  return <>
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">What are cattle selling for?</h3><p className="mt-1 max-w-2xl text-sm text-slate-600">These are shared auction price summaries, separate from your own sales records. Your animal’s price may differ depending on its breed, weight, age, sex, and condition.</p></div><Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh prices</Button></div>

      {data?.is_demo && <div role="status" className="flex items-center gap-2 text-xs text-slate-500"><span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">Demo</span> <button type="button" className="ml-2 font-semibold underline" onClick={() => {setMode("REAL"); resetFilters();}}>Return to real sales</button></div>}

      <Card className="rounded-2xl border-slate-200 bg-white"><CardContent className="space-y-3 p-4 sm:p-5"><h2 className="font-semibold text-slate-900">Find prices for similar cattle</h2><div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="market-breed">Breed</Label><Select value={breed} onValueChange={setBreed}><SelectTrigger id="market-breed" className="bg-white"><SelectValue placeholder="All breeds" /></SelectTrigger><SelectContent><SelectItem value="ALL">All breeds</SelectItem>{data?.breed_options.map(option => <SelectItem value={option.value} key={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="market-weight">Weight at sale</Label><Select value={weight} onValueChange={setWeight}><SelectTrigger id="market-weight" className="bg-white"><SelectValue placeholder="All weights" /></SelectTrigger><SelectContent><SelectItem value="ALL">All weights</SelectItem><SelectItem value="UNDER_300">Under 300 kg</SelectItem><SelectItem value="300_TO_499">300 to under 500 kg</SelectItem><SelectItem value="500_PLUS">500 kg and above</SelectItem></SelectContent></Select></div>
      </div><p className="text-xs text-slate-500">Only sales with a recorded matching breed or weight are included when you select a filter.</p>{(breed !== "ALL" || weight !== "ALL") && <Button size="sm" variant="outline" onClick={resetFilters}>Show all cattle again</Button>}</CardContent></Card>

      {query.isPending ? <div className="grid gap-3 sm:grid-cols-3">{[0,1,2].map(n => <Skeleton key={n} className="h-36 rounded-2xl" />)}</div> : query.isError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">We could not load the prices. Use “Refresh prices” to try again.</div> : data && <>
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="rounded-2xl border-emerald-200 bg-emerald-50/70"><CardContent className="p-5"><p className="text-sm font-medium text-emerald-900">Latest recorded auction average</p><p className="mt-3 text-3xl font-bold text-emerald-950">{peso(data.latest?.average_price)}</p><p className="mt-1 text-sm text-emerald-800">per animal, not per kilogram</p><p className="mt-3 text-xs text-slate-600">{data.latest ? priceChange(data.change_from_previous_week) : "More recorded sales are needed."}</p></CardContent></Card>
          <Card className="rounded-2xl border-slate-200 bg-white"><CardContent className="p-5"><p className="text-sm font-medium text-slate-600">Middle price range</p><p className="mt-3 text-xl font-bold text-slate-900">{data.latest ? `${peso(data.latest.middle_low)} – ${peso(data.latest.middle_high)}` : "Not available yet"}</p><p className="mt-3 text-xs leading-relaxed text-slate-500">The middle half of recorded prices in the same week. Individual animals may sell above or below this range.</p></CardContent></Card>
          <Card className="rounded-2xl border-slate-200 bg-white"><CardContent className="p-5"><p className="flex items-center gap-2 text-sm font-medium text-slate-600"><CalendarDays className="size-4" />Based on recorded sales</p><p className="mt-3 text-2xl font-bold text-slate-900">{data.latest ? `${data.latest.sales} sales` : "No weekly average yet"}</p><p className="mt-2 text-xs text-slate-600">{data.latest ? `${dateText(data.latest.week_start)} – ${dateText(data.latest.week_end)}${data.latest.partial_week ? " · this week so far" : ""}` : `At least ${data.minimum_sales} priced sales are needed in a week.`}</p><p className="mt-2 text-xs text-slate-500">{data.last_updated ? `Latest record updated ${dateText(data.last_updated)}` : "No matching priced sale records yet."}</p></CardContent></Card>
        </div>

        <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white"><CardHeader className="border-b border-slate-100 bg-slate-50/70"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-lg">Price history and outlook</CardTitle><p className="mt-1 text-xs text-slate-500">Recorded prices are solid green. Available future estimates are dashed blue.</p></div><div className="flex gap-1 rounded-xl bg-white p-1" role="group" aria-label="Price history range">{[[13,"3 months"],[26,"6 months"],[52,"12 months"]].map(([value,label]) => <button key={value} type="button" aria-pressed={historyWeeks === value} onClick={() => setHistoryWeeks(Number(value))} className={`rounded-lg px-3 py-2 text-xs font-semibold ${historyWeeks === value ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>)}</div></div></CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">{data.latest ? <div className="h-72 w-full sm:h-80" role="img" aria-label="Weekly average recorded cattle prices and available four-week estimates"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{top:15,right:10,bottom:15,left:5}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="date" tickFormatter={value => dateText(String(value))} tick={{fontSize:11}} minTickGap={45} /><YAxis tickFormatter={value => `₱${Math.round(Number(value)/1000)}k`} tick={{fontSize:11}} width={65} /><Tooltip labelFormatter={value => `Week of ${dateText(String(value))}`} formatter={value => peso(typeof value === "number" ? value : null)} /><Legend wrapperStyle={{fontSize:12,paddingTop:12}} /><Line type="linear" dataKey="recorded" name="Recorded weekly average" stroke="#047857" strokeWidth={2.5} dot={false} connectNulls={false} /><Line type="linear" dataKey="estimated" name="Estimated weekly average" stroke="#0284c7" strokeWidth={2.5} strokeDasharray="5 5" dot={{r:3}} connectNulls={false} /></LineChart></ResponsiveContainer></div> : <div className="rounded-xl bg-slate-50 px-5 py-10 text-center"><CircleDollarSign className="mx-auto mb-3 size-9 text-emerald-600" /><h3 className="font-semibold text-slate-900">No weekly prices to show for this selection yet</h3><p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">We publish a weekly average after at least {data.minimum_sales} matching priced sales are recorded. Missing prices are not shown as zero.</p></div>}
          <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-sky-900"><TrendingUp className="size-4" />Next four weeks</p><p className="mt-1 text-xs leading-relaxed text-slate-600">{data.forecast?.message ?? "An outlook is not available yet."}</p>{data.forecast?.available && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{data.forecast.points.map(point => <div className="rounded-lg bg-white p-3" key={point.week_start}><p className="text-xs text-slate-500">Week of {dateText(point.week_start)}</p><p className="mt-1 font-bold text-sky-900">{peso(point.price)}</p></div>)}</div>}</div>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500"><Info className="mt-0.5 size-4 shrink-0" />These are reference prices, not a promised sale value. They cover sales recorded in SmartLivestock, not every transaction in the market. Gaps mean there are not enough publishable prices for that week.</p>
        </CardContent></Card>

        <details className="group rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Where do these prices come from?</summary><div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600"><p>{data.price_basis}</p><p>{data.filter_note}</p><p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />{data.privacy_note}</p>{data.forecast?.available && <p>The outlook uses {data.forecast.model}, compared over {data.forecast.checked_windows} earlier windows. Its average historical difference was {peso(data.forecast.average_error_php)} per weekly average. Breed and weight filters narrow the recorded sales; this is not an individual-animal appraisal.</p>}</div></details>
        {!data.is_demo && data.demo_available && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-4"><p className="text-xs text-slate-500">Presentation preview</p><Button variant="outline" size="sm" onClick={() => {setMode("DEMO"); resetFilters();}}>View demo</Button></div>}
      </>}
    </div>
  </>;
}
