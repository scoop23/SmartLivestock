"use client";

import { useState, type FormEvent } from "react";
import axios from "axios";
import { CalendarDays, ClipboardList, Download, FileSpreadsheet, FileText, HeartPulse, MapPinned, PawPrint, RefreshCw, Scissors } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { downloadOfficialReport, fetchOfficialReport, OfficialReport, ReportFilters, ReportType } from "./report-api";
import { ReportCharts } from "./report-charts";
<<<<<<< HEAD
import { ReportAnalysis, ReportMethodology } from "./report-analysis";
=======
>>>>>>> origin/feature/reports-overhaul

const REPORTS: { id: ReportType; title: string; description: string; icon: typeof PawPrint }[] = [
  { id: "inventory", title: "Livestock Inventory", description: "Registered animals by species, owner, and operational status.", icon: PawPrint },
  { id: "production", title: "Production", description: "Approved production by type and its original unit.", icon: FileSpreadsheet },
  { id: "disease_mortality", title: "Disease & Mortality", description: "Approved disease events and mortality, shown separately.", icon: HeartPulse },
  { id: "slaughter", title: "Slaughter", description: "Approved slaughter counts and recorded carcass weight.", icon: Scissors },
  { id: "movement", title: "Auction & Movement", description: "Approved auction movements with municipality direction labels.", icon: MapPinned },
  { id: "inspection", title: "Inspection & Clearance", description: "Approved inspections and issued clearance details.", icon: ClipboardList },
];
const EMPTY_FILTERS: ReportFilters = { species: "", barangay: "", purpose: "", direction: "" };
const dateValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const today = () => dateValue(new Date());
const formatDate = (value: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(new Date(`${value}T00:00:00`));
const humanize = (key: string) => key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const reportErrorMessage = (cause: unknown) => {
  if (!axios.isAxiosError(cause)) return "Unable to generate this report because the report service encountered an error. Please try again.";
  const status = cause.response?.status;
  if (status === 400 || status === 422) return "The selected reporting period or filters are invalid.";
  if (status === 401 || status === 403) return "You are not authorized to generate this report.";
  // A valid empty preview is HTTP 200 and gets its own empty state below.
  return "Unable to generate this report because the report service encountered an error. Please try again.";
};

export default function ReportsPage() {
  const now = new Date();
  const [reportType, setReportType] = useState<ReportType>("inventory");
  const [dateFrom, setDateFrom] = useState(dateValue(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(today());
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [report, setReport] = useState<OfficialReport | null>(null);
  const [previewConfig, setPreviewConfig] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [error, setError] = useState("");

  // Export buttons are enabled only when the preview was generated from the exact
  // current configuration; edits must be previewed again before they can be exported.
  const configKey = JSON.stringify([reportType, dateFrom, dateTo, filters]);
  const hasCurrentPreview = Boolean(report && previewConfig === configKey);
  const presets: Record<string, [string, string]> = {
    "This Month": [dateValue(new Date(now.getFullYear(), now.getMonth(), 1)), today()],
    "Last Month": [dateValue(new Date(now.getFullYear(), now.getMonth() - 1, 1)), dateValue(new Date(now.getFullYear(), now.getMonth(), 0))],
    "This Quarter": [dateValue(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)), today()],
    "This Year": [dateValue(new Date(now.getFullYear(), 0, 1)), today()],
  };

  const generatePreview = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true); setError(""); setReport(null); setPreviewConfig("");
    try {
      const data = await fetchOfficialReport(reportType, dateFrom, dateTo, filters);
      setReport(data); setPreviewConfig(configKey);
    } catch (cause: unknown) {
      setError(reportErrorMessage(cause));
    } finally { setLoading(false); }
  };

  const exportReport = async (format: "xlsx" | "pdf") => {
    if (!hasCurrentPreview) return;
    setExporting(format); setError("");
    try {
      const response = await downloadOfficialReport(reportType, dateFrom, dateTo, filters, format);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url; link.download = `${reportType}_${dateFrom}_${dateTo}.${format}`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { setError(`Unable to generate ${format.toUpperCase()}. Please try again.`); }
    finally { setExporting(null); }
  };
  const setFilter = (key: keyof ReportFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  return <>
    <PageHeader title="Reports & Official Records" subtitle="Generate data-backed reports for municipal monitoring, review, and decision-making." icon={<FileText className="size-5 text-emerald-800" />} variant="admin" maxWidthClass="w-full" />
    <main className="mx-auto w-full max-w-screen-2xl space-y-7 px-4 py-6 pb-12 sm:px-6 lg:px-10 lg:py-8">
      <section aria-labelledby="report-types-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h1 id="report-types-heading" className="text-lg font-black text-slate-950">Quick report types</h1><p className="text-sm text-slate-600">Choose the official records you want to review.</p></div><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-900">MAO / Admin workspace</Badge></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{REPORTS.map(({ id, title, description, icon: Icon }) => <button key={id} type="button" onClick={() => setReportType(id)} aria-pressed={reportType === id} className={`min-h-28 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${reportType === id ? "border-emerald-700 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50"}`}><span className={`mb-3 inline-flex size-9 items-center justify-center rounded-xl ${reportType === id ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-800"}`}><Icon className="size-4" /></span><span className="block text-sm font-bold text-slate-950">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span></button>)}</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="configuration-heading">
        <div className="mb-5"><h2 id="configuration-heading" className="text-lg font-black text-slate-950">Configure report</h2><p className="text-sm text-slate-600">Django selects approved records and applies the same filters to preview and exports.</p></div>
        <form onSubmit={generatePreview} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">Report type<select value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm">{REPORTS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">Date from<Input required type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} className="h-11" /></label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">Date to<Input required type="date" value={dateTo} min={dateFrom} max={today()} onChange={(event) => setDateTo(event.target.value)} className="h-11" /></label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">Species (optional)<Input value={filters.species} onChange={(event) => setFilter("species", event.target.value)} placeholder="All species" className="h-11" /></label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">Barangay (optional)<Input value={filters.barangay} onChange={(event) => setFilter("barangay", event.target.value)} placeholder="All barangays" className="h-11" /></label>
            {(reportType === "movement" || reportType === "inspection") && <label className="space-y-1.5 text-sm font-semibold text-slate-700">Purpose (optional)<select value={filters.purpose} onChange={(event) => setFilter("purpose", event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="">All purposes</option>{["BREEDING", "FATTENING", "SLAUGHTER", "OTHER", "UNKNOWN"].map((value) => <option key={value}>{value}</option>)}</select></label>}
            {reportType === "movement" && <label className="space-y-1.5 text-sm font-semibold text-slate-700">Direction (optional)<select value={filters.direction} onChange={(event) => setFilter("direction", event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="">All directions</option>{["INBOUND", "OUTBOUND", "INTERNAL", "UNKNOWN"].map((value) => <option key={value}>{value}</option>)}</select></label>}
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Date range presets">{Object.entries(presets).map(([label, range]) => <Button key={label} type="button" size="sm" variant="outline" onClick={() => { setDateFrom(range[0]); setDateTo(range[1]); }}>{label}</Button>)}</div>
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="size-4" />Selected period: {dateFrom ? formatDate(dateFrom) : "Choose date"} – {dateTo ? formatDate(dateTo) : "Choose date"}</p><Button type="submit" disabled={loading || !dateFrom || !dateTo || dateFrom > dateTo} className="min-h-11 w-full gap-2 bg-emerald-800 text-white hover:bg-emerald-900 sm:w-auto">{loading ? <><RefreshCw className="size-4 animate-spin" />Generating preview…</> : <><FileText className="size-4" />Generate Preview</>}</Button></div>
        </form>
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      </section>

      {hasCurrentPreview && report && <section className="space-y-4" aria-labelledby="preview-heading">
<<<<<<< HEAD
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Report preview</p><h2 id="preview-heading" className="text-xl font-black text-slate-950">{report.title}</h2><p className="mt-1 text-sm text-slate-600">{report.municipality} · {report.period_label}: {formatDate(report.period.date_from)} – {formatDate(report.period.date_to)}</p><p className="mt-1 text-xs text-slate-500">{report.record_count} records · Generated {new Date(report.generated_at).toLocaleString()}</p></div><div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" disabled={Boolean(exporting)} onClick={() => void exportReport("xlsx")} className="min-h-10 gap-2">{exporting === "xlsx" ? <RefreshCw className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}{exporting === "xlsx" ? "Generating Excel…" : "Export Excel"}</Button><Button type="button" disabled={Boolean(exporting)} onClick={() => void exportReport("pdf")} className="min-h-10 gap-2 bg-emerald-800 text-white hover:bg-emerald-900">{exporting === "pdf" ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}{exporting === "pdf" ? "Generating PDF…" : "Export PDF"}</Button></div></div>
        <ReportAnalysis report={report} />
        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Detailed summary metrics</summary><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(report.summary).flatMap(([key, value]) => typeof value === "object" && value !== null ? Object.entries(value).map(([subKey, subValue]) => <div key={`${key}-${subKey}`} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{humanize(subKey)}</p><p className="mt-1 break-words text-lg font-black text-slate-950">{subValue == null ? "Not recorded" : String(subValue)}</p></div>) : [<div key={key} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{humanize(key)}</p><p className="mt-1 break-words text-lg font-black text-slate-950">{value == null ? "Not recorded" : String(value)}</p></div>])}</div></details>
        {/* Charts consume this same authorized, filtered API response as the table. */}
        <ReportCharts report={report} reportType={reportType} />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3"><h3 className="font-bold text-slate-900">Detailed records</h3><Badge variant="outline">Approved records</Badge></div>{report.rows.length === 0 ? <div className="p-10 text-center"><p className="font-bold text-slate-800">{reportType === "inventory" ? "No approved livestock inventory registrations are available for the selected filters and registration period." : "No approved records are available for the selected period and filters."}</p><p className="mt-1 text-sm text-slate-500">Try another date range or remove a filter.</p></div> : <div className="max-h-[34rem] overflow-auto"><table className="min-w-full border-collapse text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr>{report.columns.map((column) => <th key={column.key} className="whitespace-nowrap px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-700">{column.label}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={`${index}-${String(row.control_number ?? row.tag_id ?? row.record_date ?? "row")}`} className="border-t border-slate-100 odd:bg-white even:bg-slate-50">{report.columns.map((column) => <td key={column.key} className="max-w-72 px-3 py-2.5 align-top text-slate-700">{row[column.key] == null || row[column.key] === "" ? "—" : String(row[column.key])}</td>)}</tr>)}</tbody></table></div>}</div>
        <ReportMethodology report={report} />
=======
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Report preview</p><h2 id="preview-heading" className="text-xl font-black text-slate-950">{report.title}</h2><p className="mt-1 text-sm text-slate-600">{report.municipality} · {formatDate(report.period.date_from)} – {formatDate(report.period.date_to)}</p><p className="mt-1 text-xs text-slate-500">{report.record_count} records · Generated {new Date(report.generated_at).toLocaleString()}</p></div><div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" disabled={Boolean(exporting)} onClick={() => void exportReport("xlsx")} className="min-h-10 gap-2">{exporting === "xlsx" ? <RefreshCw className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}{exporting === "xlsx" ? "Generating Excel…" : "Export Excel"}</Button><Button type="button" disabled={Boolean(exporting)} onClick={() => void exportReport("pdf")} className="min-h-10 gap-2 bg-emerald-800 text-white hover:bg-emerald-900">{exporting === "pdf" ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}{exporting === "pdf" ? "Generating PDF…" : "Export PDF"}</Button></div></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(report.summary).flatMap(([key, value]) => typeof value === "object" && value !== null ? Object.entries(value).map(([subKey, subValue]) => <div key={`${key}-${subKey}`} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{humanize(subKey)}</p><p className="mt-1 break-words text-lg font-black text-slate-950">{String(subValue)}</p></div>) : [<div key={key} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{humanize(key)}</p><p className="mt-1 break-words text-lg font-black text-slate-950">{String(value)}</p></div>])}</div>
        {/* Charts consume this same authorized, filtered API response as the table. */}
        <ReportCharts report={report} reportType={reportType} />
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3"><h3 className="font-bold text-slate-900">Detailed records</h3><Badge variant="outline">Approved records</Badge></div>{report.rows.length === 0 ? <div className="p-10 text-center"><p className="font-bold text-slate-800">No records found for the selected period.</p><p className="mt-1 text-sm text-slate-500">Try another date range or remove a filter.</p></div> : <div className="max-h-[34rem] overflow-auto"><table className="min-w-full border-collapse text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr>{report.columns.map((column) => <th key={column.key} className="whitespace-nowrap px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-700">{column.label}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={`${index}-${String(row.control_number ?? row.tag_id ?? row.record_date ?? "row")}`} className="border-t border-slate-100 odd:bg-white even:bg-slate-50">{report.columns.map((column) => <td key={column.key} className="max-w-72 px-3 py-2.5 align-top text-slate-700">{row[column.key] == null || row[column.key] === "" ? "—" : String(row[column.key])}</td>)}</tr>)}</tbody></table></div>}</div>
>>>>>>> origin/feature/reports-overhaul
        <p className="text-xs text-slate-500">Generated by {report.generated_by}. Report history is not stored in SmartLivestock.</p>
      </section>}
      {!hasCurrentPreview && !loading && <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12"><FileText className="mx-auto size-8 text-slate-400" /><h2 className="mt-3 font-bold text-slate-900">{report ? "Preview needs refreshing" : "Preview appears here"}</h2><p className="mt-1 text-sm text-slate-600">{report ? "Your dates or filters changed. Generate a new preview before exporting." : "Select a report and period, then generate a preview from official records."}</p></section>}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><h2 className="font-bold text-slate-900">Recent reports</h2><p className="mt-1 text-sm text-slate-600">Generated downloads are not saved as report history.</p><p className="mt-4 rounded-xl bg-white p-4 text-center text-sm text-slate-500">No generated reports yet.</p></section>
      <p className="text-xs leading-5 text-slate-500">Only records approved in their source workflow are included where approval applies. Exports are generated by the backend using the same authorized filters as this preview.</p>
    </main>
  </>;
}
