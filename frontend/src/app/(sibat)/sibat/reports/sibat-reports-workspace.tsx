"use client";

import { downloadOfficialReport,fetchOfficialReport,type OfficialReport,type ReportFilters,type ReportType } from "@/app/(admin)/reports/report-api";
import { ReportCharts } from "@/app/(admin)/reports/report-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeftRight,BarChart3,CalendarDays,ClipboardCheck,Download,FileSpreadsheet,FileText,HeartPulse,MapPin,RefreshCw,ShieldCheck } from "lucide-react";
import { useState,type FormEvent } from "react";

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "inventory", label: "Livestock inventory" },
  { value: "production", label: "Production" },
  { value: "disease_mortality", label: "Disease and mortality" },
  { value: "slaughter", label: "Slaughter" },
  { value: "movement", label: "Auction and movement" },
  { value: "inspection", label: "Inspection and clearance" },
];

const REPORT_DESCRIPTIONS: Record<ReportType, string> = {
  inventory: "Livestock population and inventory records for your reporting area.",
  production: "Approved production records submitted during the selected period.",
  disease_mortality: "Health and mortality records.",
  slaughter: "Approved slaughter records and totals.",
  movement: "Auction and livestock movement records.",
  inspection: "Inspection and clearance activity records.",
};

const REPORT_ICONS = {
  inventory: BarChart3,
  production: ClipboardCheck,
  disease_mortality: HeartPulse,
  slaughter: ShieldCheck,
  movement: ArrowLeftRight,
  inspection: FileSpreadsheet,
} as const;

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const dateValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const formatDate = (value: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
const EMPTY_FILTERS: ReportFilters = { species: "", barangay: "", purpose: "", direction: "" };

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    const detail = responseData && typeof responseData === "object" && "detail" in responseData
      ? responseData.detail
      : undefined;
    if (error.response?.status === 401 || error.response?.status === 403) {
      return typeof detail === "string" ? detail : "You are not authorized to view this report. Check your SIBAT/CBAT reporting scope.";
    }
    if (error.response?.status === 400 || error.response?.status === 422) return "Check the selected report dates and try again.";
  }
  return "The barangay report could not be loaded. Please try again.";
}

