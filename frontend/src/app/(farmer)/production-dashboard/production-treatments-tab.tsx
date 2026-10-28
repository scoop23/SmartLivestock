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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/axios";
import { formatCalendarDate, localCalendarDateToday } from "@/lib/livestock-age";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Layers,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ValidationPagination } from "@/app/(admin)/data-validation/components/validation-pagination";
import type { LivestockInventoryItem } from "../livestock-inventory/livestock-inventory";

export interface TreatmentRecordItem {
  id: number;
  livestock: number;
  livestock_tag?: string;
  livestock_type?: string;
  treatment_date: string;
  treatment_type: string;
  treatment_type_label?: string;
  medication_name: string;
  reason: string;
  dosage: string;
  route_of_administration: string;
  administered_by: string;
  notes: string;
  follow_up_date: string | null;
  created_at?: string;
}

interface ProductionTreatmentsTabProps {
  approvedInventories: LivestockInventoryItem[];
  selectedSpecies?: string | null;
  autoOpen?: boolean;
  onClose?: () => void;
}

export default function ProductionTreatmentsTab({
  approvedInventories,
  selectedSpecies,
  autoOpen = false,
  onClose,
}: ProductionTreatmentsTabProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(autoOpen);

  // Form states for logging a new clinical treatment
  const [selectedLivestockId, setSelectedLivestockId] = useState<string>("");
  const [treatmentDate, setTreatmentDate] = useState(() => localCalendarDateToday());
  const [treatmentType, setTreatmentType] = useState<string>("ANTIBIOTIC");
  const [medicationName, setMedicationName] = useState<string>("");
  const [dosage, setDosage] = useState<string>("");
  const [route, setRoute] = useState<string>("Intramuscular (IM)");
  const [reason, setReason] = useState<string>("");
  const [administeredBy, setAdministeredBy] = useState<string>("");
  const [followUpDate, setFollowUpDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // 1. Fetch all treatment records
  const {
    data: allTreatments = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<TreatmentRecordItem[]>({
    queryKey: ["all_clinical_treatments"],
    queryFn: async () => {
      try {
        const res = await api.get<TreatmentRecordItem[]>("production/treatments/");
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
  });

  // 2. Filter by species
  const speciesFilteredTreatments = useMemo(() => {
    if (!selectedSpecies || selectedSpecies === "ALL") return allTreatments;
    const speciesLower = selectedSpecies.toLowerCase();
    const speciesAnimalIds = new Set(
      approvedInventories
        .filter((inv) => (inv.livestockTypeName || "").toLowerCase() === speciesLower)
        .map((inv) => Number(inv.id))
    );
    return allTreatments.filter(
      (t) =>
        speciesAnimalIds.has(Number(t.livestock)) ||
        (t.livestock_type && t.livestock_type.toLowerCase() === speciesLower)
    );
  }, [allTreatments, approvedInventories, selectedSpecies]);

  // 3. Category options with counts
  const categoryOptions = useMemo(() => {
    const list = [
      { key: "ALL", label: "All Treatments", count: speciesFilteredTreatments.length },
      {
        key: "ANTIBIOTIC",
        label: "Antibiotics",
        count: speciesFilteredTreatments.filter((t) => t.treatment_type === "ANTIBIOTIC").length,
      },
      {
        key: "DEWORMER",
        label: "Dewormers",
        count: speciesFilteredTreatments.filter((t) => t.treatment_type === "DEWORMER").length,
      },
      {
        key: "VITAMIN_MINERAL",
        label: "Vitamins & Minerals",
        count: speciesFilteredTreatments.filter((t) => t.treatment_type === "VITAMIN_MINERAL").length,
      },
      {
        key: "VACCINE",
        label: "Vaccines",
        count: speciesFilteredTreatments.filter((t) => t.treatment_type === "VACCINE").length,
      },
      {
        key: "ANTI_INFLAMMATORY",
        label: "Anti-inflammatory",
        count: speciesFilteredTreatments.filter((t) => t.treatment_type === "ANTI_INFLAMMATORY").length,
      },
      {
        key: "TOPICAL_WOUND",
        label: "Wound & Topical",
        count: speciesFilteredTreatments.filter((t) => t.treatment_type === "TOPICAL_WOUND").length,
      },
      {
        key: "OTHER",
        label: "Other Treatments",
        count: speciesFilteredTreatments.filter((t) => ["OTHER", "HORMONAL"].includes(t.treatment_type)).length,
      },
    ];
    return list;
  }, [speciesFilteredTreatments]);

  // 4. Filter by category & search query
  const displayedTreatments = useMemo(() => {
    return speciesFilteredTreatments.filter((t) => {
      // Category filter
      if (selectedCategory !== "ALL") {
        if (selectedCategory === "OTHER") {
          if (!["OTHER", "HORMONAL"].includes(t.treatment_type)) return false;
        } else if (t.treatment_type !== selectedCategory) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const tag = (t.livestock_tag || "").toLowerCase();
        const med = (t.medication_name || "").toLowerCase();
        const r = (t.reason || "").toLowerCase();
        const by = (t.administered_by || "").toLowerCase();
        const n = (t.notes || "").toLowerCase();
        return tag.includes(q) || med.includes(q) || r.includes(q) || by.includes(q) || n.includes(q);
      }

      return true;
    });
  }, [speciesFilteredTreatments, selectedCategory, searchQuery]);

  // 4.5 Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [prevFilterKey, setPrevFilterKey] = useState(`${searchQuery}:${selectedCategory}:${selectedSpecies}`);
  const currentFilterKey = `${searchQuery}:${selectedCategory}:${selectedSpecies}`;
  if (prevFilterKey !== currentFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setCurrentPage(1);
  }

  const totalPages = Math.ceil(displayedTreatments.length / pageSize) || 1;
  const paginatedTreatments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedTreatments.slice(start, start + pageSize);
  }, [displayedTreatments, currentPage, pageSize]);

  // 5. KPIs & Telemetry
  const totalTreatmentsCount = speciesFilteredTreatments.length;
  const antibioticCount = speciesFilteredTreatments.filter((t) => t.treatment_type === "ANTIBIOTIC").length;
  const dewormerCount = speciesFilteredTreatments.filter((t) => t.treatment_type === "DEWORMER").length;
  const activeFollowUps = speciesFilteredTreatments.filter(
    (t) => t.follow_up_date && new Date(t.follow_up_date) >= new Date()
  ).length;

  // Active withdrawal calculation (antibiotics or dewormers administered within past 14 days)
  const activeWithdrawalCount = useMemo(() => {
    const today = new Date();
    return speciesFilteredTreatments.filter((t) => {
      if (!["ANTIBIOTIC", "DEWORMER"].includes(t.treatment_type)) return false;
      const tDate = new Date(t.treatment_date);
      const diffDays = Math.floor((today.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 14;
    }).length;
  }, [speciesFilteredTreatments]);

  // 6. Log treatment mutation
  const logTreatmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLivestockId) throw new Error("Please select an animal");
      const res = await api.post("production/treatments/", {
        livestock: Number(selectedLivestockId),
        treatment_date: treatmentDate,
        treatment_type: treatmentType,
        medication_name: medicationName,
        dosage,
        route_of_administration: route,
        reason,
        administered_by: administeredBy,
        notes,
        follow_up_date: followUpDate || null,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Clinical veterinary treatment recorded successfully!");
      setIsLogDialogOpen(false);
      setSelectedLivestockId("");
      setMedicationName("");
      setDosage("");
      setReason("");
      setNotes("");
      setFollowUpDate("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["all_clinical_treatments"] });
      queryClient.invalidateQueries({ queryKey: ["treatment_records"] });
      queryClient.invalidateQueries({ queryKey: ["production_treatments_all"] });
      if (onClose) onClose();
    },
    onError: (err: unknown) => {
      const httpErr = err as { response?: { data?: { medication_name?: string; error?: string } } };
      const msg =
        httpErr?.response?.data?.medication_name ||
        httpErr?.response?.data?.error ||
        "Failed to record clinical treatment.";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    },
  });

  return (
    <div className="space-y-6">
      {/* ── 1. Telemetry KPI Cards using KpiCard (Compact Size) ── */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <KpiCard
          size="sm"
          title="Total Treatments"
          value={isLoading ? <Skeleton className="h-6 w-16" /> : `${totalTreatmentsCount} Regimens`}
          icon={<Pill className="size-4" />}
          badge="Lifetime"
          description="Recorded across herd"
          variant="emerald"
        />

        <KpiCard
          size="sm"
          title="Antibiotic Stewardship"
          value={isLoading ? <Skeleton className="h-6 w-16" /> : `${antibioticCount} Courses`}
          icon={<Syringe className="size-4" />}
          badge="DA-BAI Monitored"
          description="Antimicrobial regimens"
          variant="rose"
        />

        <KpiCard
          size="sm"
          title="Deworming & Parasites"
          value={isLoading ? <Skeleton className="h-6 w-16" /> : `${dewormerCount} Doses`}
          icon={<ShieldCheck className="size-4.5" />}
          badge="Anthelmintic"
          description="Internal parasite control"
          variant="sky"
        />

        <KpiCard
          size="sm"
          title="Active Re-checks"
          value={isLoading ? <Skeleton className="h-6 w-16" /> : `${activeFollowUps} Pending`}
          icon={<Clock className="size-4" />}
          badge="Scheduled"
          description="Clinical observation"
          variant="amber"
        />
      </div>

      {/* ── 2. Pharmacovigilance & Food Safety Governance Card ── */}
      <div className="p-3.5 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-teal-50/40 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <Sparkles className="size-3.5 text-teal-600" />
              Antimicrobial Stewardship &amp; Withdrawal Protocol:
            </span>
            <Badge variant="outline" className="text-[9px] bg-teal-50 text-teal-800 border-teal-200 font-bold px-1.5 py-0.2">
              DA-BAI Standards
            </Badge>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Regimen logs enforce withdrawal safety for milk and meat marketing. Therapeutic courses are tracked per animal tag to prevent antibiotic residue in Padre Garcia auctions.
          </p>
        </div>
        <div className="shrink-0 p-2 rounded-xl bg-teal-50/80 border border-teal-200/80 text-[10px] space-y-0.5">
          <div className="flex items-center gap-1.5 font-bold text-teal-900">
            <ShieldCheck className="size-3.5 text-teal-700" />
            <span>Food Safety Status:</span>
            <Badge className="text-[9px] bg-teal-200 text-teal-900 border-0 font-bold px-1.5 py-0.2">
              {activeWithdrawalCount > 0 ? `${activeWithdrawalCount} Under Withdrawal Hold` : "Optimal Clearance"}
            </Badge>
          </div>
          <p className="text-teal-800 text-[9px] max-w-xs">
            {activeWithdrawalCount > 0
              ? "Animals under active withdrawal must not enter slaughterhouse or dairy distribution until hold expires."
              : "Zero animals under active withdrawal hold. Full commercial clearance verified."}
          </p>
        </div>
      </div>

      {/* ── 3. Treatment Category Distribution Breakdown (Compact) ── */}
      <Card className="rounded-2xl border-slate-200/90 shadow-2xs bg-gradient-to-br from-teal-50/30 via-white to-slate-50">
        <CardHeader className="p-3.5 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="size-3.5 text-teal-600" />
                <span>Clinical Category Distribution</span>
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Therapeutic breakdown across antibiotics, anthelmintics, vitamins, vaccines, and topical care
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold text-teal-800 bg-teal-50 border-teal-200 px-2 py-0.5">
              Pharmacology Analytics
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3.5 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {categoryOptions.filter((c) => c.key !== "ALL").map((cat) => {
              const total = totalTreatmentsCount || 1;
              const pct = Math.round((cat.count / total) * 100);
              return (
                <div
                  key={cat.key}
                  className="rounded-xl border border-slate-200/80 bg-white p-2 space-y-0.5 shadow-2xs hover:shadow-xs transition-all"
                >
                  <span className="text-[10px] font-bold text-slate-500 block truncate">
                    {cat.label}
                  </span>
                  <p className="text-base font-black text-slate-900 leading-tight">
                    {cat.count} <span className="text-[9px] font-semibold text-slate-400">events</span>
                  </p>
                  <div className="flex items-center justify-between text-[9px] text-slate-500">
                    <span>{pct}% of herd</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="bg-teal-600 h-1 rounded-full transition-all"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Toolbar: Search & Action ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Search treatments by animal, medication, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl text-xs bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-2 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-950 border-slate-200 hover:bg-slate-50 cursor-pointer h-10 px-3.5 shadow-2xs"
          >
            <RefreshCw className={cn("size-4", isRefetching && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            type="button"
            onClick={() => setIsLogDialogOpen(true)}
            className="gap-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-2xs cursor-pointer h-10 px-4"
          >
            <Plus className="size-4" />
            <span>Log Clinical Treatment</span>
          </Button>
        </div>
      </div>

      {/* ── 5. Filter Chips: Categories ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        {categoryOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSelectedCategory(opt.key)}
            className={cn(
              "shrink-0 whitespace-nowrap min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border",
              selectedCategory === opt.key
                ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
            )}
          >
            <span>{opt.label}</span>
            <span
              className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                selectedCategory === opt.key
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              {opt.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── 6. Treatments Table ── */}
      <Card className="rounded-3xl border-slate-200 shadow-2xs bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : displayedTreatments.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="size-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
              <Pill className="size-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No clinical treatments found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedCategory !== "ALL"
                ? "Try adjusting your search query or category filter."
                : "No treatments logged for this herd yet. Record a treatment when an animal receives medication, dewormer, or veterinary care."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/75 border-b border-slate-200">
              <TableRow>
                <TableHead className="font-bold text-xs text-slate-700">Animal Tag</TableHead>
                <TableHead className="font-bold text-xs text-slate-700">Date</TableHead>
                <TableHead className="font-bold text-xs text-slate-700">Type</TableHead>
                <TableHead className="font-bold text-xs text-slate-700">Medication &amp; Dosage</TableHead>
                <TableHead className="font-bold text-xs text-slate-700">Route</TableHead>
                <TableHead className="font-bold text-xs text-slate-700">Administered By</TableHead>
                <TableHead className="font-bold text-xs text-slate-700">Withdrawal &amp; Follow-up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTreatments.map((t) => {
                const isAntibioticOrDewormer = ["ANTIBIOTIC", "DEWORMER"].includes(t.treatment_type);
                const tDate = new Date(t.treatment_date);
                const daysSince = Math.floor(
                  (new Date().getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24)
                );
                const underWithdrawal = isAntibioticOrDewormer && daysSince >= 0 && daysSince <= 14;

                return (
                  <TableRow key={t.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-black text-xs text-slate-900 whitespace-nowrap">
                      <Link
                        href={`/livestock-inventory/${t.livestock}`}
                        className="inline-flex items-center gap-1.5 text-teal-700 hover:text-teal-900 hover:underline"
                      >
                        <Tag className="size-3.5 text-teal-600" />
                        <span>{t.livestock_tag || `ID #${t.livestock}`}</span>
                        <ExternalLink className="size-3 text-slate-400" />
                      </Link>
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-slate-700 whitespace-nowrap">
                      {formatCalendarDate(t.treatment_date)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                          t.treatment_type === "ANTIBIOTIC"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : t.treatment_type === "DEWORMER"
                            ? "bg-sky-50 text-sky-800 border-sky-200"
                            : t.treatment_type === "VITAMIN_MINERAL"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : t.treatment_type === "VACCINE"
                            ? "bg-purple-50 text-purple-800 border-purple-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        )}
                      >
                        {t.treatment_type_label || t.treatment_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-bold text-slate-900">{t.medication_name}</div>
                      {t.dosage && <div className="text-[11px] text-slate-500 font-mono">{t.dosage}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      {t.route_of_administration || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 font-medium whitespace-nowrap">
                      {t.administered_by || "Self / Farm Staff"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      <div className="space-y-1">
                        {underWithdrawal ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            <AlertTriangle className="size-3 text-amber-600" />
                            <span>Hold: {14 - daysSince}d left</span>
                          </span>
                        ) : isAntibioticOrDewormer ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            <span>Cleared</span>
                          </span>
                        ) : null}

                        {t.follow_up_date ? (
                          <div className="font-semibold text-amber-700 flex items-center gap-1 text-[11px]">
                            <Clock className="size-3 text-amber-600" />
                            <span>Re-check: {formatCalendarDate(t.follow_up_date)}</span>
                          </div>
                        ) : !isAntibioticOrDewormer ? (
                          "—"
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {displayedTreatments.length > 0 && (
          <div className="p-3 border-t border-slate-100 bg-slate-50/50">
            <ValidationPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={displayedTreatments.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[5, 10, 25, 50]}
            />
          </div>
        )}
      </Card>

      {/* ── 7. Dialog: Log Clinical Treatment ── */}
      <Dialog
        open={isLogDialogOpen}
        onOpenChange={(open) => {
          setIsLogDialogOpen(open);
          if (!open && onClose) onClose();
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Pill className="size-5 text-teal-600" />
              <span>Log Clinical Treatment</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Record veterinary medication, antibiotic administration, or health care for an animal in your herd.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              logTreatmentMutation.mutate();
            }}
            className="space-y-4 pt-2"
          >
            <div>
              <Label className="text-xs font-bold text-slate-700">Select Animal *</Label>
              <Select
                value={selectedLivestockId}
                onValueChange={setSelectedLivestockId}
                required
              >
                <SelectTrigger className="rounded-xl mt-1 text-xs">
                  <SelectValue placeholder="Choose an animal from your approved herd" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-56">
                  {approvedInventories.map((inv) => (
                    <SelectItem key={inv.id} value={String(inv.id)}>
                      {inv.tagNumber} ({inv.livestockTypeName} &bull; {inv.breed || "Standard"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Treatment Date *</Label>
                <Input
                  type="date"
                  value={treatmentDate}
                  onChange={(e) => setTreatmentDate(e.target.value)}
                  max={localCalendarDateToday()}
                  className="rounded-xl mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Category *</Label>
                <Select value={treatmentType} onValueChange={setTreatmentType}>
                  <SelectTrigger className="rounded-xl mt-1 text-xs">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ANTIBIOTIC">Antibiotic</SelectItem>
                    <SelectItem value="DEWORMER">Dewormer / Anthelmintic</SelectItem>
                    <SelectItem value="VITAMIN_MINERAL">Vitamin / Mineral Supplement</SelectItem>
                    <SelectItem value="VACCINE">Vaccine</SelectItem>
                    <SelectItem value="ANTI_INFLAMMATORY">Anti-inflammatory / Pain</SelectItem>
                    <SelectItem value="TOPICAL_WOUND">Topical / Wound Care</SelectItem>
                    <SelectItem value="HORMONAL">Hormonal Therapy</SelectItem>
                    <SelectItem value="OTHER">Other Intervention</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Medication / Product *</Label>
                <Input
                  placeholder="e.g. Penicillin, Ivermectin"
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Dosage</Label>
                <Input
                  placeholder="e.g. 10 mL, 2 boluses"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Route of Administration</Label>
                <Select value={route} onValueChange={setRoute}>
                  <SelectTrigger className="rounded-xl mt-1 text-xs">
                    <SelectValue placeholder="Select route" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Intramuscular (IM)">Intramuscular (IM)</SelectItem>
                    <SelectItem value="Subcutaneous (SC)">Subcutaneous (SC)</SelectItem>
                    <SelectItem value="Oral (Drench/Bolus)">Oral (Drench/Bolus)</SelectItem>
                    <SelectItem value="Topical / Pour-on">Topical / Pour-on</SelectItem>
                    <SelectItem value="Intravenous (IV)">Intravenous (IV)</SelectItem>
                    <SelectItem value="Intrauterine">Intrauterine</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Administered By</Label>
                <Input
                  placeholder="e.g. Dr. Santos / Farm Staff"
                  value={administeredBy}
                  onChange={(e) => setAdministeredBy(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Reason / Diagnosis</Label>
              <Input
                placeholder="e.g. Respiratory symptoms, routine parasite control"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="rounded-xl mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Follow-up Date (Optional)</Label>
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  min={localCalendarDateToday()}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Field Notes</Label>
                <Input
                  placeholder="Observations, withdrawal period"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-xl mt-1 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLogDialogOpen(false)}
                className="rounded-xl text-xs font-bold border-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={logTreatmentMutation.isPending || !selectedLivestockId || !medicationName.trim()}
                className="rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white"
              >
                {logTreatmentMutation.isPending ? "Recording..." : "Save Treatment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
