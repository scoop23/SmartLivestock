"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Clock3,
  HelpCircle,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  PROGRAM_TIME_SLOTS,
  ROLE_ACCENT,
  daysUntil,
  formatLongDate,
  formatShortDate,
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
  const [bookingFilter, setBookingFilter] = useState<"upcoming" | "all">("upcoming");
  const [cancelingTarget, setCancelingTarget] = useState<ProgramBooking | null>(null);

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
    void load();
  }, [load]);

  const selected = schedules.find((schedule) => schedule.id === Number(scheduleId));
  const datesWithPrograms = useMemo(() => new Set(schedules.map((schedule) => schedule.date)), [schedules]);
  const programsOnDate = useMemo(
    () => (calendarDate ? schedules.filter((schedule) => schedule.date === isoFromLocalDate(calendarDate)) : []),
    [calendarDate, schedules],
  );
  const confirmedScheduleIds = useMemo(
    () => new Set(bookings.filter((booking) => booking.status === "CONFIRMED").map((booking) => booking.schedule)),
    [bookings],
  );
  const availableTimes = useMemo(() => (selected?.remaining_slots ? PROGRAM_TIME_SLOTS : []), [selected]);

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

  async function handleConfirmCancel() {
    if (!cancelingTarget) return;
    const targetId = cancelingTarget.id;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.patch(`/community/bookings/${targetId}/`, {
        status: "CANCELLED",
      });
      setMessage("Booking cancelled.");
      setCancelingTarget(null);
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");
  const upcoming = confirmed.filter((b) => isUpcoming(b.date));
  const nextVisit = useMemo(() => {
    const list = upcoming.slice().sort((a, b) => a.date.localeCompare(b.date));
    return list[0] ?? null;
  }, [upcoming]);

  const displayedBookings = useMemo(() => {
    const list = bookingFilter === "upcoming" ? upcoming : bookings;
    return list.slice().sort((a, b) => b.date.localeCompare(a.date));
  }, [bookingFilter, upcoming, bookings]);

  return (
    <>
      <PageHeader
        title="Field Scheduling & Visits"
        subtitle="Browse municipal veterinary programs, select an available date, and reserve your appointment slot."
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

      <main className="w-full space-y-5 p-3 sm:p-4 md:p-6">
        {/* Sleek Schedule Telemetry Ribbon (Replaces redundant KPI cards while clearly presenting all 3 insights) */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:px-5 sm:py-3 shadow-xs md:flex-row md:items-center md:justify-between">
          {/* Key Insight 1: Nearest Scheduled Farm Visit */}
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl ${
                nextVisit ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {nextVisit ? <Clock3 className="size-4.5 sm:size-5" /> : <CalendarCheck className="size-4.5 sm:size-5" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {nextVisit ? "Next Farm Visit" : "Field Appointments"}
                </span>
                {nextVisit ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-950">
                    {daysUntil(nextVisit.date) === 0
                      ? "Today"
                      : daysUntil(nextVisit.date) === 1
                        ? "Tomorrow"
                        : `In ${daysUntil(nextVisit.date)} days`}
                  </span>
                ) : null}
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 whitespace-normal break-words">
                {nextVisit ? (
                  <>
                    <span>{nextVisit.program}</span>
                    <span className="text-slate-400 font-normal"> · </span>
                    <span className="text-emerald-800 font-bold">{formatLongDate(nextVisit.date)}</span>
                    <span className="text-slate-400 font-normal"> at </span>
                    <span className="text-slate-700 font-semibold">{formatTime(nextVisit.time)}</span>
                  </>
                ) : (
                  <span className="text-slate-600 font-medium">
                    No active appointments reserved · Pick an open program date below to book
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Key Insights 2 & 3: Interactive Status Badges */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 border-t border-slate-100 pt-2.5 md:border-t-0 md:pt-0">
            <button
              type="button"
              onClick={() => {
                setBookingFilter("upcoming");
                const el = document.getElementById("my-bookings-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 px-3 py-1.5 text-xs font-bold text-emerald-900 transition-colors cursor-pointer"
              title="View my upcoming bookings"
            >
              <CalendarCheck className="size-4 text-emerald-700" />
              <span>
                <strong>{upcoming.length}</strong> Reserved {upcoming.length === 1 ? "Slot" : "Slots"}
              </span>
            </button>

            <div
              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-xs font-bold text-sky-900"
              title="Programs open across Padre Garcia"
            >
              <CalendarDays className="size-4 text-sky-700" />
              <span>
                <strong>{schedules.length}</strong> Open {schedules.length === 1 ? "Program" : "Programs"}
              </span>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {error ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-bold text-red-800 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-red-100 text-red-700">!</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-800 p-1"
              aria-label="Dismiss error"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {message ? (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm font-bold text-emerald-900 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-700" />
              <span>{message}</span>
            </div>
            <button
              type="button"
              onClick={() => setMessage("")}
              className="text-emerald-700 hover:text-emerald-900 p-1"
              aria-label="Dismiss message"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {/* 2. Interactive Booking Suite */}
        <section aria-label="Book a program appointment" className="space-y-4">
          <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            {/* Header & Guided Stepper */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 via-slate-50/30 to-white p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2.5 text-base sm:text-xl font-black text-slate-900 tracking-tight">
                    <CalendarPlus className="size-5 text-emerald-700" />
                    <span>Reserve an Appointment</span>
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
                    Select a highlighted date, choose an active field program, and pick your arrival time window.
                  </p>
                </div>

                {/* Stepper Pills */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
                      calendarDate
                        ? "bg-emerald-100 text-emerald-900 font-black"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <span>1. Date</span>
                    {calendarDate ? <Check className="size-3 text-emerald-700" /> : null}
                  </span>
                  <span className="text-slate-300">→</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
                      selected
                        ? "bg-emerald-100 text-emerald-900 font-black"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <span>2. Program</span>
                    {selected ? <Check className="size-3 text-emerald-700" /> : null}
                  </span>
                  <span className="text-slate-300">→</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
                      time
                        ? "bg-emerald-800 text-white font-black shadow-xs"
                        : selected
                          ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <span>3. Time</span>
                  </span>
                </div>
              </div>
            </div>

            <CardContent className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
              {loading ? (
                <div className="lg:col-span-2">
                  <CommunitySkeleton cards={3} />
                </div>
              ) : schedules.length === 0 ? (
                <div className="lg:col-span-2 py-8">
                  <CommunityEmptyState
                    icon={<CalendarDays className="size-6" />}
                    title="No open program dates"
                    description="No municipal veterinary visits or programs are currently scheduled for booking. Please check back later."
                  />
                </div>
              ) : (
                <>
                  {/* Left Column: Interactive Calendar */}
                  <div className="flex flex-col space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
                        1. Select Visit Date
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                        {datesWithPrograms.size} Active Dates
                      </span>
                    </div>

                    <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50/60 p-3 shadow-2xs">
                      <Calendar
                        mode="single"
                        selected={calendarDate ?? undefined}
                        onSelect={(day) => {
                          setCalendarDate(day ?? null);
                          setScheduleId("");
                          setTime("");
                        }}
                        disabled={(day) => !datesWithPrograms.has(isoFromLocalDate(day))}
                        modifiers={{
                          programDate: schedules.map((schedule) => localDateFromIso(schedule.date)),
                        }}
                        modifiersClassNames={{
                          programDate:
                            "bg-emerald-100/90 font-black text-emerald-950 hover:bg-emerald-200 transition-colors",
                        }}
                        className="w-full"
                      />

                      {/* Legend Bar */}
                      <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 px-2 text-xs font-medium text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full bg-emerald-600 ring-2 ring-emerald-200" />
                          <span>Dates with programs</span>
                        </div>
                        {calendarDate ? (
                          <button
                            type="button"
                            onClick={() => {
                              const firstWithProgram = schedules[0];
                              if (firstWithProgram) setCalendarDate(localDateFromIso(firstWithProgram.date));
                            }}
                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                          >
                            Reset date
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Programs on Selected Date & Booking Form */}
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
                        2. Choose Field Program
                      </h3>
                      {calendarDate ? (
                        <span className="text-xs sm:text-sm font-semibold text-slate-600">
                          {formatLongDate(isoFromLocalDate(calendarDate))}
                        </span>
                      ) : null}
                    </div>

                    {/* No programs on this date */}
                    {calendarDate && programsOnDate.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                        <CalendarDays className="mx-auto size-8 text-slate-300" />
                        <h4 className="mt-2 text-sm sm:text-base font-bold text-slate-700">No programs on this date</h4>
                        <p className="mt-1 text-xs sm:text-sm text-slate-500">
                          Please pick one of the highlighted dates on the calendar to see available programs.
                        </p>
                      </div>
                    ) : null}

                    {/* Program Cards Grid */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {programsOnDate.map((schedule) => {
                        const alreadyBooked = confirmedScheduleIds.has(schedule.id);
                        const isFull = schedule.registration_status === "FULL" || schedule.remaining_slots === 0;
                        const isClosed = !schedule.is_open || schedule.registration_status === "CLOSED";
                        const isSelected = selected?.id === schedule.id;

                        const bookedPercent = schedule.capacity
                          ? Math.min(100, Math.round((schedule.booking_count / schedule.capacity) * 100))
                          : 0;

                        return (
                          <div
                            key={schedule.id}
                            onClick={() => {
                              if (isFull || isClosed || alreadyBooked) return;
                              setScheduleId(String(schedule.id));
                              setTime("");
                            }}
                            className={`group relative flex flex-col justify-between rounded-2xl border p-4.5 transition-all duration-200 ${
                              isFull || isClosed || alreadyBooked
                                ? "cursor-not-allowed border-slate-200 bg-slate-50/60 opacity-80"
                                : isSelected
                                  ? "cursor-pointer border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-600 shadow-sm"
                                  : "cursor-pointer border-slate-200 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-xs"
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="line-clamp-2 text-base font-black text-slate-900 tracking-tight transition-colors group-hover:text-emerald-800">
                                  {schedule.program}
                                </h4>
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-xs font-bold uppercase tracking-wider ${
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

                              {/* Details: Venue & Time Window */}
                              <div className="space-y-1.5 text-xs sm:text-sm text-slate-600 font-medium">
                                <div className="flex items-center gap-2">
                                  <Clock3 className="size-3.5 shrink-0 text-slate-400" />
                                  <span>
                                    {formatTime(PROGRAM_TIME_SLOTS[0])} –{" "}
                                    {formatTime(PROGRAM_TIME_SLOTS[PROGRAM_TIME_SLOTS.length - 1])}
                                  </span>
                                </div>
                                {schedule.location ? (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="size-3.5 shrink-0 text-rose-500" />
                                    <span className="truncate">{schedule.location}</span>
                                  </div>
                                ) : null}
                              </div>

                              {/* Capacity Bar */}
                              <div className="space-y-1.5 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                                <div className="flex items-center justify-between text-xs sm:text-sm">
                                  <span className="font-medium text-slate-700">
                                    Capacity: <strong className="font-bold text-slate-900">{schedule.booking_count}</strong>/{schedule.capacity}
                                  </span>
                                  <span className="font-bold text-emerald-800">
                                    {isFull ? (
                                      <span className="text-amber-800">0 left</span>
                                    ) : (
                                      `${schedule.remaining_slots} left`
                                    )}
                                  </span>
                                </div>
                                <Progress
                                  value={bookedPercent}
                                  className="h-1.5 rounded-full bg-slate-200 [&>div]:bg-emerald-600"
                                />
                              </div>
                            </div>

                            {/* Select / Active Button State */}
                            <div className="mt-4 pt-3 border-t border-slate-100">
                              <Button
                                type="button"
                                size="sm"
                                disabled={isFull || isClosed || alreadyBooked}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setScheduleId(String(schedule.id));
                                  setTime("");
                                }}
                                className={`w-full h-9 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                                  alreadyBooked
                                    ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed"
                                    : isSelected
                                      ? "bg-emerald-800 text-white shadow-xs"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                {alreadyBooked ? (
                                  <span>Already booked</span>
                                ) : isClosed ? (
                                  <span>Closed</span>
                                ) : isFull ? (
                                  <span>Fully booked</span>
                                ) : isSelected ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Check className="size-4" /> Selected
                                  </span>
                                ) : (
                                  <span>Select this program</span>
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Step 3: Time Slot Selection & Confirmation Drawer */}
                    {selected ? (
                      <div className="mt-6 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-emerald-50/40 to-white p-4 sm:p-6 shadow-xs space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-200/60 pb-3.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-emerald-800 px-2.5 py-0.5 text-xs font-black text-white">
                                Step 3
                              </span>
                              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                Pick Arrival Time Slot
                              </h3>
                            </div>
                            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600">
                              Reserving for <strong className="text-slate-900">{selected.program}</strong> on{" "}
                              <strong className="text-slate-900">{formatLongDate(selected.date)}</strong>
                              {selected.location ? ` at ${selected.location}` : ""}.
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-white text-emerald-900 font-bold text-xs sm:text-sm px-3 py-1"
                          >
                            {selected.remaining_slots} slots available
                          </Badge>
                        </div>

                        {/* Slot Buttons */}
                        <div className="space-y-2">
                          <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 block">
                            Choose Your Preferred Arrival Time:
                          </label>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {PROGRAM_TIME_SLOTS.map((slot) => {
                              const isSlotActive = time === slot;
                              return (
                                <Button
                                  key={slot}
                                  type="button"
                                  variant={isSlotActive ? "default" : "outline"}
                                  disabled={busy || selected.remaining_slots === 0 || confirmedScheduleIds.has(selected.id)}
                                  onClick={() => setTime(slot)}
                                  className={`h-11 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                                    isSlotActive
                                      ? "bg-emerald-800 text-white hover:bg-emerald-900 shadow-sm ring-2 ring-emerald-800/30"
                                      : "border-slate-200 bg-white text-slate-800 hover:bg-emerald-50 hover:border-emerald-300"
                                  }`}
                                >
                                  <Clock className="mr-1.5 size-3.5" />
                                  <span>{formatTime(slot)}</span>
                                </Button>
                              );
                            })}
                          </div>
                        </div>

                        {confirmedScheduleIds.has(selected.id) ? (
                          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs sm:text-sm font-semibold text-amber-900">
                            You already have an active booking for this program. To modify your time, cancel your existing reservation below first.
                          </p>
                        ) : null}

                        {/* Bottom Confirmation Bar */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-emerald-200/60 pt-4">
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600">
                            <Info className="size-4 shrink-0 text-emerald-700" />
                            <span>Official municipal service. Free of charge for registered farmers.</span>
                          </div>

                          <Button
                            type="button"
                            disabled={
                              busy ||
                              !time ||
                              availableTimes.length === 0 ||
                              confirmedScheduleIds.has(selected.id)
                            }
                            onClick={book}
                            className="h-11 gap-2 rounded-xl bg-emerald-800 px-6 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-emerald-900 active:scale-95 transition-all cursor-pointer"
                          >
                            {busy ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <CalendarCheck className="size-4" />
                            )}
                            <span>Confirm Reservation</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
                        <p className="text-xs sm:text-sm font-medium text-slate-500">
                          Click on any program card above to open its available appointment time slots.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 3. My Bookings & Visit History Section */}
        <section id="my-bookings-section" aria-label="My scheduled bookings" className="space-y-4 pt-2">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2.5 text-base sm:text-xl font-black text-slate-900 tracking-tight">
                    <CalendarCheck className="size-5 text-emerald-700" />
                    <span>My Scheduled Visits</span>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-slate-500 font-medium">
                    Review your upcoming confirmed reservations and complete appointment history.
                  </CardDescription>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={bookingFilter === "upcoming" ? "default" : "outline"}
                    onClick={() => setBookingFilter("upcoming")}
                    className={`h-9 rounded-full px-3.5 text-xs sm:text-sm font-bold transition-all ${
                      bookingFilter === "upcoming"
                        ? "bg-emerald-800 text-white hover:bg-emerald-900 shadow-xs"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>Upcoming</span>
                    <span
                      className={`ml-1.5 rounded-full px-2 py-0.2 text-xs font-black ${
                        bookingFilter === "upcoming"
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {upcoming.length}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant={bookingFilter === "all" ? "default" : "outline"}
                    onClick={() => setBookingFilter("all")}
                    className={`h-9 rounded-full px-3.5 text-xs sm:text-sm font-bold transition-all ${
                      bookingFilter === "all"
                        ? "bg-emerald-800 text-white hover:bg-emerald-900 shadow-xs"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>All Bookings</span>
                    <span
                      className={`ml-1.5 rounded-full px-2 py-0.2 text-xs font-black ${
                        bookingFilter === "all"
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {bookings.length}
                    </span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {loading ? (
                <CommunitySkeleton cards={2} />
              ) : displayedBookings.length === 0 ? (
                <div className="py-8">
                  <CommunityEmptyState
                    icon={<CalendarCheck className="size-6 text-slate-400" />}
                    title={bookingFilter === "upcoming" ? "No upcoming visits" : "No bookings recorded"}
                    description={
                      bookingFilter === "upcoming"
                        ? "You have no upcoming appointment slots reserved. Pick a program from the calendar above to book your visit."
                        : "No past or active bookings have been made yet."
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {displayedBookings.map((booking) => {
                    const isConfirmed = booking.status === "CONFIRMED";
                    const isFuture = isUpcoming(booking.date);
                    const countdown = daysUntil(booking.date);
                    const canCancel = isConfirmed && isFuture;

                    return (
                      <Card
                        key={booking.id}
                        className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="line-clamp-2 text-base font-black text-slate-900 tracking-tight">
                              {booking.program}
                            </h4>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-xs font-bold uppercase tracking-wider ${
                                isConfirmed
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-slate-200 bg-slate-100 text-slate-600"
                              }`}
                            >
                              {booking.status}
                            </Badge>
                          </div>

                          {/* Date and Time Details */}
                          <div className="space-y-1.5 text-xs sm:text-sm text-slate-600 font-medium">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="size-4 shrink-0 text-emerald-700" />
                              <span className="font-semibold text-slate-800">
                                {formatLongDate(booking.date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="size-4 shrink-0 text-slate-400" />
                              <span>{formatTime(booking.time)}</span>
                            </div>
                          </div>

                          {/* Countdown Indicator */}
                          {isConfirmed && isFuture ? (
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200/80">
                              <Sparkles className="size-3.5 text-emerald-600" />
                              <span>
                                {countdown === 0
                                  ? "Scheduled for Today!"
                                  : countdown === 1
                                    ? "Scheduled for Tomorrow"
                                    : `In ${countdown} days`}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        {/* Action Footer */}
                        {canCancel ? (
                          <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => setCancelingTarget(booking)}
                              className="h-8 gap-1.5 rounded-xl px-3 text-xs sm:text-sm font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                            >
                              <X className="size-3.5" />
                              <span>Cancel Reservation</span>
                            </Button>
                          </div>
                        ) : null}
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Confirmation Dialog for Cancellation */}
      <AlertDialog
        open={cancelingTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !busy) setCancelingTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Cancel Appointment Reservation?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              Are you sure you want to cancel your booking for{" "}
              <strong className="text-slate-900">{cancelingTarget?.program}</strong> on{" "}
              <strong className="text-slate-900">
                {cancelingTarget ? formatLongDate(cancelingTarget.date) : ""}
              </strong>
              ? This slot will immediately be made available for other farmers in Padre Garcia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-3">
            <AlertDialogCancel
              disabled={busy}
              className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold"
            >
              Keep My Booking
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmCancel();
              }}
              className="h-10 px-4 rounded-xl text-xs sm:text-sm font-bold bg-rose-700 text-white hover:bg-rose-800"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Cancelling…
                </>
              ) : (
                "Yes, Cancel Reservation"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
