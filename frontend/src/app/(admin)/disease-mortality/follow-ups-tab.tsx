"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertCircle, CalendarDays, CheckCircle2, ClipboardCheck, HeartPulse, RefreshCw, Search, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ValidationIncidentItem } from "../data-validation/validation-analytics";
import { ValidationPagination } from "../data-validation/components/validation-pagination";

interface FollowUpEvent { id: number; event_type: string; observed_on: string; notes: string; created_by_name: string; created_by_role: string }
interface CaseFollowUps { case_id: number; clinical_status: string; can_resolve: boolean; can_recover: boolean; events: FollowUpEvent[] }
interface FollowUpQueueItem extends CaseFollowUps { record: ValidationIncidentItem }

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const formatDate = (value: string) => new Date(value + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

export function FollowUpsTab({ records }: { records: ValidationIncidentItem[] }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [updatesOnly, setUpdatesOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const approved = useMemo(() => records.filter(record => record.type === "disease" && record.status === "APPROVED"), [records]);
  const { data = [], isLoading, isError, refetch, isFetching } = useQuery<FollowUpQueueItem[]>({
    queryKey: ["disease-follow-up-queue", approved.map(record => record.id)],
    queryFn: async () => Promise.all(approved.map(async record => {
      const id = String(record.id).replace(/^dis-/i, "");
      const response = await api.get<CaseFollowUps>("diseases/cases/" + id + "/follow-ups/");
      return { record, ...response.data };
    })),
  });

  const withUpdates = data.filter(item => item.events.some(event => event.event_type === "FARMER_UPDATE"));
  const unresolved = data.filter(item => !["RECOVERED", "CLOSED"].includes(item.clinical_status));
  const filtered = data.filter(item => {
    const text = (item.case_id + " " + item.record.farmerName + " " + (item.record.tagNumber || "") + " " + item.record.barangayName).toLowerCase();
    return (!updatesOnly || item.events.some(event => event.event_type === "FARMER_UPDATE")) && text.includes(search.trim().toLowerCase());
  });
  const selectedCase = data.find(item => item.case_id === selected) ?? null;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageItems = filtered.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const openOutcome = (caseId: number) => {
    setSelected(caseId); setNotes(""); setDate(today()); setError("");
  };
  const closeOutcome = () => {
    if (saving) return;
    setSelected(null); setNotes(""); setDate(today()); setError("");
  };

  const resolve = async (id: number, eventType: "RECOVERED" | "CLOSED") => {
    if (!notes.trim() || !date || saving) return;
    setSaving(true); setError("");
    try {
      await api.post("diseases/cases/" + id + "/follow-ups/", { event_type: eventType, observed_on: date, notes: notes.trim() });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["disease-case-follow-ups"] }),
        client.invalidateQueries({ queryKey: ["disease-follow-up-queue"] }),
        client.invalidateQueries({ queryKey: ["admin-incident-records"] }),
      ]);
      setSelected(null); setNotes(""); setDate(today());
    } catch {
      setError("Could not save the outcome. Check the date and findings, then refresh if another officer resolved the case.");
    } finally { setSaving(false); }
  };

  return <section className="space-y-5">
    <header className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-[#113b2a] via-[#18563b] to-[#24754e] p-5 text-white shadow-sm sm:p-7">
      <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100"><Activity className="size-3.5" /> Clinical monitoring</span>
          <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Disease follow-ups</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-emerald-50/85">Review farmer observations and record a field checked outcome for approved disease cases.</p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"><RefreshCw className={"mr-2 size-4 " + (isFetching ? "animate-spin" : "")} /> Refresh queue</Button>
      </div>
      <div className="relative mt-6 grid max-w-lg grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3.5"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/80">Approved cases</p><p className="mt-1 text-2xl font-black">{isLoading ? "—" : data.length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3.5"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/80">With farmer updates</p><p className="mt-1 text-2xl font-black">{isLoading ? "—" : withUpdates.length}</p></div>
      </div>
    </header>

    <div className="grid gap-3 sm:grid-cols-3">
      <Summary icon={<ClipboardCheck className="size-5" />} label="Awaiting outcome" count={isLoading ? "—" : unresolved.length} tone="sky" />
      <Summary icon={<HeartPulse className="size-5" />} label="Recovered" count={isLoading ? "—" : data.filter(item => item.clinical_status === "RECOVERED").length} tone="emerald" />
      <Summary icon={<CheckCircle2 className="size-5" />} label="Closed" count={isLoading ? "—" : data.filter(item => item.clinical_status === "CLOSED").length} tone="slate" />
    </div>

    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={event => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Search report, farmer, tag, barangay" className="pl-9" /></div>
      <button type="button" onClick={() => { setUpdatesOnly(value => !value); setCurrentPage(1); }} className={"inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold " + (updatesOnly ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}><UserRound className="size-4" /> Farmer updates <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{isLoading ? "—" : withUpdates.length}</span></button>
    </div>

    {isLoading && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3].map(item => <div key={item} className="h-[22rem] animate-pulse rounded-2xl border bg-white" />)}</div>}
    {isError && <div role="alert" className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span>Could not load follow-up records.</span><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>}
    {!isLoading && !isError && filtered.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Stethoscope className="size-7" /></span><h3 className="mt-4 text-base font-bold text-slate-900">{data.length ? "No matching follow-ups" : "No approved disease cases yet"}</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{data.length ? "Try a different search or clear the farmer updates filter." : "Approved disease cases will appear here for continued monitoring."}</p></div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {pageItems.map(item => {
        const isResolved = ["RECOVERED", "CLOSED"].includes(item.clinical_status);
        return <article key={item.case_id} className="flex h-[22rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs transition-shadow hover:shadow-sm">
          <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Stethoscope className="size-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-950">DIS-{item.case_id}</h3><span className={"rounded-full px-2.5 py-1 text-[10px] font-bold " + (isResolved ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>{item.clinical_status.replaceAll("_", " ")}</span></div><p className="mt-1 truncate text-sm font-semibold text-slate-800">{item.record.farmerName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{item.record.livestockType} · {item.record.tagNumber || "No tag recorded"} · {item.record.barangayName}</p></div></div><span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{item.events.length} {item.events.length === 1 ? "entry" : "entries"}</span></div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl bg-slate-50/60 p-2">
            {item.events.length === 0 ? <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 py-3 text-center"><p className="text-xs font-semibold text-slate-600">No farmer observations yet</p><p className="mt-1 text-[11px] text-slate-400">New updates will appear here.</p></div> : <div className="space-y-2">{item.events.map(event => {
              const farmerUpdate = event.event_type === "FARMER_UPDATE";
              return (
                <div key={event.id} className="flex gap-2">
                  <span className={"mt-0.5 grid size-7 shrink-0 place-items-center rounded-full " + (farmerUpdate ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                    {farmerUpdate ? <UserRound className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg border border-slate-100 bg-white p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={"text-[10px] font-black uppercase tracking-wide " + (farmerUpdate ? "text-amber-800" : "text-emerald-800")}>
                        {farmerUpdate ? "Farmer observation" : event.event_type.replaceAll("_", " ")}
                      </span>
                      <time className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
                        <CalendarDays className="size-3" />{formatDate(event.observed_on)}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-800">{event.notes}</p>
                    <p className="mt-1.5 text-[10px] text-slate-500">
                      {event.created_by_name}{event.created_by_role ? " / " + event.created_by_role : ""}
                    </p>
                  </div>
                </div>
              );
            })}</div>}
            </div>

            {item.can_resolve && !isResolved && <Button onClick={() => openOutcome(item.case_id)} className="w-full shrink-0 rounded-xl bg-[#1E4D2B] py-2.5 text-xs font-bold hover:bg-[#163b21]"><ClipboardCheck className="mr-2 size-4" /> Record field outcome</Button>}            {isResolved && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><CheckCircle2 className="size-4" />This case has an official outcome.</div>}
          </div>
        </article>;
      })}
    </div>
    {!isLoading && !isError && (
      <ValidationPagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={pageSize}
        pageSizeOptions={[6, 12, 24]}
        onPageChange={setCurrentPage}
        onPageSizeChange={size => { setPageSize(size); setCurrentPage(1); }}
      />
    )}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) closeOutcome(); }}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="size-5" /></span>
            <div>
              <DialogTitle className="text-slate-950">Record field outcome</DialogTitle>
              <DialogDescription className="mt-1">
                {selectedCase ? <>DIS-{selectedCase.case_id} · {selectedCase.record.farmerName} · {selectedCase.record.livestockType}. Add the assessment findings and choose the outcome.</> : "Loading disease case details..."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <label className="block space-y-1.5 text-xs font-bold text-slate-700">Assessment date<Input type="date" max={today()} value={date} onChange={event => setDate(event.target.value)} className="bg-white" /></label>
        <label className="block space-y-1.5 text-xs font-bold text-slate-700">Field findings<Textarea value={notes} maxLength={2000} onChange={event => setNotes(event.target.value)} placeholder="Describe the animal's condition and findings supporting this outcome." className="min-h-28 resize-y bg-white" /><span className="block text-right text-[10px] font-normal text-slate-400">{notes.length}/2000</span></label>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><AlertCircle className="mr-1.5 inline size-3.5" /><strong>Recovered</strong> confirms recovery. <strong>Closed</strong> ends follow-up without declaring recovery.</div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
        {selectedCase && !selectedCase.can_recover && <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-700">Recovery is unavailable for deceased livestock. You can close this case with findings; its disease and review history will remain available.</p>}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" disabled={saving} onClick={closeOutcome} className="rounded-xl">Cancel</Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button disabled={saving || !selectedCase?.can_recover || !date || !notes.trim()} onClick={() => selectedCase && resolve(selectedCase.case_id, "RECOVERED")} className="rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"><HeartPulse className="mr-2 size-4" />Mark recovered</Button>
            <Button variant="outline" disabled={saving || !selectedCase || !date || !notes.trim()} onClick={() => selectedCase && resolve(selectedCase.case_id, "CLOSED")} className="rounded-xl border-slate-300 font-bold"><CheckCircle2 className="mr-2 size-4" />Close case</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}

function Summary({ icon, label, count, tone }: { icon: React.ReactNode; label: string; count: number | string; tone: "sky" | "emerald" | "slate" }) {
  const colors = { sky: "border-sky-100 bg-sky-50 text-sky-700", emerald: "border-emerald-100 bg-emerald-50 text-emerald-700", slate: "border-slate-200 bg-slate-100 text-slate-700" };
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs"><span className={"grid size-10 place-items-center rounded-xl " + colors[tone]}>{icon}</span><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="text-xl font-black text-slate-900">{count}</p></div></div>;
}
