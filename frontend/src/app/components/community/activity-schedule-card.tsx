import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CommunityRole } from "./community-ui";
import { formatLongDate, formatTimeWindow } from "./community-ui";
import type { ProgramSchedule } from "@/lib/community-api";

export function ActivityScheduleCard({
  schedule,
  role,
}: {
  schedule: ProgramSchedule;
  role: CommunityRole;
}) {
  const statusLabel = {
    AVAILABLE: "Registration open",
    FULL: "Fully booked",
    CLOSED: "Registration closed",
    COMPLETED: "Program completed",
  }[schedule.registration_status];
  const canViewSchedule = role === "farmer"
    ? schedule.registration_status === "AVAILABLE" || schedule.registration_status === "FULL"
    : true;
  const href = role === "farmer"
    ? `/farmer-scheduling?schedule=${schedule.id}`
    : role === "sibat"
      ? "/sibat-scheduling"
      : "/schedules";

  return (
    <section aria-label="Program details" className="space-y-3.5 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Program Details</p>
          <h4 className="text-base font-semibold text-slate-900">{schedule.program}</h4>
        </div>
        <Badge
          variant="outline"
          className={`text-[11px] font-medium ${
            schedule.registration_status === "AVAILABLE"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : schedule.registration_status === "FULL"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {statusLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2 sm:gap-x-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-emerald-700" />
          <span>{formatLongDate(schedule.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-4 shrink-0 text-emerald-700" />
          <span>{formatTimeWindow()}</span>
        </div>
        {schedule.location ? (
          <div className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-rose-500" />
            <span className="truncate">{schedule.location}</span>
          </div>
        ) : null}
        {schedule.capacity > 0 ? (
          <div className="flex items-center gap-2 text-slate-500">
            <span className="font-medium text-slate-700">{schedule.booking_count}</span> booked
            <span className="text-slate-300">·</span>
            <span className="font-medium text-emerald-700">{Math.max(0, schedule.capacity - schedule.booking_count)}</span> slots available
          </div>
        ) : null}
      </div>

      {canViewSchedule ? (
        <div className="pt-1">
          <Button asChild size="sm" className="h-9 rounded-lg bg-emerald-800 px-4 text-xs font-semibold text-white transition hover:bg-emerald-900">
            <Link href={href}>{role === "farmer" && schedule.registration_status === "AVAILABLE" ? "Book a Slot" : "View Schedule"}</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}