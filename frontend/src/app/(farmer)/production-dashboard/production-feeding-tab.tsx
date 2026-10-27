"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/axios";
import { formatCalendarDate } from "@/lib/livestock-age";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  DollarSign,
  Layers,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Tag,
  Trash2,
  Users,
  Wheat,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { LivestockInventoryItem } from "../livestock-inventory/page";
import FeedingRegistrationDialog, {
  type BatchItem,
  type FeedingPayload,
} from "./components/feeding-registration-dialog";

export interface FeedingRecordItem {
  id: number;
  livestock: number | null;
  livestock_tag?: string;
  batch: number | null;
  batch_code?: string;
  livestock_type_name?: string;
  feeding_date: string;
  feed_type: "FORAGE" | "SILAGE_HAY" | "CONCENTRATE" | "BYPRODUCTS" | "MINERALS";
  feed_name: string;
  quantity_kg: number | string;
  cost: number | string | null;
  feeding_time: "MORNING" | "AFTERNOON" | "EVENING" | "ALL_DAY";
  notes: string;
  created_at: string;
}

export interface FeedingAnalyticsData {
  total_feed_kg: number;
  total_cost_php: number;
  current_month_feed_kg: number;
  current_month_cost_php: number;
  by_feed_type: Record<
    string,
    {
      label: string;
      quantity_kg: number;
      cost_php: number;
      logs_count: number;
    }
  >;
  daily_trend: Array<{
    date: string;
    quantity_kg: number;
    cost_php: number;
  }>;
}

const FEED_TYPE_LABELS: Record<string, string> = {
  FORAGE: "Fresh Forage & Grass",
  SILAGE_HAY: "Silage & Hay",
  CONCENTRATE: "Concentrate & Mash",
  BYPRODUCTS: "Agricultural Byproducts",
  MINERALS: "Minerals & Supplements",
};

const FEED_TYPE_BADGES: Record<string, string> = {
  FORAGE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  SILAGE_HAY: "bg-lime-100 text-lime-800 border-lime-200",
  CONCENTRATE: "bg-amber-100 text-amber-800 border-amber-200",
  BYPRODUCTS: "bg-orange-100 text-orange-800 border-orange-200",
  MINERALS: "bg-purple-100 text-purple-800 border-purple-200",
};

const FEEDING_TIME_LABELS: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  ALL_DAY: "All Day",
};

interface ProductionFeedingTabProps {
  approvedInventories: LivestockInventoryItem[];
  userBatches?: BatchItem[];
  selectedSpecies?: string | null;
  autoOpen?: boolean;
}

