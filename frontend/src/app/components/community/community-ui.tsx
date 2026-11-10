"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Activity,AlertTriangle,CalendarDays,ClipboardCheck,GraduationCap,HeartPulse,MapPin,Megaphone,RotateCw,ShieldAlert,ShoppingBasket,Syringe,Users,type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Default appointment times used for new schedules unless staff customize them. */
export const PROGRAM_TIME_SLOTS = ["08:00", "09:30", "11:00", "13:30"] as const;

export type CommunityRole = "admin" | "sibat" | "farmer" | "auction" | "slaughterhouse" | "cbat";

/** Per-role accent so shared community components match each dashboard's palette. */
export const ROLE_ACCENT: Record<
  CommunityRole,
  { icon: string; text: string; tint: string; badge: string; bar: string }
> = {
  admin: {
    icon: "text-[#2D5A27]",
    text: "text-[#2D5A27]",
    tint: "bg-[#f0f7ee]",
    badge: "text-[#2D5A27] bg-[#f0f7ee] border-[#2D5A27]/20",
    bar: "bg-[#2D5A27]",
  },
  cbat: {
    icon: "text-[#2D5A27]",
    text: "text-[#2D5A27]",
    tint: "bg-[#f0f7ee]",
    badge: "text-[#2D5A27] bg-[#f0f7ee] border-[#2D5A27]/20",
    bar: "bg-[#2D5A27]",
  },
  sibat: {
    icon: "text-[#1A365D]",
    text: "text-[#1A365D]",
    tint: "bg-sky-50",
    badge: "text-[#1A365D] bg-sky-50 border-[#1A365D]/20",
    bar: "bg-[#1A365D]",
  },
  farmer: {
    icon: "text-[#2D5A27]",
    text: "text-[#2D5A27]",
    tint: "bg-[#f0f7ee]",
    badge: "text-[#2D5A27] bg-[#f0f7ee] border-[#2D5A27]/20",
    bar: "bg-[#2D5A27]",
  },
  auction: {
    icon: "text-[#7C3AED]",
    text: "text-[#7C3AED]",
    tint: "bg-purple-50",
    badge: "text-purple-800 bg-purple-50 border-purple-200",
    bar: "bg-[#7C3AED]",
  },
  slaughterhouse: {
    icon: "text-rose-700",
    text: "text-rose-800",
    tint: "bg-rose-50",
    badge: "text-rose-800 bg-rose-50 border-rose-200",
    bar: "bg-rose-600",
  },
};

export const AUDIENCE_LABEL: Record<string, string> = {
  FARMER_AND_SIBAT: "Farmer and CBAT",
  FARMER_ONLY: "Farmer Only",
  SIBAT_ONLY: "CBAT Only",
  ALL: "All Users",
  SIBAT_BARANGAY: "CBAT — Their Barangay Only",
  FARMER: "Farmer Only",
  SIBAT: "CBAT Only",
};

/** Visual tone per activity category so the feed is scannable at a glance. */
export type ActivityCategoryConfig = {
  value: string;
  group: "Health" | "Training" | "Events" | "Advisories";
  icon: LucideIcon;
  badge: string;
  iconClass: string;
};

