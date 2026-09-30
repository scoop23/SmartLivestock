"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  RotateCw,
  X,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
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

export default function FarmerSchedulingPage() {
  const accent = ROLE_ACCENT.farmer;
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [bookings, setBookings] = useState<ProgramBooking[]>([]);
  const [scheduleId, setScheduleId] = useState("");
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

  const selected = schedules.find((s) => s.id === Number(scheduleId));
  const availableTimes = useMemo(
    () =>
      PROGRAM_TIME_SLOTS.filter(
        (slot) => !selected?.booked_times.includes(slot)
      ),
    [selected]
  );

  async function book() {
    if (!scheduleId || !time) return;
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
        title="Field Scheduling"
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
        <Panel
          title="Book a Program"
          icon={<CalendarPlus className={`w-3.5 h-3.5 ${accent.icon}`} />}
          description="Pick an open date, then choose one of the remaining time slots."
        >
          {loading ? (
            <CommunitySkeleton />
          ) : schedules.length === 0 ? (
            <CommunityEmptyState
              icon={<CalendarDays className="size-5" />}
              title="No open program dates"
              description="The Municipal Agriculture Office has not opened any booking dates yet. Check back later."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label
                  htmlFor="book-schedule"
                  className="text-[11px] font-black uppercase tracking-wider text-slate-500"
                >
                  Available program
                </label>
                <select
                  id="book-schedule"
                  value={scheduleId}
                  onChange={(event) => {
                    setScheduleId(event.target.value);
                    setTime("");
                  }}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value="">Choose a program and date</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.program} — {formatLongDate(s.date)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="book-time"
                  className="text-[11px] font-black uppercase tracking-wider text-slate-500"
                >
                  Time
                </label>
                {selected ? (
                  <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {PROGRAM_TIME_SLOTS.map((slot) => {
                      const taken = selected.booked_times.includes(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={taken}
                          onClick={() => setTime(slot)}
                          className={`rounded-lg border px-2 py-2 text-[11px] font-black transition-colors ${
                            taken
                              ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 line-through"
                              : time === slot
                                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50"
                          }`}
                        >
                          {formatTime(slot)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-medium text-slate-500">
                    <Info className="size-3.5 shrink-0" /> Select a program first to
                    see its time slots.
                  </p>
                )}
              </div>

              <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-2.5 pt-3.5 border-t border-slate-100">
                <p className="text-[10px] font-medium text-slate-500">
                  {selected
                    ? availableTimes.length + " of " + PROGRAM_TIME_SLOTS.length + " slots still available"
                    : "Bookings are free and can be cancelled while the visit is still upcoming."}
                </p>
                <Button
                  type="button"
                  onClick={book}
                  disabled={busy || !scheduleId || !time || availableTimes.length === 0}
                  className="h-9 gap-1.5 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CalendarCheck className="size-4" />
                  )}
                  Confirm booking
                </Button>
              </div>
            </div>
          )}
        </Panel>

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
