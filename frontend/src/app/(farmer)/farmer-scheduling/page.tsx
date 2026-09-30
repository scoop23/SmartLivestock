"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  MapPin,
  RotateCw,
  X,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import api from "@/lib/axios";
import {
  ProgramBooking,
  ProgramSchedule,
  apiError,
  getBookings,
  getSchedules,
} from "@/lib/community-api";
import {
  CommunityEmptyState,
  CommunityErrorCard,
  CommunitySkeleton,
  Panel,
  PROGRAM_TIME_SLOTS,
  ROLE_ACCENT,
  StatusPill,
  daysUntil,
  formatLongDate,
  formatTime,
  isUpcoming,
} from "@/app/components/community/community-ui";

function localDateFromIso(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoFromLocalDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export default function FarmerSchedulingPage() {
  const accent = ROLE_ACCENT.farmer;
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [bookings, setBookings] = useState<ProgramBooking[]>([]);
  const [scheduleId, setScheduleId] = useState("");
  const [calendarDate, setCalendarDate] = useState<Date | null>(null);
  const initializedCalendar = useRef(false);
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [open, mine] = await Promise.all([getSchedules(), getBookings()]);
      setSchedules(open);
      setBookings(mine);
      if (!initializedCalendar.current) {
        const requestedSchedule = new URLSearchParams(window.location.search).get("schedule");
        const requested = open.find((schedule) => schedule.id === Number(requestedSchedule));
        const initialSchedule = requested ?? open[0];
        if (initialSchedule) setCalendarDate(localDateFromIso(initialSchedule.date));
        if (requested) setScheduleId(String(requested.id));
        initializedCalendar.current = true;
      }
      setError("");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsFetching(true);
    await load();
  }, [load]);

  useEffect(() => {
    // The async request updates loading state when it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const selected = schedules.find((schedule) => schedule.id === Number(scheduleId));
  const datesWithPrograms = useMemo(() => new Set(schedules.map((schedule) => schedule.date)), [schedules]);
  const programsOnDate = useMemo(
    () => calendarDate ? schedules.filter((schedule) => schedule.date === isoFromLocalDate(calendarDate)) : [],
    [calendarDate, schedules],
  );
  const confirmedScheduleIds = useMemo(
    () => new Set(bookings.filter((booking) => booking.status === "CONFIRMED").map((booking) => booking.schedule)),
    [bookings],
  );
  const availableTimes = useMemo(() => selected?.remaining_slots ? PROGRAM_TIME_SLOTS : [], [selected]);

  async function book() {
    if (!scheduleId || !time || confirmedScheduleIds.has(Number(scheduleId))) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.post("/community/bookings/", {
        schedule: Number(scheduleId),
        time,
      });
      setMessage("Booking confirmed. Please arrive on time.");
      setScheduleId("");
      setTime("");
      window.history.replaceState({}, "", window.location.pathname);
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: number) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.patch("/community/bookings/" + id + "/", {
        status: "CANCELLED",
      });
      setMessage("Booking cancelled.");
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");
  const upcoming = confirmed.filter((b) => isUpcoming(b.date));

  return (
    <>
      <PageHeader
        title="Programs & Visits"
        // subtitle="Reserve a slot for the next MAO program visit"
        // icon={<CalendarDays className="size-5 text-slate-800" />}
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <button
            type="button"
            onClick={() => refresh()}
            title="Refresh schedules"
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer ${accent.tint} ${accent.text} hover:opacity-80`}
          >
            <RotateCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <main className="p-3 sm:p-4 md:p-5 w-full space-y-3.5">
        {/* Booking form */}
        <Card className="gap-0 border-slate-200 shadow-2xs">
          <CardHeader className="p-4 sm:p-5">
            <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
              <CalendarPlus className="size-4 text-emerald-700" /> Book a Program
            </CardTitle>
            <CardDescription>Choose a date with a program, review its details, then select an available time.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 px-4 pb-4 sm:px-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
            {loading ? <CommunitySkeleton cards={2} /> : schedules.length === 0 ? (
              <div className="lg:col-span-2"><CommunityEmptyState icon={<CalendarDays className="size-5" />} title="No open program dates" description="No programs or visit dates are available yet. Check back later." /></div>
            ) : <>
              <section className="rounded-xl border border-slate-200 bg-white p-2 sm:p-3" aria-label="Choose a program date">
                <Calendar
                  mode="single"
                  selected={calendarDate ?? undefined}
                  onSelect={(day) => { setCalendarDate(day ?? null); setScheduleId(""); setTime(""); }}
                  disabled={(day) => !datesWithPrograms.has(isoFromLocalDate(day))}
                  modifiers={{ programDate: schedules.map((schedule) => localDateFromIso(schedule.date)) }}
                  modifiersClassNames={{ programDate: "bg-emerald-50 font-semibold text-emerald-900" }}
                  className="mx-auto w-full"
                />
                <p className="px-2 pb-2 text-center text-xs text-slate-500">Highlighted dates have programs available for booking.</p>
              </section>

              <div className="min-w-0 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">{calendarDate ? `Programs on ${formatLongDate(isoFromLocalDate(calendarDate))}` : "Select a program date"}</h3>
                  {calendarDate && programsOnDate.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No programs are available on this date.</p> : null}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {programsOnDate.map((schedule) => {
                      const alreadyBooked = confirmedScheduleIds.has(schedule.id);
                      const isFull = schedule.registration_status === "FULL";
                      const active = selected?.id === schedule.id;
                      return <Card key={schedule.id} className={`gap-0 shadow-none transition-colors ${active ? "border-emerald-600 ring-1 ring-emerald-600" : "border-slate-200"}`}>
                        <CardContent className="space-y-2.5 p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0"><h4 className="truncate text-sm font-semibold text-slate-900">{schedule.program}</h4>{schedule.location ? <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><MapPin className="size-3.5" />{schedule.location}</p> : null}</div>
                            <Badge variant="outline" className={isFull ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}>{isFull ? "Fully booked" : "Open"}</Badge>
                          </div>
                          <p className="text-xs text-slate-600">{schedule.booking_count} / {schedule.capacity} slots booked · {schedule.remaining_slots} slots remaining</p>
                          <Button type="button" variant={active ? "secondary" : "outline"} className="w-full" disabled={isFull || alreadyBooked} onClick={() => { setScheduleId(String(schedule.id)); setTime(""); }}>
                            {alreadyBooked ? "Already booked" : isFull ? "Fully booked" : active ? "Program selected" : "Review program"}
                          </Button>
                        </CardContent>
                      </Card>;
                    })}
                  </div>
                </div>

                {selected ? <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5" aria-labelledby="program-review-title">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 id="program-review-title" className="text-sm font-semibold text-slate-900">Review {selected.program}</h3><p className="mt-1 text-xs text-slate-500">{formatLongDate(selected.date)}{selected.location ? ` · ${selected.location}` : ""}</p></div><Badge variant="secondary">{selected.remaining_slots} slots remaining</Badge></div>
                  <div><p className="mb-2 text-xs font-medium text-slate-700">Choose a time</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PROGRAM_TIME_SLOTS.map((slot) => {
                    return <Button key={slot} type="button" variant={time === slot ? "default" : "outline"} disabled={busy || selected.remaining_slots === 0 || confirmedScheduleIds.has(selected.id)} onClick={() => setTime(slot)} className={time === slot ? "bg-emerald-700 text-white hover:bg-emerald-800" : ""}>{formatTime(slot)}</Button>;
                  })}</div></div>
                  {confirmedScheduleIds.has(selected.id) ? <p className="text-xs text-amber-800">You already have a confirmed booking for this program.</p> : null}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3"><p className="text-xs text-slate-500">Bookings are free. You can cancel before the visit date.</p><Button type="button" disabled={busy || !time || availableTimes.length === 0 || confirmedScheduleIds.has(selected.id)} onClick={book} className="bg-emerald-700 text-white hover:bg-emerald-800">{busy ? <Loader2 className="animate-spin" /> : <CalendarCheck />} Confirm booking</Button></div>
                </section> : <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">Choose a listed program to review its times and book a slot.</p>}
              </div>
            </>}
          </CardContent>
        </Card>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-bold text-red-800"
          >
            {error}
          </div>
        ) : null}
        {message ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs font-bold text-emerald-800"
          >
            <CheckCircle2 className="size-4" /> {message}
          </div>
        ) : null}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <KpiCard
            title="Confirmed visits"
            value={confirmed.length}
            icon={<CalendarCheck className="w-4 h-4" />}
            description="All time"
            variant="emerald"
            size="sm"
            isLoading={loading}
          />
          <KpiCard
            title="Upcoming"
            value={upcoming.length}
            icon={<Clock3 className="w-4 h-4" />}
            description="Still to attend"
            variant="sky"
            size="sm"
            isLoading={loading}
          />
          <KpiCard
            title="Open dates"
            value={schedules.length}
            icon={<CalendarDays className="w-4 h-4" />}
            description="Ready to book"
            variant="orange"
            size="sm"
            isLoading={loading}
          />
        </div>

        {/* My bookings */}
        <Panel
          title="My bookings"
          icon={<CalendarCheck className={`w-3.5 h-3.5 ${accent.icon}`} />}
          description="Upcoming visits and your booking history."
        >
          {loading ? (
            <CommunitySkeleton />
          ) : error && bookings.length === 0 ? (
            <CommunityErrorCard message={error} onRetry={refresh} />
          ) : bookings.length === 0 ? (
            <CommunityEmptyState
              icon={<CalendarCheck className="size-5" />}
              title="No bookings yet"
              description="Once you reserve a slot, your scheduled visit will appear here with its date and time."
            />
          ) : (
            <div className="grid gap-2.5 grid-cols-1 lg:grid-cols-2">
              {bookings
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((booking) => {
                  const canCancel =
                    booking.status === "CONFIRMED" && isUpcoming(booking.date);
                  const countdown = daysUntil(booking.date);
                  return (
                    <article
                      key={booking.id}
                      className="rounded-xl border border-slate-200 p-3.5 transition-all hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900">
                            {booking.program}
                          </h4>
                          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                            {formatLongDate(booking.date)}
                          </p>
                        </div>
                        <StatusPill
                          className={
                            booking.status === "CONFIRMED"
                              ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                              : booking.status === "CANCELLED"
                                ? "text-slate-600 bg-slate-100 border-slate-200"
                                : "text-amber-800 bg-amber-50 border-amber-200"
                          }
                        >
                          {booking.status.charAt(0) + booking.status.slice(1).toLowerCase()}
                        </StatusPill>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="size-3.5 text-slate-400" />
                          {formatTime(booking.time)}
                        </span>
                        {booking.status === "CONFIRMED" && isUpcoming(booking.date) ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700">
                            <CalendarDays className="size-3.5" />
                            {countdown === 0
                              ? "Today"
                              : countdown === 1
                                ? "Tomorrow"
                                : "In " + countdown + " days"}
                          </span>
                        ) : null}
                      </div>

                      {canCancel ? (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={busy}
                            onClick={() => cancel(booking.id)}
                            className="h-7 gap-1 rounded-lg px-2 text-[11px] font-bold text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            <X className="size-3" /> Cancel booking
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
            </div>
          )}
        </Panel>
      </main>
    </>
  );
}
