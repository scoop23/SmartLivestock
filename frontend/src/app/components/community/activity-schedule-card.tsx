"use client";

import {
AlertDialog,
AlertDialogAction,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProgramSchedule } from "@/lib/community-api";
import { CalendarDays,ClipboardList,Clock,MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { CommunityRole } from "./community-ui";
import { formatLongDate,formatTimeWindow } from "./community-ui";

export function ActivityScheduleCard({
  schedule,
  role,
}: {
  schedule: ProgramSchedule;
  role: CommunityRole;
}) {
  const [expiredDialogOpen, setExpiredDialogOpen] = useState(false);
  const isExpired =
    schedule.deleted_at != null || schedule.registration_status === "COMPLETED" || schedule.registration_status === "CANCELLED";
  const statusLabel = {
    AVAILABLE: "Registration open",
    FULL: "Fully booked",
    CLOSED: "Registration closed",
    NOT_OPEN: "Registration opens soon",
    COMPLETED: "Program completed",
    CANCELLED: "Program cancelled",
  }[schedule.registration_status];
  const canViewSchedule =
    role === "farmer"
      ? ["AVAILABLE", "FULL", "CLOSED", "NOT_OPEN"].includes(schedule.registration_status)
      : role === "sibat" || role === "admin";
  const href = role === "farmer"
    ? `/farmer-scheduling?schedule=${schedule.id}`
    : role === "sibat"
      ? "/sibat-scheduling"
      : "/schedules";

  return (
    <section aria-label="Program details" className="space-y-4 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">Program Details</p>
          <h4 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">{schedule.program}</h4>
        </div>
        <Badge
          variant="outline"
          className={`text-xs sm:text-sm font-bold px-3 py-1 ${
            schedule.registration_status === "AVAILABLE"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : schedule.registration_status === "FULL"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : schedule.registration_status === "CANCELLED"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {statusLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-2.5 text-sm text-slate-700 sm:grid-cols-2 sm:gap-x-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-emerald-700" />
          <span className="font-medium">{formatLongDate(schedule.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-4 shrink-0 text-emerald-700" />
          <span className="font-semibold text-slate-800">{formatTimeWindow(schedule.available_times)}</span>
        </div>
        {schedule.location ? (
          <div className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-rose-500" />
            <span className="truncate font-medium text-slate-700">{schedule.location}</span>
          </div>
        ) : null}
        {schedule.capacity > 0 ? (
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span className="font-bold text-slate-800">{schedule.booking_count}</span> booked
            <span className="text-slate-300">·</span>
            <span className="font-bold text-emerald-700">{Math.max(0, schedule.capacity - schedule.booking_count)}</span> slots available
          </div>
        ) : null}
      </div>

      {role === "farmer" && schedule.farmer_notes ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
          <ClipboardList className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <div><p className="font-bold">Reminder for farmers</p><p className="mt-0.5 whitespace-pre-wrap">{schedule.farmer_notes}</p></div>
        </div>
      ) : null}

      {role === "auction" ? (
        <div className="pt-1.5 flex items-center gap-2 text-xs font-semibold text-purple-700 bg-purple-50/80 px-3 py-2 rounded-xl border border-purple-200">
          <span>
            {isExpired ? "Program expired · " : ""}
            Municipal program bulletin · Informational operational notice for auction personnel
          </span>
        </div>
      ) : isExpired ? (
        <div className="pt-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setExpiredDialogOpen(true)}
            className="h-10 w-full rounded-xl border-slate-300 px-5 text-sm font-bold text-slate-700 sm:w-auto"
          >
            Program Expired
          </Button>
          <AlertDialog open={expiredDialogOpen} onOpenChange={setExpiredDialogOpen}>
            <AlertDialogContent className="z-[var(--z-critical)]">
              <AlertDialogHeader>
                <AlertDialogTitle>{schedule.registration_status === "CANCELLED" ? "Program cancelled" : "Program no longer available"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {schedule.registration_status === "CANCELLED"
                    ? `This announcement remains available for reference, but its linked program on ${formatLongDate(schedule.date)} was cancelled.`
                    : `This announcement remains available for reference, but its linked program on ${formatLongDate(schedule.date)} has already passed${schedule.deleted_at ? " and was removed from the program list" : ""}. New bookings are no longer available.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setExpiredDialogOpen(false)}>
                  Got it
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : canViewSchedule ? (
        <div className="pt-1.5">
          <Button asChild size="sm" className="h-10 w-full sm:w-auto rounded-xl bg-emerald-800 px-5 text-sm font-bold text-white transition hover:bg-emerald-900">
            <Link href={href}>{role === "farmer" && schedule.registration_status === "AVAILABLE" ? "Book a Slot" : "View Schedule"}</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
