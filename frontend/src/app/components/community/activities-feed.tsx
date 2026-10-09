"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Megaphone,
  Pin,
  RefreshCw,
  Search,
  Sparkles,
  ShieldAlert,
  X,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
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
      // The authenticated community API returns announcements visible to this role;
      // category and text filtering happens locally after retrieval.
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

  const term = search.toLowerCase().trim();

  // Category counts across all announcements
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: items.length };
    ACTIVITY_FILTERS.forEach((filterName) => {
      if (filterName !== "All") {
        counts[filterName] = items.filter((item) =>
          categoryMatchesFilter(item.category, filterName)
        ).length;
      }
    });
    return counts;
  }, [items]);

  // Overall KPI stats for the farmer
  const fieldProgramsCount = useMemo(
    () => items.filter((item) => Boolean(item.schedule)).length,
    [items]
  );
  const healthAlertsCount = useMemo(
    () =>
      items.filter((item) => {
        const cat = activityCategory(item.category);
        return cat.group === "Health" || cat.group === "Advisories";
      }).length,
    [items]
  );

  // Visible filtered & searched items
  const visible = useMemo(
    () =>
      items
        .filter((item) => categoryMatchesFilter(item.category, filter))
        .filter(
          (item) =>
            !term ||
            [
              item.title,
              item.content,
              item.category,
              item.author,
              item.schedule?.program ?? "",
              item.schedule?.location ?? "",
            ].some((value) => value.toLowerCase().includes(term))
        )
        .sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return (
            new Date(b.published_at || b.created_at).getTime() -
            new Date(a.published_at || a.created_at).getTime()
          );
        }),
    [items, filter, term]
  );

  // Featured pinned spotlight (only shown on 'All' tab with no active search)
  const featuredItem = useMemo(() => {
    if (filter !== "All" || term) return null;
    return visible.find((item) => item.is_pinned) ?? null;
  }, [filter, term, visible]);

  // Items remaining for the standard 2-column grid
  const gridItems = useMemo(() => {
    if (!featuredItem) return visible;
    return visible.filter((item) => item.id !== featuredItem.id);
  }, [visible, featuredItem]);

  const isAuction = role === "auction";

  const headerTitle =
    isAuction
      ? "Auction Announcements & Bulletins"
      : role === "sibat"
      ? "Field Operations & Community Advisories"
      : role === "admin"
      ? "Municipal Activities & Announcements"
      : "Municipal Activities & Advisories";

  const headerSubtitle =
    isAuction
      ? "Official livestock market schedules, biosecurity advisories, municipal notices, and program bulletins for Padre Garcia auction inspectors."
      : "Official livestock programs, vaccination advisories, agricultural seminars, and announcements from Padre Garcia Municipal Agriculture Office.";

  return (
    <>
      <PageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
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
        {/* Quick Highlights / KPIs */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
          <KpiCard
            title={isAuction ? "Total Bulletins" : "Total Announcements"}
            value={items.length}
            icon={<Megaphone className="size-4" />}
            description="Official bulletins & notices"
            variant={isAuction ? "sky" : "emerald"}
            size="sm"
            isLoading={loading}
          />
          <KpiCard
            title={isAuction ? "Related Programs" : "Field Programs & Visits"}
            value={fieldProgramsCount}
            icon={<CalendarDays className="size-4" />}
            description={isAuction ? "Municipal programs & schedules" : "Programs with booking slots"}
            variant="sky"
            size="sm"
            isLoading={loading}
          />
          <KpiCard
            title="Health & Biosecurity"
            value={healthAlertsCount}
            icon={<ShieldAlert className="size-4" />}
            description="Disease & prevention advisories"
            variant="amber"
            size="sm"
            isLoading={loading}
          />
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-3">
          {/* Category Filter Pills with Badges */}
          <div
            className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1 sm:pb-0"
            role="group"
            aria-label="Filter activities by category"
          >
            {ACTIVITY_FILTERS.map((name) => {
              const count = categoryCounts[name] ?? 0;
              const isActive = filter === name;
              const activeClass = isAuction
                ? "bg-[#7C3AED] text-white hover:bg-[#6D28D9] shadow-xs"
                : "bg-emerald-800 text-white hover:bg-emerald-900 shadow-xs";
              return (
                <Button
                  key={name}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setFilter(name)}
                  aria-pressed={isActive}
                  className={`h-9 shrink-0 gap-2 rounded-full px-3.5 text-xs sm:text-sm font-bold transition-all ${
                    isActive
                      ? activeClass
                      : "border-slate-200 bg-slate-50/80 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span>{name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-black ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-200/80 text-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:max-w-xs sm:shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search bulletins, programs…"
              aria-label="Search activities"
              className="h-9 sm:h-10 rounded-xl pl-9 pr-8 text-sm font-medium"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Content Feed */}
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
                ? "Try selecting another category or clearing your search term."
                : "Official programs, advisories, and announcements from the MAO will appear here."
            }
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilter("All");
                  setSearch("");
                  void refresh();
                }}
                className="h-9 rounded-xl px-4 text-xs sm:text-sm font-bold"
              >
                <RefreshCw className="mr-2 size-3.5" /> Reset filters
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {/* Featured Advisory Spotlight */}
            {featuredItem ? (() => {
              const featuredCategory = activityCategory(featuredItem.category);
              const FeaturedIcon = featuredCategory.icon;
              const featuredDate =
                featuredItem.schedule?.date ||
                featuredItem.published_at ||
                featuredItem.created_at;
              const featuredPhotos = [
                ...(featuredItem.image ? [featuredItem.image] : []),
                ...featuredItem.photos.map((p) => p.image),
              ];

              return (
                <div
                  onClick={() => setSelected(featuredItem)}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-500/10 via-amber-50/30 to-white p-4 sm:p-6 shadow-xs transition-all hover:border-amber-400 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    {/* Media */}
                    <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 md:w-72 lg:w-84">
                      <ActivityPhotoCarousel
                        photos={featuredPhotos}
                        alt={featuredItem.title}
                      />
                      <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-950 shadow-xs">
                        <Pin className="size-3" /> Pinned Advisory
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col justify-between space-y-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`gap-1.5 px-2.5 py-1 text-xs font-black uppercase tracking-wider ${featuredCategory.badge}`}
                          >
                            <FeaturedIcon className={`size-3.5 shrink-0 ${featuredCategory.iconClass}`} />
                            {featuredItem.category}
                          </Badge>
                          <span className="text-xs sm:text-sm font-semibold text-slate-500">
                            {formatShortDate(featuredDate)}
                          </span>
                        </div>

                        <h2 className="mt-2 text-lg sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-snug transition-colors group-hover:text-emerald-800">
                          {featuredItem.title}
                        </h2>

                        <p className="mt-1.5 line-clamp-2 text-sm sm:text-base leading-relaxed text-slate-600">
                          {featuredItem.content}
                        </p>
                      </div>

                      {featuredItem.schedule ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/80 bg-white/80 p-2.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm text-slate-700">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 font-bold text-emerald-800">
                              <CalendarDays className="size-4 text-emerald-700" />
                              {formatShortDate(featuredItem.schedule.date)}
                            </span>
                            {featuredItem.schedule.location ? (
                              <span className="flex items-center gap-1.5 font-medium text-slate-600 truncate max-w-[200px]">
                                <MapPin className="size-4 text-rose-500" />
                                {featuredItem.schedule.location}
                              </span>
                            ) : null}
                          </div>
                          {!isAuction ? (
                            <Link
                              href={`/farmer-scheduling?schedule=${featuredItem.schedule.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 font-black text-emerald-800 hover:text-emerald-950 text-xs sm:text-sm"
                            >
                              <span>Book slot</span>
                              <ArrowRight className="size-3.5" />
                            </Link>
                          ) : (
                            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                              Related Municipal Program
                            </span>
                          )}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between pt-1 text-xs sm:text-sm">
                        <span className="font-medium text-slate-500">
                          Issued by {featuredItem.author || "MAO Padre Garcia"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 font-bold group-hover:translate-x-0.5 transition-transform ${
                            isAuction ? "text-[#7C3AED]" : "text-emerald-800"
                          }`}
                        >
                          <span>Read full advisory</span>
                          <ArrowRight className="size-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : null}

            {/* Standard 2-Column Grid */}
            {gridItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                {gridItems.map((item) => {
                  const category = activityCategory(item.category);
                  const CategoryIcon = category.icon;
                  const displayDate =
                    item.schedule?.date || item.published_at || item.created_at;
                  const photos = [
                    ...(item.image ? [item.image] : []),
                    ...item.photos.map((photo) => photo.image),
                  ];

                  return (
                    <Card
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className={`group flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 ${
                        isAuction ? "focus-within:ring-purple-500/40 hover:border-purple-300" : "focus-within:ring-emerald-500/40 hover:border-emerald-300"
                      } ${
                        item.is_pinned ? "border-amber-300/80" : "border-slate-200"
                      }`}
                    >
                      {/* Image Container with Consistent Aspect Ratio */}
                      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-slate-100">
                        <ActivityPhotoCarousel photos={photos} alt={item.title} />
                        {item.is_pinned ? (
                          <Badge className="absolute right-3 top-3 z-20 border-amber-300 bg-amber-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-950 shadow-xs">
                            <Pin className="mr-1 size-2.5" /> Pinned
                          </Badge>
                        ) : null}
                      </div>

                      {/* News-Card Content */}
                      <CardContent className="flex flex-1 flex-col justify-between p-4.5 sm:p-5">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <Badge
                              variant="outline"
                              className={`inline-flex min-w-0 gap-1.5 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${category.badge}`}
                            >
                              <CategoryIcon className={`size-3.5 shrink-0 ${category.iconClass}`} />
                              {item.category}
                            </Badge>
                            <span className="text-xs sm:text-sm font-semibold text-slate-500">
                              {formatShortDate(displayDate)}
                            </span>
                          </div>

                          <h3
                            className={`line-clamp-2 text-base sm:text-lg font-black leading-snug tracking-tight text-slate-900 transition-colors ${
                              isAuction ? "group-hover:text-[#7C3AED]" : "group-hover:text-emerald-800"
                            }`}
                          >
                            {item.title}
                          </h3>

                          <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
                            {item.content}
                          </p>

                          {item.schedule ? (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 sm:px-3 text-xs sm:text-sm text-slate-600">
                              <div className="flex items-center gap-2.5">
                                <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                                  <CalendarDays className="size-3.5 text-emerald-700" />
                                  {formatShortDate(item.schedule.date)}
                                </span>
                                {item.schedule.location ? (
                                  <span className="inline-flex items-center gap-1 truncate font-medium text-slate-600 max-w-[140px]">
                                    <MapPin className="size-3.5 text-rose-500" />
                                    {item.schedule.location}
                                  </span>
                                ) : null}
                              </div>

                              {!isAuction ? (
                                <Link
                                  href={`/farmer-scheduling?schedule=${item.schedule.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-bold text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline"
                                >
                                  Book slot →
                                </Link>
                              ) : (
                                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                                  Related Program
                                </span>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {/* Card Footer */}
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs sm:text-sm">
                          <span className="max-w-[150px] truncate font-medium text-slate-500">
                            By {item.author || "MAO Padre Garcia"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 font-bold ${
                              isAuction ? "text-[#7C3AED] group-hover:text-[#6D28D9]" : "text-emerald-800 group-hover:text-emerald-900"
                            }`}
                          >
                            <span>Read advisory</span>
                            <ArrowRight className="size-3.5" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </main>

      <ActivityDetailDialog
        activity={selected}
        role={role}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
