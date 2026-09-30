"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "@/lib/axios";

interface SeriesPoint { month: string; label: string; reported_heads: number; deaths: number }
interface ProductTotal { type: string; unit: string; quantity: number; records: number }
interface DescriptiveResponse {
  surveillance_series: SeriesPoint[];
  descriptive: {
    period: { start: string; end: string };
    population: { total_heads: number; by_barangay: { barangay: string; heads: number }[]; by_species: { species: string; heads: number }[] };
    production: { records: number; by_type: ProductTotal[]; trend: { month: string; type: string; unit: string; quantity: number }[]; by_barangay: { barangay: string | null; type: string; unit: string; quantity: number }[] };
    disease: { cases: number; affected_heads: number; by_type: { name: string; cases: number; affected_heads: number }[]; by_barangay: { barangay: string | null; cases: number; affected_heads: number }[] };
    mortality: { records: number; deaths: number; by_cause: { cause: string; deaths: number }[] };
    vaccination: { vaccinated: number; total: number; coverage_pct: number; by_barangay: { barangay: string; total: number; vaccinated: number; coverage_pct: number }[] };
    sales: { sales: number; animals: number; recorded_value: number | null; priced_sales: number };
  };
}

const number = (value: number) => value.toLocaleString();
const panel = "rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:p-4";

