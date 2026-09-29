"use client";

import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
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
export const CATEGORY_TONE: Record<
  string,
  { badge: string; icon: string }
> = {
  "Health Alert": {
    badge: "text-rose-800 bg-rose-50 border-rose-200",
    icon: "text-rose-600",
  },
  Event: { badge: "text-sky-800 bg-sky-50 border-sky-200", icon: "text-sky-600" },
  Program: {
    badge: "text-emerald-800 bg-emerald-50 border-emerald-200",
    icon: "text-emerald-600",
  },
  "Market Update": {
    badge: "text-amber-800 bg-amber-50 border-amber-200",
    icon: "text-amber-600",
  },
  "Field Memo": {
    badge: "text-slate-700 bg-slate-100 border-slate-200",
    icon: "text-slate-500",
  },
  General: {
    badge: "text-indigo-800 bg-indigo-50 border-indigo-200",
    icon: "text-indigo-500",
  },
};

export function categoryTone(category: string) {
  return (
    CATEGORY_TONE[category] ?? {
      badge: "text-slate-700 bg-slate-100 border-slate-200",
      icon: "text-slate-500",
    }
  );
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
export function CommunitySkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-3/4 rounded" />
          <Skeleton className="mt-2 h-3 w-full rounded" />
          <Skeleton className="mt-1.5 h-3 w-2/3 rounded" />
          <Skeleton className="mt-4 h-3 w-24 rounded" />
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
