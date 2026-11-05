"use client";

import Link from "next/link";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { QrCodePass } from "@/components/qr-code-pass";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Registration = {
  id: number; reference: string; livestock: number; tag_number: string;
  farmer_id: number; farmer_name: string; intent: string;
  target_date: string | null; target_destination: string; notes: string;
  original_certificate_number: string; has_document: boolean;
  registration_status: string; review_notes: string; sale_transfer: number | null;
};
const labels: Record<string, string> = {
  SUBMITTED: "Awaiting document review", NEEDS_CORRECTION: "Needs correction",
  READY: "Ready for arrival", ARRIVED: "Arrival confirmed", CHECKED: "Physical checks completed", COMPLETED: "Sale approved",
};

export default function AuctionPreregistrations({ staff = false, onRecordSale, requestedRegistrationId }: {
  staff?: boolean;
  requestedRegistrationId?: string | null;
  onRecordSale?: (registration: Registration) => Promise<void>;
}) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Registration | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  async function viewDocument(row: Registration) {
    setPreview(null);
    setPreviewLoading(true);
    try {
      const response = await api.get<Blob>(`production/dispositions/${row.id}/document/`, { responseType: "blob" });
      setPreview({ url: URL.createObjectURL(response.data), type: response.data.type });
    } catch { toast.error("The document could not be opened. Try downloading it instead."); }
    finally { setPreviewLoading(false); }
  }
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ["auction-preregistration-list", debouncedSearch, statusFilter, plannedDate, page, pageSize],
    queryFn: async () => (await api.get<{ count: number; page: number; pages: number; results: Registration[] }>("production/dispositions/", {
      params: { paginated: "1", search: debouncedSearch, status: statusFilter || undefined, target_date: plannedDate || undefined, page, page_size: pageSize },
    })).data,
  });
  async function openRegistration(id: number) {
    setScannerOpen(false);
    setSelected(null);
    setOpeningId(id);
    try {
      const response = await api.get<Registration>(`production/dispositions/${id}/`);
      const registration = response.data;
      // A scan must find its row even when today's filters or pagination hide it.
      setStatusFilter("");
      setPlannedDate("");
      setPage(1);
      setSearch(registration.reference);
      setDebouncedSearch(registration.reference);
      setHighlightedId(registration.id);
      void client.fetchQuery({
        queryKey: ["auction-preregistration-list", registration.reference, "", "", 1, pageSize],
        queryFn: async () => (await api.get<{ count: number; page: number; pages: number; results: Registration[] }>("production/dispositions/", {
          params: { paginated: "1", search: registration.reference, page: 1, page_size: pageSize },
        })).data,
      }).catch(() => toast.error("The review opened, but its list row could not be refreshed."));
      setPreview(null);
      setSelected(registration);
    } catch { toast.error("Preregistration not found or unavailable to this account."); }
    finally { setOpeningId(null); }
  }
  useEffect(() => {
    if (!staff) return;
    const id = requestedRegistrationId || new URLSearchParams(window.location.search).get("registration");
    if (!id || !/^\d+$/.test(id)) return;
    let cancelled = false;
    void api.get<Registration>(`production/dispositions/${id}/`).then(response => {
      if (!cancelled) {
        setSearch(response.data.reference);
        setDebouncedSearch(response.data.reference);
        setHighlightedId(response.data.id);
        setSelected(response.data);
      }
    }).catch(() => {
      if (!cancelled) toast.error("Preregistration not found or unavailable to this account.");
    });
    return () => { cancelled = true; };
  }, [staff, requestedRegistrationId]);
  const errorMessage = (error: unknown) => {
    const body: unknown = axios.isAxiosError(error) ? error.response?.data : null;
    return body && typeof body === "object" ? Object.values(body).flat().filter(value => typeof value === "string").join(" ") : "Please try again.";
  };
  async function update(row: Registration, form: HTMLFormElement, status?: string) {
    if (busy !== null) return;
    setBusy(row.id);
    try {
      const payload = new FormData(form);
      const file = payload.get("supporting_document");
      if (file instanceof File && !file.size) payload.delete("supporting_document");
      if (status) payload.set("registration_status", status);
      const response = await api.patch<Registration>(`production/dispositions/${row.id}/`, payload);
      setSelected(response.data);
      await Promise.all([client.invalidateQueries({ queryKey: ["animal_dispositions"] }), client.invalidateQueries({ queryKey: ["auction-preregistration-list"] })]);
      toast.success("Preregistration updated.");
    } catch (error) {
      toast.error("Could not update preregistration.", { description: errorMessage(error) });
    } finally { setBusy(null); }
  }
  async function download(row: Registration, kind: "document" | "certificate") {
    try {
      const response = await api.get(`production/dispositions/${row.id}/${kind}/`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      const type = response.data.type;
      link.download = `${row.reference}-${kind}.${kind === "certificate" || type.includes("pdf") ? "pdf" : type.includes("png") ? "png" : "jpg"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error("The document could not be downloaded."); }
  }
  const rows = data?.results || [];
  return <section className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5">
    <div><h2 className="font-bold text-slate-900">Auction preregistrations</h2>
      <p className="mt-1 text-sm text-slate-600">{staff ? "Review advance paperwork, request corrections, then confirm the animal's arrival. Physical inspections remain a separate step." : "Show your AP reference at the market. Ready for arrival means the advance paperwork was reviewed; the animal still needs any required physical checks."}</p></div>
    {staff && <Button variant="outline" onClick={() => setScannerOpen(true)}>Scan preregistration QR</Button>}
    {highlightedId !== null && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
      <span>Scanned preregistration found. Its row is highlighted below.</span>
      <Button size="sm" variant="ghost" onClick={() => { setHighlightedId(null); setSearch(""); setDebouncedSearch(""); setPage(1); }}>Show all preregistrations</Button>
    </div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="space-y-1 text-xs font-medium text-slate-600">Search<Input aria-label="Find a preregistration" placeholder="AP reference, animal tag, or farmer" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label className="space-y-1 text-xs font-medium text-slate-600">Status<select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="space-y-1 text-xs font-medium text-slate-600">Planned arrival date<Input type="date" value={plannedDate} onChange={event => { setPlannedDate(event.target.value); setPage(1); }} /></label>
      <label className="space-y-1 text-xs font-medium text-slate-600">Rows per page<select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
    </div>
    {isPending && <p role="status" className="text-sm">Loading preregistrations...</p>}
    {isError && <p role="alert" className="text-sm text-rose-700">Preregistrations could not be loaded.</p>}
    {!isPending && !isError && <>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Reference", "Farmer", "Animal", "Planned date", "Status", "Document", ""].map((heading, index) => <th key={index} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.id} aria-selected={highlightedId === row.id} className={highlightedId === row.id ? "border-t border-emerald-300 bg-emerald-100 ring-2 ring-inset ring-emerald-500" : "border-t border-slate-100 hover:bg-emerald-50/40"}>
            <th scope="row" className="whitespace-nowrap px-4 py-3 font-mono text-xs text-emerald-800">{row.reference}</th>
            <td className="px-4 py-3">{row.farmer_name}</td><td className="whitespace-nowrap px-4 py-3 text-xs">{row.tag_number}</td>
            <td className="whitespace-nowrap px-4 py-3">{row.target_date || "Not specified"}</td>
            <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900">{labels[row.registration_status] || row.registration_status}</span></td>
            <td className="px-4 py-3 text-xs text-slate-500">{row.has_document ? "Attached" : "None"}</td>
            <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => { setPreview(null); setSelected(row); }}>{staff ? "Review" : "View"}</Button></td>
          </tr>)}{!rows.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No matching sale preregistrations.</td></tr>}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <span>{data?.count ? `Showing ${(data.page - 1) * pageSize + 1}?${Math.min(data.page * pageSize, data.count)} of ${data.count}` : "0 preregistrations"}</span>
        <div className="flex items-center gap-3"><Button size="sm" variant="outline" disabled={isFetching || (data?.page || 1) <= 1} onClick={() => setPage((data?.page || 1) - 1)}>Previous</Button><span>Page {data?.page || 1} of {data?.pages || 1}</span><Button size="sm" variant="outline" disabled={isFetching || (data?.page || 1) >= (data?.pages || 1)} onClick={() => setPage((data?.page || 1) + 1)}>Next</Button></div>
      </div>
    </>}
    <Dialog open={selected !== null || openingId !== null} onOpenChange={open => { if (!open && busy === null && openingId === null) { setSelected(null); setPreview(null); } }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] min-w-0 flex-col gap-0 overflow-y-auto overflow-x-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-2xl sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-emerald-100 bg-emerald-50 px-5 py-5 pr-12 sm:px-7">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-700">Auction preregistration</p>
          <DialogTitle className="text-xl font-bold text-slate-900">{selected?.reference || `AP-${String(openingId || "").padStart(6, "0")}`}</DialogTitle>
          <DialogDescription className="text-sm text-slate-600">Check the farmer details, supporting paperwork, and next step.</DialogDescription>
        </DialogHeader>
        {!selected && openingId !== null && <div role="status" className="p-10 text-center text-sm text-emerald-800">Opening preregistration for review...</div>}
      {(selected ? [selected] : []).map(row => <article key={row.id} className="min-w-0 space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">{labels[row.registration_status] || row.registration_status}</span><span className="text-xs text-slate-500">Advance paperwork and arrival review</span></div>
        <ol className="flex flex-wrap gap-2" aria-label="Preregistration progress">{["SUBMITTED", "READY", "ARRIVED", "CHECKED", "COMPLETED"].map((step, index) => {
          const current = ["SUBMITTED", "READY", "ARRIVED", "CHECKED", "COMPLETED"].indexOf(row.registration_status);
          return <li key={step} aria-current={step === row.registration_status ? "step" : undefined} className={`rounded-lg px-3 py-2 text-xs ${index <= current ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}. {({ SUBMITTED: "Submitted", READY: "Ready", ARRIVED: "Arrived", CHECKED: "Checked", COMPLETED: "Sale approved" } as Record<string, string>)[step]}</li>;
        })}</ol>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <section className="space-y-3 rounded-xl border border-slate-200 p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Farmer and animal</h3><dl className="space-y-3 text-sm"><div><dt className="text-xs text-slate-500">Farmer</dt><dd className="mt-1 break-words font-semibold text-slate-900">{row.farmer_name || "Not recorded"}</dd></div><div><dt className="text-xs text-slate-500">Animal tag</dt><dd className="mt-1 break-words font-mono font-semibold text-emerald-800">{row.tag_number}</dd></div></dl></section>
          <section className="space-y-3 rounded-xl border border-slate-200 p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Visit and paperwork</h3><dl className="grid gap-3 text-sm"><div><dt className="text-xs text-slate-500">Planned arrival</dt><dd className="mt-1 font-semibold text-slate-900">{row.target_date || "Not specified"}</dd></div><div><dt className="text-xs text-slate-500">Destination</dt><dd className="mt-1 break-words text-slate-900">{row.target_destination || "Not specified"}</dd></div><div><dt className="text-xs text-slate-500">Original certificate number</dt><dd className="mt-1 break-words font-mono text-slate-900">{row.original_certificate_number || "Not provided"}</dd></div></dl></section>
        </div>
        {!staff && <QrCodePass code={row.reference} qrPayload={row.reference} title="Auction preregistration" subtitle="Save this QR and show it to Auction staff to open your submission." ownerName={row.farmer_name} status={row.registration_status} compact />}
        {row.notes && <section className="rounded-xl bg-slate-50 p-4"><h3 className="mb-1 text-xs font-semibold text-slate-500">Farmer notes</h3><p className="whitespace-pre-wrap break-words text-sm text-slate-700">{row.notes}</p></section>}
        {row.review_notes && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Staff feedback: {row.review_notes}</p>}
        <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"><div><h3 className="text-sm font-bold text-slate-900">Supporting document</h3><p className="mt-1 text-xs text-slate-500">{row.has_document ? "View the submitted copy and compare it with the animal details." : "No supporting document was uploaded."}</p></div><div className="flex flex-wrap gap-2">
          {row.has_document && <>
            <Button size="sm" variant="outline" disabled={previewLoading} onClick={() => void viewDocument(row)}>{previewLoading ? "Opening..." : "View document"}</Button>
            <Button size="sm" variant="outline" onClick={() => void download(row, "document")}>Download document</Button>
          </>}
          {row.sale_transfer && <Button size="sm" variant="outline" onClick={() => void download(row, "certificate")}>Download approved transfer PDF</Button>}

        </div></section>
        {preview && <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2"><h3 className="text-sm font-semibold">Submitted document</h3><Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Hide preview</Button></div>
          {preview.type.includes("pdf") ? <iframe title={`Supporting document for ${row.reference}`} src={preview.url} className="h-[60dvh] w-full bg-white" /> : (
            // Uploaded evidence is a private authenticated blob, not a public image URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.url} alt={`Supporting document for ${row.reference}`} className="mx-auto max-h-[60dvh] max-w-full object-contain p-3" />
          )}
          <p className="px-3 pb-3 text-xs text-slate-500">If your browser cannot preview the document, use Download document.</p>
        </div>}
        {staff && ["SUBMITTED", "READY", "ARRIVED"].includes(row.registration_status) && <form className="space-y-4" onSubmit={event => event.preventDefault()}>
          <label className="block space-y-2 text-sm font-semibold text-slate-800"><span>{row.registration_status === "ARRIVED" ? "Physical inspection findings" : "Review notes"}</span><textarea name="review_notes" rows={3} aria-label={`Review notes for ${row.reference}`} placeholder={row.registration_status === "ARRIVED" ? "Enter the inspection reference and physical checks completed." : "Explain any missing information or corrections needed."} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /><span className="block text-xs font-normal text-slate-500">{row.registration_status === "ARRIVED" ? "Required before confirming physical checks." : "Required when returning the submission for correction."}</span></label>
          {row.registration_status === "ARRIVED" && <Button asChild size="sm" variant="outline"><Link href="/auction-inspections/new">Open inspection form</Link></Button>}
          <DialogFooter className="sticky -bottom-5 z-10 gap-3 border-t border-slate-200 bg-white py-4 sm:-bottom-7 sm:justify-between">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => { setSelected(null); setPreview(null); }} className="h-auto min-h-11 rounded-xl px-5">Close</Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              {row.registration_status !== "ARRIVED" && <Button type="button" variant="outline" disabled={busy !== null} onClick={event => void update(row, event.currentTarget.form!, "NEEDS_CORRECTION")} className="h-auto min-h-11 whitespace-normal rounded-xl border-rose-200 px-5 text-rose-700 hover:bg-rose-50 hover:text-rose-800">Return for Correction</Button>}
              <Button type="button" disabled={busy !== null} onClick={event => void update(row, event.currentTarget.form!, row.registration_status === "SUBMITTED" ? "READY" : row.registration_status === "READY" ? "ARRIVED" : "CHECKED")} className="h-auto min-h-11 whitespace-normal rounded-xl bg-emerald-700 px-5 text-white hover:bg-emerald-800">{busy === row.id ? "Saving..." : row.registration_status === "SUBMITTED" ? "Mark Ready for Arrival" : row.registration_status === "READY" ? "Confirm Arrival" : "Confirm Physical Checks"}</Button>
            </div>
          </DialogFooter>
        </form>}
        {!staff && row.registration_status === "NEEDS_CORRECTION" && <form className="space-y-2" onSubmit={event => { event.preventDefault(); void update(row, event.currentTarget); }}>
          <label className="block text-xs font-medium">Planned date<Input type="date" name="target_date" defaultValue={row.target_date || ""} /></label>
          <label className="block text-xs font-medium">Destination<Input name="target_destination" defaultValue={row.target_destination} /></label>
          <label className="block text-xs font-medium">Original certificate number<Input name="original_certificate_number" defaultValue={row.original_certificate_number} /></label>
          <label className="block text-xs font-medium">Notes<Input name="notes" defaultValue={row.notes} maxLength={255} /></label>
          <label className="block text-xs font-medium">Replace supporting document (PDF, JPG, PNG; up to 5 MB)<Input type="file" name="supporting_document" accept=".pdf,.jpg,.jpeg,.png" /></label>
          <Button size="sm" type="submit" disabled={busy !== null}>{busy === row.id ? "Sending..." : "Resubmit for document review"}</Button>
        </form>}
        {(!staff || !["SUBMITTED", "READY", "ARRIVED"].includes(row.registration_status)) && <DialogFooter className="sticky -bottom-5 z-10 gap-3 border-t border-slate-200 bg-white py-4 sm:-bottom-7 sm:justify-between"><Button type="button" variant="outline" disabled={busy !== null} onClick={() => { setSelected(null); setPreview(null); }} className="min-h-11 rounded-xl px-5">Close</Button>{staff && row.registration_status === "CHECKED" && onRecordSale && <Button disabled={busy !== null} onClick={async () => { setBusy(row.id); try { await onRecordSale(row); } catch { toast.error("Could not open the sale form."); } finally { setBusy(null); } }} className="h-auto min-h-12 w-full gap-3 whitespace-normal rounded-xl border border-emerald-600 bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:ring-emerald-500 disabled:opacity-60 sm:w-auto">
            <FileCheck2 aria-hidden="true" className="size-5 shrink-0" />
            <span>{busy === row.id ? "Opening sale form..." : "Record Completed Sale"}</span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </Button>}</DialogFooter>}
      </article>)}
    </DialogContent>
    </Dialog>
    {staff && <UniversalQrScannerDialog isOpen={scannerOpen} onOpenChange={setScannerOpen} role="auction" onSelectPreregistration={id => void openRegistration(id)} />}
  </section>;
}
