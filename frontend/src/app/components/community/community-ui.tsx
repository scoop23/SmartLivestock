"use client";

import type { ReactNode } from "react";
import { Activity, AlertTriangle, CalendarDays, ClipboardCheck, GraduationCap, HeartPulse, Megaphone, MapPin, RotateCw, ShieldAlert, ShoppingBasket, Syringe, Users, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/** Time slots the backend accepts for a program booking (users/community_views.py TIMES). */
export const PROGRAM_TIME_SLOTS = ["08:00", "09:30", "11:00", "13:30"] as const;

export type CommunityRole = "admin" | "sibat" | "farmer";

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
};

export const AUDIENCE_LABEL: Record<string, string> = {
  ALL: "Farmers & SIBAT",
  FARMER: "Farmers",
  SIBAT: "SIBAT",
};

/** Visual tone per activity category so the feed is scannable at a glance. */
export type ActivityCategoryConfig = {
  value: string;
  group: "Programs" | "Health" | "Training" | "Events" | "Advisories";
  icon: LucideIcon;
  badge: string;
  iconClass: string;
};

export const ACTIVITY_CATEGORIES: ActivityCategoryConfig[] = [
  { value: "General", group: "Events", icon: Megaphone, badge: "text-indigo-800 bg-indigo-50 border-indigo-200", iconClass: "text-indigo-600" },
  { value: "Vaccination", group: "Programs", icon: Syringe, badge: "text-emerald-800 bg-emerald-50 border-emerald-200", iconClass: "text-emerald-700" },
  { value: "Animal Health", group: "Health", icon: HeartPulse, badge: "text-rose-800 bg-rose-50 border-rose-200", iconClass: "text-rose-600" },
  { value: "Livestock Inspection", group: "Health", icon: ClipboardCheck, badge: "text-sky-800 bg-sky-50 border-sky-200", iconClass: "text-sky-700" },
  { value: "Disease Prevention", group: "Health", icon: ShieldAlert, badge: "text-amber-900 bg-amber-50 border-amber-200", iconClass: "text-amber-700" },
  { value: "Farmer Training", group: "Training", icon: GraduationCap, badge: "text-violet-800 bg-violet-50 border-violet-200", iconClass: "text-violet-700" },
  { value: "Seminar", group: "Training", icon: GraduationCap, badge: "text-violet-800 bg-violet-50 border-violet-200", iconClass: "text-violet-700" },
  { value: "Farmer Meeting", group: "Events", icon: Users, badge: "text-sky-800 bg-sky-50 border-sky-200", iconClass: "text-sky-700" },
  { value: "Livestock Registration", group: "Programs", icon: ClipboardCheck, badge: "text-emerald-800 bg-emerald-50 border-emerald-200", iconClass: "text-emerald-700" },
  { value: "Field Visit", group: "Programs", icon: MapPin, badge: "text-teal-800 bg-teal-50 border-teal-200", iconClass: "text-teal-700" },
  { value: "Market / Auction", group: "Events", icon: ShoppingBasket, badge: "text-orange-900 bg-orange-50 border-orange-200", iconClass: "text-orange-700" },
  { value: "Livestock Program", group: "Programs", icon: CalendarDays, badge: "text-emerald-800 bg-emerald-50 border-emerald-200", iconClass: "text-emerald-700" },
  { value: "Biosecurity Advisory", group: "Advisories", icon: ShieldAlert, badge: "text-amber-900 bg-amber-50 border-amber-200", iconClass: "text-amber-700" },
  { value: "Emergency Notice", group: "Advisories", icon: Activity, badge: "text-rose-900 bg-rose-50 border-rose-200", iconClass: "text-rose-700" },
  { value: "Other", group: "Events", icon: Megaphone, badge: "text-slate-700 bg-slate-100 border-slate-200", iconClass: "text-slate-600" },
  // Retain existing category values so saved announcements remain readable/editable.
  { value: "Health Alert", group: "Health", icon: HeartPulse, badge: "text-rose-800 bg-rose-50 border-rose-200", iconClass: "text-rose-600" },
  { value: "Event", group: "Events", icon: CalendarDays, badge: "text-sky-800 bg-sky-50 border-sky-200", iconClass: "text-sky-700" },
  { value: "Program", group: "Programs", icon: CalendarDays, badge: "text-emerald-800 bg-emerald-50 border-emerald-200", iconClass: "text-emerald-700" },
  { value: "Market Update", group: "Events", icon: ShoppingBasket, badge: "text-orange-900 bg-orange-50 border-orange-200", iconClass: "text-orange-700" },
  { value: "Field Memo", group: "Advisories", icon: Megaphone, badge: "text-slate-700 bg-slate-100 border-slate-200", iconClass: "text-slate-600" },
];

export const ACTIVITY_FILTERS = ["All", "Programs", "Health", "Training", "Events", "Advisories"] as const;

export function activityCategory(category: string) {
  return ACTIVITY_CATEGORIES.find((entry) => entry.value === category) ?? ACTIVITY_CATEGORIES[0];
}

export function categoryMatchesFilter(category: string, filter: string) {
  return filter === "All" || activityCategory(category).group === filter;
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

/** A program has no single time, it spans every bookable slot, so show first -> last. */
export function formatTimeWindow(): string {
  const first = PROGRAM_TIME_SLOTS[0];
  const last = PROGRAM_TIME_SLOTS[PROGRAM_TIME_SLOTS.length - 1];
  if (!first || !last) return "—";
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
    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs p-12 text-center">
      <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-black text-slate-800">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-xs font-medium text-slate-500">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
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
    <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
      <AlertTriangle className="mx-auto size-6 text-red-600" />
      <h3 className="mt-2 text-sm font-black text-red-800">
        Unable to load this data
      </h3>
      <p className="mt-1 text-xs font-medium text-red-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-red-700 px-4 text-xs font-bold text-white transition-colors hover:bg-red-800 cursor-pointer"
      >
        <RotateCw className="size-3.5" /> Retry
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
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${className}`}
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
      className={`bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200 ${className}`}
    >
      {title ? (
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <h3 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              {icon}
              {title}
            </h3>
            {description ? (
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
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