export const ACTIVITY_CATEGORIES: ActivityCategoryConfig[] = [
  { value: "General", group: "Events", icon: Megaphone, badge: "text-indigo-800 bg-indigo-50 border-indigo-200", iconClass: "text-indigo-600" },
  { value: "Vaccination", group: "Health", icon: Syringe, badge: "text-emerald-800 bg-emerald-50 border-emerald-200", iconClass: "text-emerald-700" },
  { value: "Animal Health", group: "Health", icon: HeartPulse, badge: "text-rose-800 bg-rose-50 border-rose-200", iconClass: "text-rose-600" },
  { value: "Livestock Inspection", group: "Health", icon: ClipboardCheck, badge: "text-sky-800 bg-sky-50 border-sky-200", iconClass: "text-sky-700" },
  { value: "Disease Prevention", group: "Health", icon: ShieldAlert, badge: "text-amber-900 bg-amber-50 border-amber-200", iconClass: "text-amber-700" },
  { value: "Farmer Training", group: "Training", icon: GraduationCap, badge: "text-violet-800 bg-violet-50 border-violet-200", iconClass: "text-violet-700" },
  { value: "Seminar", group: "Training", icon: GraduationCap, badge: "text-violet-800 bg-violet-50 border-violet-200", iconClass: "text-violet-700" },
  { value: "Farmer Meeting", group: "Events", icon: Users, badge: "text-sky-800 bg-sky-50 border-sky-200", iconClass: "text-sky-700" },
  { value: "Livestock Registration", group: "Events", icon: ClipboardCheck, badge: "text-emerald-800 bg-emerald-50 border-emerald-200", iconClass: "text-emerald-700" },
  { value: "Field Visit", group: "Events", icon: MapPin, badge: "text-teal-800 bg-teal-50 border-teal-200", iconClass: "text-teal-700" },
  { value: "Market / Auction", group: "Events", icon: ShoppingBasket, badge: "text-orange-900 bg-orange-50 border-orange-200", iconClass: "text-orange-700" },
  { value: "Livestock Program", group: "Events", icon: CalendarDays, badge: "text-emerald-800 bg-emerald-50 border-emerald-200", iconClass: "text-emerald-700" },
  { value: "Biosecurity Advisory", group: "Advisories", icon: ShieldAlert, badge: "text-amber-900 bg-amber-50 border-amber-200", iconClass: "text-amber-700" },
  { value: "Emergency Notice", group: "Advisories", icon: Activity, badge: "text-rose-900 bg-rose-50 border-rose-200", iconClass: "text-rose-700" },
  { value: "Other", group: "Events", icon: Megaphone, badge: "text-slate-700 bg-slate-100 border-slate-200", iconClass: "text-slate-600" },
  // Retain existing category values so saved announcements remain readable/editable.
  { value: "Health Alert", group: "Health", icon: HeartPulse, badge: "text-rose-800 bg-rose-50 border-rose-200", iconClass: "text-rose-600" },
  { value: "Event", group: "Events", icon: CalendarDays, badge: "text-sky-800 bg-sky-50 border-sky-200", iconClass: "text-sky-700" },
  { value: "Program", group: "Events", icon: CalendarDays, badge: "text-emerald-800 bg-emerald-50 border-emerald-200", iconClass: "text-emerald-700" },
  { value: "Market Update", group: "Events", icon: ShoppingBasket, badge: "text-orange-900 bg-orange-50 border-orange-200", iconClass: "text-orange-700" },
  { value: "Field Memo", group: "Advisories", icon: Megaphone, badge: "text-slate-700 bg-slate-100 border-slate-200", iconClass: "text-slate-600" },
];

export const ACTIVITY_FILTERS = ["All", "Health", "Training", "Events", "Advisories"] as const;

export function activityCategory(category: string): ActivityCategoryConfig {
  const clean = (category || "").trim().toLowerCase();
  return (
    ACTIVITY_CATEGORIES.find(
      (entry) =>
        entry.value.toLowerCase() === clean ||
        entry.group.toLowerCase() === clean
    ) ?? ACTIVITY_CATEGORIES[0]
  );
}

export function categoryMatchesFilter(category: string, filter: string) {
  if (filter === "All") return true;
  const cleanCategory = (category || "").trim().toLowerCase();
  const cleanFilter = filter.trim().toLowerCase();

  if (cleanCategory === cleanFilter) return true;
  if (cleanFilter === "advisories" && (cleanCategory === "advisory" || cleanCategory === "advisories")) return true;
  if (cleanFilter === "events" && (cleanCategory === "event" || cleanCategory === "events")) return true;

  const cat = activityCategory(category);
  return cat.group.toLowerCase() === cleanFilter;
}

export const CATEGORY_TONE = Object.fromEntries(
  ACTIVITY_CATEGORIES.map((entry) => [entry.value, { badge: entry.badge, icon: entry.iconClass }]),
) as Record<string, { badge: string; icon: string }>;

export function categoryTone(category: string) {
  return CATEGORY_TONE[category] ?? CATEGORY_TONE.General;
}
/** "2026-03-14" -> "Sat, 14 Mar 2026" (avoids timezone drift from parsing as UTC). */
export function formatLongDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "2026-03-14" -> "14 Mar 2026" */
export function formatShortDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "08:00:00" | "08:00" -> "8:00 AM" */
export function formatTime(value: string): string {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Show the first and last appointment times configured for one program. */
export function formatTimeWindow(availableTimes: readonly string[] = PROGRAM_TIME_SLOTS): string {
  const times = availableTimes.length ? availableTimes : PROGRAM_TIME_SLOTS;
  const first = times[0];
  const last = times[times.length - 1];
  if (!first || !last) return "—";
  if (first === last) return formatTime(first);
  return `${formatTime(first)} – ${formatTime(last)}`;
}


export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function daysUntil(iso: string): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d).getTime();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((target - start.getTime()) / 86_400_000);
}

