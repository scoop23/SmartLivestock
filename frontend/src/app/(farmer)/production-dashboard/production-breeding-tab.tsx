"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Dna,
  HeartHandshake,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ValidationPagination } from "@/app/(admin)/data-validation/components/validation-pagination";
import type { LivestockInventoryItem } from "../livestock-inventory/page";
import BreedingRegistrationDialog, { type BreedingPayload } from "./components/breeding-registration-dialog";

export interface BreedingRecordItem {
  id: number;
  dam: number;
  dam_tag?: string;
  dam_breed?: string;
  livestock_type_name?: string;
  farmer_name?: string;
  breeding_date: string;
  breeding_type: "ARTIFICIAL_INSEMINATION" | "NATURAL" | "EMBRYO_TRANSFER";
  sire_tag_or_code: string;
  sire_breed: string;
  technician_or_inseminator: string;
  gestation_days: number;
  expected_due_date?: string;
  days_until_due?: number | null;
  gestation_progress_pct?: number;
  status: "PENDING_CHECK" | "PREGNANT" | "CALVED" | "OPEN";
  notes: string;
  created_at: string;
}

export interface ConceptionAnalytics {
  total_eligible_events: number;
  events_with_known_outcomes: number;
  confirmed_conceptions: number;
  known_unsuccessful_outcomes: number;
  pending_outcomes_excluded: number;
  observed_conception_rate_pct: number | null;
  rate_status: "SUFFICIENT" | "INSUFFICIENT_DATA" | "LOW_SAMPLE_SIZE";
  status_message: string;
  formula_explanation: string;
}

export interface PredictionReadiness {
  status: "ACTIVE" | "BLOCKED_PENDING_DATA";
  is_ready: boolean;
  prediction_state: string;
  verdict: string;
  total_recorded_breeding_events: number;
  events_with_known_outcomes: number;
  minimum_required_for_model: number;
  is_data_sufficient: boolean;
  rationale: string;
  guidance: string;
}

export interface BreedingAnalyticsData {
  total_records: number;
  active_gestations: number;
  due_soon: number;
  calved_count: number;
  confirmed_conceptions_count?: number;
  open_count: number;
  conception_rate_pct: number | null;
  conception_rate_status?: string;
  conception_rate_message?: string;
  conception_analytics?: ConceptionAnalytics;
  prediction_readiness?: PredictionReadiness;
  by_type: {
    artificial_insemination: number;
    natural_service: number;
    embryo_transfer: number;
  };
}

interface ProductionBreedingTabProps {
  approvedInventories: LivestockInventoryItem[];
  selectedSpecies?: string | null;
  autoOpen?: boolean;
}

const statusBadgeClasses: Record<BreedingRecordItem["status"], string> = {
  PREGNANT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PENDING_CHECK: "bg-amber-100 text-amber-800 border-amber-200",
  CALVED: "bg-sky-100 text-sky-800 border-sky-200",
  OPEN: "bg-rose-100 text-rose-800 border-rose-200",
};

const statusLabels: Record<BreedingRecordItem["status"], string> = {
  PENDING_CHECK: "Exposed",
  PREGNANT: "Pregnant — Confirmed",
  CALVED: "Complete",
  OPEN: "Open / Failed",
};

