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
    <section aria-label="Program details" className="space-y-3 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-900">Program details</p>
          <h4 className="mt-1 text-sm font-medium text-slate-800">{schedule.program}</h4>
        </div>
        <Badge variant="outline" className={`text-[10px] font-medium ${schedule.registration_status === "AVAILABLE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : schedule.registration_status === "FULL" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-600"}`}>
          {statusLabel}
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-slate-600 sm:flex-row sm:flex-wrap sm:gap-x-5">
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 text-emerald-600" />{formatLongDate(schedule.date)}</span>
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700"><Clock className="size-3.5 text-emerald-600" />{formatTimeWindow()}</span>
        {schedule.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-rose-500" />{schedule.location}</span> : null}
        {schedule.capacity > 0 ? <span>{schedule.booking_count} booked · {Math.max(0, schedule.capacity - schedule.booking_count)} slots remaining</span> : null}
      </div>

      {canViewSchedule ? (
        <Button asChild size="sm" className="h-9 rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800">
          <Link href={href}>{role === "farmer" && schedule.registration_status === "AVAILABLE" ? "Book a Slot" : "View Schedule"}</Link>
        </Button>
      ) : null}
    </section>
  );
}