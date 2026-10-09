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
      const [schedulesResult, bookingsResult] = await Promise.allSettled([
        getSchedules(),
        getBookings(),
      ]);

      if (schedulesResult.status === "fulfilled") {
        setSchedules(schedulesResult.value);
      }
      if (bookingsResult.status === "fulfilled") {
        setBookings(bookingsResult.value);
      }

      if (schedulesResult.status === "rejected" && bookingsResult.status === "rejected") {
        setError(apiError(schedulesResult.reason));
      } else if (schedulesResult.status === "rejected") {
        setError(apiError(schedulesResult.reason));
      } else if (bookingsResult.status === "rejected") {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[FieldSchedulingManager] Bookings load warning:", bookingsResult.reason);
        }
        setError("");
      } else {
        setError("");
      }
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
  const pageTitle = "Field Scheduling";

  return (
    <>
      <PageHeader
        title={pageTitle}
        subtitle="Manage livestock programs, activities, schedules, capacity, and farmer registrations."
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
              className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
            >
              <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              type="button"
              onClick={startCreate}
              className={`h-10 gap-2 rounded-xl px-4 text-xs sm:text-sm font-bold text-white shadow-xs ${accent}`}
            >
              <Plus className="size-4" />
              <span>Create Program</span>
            </Button>
          </div>
        }
      />

      <main className="w-full space-y-4 p-3 sm:p-4 md:p-5">
        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-red-800">
            {error}
          </p>
        ) : null}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          <KpiCard
            title="Program dates"
            value={schedules.length}
            icon={<CalendarDays className="size-4" />}
            description="All scheduled programs"
            variant="emerald"
            isLoading={loading}
          />
          <KpiCard
            title="Confirmed bookings"
            value={confirmedCount}
            icon={<Users className="size-4" />}
            description="Across all schedules"
            variant="sky"
            isLoading={loading}
          />
          <KpiCard
            title="Farmers involved"
            value={uniqueFarmers}
            icon={<Clock3 className="size-4" />}
            description={`${openCount} of ${schedules.length} open for booking`}
            variant="orange"
            isLoading={loading}
          />
        </div>

        {/* Schedule Grid */}
        {loading ? (
          <CommunitySkeleton cards={4} />
        ) : error && schedules.length === 0 ? (
          <CommunityErrorCard message={error} onRetry={() => void refresh()} />
        ) : schedules.length === 0 ? (
          <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <CardContent className="p-6">
              <CommunityEmptyState
                icon={<CalendarDays className="size-5" />}
                title="No scheduled programs yet"
                description="Create a program date to make appointment slots available for farmer registration."
                action={
                  <Button type="button" onClick={startCreate} className={`mt-2 h-10 px-4 text-xs sm:text-sm font-bold text-white rounded-xl ${accent}`}>
                    <Plus className="mr-1.5 size-4" /> Create Program
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {schedules.map((schedule) => {
              const roster = bookingsBySchedule.get(schedule.id) ?? [];
              const hasHistory = roster.length > 0;
              const status = schedule.registration_status;
              const statusConfig = {
                AVAILABLE: { label: "OPEN", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
                FULL: { label: "FULL", className: "border-amber-200 bg-amber-50 text-amber-900" },
                CLOSED: { label: "CLOSED", className: "border-slate-200 bg-slate-100 text-slate-700" },
                COMPLETED: { label: "COMPLETED", className: "border-slate-200 bg-slate-100 text-slate-600" },
              }[status] || { label: status, className: "border-slate-200 bg-slate-100 text-slate-700" };

              const bookedPercent = schedule.capacity
                ? Math.min(100, Math.round((schedule.booking_count / schedule.capacity) * 100))
                : 0;

              return (
                <Card
                  key={schedule.id}
                  className="flex min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all hover:border-slate-300 hover:shadow-sm"
                >
                  <CardHeader className="gap-2 p-4 sm:p-4.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="truncate text-base sm:text-lg font-black tracking-tight text-slate-900">
                          {schedule.program}
                        </CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs sm:text-sm text-slate-500 font-medium">
                          <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
                            <CalendarDays className="size-3.5 text-emerald-700" />
                            {formatLongDate(schedule.date)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="size-3.5 text-slate-400" />
                            {formatTime(PROGRAM_TIME_SLOTS[0])} – {formatTime(PROGRAM_TIME_SLOTS[PROGRAM_TIME_SLOTS.length - 1])}
                          </span>
                          {schedule.location ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-600">
                              <MapPin className="size-3.5 text-rose-500" />
                              <span className="truncate max-w-[200px]">{schedule.location}</span>
                            </span>
                          ) : null}
                        </CardDescription>
                      </div>

                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs font-bold uppercase tracking-wider ${statusConfig.className}`}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 px-4 pb-4 sm:px-4.5">
                    {/* Capacity Display & Progress Bar */}
                    <div className="space-y-1.5 rounded-lg bg-slate-50/80 p-2.5 border border-slate-100">
                      <div className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="font-medium text-slate-700">
                          <strong className="font-semibold text-slate-900">{schedule.booking_count}</strong> / {schedule.capacity} booked
                        </span>
                        <span className="font-medium">
                          {schedule.remaining_slots > 0 ? (
                            <span className="text-emerald-700 font-semibold">{schedule.remaining_slots} slots remaining</span>
                          ) : (
                            <span className="text-amber-700 font-semibold">0 slots remaining</span>
                          )}
                        </span>
                      </div>
                      <Progress
                        value={bookedPercent}
                        aria-label={`${schedule.booking_count} of ${schedule.capacity} slots booked`}
                        className="h-2 rounded-full bg-slate-200/80 [&>div]:bg-emerald-600 [&>div]:rounded-full"
                      />
                    </div>

                    {/* Time slots breakdown */}
                    <div className="flex flex-wrap gap-1.5">
                      {PROGRAM_TIME_SLOTS.map((slot) => {
                        const slotBookings = schedule.booked_times.filter((t) => t === slot).length;
                        return (
                          <span
                            key={slot}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${
                              slotBookings > 0
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : "border-slate-200/80 bg-slate-50 text-slate-600"
                            }`}
                          >
                            <Clock3 className="size-3 text-slate-400" />
                            {formatTime(slot)}
                            {slotBookings > 0 ? (
                              <span className="font-semibold text-amber-800">({slotBookings})</span>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                  </CardContent>

                  {/* Actions Bar */}
                  <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 sm:px-4.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(schedule)}
                      className="h-9 gap-1.5 rounded-xl px-3 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Users className="size-3.5 text-slate-500" />
                      View bookings ({roster.length})
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(schedule)}
                        className="h-9 gap-1 rounded-xl px-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="size-3" /> Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingAction({ schedule, action: schedule.is_open ? "close" : "reopen" })}
                        className="h-9 gap-1 rounded-xl px-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100"
                      >
                        {schedule.is_open ? (
                          <>
                            <LockKeyhole className="size-3 text-slate-500" /> Close
                          </>
                        ) : (
                          <>
                            <UnlockKeyhole className="size-3 text-slate-500" /> Reopen
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        title={hasHistory ? "Programs with booking records cannot be deleted; close the program instead." : "Delete program"}
                        disabled={hasHistory}
                        onClick={() => setPendingAction({ schedule, action: "delete" })}
                        className="h-8 gap-1 rounded-lg px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                      >
                        <Trash2 className="size-3" /> Delete
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Create / Edit Program Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg rounded-2xl border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              {editing ? "Edit Program" : "Create Program"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-500 font-medium">
              Set the program schedule, location, and maximum participants. Farmers will be able to book available time slots.
            </DialogDescription>
          </DialogHeader>

          <form id="schedule-form" onSubmit={saveSchedule} className="space-y-4 pt-1">
            {/* Section 1: Program Information */}
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Program Information</p>
              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-program">
                Program Title
                <Input
                  id="schedule-program"
                  required
                  maxLength={100}
                  value={form.program}
                  onChange={(event) => setForm({ ...form, program: event.target.value })}
                  placeholder="e.g. Cattle & Swine Vaccination Drive"
                  className="h-10 text-sm font-medium"
                />
              </label>
            </div>

            {/* Section 2: Schedule & Location */}
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Schedule & Location</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-date">
                  Date
                  <Input
                    id="schedule-date"
                    type="date"
                    required
                    value={form.date}
                    min={editing && editing.date < todayIso() ? undefined : todayIso()}
                    disabled={Boolean(editing && editing.date < todayIso())}
                    onChange={(event) => setForm({ ...form, date: event.target.value })}
                    className="h-10 text-sm font-medium"
                  />
                  {editing && editing.date < todayIso() ? (
                    <span className="block text-xs font-medium text-slate-400">Past dates cannot be altered.</span>
                  ) : null}
                </label>

                <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-capacity">
                  Maximum Slots
                  <Input
                    id="schedule-capacity"
                    type="number"
                    required
                    min={1}
                    max={10000}
                    step={1}
                    value={form.capacity}
                    onChange={(event) => setForm({ ...form, capacity: event.target.value })}
                    className="h-10 text-sm font-medium"
                  />
                </label>
              </div>

              <label className="block space-y-1.5 text-xs sm:text-sm font-bold text-slate-700" htmlFor="schedule-location">
                Location <span className="font-normal text-slate-400">(optional)</span>
                <Input
                  id="schedule-location"
                  maxLength={200}
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder="e.g. Municipal Agriculture Office, Padre Garcia"
                  className="h-10 text-sm font-medium"
                />
              </label>
            </div>
          </form>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold">
              Cancel
            </Button>
            <Button
              type="submit"
              form="schedule-form"
              disabled={busy}
              className={`h-10 px-4 rounded-xl text-xs sm:text-sm font-bold text-white shadow-xs ${accent}`}
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Create Program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Bookings Dialog */}
      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl rounded-2xl border border-slate-200">
          {selected ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <DialogTitle className="text-base sm:text-xl font-black text-slate-900 tracking-tight">{selected.program}</DialogTitle>
                  <Badge variant="outline" className="text-xs sm:text-sm font-bold">
                    {selectedBookings.length} {selectedBookings.length === 1 ? "farmer" : "farmers"} registered
                  </Badge>
                </div>
                <DialogDescription className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs sm:text-sm text-slate-500 font-medium pt-0.5">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                    <CalendarDays className="size-3.5 text-emerald-700" />
                    {formatLongDate(selected.date)}
                  </span>
                  {selected.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-rose-500" />
                      {selected.location}
                    </span>
                  ) : null}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Registered Farmers</h3>
                  <span className="text-xs sm:text-sm font-semibold text-slate-500">
                    Capacity: {selected.booking_count} / {selected.capacity}
                  </span>
                </div>

                {selectedBookings.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs sm:text-sm text-slate-500 font-medium">
                    No farmer bookings recorded for this program yet.
                  </p>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                          <tr>
                            <th className="px-3.5 py-2.5">Farmer Name</th>
                            <th className="px-3.5 py-2.5">Barangay</th>
                            <th className="px-3.5 py-2.5">Time Slot</th>
                            <th className="px-3.5 py-2.5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {selectedBookings.map((booking) => (
                            <tr key={booking.id} className="hover:bg-slate-50/60">
                              <td className="px-3.5 py-2.5 font-bold text-slate-900">{booking.farmer_name}</td>
                              <td className="px-3.5 py-2.5 text-slate-600">{booking.farmer_barangay || "—"}</td>
                              <td className="px-3.5 py-2.5 font-semibold text-slate-700">{formatTime(booking.time)}</td>
                              <td className="px-3.5 py-2.5 text-right">
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-bold ${
                                    booking.status === "CONFIRMED"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : "border-slate-200 bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {booking.status === "CONFIRMED" ? "Confirmed" : "Cancelled"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Stacked Cards View */}
                    <div className="sm:hidden space-y-2">
                      {selectedBookings.map((booking) => (
                        <div key={booking.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs sm:text-sm font-bold text-slate-900">{booking.farmer_name}</p>
                              <p className="text-xs text-slate-500">{booking.farmer_barangay || "Barangay not provided"}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs font-bold ${
                                booking.status === "CONFIRMED"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-slate-200 bg-slate-100 text-slate-600"
                              }`}
                            >
                              {booking.status === "CONFIRMED" ? "Confirmed" : "Cancelled"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                            <Clock3 className="size-3 text-slate-400" />
                            {formatTime(booking.time)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => startEdit(selected)} className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold">
                  <Pencil className="mr-1.5 size-3.5" /> Edit program
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingAction({ schedule: selected, action: selected.is_open ? "close" : "reopen" })}
                  className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold"
                >
                  {selected.is_open ? (
                    <><LockKeyhole className="mr-1.5 size-3.5 text-slate-500" /> Close program</>
                  ) : (
                    <><UnlockKeyhole className="mr-1.5 size-3.5 text-slate-500" /> Reopen program</>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Conflict Alert Dialog */}
      <AlertDialog open={conflictPayload !== null} onOpenChange={(open) => { if (!open) setConflictPayload(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">Scheduling conflict detected</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              {conflictPayload ? (() => {
                const location = schedules.find((schedule) => schedule.id !== editing?.id && schedule.date === conflictPayload.date && schedule.location.trim().toLocaleLowerCase() === conflictPayload.location.trim().toLocaleLowerCase());
                return location ? `“${location.program}” is already scheduled at ${location.location} on ${formatLongDate(location.date)}. Both programs offer overlapping appointment times.` : "Another program may overlap at this date and location.";
              })() : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="h-9 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy || !conflictPayload} onClick={(event) => { event.preventDefault(); if (conflictPayload) void persistSchedule(conflictPayload); }} className="h-9 text-xs">
              Continue anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Action Confirmation Dialog (Close, Reopen, Delete) */}
      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">
              {pendingAction?.action === "delete" ? "Delete program?" : pendingAction?.action === "close" ? "Close program registrations?" : "Reopen program registrations?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              {pendingAction?.action === "delete"
                ? selectedHasBookingHistory ? "This program has existing booking records. The system protects those records, so it cannot be deleted. Close the program instead to prevent new bookings while preserving registration history." : "This will permanently remove the program. It has no booking records." 
                : pendingAction?.action === "close" ? "Farmers will no longer be able to book this program. All existing registrations will be preserved." : "Farmers will be able to book open slots for this program again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="h-9 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || (pendingAction?.action === "delete" && selectedHasBookingHistory)}
              onClick={(event) => { event.preventDefault(); void performAction(); }}
              className={`h-9 text-xs ${pendingAction?.action === "delete" ? "bg-rose-700 text-white hover:bg-rose-800" : ""}`}
            >
              {busy ? "Working…" : pendingAction?.action === "delete" ? "Delete program" : pendingAction?.action === "close" ? "Close program" : "Reopen program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}