"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mapInventoryToUnified, mapBatchToUnified, type RawInventoryRecord, type UnifiedStatus } from "../sibat-analytics";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import type { UnifiedSubmissionItem } from "../sibat-analytics";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTableSection } from "@/components/ui/data-table-section";
import { ValidationPagination } from "@/app/(admin)/data-validation/components/validation-pagination";
import { LivestockOperationalStatusBadge } from "@/components/livestock-operational-status-badge";
import { ArrowUpDown, CheckCircle2, Clock, Eye, Layers, RotateCcw, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import SibatStatusBadge from "../components/sibat-status-badge";
import SibatReviewDialog from "../components/sibat-review-dialog";

const PAGE_SIZE = 10;
type RegistryStatusFilter = "ALL" | "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";

const STATUS_FILTERS: Array<{ value: RegistryStatusFilter; label: string; icon: typeof Layers; activeClass: string; dotClass: string }> = [
  { value: "ALL", label: "All Records", icon: Layers, activeClass: "bg-slate-900 text-white border-slate-900 shadow-sm", dotClass: "bg-slate-400" },
  { value: "APPROVED", label: "Approved by MAO", icon: CheckCircle2, activeClass: "bg-emerald-700 text-white border-emerald-700 shadow-sm", dotClass: "bg-emerald-500" },
  { value: "VERIFIED", label: "Verified · Awaiting MAO", icon: ShieldCheck, activeClass: "bg-sky-700 text-white border-sky-700 shadow-sm", dotClass: "bg-sky-500" },
  { value: "PENDING", label: "Awaiting SIBAT", icon: Clock, activeClass: "bg-amber-600 text-white border-amber-600 shadow-sm", dotClass: "bg-amber-500" },
  { value: "SUBJECT_TO_REVISION", label: "Needs correction", icon: RotateCcw, activeClass: "bg-rose-700 text-white border-rose-700 shadow-sm", dotClass: "bg-rose-500" },
];

interface RegistryBatchRecord {
  id: number;
  review_status?: string;
  batch_code?: string;
  batch_name?: string;
  farmer_name?: string;
  barangay_name?: string;
  livestock_type_name?: string;
  total_animals?: number;
  average_weight?: number | string | null;
  created_at?: string;
  reviewed_at?: string | null;
  status?: string;
}

/** Read-only registry of livestock across the SIBAT-to-MAO review workflow. */
export default function SibatLivestockRegistryPage() {
  const [statusFilter, setStatusFilter] = useState<RegistryStatusFilter>("APPROVED");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<UnifiedSubmissionItem | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const scopeKey = [user?.email, user?.accessScope, user?.assignedBarangayId];
  const hasAllBarangayAccess = user?.accessScope === "ALL_BARANGAYS";
  const assignedBarangayId = user?.assignedBarangayId;
  const barangayFilter = hasAllBarangayAccess ? undefined : assignedBarangayId;
  // Filter at the API so the registry does not download every pending and returned record.
  const inventoryQuery = useQuery({
    queryKey: ["sibat", "livestock-registry", "inventory", statusFilter, ...scopeKey],
    queryFn: async () => (await api.get<RawInventoryRecord[]>("livestock/inventory/", {
      params: { include_inactive: true, status: statusFilter === "ALL" ? undefined : statusFilter, barangay_id: barangayFilter },
    })).data,
    staleTime: 30_000,
    enabled: hasAllBarangayAccess || Boolean(assignedBarangayId),
  });
  const batchesQuery = useQuery({
    queryKey: ["sibat", "livestock-registry", "batches", statusFilter, ...scopeKey],
    queryFn: async () => (await api.get<RegistryBatchRecord[]>("livestock/batches/", {
      params: { review_status: statusFilter === "ALL" ? undefined : statusFilter, barangay_id: barangayFilter },
    })).data,
    staleTime: 30_000,
    enabled: hasAllBarangayAccess || Boolean(assignedBarangayId),
  });
  const registryRecords = useMemo(() => {
    const individuals = (inventoryQuery.data ?? [])
      // Ordinary herd members are represented by the herd row. A later addition
      // is different: it has its own review lifecycle, so show it as an animal row.
      .filter((record) => (record.batch == null && !record.batch_code) || record.is_post_approval_addition)
      .map(mapInventoryToUnified);
    const herds = (batchesQuery.data ?? [])
      .map(mapBatchToUnified);
    return [...individuals, ...herds].sort((a, b) => {
      const difference = new Date(b.reviewedAt || b.createdAt).getTime() - new Date(a.reviewedAt || a.createdAt).getTime();
      return sortBy === "newest" ? difference : -difference;
    });
  }, [inventoryQuery.data, batchesQuery.data, sortBy]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return registryRecords.filter((record) => {
      if (statusFilter !== "ALL" && record.status.toUpperCase() !== statusFilter) return false;
      if (!query) return true;
      return [
      record.tagNumber, record.batchCode, record.batchName, record.farmerName,
      record.barangayName, record.livestockTypeName, record.breed,
      ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
    });
  }, [registryRecords, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pageRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isLoading = inventoryQuery.isLoading || batchesQuery.isLoading;
  const failedSources = [
    ...(inventoryQuery.isError ? ["individual livestock"] : []),
    ...(batchesQuery.isError ? ["herds"] : []),
  ];
  const isSettled = !inventoryQuery.isLoading && !batchesQuery.isLoading;
  const canLoadRegistry = hasAllBarangayAccess || Boolean(assignedBarangayId);
  const registryScopeLabel = hasAllBarangayAccess
    ? "all barangays authorized for this SIBAT account"
    : user?.assignedBarangayName || "the barangay assigned to this SIBAT account";

  return (
    <>
      <PageHeader
        title="Livestock Registry"
        subtitle="Track livestock and herds through SIBAT field verification and MAO review."
        variant="sibat"
        maxWidthClass="w-full"
      />
      <main className="mx-auto w-full max-w-[1600px] space-y-5 p-3 sm:p-5 lg:px-8 lg:py-6 2xl:px-10">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-bold">Livestock review registry</p>
          <p className="mt-1 text-emerald-900/80">Showing individual animals and herds for {registryScopeLabel}. Choose a review status to narrow the registry.</p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 p-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Search tag, farmer, barangay, or livestock…"
                aria-label="Search livestock records"
                className="border-slate-200 bg-slate-50/50 pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(value: "newest" | "oldest") => setSortBy(value)}>
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50/60 text-sm sm:w-[165px]">
                <div className="flex items-center gap-2"><ArrowUpDown className="size-3.5 shrink-0 text-slate-400" /><SelectValue placeholder="Sort by" /></div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="opacity-60" />

          <div className="flex flex-col gap-3 px-3 py-2.5 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-1.5">
              <SlidersHorizontal className="mr-0.5 hidden size-3.5 shrink-0 text-slate-400 sm:block" />
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={statusFilter === filter.value}
                onClick={() => { setStatusFilter(filter.value); setPage(1); }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${statusFilter === filter.value ? filter.activeClass : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"}`}
              >
                {statusFilter !== filter.value ? <span className={`size-1.5 rounded-full ${filter.dotClass}`} /> : null}
                <filter.icon className="size-3.5" />
                {filter.label}
              </button>
            ))}
            </div>
            <p className="ml-auto shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">Showing {filteredRecords.length} {filteredRecords.length === 1 ? "record" : "records"}</p>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Livestock records</h2>
          </div>

          {isLoading && pageRecords.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Loading livestock records…</p> : null}
          {!canLoadRegistry ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">This SIBAT account has no assigned barangay. Ask MAO/Admin to assign one before viewing its approved livestock registry.</div> : null}
          {failedSources.length > 0 ? (
            <div role="alert" className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between">
              <p>Could not load {failedSources.join(" and ")}. Successfully loaded records remain visible.</p>
              <Button type="button" variant="outline" size="sm" className="gap-2 self-start sm:self-auto" onClick={() => {
                if (inventoryQuery.isError) void inventoryQuery.refetch();
                if (batchesQuery.isError) void batchesQuery.refetch();
              }}>
                <RotateCcw className="size-4" /> Retry failed request{failedSources.length > 1 ? "s" : ""}
              </Button>
            </div>
          ) : null}
          {canLoadRegistry && isSettled && failedSources.length === 0 && filteredRecords.length === 0 ? (
            <DataTableSection className="min-h-0 border-0 bg-transparent p-0 shadow-none">
              <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-2xs">
                <div className="mb-3 rounded-full border border-slate-100 bg-slate-50 p-4"><Search className="size-8 text-slate-300" /></div>
                <h3 className="text-base font-bold text-slate-800">No livestock records found</h3>
                <p className="mt-1 max-w-sm text-xs font-medium text-slate-500">No records matched this review status and search. Try another status or search term.</p>
              </div>
            </DataTableSection>
          ) : null}

          {pageRecords.length > 0 ? (
            <DataTableSection
              className="min-h-0 border-0 bg-transparent p-0 shadow-none"
              footer={filteredRecords.length > PAGE_SIZE ? <ValidationPagination
                currentPage={Math.min(page, pageCount)}
                totalPages={pageCount}
                totalItems={filteredRecords.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                pageSizeOptions={[PAGE_SIZE]}
              /> : undefined}
            >
              <div className="h-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
                <div className="overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow className="border-b border-slate-200/80 bg-slate-50/80 hover:bg-slate-50/80">
                        {[
                          "Animal / Herd", "Farmer / Raiser", "Barangay Sector", "Livestock Type",
                          "Breed / Herd Size", "Operational Status", "Review Status", "Action",
                        ].map((heading) => <TableHead key={heading} className="px-3.5 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500">{heading}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100">
                      {pageRecords.map((record: UnifiedSubmissionItem) => (
                        <TableRow key={`${record.sourceType}-${record.rawId}`} className="transition-colors hover:bg-slate-50/90">
                          <TableCell className="px-3.5 py-2.5">
                            <span className="font-mono text-xs font-bold text-slate-900">{record.tagNumber || record.batchCode || `Record #${record.rawId}`}</span>
                            <span className="block text-xs text-slate-500">{record.isPostApprovalAddition ? "Added to approved herd · reviewed separately" : record.entryType === "BATCH" ? record.batchName || "Herd" : record.sex || "Individual animal"}</span>
                          </TableCell>
                          <TableCell className="px-3.5 py-2.5 text-xs font-bold text-slate-800">{record.farmerName}</TableCell>
                          <TableCell className="px-3.5 py-2.5 text-xs font-semibold text-slate-700">{record.barangayName}</TableCell>
                          <TableCell className="px-3.5 py-2.5 text-xs font-bold text-slate-800">{record.livestockTypeName}</TableCell>
                          <TableCell className="px-3.5 py-2.5 text-xs font-semibold text-slate-700">{record.entryType === "BATCH" ? `${record.quantity.toLocaleString()} heads` : record.breed || "Not recorded"}</TableCell>
                          <TableCell className="px-3.5 py-2.5"><LivestockOperationalStatusBadge status={record.operationalStatus || "ACTIVE"} /></TableCell>
                          <TableCell className="px-3.5 py-2.5">
                            <SibatStatusBadge status={record.status as UnifiedStatus} />
                            <span className="mt-1 block text-xs font-medium text-slate-500">{record.reviewedAt ? new Date(record.reviewedAt).toLocaleDateString() : "Date not recorded"}</span>
                          </TableCell>
                          <TableCell className="px-3.5 py-2.5">
                            {record.status === "PENDING" ? (
                              <Button type="button" size="sm" variant="outline" className="gap-1.5 border-sky-200 text-sky-800 hover:bg-sky-50" onClick={() => setSelectedSubmission(record)}>
                                <Eye className="size-3.5" /> Details / Validate
                              </Button>
                            ) : <span className="text-xs text-slate-400">—</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </DataTableSection>
          ) : null}
        </section>
      </main>
      <SibatReviewDialog
        submission={selectedSubmission}
        open={selectedSubmission !== null}
        onOpenChange={(open) => { if (!open) setSelectedSubmission(null); }}
        onReviewSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["sibat", "livestock-registry"] });
        }}
      />
    </>
  );
}