export function isUpcoming(iso: string): boolean {
  const diff = daysUntil(iso);
  return diff !== null && diff >= 0;
}

/** Skeleton card grid used while community data loads. */
export function CommunitySkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
      {Array.from({ length: cards }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
        >
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
          <div className="space-y-3 p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <Skeleton className="h-5 w-4/5 rounded" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-2/3 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton table matching the field scheduling table on desktop and cards on mobile. */
export function ProgramScheduleTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Desktop Table Skeleton */}
      <div className="hidden lg:block rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/90 border-b border-slate-200/80 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3.5 pl-4 sm:pl-5 pr-2.5 font-bold">Program Name</th>
                <th className="py-3.5 px-2.5 font-bold whitespace-nowrap">Date</th>
                <th className="py-3.5 px-2.5 font-bold whitespace-nowrap">Time</th>
                <th className="py-3.5 px-2.5 font-bold">Location</th>
                <th className="py-3.5 px-2.5 font-bold whitespace-nowrap">Status</th>
                <th className="py-3.5 px-2.5 font-bold whitespace-nowrap">Registered</th>
                <th className="py-3.5 px-4 text-right font-bold whitespace-nowrap sticky right-0 z-10 bg-slate-50 border-l border-slate-200/80">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: rows }).map((_, index) => (
                <tr key={index} className="hover:bg-slate-50/40">
                  {/* Program Name with Icon */}
                  <td className="py-4 pl-4 sm:pl-5 pr-2.5 align-middle">
                    <div className="flex items-center gap-3 min-w-0 max-w-[200px] xl:max-w-xs">
                      <Skeleton className="size-10 shrink-0 rounded-xl" />
                      <div className="min-w-0 space-y-1.5 flex-1">
                        <Skeleton className={`h-4 rounded ${index % 2 === 0 ? "w-28 sm:w-36" : "w-24 sm:w-28"}`} />
                        <Skeleton className="h-3 w-16 rounded" />
                      </div>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-4 px-2.5 whitespace-nowrap align-middle">
                    <Skeleton className="h-4 w-28 rounded" />
                  </td>

                  {/* Time */}
                  <td className="py-4 px-2.5 whitespace-nowrap align-middle">
                    <Skeleton className="h-4 w-32 rounded" />
                  </td>

                  {/* Location */}
                  <td className="py-4 px-2.5 align-middle max-w-[130px]">
                    <Skeleton className={`h-4 rounded ${index % 2 === 0 ? "w-28" : "w-24"}`} />
                  </td>

                  {/* Status */}
                  <td className="py-4 px-2.5 whitespace-nowrap align-middle">
                    <Skeleton className="h-6 w-28 rounded-full" />
                  </td>

                  {/* Registered */}
                  <td className="py-4 px-2.5 whitespace-nowrap align-middle">
                    <Skeleton className={`h-4 rounded ${index === 0 ? "w-14" : "w-10"}`} />
                  </td>

                  {/* Action */}
                  <td className="py-4 px-4 text-right align-middle whitespace-nowrap sticky right-0 z-10 bg-white border-l border-slate-100">
                    <Skeleton className="h-8 w-18 rounded-lg ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile / Tablet Cards Skeleton */}
      <div className="lg:hidden space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200/90 bg-white p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full shrink-0" />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommunityEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs p-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon}
      </div>
      <h3 className="mt-3.5 text-base sm:text-lg font-black text-slate-900 tracking-tight">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm font-medium text-slate-500 leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function CommunityErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 sm:p-10 text-center">
      <AlertTriangle className="mx-auto size-7 text-red-600" />
      <h3 className="mt-3 text-base sm:text-lg font-black text-red-900 tracking-tight">
        Unable to load this data
      </h3>
      <p className="mt-1.5 text-sm font-medium text-red-700 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white transition-colors hover:bg-red-800 cursor-pointer shadow-xs"
      >
        <RotateCw className="size-4" /> Retry
      </button>
    </div>
  );
}

/** Small outlined status pill, matching the dashboard badge language. */
export function StatusPill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${className}`}
    >
      {children}
    </span>
  );
}

/** Standard section card shell for community panels. */
export function Panel({
  title,
  icon,
  action,
  description,
  children,
  className = "",
}: {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-white p-4 sm:p-5 rounded-xl shadow-2xs border border-slate-200 ${className}`}
    >
      {title ? (
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              {icon}
              {title}
            </h3>
            {description ? (
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
