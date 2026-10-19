"use client";

import type { BatchApiItem } from "@/app/(farmer)/livestock-inventory/livestock-inventory";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from "@/components/ui/table";
import { ValidationLoadingScreen,useLoadingScreenTransition } from "@/components/validation-loading-screen";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import {
ArrowLeft,
ClipboardList,
Eye,
Layers,
MapPin,
RotateCcw,
Search,
Tag,
X
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense,useEffect,useMemo,useState } from "react";
import SibatReviewDialog from "../components/sibat-review-dialog";
import SibatStatusBadge from "../components/sibat-status-badge";
import {
mapBatchToUnified,
mapInventoryToUnified,
type RawInventoryRecord,
type UnifiedStatus,
type UnifiedSubmissionItem,
} from "../sibat-analytics";

const PAGE_SIZE = 10;
type RegistryStatusFilter = "ALL" | "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";

type RegistryBatchRecord = BatchApiItem;

/**
 * Farmer Records Registry for SIBAT / CBAT field officers.
 * Based on the reference RecordsPage pattern with responsive mobile cards and desktop table.
 */
function SibatLivestockRegistryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batchId");
  const reviewId = searchParams.get("reviewId");
  const reviewType = searchParams.get("reviewType");

  const [query, updateQuery] = useState("");
  const setQuery = (value: string) => { updateQuery(value); setPage(1); };
  const [barangay, updateBarangay] = useState("All Barangays");
  const setBarangay = (value: string) => { updateBarangay(value); setPage(1); };
  const [recordType, updateRecordType] = useState("All Record Types");
  const setRecordType = (value: string) => { updateRecordType(value); setPage(1); };
  const [status, updateStatus] = useState<RegistryStatusFilter>(() => (batchId ? "ALL" : "ALL"));
  const setStatus = (value: RegistryStatusFilter) => { updateStatus(value); setPage(1); };
  const [requestedPage, setPage] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<UnifiedSubmissionItem | null>(null);
  const [focusedRecordId, setFocusedRecordId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const scopeKey = [user?.email, user?.accessScope, user?.assignedBarangayId];
  const hasAllBarangayAccess = user?.accessScope === "ALL_BARANGAYS";
  const assignedBarangayId = user?.assignedBarangayId;
  const barangayFilter = hasAllBarangayAccess ? undefined : assignedBarangayId;

  // Fetch individual inventory items for this SIBAT's scope
  const inventoryQuery = useQuery({
    queryKey: ["sibat", "livestock-registry", "inventory", status, batchId, ...scopeKey],
    queryFn: async () => {
      const response = await api.get<RawInventoryRecord[] | { count: number; results: RawInventoryRecord[] }>(
        "livestock/inventory/",
        {
          params: {
            include_inactive: true,
            status: status === "ALL" ? undefined : status,
            barangay_id: barangayFilter,
            batch: batchId || undefined,
          },
        }
      );
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) return data.results as RawInventoryRecord[];
      return [];
    },
    staleTime: 30_000,
    enabled: hasAllBarangayAccess || Boolean(assignedBarangayId),
  });

  // Fetch herd containers
  const batchesQuery = useQuery({
    queryKey: ["sibat", "livestock-registry", "batches", status, batchId, ...scopeKey],
    queryFn: async () => {
      const response = await api.get<RegistryBatchRecord[] | { count: number; results: RegistryBatchRecord[] }>(
        "livestock/batches/",
        {
          params: {
            review_status: status === "ALL" ? undefined : status,
            barangay_id: barangayFilter,
          },
        }
      );
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) return data.results as RegistryBatchRecord[];
      return [];
    },
    staleTime: 30_000,
    enabled: !batchId && (hasAllBarangayAccess || Boolean(assignedBarangayId)),
  });

  // Combine and sort records
  const registryRecords = useMemo(() => {
    const rawInv = inventoryQuery.data;
    const invList: RawInventoryRecord[] = Array.isArray(rawInv)
      ? rawInv
      : [];
    const individuals = invList
      .filter((record) => record.entry_type === "INDIVIDUAL")
      .map(mapInventoryToUnified);

    const rawBatches = batchesQuery.data;
    const batchList: RegistryBatchRecord[] = Array.isArray(rawBatches)
      ? rawBatches
      : [];
    const herds = batchId ? [] : batchList.map(mapBatchToUnified);

    return [...individuals, ...herds].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [inventoryQuery.data, batchesQuery.data, batchId]);

  // Open an inventory review dialog after navigating here from the review queue.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!reviewId || inventoryQuery.isLoading) return;
    const submission = registryRecords.find(
      (record) => record.sourceType === (reviewType || "INVENTORY") && String(record.rawId) === reviewId,
    );
    if (submission) {
      setFocusedRecordId(submission.id);
      setSelectedSubmission(submission);
    }
  }, [inventoryQuery.isLoading, registryRecords, reviewId, reviewType]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const focusRecordKey = focusedRecordId || (reviewId ? `inv-${reviewId}` : null);

  // Unique barangays in loaded data
  const availableBarangays = useMemo(() => {
    const set = new Set<string>();
    registryRecords.forEach((r) => {
      if (r.barangayName) set.add(r.barangayName);
    });
    return Array.from(set).sort();
  }, [registryRecords]);

  // Unique record types in loaded data
  const availableRecordTypes = useMemo(() => {
    const set = new Set<string>();
    set.add("Individual Tagged");
    set.add("Herd / Batch");
    registryRecords.forEach((r) => {
      if (r.livestockTypeName) set.add(r.livestockTypeName);
    });
    return Array.from(set);
  }, [registryRecords]);

  // Filter pipeline
  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();

    return registryRecords.filter((record) => {
      // 1. Text Query (farmer name or record ID)
      if (q) {
        const matchesQuery =
          `${record.farmerName} ${record.tagNumber || ""} ${record.batchCode || ""} ${record.rawId}`
            .toLowerCase()
            .includes(q) ||
          (record.barangayName && record.barangayName.toLowerCase().includes(q)) ||
          (record.livestockTypeName && record.livestockTypeName.toLowerCase().includes(q)) ||
          (record.breed && record.breed.toLowerCase().includes(q));

        if (!matchesQuery) return false;
      }

      // 2. Barangay Filter
      if (barangay !== "All Barangays" && record.barangayName !== barangay) {
        return false;
      }

      // 3. Record Type Filter
      if (recordType !== "All Record Types") {
        if (recordType === "Individual Tagged" && record.entryType !== "INDIVIDUAL") {
          return false;
        }
        if (recordType === "Herd / Batch" && record.entryType !== "BATCH") {
          return false;
        }
        if (recordType !== "Individual Tagged" && recordType !== "Herd / Batch") {
          if (record.livestockTypeName?.toLowerCase() !== recordType.toLowerCase()) {
            return false;
          }
        }
      }

      // 4. Status Filter
      if (status !== "ALL") {
        const recStatus = record.status?.toUpperCase();
        if (status === "SUBJECT_TO_REVISION") {
          if (recStatus !== "SUBJECT_TO_REVISION" && recStatus !== "SUBJECT_FOR_REVISION") {
            return false;
          }
        } else if (recStatus !== status) {
          return false;
        }
      }

      return true;
    });
  }, [registryRecords, query, barangay, recordType, status]);

  // Reset page when any filter updates


  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const focusedIndex = focusRecordKey
    ? filteredRecords.findIndex((record) => record.id === focusRecordKey)
    : -1;
  const focusedPage = focusedIndex >= 0 ? Math.floor(focusedIndex / PAGE_SIZE) + 1 : null;
  const page = focusedPage ?? Math.min(requestedPage, pageCount);
  const pageRecords = useMemo(
    () => filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRecords, page]
  );

  useEffect(() => {
    if (!focusRecordKey) return;
    const frame = window.requestAnimationFrame(() => {
      const matches = document.querySelectorAll<HTMLElement>(`[data-review-record-id="${focusRecordKey}"]`);
      Array.from(matches).find((element) => element.getClientRects().length > 0)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusRecordKey, pageRecords, reviewId]);



  const isLoading = inventoryQuery.isLoading || (!batchId && batchesQuery.isLoading);
  const isInitialLoading = isLoading && registryRecords.length === 0;
  const keepLoadingScreenMounted = useLoadingScreenTransition(isInitialLoading);
  const failedSources = [
    ...(inventoryQuery.isError ? ["individual livestock"] : []),
    ...(!batchId && batchesQuery.isError ? ["herds"] : []),
  ];
  const canLoadRegistry = hasAllBarangayAccess || Boolean(assignedBarangayId);

  const registryScopeLabel = hasAllBarangayAccess
    ? "All authorized barangays across Padre Garcia"
    : user?.assignedBarangayName
      ? `${user.assignedBarangayName}`
      : "Your assigned barangay";

  const hasActiveFilters =
    query.trim() !== "" ||
    barangay !== "All Barangays" ||
    recordType !== "All Record Types" ||
    status !== "ALL";

  const handleResetFilters = () => {
    setQuery("");
    setBarangay("All Barangays");
    setRecordType("All Record Types");
    setStatus("ALL");
    setPage(1);
  };

  if (isInitialLoading || keepLoadingScreenMounted) {
    return (
      <>
        <PageHeader
          title="Farmer Records"
          subtitle="Find, review, and validate information submitted by farmers."
          variant="farmer"
          maxWidthClass="w-full"
          icon={<ClipboardList className="size-5 text-white" />}
        />
        <div className="mx-auto w-full p-3.5 sm:p-6 lg:px-8">
          <ValidationLoadingScreen
            isLoading={isInitialLoading}
            title="Loading Farmer Records Registry"
            subtitle="Synchronizing individual livestock registrations, herd submissions, and barangay records..."
            badgeLabel="Farmer Records Sync"
            authorityText="SIBAT Field Validation · Padre Garcia, Batangas"
            items={[
              {
                id: "individual",
                label: "Individual Livestock",
                sublabel: "Cattle, carabao, and horse registration records",
                icon: <Tag className="size-4 text-emerald-700" />,
                loaded: !inventoryQuery.isLoading,
              },
              {
                id: "herds",
                label: "Herd Submissions",
                sublabel: "Swine, goat, and poultry batch records",
                icon: <Layers className="size-4 text-sky-600" />,
                loaded: batchId ? true : !batchesQuery.isLoading,
              },
              {
                id: "barangay",
                label: "Barangay Coverage",
                sublabel: registryScopeLabel,
                icon: <MapPin className="size-4 text-amber-600" />,
                loaded: !inventoryQuery.isLoading && (!batchesQuery.isLoading || Boolean(batchId)),
              },
            ]}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Farmer Records"
        subtitle="Find, review, and validate information submitted by farmers."
        variant="farmer"
        maxWidthClass="w-full"
        icon={<ClipboardList className="size-5 text-white" />}
      />

      <main className="mx-auto w-full min-w-0 space-y-4 px-3.5 py-4 sm:p-6 lg:px-8">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/sibat"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to Field Review Hub
          </Link>

          {batchId && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 rounded-xl text-xs font-bold border-slate-200"
            >
              <Link href={`/sibat/batches?batchId=${encodeURIComponent(batchId)}`}>
                <Layers className="size-3.5 mr-1" /> View Herd #{batchId}
              </Link>
            </Button>
          )}
        </div>

        {/* Scope Strip */}
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 rounded-2xl border border-emerald-200/90 bg-emerald-50/70 p-3 sm:px-4 text-xs sm:text-sm text-emerald-950 shadow-2xs">
          <MapPin className="size-4.5 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            Showing only records from your assigned barangays:{" "}
            <strong className="font-bold text-emerald-900">{registryScopeLabel}</strong>.
          </span>
        </div>

        {/* Alerts if scope is missing or request failed */}
        {!canLoadRegistry && (
          <div
            role="alert"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-950"
          >
            This SIBAT account has no assigned barangay. Ask MAO/Admin to assign one before viewing
            approved farmer records.
          </div>
        )}

        {failedSources.length > 0 && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-900"
          >
            <p>
              Could not load {failedSources.join(" and ")}. Successfully loaded records remain visible.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 shrink-0 self-start sm:self-auto rounded-xl font-bold"
              onClick={() => {
                if (inventoryQuery.isError) void inventoryQuery.refetch();
                if (batchesQuery.isError) void batchesQuery.refetch();
              }}
            >
              <RotateCcw className="size-3.5" /> Retry
            </Button>
          </div>
        )}

        {/* Filter Card */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs p-3.5 sm:p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Search Box */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by farmer name or record ID"
                aria-label="Search records"
                className="pl-9.5 pr-8 bg-slate-50/80 border-slate-200 rounded-xl h-10 text-xs sm:text-sm focus-visible:ring-[#1A365D]/20 placeholder:text-slate-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* 2. Filter by Barangay */}
            <Select value={barangay} onValueChange={(val) => setBarangay(val)}>
              <SelectTrigger
                aria-label="Filter by barangay"
                className="h-10 rounded-xl border-slate-200 bg-slate-50/80 text-xs sm:text-sm cursor-pointer"
              >
                <SelectValue placeholder="All Barangays" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Barangays">All Barangays</SelectItem>
                {availableBarangays.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 3. Filter by Record Type */}
            <Select value={recordType} onValueChange={(val) => setRecordType(val)}>
              <SelectTrigger
                aria-label="Filter by record type"
                className="h-10 rounded-xl border-slate-200 bg-slate-50/80 text-xs sm:text-sm cursor-pointer"
              >
                <SelectValue placeholder="All Record Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Record Types">All Record Types</SelectItem>
                {availableRecordTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 4. Filter by Status */}
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as RegistryStatusFilter)}
            >
              <SelectTrigger
                aria-label="Filter by status"
                className="h-10 rounded-xl border-slate-200 bg-slate-50/80 text-xs sm:text-sm cursor-pointer"
              >
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending Review</SelectItem>
                <SelectItem value="SUBJECT_TO_REVISION">Needs Correction</SelectItem>
                <SelectItem value="VERIFIED">Validated</SelectItem>
                <SelectItem value="APPROVED">Forwarded to MAO (Approved)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset button when active filters */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">Filters currently active</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-7 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-lg cursor-pointer gap-1"
              >
                <RotateCcw className="size-3" />
                Reset filters
              </Button>
            </div>
          )}
        </Card>

        {/* Result Line */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs sm:text-sm px-1 font-medium text-slate-500">
          <strong className="text-slate-900 font-bold">
            {filteredRecords.length} {filteredRecords.length === 1 ? "record" : "records"} found
          </strong>
          <span>Showing farmer submissions</span>
        </div>

        {/* Loading State */}
        {isLoading && pageRecords.length === 0 ? (
          <Card className="p-12 text-center rounded-2xl border border-slate-200 bg-white">
            <p className="text-sm font-semibold text-slate-500">Loading farmer records…</p>
          </Card>
        ) : filteredRecords.length > 0 ? (
          /* Main Records List: Desktop Table + Mobile Cards */
          <div className="space-y-4">
            {/* DESKTOP TABLE VIEW (hidden on mobile, visible on md+) */}
            <Card className="hidden md:block rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                      <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 pl-5">
                        Record ID
                      </TableHead>
                      <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5">
                        Farmer
                      </TableHead>
                      <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5">
                        Record Type
                      </TableHead>
                      <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 text-center">
                        Date Submitted
                      </TableHead>
                      <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 text-center">
                        Status
                      </TableHead>
                      <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 text-right pr-5">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRecords.map((r) => {
                      const isIndividual = r.entryType === "INDIVIDUAL";
                      const isBatch = r.entryType === "BATCH" || r.sourceType === "BATCH";
                      const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—";

                      return (
                        <TableRow
                          key={`${r.sourceType}-${r.rawId}`}
                          data-review-record-id={r.id}
                          className={`cursor-pointer border-b border-slate-100 transition-colors ${r.id === focusRecordKey ? "bg-emerald-50 ring-2 ring-inset ring-emerald-400" : "hover:bg-slate-50/80"}`}
                          onClick={() => {
                            if (isIndividual) {
                              setFocusedRecordId(r.id);
                              setSelectedSubmission(r);
                            }
                          }}
                        >
                          {/* Record ID */}
                          <TableCell className="py-3.5 pl-5">
                            <b className="font-mono text-xs font-black text-slate-900 block">
                              {r.tagNumber || r.batchCode || `#${r.rawId}`}
                            </b>
                            <span className="block text-[11px] text-slate-400 font-medium">
                              {isBatch
                                ? r.batchName || "Herd Container"
                                : r.breed || r.sex || "Individual Animal"}
                            </span>
                          </TableCell>

                          {/* Farmer & Barangay */}
                          <TableCell className="py-3.5">
                            <b className="font-bold text-xs text-slate-900 block">{r.farmerName}</b>
                            <span className="text-[11px] font-medium text-slate-500">
                              {r.barangayName}
                            </span>
                          </TableCell>

                          {/* Record Type */}
                          <TableCell className="py-3.5">
                            <span className="font-semibold text-xs text-slate-800 block">
                              {r.livestockTypeName || (isBatch ? "Herd" : "Livestock")}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {isBatch ? `${r.quantity} heads` : "Individual Tagged"}
                            </span>
                          </TableCell>

                          {/* Date Submitted */}
                          <TableCell className="text-center py-3.5">
                            <span className="text-xs font-mono font-medium text-slate-600">
                              {dateStr}
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="text-center py-3.5">
                            <SibatStatusBadge status={r.status as UnifiedStatus} />
                          </TableCell>

                          {/* Action */}
                          <TableCell className="text-right py-3.5 pr-5">
                            {isBatch ? (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 px-3 rounded-xl text-xs font-extrabold text-[#1A365D] border-slate-200 hover:bg-slate-100 cursor-pointer"
                              >
                                <Link href={`/sibat/batches?batchId=${r.rawId}`}>
                                  <Layers className="size-3.5 mr-1" /> Review Herd
                                </Link>
                              </Button>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                {(r.batchId || r.batchCode) && (
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-8 px-2.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 border-teal-300 hover:bg-teal-100 cursor-pointer"
                                    title={`Review parent herd ${r.batchCode || ""}`}
                                  >
                                    <Link href={`/sibat/batches?batchId=${encodeURIComponent(r.batchId || r.batchCode || "")}&animalId=${r.rawId}&tag=${encodeURIComponent(r.tagNumber || "")}`}>
                                      <Layers className="size-3.5 mr-1 text-teal-700" /> Review Herd
                                    </Link>
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFocusedRecordId(r.id);
                                    setSelectedSubmission(r);
                                  }}
                                  className="h-8 px-3 rounded-xl text-xs font-extrabold bg-slate-50 hover:bg-[#1A365D] hover:text-white text-slate-800 border-slate-200 transition-all cursor-pointer"
                                >
                                  <Eye className="size-3.5 mr-1" /> Review Record
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* MOBILE CARDS VIEW (visible on mobile < md, hidden on md+) */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {pageRecords.map((r) => {
                const isIndividual = r.entryType === "INDIVIDUAL";
                const isBatch = r.entryType === "BATCH" || r.sourceType === "BATCH";
                const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—";

                return (
                  <article
                    key={`mobile-${r.sourceType}-${r.rawId}`}
                    data-review-record-id={r.id}
                    className={`rounded-2xl border p-4 shadow-2xs space-y-2.5 transition-all ${r.id === focusRecordKey ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-300" : "border-slate-200/90 bg-white"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <b className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                        {r.tagNumber || r.batchCode || `#${r.rawId}`}
                      </b>
                      <SibatStatusBadge status={r.status as UnifiedStatus} />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {r.livestockTypeName || (isBatch ? "Herd" : "Livestock")}
                        {isBatch ? ` (${r.quantity} heads)` : ""}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        <b className="text-slate-900 font-bold">{r.farmerName}</b> • {r.barangayName}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>Submitted {dateStr}</span>
                      {r.breed && <span className="font-medium text-slate-500">{r.breed}</span>}
                    </div>

                    {isBatch ? (
                      <Button
                        asChild
                        variant="outline"
                        className="w-full h-10 rounded-xl text-xs font-extrabold text-[#1A365D] border-slate-200 hover:bg-slate-100 mt-2 cursor-pointer"
                      >
                        <Link href={`/sibat/batches?batchId=${r.rawId}`}>
                          <Layers className="size-3.5 mr-1" /> Review Herd
                        </Link>
                      </Button>
                    ) : (
                      <div className="space-y-1.5 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { setFocusedRecordId(r.id); setSelectedSubmission(r); }}
                          className="w-full h-10 rounded-xl text-xs font-extrabold bg-[#1A365D] text-white hover:bg-[#132742] cursor-pointer shadow-2xs"
                        >
                          <Eye className="size-3.5 mr-1" /> Review Record
                        </Button>
                        {(r.batchId || r.batchCode) && (
                          <Button
                            asChild
                            variant="outline"
                            className="w-full h-9 rounded-xl text-xs font-bold text-teal-800 bg-teal-50/70 border-teal-300 hover:bg-teal-100 cursor-pointer"
                          >
                            <Link href={`/sibat/batches?batchId=${encodeURIComponent(r.batchId || r.batchCode || "")}&animalId=${r.rawId}&tag=${encodeURIComponent(r.tagNumber || "")}`}>
                              <Layers className="size-3.5 mr-1 text-teal-700" /> Review Herd ({r.batchCode || "Parent Herd"})
                            </Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Pagination footer */}
            {filteredRecords.length > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-white rounded-2xl border border-slate-200/80 shadow-2xs px-4 py-3 text-xs">
                <span className="text-[11px] text-slate-500 font-medium">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filteredRecords.length)} of {filteredRecords.length} records
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="h-7 rounded-xl text-[10px] font-bold cursor-pointer"
                  >
                    ‹ Prev
                  </Button>
                  <span className="px-2.5 py-1 rounded-xl bg-[#1A365D] text-white font-black text-[10px]">
                    Page {page} / {pageCount}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-7 rounded-xl text-[10px] font-bold cursor-pointer"
                  >
                    Next ›
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <Card className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-2xs">
            <div className="mx-auto size-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Search className="size-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No records found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto font-medium">
              Try changing the search words or filters.
            </p>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="mt-4 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
              >
                Reset Filters
              </Button>
            )}
          </Card>
        )}
      </main>

      {/* Review Dialog */}
      {selectedSubmission && (
        <SibatReviewDialog
          submission={selectedSubmission}
          open={selectedSubmission !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedSubmission(null);
              if (reviewId) router.replace("/sibat/livestock-registry", { scroll: false });
            }
          }}
          onReviewSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["sibat", "livestock-registry"] });
          }}
        />
      )}
    </>
  );
}

export default function SibatLivestockRegistryPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader
            title="Farmer Records"
            subtitle="Find, review, and validate information submitted by farmers."
            variant="farmer"
            maxWidthClass="w-full"
            icon={<ClipboardList className="size-5 text-white" />}
          />
          <div className="mx-auto w-full p-3.5 sm:p-6 lg:px-8">
            <ValidationLoadingScreen
              isLoading={true}
              title="Loading Farmer Records Registry"
              subtitle="Synchronizing individual livestock registrations, herd submissions, and barangay records..."
              badgeLabel="Farmer Records Sync"
              authorityText="SIBAT Field Validation · Padre Garcia, Batangas"
              items={[
                {
                  id: "individual",
                  label: "Individual Livestock",
                  sublabel: "Cattle, carabao, and horse registration records",
                  icon: <Tag className="size-4 text-emerald-700" />,
                  loaded: false,
                },
                {
                  id: "herds",
                  label: "Herd Submissions",
                  sublabel: "Swine, goat, and poultry batch records",
                  icon: <Layers className="size-4 text-sky-600" />,
                  loaded: false,
                },
                {
                  id: "barangay",
                  label: "Barangay Coverage",
                  sublabel: "Barangay-scoped field records",
                  icon: <MapPin className="size-4 text-amber-600" />,
                  loaded: false,
                },
              ]}
            />
          </div>
        </>
      }
    >
      <SibatLivestockRegistryContent />
    </Suspense>
  );
}
