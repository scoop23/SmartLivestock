"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Plus, Scissors, Scale, Upload } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KpiCard } from "@/components/ui/kpi-card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { executeBatchImport, validateImportFile, downloadTemplate, downloadBatchErrors, fetchBatches, type DataImportBatchItem, type ImportSummary, type ValidationResult } from "../../(admin)/data-uploads/data-imports-api";

type SlaughterRecord = {
  id: number; livestock_type: number; livestock_type_name: string; quantity: number;
  carcass_weight: string | null; record_date: string; barangay: number | null;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";
  review_remarks: string; created_by_name: string; can_edit: boolean;
};
type LivestockType = { id: number; name: string };
const EMPTY_RECORDS: SlaughterRecord[] = [];

function exportRecords(records: SlaughterRecord[]) {
  const headers = ["record_date", "livestock_type", "heads", "kilograms", "status"];
  const lines = records.map((row) => [row.record_date, row.livestock_type_name, row.quantity, row.carcass_weight ?? "", row.status]
    .map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  const url = URL.createObjectURL(new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "slaughter-records.csv"; anchor.click(); URL.revokeObjectURL(url);
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ livestock_type: "", quantity: "", carcass_weight: "", record_date: new Date().toISOString().slice(0, 10) });

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
    return records.filter((record) => [record.record_date, record.livestock_type_name, record.status, record.created_by_name]
      .some((value) => value.toLocaleLowerCase().includes(term)));
  }, [records, search]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const approved = filteredRecords.filter((record) => record.status === "APPROVED");
  const totals = useMemo(() => {
    const heads = approved.reduce((sum, row) => sum + row.quantity, 0);
    const kilograms = approved.reduce((sum, row) => sum + Number(row.carcass_weight ?? 0), 0);
    const weighedHeads = approved.reduce((sum, row) => sum + (row.carcass_weight ? row.quantity : 0), 0);
    return { heads, kilograms, average: weighedHeads > 0 ? kilograms / weighedHeads : null, hasWeight: weighedHeads > 0 };
  }, [approved]);
  const dailyVolume = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of approved) grouped.set(row.record_date, (grouped.get(row.record_date) ?? 0) + row.quantity);
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 7);
  }, [approved]);

  const currentPage = Math.min(page, pageCount);
  const displayedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["slaughterhouse-records"] }),
      queryClient.invalidateQueries({ queryKey: ["slaughterhouse-batches"] }),
    ]);
  };
  const closeRecordDialog = () => { setRecordDialog(false); setEditingId(null); setForm({ livestock_type: "", quantity: "", carcass_weight: "", record_date: new Date().toISOString().slice(0, 10) }); };
  const editRecord = (record: SlaughterRecord) => {
    setEditingId(record.id);
    setForm({ livestock_type: String(record.livestock_type), quantity: String(record.quantity), carcass_weight: record.carcass_weight ?? "", record_date: record.record_date });
    setRecordDialog(true);
  };
  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true);
    try {
      const payload = {
        livestock_type: Number(form.livestock_type), quantity: Number(form.quantity),
        carcass_weight: form.carcass_weight ? form.carcass_weight : null, record_date: form.record_date,
      };
      if (editingId) await api.patch(`/production/slaughterhouse/records/${editingId}/`, payload);
      else await api.post("/production/slaughterhouse/records/", payload);
      toast.success(editingId ? "Slaughter record updated and returned to MAO review." : "Slaughter record submitted for MAO review."); closeRecordDialog(); await refresh();
    } catch (error) { toast.error(apiError(error, "Could not save the slaughter record.")); }
    finally { setSaving(false); }
  };

  const previewFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try { setValidation(await validateImportFile("slaughter", selectedFile)); }
    catch (error) { toast.error(apiError(error, "The file could not be validated.")); }
    finally { setSaving(false); }
  };
  const importFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      setImportSummary(await executeBatchImport("slaughter", selectedFile, true, "PENDING"));
      toast.success("Rows imported as pending records for MAO review."); await refresh();
    } catch (error) { toast.error(apiError(error, "The file could not be imported.")); }
    finally { setSaving(false); }
  };

  const pendingCount = filteredRecords.filter((row) => row.status === "PENDING").length;
  const returnedCount = filteredRecords.filter((row) => row.status === "SUBJECT_TO_REVISION").length;

  return (
    <>
      <PageHeader title="Slaughterhouse Records" subtitle="Daily livestock throughput and recorded carcass kilograms" variant="slaughterhouse" icon={<Scissors className="size-5" />} />
      <div className="mx-auto w-full max-w-screen-2xl space-y-5 p-4 sm:p-6">
        <Card className="border-rose-100 bg-rose-50/70 shadow-sm"><CardContent className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
          <div><p className="font-semibold text-rose-950">Daily facility totals</p><p className="mt-1 text-sm text-rose-900/80">Submissions stay pending until MAO review. Aggregate records do not change farmer livestock inventory.</p></div>
          <div className="flex flex-col gap-2 min-[380px]:flex-row"><Button variant="outline" className="min-h-10 border-rose-200 bg-white" onClick={() => { setImportDialog(true); setValidation(null); setImportSummary(null); }}><Upload className="mr-2 size-4" />Import CSV/XLSX</Button><Button className="min-h-10 bg-rose-700 hover:bg-rose-800" onClick={() => setRecordDialog(true)}><Plus className="mr-2 size-4" />Add daily record</Button></div>
        </CardContent></Card>

        {recordsQuery.isError ? <Card><CardContent className="py-10 text-center"><p className="font-semibold text-slate-800">{apiError(recordsQuery.error, "Unable to load slaughter records.")}</p><p className="mt-1 text-sm text-slate-500">Check your session and connection, then try again.</p><Button className="mt-4" variant="outline" onClick={() => void recordsQuery.refetch()}>Retry</Button></CardContent></Card> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Approved heads" value={recordsQuery.isError ? "—" : totals.heads.toLocaleString()} description="Filtered approved records" variant="rose" icon={<Scissors className="size-4" />} isLoading={recordsQuery.isLoading} />
          <KpiCard title="Recorded carcass weight" value={recordsQuery.isError || !totals.hasWeight ? "—" : `${totals.kilograms.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`} description="Approved records with weight" variant="amber" icon={<Scale className="size-4" />} isLoading={recordsQuery.isLoading} />
          <KpiCard title="Average per head" value={recordsQuery.isError || totals.average === null ? "—" : `${totals.average.toFixed(2)} kg`} description="Recorded kg ÷ heads with recorded weight" variant="sky" icon={<BarChart3 className="size-4" />} isLoading={recordsQuery.isLoading} />
          <KpiCard title="Awaiting review" value={recordsQuery.isError ? "—" : pendingCount.toLocaleString()} description={returnedCount ? `${returnedCount} returned for revision` : "Your pending submissions"} variant="stone" icon={<CalendarDays className="size-4" />} isLoading={recordsQuery.isLoading} />
        </div>

        <Card><CardHeader className="pb-3"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><CardTitle>Slaughter record register</CardTitle><p className="mt-1 text-sm text-muted-foreground">Official totals include approved records only.</p></div><Button variant="outline" size="sm" onClick={() => exportRecords(filteredRecords)} disabled={!filteredRecords.length}><Download className="mr-2 size-4" />Export filtered CSV</Button></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1"><Label htmlFor="slaughter-start">From</Label><Input id="slaughter-start" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} /></div>
              <div className="space-y-1"><Label htmlFor="slaughter-end">To</Label><Input id="slaughter-end" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} /></div>
              <div className="space-y-1"><Label htmlFor="slaughter-type-filter">Livestock Type</Label><Select value={typeFilter || "all"} onValueChange={(value) => { setTypeFilter(value === "all" ? "" : value); setPage(1); }}><SelectTrigger id="slaughter-type-filter" className="min-h-10 w-full"><SelectValue placeholder="All types" /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{(typesQuery.data ?? []).map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label htmlFor="slaughter-search">Search</Label><Input id="slaughter-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Date, livestock type, or status" /></div>
            </div>

            <div className="rounded-xl border bg-white p-4"><div className="mb-3 flex items-center gap-2 font-semibold"><BarChart3 className="size-4 text-rose-700" />Daily slaughter volume <span className="text-xs font-normal text-muted-foreground">(latest 7 recorded dates in current filter)</span></div>
              {dailyVolume.length ? <div className="space-y-2">{dailyVolume.map(([day, heads]) => <div key={day} className="grid grid-cols-[5.5rem_minmax(2rem,1fr)_3rem] items-center gap-2 text-sm"><span className="text-muted-foreground">{day}</span><div className="h-2 overflow-hidden rounded-full bg-rose-100"><div className="h-full rounded-full bg-rose-600" style={{ width: `${Math.max(4, (heads / Math.max(...dailyVolume.map(([, value]) => value))) * 100)}%` }} /></div><span className="text-right font-medium">{heads}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No approved slaughter records for this period.</p>}
            </div>

            {recordsQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div> : filteredRecords.length ? <>
              <div className="hidden overflow-x-auto rounded-lg border md:block"><Table className="min-w-[740px]"><TableHeader className="bg-slate-50"><TableRow><TableHead>Date</TableHead><TableHead>Livestock Type</TableHead><TableHead className="text-right">Heads</TableHead><TableHead className="text-right">Kilograms</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{displayedRecords.map((row) => <TableRow key={row.id}><TableCell>{row.record_date}</TableCell><TableCell className="font-medium">{row.livestock_type_name}</TableCell><TableCell className="text-right">{row.quantity}</TableCell><TableCell className="text-right">{row.carcass_weight ? `${Number(row.carcass_weight).toLocaleString()} kg` : "Not recorded"}</TableCell><TableCell><StatusBadge status={row.status} /></TableCell><TableCell>{row.can_edit ? <Button size="sm" variant="outline" onClick={() => editRecord(row)}>Edit</Button> : "—"}</TableCell></TableRow>)}</TableBody></Table></div>
              <div className="space-y-3 md:hidden">{displayedRecords.map((row) => <div key={row.id} className="rounded-xl border bg-white p-4 shadow-xs"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{row.livestock_type_name}</p><p className="mt-1 text-sm text-muted-foreground">{row.record_date}</p></div><StatusBadge status={row.status} /></div><div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-sm"><div><p className="text-xs text-muted-foreground">Heads</p><p className="font-medium">{row.quantity}</p></div><div><p className="text-xs text-muted-foreground">Kilograms</p><p className="font-medium">{row.carcass_weight ? `${Number(row.carcass_weight).toLocaleString()} kg` : "Not recorded"}</p></div></div>{row.status === "SUBJECT_TO_REVISION" && row.review_remarks ? <p className="mt-3 text-sm text-amber-800">MAO remarks: {row.review_remarks}</p> : null}{row.can_edit ? <Button className="mt-3 w-full" variant="outline" onClick={() => editRecord(row)}>Edit and resubmit</Button> : null}</div>)}</div>
              {filteredRecords.length > pageSize ? <div className="flex items-center justify-between border-t pt-3"><p className="text-xs text-muted-foreground">Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="size-4" /><span className="sr-only">Previous page</span></Button><Button size="sm" variant="outline" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight className="size-4" /><span className="sr-only">Next page</span></Button></div></div> : null}
            </> : !recordsQuery.isError ? <div className="rounded-xl border border-dashed py-12 text-center"><FileSpreadsheet className="mx-auto size-8 text-slate-400" /><p className="mt-3 font-semibold">{search ? "No records match your search" : "No slaughter records found"}</p><p className="mt-1 text-sm text-muted-foreground">Adjust the filters or add the first daily record.</p></div> : null}
          </CardContent>
        </Card>

        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Recent import batches</CardTitle><p className="text-sm text-muted-foreground">Your uploads are retained as audit records; imported rows await MAO review.</p></CardHeader><CardContent>
          {batchesQuery.isLoading ? <Skeleton className="h-16 w-full" /> : (batchesQuery.data ?? []).length ? <div className="space-y-3">{(batchesQuery.data ?? []).slice(0, 5).map((batch) => <div key={batch.id} className="flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"><div className="min-w-0"><p className="break-all text-sm font-medium">{batch.file_name}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(batch.uploaded_at).toLocaleString()} · Created {batch.imported_rows} · Skipped {batch.skipped_rows} · Rejected {batch.error_rows}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{batch.status_display}</Badge>{batch.error_rows > 0 ? <Button size="sm" variant="outline" onClick={() => void downloadBatchErrors(batch.id)}>Download errors</Button> : null}</div></div>)}</div> : <p className="text-sm text-muted-foreground">No import batches yet.</p>}
        </CardContent></Card>
      </div>

      <Dialog open={recordDialog} onOpenChange={(open) => { if (!open) closeRecordDialog(); else setRecordDialog(true); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{editingId ? "Edit daily slaughter record" : "Add daily slaughter record"}</DialogTitle><DialogDescription>Records are submitted as pending and require MAO review.</DialogDescription></DialogHeader>
          <form onSubmit={saveRecord} className="space-y-4"><div className="space-y-1"><Label htmlFor="record-date">Record date</Label><Input id="record-date" type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} required /></div>
            <div className="space-y-1"><Label htmlFor="record-livestock-type">Livestock Type</Label><Select value={form.livestock_type} onValueChange={(value) => setForm({ ...form, livestock_type: value })}><SelectTrigger id="record-livestock-type" aria-required="true" className="min-h-10 w-full"><SelectValue placeholder="Select livestock type" /></SelectTrigger><SelectContent>{(typesQuery.data ?? []).map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="record-heads">Heads</Label><Input id="record-heads" type="number" min="1" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></div><div className="space-y-1"><Label htmlFor="record-kilograms">Kilograms (optional)</Label><Input id="record-kilograms" type="number" min="0.01" step="0.01" value={form.carcass_weight} onChange={(e) => setForm({ ...form, carcass_weight: e.target.value })} placeholder="e.g. 125.50" /></div></div>
            <DialogFooter><Button type="button" variant="outline" onClick={closeRecordDialog}>Cancel</Button><Button type="submit" disabled={saving || !form.livestock_type} className="bg-rose-700 hover:bg-rose-800">{saving ? "Saving…" : editingId ? "Save and resubmit" : "Submit record"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialog} onOpenChange={(open) => { setImportDialog(open); if (!open) { setSelectedFile(null); setValidation(null); setImportSummary(null); } }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Import slaughter records</DialogTitle><DialogDescription>Use `livestock_type` as the canonical column. Legacy `species` files remain accepted. Compare the transcription with the handwritten source before submitting; imported rows remain pending until MAO review.</DialogDescription></DialogHeader>
          <div className="space-y-4"><div className="flex flex-col gap-2 min-[400px]:flex-row"><Button type="button" variant="outline" onClick={() => void downloadTemplate("slaughter", "csv")}><Download className="mr-2 size-4" />Download CSV template</Button><p className="self-center text-xs text-muted-foreground">Expected columns include date, livestock_type, heads, kilograms. Barangay is optional.</p></div>
            <Input type="file" accept=".csv,.xlsx" onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setValidation(null); setImportSummary(null); }} />
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void previewFile()} disabled={!selectedFile || saving}><Upload className="mr-2 size-4" />{saving ? "Checking…" : "Validate and preview"}</Button>{validation && validation.valid_count + validation.warning_count > 0 ? <Button type="button" disabled={saving} onClick={() => void importFile()} className="bg-rose-700 hover:bg-rose-800">Confirm import as pending</Button> : null}</div>
            {validation ? <><div className="grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-lg bg-emerald-50 p-3"><b>{validation.valid_count}</b><span className="block text-xs text-muted-foreground">Valid</span></div><div className="rounded-lg bg-amber-50 p-3"><b>{validation.warning_count}</b><span className="block text-xs text-muted-foreground">Warnings</span></div><div className="rounded-lg bg-rose-50 p-3"><b>{validation.error_count}</b><span className="block text-xs text-muted-foreground">Errors</span></div></div><p className="text-xs text-muted-foreground">{validation.total_rows} rows scanned. Review the preview; invalid rows will be rejected and exact duplicates skipped at import.</p><div className="max-h-64 overflow-auto rounded-lg border"><Table className="min-w-[540px] text-xs"><TableHeader className="sticky top-0 bg-slate-50"><TableRow><TableHead>Row</TableHead><TableHead>Date</TableHead><TableHead>Livestock Type</TableHead><TableHead>Heads</TableHead><TableHead>Kilograms</TableHead><TableHead>Validation</TableHead></TableRow></TableHeader><TableBody>{validation.preview_rows.map((row) => <TableRow key={row.row_number}><TableCell>{row.row_number}</TableCell><TableCell>{row.data.record_date ?? row.data.date ?? ""}</TableCell><TableCell>{row.data.livestock_type ?? row.data.species ?? ""}</TableCell><TableCell>{row.data.quantity ?? row.data.heads ?? ""}</TableCell><TableCell>{row.data.carcass_weight ?? row.data.kilograms ?? ""}</TableCell><TableCell>{row.status}{row.issues.length ? ` — ${row.issues.map((issue) => issue.message).join("; ")}` : ""}</TableCell></TableRow>)}</TableBody></Table></div></> : null}
            {importSummary ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm"><p className="font-semibold text-emerald-900">Import batch #{importSummary.batch_id} created</p><p className="mt-1 text-emerald-800">Created: {importSummary.imported_rows} · Skipped: {importSummary.skipped_rows} · Rejected: {importSummary.rejected_rows}. Records are pending MAO verification.</p></div> : null}
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setImportDialog(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: SlaughterRecord["status"] }) {
  const styles: Record<SlaughterRecord["status"], string> = {
    PENDING: "border-amber-200 bg-amber-50 text-amber-900",
    VERIFIED: "border-blue-200 bg-blue-50 text-blue-900",
    APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-900",
    SUBJECT_TO_REVISION: "border-orange-200 bg-orange-50 text-orange-900",
  };
  return <Badge variant="outline" className={styles[status]}>{status.replaceAll("_", " ")}</Badge>;
}

function apiError(error: unknown, fallback: string) {
  const axiosError = error as { response?: { status?: number; data?: { detail?: string; error?: string } } };
  if (axiosError?.response?.status === 401) return "Your session expired. Please sign in again.";
  if (axiosError?.response?.status === 403) return "Your account is not authorized to access these slaughter records.";
  const responseData = axiosError?.response?.data;
  return responseData?.detail || responseData?.error || fallback;
}
