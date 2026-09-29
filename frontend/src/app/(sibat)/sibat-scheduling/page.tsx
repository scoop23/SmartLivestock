"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, RotateCw, Users } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
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
  formatLongDate,
  formatTime,
} from "@/app/components/community/community-ui";

export default function SibatSchedulingPage() {
  const accent = ROLE_ACCENT.sibat;
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [bookings, setBookings] = useState<ProgramBooking[]>([]);
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
  const totalFarmers = new Set(
    bookings
      .filter((booking) => booking.status === "CONFIRMED")
      .map((booking) => booking.farmer_name)
  ).size;

  return (
    <>
      <PageHeader
        title="Field Scheduling"
        subtitle="MAO programs and farmer reservations for your monitoring area"
        icon={<CalendarDays className="size-5 text-slate-800" />}
        variant="sibat"
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
        {error && !loading ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-bold text-red-800"
          >
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <KpiCard
            title="Program dates"
            value={schedules.length}
            icon={<CalendarDays className="w-4 h-4" />}
            description="Scheduled by MAO"
            variant="emerald"
            size="sm"
            isLoading={loading}
          />
          <KpiCard
            title="Confirmed bookings"
            value={confirmedCount}
            icon={<Users className="w-4 h-4" />}
            description="Reserved slots"
            variant="sky"
            size="sm"
            isLoading={loading}
          />
          <KpiCard
            title="Farmers involved"
            value={totalFarmers}
            icon={<Clock3 className="w-4 h-4" />}
            description={`${openCount} dates still open`}
            variant="orange"
            size="sm"
            isLoading={loading}
          />
        </div>

        {loading ? (
          <CommunitySkeleton />
        ) : error && schedules.length === 0 ? (
          <CommunityErrorCard message={error} onRetry={refresh} />
        ) : schedules.length === 0 ? (
          <CommunityEmptyState
            icon={<CalendarDays className="size-5" />}
            title="No upcoming programs"
            description="The MAO has not opened any program dates yet. Resolved bookings will appear here once farmers reserve a slot."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {schedules
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((schedule) => {
                const confirmed = (
                  confirmedBySchedule.get(schedule.id) ?? []
                )
                  .slice()
                  .sort((a, b) => a.time.localeCompare(b.time));
                const taken = new Set(schedule.booked_times);

                return (
                  <Panel
                    key={schedule.id}
                    title={schedule.program}
                    icon={<CalendarDays className={`w-3.5 h-3.5 ${accent.icon}`} />}
                    description={formatLongDate(schedule.date)}
                    action={
                      <StatusPill
                        className={
                          schedule.is_open
                            ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                            : "text-slate-600 bg-slate-100 border-slate-200"
                        }
                      >
                        {schedule.is_open ? "Open" : "Closed"}
                      </StatusPill>
                    }
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {PROGRAM_TIME_SLOTS.map((slot) => (
                        <div
                          key={slot}
                          className={`rounded-lg border px-2 py-1.5 text-center text-[10px] font-black ${
                            taken.has(slot)
                              ? "border-sky-200 bg-sky-50 text-sky-800"
                              : "border-slate-200 bg-slate-50 text-slate-400"
                          }`}
                        >
                          {formatTime(slot)}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Confirmed farmers
                      </p>
                      {confirmed.length === 0 ? (
                        <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                          No farmer bookings yet.
                        </p>
                      ) : (
                        <ul className="mt-1.5 space-y-1">
                          {confirmed.map((booking) => (
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
                  </Panel>
                );
              })}
          </div>
        )}
      </main>
    </>
  );
}
