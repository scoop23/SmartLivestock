"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
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
      setMessage("Booking confirmed! Please arrive at the scheduled time.");
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
      await api.patch(`/community/bookings/${id}/`, {
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
        title="Field Scheduling & Visits"
        subtitle="Browse municipal livestock programs, select an available date, and reserve your appointment slot."
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void refresh()}
            disabled={isFetching}
            className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
            title="Refresh schedules"
            aria-label="Refresh schedules"
          >
            <RefreshCw className={`size-5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <main className="w-full space-y-4 p-3 sm:p-4 md:p-5">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-800"
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800"
          >
            <CheckCircle2 className="size-4 shrink-0 text-emerald-700" />
            <span>{message}</span>
          </div>
        ) : null}

        {/* Booking Form Card */}
        <Card className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
            <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900">
              <CalendarPlus className="size-4.5 text-emerald-700" />
              <span>Book a Program</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Select an available highlighted date, choose a scheduled program, and reserve a convenient time slot.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
            {loading ? (
              <CommunitySkeleton cards={2} />
            ) : schedules.length === 0 ? (
              <div className="lg:col-span-2 py-6">
                <CommunityEmptyState
                  icon={<CalendarDays className="size-5" />}
                  title="No open program dates"
                  description="No municipal programs or visit dates are currently open for booking. Please check back later."
                />
              </div>
            ) : (
              <>
                {/* Left Column: Calendar Date Picker */}
                <section
                  className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50/50 p-3"
                  aria-label="Choose a program date"
                >
                  <Calendar
                    mode="single"
                    selected={calendarDate ?? undefined}
                    onSelect={(day) => {
                      setCalendarDate(day ?? null);
                      setScheduleId("");
                      setTime("");
                    }}
                    disabled={(day) => !datesWithPrograms.has(isoFromLocalDate(day))}
                    modifiers={{ programDate: schedules.map((schedule) => localDateFromIso(schedule.date)) }}
                    modifiersClassNames={{ programDate: "bg-emerald-100/80 font-bold text-emerald-950" }}
                    className="w-full"
                  />
                  <div className="mt-2 flex items-center gap-1.5 px-2 text-[11px] text-slate-500">
                    <span className="size-2 rounded-full bg-emerald-600" />
                    <span>Highlighted dates have programs available for booking</span>
                  </div>
                </section>

                {/* Right Column: Programs on Selected Date & Time Selection */}
                <div className="min-w-0 space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {calendarDate
                          ? `Programs on ${formatLongDate(isoFromLocalDate(calendarDate))}`
                          : "Select a program date"}
                      </h3>
                      {programsOnDate.length > 0 ? (
                        <span className="text-xs text-slate-400">
                          {programsOnDate.length} {programsOnDate.length === 1 ? "program" : "programs"}
                        </span>
                      ) : null}
                    </div>

                    {calendarDate && programsOnDate.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                        No programs are scheduled on this date. Please pick a highlighted date on the calendar.
                      </p>
                    ) : null}

                    {/* Program cards on date */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      {programsOnDate.map((schedule) => {
                        const alreadyBooked = confirmedScheduleIds.has(schedule.id);
                        const isFull = schedule.registration_status === "FULL" || schedule.remaining_slots === 0;
                        const isClosed = !schedule.is_open || schedule.registration_status === "CLOSED";
                        const active = selected?.id === schedule.id;

                        return (
                          <div
                            key={schedule.id}
                            className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                              active
                                ? "border-emerald-600 bg-emerald-50/20 ring-1 ring-emerald-600 shadow-xs"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="truncate text-sm font-bold text-slate-900">
                                  {schedule.program}
                                </h4>
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-[10px] font-semibold ${
                                    isClosed
                                      ? "border-slate-200 bg-slate-100 text-slate-600"
                                      : isFull
                                        ? "border-amber-200 bg-amber-50 text-amber-900"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  }`}
                                >
                                  {isClosed ? "CLOSED" : isFull ? "FULL" : "OPEN"}
                                </Badge>
                              </div>

                              <div className="space-y-1 text-xs text-slate-500">
                                <p className="flex items-center gap-1.5">
                                  <Clock3 className="size-3.5 text-slate-400" />
                                  <span>{formatTime(PROGRAM_TIME_SLOTS[0])} – {formatTime(PROGRAM_TIME_SLOTS[PROGRAM_TIME_SLOTS.length - 1])}</span>
                                </p>
                                {schedule.location ? (
                                  <p className="flex items-center gap-1.5 text-slate-600">
                                    <MapPin className="size-3.5 text-rose-500" />
                                    <span className="truncate">{schedule.location}</span>
                                  </p>
                                ) : null}
                              </div>

                              <div className="pt-0.5 text-xs">
                                {isFull ? (
                                  <span className="font-semibold text-amber-800">Fully booked</span>
                                ) : (
                                  <span className="font-medium text-slate-600">
                                    <strong className="font-semibold text-emerald-700">{schedule.remaining_slots}</strong> slots remaining
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-100">
                              <Button
                                type="button"
                                size="sm"
                                variant={active ? "default" : "outline"}
                                disabled={isFull || isClosed || alreadyBooked}
                                onClick={() => {
                                  setScheduleId(String(schedule.id));
                                  setTime("");
                                }}
                                className={`w-full h-8 text-xs font-semibold ${
                                  active
                                    ? "bg-emerald-800 text-white hover:bg-emerald-900"
                                    : "border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                {alreadyBooked
                                  ? "Already booked"
                                  : isClosed
                                    ? "Registration closed"
                                    : isFull
                                      ? "Fully booked"
                                      : active
                                        ? "Program selected"
                                        : "Select program"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Review & Time Slot Picker */}
                  {selected ? (
                    <section
                      className="space-y-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"
                      aria-labelledby="program-review-title"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">Selected Program</p>
                          <h3 id="program-review-title" className="text-sm font-bold text-slate-900">
                            {selected.program}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {formatLongDate(selected.date)}
                            {selected.location ? ` · ${selected.location}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-900 font-semibold text-xs">
                          {selected.remaining_slots} slots available
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-700">Choose your preferred time slot:</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {PROGRAM_TIME_SLOTS.map((slot) => (
                            <Button
                              key={slot}
                              type="button"
                              variant={time === slot ? "default" : "outline"}
                              disabled={busy || selected.remaining_slots === 0 || confirmedScheduleIds.has(selected.id)}
                              onClick={() => setTime(slot)}
                              className={`h-9 text-xs font-medium ${
                                time === slot
                                  ? "bg-emerald-800 text-white hover:bg-emerald-900"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <Clock3 className="mr-1.5 size-3 text-slate-400" />
                              {formatTime(slot)}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {confirmedScheduleIds.has(selected.id) ? (
                        <p className="text-xs font-medium text-amber-800">
                          You already have a confirmed booking for this program.
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-200/80 pt-3">
                        <p className="text-[11px] text-slate-500">
                          Bookings are free. You may cancel anytime before the scheduled visit date.
                        </p>
                        <Button
                          type="button"
                          disabled={
                            busy ||
                            !time ||
                            availableTimes.length === 0 ||
                            confirmedScheduleIds.has(selected.id)
                          }
                          onClick={book}
                          className="h-9 gap-1.5 bg-emerald-800 px-4 text-xs font-semibold text-white hover:bg-emerald-900"
                        >
                          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarCheck className="size-3.5" />}
                          <span>Confirm booking</span>
                        </Button>
                      </div>
                    </section>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                      Select one of the programs listed above to review its time slots and reserve a slot.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            title="Confirmed visits"
            value={confirmed.length}
            icon={<CalendarCheck className="size-4" />}
            description="Total reservations made"
            variant="emerald"
            size="sm"
            isLoading={loading}
          />
          <KpiCard
            title="Upcoming visits"
            value={upcoming.length}
            icon={<Clock3 className="size-4" />}
            description="Visits scheduled to attend"
            variant="sky"
            size="sm"
            isLoading={loading}
          />
          <KpiCard
            title="Open program dates"
            value={schedules.length}
            icon={<CalendarDays className="size-4" />}
            description="Available for booking"
            variant="orange"
            size="sm"
            isLoading={loading}
          />
        </div>

        {/* My Bookings Section */}
        <Panel
          title="My Bookings"
          icon={<CalendarCheck className={`size-3.5 ${accent.icon}`} />}
          description="Your upcoming scheduled visits and complete booking history."
        >
          {loading ? (
            <CommunitySkeleton cards={2} />
          ) : error && bookings.length === 0 ? (
            <CommunityErrorCard message={error} onRetry={refresh} />
          ) : bookings.length === 0 ? (
            <CommunityEmptyState
              icon={<CalendarCheck className="size-5" />}
              title="No bookings yet"
              description="Once you reserve an appointment, your confirmed visit will appear here with date, time, and location details."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {bookings
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((booking) => {
                  const canCancel = booking.status === "CONFIRMED" && isUpcoming(booking.date);
                  const countdown = daysUntil(booking.date);

                  return (
                    <article
                      key={booking.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-bold text-slate-900">
                              {booking.program}
                            </h4>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {formatLongDate(booking.date)}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold ${
                              booking.status === "CONFIRMED"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : booking.status === "CANCELLED"
                                  ? "border-slate-200 bg-slate-100 text-slate-600"
                                  : "border-amber-200 bg-amber-50 text-amber-800"
                            }`}
                          >
                            {booking.status}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <Clock3 className="size-3.5 text-slate-400" />
                            {formatTime(booking.time)}
                          </span>

                          {booking.status === "CONFIRMED" && isUpcoming(booking.date) ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CalendarDays className="size-3.5" />
                              {countdown === 0
                                ? "Today"
                                : countdown === 1
                                  ? "Tomorrow"
                                  : `In ${countdown} days`}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {canCancel ? (
                        <div className="mt-3 flex justify-end border-t border-slate-100 pt-2.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => cancel(booking.id)}
                            className="h-7 gap-1 rounded-lg px-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
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
