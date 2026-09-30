"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, Megaphone, RotateCw, Search } from "lucide-react";
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
  formatTimeWindow,
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
        // icon={<Megaphone className="size-5 text-slate-800" />}
        variant={role}
        maxWidthClass="w-full"
        action={
          <Button type="button" variant="outline" onClick={() => void refresh()} aria-label="Refresh activities" title="Refresh activities" className="size-10 shrink-0 rounded-xl border-slate-200 bg-white/80 p-0 text-slate-700">
            <RotateCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <main className="w-full space-y-4 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1 sm:pb-0" role="group" aria-label="Filter activities by type">
            {ACTIVITY_FILTERS.map((name) => (
              <Button key={name} type="button" size="sm" variant={filter === name ? "default" : "outline"} onClick={() => setFilter(name)} aria-pressed={filter === name} className={`shrink-0 rounded-full px-3.5 ${filter === name ? "bg-emerald-800 text-white hover:bg-emerald-900" : "bg-slate-50 text-slate-600"}`}>
                {name}
              </Button>
            ))}
          </div>
          <label className="relative block w-full sm:max-w-xs sm:shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search activities" aria-label="Search activities" className="h-10 pl-9 text-sm" />
          </label>
        </div>

        {loading ? <CommunitySkeleton /> : error && items.length === 0 ? <CommunityErrorCard message={error} onRetry={() => void refresh()} /> : visible.length === 0 ? (
          <CommunityEmptyState icon={<Megaphone className="size-5" />} title={search || filter !== "All" ? "No activities found" : "No activities yet"} description={search || filter !== "All" ? "Try another category or clear your search." : "Official programs, advisories, and announcements from the MAO will appear here."} action={<Button type="button" variant="outline" size="sm" onClick={() => void refresh()}><RotateCw className="mr-2 size-3.5" />Refresh activities</Button>} />
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {visible.map((item) => {
              const category = activityCategory(item.category);
              const CategoryIcon = category.icon;
              const displayDate = item.schedule?.date || item.published_at || item.created_at;
              const photos = [...(item.image ? [item.image] : []), ...item.photos.map((photo) => photo.image)];
              return (
                <Card
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-emerald-500/40 ${item.is_pinned ? "border-amber-200" : "border-slate-200"}`}
                >
                  <div className="group relative aspect-video w-full overflow-hidden bg-slate-100">
                    <ActivityPhotoCarousel photos={photos} alt={item.title} />
                    {item.is_pinned ? <Badge className="absolute right-3 top-3 z-20 border border-amber-200 bg-white/95 text-[10px] font-medium text-amber-900 shadow-sm backdrop-blur-sm">Pinned</Badge> : null}
                  </div>
                  <CardContent className="flex flex-1 flex-col gap-1.5 p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`inline-flex min-w-0 gap-1.5 text-[10px] font-medium uppercase tracking-wide ${category.badge}`}><CategoryIcon className={`size-3.5 shrink-0 ${category.iconClass}`} />{item.category}</Badge>
                    </div>
                    <h3 className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-emerald-800">
                      <button type="button" className="text-left">{item.title}</button>
                    </h3>
                    <span className="text-xs text-slate-500">{item.schedule ? null : formatShortDate(displayDate)}</span>
                    <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-600">{item.content}</p>
                    {item.schedule ? (
                      <div className="mt-1 space-y-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600">
                        {item.schedule.program ? <p className="truncate text-[11px] font-semibold text-slate-700">{item.schedule.program}</p> : null}
                        <p className="flex items-center gap-1.5"><CalendarDays className="size-3.5 shrink-0 text-emerald-600" />{formatShortDate(item.schedule.date)} · {formatTimeWindow()}</p>
                        {item.schedule.location ? <p className="flex items-start gap-1.5"><MapPin className="mt-px size-3.5 shrink-0 text-rose-500" /><span className="line-clamp-2">{item.schedule.location}</span></p> : null}
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