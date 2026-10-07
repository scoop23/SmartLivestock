"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ReactNode } from "react";
import type { OfficialReport, ReportType } from "./report-api";

type Row = OfficialReport["rows"][number];
const COLORS = ["#047857", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#64748b"];
const label = (row: Row, key: string) => String(row[key] ?? "").trim() || "Unknown";
const amount = (row: Row, key: string) => Number(row[key] ?? 0) || 0;
const sumBy = (rows: Row[], key: string, valueKey: string) => {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const name = label(row, key);
    totals.set(name, (totals.get(name) ?? 0) + amount(row, valueKey));
  }
  return [...totals].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};
const countBy = (rows: Row[], key: string, identityKey: string) => {
  const groups = new Map<string, Set<string>>();
  rows.forEach((row, index) => {
    const name = label(row, key);
    const identities = groups.get(name) ?? new Set<string>();
    identities.add(row[identityKey] == null ? String(index) : String(row[identityKey]));
    groups.set(name, identities);
  });
  return [...groups].map(([name, values]) => ({ name, value: values.size })).sort((a, b) => b.value - a.value);
};
const monthly = (rows: Row[], valueKey: string) => {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const date = String(row.record_date ?? "");
    if (!/^\d{4}-\d{2}/.test(date)) continue;
    const month = date.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + amount(row, valueKey));
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, value }));
};
const monthlyRecords = (rows: Row[], dateKey = "record_date", identityKey?: string) => {
  const totals = new Map<string, Set<string>>();
  rows.forEach((row, index) => {
    const date = String(row[dateKey] ?? "");
    if (!/^\d{4}-\d{2}/.test(date)) return;
    const month = date.slice(0, 7);
    const identities = totals.get(month) ?? new Set<string>();
    identities.add(identityKey ? label(row, identityKey) : String(index));
    totals.set(month, identities);
  });
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({ month, value: values.size }));
};

function ChartCard({ title, note, children, empty = false, emptyMessage = "No data available for the selected filters." }: { title: string; note?: string; children: ReactNode; empty?: boolean; emptyMessage?: string }) {
  return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <h3 className="font-bold text-slate-900">{title}</h3>{note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    {empty ? <div className="flex h-64 items-center justify-center px-4 text-center text-sm text-slate-500">{emptyMessage}</div> : <div className="mt-3 h-64 min-w-0">{children}</div>}
  </article>;
}

function Bars({ data, horizontal = false, unit }: { data: { name: string; value: number }[]; horizontal?: boolean; unit?: string }) {
  if (!data.length) return null;
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 18, left: horizontal ? 8 : -16, bottom: 4 }}>
    <CartesianGrid strokeDasharray="3 3" vertical={!horizontal} />
    {horizontal ? <><XAxis type="number" tickFormatter={(v) => Number(v).toLocaleString()} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} /></> : <><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} /><YAxis tickFormatter={(v) => Number(v).toLocaleString()} width={48} /></>}
    <Tooltip formatter={(v) => [`${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`, "Total"]} />
    <Bar dataKey="value" fill="#047857" radius={[4, 4, 0, 0]} />
  </BarChart></ResponsiveContainer>;
}

