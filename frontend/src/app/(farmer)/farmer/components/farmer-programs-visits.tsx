"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getSchedules,
  getBookings,
  type ProgramSchedule,
  type ProgramBooking,
} from "@/lib/community-api";
import {
  formatShortDate,
  formatTimeWindow,
  isUpcoming,
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
  const [detailsSchedule, setDetailsSchedule] = useState<ProgramSchedule | null>(null);

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

  const detailsBooking = detailsSchedule
    ? bookings.find(
        (booking) =>
          booking.schedule === detailsSchedule.id && booking.status === "CONFIRMED",
      )
    : undefined;

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
                      <span>{formatTimeWindow(schedule.available_times)}</span>
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
                  {isBooked ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailsSchedule(schedule)}
                      className="w-full h-9 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-emerald-800"
                    >
                      View Details
                      <ArrowRight className="ml-1 size-3" />
                    </Button>
                  ) : (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full h-9 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-emerald-800"
                    >
                      <Link href={`/farmer-scheduling?schedule=${schedule.id}`}>
                        {isFull || isClosed ? "View Schedule" : "Book Program"}
                        <ArrowRight className="ml-1 size-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={detailsSchedule !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsSchedule(null);
        }}
      >
        {detailsSchedule ? (
          <DialogContent className="w-[calc(100%-2rem)] max-h-[88dvh] overflow-y-auto rounded-2xl sm:max-w-lg">
            <DialogHeader className="pr-6 text-left">
              <Badge
                variant="outline"
                className={`w-fit text-[10px] font-semibold uppercase tracking-wider ${getProgramBadge(detailsSchedule.program).badge}`}
              >
                {getProgramBadge(detailsSchedule.program).label}
              </Badge>
              <DialogTitle className="text-xl leading-snug text-slate-900">
                {detailsSchedule.program}
              </DialogTitle>
              <DialogDescription>
                Details for this scheduled program or field visit.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div className="flex items-start gap-2.5">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Date</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">
                      {formatShortDate(detailsSchedule.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock3 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Available time</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">
                      {formatTimeWindow(detailsSchedule.available_times)}
                    </p>
                    {detailsBooking ? (
                      <p className="mt-1 text-xs text-emerald-800">
                        Your booking: {detailsBooking.time}
                      </p>
                    ) : null}
                  </div>
                </div>
                {detailsSchedule.location ? (
                  <div className="flex items-start gap-2.5 sm:col-span-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-rose-600" />
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Location</p>
                      <p className="mt-0.5 break-words text-sm font-medium text-slate-900">
                        {detailsSchedule.location}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Your registration</p>
                  <p className="mt-0.5 text-sm font-medium text-emerald-800">
                    {detailsBooking ? "Confirmed" : detailsSchedule.registration_status}
                  </p>
                </div>
                <Badge className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-800">
                  {detailsSchedule.remaining_slots} slot{detailsSchedule.remaining_slots === 1 ? "" : "s"} left
                </Badge>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-950">Reminder for farmers</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-amber-900">
                  {detailsSchedule.farmer_notes?.trim() || "No additional reminders were provided for this program."}
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setDetailsSchedule(null)}>
                Close
              </Button>
              <Button asChild className="bg-emerald-800 hover:bg-emerald-900">
                <Link href={`/farmer-scheduling?schedule=${detailsSchedule.id}`}>
                  Open scheduling
                  <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
