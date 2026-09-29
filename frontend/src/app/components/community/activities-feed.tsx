"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Megaphone, Pin, RotateCw, Search, Users } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Input } from "@/components/ui/input";
import { Activity, apiError, getActivities } from "@/lib/community-api";
import {
  AUDIENCE_LABEL,
  CommunityEmptyState,
  CommunityErrorCard,
  CommunitySkeleton,
  Panel,
  ROLE_ACCENT,
  StatusPill,
  categoryTone,
  formatShortDate,
  type CommunityRole,
} from "./community-ui";

export function ActivitiesFeed({ role }: { role: CommunityRole }) {
  const accent = ROLE_ACCENT[role];
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await getActivities());
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

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(items.map((item) => item.category)))],
    [items]
  );

  const term = search.toLowerCase().trim();
  // The backend already restricts farmers to published, audience-matching
  // announcements, so this only filters and orders what it returns.
  const visible = items
    .filter((item) => category === "All" || item.category === category)
    .filter(
      (item) =>
        !term ||
        [item.title, item.content, item.category].some((value) =>
          value.toLowerCase().includes(term)
        )
    )
    .sort((a, b) => {
      // Pinned notices first, then newest published/created activity.
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return (
        new Date(b.published_at || b.created_at).getTime() -
        new Date(a.published_at || a.created_at).getTime()
      );
    });

  const pinned = visible.find((item) => item.is_pinned);
  const rest = pinned ? visible.filter((item) => item.id !== pinned.id) : visible;

  return (
    <>
      <PageHeader
        title="Activities"
        subtitle="Municipal Agriculture Office updates for farmers"
        icon={<Megaphone className="size-5 text-slate-800" />}
        variant={role}
        maxWidthClass="w-full"
        action={
          <button
            type="button"
            onClick={() => refresh()}
            title="Refresh activities"
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer ${accent.tint} ${accent.text} hover:opacity-80`}
          >
            <RotateCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <main className="p-3 sm:p-4 md:p-5 w-full space-y-3.5">
        {/* Filter toolbar */}
        <div className="flex flex-col gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black transition-colors cursor-pointer ${
                  category === name
                    ? `${accent.badge} border`
                    : "text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <label className="relative block w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activities"
              aria-label="Search activities"
              className="h-9 pl-9 text-xs"
            />
          </label>
        </div>

        {loading ? (
          <CommunitySkeleton />
        ) : error ? (
          <CommunityErrorCard message={error} onRetry={refresh} />
        ) : visible.length === 0 ? (
          <CommunityEmptyState
            icon={<Megaphone className="size-5" />}
            title={
              search || category !== "All"
                ? "No matching activities"
                : "No activities yet"
            }
            description={
              search || category !== "All"
                ? "Try a different keyword or clear the category filter."
                : "Municipal announcements, health alerts and program invites from the MAO will appear here."
            }
          />
        ) : (
          <>
            {/* Pinned notice gets a featured treatment */}
            {pinned ? (
              <Panel
                title="Pinned Notice"
                icon={<Pin className={`w-3.5 h-3.5 ${accent.icon}`} />}
                action={
                  <StatusPill className={accent.badge}>{pinned.category}</StatusPill>
                }
                className="border-l-4 border-l-[#2D5A27]"
              >
                <h4 className="text-sm font-black text-slate-900">{pinned.title}</h4>
                <p className="mt-1.5 whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-600">
                  {pinned.content}
                </p>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3" />
                    {AUDIENCE_LABEL[pinned.audience]}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3" />
                    {formatShortDate(pinned.published_at || pinned.created_at)}
                  </span>
                </div>
              </Panel>
            ) : null}

            {rest.length > 0 ? (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {rest.map((item) => {
                  const tone = categoryTone(item.category);
                  return (
                    <article
                      key={item.id}
                      className="flex flex-col bg-white p-3.5 rounded-xl shadow-2xs border border-slate-200 transition-all hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StatusPill className={tone.badge}>{item.category}</StatusPill>
                        <span className="text-[10px] font-medium text-slate-400">
                          {formatShortDate(item.published_at || item.created_at)}
                        </span>
                      </div>

                      <h3 className="mt-2.5 text-sm font-black text-slate-900 leading-snug">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-4 flex-1 whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-600">
                        {item.content}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                        <span className="truncate">By {item.author}</span>
                        <span className="shrink-0">
                          {AUDIENCE_LABEL[item.audience]}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
