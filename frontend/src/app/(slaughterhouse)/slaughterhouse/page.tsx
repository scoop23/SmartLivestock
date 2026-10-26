"use client";

import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import api from "@/lib/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Building,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  downloadBatchErrors,
  downloadTemplate,
  executeBatchImport,
  fetchBatches,
  validateImportFile,
  type DataImportBatchItem,
  type ImportSummary,
  type ValidationResult,
} from "../../(admin)/data-uploads/data-imports-api";
import {
  SlaughterDescriptiveAnalytics,
  type SlaughterRecordData,
} from "../components/slaughter-descriptive-analytics";
import { DailySlaughterhousePdfDialog } from "../components/daily-slaughterhouse-pdf-dialog";

type SlaughterRecord = SlaughterRecordData;
type LivestockType = { id: number; name: string };
const EMPTY_RECORDS: SlaughterRecord[] = [];

function exportRecords(records: SlaughterRecord[]) {
  const headers = ["record_date", "livestock_type", "heads", "kilograms", "condemned_heads", "condemned_kg", "condemnation_reason", "status"];
  const lines = records.map((row) => [
    row.record_date,
    row.livestock_type_name,
    row.quantity,
    row.carcass_weight ?? "",
    row.condemned_heads ?? 0,
    row.condemned_weight_kg ?? "",
    row.condemnation_reason ?? "",
    row.status,
  ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  const url = URL.createObjectURL(new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "slaughter-records.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SlaughterhousePage() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [recordDialog, setRecordDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    livestock_type: "",
    quantity: "",
    carcass_weight: "",
    record_date: new Date().toISOString().slice(0, 10),
    condemned_heads: "0",
    condemned_weight_kg: "",
    condemnation_reason: "",
    condemnation_type: "NONE",
  });

  // Live real-time clock updating every second
  const [clockString, setClockString] = useState<string>("");

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const updateTime = () => {
      setClockString(`${formatter.format(new Date())} PHT`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (typeFilter) params.set("livestock_type", typeFilter);
  const queryString = params.toString();

  const recordsQuery = useQuery({
    queryKey: ["slaughterhouse-records", startDate, endDate, typeFilter],
    queryFn: async () => (await api.get<SlaughterRecord[]>(`/production/slaughterhouse/records/${queryString ? `?${queryString}` : ""}`)).data,
  });
  const typesQuery = useQuery({
    queryKey: ["slaughterhouse-livestock-types"],
    queryFn: async () => (await api.get<LivestockType[]>("/production/slaughterhouse/livestock-types/")).data,
  });
  const batchesQuery = useQuery<DataImportBatchItem[]>({
    queryKey: ["slaughterhouse-batches"],
    queryFn: fetchBatches,
  });
  const records = recordsQuery.data ?? EMPTY_RECORDS;
  const filteredRecords = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return records;
    return records.filter((record) => [record.record_date, record.livestock_type_name, record.status, record.created_by_name, record.condemnation_reason ?? ""]
      .some((value) => value.toLocaleLowerCase().includes(term)));
  }, [records, search]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const approved = filteredRecords.filter((record) => record.status === "APPROVED");
  const totals = useMemo(() => {
    const heads = approved.reduce((sum, row) => sum + row.quantity, 0);
    const kilograms = approved.reduce((sum, row) => sum + Number(row.carcass_weight ?? 0), 0);
    const weighedHeads = approved.reduce((sum, row) => sum + (row.carcass_weight ? row.quantity : 0), 0);
    const condemnedHeads = approved.reduce((sum, row) => sum + (row.condemned_heads ?? 0), 0);
    return { heads, kilograms, average: weighedHeads > 0 ? kilograms / weighedHeads : null, hasWeight: weighedHeads > 0, condemnedHeads };
  }, [approved]);

  const currentPage = Math.min(page, pageCount);
  const displayedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["slaughterhouse-records"] }),
      queryClient.invalidateQueries({ queryKey: ["slaughterhouse-batches"] }),
    ]);
  };

  const closeRecordDialog = () => {
    setRecordDialog(false);
    setEditingId(null);
    setForm({
      livestock_type: "",
      quantity: "",
      carcass_weight: "",
      record_date: new Date().toISOString().slice(0, 10),
      condemned_heads: "0",
      condemned_weight_kg: "",
      condemnation_reason: "",
      condemnation_type: "NONE",
    });
  };

  const editRecord = (record: SlaughterRecord) => {
    setEditingId(record.id);
    setForm({
      livestock_type: String(record.livestock_type),
      quantity: String(record.quantity),
      carcass_weight: record.carcass_weight ?? "",
      record_date: record.record_date,
      condemned_heads: String(record.condemned_heads ?? 0),
      condemned_weight_kg: record.condemned_weight_kg ?? "",
      condemnation_reason: record.condemnation_reason ?? "",
      condemnation_type: record.condemnation_type ?? "NONE",
    });
    setRecordDialog(true);
  };

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        livestock_type: Number(form.livestock_type),
        quantity: Number(form.quantity),
        carcass_weight: form.carcass_weight ? form.carcass_weight : null,
        record_date: form.record_date,
        condemned_heads: Number(form.condemned_heads || 0),
        condemned_weight_kg: form.condemned_weight_kg ? form.condemned_weight_kg : "0.00",
        condemnation_reason: form.condemnation_reason.trim(),
        condemnation_type: form.condemnation_type,
      };
      if (editingId) await api.patch(`/production/slaughterhouse/records/${editingId}/`, payload);
      else await api.post("/production/slaughterhouse/records/", payload);
      toast.success(editingId ? "Slaughter record updated and returned to MAO review." : "Slaughter record submitted for MAO review.");
      closeRecordDialog();
      await refresh();
    } catch (error) {
      toast.error(apiError(error, "Could not save the slaughter record."));
    } finally {
      setSaving(false);
    }
  };

  const previewFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      setValidation(await validateImportFile("slaughter", selectedFile));
    } catch (error) {
      toast.error(apiError(error, "The file could not be validated."));
    } finally {
      setSaving(false);
    }
  };

  const importFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      setImportSummary(await executeBatchImport("slaughter", selectedFile, true, "PENDING"));
      toast.success("Rows imported as pending records for MAO review.");
      await refresh();
    } catch (error) {
      toast.error(apiError(error, "The file could not be imported."));
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = filteredRecords.filter((row) => row.status === "PENDING").length;
  const returnedCount = filteredRecords.filter((row) => row.status === "SUBJECT_TO_REVISION").length;

  return (
    <>
      <PageHeader
        title="Slaughterhouse Records & Diagnostics"
        subtitle="Daily livestock throughput, carcass yields, and meat inspection condemnation logs"
        variant="slaughterhouse"
        icon={<Scissors className="size-5" />}
        maxWidthClass="w-full"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              disabled={recordsQuery.isFetching}
              className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
              title="Refresh Slaughterhouse Records"
              aria-label="Refresh records"
            >
              <RefreshCw className={`size-5 ${recordsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {/* Abattoir active status banner */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-rose-900 text-white shadow-xs border-b border-rose-950/30">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/20 shrink-0">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-black">
                Municipal Abattoir Operations Active — Padre Garcia Slaughterhouse
              </p>
              <p className="text-[10px] text-rose-100 font-semibold">
                Daily carcass throughput, meat inspection findings, and dressing yield logs. Submissions stay pending until MAO inspection review.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPdfDialogOpen(true)}
              className="bg-rose-950/60 hover:bg-rose-950 text-white border border-rose-400/30 text-xs font-bold rounded-xl shadow-xs gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Monthly PDF Report
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setImportDialog(true);
                setValidation(null);
                setImportSummary(null);
              }}
              className="bg-rose-950/60 hover:bg-rose-950 text-white border border-rose-400/30 text-xs font-bold rounded-xl shadow-xs gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV/XLSX
            </Button>
            <Button
              size="sm"
              onClick={() => setRecordDialog(true)}
              className="bg-white hover:bg-rose-50 text-rose-900 text-xs font-black rounded-xl shadow-md gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Daily Record
            </Button>
          </div>
        </div>
      </div>

      {/* Upper Micro-Telemetry Banner with Live Realtime Clock */}
      <div className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 py-2 sm:px-6 md:px-8">
        <div className="w-full flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-slate-500">
          <div className="flex items-center gap-2 font-semibold text-slate-600">
            <Building className="size-3.5 text-rose-600" />
            <span>
              FACILITY:{" "}
              <strong className="font-mono text-slate-900 uppercase">
                PADRE GARCIA MUNICIPAL SLAUGHTERHOUSE
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700">
              <Clock className="size-3.5 text-slate-400" />
              <span className="tabular-nums font-bold">
                {clockString || "Loading Manila time…"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">

        {/* =================================================================== */}
        {/* FUTURISTIC DESCRIPTIVE ANALYTICS HUD (MATCHING AUCTION PATTERN)     */}
        {/* =================================================================== */}
        <SlaughterDescriptiveAnalytics
          records={records}
          isLoading={recordsQuery.isLoading}
          onRefresh={refresh}
        />

        {recordsQuery.isError ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-semibold text-slate-800">
                {apiError(recordsQuery.error, "Unable to load slaughter records.")}
              </p>
              <p className="mt-1 text-sm text-slate-500">Check your session and connection, then try again.</p>
              <Button className="mt-4" variant="outline" onClick={() => void recordsQuery.refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Operational KPI summary */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Approved heads"
            value={recordsQuery.isError ? "—" : totals.heads.toLocaleString()}
            description="Filtered approved abattoir intake"
            variant="rose"
            icon={<Scissors className="size-4" />}
            isLoading={recordsQuery.isLoading}
          />
          <KpiCard
            title="Recorded carcass mass"
            value={recordsQuery.isError || !totals.hasWeight ? "—" : `${totals.kilograms.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`}
            description="Approved dressed meat yield"
            variant="amber"
            icon={<Scale className="size-4" />}
            isLoading={recordsQuery.isLoading}
          />
          <KpiCard
            title="Average dressing yield"
            value={recordsQuery.isError || totals.average === null ? "—" : `${totals.average.toFixed(2)} kg/head`}
            description="Kilograms ÷ weighed carcasses"
            variant="sky"
            icon={<BarChart3 className="size-4" />}
            isLoading={recordsQuery.isLoading}
          />
          <KpiCard
            title="Awaiting MAO review"
            value={recordsQuery.isError ? "—" : pendingCount.toLocaleString()}
            description={returnedCount ? `${returnedCount} returned for revision` : "Your pending submissions"}
            variant="stone"
            icon={<CalendarDays className="size-4" />}
            isLoading={recordsQuery.isLoading}
          />
        </div>

        {/* =================================================================== */}
        {/* SLAUGHTER RECORD REGISTER                                           */}
        {/* =================================================================== */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs">
          <CardHeader className="pb-4 border-b border-slate-100">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="text-lg font-black tracking-tight text-slate-900">Slaughterhouse & Carcass Log Register</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Official municipal abattoir throughput, dressing weights, and post-mortem inspection findings.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPdfDialogOpen(true)}
                  className="rounded-xl border-rose-200 text-rose-900 hover:bg-rose-50 font-bold"
                >
                  <FileText className="mr-2 size-4 text-rose-700" />
                  Official Form
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportRecords(filteredRecords)}
                  disabled={!filteredRecords.length}
                  className="rounded-xl border-slate-200 font-bold hover:bg-slate-50"
                >
                  <Download className="mr-2 size-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="slaughter-start">From</Label>
                <Input
                  id="slaughter-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 rounded-xl border-slate-200 bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="slaughter-end">To</Label>
                <Input
                  id="slaughter-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-10 rounded-xl border-slate-200 bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="slaughter-type-filter">Livestock Type</Label>
                <Select
                  value={typeFilter || "all"}
                  onValueChange={(value) => {
                    setTypeFilter(value === "all" ? "" : value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="slaughter-type-filter" className="min-h-10 w-full rounded-xl border-slate-200 bg-white">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {(typesQuery.data ?? []).map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="slaughter-search">Search</Label>
                <Input
                  id="slaughter-search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Date, species, status, or condemnation..."
                  className="h-10 rounded-xl border-slate-200 bg-white"
                />
              </div>
            </div>

            {recordsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : filteredRecords.length ? (
              <>
                <div className="hidden overflow-x-auto rounded-xl border border-slate-200/90 bg-white md:block">
                  <Table className="min-w-[800px]">
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Livestock Type</TableHead>
                        <TableHead className="text-right">Heads</TableHead>
                        <TableHead className="text-right">Carcass Weight</TableHead>
                        <TableHead>Meat Condemnation Findings</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedRecords.map((row) => {
                        const hasCondemnation =
                          (row.condemned_heads ?? 0) > 0 ||
                          Boolean(row.condemnation_reason && row.condemnation_reason.trim());

                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.record_date}</TableCell>
                            <TableCell className="font-semibold text-slate-900">{row.livestock_type_name}</TableCell>
                            <TableCell className="text-right font-bold">{row.quantity}</TableCell>
                            <TableCell className="text-right">
                              {row.carcass_weight ? (
                                <span className="font-semibold text-amber-700">
                                  {Number(row.carcass_weight).toLocaleString()} kg
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Not recorded</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {hasCondemnation ? (
                                <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                                  <AlertTriangle className="size-3.5 shrink-0" />
                                  <span>
                                    {(row.condemned_heads ?? 0) > 0 ? `${row.condemned_heads} hd ` : ""}
                                    {row.condemnation_reason ? `(${row.condemnation_reason})` : "Condemned"}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-xs text-emerald-600">
                                  <ShieldCheck className="size-3.5" />
                                  <span>Clean pass</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={row.status} />
                            </TableCell>
                            <TableCell>
                              {row.can_edit ? (
                                <Button size="sm" variant="outline" onClick={() => editRecord(row)}>
                                  Edit
                                </Button>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="space-y-3 md:hidden">
                  {displayedRecords.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{row.livestock_type_name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{row.record_date}</p>
                        </div>
                        <StatusBadge status={row.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Heads</p>
                          <p className="font-medium">{row.quantity}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Carcass Weight</p>
                          <p className="font-medium">
                            {row.carcass_weight ? `${Number(row.carcass_weight).toLocaleString()} kg` : "Not recorded"}
                          </p>
                        </div>
                      </div>
                      {((row.condemned_heads ?? 0) > 0 || row.condemnation_reason) && (
                        <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-red-50 p-2 text-xs text-red-700">
                          <AlertTriangle className="size-3.5" />
                          <span>
                            Condemned: {(row.condemned_heads ?? 0) > 0 ? `${row.condemned_heads} hd ` : ""}
                            {row.condemnation_reason ? `(${row.condemnation_reason})` : ""}
                          </span>
                        </div>
                      )}
                      {row.status === "SUBJECT_TO_REVISION" && row.review_remarks ? (
                        <p className="mt-3 text-sm text-amber-800">MAO remarks: {row.review_remarks}</p>
                      ) : null}
                      {row.can_edit ? (
                        <Button className="mt-3 w-full" variant="outline" onClick={() => editRecord(row)}>
                          Edit and resubmit
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>

                {filteredRecords.length > pageSize ? (
                  <div className="flex items-center justify-between border-t pt-3">
                    <p className="text-xs text-muted-foreground">
                      Showing {(currentPage - 1) * pageSize + 1}–
                      {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={currentPage === 1}
                        onClick={() => setPage((value) => Math.max(1, value - 1))}
                      >
                        <ChevronLeft className="size-4" />
                        <span className="sr-only">Previous page</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={currentPage === pageCount}
                        onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                      >
                        <ChevronRight className="size-4" />
                        <span className="sr-only">Next page</span>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : !recordsQuery.isError ? (
              <div className="rounded-xl border border-dashed py-12 text-center">
                <FileSpreadsheet className="mx-auto size-8 text-slate-400" />
                <p className="mt-3 font-semibold">{search ? "No records match your search" : "No slaughter records found"}</p>
                <p className="mt-1 text-sm text-muted-foreground">Adjust the filters or add the first daily record.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Batch Uploads Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent import batches</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your uploads are retained as audit records; imported rows await MAO review.
            </p>
          </CardHeader>
          <CardContent>
            {batchesQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (batchesQuery.data ?? []).length ? (
              <div className="space-y-3">
                {(batchesQuery.data ?? []).slice(0, 5).map((batch) => (
                  <div
                    key={batch.id}
                    className="flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="break-all text-sm font-medium">{batch.file_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(batch.uploaded_at).toLocaleString()} · Created {batch.imported_rows} · Skipped{" "}
                        {batch.skipped_rows} · Rejected {batch.error_rows}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{batch.status_display}</Badge>
                      {batch.error_rows > 0 ? (
                        <Button size="sm" variant="outline" onClick={() => void downloadBatchErrors(batch.id)}>
                          Download errors
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No import batches yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* =================================================================== */}
      {/* RECORD ENTRY / EDIT DIALOG WITH CARCASS WEIGHT & CONDEMNATIONS      */}
      {/* =================================================================== */}
      <Dialog
        open={recordDialog}
        onOpenChange={(open) => {
          if (!open) closeRecordDialog();
          else setRecordDialog(true);
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit daily slaughter record" : "Add daily slaughter record"}
            </DialogTitle>
            <DialogDescription>
              Record throughput, dressed carcass weights, and post-mortem meat inspection condemnation findings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveRecord} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="record-date">Record date</Label>
              <Input
                id="record-date"
                type="date"
                value={form.record_date}
                onChange={(e) => setForm({ ...form, record_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="record-livestock-type">Livestock Type</Label>
              <Select
                value={form.livestock_type}
                onValueChange={(value) => setForm({ ...form, livestock_type: value })}
              >
                <SelectTrigger id="record-livestock-type" aria-required="true" className="min-h-10 w-full">
                  <SelectValue placeholder="Select livestock type" />
                </SelectTrigger>
                <SelectContent>
                  {(typesQuery.data ?? []).map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="record-heads">Heads Slaughtered</Label>
                <Input
                  id="record-heads"
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="e.g. 15"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="record-kilograms">Carcass Weight (kg)</Label>
                <Input
                  id="record-kilograms"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.carcass_weight}
                  onChange={(e) => setForm({ ...form, carcass_weight: e.target.value })}
                  placeholder="e.g. 3050.00"
                />
                <p className="text-[11px] text-muted-foreground">Total dressed meat yield</p>
              </div>
            </div>

            {/* Condemnation Logs Section */}
            <div className="rounded-xl border border-red-200/80 bg-red-50/50 p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-rose-900 font-semibold text-sm">
                <ShieldAlert className="size-4 text-red-600" />
                <span>Post-Mortem Meat Condemnation Findings</span>
              </div>
              <p className="text-xs text-rose-950/70">
                Record any carcasses or organs condemned during official municipal abattoir veterinary inspection.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="condemned-heads" className="text-xs">
                    Condemned Heads
                  </Label>
                  <Input
                    id="condemned-heads"
                    type="number"
                    min="0"
                    step="1"
                    value={form.condemned_heads}
                    onChange={(e) => setForm({ ...form, condemned_heads: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="condemned-weight" className="text-xs">
                    Condemned Weight (kg)
                  </Label>
                  <Input
                    id="condemned-weight"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.condemned_weight_kg}
                    onChange={(e) => setForm({ ...form, condemned_weight_kg: e.target.value })}
                    placeholder="e.g. 25.50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="condemnation-reason" className="text-xs">
                  Condemnation Reason / Pathology Finding
                </Label>
                <Input
                  id="condemnation-reason"
                  type="text"
                  value={form.condemnation_reason}
                  onChange={(e) => setForm({ ...form, condemnation_reason: e.target.value })}
                  placeholder="e.g. Liver Fluke (Fascioliasis), Pneumonia, Abscess, Emaciation"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="condemnation-type" className="text-xs">
                  Condemnation Classification
                </Label>
                <Select
                  value={form.condemnation_type}
                  onValueChange={(val) => setForm({ ...form, condemnation_type: val })}
                >
                  <SelectTrigger id="condemnation-type" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None / Full Pass</SelectItem>
                    <SelectItem value="PARTIAL">Partial (Organ / Visceral Condemnation)</SelectItem>
                    <SelectItem value="TOTAL">Total (Whole Carcass Condemnation)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeRecordDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !form.livestock_type}
                className="bg-rose-700 hover:bg-rose-800"
              >
                {saving ? "Saving…" : editingId ? "Save and resubmit" : "Submit record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* OFFICIAL MONTHLY REPORT PDF DIALOG                                  */}
      {/* =================================================================== */}
      <DailySlaughterhousePdfDialog
        open={pdfDialogOpen}
        onOpenChange={setPdfDialogOpen}
        records={records}
      />

      {/* CSV / Excel Import Dialog */}
      <Dialog
        open={importDialog}
        onOpenChange={(open) => {
          setImportDialog(open);
          if (!open) {
            setSelectedFile(null);
            setValidation(null);
            setImportSummary(null);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import slaughter records</DialogTitle>
            <DialogDescription>
              Use `livestock_type` as the canonical column. Compare the transcription with the handwritten source before
              submitting; imported rows remain pending until MAO review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button type="button" variant="outline" onClick={() => void downloadTemplate("slaughter", "csv")}>
                <Download className="mr-2 size-4" />
                Download CSV template
              </Button>
              <p className="self-center text-xs text-muted-foreground">
                Expected columns include date, livestock_type, heads, kilograms.
              </p>
            </div>
            <Input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] ?? null);
                setValidation(null);
                setImportSummary(null);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void previewFile()}
                disabled={!selectedFile || saving}
              >
                <Upload className="mr-2 size-4" />
                {saving ? "Checking…" : "Validate and preview"}
              </Button>
              {validation && validation.valid_count + validation.warning_count > 0 ? (
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void importFile()}
                  className="bg-rose-700 hover:bg-rose-800"
                >
                  Confirm import as pending
                </Button>
              ) : null}
            </div>
            {validation ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <b>{validation.valid_count}</b>
                    <span className="block text-xs text-muted-foreground">Valid</span>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <b>{validation.warning_count}</b>
                    <span className="block text-xs text-muted-foreground">Warnings</span>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-3">
                    <b>{validation.error_count}</b>
                    <span className="block text-xs text-muted-foreground">Errors</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {validation.total_rows} rows scanned. Review the preview; invalid rows will be rejected and exact duplicates skipped at import.
                </p>
                <div className="max-h-64 overflow-auto rounded-lg border">
                  <Table className="min-w-[540px] text-xs">
                    <TableHeader className="sticky top-0 bg-slate-50">
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Livestock Type</TableHead>
                        <TableHead>Heads</TableHead>
                        <TableHead>Kilograms</TableHead>
                        <TableHead>Validation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validation.preview_rows.map((row) => (
                        <TableRow key={row.row_number}>
                          <TableCell>{row.row_number}</TableCell>
                          <TableCell>{row.data.record_date ?? row.data.date ?? ""}</TableCell>
                          <TableCell>{row.data.livestock_type ?? row.data.species ?? ""}</TableCell>
                          <TableCell>{row.data.quantity ?? row.data.heads ?? ""}</TableCell>
                          <TableCell>{row.data.carcass_weight ?? row.data.kilograms ?? ""}</TableCell>
                          <TableCell>
                            {row.status}
                            {row.issues.length ? ` — ${row.issues.map((issue) => issue.message).join("; ")}` : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : null}
            {importSummary ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
                <p className="font-semibold text-emerald-900">Import batch #{importSummary.batch_id} created</p>
                <p className="mt-1 text-emerald-800">
                  Created: {importSummary.imported_rows} · Skipped: {importSummary.skipped_rows} · Rejected:{" "}
                  {importSummary.rejected_rows}. Records are pending MAO verification.
                </p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: SlaughterRecord["status"] }) {
  switch (status) {
    case "PENDING":
      return (
        <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px] uppercase tracking-wider">
          <Clock className="w-3 h-3 mr-1" /> Pending MAO Review
        </Badge>
      );
    case "VERIFIED":
      return (
        <Badge className="bg-blue-100 text-blue-900 border-blue-300 font-bold text-[10px] uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3 mr-1" /> SIBAT Verified
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold text-[10px] uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3 mr-1" /> Approved
        </Badge>
      );
    case "SUBJECT_TO_REVISION":
      return (
        <Badge className="bg-orange-100 text-orange-950 border-orange-400 font-bold text-[10px] uppercase tracking-wider">
          <AlertTriangle className="w-3 h-3 mr-1" /> Subject to Revision
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-wider">
          {String(status).replaceAll("_", " ")}
        </Badge>
      );
  }
}

function apiError(error: unknown, fallback: string) {
  const axiosError = error as { response?: { status?: number; data?: { detail?: string; error?: string } } };
  if (axiosError?.response?.status === 401) return "Your session expired. Please sign in again.";
  if (axiosError?.response?.status === 403) return "Your account is not authorized to access these slaughter records.";
  const responseData = axiosError?.response?.data;
  return responseData?.detail || responseData?.error || fallback;
}