export default function DescriptiveAnalytics() {
  const [response, setResponse] = useState<DescriptiveResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [productKey, setProductKey] = useState("");

  useEffect(() => {
    let active = true;
    // The API already carries the user's token and exposes only approved records.
    api.get<DescriptiveResponse>("analytics/dashboard/")
      .then(({ data }) => {
        if (!data.descriptive) throw new Error("Descriptive analytics are unavailable from the API.");
        if (active) setResponse(data);
      })
      .catch(() => { if (active) setError("Could not load approved analytics. Please try again later."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div role="status" className={panel}>Loading approved records...</div>;
  if (error || !response) return <div role="alert" className={panel}>{error || "Analytics are unavailable."}</div>;

  const data = response.descriptive;
  const product = data.production.by_type.find((item) => `${item.type}:${item.unit}` === productKey) ?? data.production.by_type[0];
  const months = response.surveillance_series.map(({ month, label }) => ({
    month, label,
    quantity: product ? data.production.trend.find((point) => point.month === month && point.type === product.type && point.unit === product.unit)?.quantity ?? 0 : 0,
  }));
  const hasDiseaseOrMortality = response.surveillance_series.some((point) => point.reported_heads || point.deaths);
  const stats = [
    { label: "Approved livestock", value: number(data.population.total_heads), note: "Current active heads" },
    { label: "Production records", value: number(data.production.records), note: `${number(data.production.by_type.length)} types with approved output` },
    { label: "Disease cases", value: number(data.disease.cases), note: `${number(data.disease.affected_heads)} affected heads` },
    { label: "Deaths", value: number(data.mortality.deaths), note: `${number(data.mortality.records)} approved records` },
    { label: "Vaccination dates", value: `${data.vaccination.coverage_pct}%`, note: `${number(data.vaccination.vaccinated)} of ${number(data.vaccination.total)} active heads` },
    { label: "Live animal sales", value: number(data.sales.animals), note: `${number(data.sales.sales)} approved sales` },
  ];

  return (
    <div className="space-y-3.5">
      <p className="text-xs text-slate-500">Events from {data.period.start} to {data.period.end}. Population and recorded vaccination dates are current snapshots. All figures require MAO approval.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((stat) => <div key={stat.label} className={panel}><p className="text-xs text-slate-500">{stat.label}</p><p className="mt-1 text-xl font-semibold text-slate-900">{stat.value}</p><p className="mt-1 text-xs text-slate-500">{stat.note}</p></div>)}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-900">Production trend</h3>{product ? <span className="text-xs text-slate-500">{product.type.toLowerCase()} ({product.unit.toLowerCase()})</span> : null}</div>
          {data.production.by_type.length ? <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">{data.production.by_type.map((item) => <span key={`${item.type}:${item.unit}`}>{item.type}: {number(item.quantity)} {item.unit.toLowerCase()}</span>)}</div> : null}
          {data.production.by_type.length > 1 ? <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Choose production type">{data.production.by_type.map((item) => <button key={`${item.type}:${item.unit}`} type="button" onClick={() => setProductKey(`${item.type}:${item.unit}`)} aria-pressed={item.type === product?.type && item.unit === product?.unit} className={`rounded-lg px-2 py-1 text-xs ${item.type === product?.type && item.unit === product?.unit ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}>{item.type} / {item.unit}</button>)}</div> : null}
          {product ? <div className="mt-3 h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={months}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="quantity" name={`${product.type} (${product.unit})`} stroke="#2D5A27" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <p className="mt-4 text-sm text-slate-500">No approved production for this period.</p>}
        </section>
        <section className={panel}>
          <h3 className="text-sm font-semibold text-slate-900">Affected heads and deaths by month</h3>
          {hasDiseaseOrMortality ? <div className="mt-3 h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={response.surveillance_series}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="reported_heads" name="Affected heads" stroke="#d97706" strokeWidth={2} /><Line type="monotone" dataKey="deaths" name="Deaths" stroke="#dc2626" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <p className="mt-4 text-sm text-slate-500">No approved disease or mortality records for this period.</p>}
        </section>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <section className={panel}><h3 className="text-sm font-semibold text-slate-900">Population by species</h3>{data.population.by_species.length ? <div className="mt-3 h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.population.by_species}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="species" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="heads" name="Heads" fill="#2D5A27" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="mt-4 text-sm text-slate-500">No approved active livestock.</p>}</section>
        <section className={panel}><h3 className="text-sm font-semibold text-slate-900">Population by barangay</h3>{data.population.by_barangay.length ? <div className="mt-3" style={{ height: Math.max(240, data.population.by_barangay.length * 29) }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data.population.by_barangay} layout="vertical" margin={{ left: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="barangay" width={104} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="heads" name="Heads" fill="#2D5A27" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div> : <p className="mt-4 text-sm text-slate-500">No approved active livestock.</p>}</section>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <section className={panel}><h3 className="text-sm font-semibold text-slate-900">Disease by type and barangay</h3>{data.disease.by_type.length ? <div className="mt-3 space-y-2">{data.disease.by_type.map((row) => <p key={row.name} className="flex justify-between gap-3 text-sm"><span>{row.name}</span><span className="font-medium">{number(row.cases)} cases / {number(row.affected_heads)} heads</span></p>)}<div className="border-t border-slate-100 pt-2">{data.disease.by_barangay.map((row) => <p key={row.barangay ?? "unknown"} className="flex justify-between gap-3 text-xs text-slate-600"><span>{row.barangay ?? "Unmapped"}</span><span>{number(row.affected_heads)} affected</span></p>)}</div></div> : <p className="mt-4 text-sm text-slate-500">No approved disease cases for this period.</p>}</section>
        <section className={panel}><h3 className="text-sm font-semibold text-slate-900">Recorded mortality causes</h3>{data.mortality.by_cause.length ? <div className="mt-3 space-y-2">{data.mortality.by_cause.map((row) => <p key={row.cause} className="flex justify-between gap-3 text-sm"><span className="break-words">{row.cause}</span><span className="shrink-0 font-medium">{number(row.deaths)} deaths</span></p>)}</div> : <p className="mt-4 text-sm text-slate-500">No approved mortality records for this period.</p>}</section>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <section className={panel}><h3 className="text-sm font-semibold text-slate-900">Production by barangay</h3>{data.production.by_barangay.length ? <div className="mt-3 space-y-2">{data.production.by_barangay.map((row, index) => <p key={`${row.barangay}:${row.type}:${row.unit}:${index}`} className="flex justify-between gap-3 text-xs"><span>{row.barangay ?? "Unmapped"} · {row.type.toLowerCase()}</span><span className="shrink-0 font-medium">{number(row.quantity)} {row.unit.toLowerCase()}</span></p>)}</div> : <p className="mt-4 text-sm text-slate-500">No approved production for this period.</p>}</section>
        <section className={panel}><h3 className="text-sm font-semibold text-slate-900">Recorded vaccination coverage</h3><p className="mt-1 text-xs text-slate-500">Active approved heads with a vaccination date; this is not a vaccination history.</p>{data.vaccination.by_barangay.length ? <div className="mt-3 space-y-2">{data.vaccination.by_barangay.map((row) => <div key={row.barangay}><div className="flex justify-between gap-2 text-xs"><span>{row.barangay}</span><span>{number(row.vaccinated)} / {number(row.total)} ({row.coverage_pct}%)</span></div><div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${row.coverage_pct}%` }} /></div></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No approved active livestock.</p>}</section>
      </div>
      <section className={panel}><h3 className="text-sm font-semibold text-slate-900">Live animal sales</h3>{data.sales.sales ? <p className="mt-2 text-sm text-slate-700">{number(data.sales.animals)} animals in {number(data.sales.sales)} approved sales. {data.sales.recorded_value !== null ? `Recorded value: ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(data.sales.recorded_value)} from ${number(data.sales.priced_sales)} priced sales.` : "No sale prices were recorded."}</p> : <p className="mt-2 text-sm text-slate-500">No approved sales for this period.</p>}</section>
    </div>
  );
}
