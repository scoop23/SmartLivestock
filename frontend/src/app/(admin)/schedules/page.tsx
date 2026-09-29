"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  Clock3,
  Lock,
  RotateCw,
  Unlock,
  Users,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  PROGRAM_TIME_SLOTS,
  CommunityEmptyState,
  Panel,
  ROLE_ACCENT,
  StatusPill,
  formatLongDate,
  formatTime,
  todayIso,
} from "@/app/components/community/community-ui";

const PROGRAMS = [
  "Vaccination",
  "Deworming",
  "Agricultural Assistance",
  "Milking Supervision",
];

export default function AdminSchedulesPage() {
  const accent = ROLE_ACCENT.admin;
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [bookings, setBookings] = useState<ProgramBooking[]>([]);
  const [date, setDate] = useState("");
  const [program, setProgram] = useState(PROGRAMS[0]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [dates, reservations] = await Promise.all([
        getSchedules(),
        getBookings(),
      ]);
      setSchedules(dates);
      setBookings(reservations);
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

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/community/schedules/", { date, program });
      setDate("");
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(schedule: ProgramSchedule) {
    setBusy(true);
    setError("");
    try {
      await api.patch(
        "/community/schedules/" + schedule.id + "/",
        { is_open: !schedule.is_open }
      );
      await refresh();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const confirmedBySchedule = useMemo(() => {
    const map = new Map<number, ProgramBooking[]>();
    bookings
      .filter((booking) => booking.status === "CONFIRMED")
      .forEach((booking) => {
        map.set(booking.schedule, [...(map.get(booking.schedule) ?? []), booking]);
      });
    return map;
  }, [bookings]);

  const openCount = schedules.filter((schedule) => schedule.is_open).length;
  const confirmedCount = bookings.filter(
    (booking) => booking.status === "CONFIRMED"
  ).length;
  const fullyBooked = schedules.filter(
    (schedule) => schedule.booked_times.length >= PROGRAM_TIME_SLOTS.length
  ).length;

  return (
    <>
      <PageHeader
        title="Farmer Schedules"
        subtitle="Open MAO program dates and monitor farmer bookings"
        icon={<CalendarDays className="size-5 text-slate-800" />}
        variant="admin"
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
        {/* Open a new program date */}
        <Panel
          title="Open a Program Date"
          icon={<CalendarPlus className={`w-3.5 h-3.5 ${accent.icon}`} />}
          description="Farmers can immediately book an offered time slot once the date is open."
        >
          <form
            onSubmit={create}
            className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div>
              <label
                htmlFor="schedule-date"
                className="text-[11px] font-black uppercase tracking-wider text-slate-500"
              >
                Date
              </label>
              <Input
                id="schedule-date"
                required
                type="date"
                min={todayIso()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1.5 h-9 text-xs"
              />
            </div>
            <div>
              <label
                htmlFor="schedule-program"
                className="text-[11px] font-black uppercase tracking-wider text-slate-500"
              >
                Program
              </label>
              <select
                id="schedule-program"
                value={program}
                onChange={(event) => setProgram(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-400"
              >
                {PROGRAMS.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="h-9 gap-1.5 rounded-xl bg-[#2D5A27] px-4 text-xs font-bold text-white hover:bg-[#24461f] cursor-pointer"
            >
              <CalendarPlus className="size-4" /> Open date
            </Button>
          </form>
        </Panel>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-bold text-red-800"
          >
            {error}
          </div>
        ) : null}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <KpiCard
            title="Program dates"
            value={schedules.length}
            icon={<CalendarDays className="w-4 h-4" />}
            description="All scheduled"
            variant="emerald"
            size="sm"
            isLoading={loading}
          />
          <KpiCard
            title="Open for booking"
            value={openCount}
            icon={<Unlock className="w-4 h-4" />}
            description="Accepting farmers"
            variant="sky"
            size="sm"
            isLoading={loading}
          />
          <KpiCard
            title="Confirmed bookings"
            value={confirmedCount}
            icon={<Users className="w-4 h-4" />}
            description="Across all dates"
            variant="orange"
            size="sm"
            isLoading={loading}
          />
          <KpiCard
            title="Fully booked"
            value={fullyBooked}
            icon={<Clock3 className="w-4 h-4" />}
            description={`${PROGRAM_TIME_SLOTS.length} slots filled`}
            variant="amber"
            size="sm"
            isLoading={loading}
          />
        </div>

        {loading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 rounded bg-slate-100" />
                  <div className="h-4 w-14 rounded-full bg-slate-100" />
                </div>
                <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {Array.from({ length: 4 }).map((__, cell) => (
                    <div key={cell} className="h-8 rounded-lg bg-slate-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <CommunityEmptyState
            icon={<CalendarDays className="size-5" />}
            title="No program dates yet"
            description="Open a date above and farmers will be able to reserve a time slot for that program."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {schedules
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((schedule) => {
                const confirmed = confirmedBySchedule.get(schedule.id) ?? [];
                const taken = new Set(schedule.booked_times);
                const filled = schedule.booked_times.length;

                return (
                  <article
                    key={schedule.id}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-all hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-slate-900">
                          {schedule.program}
                        </h3>
                        <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                          <CalendarDays className="size-3" />
                          {formatLongDate(schedule.date)}
                        </p>
                      </div>
                      <StatusPill
                        className={
                          schedule.is_open
                            ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                            : "text-slate-600 bg-slate-100 border-slate-200"
                        }
                      >
                        {schedule.is_open ? "Open" : "Closed"}
                      </StatusPill>
                    </div>

                    {/* Slot occupancy grid */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <span>Time slots</span>
                        <span>
                          {filled} / {PROGRAM_TIME_SLOTS.length} booked
                        </span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {PROGRAM_TIME_SLOTS.map((slot) => {
                          const isTaken = taken.has(slot);
                          return (
                            <div
                              key={slot}
                              className={`rounded-lg border px-2 py-1.5 text-center text-[10px] font-black ${
                                isTaken
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : "border-slate-200 bg-slate-50 text-slate-500"
                              }`}
                            >
                              {formatTime(slot)}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Confirmed roster */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Confirmed farmers
                      </p>
                      {confirmed.length === 0 ? (
                        <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                          No bookings yet.
                        </p>
                      ) : (
                        <ul className="mt-1.5 space-y-1">
                          {confirmed
                            .slice()
                            .sort((a, b) => a.time.localeCompare(b.time))
                            .map((booking) => (
                              <li
                                key={booking.id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
                              >
                                <span className="truncate text-[11px] font-bold text-slate-700">
                                  {booking.farmer_name}
                                </span>
                                <span className="shrink-0 text-[10px] font-black text-slate-500">
                                  {formatTime(booking.time)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={busy}
                        onClick={() => toggle(schedule)}
                        className="h-7 gap-1 rounded-lg px-2 text-[11px] font-bold cursor-pointer"
                      >
                        {schedule.is_open ? (
                          <>
                            <Lock className="size-3" /> Close booking
                          </>
                        ) : (
                          <>
                            <Unlock className="size-3" /> Reopen booking
                          </>
                        )}
                      </Button>
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </main>
    </>
  );
}
