"use client";

import { useId, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartNoAxesCombined, Table2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PopulationPoint {
  date: string;
  actual: number | null;
  forecast: number | null;
}

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {month: "short", day: "2-digit", year: "numeric"});
}

export function PopulationForecastChart({timeline, asOf, horizon, method, scenario}: {
  timeline: PopulationPoint[]; asOf: string; horizon: number; method: string; scenario: boolean;
}) {
  const gradient = useId().replace(/:/g, "");
  const [historyMonths, setHistoryMonths] = useState<number | "all">(12);
  const [showNumbers, setShowNumbers] = useState(false);
  const [page, setPage] = useState(0);
  const cutoff = new Date(`${asOf}T00:00:00`);
  if (historyMonths !== "all") cutoff.setMonth(cutoff.getMonth() - historyMonths);
  const rows = timeline.filter(point => historyMonths === "all" || point.date >= asOf || new Date(`${point.date}T00:00:00`) >= cutoff);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const activePage = Math.min(page, pageCount - 1);
  const hasHistory = timeline.some(point => point.date < asOf && point.actual !== null);

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-5 sm:px-6">
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg"><span className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Users className="size-4" /></span>Active registered livestock population - {scenario ? "scenario" : "estimate"} for the next {horizon} month{horizon === 1 ? "" : "s"}</h3>
        <p className="mt-1 text-xs text-slate-500">Method: <strong className="font-mono text-emerald-800">{method}</strong><span className="px-2">•</span>Unit: <strong className="text-slate-700">animals</strong><span className="px-2">•</span>Interval: <strong className="text-slate-700">Monthly</strong></p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => setShowNumbers(value => !value)} aria-pressed={showNumbers} className="h-8 border-slate-200 bg-white font-mono text-xs text-slate-700">
        {showNumbers ? <ChartNoAxesCombined className="mr-1.5 size-3.5 text-emerald-600" /> : <Table2 className="mr-1.5 size-3.5 text-emerald-600" />}{showNumbers ? "View Chart" : "Inspect Numbers"}
      </Button>
    </div>
    <div className="space-y-4 p-4 pt-6 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div><p className="text-xs font-semibold text-slate-800">Show past records</p><p className="text-[11px] text-slate-500">{hasHistory ? "The estimate stays visible." : "Past records appear as monthly change history accumulates."}</p></div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Population past records time range">{([3, 6, 12, "all"] as const).map(value => <button key={value} type="button" disabled={!hasHistory} aria-pressed={historyMonths === value} onClick={() => {setHistoryMonths(value); setPage(0);}} className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${historyMonths === value ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}>{value === "all" ? "All records" : `${value} months`}</button>)}</div>
      </div>
      {showNumbers ? <div className="space-y-3">
        <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50"><tr className="text-left"><th className="p-3">Date</th><th className="p-3">Recorded heads</th><th className="p-3">{scenario ? "Scenario heads" : "Forecast heads"}</th></tr></thead><tbody>{rows.slice(activePage * pageSize, (activePage + 1) * pageSize).map(row => <tr key={row.date} className="border-t border-slate-100"><td className="p-3">{dateLabel(row.date)}</td><td className="p-3">{row.actual?.toLocaleString("en-PH") ?? "—"}</td><td className="p-3 font-semibold text-emerald-800">{row.forecast?.toLocaleString("en-PH") ?? "—"}</td></tr>)}</tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"><span>Showing {rows.length ? activePage * pageSize + 1 : 0}–{Math.min((activePage + 1) * pageSize, rows.length)} of {rows.length} periods</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setPage(activePage - 1)} disabled={activePage === 0}>Previous</Button><span>Page {activePage + 1} of {pageCount}</span><Button variant="outline" size="sm" onClick={() => setPage(activePage + 1)} disabled={activePage >= pageCount - 1}>Next</Button></div></div>
      </div> : <div className="h-80 w-full sm:h-96" role="img" aria-label="Recorded registered livestock population and future monthly estimates">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{top: 25, right: 15, left: -10, bottom: 20}}>
            <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tickFormatter={dateLabel} stroke="#94a3b8" tick={{fill: "#64748b", fontSize: 11, fontFamily: "monospace"}} axisLine={{stroke: "#e2e8f0"}} tickLine={{stroke: "#e2e8f0"}} angle={-45} textAnchor="end" height={55} interval="preserveStartEnd" minTickGap={10} />
            <YAxis allowDecimals={false} domain={[0, "auto"]} stroke="#94a3b8" tick={{fill: "#64748b", fontSize: 11, fontFamily: "monospace"}} axisLine={{stroke: "#e2e8f0"}} tickLine={{stroke: "#e2e8f0"}} tickFormatter={value => Number(value).toLocaleString("en-PH")} />
            <Tooltip labelFormatter={value => dateLabel(String(value))} contentStyle={{borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12}} />
            <Legend wrapperStyle={{paddingTop: 14, fontSize: 12}} formatter={value => <span className="font-medium text-slate-700">{value}</span>} />
            <ReferenceLine x={asOf} stroke="#d97706" strokeDasharray="4 4" strokeWidth={1.5} label={{value: scenario ? "Scenario starts here" : "Estimate starts here", fill: "#b45309", fontSize: 10, position: "top", fontFamily: "monospace"}} />
            <Area type="monotone" dataKey="forecast" stroke="none" fill={`url(#${gradient})`} connectNulls={false} legendType="none" />
            <Line type="monotone" dataKey="actual" name="Recorded registered population" stroke="#64748b" strokeWidth={2} dot={{r: 3.5, fill: "#94a3b8", stroke: "#fff", strokeWidth: 1.5}} activeDot={{r: 6, fill: "#475569"}} connectNulls={false} />
            <Line type="monotone" dataKey="forecast" name={scenario ? "Population scenario" : "Projected registered population"} stroke="#059669" strokeWidth={2.5} strokeDasharray="5 5" dot={{r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 1.5}} activeDot={{r: 6, fill: "#059669"}} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>}
    </div>
  </section>;
}