export function SibatReportsWorkspace({ reportingScope, isAllBarangays }: { reportingScope: string; isAllBarangays: boolean }) {
  const now = new Date();
  const [reportType, setReportType] = useState<ReportType>("inventory");
  const [dateFrom, setDateFrom] = useState(dateValue(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(today());
  const [species, setSpecies] = useState("");
  const [report, setReport] = useState<OfficialReport | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [error, setError] = useState("");
  const livestockTypesQuery = useQuery({
    queryKey: ["livestock-types"],
    queryFn: async () => (await api.get<{ id: number; name: string }[]>("livestock/livestock_types/")).data,
    staleTime: 5 * 60 * 1000,
  });

  const currentKey = JSON.stringify([reportType, dateFrom, dateTo, species, reportingScope]);
  const previewIsCurrent = Boolean(report && previewKey === currentKey);
  const filters: ReportFilters = { ...EMPTY_FILTERS, species };
  const livestockTypes = [...(livestockTypesQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    setPreviewKey("");
    try {
      // The backend derives the authorized barangay from the signed-in account.
      const data = await fetchOfficialReport(reportType, dateFrom, dateTo, filters);
      setReport(data);
      setPreviewKey(currentKey);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: "pdf" | "xlsx") => {
    if (!previewIsCurrent) return;
    setExporting(format);
    setError("");
    try {
      const response = await downloadOfficialReport(reportType, dateFrom, dateTo, filters, format);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${isAllBarangays ? "all_barangays" : "barangay"}_${reportType}_${dateFrom}_${dateTo}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setExporting(null);
    }
  };

  const summaryMetrics = report?.analysis.executive_summary ?? [];

  return <>
    <main className="mx-auto w-full max-w-screen-2xl space-y-5 px-3.5 py-4 pb-12 sm:px-6 lg:px-8 lg:py-6">
      <header className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800 sm:size-16"><FileText className="size-7 sm:size-8" /></span>
        <div className="min-w-0"><h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Reports</h1><p className="mt-0.5 text-sm text-slate-600">View and manage livestock reports in your assigned reporting area.</p></div>
      </header>

      <Card className="gap-0 overflow-hidden border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-50/40 py-0 shadow-none">
        <CardContent className="flex items-center gap-3 p-3 sm:p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800"><MapPin className="size-6" /></span>
          <div className="min-w-0"><p className="text-sm font-bold text-slate-800">Reporting area: <span className="text-emerald-800">{reportingScope || "Not assigned"}</span></p><p className="mt-0.5 text-xs text-slate-600">{isAllBarangays ? "Your account can view reports across all barangays." : `You can view reports for ${reportingScope || "your assigned barangay"} only. Data is restricted to your assigned barangay.`}</p></div>
        </CardContent>
      </Card>

      <section aria-labelledby="report-type-heading" className="space-y-3">
        <div><h2 id="report-type-heading" className="text-lg font-black text-slate-950">Choose a Report Type</h2><p className="text-sm text-slate-600">Select a category to build and export a report.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {REPORT_OPTIONS.map((option) => {
            const Icon = REPORT_ICONS[option.value as keyof typeof REPORT_ICONS];
            const selected = reportType === option.value;
            return <button key={option.value} type="button" aria-pressed={selected} onClick={() => setReportType(option.value)} className={`flex min-h-28 items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${selected ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"}`}>
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800"><Icon className="size-6" /></span>
              <span className="min-w-0"><span className="block font-extrabold text-slate-900">{option.label}</span><span className="mt-1 block text-sm leading-relaxed text-slate-600">{REPORT_DESCRIPTIONS[option.value]}</span></span>
            </button>;
          })}
        </div>
      </section>

      <Card aria-labelledby="barangay-report-form-title" className="gap-0 py-0 shadow-sm">
        <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
          <CardTitle id="barangay-report-form-title" className="text-lg font-black text-slate-950">Set Report Filters</CardTitle>
          <CardDescription>Choose a reporting period and optional livestock type.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
        <form onSubmit={generate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0 space-y-2"><Label htmlFor="report-date-from">From</Label><Input id="report-date-from" required type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} className="h-11 min-w-0 rounded-xl" /></div>
            <div className="min-w-0 space-y-2"><Label htmlFor="report-date-to">To</Label><Input id="report-date-to" required type="date" value={dateTo} min={dateFrom} max={today()} onChange={(event) => setDateTo(event.target.value)} className="h-11 min-w-0 rounded-xl" /></div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="report-livestock-type">Livestock type <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Select value={species || "ALL"} onValueChange={(value) => setSpecies(value === "ALL" ? "" : value)} disabled={livestockTypesQuery.isPending || livestockTypesQuery.isError}>
                <SelectTrigger id="report-livestock-type" className="h-11 w-full rounded-xl"><SelectValue placeholder="All livestock types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All livestock types</SelectItem>
                  {livestockTypes.map((type) => <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {livestockTypesQuery.isError && <p role="alert" className="text-xs text-rose-700">Could not load livestock types. Refresh the page and try again.</p>}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="size-4" />{dateFrom ? formatDate(dateFrom) : "Choose start date"} – {dateTo ? formatDate(dateTo) : "Choose end date"}</p>
            <Button type="submit" disabled={loading || !reportingScope || !dateFrom || !dateTo || dateFrom > dateTo} className="min-h-11 w-full gap-2 bg-emerald-800 text-white hover:bg-emerald-900 sm:w-auto">
              {loading ? <><RefreshCw className="size-4 animate-spin" />Preparing report…</> : <><FileText className="size-4" />Generate report</>}
            </Button>
          </div>
        </form>
        {!reportingScope && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This account has no reporting scope. Ask MAO/Admin to assign its barangay access before generating reports.</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        </CardContent>
      </Card>

      {previewIsCurrent && report ? <section className="space-y-4" aria-labelledby="barangay-report-result-title">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{isAllBarangays ? "All-barangay report" : "Assigned barangay report"}</p>
            <h2 id="barangay-report-result-title" className="text-xl font-black text-slate-950">{REPORT_OPTIONS.find((option) => option.value === reportType)?.label}</h2>
            <p className="mt-1 text-sm text-slate-600">{reportingScope} · {formatDate(report.period.date_from)} – {formatDate(report.period.date_to)}</p>
            <p className="mt-1 text-xs text-slate-500">{report.record_count} approved records · Generated {new Date(report.generated_at).toLocaleString()}</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
            <Button type="button" variant="outline" disabled={Boolean(exporting)} onClick={() => void exportReport("xlsx")} className="min-h-11 w-full gap-2 whitespace-normal sm:w-auto">{exporting === "xlsx" ? <RefreshCw className="size-4 shrink-0 animate-spin" /> : <FileSpreadsheet className="size-4 shrink-0" />}{exporting === "xlsx" ? "Preparing Excel…" : "Download Excel"}</Button>
            <Button type="button" disabled={Boolean(exporting)} onClick={() => void exportReport("pdf")} className="min-h-11 w-full gap-2 whitespace-normal bg-emerald-800 text-white hover:bg-emerald-900 sm:w-auto">{exporting === "pdf" ? <RefreshCw className="size-4 shrink-0 animate-spin" /> : <Download className="size-4 shrink-0" />}{exporting === "pdf" ? "Preparing PDF…" : "Download PDF"}</Button>
          </div>
        </div>

        {summaryMetrics.length > 0 && <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">{summaryMetrics.slice(0, 4).map((metric) => <Card key={metric.label} className="gap-2 py-0"><CardContent className="p-4"><p className="text-xs font-semibold text-muted-foreground">{metric.label}</p><p className="mt-1 break-words text-2xl font-black tabular-nums text-slate-950">{metric.value}</p>{metric.detail && <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>}</CardContent></Card>)}</div>}

        <ReportCharts report={report} reportType={reportType} />

        <Card className="gap-0 overflow-hidden py-0 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5"><h3 className="min-w-0 break-words font-bold text-slate-900">Records for {reportingScope}</h3><Badge variant="outline" className="shrink-0">Approved records</Badge></div>
          {report.rows.length === 0 ? <div className="p-6 text-center sm:p-8"><p className="font-bold text-slate-800">No approved records found {isAllBarangays ? "across all barangays" : "in this barangay"} for this period.</p><p className="mt-1 text-sm text-muted-foreground">Choose a wider date range or another record category.</p></div> : <>
            <div className="space-y-3 p-3 md:hidden">{report.rows.map((row, index) => <article key={`${index}-${String(row.control_number ?? row.tag_id ?? row.record_date ?? "record")}`} className="rounded-xl border bg-card p-3 shadow-xs"><dl className="grid grid-cols-1 gap-x-3 gap-y-2 min-[420px]:grid-cols-2">{report.columns.map((column) => <div key={column.key} className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{column.label}</dt><dd className="mt-0.5 break-words text-sm font-medium text-foreground">{row[column.key] == null || row[column.key] === "" ? "—" : String(row[column.key])}</dd></div>)}</dl></article>)}</div>
            <div className="hidden max-h-[34rem] overflow-auto md:block"><Table className="min-w-max"><TableHeader className="sticky top-0 z-10 bg-muted"><TableRow>{report.columns.map((column) => <TableHead key={column.key} className="px-3 py-3 text-xs font-bold uppercase tracking-wide">{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{report.rows.map((row, index) => <TableRow key={`${index}-${String(row.control_number ?? row.tag_id ?? row.record_date ?? "record")}`} className="odd:bg-background even:bg-muted/40">{report.columns.map((column) => <TableCell key={column.key} className="max-w-72 whitespace-normal px-3 py-2.5 align-top">{row[column.key] == null || row[column.key] === "" ? "—" : String(row[column.key])}</TableCell>)}</TableRow>)}</TableBody></Table></div>
          </>}
        </Card>
        <p className="text-xs text-slate-500">This report contains approved records only. Your reporting scope is enforced by the report service using your signed-in account.</p>
      </section> : !loading && <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center sm:p-10"><FileText className="mx-auto size-8 text-slate-400" /><h2 className="mt-3 font-bold text-slate-900">Your report will appear here</h2><p className="mt-1 text-sm text-slate-600">Select a record category and dates to review approved activity in {isAllBarangays ? "all barangays" : "your assigned area"}.</p></section>}
    </main>
  </>;
}