export default function ProductionFeedingTab({
  approvedInventories,
  userBatches = [],
  selectedSpecies,
  autoOpen = false,
}: ProductionFeedingTabProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(autoOpen);
  const [query, setQuery] = useState("");
  const [feedTypeFilter, setFeedTypeFilter] = useState<string>("ALL");

  // 1. Fetch feeding records
  const {
    data: feedingRecords = [],
    isLoading: isRecordsLoading,
    refetch: refetchRecords,
  } = useQuery<FeedingRecordItem[]>({
    queryKey: ["feeding_records"],
    queryFn: async () => {
      const res = await api.get("production/feedings/");
      return res.data;
    },
  });

  // 2. Fetch feeding analytics
  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
    refetch: refetchAnalytics,
  } = useQuery<FeedingAnalyticsData>({
    queryKey: ["feeding_analytics"],
    queryFn: async () => {
      const res = await api.get("production/feedings/analytics/");
      return res.data;
    },
  });

  // 3. Fetch farmer batches if not supplied
  const { data: fetchedBatches = [] } = useQuery<BatchItem[]>({
    queryKey: ["farmer_batches"],
    queryFn: async () => {
      const res = await api.get("livestock/batches/");
      return res.data;
    },
    enabled: userBatches.length === 0,
  });

  const allBatches = userBatches.length > 0 ? userBatches : fetchedBatches;

  // 4. Create Feeding Record Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: FeedingPayload) => {
      const res = await api.post("production/feedings/", payload);
      return res.data;
    },
    onSuccess: (data: FeedingRecordItem) => {
      toast.success(`Feeding recorded: ${data.quantity_kg} kg of ${data.feed_name || FEED_TYPE_LABELS[data.feed_type] || "feed"}`);
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["feeding_records"] });
      queryClient.invalidateQueries({ queryKey: ["feeding_analytics"] });
    },
    onError: (err: unknown) => {
      const resp = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const msg = (resp?.livestock as string[] | undefined)?.[0]
        || (resp?.batch as string[] | undefined)?.[0]
        || (resp?.quantity_kg as string[] | undefined)?.[0]
        || (resp?.detail as string)
        || "Failed to record feeding entry.";
      toast.error(msg);
    },
  });

  // 5. Delete Feeding Record Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`production/feedings/${id}/`);
      return id;
    },
    onSuccess: () => {
      toast.success("Feeding entry removed.");
      queryClient.invalidateQueries({ queryKey: ["feeding_records"] });
      queryClient.invalidateQueries({ queryKey: ["feeding_analytics"] });
    },
    onError: () => {
      toast.error("Failed to delete feeding entry.");
    },
  });

  // Filter records
  const filteredRecords = useMemo(() => {
    return feedingRecords.filter((rec) => {
      if (selectedSpecies && selectedSpecies !== "ALL") {
        const itemSpecies = rec.livestock_type_name?.toLowerCase();
        if (itemSpecies && !itemSpecies.includes(selectedSpecies.toLowerCase())) {
          return false;
        }
      }
      if (feedTypeFilter !== "ALL" && rec.feed_type !== feedTypeFilter) {
        return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        const tagMatch = rec.livestock_tag?.toLowerCase().includes(q);
        const batchMatch = rec.batch_code?.toLowerCase().includes(q);
        const nameMatch = rec.feed_name?.toLowerCase().includes(q);
        const notesMatch = rec.notes?.toLowerCase().includes(q);
        if (!tagMatch && !batchMatch && !nameMatch && !notesMatch) return false;
      }
      return true;
    });
  }, [feedingRecords, selectedSpecies, feedTypeFilter, query]);

  // Determine top feed category
  const topFeedCategory = useMemo(() => {
    if (!analytics?.by_feed_type) return "—";
    let maxKg = 0;
    let topLabel = "—";
    Object.entries(analytics.by_feed_type).forEach(([key, val]) => {
      if (val.quantity_kg > maxKg) {
        maxKg = val.quantity_kg;
        topLabel = FEED_TYPE_LABELS[key] || val.label;
      }
    });
    return topLabel;
  }, [analytics]);

  const handleRefresh = () => {
    refetchRecords();
    refetchAnalytics();
  };

  return (
    <div className="space-y-6">
      {/* ── KPI METRICS CARDS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Feed Provided"
          value={
            isAnalyticsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              `${(analytics?.total_feed_kg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
            )
          }
          icon={<Wheat className="size-4.5" />}
          description="Lifetime recorded rations"
          badge={`${feedingRecords.length} logs`}
        />

        <KpiCard
          title="Monthly Consumption"
          value={
            isAnalyticsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              `${(analytics?.current_month_feed_kg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
            )
          }
          icon={<Calendar className="size-4.5" />}
          description="Feed given this calendar month"
          badge="Current month"
        />

        <KpiCard
          title="Total Feed Cost"
          value={
            isAnalyticsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              `₱${(analytics?.total_cost_php || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            )
          }
          icon={<DollarSign className="size-4.5" />}
          description={`₱${(analytics?.current_month_cost_php || 0).toLocaleString()} spent this month`}
          badge="Lifetime cost"
        />

        <KpiCard
          title="Top Feed Category"
          value={isAnalyticsLoading ? <Skeleton className="h-8 w-28" /> : topFeedCategory}
          icon={<Scale className="size-4.5" />}
          description="Most fed ration type"
          badge="By total weight"
        />
      </div>

      {/* ── FEED CATEGORY BREAKDOWN ───────────────────────────────────────── */}
      {analytics?.by_feed_type && (
        <Card className="rounded-3xl border-slate-200/90 shadow-xs bg-linear-to-br from-amber-50/50 via-white to-slate-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Layers className="size-4 text-amber-600" />
                  <span>Feed Category Distribution</span>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Ration breakdown across pasture forage, silage, concentrates, and supplements
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px] font-bold text-amber-800 bg-amber-50 border-amber-200">
                Ration Analytics
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(analytics.by_feed_type).map(([key, data]) => {
                const total = analytics.total_feed_kg || 1;
                const pct = Math.round((data.quantity_kg / total) * 100);
                return (
                  <div
                    key={key}
                    className="rounded-2xl border border-slate-200/80 bg-white p-3.5 space-y-1.5 shadow-2xs hover:shadow-xs transition-all"
                  >
                    <span className="text-[11px] font-bold text-slate-500 block truncate">
                      {FEED_TYPE_LABELS[key] || data.label}
                    </span>
                    <p className="text-lg font-black text-slate-900">
                      {data.quantity_kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xs font-semibold text-slate-500">kg</span>
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>{pct}% of total</span>
                      {data.cost_php > 0 && (
                        <span className="font-bold text-amber-700">₱{data.cost_php.toLocaleString()}</span>
                      )}
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── FEEDING RECORDS LEDGER ────────────────────────────────────────── */}
      <Card className="rounded-3xl border-slate-200/90 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                <Wheat className="size-4 text-emerald-600" />
                <span>Feeding & Ration Ledger</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Log and monitor individual animal rations or collective herd feeding sessions
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
                <span>Refresh</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setIsDialogOpen(true)}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Log Feeding</span>
              </Button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <Input
                placeholder="Search by animal tag, batch code, or feed name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {["ALL", "FORAGE", "CONCENTRATE", "BYPRODUCTS", "SILAGE_HAY", "MINERALS"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFeedTypeFilter(t)}
                  className={`text-xs px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                    feedTypeFilter === t
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t === "ALL" ? "All Feeds" : FEED_TYPE_LABELS[t] || t}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isRecordsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="size-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Wheat className="size-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No feeding entries found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {query || feedTypeFilter !== "ALL"
                  ? "Try clearing your search or category filters."
                  : "Start logging daily forage, concentrate feeds, or supplemental rations for your animals."}
              </p>
              <Button
                size="sm"
                onClick={() => setIsDialogOpen(true)}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-sm"
              >
                <Plus className="size-3.5" />
                <span>Log First Feeding</span>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRecords.map((item) => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="size-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Wheat className="size-5" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.livestock_tag ? (
                          <span className="font-bold text-slate-900 flex items-center gap-1">
                            <Tag className="size-3 text-emerald-600" />
                            {item.livestock_tag}
                          </span>
                        ) : item.batch_code ? (
                          <span className="font-bold text-slate-900 flex items-center gap-1">
                            <Users className="size-3 text-sky-600" />
                            Batch {item.batch_code}
                          </span>
                        ) : (
                          <span className="font-bold text-slate-900">General Livestock</span>
                        )}

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            FEED_TYPE_BADGES[item.feed_type] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {FEED_TYPE_LABELS[item.feed_type] || item.feed_type}
                        </span>

                        <span className="text-[10px] text-slate-400">
                          {FEEDING_TIME_LABELS[item.feeding_time] || item.feeding_time}
                        </span>
                      </div>

                      <p className="text-slate-700 font-medium truncate">
                        {item.feed_name ? (
                          <>
                            <span className="font-bold text-slate-900">{item.feed_name}</span>
                            {" — "}
                          </>
                        ) : null}
                        <strong className="text-slate-900">{item.quantity_kg} kg</strong> feed provided
                        {item.cost && Number(item.cost) > 0 ? (
                          <span className="text-amber-700 font-semibold ml-2">
                            (₱{Number(item.cost).toFixed(2)})
                          </span>
                        ) : null}
                      </p>

                      {item.notes && (
                        <p className="text-[11px] text-slate-500 italic max-w-xl truncate">
                          &ldquo;{item.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      <Calendar className="size-3 text-slate-400" />
                      {formatCalendarDate(item.feeding_date)}
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                      className="size-8 p-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Delete feeding entry"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── LOG FEEDING REGISTRATION MODAL ─────────────────────────────────── */}
      <FeedingRegistrationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        inventories={approvedInventories}
        batches={allBatches}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}
