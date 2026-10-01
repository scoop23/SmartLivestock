"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, Megaphone, Pin, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, apiError, getActivities } from "@/lib/community-api";
import {
  ACTIVITY_FILTERS,
  activityCategory,
  categoryMatchesFilter,
  CommunityEmptyState,
  CommunityErrorCard,
  CommunitySkeleton,
  CommunityRole,
  formatShortDate,
} from "./community-ui";
import { ActivityDetailDialog } from "./activity-detail-dialog";
import { ActivityPhotoCarousel } from "./activity-photo-carousel";

export function ActivitiesFeed({ role }: { role: CommunityRole }) {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Activity | null>(null);

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
    // The async request updates loading state when it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const term = search.toLowerCase().trim();
  const visible = useMemo(() => items
    .filter((item) => categoryMatchesFilter(item.category, filter))
    .filter((item) => !term || [item.title, item.content, item.category, item.author, item.schedule?.program ?? "", item.schedule?.location ?? ""].some((value) => value.toLowerCase().includes(term)))
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime();
    }), [items, filter, term]);

  return (
    <>
      <PageHeader
        title="Activities & Announcements"
        subtitle="Official livestock programs, advisories, events, and announcements from the Municipal Agriculture Office."
        variant={role}
        maxWidthClass="w-full"
        action={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void refresh()}
            disabled={isFetching}
            className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
            title="Refresh activities"
            aria-label="Refresh activities"
          >
            <RefreshCw className={`size-5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <main className="w-full space-y-4 p-3 sm:p-4 md:p-6">
        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-3">
          <div className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1 sm:pb-0" role="group" aria-label="Filter activities by type">
            {ACTIVITY_FILTERS.map((name) => (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={filter === name ? "default" : "outline"}
                onClick={() => setFilter(name)}
                aria-pressed={filter === name}
                className={`h-8 shrink-0 rounded-full px-3 text-xs font-medium ${
                  filter === name
                    ? "bg-emerald-800 text-white hover:bg-emerald-900"
                    : "border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {name}
              </Button>
            ))}
          </div>

          <label className="relative block w-full sm:max-w-xs sm:shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activities…"
              aria-label="Search activities"
              className="h-8.5 rounded-lg pl-8 text-xs"
            />
          </label>
        </div>

        {/* Content Section */}
        {loading ? (
          <CommunitySkeleton cards={4} />
        ) : error && items.length === 0 ? (
          <CommunityErrorCard message={error} onRetry={() => void refresh()} />
        ) : visible.length === 0 ? (
          <CommunityEmptyState
            icon={<Megaphone className="size-5" />}
            title={search || filter !== "All" ? "No activities found" : "No activities yet"}
            description={
              search || filter !== "All"
                ? "Try another category or clear your search."
                : "Official programs, advisories, and announcements from the MAO will appear here."
            }
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
                <RefreshCw className="mr-2 size-3.5" />Refresh activities
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
            {visible.map((item) => {
              const category = activityCategory(item.category);
              const CategoryIcon = category.icon;
              const displayDate = item.schedule?.date || item.published_at || item.created_at;
              const photos = [...(item.image ? [item.image] : []), ...item.photos.map((photo) => photo.image)];

              return (
                <Card
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-emerald-500/40 ${
                    item.is_pinned ? "border-amber-300/80" : "border-slate-200"
                  }`}
                >
                  {/* Image Container with Consistent Aspect Ratio */}
                  <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-slate-100">
                    <ActivityPhotoCarousel photos={photos} alt={item.title} />
                    {item.is_pinned ? (
                      <Badge className="absolute right-3 top-3 z-20 border-amber-300 bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-950 shadow-xs">
                        <Pin className="mr-1 size-2.5" /> Pinned
                      </Badge>
                    ) : null}
                  </div>

                  {/* Compact News-Card Content */}
                  <CardContent className="flex flex-1 flex-col p-4 sm:p-4.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={`inline-flex min-w-0 gap-1 text-[10px] font-medium uppercase tracking-wider ${category.badge}`}
                      >
                        <CategoryIcon className={`size-3 shrink-0 ${category.iconClass}`} />
                        {item.category}
                      </Badge>
                      <span className="text-[11px] text-slate-400">
                        {formatShortDate(displayDate)}
                      </span>
                    </div>

                    <h3 className="mt-2 line-clamp-2 text-sm sm:text-base font-semibold leading-snug text-slate-900 transition-colors group-hover:text-emerald-800">
                      {item.title}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-xs sm:text-[13px] leading-relaxed text-slate-600">
                      {item.content}
                    </p>

                    {item.schedule ? (
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                          <CalendarDays className="size-3 text-emerald-700" />
                          {formatShortDate(item.schedule.date)}
                        </span>
                        {item.schedule.location ? (
                          <span className="inline-flex items-center gap-1 truncate text-slate-500">
                            <MapPin className="size-3 text-rose-500" />
                            {item.schedule.location}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <ActivityDetailDialog activity={selected} role={role} open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }} />
    </>
  );
}