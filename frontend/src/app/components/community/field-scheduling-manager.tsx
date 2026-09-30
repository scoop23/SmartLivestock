"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Clock3, LockKeyhole, MapPin, Pencil, Plus, RefreshCw, Trash2, UnlockKeyhole, Users } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KpiCard } from "@/components/ui/kpi-card";
import api from "@/lib/axios";
import { apiError, getBookings, getSchedules, type ProgramBooking, type ProgramSchedule } from "@/lib/community-api";
import { PROGRAM_TIME_SLOTS, CommunityEmptyState, CommunityErrorCard, CommunitySkeleton, formatLongDate, formatTime, todayIso, type CommunityRole } from "./community-ui";

type ManagerRole = Extract<CommunityRole, "admin" | "sibat">;
type ScheduleAction = "close" | "reopen" | "delete";
type PendingAction = { schedule: ProgramSchedule; action: ScheduleAction };
type ScheduleForm = { date: string; program: string; location: string; capacity: string };
type SchedulePayload = { date: string; program: string; location: string; capacity: number };
const emptyForm: ScheduleForm = { date: "", program: "", location: "", capacity: "4" };

export function FieldSchedulingManager({ role }: { role: ManagerRole }) {
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [bookings, setBookings] = useState<ProgramBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramSchedule | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [selected, setSelected] = useState<ProgramSchedule | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [conflictPayload, setConflictPayload] = useState<SchedulePayload | null>(null);

  const load = useCallback(async () => {
    try {
      const [scheduleRows, bookingRows] = await Promise.all([getSchedules(), getBookings()]);
      setSchedules(scheduleRows);
      setBookings(bookingRows);
      setError("");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  useEffect(() => {
    // The asynchronous requests update state when they finish.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const bookingsBySchedule = useMemo(() => {
    const grouped = new Map<number, ProgramBooking[]>();
    for (const booking of bookings) {
      const rows = grouped.get(booking.schedule) ?? [];
      rows.push(booking);
      grouped.set(booking.schedule, rows);
    }
    return grouped;
  }, [bookings]);

  const confirmedCount = bookings.filter((booking) => booking.status === "CONFIRMED").length;
  const openCount = schedules.filter((schedule) => schedule.is_open).length;
  const uniqueFarmers = new Set(bookings.filter((booking) => booking.status === "CONFIRMED").map((booking) => booking.farmer_name)).size;

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function startEdit(schedule: ProgramSchedule) {
    setEditing(schedule);
    setForm({ date: schedule.date, program: schedule.program, location: schedule.location, capacity: String(schedule.capacity) });
    setFormOpen(true);
  }

async function persistSchedule(payload: SchedulePayload) {
    setBusy(true);
    setError("");
    const requestPayload: Partial<SchedulePayload> = { ...payload };
    // The API rejects edits that submit a historical date. Keep it fixed while allowing other details to change.
    if (editing && editing.date < todayIso() && payload.date === editing.date) delete requestPayload.date;
    try {
      if (editing) await api.patch(`/community/schedules/${editing.id}/`, requestPayload);
      else await api.post("/community/schedules/", requestPayload);
      setConflictPayload(null);
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const payload: SchedulePayload = { ...form, capacity: Number(form.capacity), program: form.program.trim(), location: form.location.trim() };
    if (!Number.isInteger(payload.capacity) || payload.capacity < 1 || payload.capacity > 10000) {
      setError("Capacity must be a whole number from 1 to 10,000.");
      return;
    }
    if (editing && payload.capacity < editing.booking_count) {
      setError(`Capacity cannot be lower than the ${editing.booking_count} confirmed bookings.`);
      return;
    }
    const normalizedLocation = payload.location.trim().toLocaleLowerCase();
    // Every schedule offers the same appointment windows, so matching date and venue means those windows overlap.
    const conflict = schedules.find((schedule) =>
      schedule.id !== editing?.id &&
      schedule.date === payload.date &&
      normalizedLocation !== "" &&
      schedule.location.trim().toLocaleLowerCase() === normalizedLocation
    );
    if (conflict) {
      setConflictPayload(payload);
      return;
    }
    void persistSchedule(payload);
  }

  async function performAction() {
    if (!pendingAction) return;
    const { schedule, action } = pendingAction;
    if (action === "delete" && (bookingsBySchedule.get(schedule.id)?.length ?? 0) > 0) return;
    setBusy(true);
    setError("");
    try {
      if (action === "delete") await api.delete(`/community/schedules/${schedule.id}/`);
      else await api.patch(`/community/schedules/${schedule.id}/`, { is_open: action === "reopen" });
      if (selected?.id === schedule.id && action === "delete") setSelected(null);
      setPendingAction(null);
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const selectedBookings = selected ? (bookingsBySchedule.get(selected.id) ?? []).slice().sort((a, b) => a.time.localeCompare(b.time)) : [];
  const selectedHasBookingHistory = pendingAction ? (bookingsBySchedule.get(pendingAction.schedule.id)?.length ?? 0) > 0 : false;
  const accent = role === "sibat" ? "bg-[#1A365D] hover:bg-[#152c4b]" : "bg-[#2D5A27] hover:bg-[#24461f]";
  const pageTitle = role === "sibat" ? "Field Scheduling" : "Farmer Schedules";

  return (
    <>
      <PageHeader
        title={pageTitle}
        subtitle="Create and manage municipal programs, review farmer bookings, and control registration."
        icon={<CalendarDays className="size-5 text-slate-800" />}
        variant={role}
        maxWidthClass="w-full"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-label="Refresh schedules"
              title="Refresh schedules"
              className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button type="button" onClick={startCreate} className={`h-9 gap-2 text-white ${accent}`}>
              <Plus /> <span className="hidden sm:inline">New program</span>
            </Button>
          </div>
        }
      />

      <main className="w-full space-y-4 p-3 sm:p-4 md:p-5">
        {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard title="Program dates" value={schedules.length} icon={<CalendarDays className="size-4" />} description="All scheduled" variant="emerald" size="sm" isLoading={loading} />
          <KpiCard title="Confirmed bookings" value={confirmedCount} icon={<Users className="size-4" />} description="Across all dates" variant="sky" size="sm" isLoading={loading} />
          <KpiCard title="Farmers involved" value={uniqueFarmers} icon={<Clock3 className="size-4" />} description={`${openCount} programs open`} variant="orange" size="sm" isLoading={loading} />
        </div>

        {loading ? <CommunitySkeleton cards={4} /> : error && schedules.length === 0 ? <CommunityErrorCard message={error} onRetry={() => void refresh()} /> : schedules.length === 0 ? (
          <Card><CardContent className="p-5"><CommunityEmptyState icon={<CalendarDays className="size-5" />} title="No program dates yet" description="Create a program date to make it available for farmer bookings." /></CardContent></Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {schedules.map((schedule) => {
              const roster = bookingsBySchedule.get(schedule.id) ?? [];
              const hasHistory = roster.length > 0;
              const status = schedule.registration_status;
              return (
                <Card key={schedule.id} className="gap-0 overflow-hidden border-slate-200 shadow-2xs">
                  <CardHeader className="gap-2 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-base font-bold tracking-tight text-slate-900">{schedule.program}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{formatLongDate(schedule.date)}</span>
                          {schedule.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{schedule.location}</span> : null}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={status === "AVAILABLE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "FULL" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-100 text-slate-600"}>
                        {status === "AVAILABLE" ? "Open" : status === "FULL" ? "Full" : status === "CLOSED" ? "Closed" : "Completed"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4 sm:px-5">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <span className="font-medium text-slate-600">Bookings</span>
                      <span className="font-semibold text-slate-900">Capacity {schedule.capacity}</span><span className="text-slate-600">Booked {schedule.booking_count}</span><span className="font-semibold text-slate-700">Remaining {schedule.remaining_slots}</span>
                    </div>
                    <Progress value={schedule.capacity ? Math.min(100, schedule.booking_count / schedule.capacity * 100) : 0} aria-label={`${schedule.booking_count} of ${schedule.capacity} slots booked`} className="h-2 bg-slate-100 [&>div]:bg-emerald-600" />
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PROGRAM_TIME_SLOTS.map((slot) => {
                        const slotBookings = schedule.booked_times.filter((bookedTime) => bookedTime === slot).length;
                        return <Badge key={slot} variant="outline" className={`h-8 justify-center rounded-md text-xs font-medium ${slotBookings > 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{formatTime(slot)}{slotBookings > 0 ? ` · ${slotBookings}` : ""}</Badge>;
                      })}
                    </div>
                    <Button type="button" variant="outline" className="w-full" onClick={() => setSelected(schedule)}>
                      <Users /> View bookings ({roster.length})
                    </Button>
                  </CardContent>
                  <CardFooter className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(schedule)}><Pencil /> Edit</Button>
                    <Button type="button" size="sm" variant={schedule.is_open ? "secondary" : "outline"} onClick={() => setPendingAction({ schedule, action: schedule.is_open ? "close" : "reopen" })}>
                      {schedule.is_open ? <><LockKeyhole /> Close program</> : <><UnlockKeyhole /> Reopen</>}
                    </Button>
                    <Button type="button" size="sm" variant="destructive" title={hasHistory ? "Programs with booking records are protected; close the program instead." : "Delete program"} onClick={() => setPendingAction({ schedule, action: "delete" })}>
                      <Trash2 /> Delete
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit program" : "Create a program"}</DialogTitle>
            <DialogDescription>Set a date and location. Farmers can choose one of the existing time slots.</DialogDescription>
          </DialogHeader>
          <form id="schedule-form" onSubmit={saveSchedule} className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium text-slate-700" htmlFor="schedule-date">Date
              <Input id="schedule-date" type="date" required value={form.date} min={editing && editing.date < todayIso() ? undefined : todayIso()} disabled={Boolean(editing && editing.date < todayIso())} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              {editing && editing.date < todayIso() ? <span className="block text-xs font-normal text-slate-500">Past program dates can’t be changed.</span> : null}
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700" htmlFor="schedule-program">Program name
              <Input id="schedule-program" required maxLength={100} value={form.program} onChange={(event) => setForm({ ...form, program: event.target.value })} placeholder="e.g. Livestock vaccination" />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700" htmlFor="schedule-capacity">Maximum slots
              <Input id="schedule-capacity" type="number" required min={1} max={10000} step={1} value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
              {editing ? <span className="block text-xs font-normal text-slate-500">At least {editing.booking_count} confirmed bookings must remain within capacity.</span> : null}
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700" htmlFor="schedule-location">Location <span className="font-normal text-slate-500">(optional)</span>
              <Input id="schedule-location" maxLength={200} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="e.g. Municipal Agriculture Office" />
            </label>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" form="schedule-form" disabled={busy} className={`text-white ${accent}`}>{busy ? "Saving…" : editing ? "Save changes" : "Create program"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {selected ? <>
            <DialogHeader>
              <DialogTitle>{selected.program}</DialogTitle>
              <DialogDescription className="flex flex-wrap gap-x-4 gap-y-1">
                <span>{formatLongDate(selected.date)}</span>
                {selected.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{selected.location}</span> : null}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Registered farmers</h3><Badge variant="secondary">{selectedBookings.length} booking{selectedBookings.length === 1 ? "" : "s"}</Badge></div>
              {selectedBookings.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">No bookings for this program.</p> : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <ul className="divide-y divide-slate-100">
                    {selectedBookings.map((booking) => <li key={booking.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{booking.farmer_name}</p><p className="text-xs text-slate-500">{booking.farmer_barangay || "Barangay not provided"}</p></div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600"><span>{formatLongDate(booking.date)}</span><span>{formatTime(booking.time)}</span><Badge variant="outline" className={booking.status === "CONFIRMED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-600"}>{booking.status === "CONFIRMED" ? "Confirmed" : "Cancelled"}</Badge></div>
                    </li>)}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row">
              <Button type="button" variant="outline" onClick={() => startEdit(selected)}><Pencil /> Edit program</Button>
              <Button type="button" variant="outline" onClick={() => setPendingAction({ schedule: selected, action: selected.is_open ? "close" : "reopen" })}>{selected.is_open ? "Close program" : "Reopen program"}</Button>
            </DialogFooter>
          </> : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={conflictPayload !== null} onOpenChange={(open) => { if (!open) setConflictPayload(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scheduling conflict</AlertDialogTitle>
            <AlertDialogDescription>
              {conflictPayload ? (() => {
                const location = schedules.find((schedule) => schedule.id !== editing?.id && schedule.date === conflictPayload.date && schedule.location.trim().toLocaleLowerCase() === conflictPayload.location.trim().toLocaleLowerCase());
                return location ? `“${location.program}” is already scheduled at this location on ${formatLongDate(location.date)}. The programs offer the same appointment times.` : "Another program may overlap at this date and location.";
              })() : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy || !conflictPayload} onClick={(event) => { event.preventDefault(); if (conflictPayload) void persistSchedule(conflictPayload); }}>Continue anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.action === "delete" ? "Delete program?" : pendingAction?.action === "close" ? "Close program?" : "Reopen program?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === "delete"
                ? selectedHasBookingHistory ? "This program has booking records. The system protects those records, so it can’t be deleted. Close the program to stop new bookings and retain its history." : "This permanently removes the program. It has no booking records." 
                : pendingAction?.action === "close" ? "Farmers will no longer be able to book this program. Existing bookings will be preserved." : "Farmers will be able to book this program again if it is in the future and has open slots."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy || (pendingAction?.action === "delete" && selectedHasBookingHistory)} onClick={(event) => { event.preventDefault(); void performAction(); }} className={pendingAction?.action === "delete" ? "bg-destructive text-white hover:bg-destructive/90" : ""}>
              {busy ? "Working…" : pendingAction?.action === "delete" ? "Delete program" : pendingAction?.action === "close" ? "Close program" : "Reopen program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}