export default function ProductionBreedingTab({
  approvedInventories,
  selectedSpecies,
  autoOpen = false,
}: ProductionBreedingTabProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(autoOpen);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | BreedingRecordItem["status"]>("ALL");

  // Filter chips horizontal scroll management
  const filterContainerRef = useRef<HTMLDivElement>(null);
  const filterTrackRef = useRef<HTMLDivElement>(null);
  const isFilterDraggingRef = useRef(false);
  const filterDragStartRef = useRef({ startX: 0, startScrollLeft: 0 });
  const [filterScrollInfo, setFilterScrollInfo] = useState({
    canScroll: false,
    thumbWidthPct: 100,
    thumbLeftPct: 0,
  });

  const updateFilterScrollMetrics = useCallback(() => {
    const el = filterContainerRef.current;
    if (!el) return;

    const { scrollWidth, clientWidth, scrollLeft } = el;
    const canScroll = scrollWidth > clientWidth + 2;

    if (!canScroll) {
      setFilterScrollInfo({
        canScroll: false,
        thumbWidthPct: 100,
        thumbLeftPct: 0,
      });
      return;
    }

    const thumbWidthPct = Math.max(12, Math.min(100, (clientWidth / scrollWidth) * 100));
    const maxScrollLeft = scrollWidth - clientWidth;
    const scrollRatio = maxScrollLeft > 0 ? scrollLeft / maxScrollLeft : 0;
    const thumbLeftPct = scrollRatio * (100 - thumbWidthPct);

    setFilterScrollInfo({
      canScroll: true,
      thumbWidthPct,
      thumbLeftPct,
    });
  }, []);

  useEffect(() => {
    const el = filterContainerRef.current;
    if (!el) return;

    const rafId = requestAnimationFrame(() => {
      updateFilterScrollMetrics();
    });

    const ro = new ResizeObserver(() => {
      updateFilterScrollMetrics();
    });
    ro.observe(el);
    Array.from(el.children).forEach((child) => ro.observe(child));

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [updateFilterScrollMetrics]);

  const handleFilterThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = filterContainerRef.current;
    if (!el) return;

    isFilterDraggingRef.current = true;
    filterDragStartRef.current = {
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleFilterThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isFilterDraggingRef.current) return;
    const el = filterContainerRef.current;
    const track = filterTrackRef.current;
    if (!el || !track) return;

    const deltaX = e.clientX - filterDragStartRef.current.startX;
    const trackWidth = track.clientWidth;
    const thumbWidthPx = (filterScrollInfo.thumbWidthPct / 100) * trackWidth;
    const scrollableTrack = trackWidth - thumbWidthPx;
    const scrollableTabs = el.scrollWidth - el.clientWidth;

    if (scrollableTrack > 0 && scrollableTabs > 0) {
      const scrollDelta = (deltaX / scrollableTrack) * scrollableTabs;
      el.scrollLeft = filterDragStartRef.current.startScrollLeft + scrollDelta;
    }
  };

  const handleFilterThumbPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isFilterDraggingRef.current) {
      isFilterDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleFilterTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isFilterDraggingRef.current) return;
    const el = filterContainerRef.current;
    const track = filterTrackRef.current;
    if (!el || !track || !filterScrollInfo.canScroll) return;

    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const trackWidth = rect.width;
    const thumbWidthPx = (filterScrollInfo.thumbWidthPct / 100) * trackWidth;
    const scrollableTrack = trackWidth - thumbWidthPx;
    const scrollableTabs = el.scrollWidth - el.clientWidth;

    if (scrollableTrack > 0 && scrollableTabs > 0) {
      const targetRatio = Math.max(0, Math.min(1, (clickX - thumbWidthPx / 2) / scrollableTrack));
      el.scrollTo({ left: targetRatio * scrollableTabs, behavior: "smooth" });
    }
  };

  const handleFilterWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = filterContainerRef.current;
    if (!el || !filterScrollInfo.canScroll) return;

    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += e.deltaY;
    }
  };

  // Pregnancy confirmation modal state
  const [confirmPregnancyRecord, setConfirmPregnancyRecord] = useState<BreedingRecordItem | null>(null);
  const [confirmationDate, setConfirmationDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [confirmationMethod, setConfirmationMethod] = useState("Transrectal Palpation");
  const [confirmationNotes, setConfirmationNotes] = useState("");

  const confirmPregnancyMutation = useMutation({
    mutationFn: async ({ id, date, method, notes }: { id: number; date: string; method: string; notes: string }) => {
      const res = await api.post(`production/breeding/${id}/confirm-pregnancy/`, {
        confirmation_date: date,
        confirmation_method: method,
        notes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Pregnancy confirmed and recorded in official registry!");
      setConfirmPregnancyRecord(null);
      setConfirmationNotes("");
      queryClient.invalidateQueries({ queryKey: ["breeding_records"] });
      queryClient.invalidateQueries({ queryKey: ["breeding_analytics"] });
    },
    onError: (err: unknown) => {
      const httpErr = err as { response?: { data?: { error?: string } } };
      const msg = httpErr?.response?.data?.error || "Failed to confirm pregnancy.";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    },
  });

  // Fetch breeding records
  const {
    data: breedingRecords = [],
    isLoading: isRecordsLoading,
    refetch,
    isRefetching,
  } = useQuery<BreedingRecordItem[]>({
    queryKey: ["breeding_records"],
    queryFn: async () => {
      const res = await api.get("production/breeding/");
      return res.data;
    },
  });

  // Fetch breeding analytics
  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery<BreedingAnalyticsData>({
    queryKey: ["breeding_analytics"],
    queryFn: async () => {
      const res = await api.get("production/breeding/analytics/");
      return res.data;
    },
  });

  // Active female livestock eligible for breeding
  const femaleLivestock = useMemo(() => {
    return approvedInventories.filter((i) => {
      const sex = (i.sex || "").toUpperCase();
      const isFemale = sex.startsWith("F") || sex === "FEMALE" || i.entryType === "BATCH";
      const matchesSpecies =
        !selectedSpecies ||
        selectedSpecies === "ALL" ||
        i.livestockTypeName?.toLowerCase() === selectedSpecies.toLowerCase();
      return isFemale && matchesSpecies;
    });
  }, [approvedInventories, selectedSpecies]);

  // Only individual, approved male animals of the selected livestock type can
  // be linked as a registered sire. Batch records do not identify one bull.
  const maleLivestock = useMemo(() => approvedInventories.filter((item) => {
    const sex = (item.sex || "").trim().toUpperCase();
    const isMale = sex.startsWith("M") || sex === "MALE";
    const matchesSpecies = !selectedSpecies || selectedSpecies === "ALL"
      || item.livestockTypeName?.toLowerCase() === selectedSpecies.toLowerCase();
    return isMale && item.entryType === "INDIVIDUAL" && matchesSpecies;
  }), [approvedInventories, selectedSpecies]);

  // Create breeding mutation
  const createMutation = useMutation({
    mutationFn: async (payload: BreedingPayload) => {
      const res = await api.post("production/breeding/", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Breeding & insemination record saved successfully!");
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["breeding_records"] });
      queryClient.invalidateQueries({ queryKey: ["breeding_analytics"] });
    },
    onError: (err: unknown) => {
      const httpErr = err as { response?: { data?: { dam?: string; breeding_date?: string } } };
      const message = httpErr?.response?.data?.dam || httpErr?.response?.data?.breeding_date || "Failed to record breeding event.";
      toast.error(typeof message === "string" ? message : JSON.stringify(message));
    },
  });

  // Update status mutation (e.g. from PENDING_CHECK to PREGNANT or CALVED)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: BreedingRecordItem["status"] }) => {
      const res = await api.patch(`production/breeding/${id}/`, { status });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Breeding status updated!");
      queryClient.invalidateQueries({ queryKey: ["breeding_records"] });
      queryClient.invalidateQueries({ queryKey: ["breeding_analytics"] });
    },
    onError: () => {
      toast.error("Failed to update status.");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`production/breeding/${id}/`);
    },
    onSuccess: () => {
      toast.success("Breeding record deleted.");
      queryClient.invalidateQueries({ queryKey: ["breeding_records"] });
      queryClient.invalidateQueries({ queryKey: ["breeding_analytics"] });
    },
    onError: () => {
      toast.error("Failed to delete record.");
    },
  });

  // Filtered records
  const filteredRecords = useMemo(() => {
    return breedingRecords.filter((rec) => {
      const matchesStatus = statusFilter === "ALL" || rec.status === statusFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        (rec.dam_tag || "").toLowerCase().includes(q) ||
        (rec.sire_tag_or_code || "").toLowerCase().includes(q) ||
        (rec.sire_breed || "").toLowerCase().includes(q) ||
        (rec.technician_or_inseminator || "").toLowerCase().includes(q) ||
        (rec.notes || "").toLowerCase().includes(q) ||
        (rec.livestock_type_name || "").toLowerCase().includes(q);
      const matchesSpecies =
        !selectedSpecies ||
        selectedSpecies === "ALL" ||
        (rec.livestock_type_name || "").toLowerCase() === selectedSpecies.toLowerCase();
      return matchesStatus && matchesQuery && matchesSpecies;
    });
  }, [breedingRecords, statusFilter, query, selectedSpecies]);

  // Pagination state for breeding history
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [prevFilterKey, setPrevFilterKey] = useState(`${query}:${statusFilter}:${selectedSpecies}`);
  const currentFilterKey = `${query}:${statusFilter}:${selectedSpecies}`;
  if (prevFilterKey !== currentFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setCurrentPage(1);
  }

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* 1. Farmbrite-Style KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Pregnant Animals (Dams)"
          value={analytics ? `${analytics.active_gestations} Dams` : "0 Dams"}
          icon={<HeartHandshake className="size-4.5" />}
          badge={analytics?.due_soon ? `${analytics.due_soon} due in ≤ 30 days` : "Pregnant or awaiting check"}
          variant="emerald"
        />
        <KpiCard
          title="Due Soon (≤ 30 Days)"
          value={analytics ? `${analytics.due_soon} Dams` : "0 Dams"}
          icon={<Clock className="size-4.5" />}
          badge="Giving birth soon"
          variant="amber"
        />
        <KpiCard
          title="Pregnancy Success Rate"
          value={
            analytics?.conception_rate_pct !== null && analytics?.conception_rate_pct !== undefined
              ? `${analytics.conception_rate_pct}%`
              : "—"
          }
          icon={<TrendingUp className="size-4.5" />}
          badge={
            analytics?.conception_analytics?.events_with_known_outcomes
              ? `${analytics.conception_analytics.confirmed_conceptions} pregnant of ${analytics.conception_analytics.events_with_known_outcomes} checked`
              : "Need checked outcomes"
          }
          variant="sky"
        />
        <KpiCard
          title="Breeding Methods"
          value={analytics ? `${analytics.by_type.artificial_insemination} AI / ${analytics.by_type.natural_service} Natural` : "—"}
          icon={<Dna className="size-4.5" />}
          badge="AI vs Natural Bull"
          variant="stone"
        />
      </div>

      {/* Conception Rate Governance & Prediction Readiness Card (Phases 6 & 7) */}
      <div className="p-4 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-sky-50/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-sky-600" />
              Pregnancy Success Rate Calculation:
            </span>
            <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-800 border-sky-200">
              Fair Count
            </Badge>
          </div>
          <p className="text-slate-600">
            Formula: <code className="font-mono font-bold text-slate-800">Confirmed Pregnant ÷ Checked Breedings × 100</code>.
            Animals waiting for pregnancy checks ({analytics?.conception_analytics?.pending_outcomes_excluded ?? 0} pending) are not counted as failures.
          </p>
        </div>
        <div className="shrink-0 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] space-y-0.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <Clock className="size-3 text-amber-700" />
            <span>Smart Breeding Predictor:</span>
            <Badge className="text-[9px] bg-amber-200 text-amber-900 border-0">
              {analytics?.prediction_readiness?.verdict || "Collecting Farm Records"}
            </Badge>
          </div>
          <p className="text-amber-800 text-[10px] max-w-xs">
            Needs at least 30 verified breeding outcomes before unlocking smart predictions. SmartLivestock uses only real farm records.
          </p>
        </div>
      </div>

      {/* 2. Top Controls & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Search dam, sire tag, technician..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl text-xs bg-slate-50/70 border-slate-200"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 border-slate-200 hover:bg-slate-50 cursor-pointer h-10 px-4 active:scale-95 transition-all shadow-xs"
          >
            <RefreshCw className={`size-4 ${isRefetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="gap-1.5 rounded-xl text-xs font-black bg-[#2D5A27] hover:bg-[#23471f] text-white shadow-xs cursor-pointer h-10 px-4"
          >
            <Plus className="size-4" />
            <span>Log Insemination / Mating</span>
          </Button>
        </div>
      </div>

      {/* 2.5 Status Filter Chips Strip with Interactive Horizontal Scrollbar */}
      <div className="space-y-1.5">
        <div
          ref={filterContainerRef}
          onScroll={updateFilterScrollMetrics}
          onWheel={handleFilterWheel}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1"
        >
          {(["ALL", "PENDING_CHECK", "PREGNANT", "CALVED", "OPEN"] as const).map((st) => {
            const label = st === "ALL" ? "All" : statusLabels[st];
            const count =
              st === "ALL"
                ? breedingRecords.length
                : breedingRecords.filter((r) => r.status === st).length;

            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`shrink-0 whitespace-nowrap min-h-[36px] inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    statusFilter === st
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Interactive Custom Horizontal Scrollbar Track */}
        {filterScrollInfo.canScroll && (
          <div
            ref={filterTrackRef}
            onClick={handleFilterTrackClick}
            className="w-full h-1.5 bg-slate-100 hover:bg-slate-200/70 rounded-full relative transition-all duration-200 select-none group cursor-pointer"
            role="scrollbar"
            aria-controls="breeding-status-filters"
            aria-valuenow={Math.round(filterScrollInfo.thumbLeftPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Horizontal scrollbar for status filters"
            title="Click or drag to scroll filters horizontally"
          >
            <div
              onPointerDown={handleFilterThumbPointerDown}
              onPointerMove={handleFilterThumbPointerMove}
              onPointerUp={handleFilterThumbPointerUp}
              onPointerCancel={handleFilterThumbPointerUp}
              style={{
                left: `${filterScrollInfo.thumbLeftPct}%`,
                width: `${filterScrollInfo.thumbWidthPct}%`,
              }}
              className="absolute top-0 bottom-0 bg-slate-400 group-hover:bg-slate-500 active:bg-slate-700 rounded-full transition-colors cursor-grab active:cursor-grabbing shadow-2xs"
            />
          </div>
        )}
      </div>

      {/* 3. Gestation Roster & Cards */}
      {isRecordsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="size-12 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center mx-auto mb-3">
            <HeartHandshake className="size-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">No breeding or insemination records found</p>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Log artificial insemination (AI) or natural service for your active female dams to track gestation countdowns and due dates.
          </p>
          <Button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="mt-4 rounded-xl text-xs font-black bg-[#2D5A27] text-white hover:bg-[#23471f]"
          >
            <Plus className="mr-1.5 size-4" /> Log First Breeding Event
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedRecords.map((record) => {
            const isDueSoon = (record.days_until_due ?? 999) <= 30 && (record.days_until_due ?? 999) >= 0;
            const isOverdue = (record.days_until_due ?? 999) < 0 && record.status === "PREGNANT";
            const progress = record.gestation_progress_pct ?? 0;

            return (
              <Card key={record.id} className="border-slate-200 rounded-3xl overflow-hidden bg-white shadow-xs hover:border-violet-300 transition-all">
                <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 flex flex-row items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-2xl bg-violet-50 text-violet-800 flex items-center justify-center font-bold text-xs shrink-0 border border-violet-100">
                      {record.breeding_type === "ARTIFICIAL_INSEMINATION" ? "AI" : "NAT"}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>{record.dam_tag || `Dam #${record.dam}`}</span>
                        <Badge className={`text-[10px] font-bold ${statusBadgeClasses[record.status]}`}>
                          {statusLabels[record.status]}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        {record.livestock_type_name || "Livestock"} • {record.dam_breed || "Breed unrecorded"}
                      </CardDescription>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this breeding record?")) {
                        deleteMutation.mutate(record.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Delete record"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-3.5">
                  {/* Sire & Inseminator */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sire / Straw Code</p>
                      <p className="mt-0.5 font-bold text-slate-800 truncate">{record.sire_tag_or_code || "—"}</p>
                      {record.sire_breed && <p className="text-[10px] text-slate-500 truncate">{record.sire_breed}</p>}
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Technician / Method</p>
                      <p className="mt-0.5 font-bold text-slate-800 truncate">
                        {record.technician_or_inseminator || (record.breeding_type === "ARTIFICIAL_INSEMINATION" ? "AI Tech" : "Bull Mating")}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{record.breeding_date}</p>
                    </div>
                  </div>

                  {/* Gestation Progress & Due Date Countdown */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-amber-50/60 border border-amber-200/70">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-950 flex items-center gap-1.5">
                        <Clock className="size-3.5 text-amber-700" />
                        Expected Due Date:
                      </span>
                      <span className="font-black text-amber-900">
                        {record.expected_due_date || "—"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-amber-200/60 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800 pt-0.5">
                      <span>Gestation: {progress}% elapsed</span>
                      <span>
                        {isOverdue ? (
                          <span className="text-rose-700 font-bold">Delivery Imminent / Past Due</span>
                        ) : record.days_until_due !== null && record.days_until_due !== undefined ? (
                          <span className={isDueSoon ? "text-amber-800 font-bold" : "text-slate-600"}>
                            {record.days_until_due > 0 ? `Due in ${record.days_until_due} days` : "Due today"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  </div>

                  {record.notes && (
                    <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      &ldquo;{record.notes}&rdquo;
                    </p>
                  )}

                  {/* Status Transition Action Pills */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-400 font-semibold">Update status:</span>
                    <div className="flex items-center gap-1.5">
                      {record.status !== "PREGNANT" && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmPregnancyRecord(record);
                            setConfirmationDate(new Date().toISOString().split("T")[0]);
                            setConfirmationMethod("Transrectal Palpation");
                            setConfirmationNotes("");
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          <span>Confirm Pregnant</span>
                        </button>
                      )}
                      {record.status !== "CALVED" && (
                        <button
                          type="button"
                          onClick={() => updateStatusMutation.mutate({ id: record.id, status: "CALVED" })}
                          className="px-2 py-1 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200 transition cursor-pointer"
                        >
                          Mark Calved
                        </button>
                      )}
                      {record.status !== "OPEN" && (
                        <button
                          type="button"
                          onClick={() => updateStatusMutation.mutate({ id: record.id, status: "OPEN" })}
                          className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                        >
                          Mark Open / Re-bred
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredRecords.length > 0 && (
          <ValidationPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredRecords.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            pageSizeOptions={[4, 8, 16, 24]}
          />
        )}
      </div>
      )}

      {/* Modal Dialog for Recording Breeding */}
      <BreedingRegistrationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        femaleLivestock={femaleLivestock}
        maleLivestock={maleLivestock}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isSubmitting={createMutation.isPending}
      />

      {/* Modal Dialog for Clinical Pregnancy Confirmation (Phases 2 & 9) */}
      <Dialog open={!!confirmPregnancyRecord} onOpenChange={(open) => !open && setConfirmPregnancyRecord(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white border-slate-200 p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-600" />
              <span>Confirm Clinical Pregnancy</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Officially verify pregnancy for dam{" "}
              <strong className="text-slate-800">{confirmPregnancyRecord?.dam_tag || `Dam #${confirmPregnancyRecord?.dam}`}</strong>{" "}
              (Bred on {confirmPregnancyRecord?.breeding_date}). Herd exposure alone never confirms conception.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (confirmPregnancyRecord) {
                confirmPregnancyMutation.mutate({
                  id: confirmPregnancyRecord.id,
                  date: confirmationDate,
                  method: confirmationMethod,
                  notes: confirmationNotes,
                });
              }
            }}
            className="space-y-4 pt-2 text-xs"
          >
            <div>
              <label className="font-bold text-slate-700 block mb-1">Confirmation / Exam Date</label>
              <Input
                type="date"
                max={new Date().toISOString().split("T")[0]}
                value={confirmationDate}
                onChange={(e) => setConfirmationDate(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Diagnostic Confirmation Method</label>
              <select
                value={confirmationMethod}
                onChange={(e) => setConfirmationMethod(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="Transrectal Palpation">Transrectal Palpation (Veterinary Rectal Exam)</option>
                <option value="Veterinary Ultrasound Scan">Transrectal / Transabdominal Ultrasound</option>
                <option value="Blood Progesterone Assay">Blood / Milk Progesterone Diagnostic Assay</option>
                <option value="Visual & Estrus Non-Return Check">Non-Return to Estrus & External Signs (Veterinary Verified)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Clinical Remarks & Notes</label>
              <textarea
                value={confirmationNotes}
                onChange={(e) => setConfirmationNotes(e.target.value)}
                placeholder="Fetal membrane slip felt, viable heartbeat observed, examining vet..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl resize-none h-20 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmPregnancyRecord(null)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={confirmPregnancyMutation.isPending}
                className="rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                {confirmPregnancyMutation.isPending ? "Confirming..." : "Confirm & Update Registry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
