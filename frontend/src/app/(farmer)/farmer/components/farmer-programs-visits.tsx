"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getSchedules,
  getBookings,
  type ProgramSchedule,
  type ProgramBooking,
} from "@/lib/community-api";
import {
  formatShortDate,
  formatTime,
  isUpcoming,
  PROGRAM_TIME_SLOTS,
} from "@/app/components/community/community-ui";

function getProgramBadge(title: string): { label: string; badge: string } {
  const lower = title.toLowerCase();
  if (lower.includes("vaccin")) {
    return { label: "VACCINATION", badge: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  }
  if (lower.includes("inspect") || lower.includes("visit")) {
    return { label: "FIELD VISIT", badge: "border-sky-200 bg-sky-50 text-sky-800" };
  }
  if (lower.includes("train") || lower.includes("seminar")) {
    return { label: "TRAINING", badge: "border-violet-200 bg-violet-50 text-violet-800" };
  }
  if (lower.includes("health") || lower.includes("deworm")) {
    return { label: "ANIMAL HEALTH", badge: "border-rose-200 bg-rose-50 text-rose-800" };
  }
  return { label: "PROGRAM", badge: "border-emerald-200 bg-emerald-50 text-emerald-800" };
}

export default function FarmerProgramsVisits() {
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [bookings, setBookings] = useState<ProgramBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [schedulesResult, bookingsResult] = await Promise.allSettled([
          getSchedules(),
          getBookings(),
        ]);
        if (active) {
          if (schedulesResult.status === "fulfilled") {
            setSchedules(schedulesResult.value);
          }
          if (bookingsResult.status === "fulfilled") {
            setBookings(bookingsResult.value);
          }
        }
      } catch {
        // Keep empty if load fails
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const confirmedBookingIds = new Set(
    bookings.filter((b) => b.status === "CONFIRMED").map((b) => b.schedule)
  );

  // Filter for upcoming programs or open programs, sorted by date ascending
  const upcomingSchedules = schedules
    .filter((s) => isUpcoming(s.date) || s.is_open)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  return (
    <section aria-label="Upcoming Programs and Visits" className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm sm:text-base font-bold tracking-tight text-slate-900">
            <CalendarDays className="size-4 text-[#2D5A27]" />
            <span>Programs & Visits</span>
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Upcoming municipal programs and scheduled field visits
          </p>
        </div>

        <Link
          href="/farmer-scheduling"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-900 transition-colors"
        >
          <span>View all</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-xs"
            >
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
              <Skeleton className="mt-2 h-7 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : upcomingSchedules.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-xs">
          <CalendarDays className="mx-auto size-5 text-slate-400" />
          <h4 className="mt-1.5 text-xs font-bold text-slate-800">Programs & Visits</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            No upcoming programs or visits right now. Check back later for new activities.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {upcomingSchedules.map((schedule) => {
            const isBooked = confirmedBookingIds.has(schedule.id);
            const isFull = schedule.registration_status === "FULL" || schedule.remaining_slots === 0;
            const isClosed = !schedule.is_open || schedule.registration_status === "CLOSED";
            const categoryBadge = getProgramBadge(schedule.program);

            return (
              <div
                key={schedule.id}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-semibold uppercase tracking-wider ${categoryBadge.badge}`}
                    >
                      {categoryBadge.label}
                    </Badge>

                    {isBooked ? (
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 text-[9px] font-semibold">
                        Booked
                      </Badge>
                    ) : null}
                  </div>

                  <h4 className="text-xs sm:text-[13px] font-bold leading-snug text-slate-900 group-hover:text-emerald-800 transition-colors whitespace-normal break-words">
                    {schedule.program}
                  </h4>

                  <div className="space-y-1 text-[11px] text-slate-500">
                    <p className="flex items-center gap-1 font-medium text-slate-700">
                      <CalendarDays className="size-3 text-emerald-700 shrink-0" />
                      <span>{formatShortDate(schedule.date)}</span>
                      <span className="text-slate-300">·</span>
                      <Clock3 className="size-3 text-slate-400 shrink-0" />
                      <span>{formatTime(PROGRAM_TIME_SLOTS[0])}</span>
                    </p>

                    {schedule.location ? (
                      <p className="flex items-center gap-1 text-slate-600 truncate">
                        <MapPin className="size-3 text-rose-500 shrink-0" />
                        <span className="truncate">{schedule.location}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="pt-0.5 text-[11px]">
                    {isBooked ? (
                      <span className="text-emerald-700 font-medium">Your visit is confirmed</span>
                    ) : isFull ? (
                      <span className="text-amber-800 font-semibold">Fully booked</span>
                    ) : isClosed ? (
                      <span className="text-slate-400">Closed</span>
                    ) : (
                      <span className="text-slate-600">
                        <strong className="text-emerald-700 font-semibold">{schedule.remaining_slots}</strong> slots remaining
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full h-7.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-emerald-800"
                  >
                    <Link href={`/farmer-scheduling?schedule=${schedule.id}`}>
                      {isBooked ? "View Details" : isFull || isClosed ? "View Schedule" : "Book Program"}
                      <ArrowRight className="ml-1 size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