function Donut({ data, force = false }: { data: { name: string; value: number }[]; force?: boolean }) {
  // Pie charts answer small-category composition questions; a single category
  // or a long list is clearer as a bar chart.
  if ((!force && data.length < 2) || data.length > 7) return <Bars data={data} />;
  return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="76%" paddingAngle={2}>
    {data.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
  </Pie><Tooltip formatter={(v) => Number(v).toLocaleString()} /><Legend /></PieChart></ResponsiveContainer>;
}

function Trend({ data, unit }: { data: { month: string; value: number }[]; unit?: string }) {
  if (!data.length) return null;
  return <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 14, left: -12, bottom: 4 }}>
    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis width={48} tickFormatter={(v) => Number(v).toLocaleString()} />
    <Tooltip labelFormatter={(v) => new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${v}-01T00:00:00Z`))} formatter={(v) => [`${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`, "Total"]} />
    <Line type="monotone" dataKey="value" stroke="#047857" strokeWidth={3} dot={{ r: 3 }} />
  </LineChart></ResponsiveContainer>;
}

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return <div className="border-b border-slate-200 pb-2"><h3 className="text-base font-black text-slate-950">{title}</h3><p className="text-sm text-slate-600">{detail}</p></div>;
}

export function ReportCharts({ report, reportType }: { report: OfficialReport; reportType: ReportType }) {
  const rows = report.rows;
  const records = (kind: string) => rows.filter((row) => row.record_kind === kind);
  const descriptions: Record<ReportType, string> = {
    inventory: "This report summarizes approved livestock inventory in the selected period. Species and barangay charts show how recorded heads are distributed across the municipality.",
    production: "This report summarizes approved production records in the selected period. Production types stay grouped by their original unit, so liters, kilograms, and pieces are never combined into one percentage.",
    disease_mortality: "This report summarizes approved disease and mortality records. Disease charts describe reported case counts and affected heads, while mortality charts show recorded deaths over time and by species.",
    slaughter: "This report summarizes approved slaughter records, including animals processed and recorded carcass weights. Species distribution and monthly trends describe activity without combining head counts with kilograms.",
    movement: "This report separates auction activity from livestock movement. Auction charts describe sale activity; movement charts describe origin, destination, and direction, including unresolved UNKNOWN locations.",
    inspection: "This report summarizes approved inspections and clearance records. Status and trend charts describe official review outcomes and issuance activity in the selected period.",
  };
  const description = <p className="text-sm leading-6 text-slate-600">{descriptions[reportType]}</p>;
  if (reportType === "inventory") {
    return <div className="space-y-4">{description}<div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <ChartCard title="Livestock by Barangay" note="Approved registered heads, ranked high to low." empty={!rows.length}><Bars data={sumBy(rows, "barangay", "quantity").reverse()} horizontal unit="heads" /></ChartCard>
      <ChartCard title="Livestock Distribution by Species" note="Share of registered livestock heads. Pie charts suit a small set of categories that make up a whole." empty={!rows.length}><Donut data={sumBy(rows, "species", "quantity")} /></ChartCard>
      <ChartCard title="Historical Inventory Trend" note="The current inventory records do not contain dated historical stock snapshots." empty emptyMessage="No historical inventory trend available." ><p /></ChartCard>
    </div></div>;
  }
  if (reportType === "production") {
    const units = [...new Set(rows.map((row) => label(row, "unit")))];
    if (!units.length) return <ChartCard title="Production Visualizations" empty><p /></ChartCard>;
    const typeCharts = units.map((unit) => {
      const unitRows = rows.filter((row) => label(row, "unit") === unit);
      const distribution = sumBy(unitRows, "production_type", "quantity");
      return <div key={unit} className="contents"><ChartCard title={`Production by Type (${unit})`} note="Types are compared only within the same unit." empty={!unitRows.length}><Bars data={distribution} unit={unit.toLowerCase()} /></ChartCard>
        {distribution.length > 1 && <ChartCard title={`Production Distribution by Type (${unit})`} note={`Share of production measured in ${unit.toLowerCase()}. Different units are never combined.`}><Donut data={distribution} /></ChartCard>}</div>;
    });
    const trends = units.map((unit) => <ChartCard key={unit} title={`Production Over Time (${unit})`} note="Monthly approved output." empty={!rows.some((row) => label(row, "unit") === unit)}><Trend data={monthly(rows.filter((row) => label(row, "unit") === unit), "quantity")} unit={unit.toLowerCase()} /></ChartCard>);
    return <div className="space-y-4">{description}<div className="grid min-w-0 gap-4 lg:grid-cols-2">{trends}{typeCharts}</div></div>;
  }
  if (reportType === "disease_mortality") {
    const diseases = rows.filter((row) => row.record_kind === "DISEASE");
    const deaths = rows.filter((row) => row.record_kind === "MORTALITY");
    return <div className="space-y-4">{description}<div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <ChartCard title="Disease Cases Over Time" note="Descriptive count of approved disease case records." empty={!diseases.length}><Trend data={monthlyRecords(diseases)} unit="cases" /></ChartCard>
      <ChartCard title="Disease Distribution" note="Approved affected animals by reported condition." empty={!diseases.length}><Donut data={sumBy(diseases, "condition_or_cause", "affected_or_dead")} /></ChartCard>
      <ChartCard title="Disease Cases by Disease Type" note="Share of approved disease case records by reported condition." empty={!diseases.length}><Donut data={countBy(diseases, "condition_or_cause", "__record")} /></ChartCard>
      <ChartCard title="Disease by Barangay" note="Approved affected animals by barangay." empty={!diseases.length}><Bars data={sumBy(diseases, "barangay", "affected_or_dead").reverse()} horizontal unit="affected" /></ChartCard>
      <ChartCard title="Mortality Over Time" note="Descriptive count of approved mortality records." empty={!deaths.length}><Trend data={monthlyRecords(deaths)} unit="records" /></ChartCard>
      <ChartCard title="Mortality by Species" note="Approved deaths by species." empty={!deaths.length}><Bars data={sumBy(deaths, "species", "affected_or_dead")} unit="deaths" /></ChartCard>
    </div></div>;
  }
  if (reportType === "slaughter") return <div className="space-y-4">{description}<div className="grid min-w-0 gap-4 lg:grid-cols-2">
    <ChartCard title="Slaughter Trend" note="Animals slaughtered per month." empty={!rows.length}><Trend data={monthly(rows, "quantity")} unit="animals" /></ChartCard>
    <ChartCard title="Slaughter by Species" note="Approved animals slaughtered." empty={!rows.length}><Bars data={sumBy(rows, "species", "quantity")} unit="animals" /></ChartCard>
    <ChartCard title="Slaughtered Animals by Species" note="Part-to-whole distribution of approved slaughter counts." empty={!rows.length}><Donut data={sumBy(rows, "species", "quantity")} /></ChartCard>
    <ChartCard title="Carcass Weight by Species" note="Kilograms are kept separate from animal counts." empty={!rows.some((row) => row.carcass_weight_kg != null)}><Bars data={sumBy(rows.filter((row) => row.carcass_weight_kg != null), "species", "carcass_weight_kg")} unit="kg" /></ChartCard>
  </div></div>;
  if (reportType === "movement") {
    const auction = records("AUCTION");
    const movement = records("MOVEMENT");
    return <div className="space-y-4">{description}<div className="space-y-5">
      <SectionTitle title="Auction Activity" detail="What livestock activity was processed through the auction operation?" />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard title="Auction Activity Over Time" note="Approved auction sale items processed per month." empty={!auction.length}><Trend data={monthly(auction, "quantity")} unit="heads" /></ChartCard>
        <ChartCard title="Auction Livestock by Species" note="Approved livestock sale quantity." empty={!auction.length}><Donut data={sumBy(auction, "species", "quantity")} /></ChartCard>
        <ChartCard title="Auction Origins" note="Seller barangay from the linked farmer record." empty={!auction.length}><Bars data={sumBy(auction, "origin", "quantity").reverse()} horizontal unit="heads" /></ChartCard>
        <ChartCard title="Auction Destinations" note="Recorded sale destination." empty={!auction.length}><Bars data={sumBy(auction, "destination", "quantity").reverse()} horizontal unit="heads" /></ChartCard>
        <ChartCard title="Auction Purpose" empty={!auction.length}><Bars data={sumBy(auction, "purpose", "quantity")} unit="heads" /></ChartCard>
      </div>
      <SectionTitle title="Movement Analysis" detail="Where livestock moved. Unknown locations remain visible when text cannot be confidently matched to Padre Garcia." />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard title="Movement Direction" note="Based on the shared municipality direction classifier; UNKNOWN stays visible." empty={!movement.length}><Donut force data={["INBOUND", "OUTBOUND", "INTERNAL", "UNKNOWN"].map((name) => ({ name, value: movement.filter((row) => row.direction === name).length }))} /></ChartCard>
        <ChartCard title="Movement Trend" note="Movement lines by inspection month." empty={!movement.length}><Trend data={monthly(movement, "quantity")} unit="heads" /></ChartCard>
        <ChartCard title="Top Origins" empty={!movement.length}><Bars data={sumBy(movement, "origin", "quantity").reverse()} horizontal unit="heads" /></ChartCard>
        <ChartCard title="Top Destinations" empty={!movement.length}><Bars data={sumBy(movement, "destination", "quantity").reverse()} horizontal unit="heads" /></ChartCard>
        <ChartCard title="Movement Purpose" empty={!movement.length}><Bars data={sumBy(movement, "purpose", "quantity")} unit="heads" /></ChartCard>
        <ChartCard title="Movement by Species" empty={!movement.length}><Bars data={sumBy(movement, "species", "quantity")} unit="heads" /></ChartCard>
      </div>
    </div></div>;
  }
  return <div className="space-y-4">{description}
    <SectionTitle title="Inspection & Clearance" detail="Official review and clearance status for eligible inspection records." />
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <ChartCard title="Inspection Status" note="Only MAO-approved clearances are included in this official report." empty={!rows.length}><Donut data={countBy(rows, "clearance_status", "control_number")} /></ChartCard>
      <ChartCard title="Inspections Over Time" note="Distinct approved clearance records by inspection month." empty={!rows.length}><Trend data={monthlyRecords(rows, "record_date", "control_number")} unit="inspections" /></ChartCard>
      <ChartCard title="Inspection Purpose" empty={!rows.length}><Bars data={sumBy(rows, "purpose", "quantity")} unit="heads" /></ChartCard>
      <ChartCard title="Inspection Origins" empty={!rows.length}><Bars data={sumBy(rows, "origin", "quantity").reverse()} horizontal unit="heads" /></ChartCard>
      <ChartCard title="Inspection Destinations" empty={!rows.length}><Bars data={sumBy(rows, "destination", "quantity").reverse()} horizontal unit="heads" /></ChartCard>
      <ChartCard title="Clearance Trend" note="Distinct approved clearances by issuance month." empty={!rows.some((row) => row.issued_date)}><Trend data={monthlyRecords(rows, "issued_date", "control_number")} unit="clearances" /></ChartCard>
    </div>
  </div>;
}
