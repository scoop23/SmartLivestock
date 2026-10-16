"use client";

import { useState, type FormEvent } from "react";
import axios from "axios";
import { CalendarDays, Download, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportCharts } from "@/app/(admin)/reports/report-charts";
import { downloadOfficialReport, fetchOfficialReport, type OfficialReport, type ReportFilters, type ReportType } from "@/app/(admin)/reports/report-api";

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "inventory", label: "Livestock inventory" },
  { value: "production", label: "Production" },
  { value: "disease_mortality", label: "Disease and mortality" },
  { value: "slaughter", label: "Slaughter" },
  { value: "movement", label: "Auction and movement" },
  { value: "inspection", label: "Inspection and clearance" },
];

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const dateValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const formatDate = (value: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
const EMPTY_FILTERS: ReportFilters = { species: "", barangay: "", purpose: "", direction: "" };

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401 || error.response?.status === 403) return "You are not authorized to view this barangay report. Check that your SIBAT/CBAT account is assigned to a barangay.";
    if (error.response?.status === 400 || error.response?.status === 422) return "Check the selected report dates and try again.";
  }
  return "The barangay report could not be loaded. Please try again.";
}

export function SibatReportsWorkspace({ assignedBarangay }: { assignedBarangay: string }) {
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

  const currentKey = JSON.stringify([reportType, dateFrom, dateTo, species, assignedBarangay]);
  const previewIsCurrent = Boolean(report && previewKey === currentKey);
  const filters: ReportFilters = { ...EMPTY_FILTERS, species };

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
      link.download = `barangay_${reportType}_${dateFrom}_${dateTo}.${format}`;
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
    <PageHeader
      title="Barangay Reports"
      subtitle="Review approved livestock activity for your assigned barangay."
      icon={<FileText className="size-5 text-emerald-800" />}
      variant="sibat"
      maxWidthClass="w-full"
    />
    <main className="mx-auto w-full max-w-screen-2xl space-y-5 px-3.5 py-4 pb-12 sm:px-6 lg:px-8 lg:py-6">
      <Card className="gap-0 overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 to-white py-0 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Your reporting area</p>
          <h1 className="mt-1 break-words text-xl font-black text-slate-950">{assignedBarangay || "Barangay not assigned"}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Reports are limited to approved records associated with your assigned barangay. The area is set by your account.</p>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 border-emerald-200 bg-white text-emerald-900">Barangay-scoped</Badge>
        </CardContent>
      </Card>

      <Card aria-labelledby="barangay-report-form-title" className="gap-0 py-0 shadow-sm">
        <CardHeader className="px-4 pt-4 sm:px-5 sm:pt-5">
          <CardTitle id="barangay-report-form-title" className="text-lg font-black text-slate-950">Build a field report</CardTitle>
          <CardDescription>Choose the records and reporting period you need.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
        <form onSubmit={generate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="report-category">Record category</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                <SelectTrigger id="report-category" className="h-11 w-full rounded-xl"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>{REPORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2"><Label htmlFor="report-date-from">From</Label><Input id="report-date-from" required type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} className="h-11 min-w-0 rounded-xl" /></div>
            <div className="min-w-0 space-y-2"><Label htmlFor="report-date-to">To</Label><Input id="report-date-to" required type="date" value={dateTo} min={dateFrom} max={today()} onChange={(event) => setDateTo(event.target.value)} className="h-11 min-w-0 rounded-xl" /></div>
            <div className="min-w-0 space-y-2"><Label htmlFor="report-species">Species <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="report-species" value={species} onChange={(event) => setSpecies(event.target.value)} placeholder="All species" className="h-11 min-w-0 rounded-xl" /></div>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="size-4" />{dateFrom ? formatDate(dateFrom) : "Choose start date"} – {dateTo ? formatDate(dateTo) : "Choose end date"}</p>
            <Button type="submit" disabled={loading || !assignedBarangay || !dateFrom || !dateTo || dateFrom > dateTo} className="min-h-11 w-full gap-2 bg-emerald-800 text-white hover:bg-emerald-900 sm:w-auto">
              {loading ? <><RefreshCw className="size-4 animate-spin" />Preparing report…</> : <><FileText className="size-4" />Generate barangay report</>}
            </Button>
          </div>
        </form>
        {!assignedBarangay && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This account has no assigned barangay. Ask MAO/Admin to assign one before generating reports.</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        </CardContent>
      </Card>

      {previewIsCurrent && report ? <section className="space-y-4" aria-labelledby="barangay-report-result-title">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Assigned barangay report</p>
            <h2 id="barangay-report-result-title" className="text-xl font-black text-slate-950">{REPORT_OPTIONS.find((option) => option.value === reportType)?.label}</h2>
            <p className="mt-1 text-sm text-slate-600">{assignedBarangay} · {formatDate(report.period.date_from)} – {formatDate(report.period.date_to)}</p>
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5"><h3 className="min-w-0 break-words font-bold text-slate-900">Records for {assignedBarangay}</h3><Badge variant="outline" className="shrink-0">Approved records</Badge></div>
          {report.rows.length === 0 ? <div className="p-6 text-center sm:p-8"><p className="font-bold text-slate-800">No approved records found for this barangay and period.</p><p className="mt-1 text-sm text-muted-foreground">Choose a wider date range or another record category.</p></div> : <>
            <div className="space-y-3 p-3 md:hidden">{report.rows.map((row, index) => <article key={`${index}-${String(row.control_number ?? row.tag_id ?? row.record_date ?? "record")}`} className="rounded-xl border bg-card p-3 shadow-xs"><dl className="grid grid-cols-1 gap-x-3 gap-y-2 min-[420px]:grid-cols-2">{report.columns.map((column) => <div key={column.key} className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{column.label}</dt><dd className="mt-0.5 break-words text-sm font-medium text-foreground">{row[column.key] == null || row[column.key] === "" ? "—" : String(row[column.key])}</dd></div>)}</dl></article>)}</div>
            <div className="hidden max-h-[34rem] overflow-auto md:block"><Table className="min-w-max"><TableHeader className="sticky top-0 z-10 bg-muted"><TableRow>{report.columns.map((column) => <TableHead key={column.key} className="px-3 py-3 text-xs font-bold uppercase tracking-wide">{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{report.rows.map((row, index) => <TableRow key={`${index}-${String(row.control_number ?? row.tag_id ?? row.record_date ?? "record")}`} className="odd:bg-background even:bg-muted/40">{report.columns.map((column) => <TableCell key={column.key} className="max-w-72 whitespace-normal px-3 py-2.5 align-top">{row[column.key] == null || row[column.key] === "" ? "—" : String(row[column.key])}</TableCell>)}</TableRow>)}</TableBody></Table></div>
          </>}
        </Card>
        <p className="text-xs text-slate-500">This report contains approved records only. Barangay access is enforced by the report service using your signed-in account.</p>
      </section> : !loading && <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center sm:p-10"><FileText className="mx-auto size-8 text-slate-400" /><h2 className="mt-3 font-bold text-slate-900">Your barangay report will appear here</h2><p className="mt-1 text-sm text-slate-600">Select a record category and dates to review approved activity in your assigned area.</p></section>}
    </main>
  </>;
}
