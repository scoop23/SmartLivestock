"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClipboardCheck, LineChart, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InspectionRecord } from "../auction-inspections/auction-analytics";

const classifications = [
  { key: "SLAUGHTER", label: "Slaughter", color: "#047857" },
  { key: "BREEDER", label: "Breeder", color: "#10b981" },
  { key: "FATTENING", label: "Fattening", color: "#6ee7b7" },
  { key: "OTHER", label: "Other", color: "#94a3b8" },
  { key: "UNKNOWN", label: "Not classified", color: "#cbd5e1" },
];

export default function InspectionClassificationChart({ inspections, period, loading, error }: {
  inspections: InspectionRecord[]; period: string; loading: boolean; error: boolean;
}) {
  const [scope, setScope] = useState<"APPROVED" | "ALL">("APPROVED");
  const [table, setTable] = useState(false);
  const summary = useMemo(() => {
    const records = inspections.filter(record => {
      if (scope === "APPROVED" && record.clearance?.status !== "APPROVED") return false;
      if (period === "ALL") return true;
      const [selection, year] = period.split(" ");
      const date = record.inspection_date;
      if (!date || !date.startsWith(`${year}-`)) return false;
      return selection === "FULL" || Math.ceil(Number(date.slice(5, 7)) / 3) === Number(selection.slice(1));
    });
    const rows = classifications.map(item => ({ ...item, heads: 0, records: new Set<number>() }));
    for (const record of records) {
      for (const item of record.items || []) {
        const row = rows.find(row => row.key === item.classification) || rows[rows.length - 1];
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;
        row.heads += quantity;
        row.records.add(record.id);
      }
    }
    return { rows: rows.map(row => ({ ...row, records: row.records.size })), records: records.length, heads: rows.reduce((sum, row) => sum + row.heads, 0) };
  }, [inspections, period, scope]);

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
      <div><h2 className="flex items-center gap-2 font-bold text-slate-900"><ClipboardCheck className="size-5 text-emerald-700" />Livestock Inspection & Movement Classification</h2><p className="mt-1 text-xs text-slate-500">Heads listed by animal classification · {period === "ALL" ? "All recorded periods" : period} · Based on inspection date</p></div>
      <Button size="sm" variant="outline" onClick={() => setTable(value => !value)}>{table ? <LineChart className="size-4 text-emerald-700" /> : <Table2 className="size-4 text-emerald-700" />}{table ? "Show Visual Chart" : "Inspect Numbers"}</Button>
    </div>
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Inspection classification scope" className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">{([ ["APPROVED", "Approved movements"], ["ALL", "All inspection records"] ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={scope === value} onClick={() => setScope(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${scope === value ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>{label}</button>)}</div>
        {!loading && !error && <p className="text-xs text-slate-600"><strong className="text-slate-900">{summary.heads.toLocaleString()} heads listed</strong> across {summary.records.toLocaleString()} inspection records</p>}
      </div>
      {loading ? <div role="status" className="grid h-72 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">Loading inspection classifications...</div> : error ? <p role="alert" className="rounded-xl bg-rose-50 p-6 text-sm text-rose-800">Inspection records could not be loaded. Use Refresh to try again.</p> : !summary.heads ? <div className="grid h-72 place-items-center rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No {scope === "APPROVED" ? "approved movement" : "inspection"} heads are available for this period. Try another period or scope.</div> : table ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">Classification</th><th className="px-4 py-3 text-right">Heads listed</th><th className="px-4 py-3 text-right">Inspection records</th><th className="px-4 py-3 text-right">Share of heads</th></tr></thead><tbody>{summary.rows.map(row => <tr key={row.key} className="border-t border-slate-100"><th scope="row" className="px-4 py-3 font-medium">{row.label}</th><td className="px-4 py-3 text-right">{row.heads.toLocaleString()}</td><td className="px-4 py-3 text-right">{row.records.toLocaleString()}</td><td className="px-4 py-3 text-right">{(row.heads / summary.heads * 100).toFixed(1)}%</td></tr>)}</tbody></table></div> : <div className="h-80 w-full" role="img" aria-label="Heads listed by livestock inspection classification"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.rows} margin={{ top: 15, right: 15, bottom: 5, left: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip formatter={value => [Number(value).toLocaleString(), "Heads listed"]} cursor={{ fill: "#f0fdf4" }} /><Bar dataKey="heads" radius={[6, 6, 0, 0]} maxBarSize={72}>{summary.rows.map(row => <Cell key={row.key} fill={row.color} />)}</Bar></BarChart></ResponsiveContainer></div>}
      <p className="text-xs leading-relaxed text-slate-500">{scope === "APPROVED" ? "Includes only inspections with an MAO-approved movement clearance." : "Includes inspection records at every review stage, including returned records; these are not all approved movements."} Counts sum the heads listed on inspection items, not unique animals or completed trips. The same animal may appear in separate inspections, and a record can contain multiple classifications.</p>
    </div>
  </section>;
}
