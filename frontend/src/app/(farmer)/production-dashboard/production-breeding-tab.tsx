"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Dna,
  HeartHandshake,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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

export interface BreedingAnalyticsData {
  total_records: number;
  active_gestations: number;
  due_soon: number;
  calved_count: number;
  open_count: number;
  conception_rate_pct: number | null;
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
  PREGNANT: "Confirmed Pregnant",
  PENDING_CHECK: "Awaiting Check",
  CALVED: "Calved / Delivered",
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
    onError: (err: any) => {
      const message = err?.response?.data?.dam || err?.response?.data?.breeding_date || "Failed to record breeding event.";
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

  return (
    <div className="space-y-6">
      {/* 1. Farmbrite-Style KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Active Gestations"
          value={analytics ? `${analytics.active_gestations} Dams` : "0 Dams"}
          icon={<HeartHandshake className="size-4.5" />}
          badge={analytics?.due_soon ? `${analytics.due_soon} due in ≤ 30 days` : "Currently pregnant or awaiting check"}
          variant="emerald"
        />
        <KpiCard
          title="Due Soon (≤ 30 Days)"
          value={analytics ? `${analytics.due_soon} Dams` : "0 Dams"}
          icon={<Clock className="size-4.5" />}
          badge="Imminent parturition"
          variant="amber"
        />
        <KpiCard
          title="Conception Success Rate"
          value={analytics?.conception_rate_pct !== null && analytics?.conception_rate_pct !== undefined ? `${analytics.conception_rate_pct}%` : "—"}
          icon={<TrendingUp className="size-4.5" />}
          badge={`${analytics?.calved_count ?? 0} calved / ${analytics?.total_records ?? 0} total breedings`}
          variant="sky"
        />
        <KpiCard
          title="Insemination Methods"
          value={analytics ? `${analytics.by_type.artificial_insemination} AI / ${analytics.by_type.natural_service} Natural` : "—"}
          icon={<Dna className="size-4.5" />}
          badge="Breeding protocol breakdown"
          variant="stone"
        />
      </div>

      {/* 2. Top Controls & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="Search dam, sire tag, technician..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl text-xs bg-slate-50/70 border-slate-200"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {(["ALL", "PREGNANT", "PENDING_CHECK", "CALVED", "OPEN"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st === "ALL" ? "All" : st === "PENDING_CHECK" ? "Awaiting Check" : st === "PREGNANT" ? "Pregnant" : st === "CALVED" ? "Calved" : "Open"}
              </button>
            ))}
          </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecords.map((record) => {
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
                      "{record.notes}"
                    </p>
                  )}

                  {/* Status Transition Action Pills */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-400 font-semibold">Update status:</span>
                    <div className="flex items-center gap-1.5">
                      {record.status !== "PREGNANT" && (
                        <button
                          type="button"
                          onClick={() => updateStatusMutation.mutate({ id: record.id, status: "PREGNANT" })}
                          className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                        >
                          Confirm Pregnant
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
      )}

      {/* Modal Dialog for Recording Breeding */}
      <BreedingRegistrationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        femaleLivestock={femaleLivestock}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}
