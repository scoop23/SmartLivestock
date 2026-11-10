"use client";

import type { BatchApiItem, LivestockBatchItem } from "@/app/(farmer)/livestock-inventory/livestock-inventory";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ValidationLoadingScreen, useLoadingScreenTransition } from "@/components/validation-loading-screen";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { cowHead } from "@lucide/lab";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Baby,
  Check,
  ChevronDown,
  ClipboardList,
  Eye,
  FileSpreadsheet,
  History,
  Icon,
  Layers,
  LayoutGrid,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  TableProperties,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import CensusDetailsDialog from "../census-details-dialog";
import CensusSubmissionsView from "../census-submissions-view";
import SibatReviewDialog from "../components/sibat-review-dialog";
import SibatStatusBadge from "../components/sibat-status-badge";
import {
  mapBatchToUnified,
  mapCalvingToUnified,
  mapInventoryToUnified,
  useCalvingFromFarmers,
  useCensusSubmission,
  type CensusSubmissionRecord,
  type RawInventoryRecord,
  type UnifiedStatus,
  type UnifiedSubmissionItem,
} from "../sibat-analytics";

const CowHeadIcon = ({ className }: { className?: string }) => (
  <Icon iconNode={cowHead} className={className} />
);

const PAGE_SIZE = 10;
type RegistryStatusFilter = "ALL" | "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";
type RegistryTab = "all" | "individual" | "herds" | "calving" | "census";

type RegistryBatchRecord = BatchApiItem;

function RegistryRecordsSkeleton({ viewMode }: { viewMode: "table" | "card" }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Loading Banner Card */}
      <Card className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
              <Loader2 className="size-4.5 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-slate-900 tracking-tight">
                  Loading farmer records…
                </h4>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Retrieving individual livestock passports, ear tags, and herd registries...
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-white/80 border border-emerald-200/80 px-3 py-1.5 rounded-xl shadow-2xs self-start sm:self-auto">
            <Tag className="size-3.5 text-emerald-600" />
            <span>Synchronizing ledger…</span>
          </div>
        </div>
      </Card>

      {/* View-Specific Skeleton */}
      {viewMode === "table" ? (
        <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                  <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 pl-5">
                    Ear Tag / Herd Tag
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
                {[...Array(6)].map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100 hover:bg-transparent">
                    {/* Ear Tag / Herd Tag */}
                    <TableCell className="py-4 pl-5">
                      <Skeleton className="h-4 w-28 rounded-md bg-slate-200" />
                      <Skeleton className="h-3 w-40 rounded-md bg-slate-100 mt-1.5" />
                    </TableCell>
                    {/* Farmer */}
                    <TableCell className="py-4">
                      <Skeleton className="h-4 w-32 rounded-md bg-slate-200" />
                      <Skeleton className="h-3 w-24 rounded-md bg-slate-100 mt-1.5" />
                    </TableCell>
                    {/* Record Type */}
                    <TableCell className="py-4">
                      <Skeleton className="h-6 w-24 rounded-lg bg-slate-100" />
                    </TableCell>
                    {/* Date Submitted */}
                    <TableCell className="py-4 text-center">
                      <Skeleton className="h-4 w-20 mx-auto rounded-md bg-slate-100" />
                    </TableCell>
                    {/* Status */}
                    <TableCell className="py-4 text-center">
                      <Skeleton className="h-6 w-24 mx-auto rounded-full bg-slate-100" />
                    </TableCell>
                    {/* Action */}
                    <TableCell className="py-4 text-right pr-5">
                      <Skeleton className="h-8 w-28 ml-auto rounded-xl bg-slate-100" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* Cards View Skeleton */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-5 w-24 rounded-lg bg-slate-200" />
                <Skeleton className="h-5 w-20 rounded-full bg-slate-100" />
              </div>
              <div className="space-y-1.5 pt-1">
                <Skeleton className="h-4 w-3/4 rounded-md bg-slate-200" />
                <Skeleton className="h-3 w-1/2 rounded-md bg-slate-100" />
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Skeleton className="h-4 w-20 rounded-md bg-slate-100" />
                <Skeleton className="h-4 w-16 rounded-md bg-slate-100" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl bg-slate-100 mt-2" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Livestock Records Registry for SIBAT / CBAT field officers.
 * Unified view for Animals (All & Individual), Herds, and Quarterly Census records.
 */
function SibatLivestockRegistryContent() {
  const [isEnteringRegistry, setIsEnteringRegistry] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setIsEnteringRegistry(false), 700);
    return () => window.clearTimeout(timer);
  }, []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const showHistory = searchParams.get("history") === "true";
  const batchId = searchParams.get("batchId");
  const focusId = searchParams.get("focusId");
  const reviewId = searchParams.get("reviewId");
  const reviewType = searchParams.get("reviewType");
  const tabParam = searchParams.get("tab") as RegistryTab | null;

  const initialTab: RegistryTab =
    tabParam === "individual" || tabParam === "herds" || tabParam === "calving" || tabParam === "census"
      ? tabParam
      : batchId
        ? "herds"
        : "all";
  const [activeTab, setActiveTab] = useState<RegistryTab>(initialTab);

  const [query, updateQuery] = useState("");
  const setQuery = (value: string) => { updateQuery(value); setPage(1); };
  const [barangay, updateBarangay] = useState("All Barangays");
  const [farmer, updateFarmer] = useState("All Farmers");
  const setBarangay = (value: string) => {
    updateBarangay(value);
    updateFarmer("All Farmers");
    setPage(1);
  };
  const setFarmer = (value: string) => { updateFarmer(value); setPage(1); };
  const [species, updateSpecies] = useState("All Species");
  const setSpecies = (value: string) => { updateSpecies(value); setPage(1); };
  const [status, updateStatus] = useState<RegistryStatusFilter>(() => (batchId ? "ALL" : "ALL"));
  const setStatus = (value: RegistryStatusFilter) => { updateStatus(value); setPage(1); };
  const [requestedPage, setPage] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<UnifiedSubmissionItem | null>(null);
  const [focusedRecordId, setFocusedRecordId] = useState<string | null>(null);

  // Census records state
  const {
    data: censuses = [],
    isLoading: isLoadingCensus,
    isError: isCensusError,
    refetch: refetchCensus,
  } = useCensusSubmission();
  const [selectedCensusForDetail, setSelectedCensusForDetail] = useState<CensusSubmissionRecord | null>(null);

  // View Mode: Table vs Card view (defaults to card on small screens, table on desktop)
  const [viewMode, setViewMode] = useState<"table" | "card">(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? "card" : "table"
  );
  const recordsSectionRef = useRef<HTMLDivElement>(null);
  const firstRecordRef = useRef<HTMLElement | null>(null);
  const recordsListRef = useRef<HTMLDivElement>(null);
  const censusListRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeTab]);

  // Smooth scroll down to records when active tab changes on mobile/tablet so 1st card is in view
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      const timer = setTimeout(() => {
        if (activeTab === "census") {
          censusListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (firstRecordRef.current) {
          firstRecordRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (recordsListRef.current) {
          recordsListRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const scopeKey = [user?.email, user?.accessScope, user?.assignedBarangayId];
  const hasAllBarangayAccess = user?.accessScope === "ALL_BARANGAYS";
  const assignedBarangayId = user?.assignedBarangayId;
  const barangayFilter = hasAllBarangayAccess ? undefined : assignedBarangayId;

  // Fetch individual inventory items for this SIBAT's scope
  const inventoryQuery = useQuery({
    queryKey: ["sibat", "livestock-registry", "inventory", batchId, ...scopeKey],
    queryFn: async () => {
      const response = await api.get<RawInventoryRecord[] | { count: number; results: RawInventoryRecord[] }>(
        "livestock/inventory/",
        {
          params: {
            include_inactive: true,
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
    enabled: Boolean(user),
  });

  // Fetch herd containers
  const batchesQuery = useQuery({
    queryKey: ["sibat", "livestock-registry", "batches", batchId, ...scopeKey],
    queryFn: async () => {
      const response = await api.get<RegistryBatchRecord[] | { count: number; results: RegistryBatchRecord[] }>(
        "livestock/batches/",
        {
          params: barangayFilter ? { barangay_id: barangayFilter } : undefined,
        }
      );
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) return data.results as RegistryBatchRecord[];
      return [];
    },
    staleTime: 30_000,
    enabled: !batchId && Boolean(user),
  });

  // Fetch calving & birth records
  const calvingQuery = useCalvingFromFarmers();

  // Combine and sort records
  const registryRecords = useMemo(() => {
    const rawInv = inventoryQuery.data;
    const invList: RawInventoryRecord[] = Array.isArray(rawInv)
      ? rawInv
      : rawInv && Array.isArray((rawInv as unknown as { results: RawInventoryRecord[] }).results)
        ? (rawInv as unknown as { results: RawInventoryRecord[] }).results
        : [];
    const visibleInventory = invList.filter((record) =>
      ((record.operational_status || "ACTIVE") !== "ACTIVE") === showHistory);
    const individuals = visibleInventory
      .filter((record) => record.entry_type === "INDIVIDUAL" || !record.entry_type)
      .map(mapInventoryToUnified);
    const batchInventories = visibleInventory
      .filter((record) => record.entry_type === "BATCH")
      .map(mapInventoryToUnified);

    const rawBatches = batchesQuery.data;
    const batchList: RegistryBatchRecord[] = Array.isArray(rawBatches)
      ? rawBatches
      : rawBatches && Array.isArray((rawBatches as unknown as { results: RegistryBatchRecord[] }).results)
        ? (rawBatches as unknown as { results: RegistryBatchRecord[] }).results
        : [];
    const herds = batchId || showHistory ? [] : batchList.map(mapBatchToUnified);

    const rawCalvings = calvingQuery.data;
    const calvings = batchId || showHistory
      ? []
      : (Array.isArray(rawCalvings) ? rawCalvings : []).map(mapCalvingToUnified);

    return [...individuals, ...batchInventories, ...herds, ...calvings].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [inventoryQuery.data, batchesQuery.data, calvingQuery.data, batchId, showHistory]);

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

  const linkedRecord = focusId
    ? registryRecords.find((record) => record.sourceType === "INVENTORY" && String(record.rawId) === focusId)
    : null;
  const focusRecordKey = focusedRecordId || linkedRecord?.id || (reviewId ? `inv-${reviewId}` : null);

  // Unique barangays in loaded data
  const availableBarangays = useMemo(() => {
    const set = new Set<string>();
    registryRecords.forEach((r) => {
      if (r.barangayName) set.add(r.barangayName);
    });
    return Array.from(set).sort();
  }, [registryRecords]);

  // Unique farmers in loaded data (strictly scoped to the SIBAT's assigned barangay or selected barangay)
  const availableFarmers = useMemo(() => {
    const set = new Set<string>();
    const targetBarangay = !hasAllBarangayAccess && user?.assignedBarangayName
      ? user.assignedBarangayName.trim().toLowerCase()
      : barangay !== "All Barangays"
        ? barangay.trim().toLowerCase()
        : null;

    registryRecords.forEach((r) => {
      if (targetBarangay && (r.barangayName || "").trim().toLowerCase() !== targetBarangay) {
        return;
      }
      if (r.farmerName) set.add(r.farmerName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [registryRecords, barangay, hasAllBarangayAccess, user]);

  // Unique livestock species in loaded data
  const availableSpecies = useMemo(() => {
    const set = new Set<string>();
    registryRecords.forEach((r) => {
      if (r.livestockTypeName) set.add(r.livestockTypeName);
    });
    return Array.from(set);
  }, [registryRecords]);

  // Tab counts
  const allCount = registryRecords.filter(
    (r) => r.sourceType === "INVENTORY" && r.entryType === "INDIVIDUAL"
  ).length;
  const individualCount = useMemo(
    () => registryRecords.filter((r) => r.sourceType === "INVENTORY" && r.entryType === "INDIVIDUAL").length,
    [registryRecords]
  );
  const herdsCount = useMemo(
    () => registryRecords.filter((r) => r.entryType === "BATCH").length,
    [registryRecords]
  );
  const calvingCount = useMemo(
    () => registryRecords.filter((r) => r.sourceType === "CALVING").length,
    [registryRecords]
  );
  const censusCount = censuses.length;
  const existingTags = useMemo(
    () => registryRecords.map((r) => r.tagNumber).filter(Boolean) as string[],
    [registryRecords]
  );

  const handleTabChange = (tab: RegistryTab) => {
    firstRecordRef.current = null;
    setActiveTab(tab);
    setPage(1);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("tab", tab);
    router.replace(`/sibat/livestock-registry?${newParams.toString()}`, { scroll: false });
  };

  const handleHistoryToggle = (history: boolean) => {
    if (history === showHistory) return;
    firstRecordRef.current = null;
    setPage(1);
    const newParams = new URLSearchParams(searchParams.toString());
    if (history) {
      newParams.set("history", "true");
    } else {
      newParams.delete("history");
    }
    router.replace(`/sibat/livestock-registry?${newParams.toString()}`, { scroll: false });
  };

  // Filter pipeline
  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();

    return registryRecords.filter((record) => {
      // 0. Tab Filter
      if (activeTab === "all" && (record.sourceType !== "INVENTORY" || record.entryType !== "INDIVIDUAL")) {
        return false;
      }
      if (activeTab === "individual" && (record.sourceType !== "INVENTORY" || record.entryType !== "INDIVIDUAL")) {
        return false;
      }
      if (activeTab === "herds" && record.entryType !== "BATCH") {
        return false;
      }
      if (activeTab === "calving" && record.sourceType !== "CALVING") {
        return false;
      }

      // 1. Text Query (farmer name or record ID)
      if (q) {
        const matchesQuery =
          `${record.farmerName} ${record.tagNumber || ""} ${record.calfTag || ""} ${record.damTag || ""} ${record.batchCode || ""} ${record.rawId}`
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

      // 2b. Farmer Filter
      if (farmer !== "All Farmers" && record.farmerName !== farmer) {
        return false;
      }

      // 3. Species Filter
      if (species !== "All Species" && record.livestockTypeName?.toLowerCase() !== species.toLowerCase()) {
        return false;
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
  }, [registryRecords, activeTab, query, barangay, farmer, species, status]);

  // Reset page when any filter updates


  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const pageRecords = useMemo(
    () => filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRecords, page]
  );

  // Jump to page if URL contains focusId or reviewId on initial load
  const [hasHandledInitialFocus, setHasHandledInitialFocus] = useState(false);
  useEffect(() => {
    if (hasHandledInitialFocus || filteredRecords.length === 0) return;
    const targetRawId = focusId || reviewId;
    if (!targetRawId) return;

    const targetIndex = filteredRecords.findIndex(
      (record) => String(record.rawId) === targetRawId || record.id === focusId || record.id === `inv-${reviewId}`
    );
    if (targetIndex >= 0) {
      const targetPage = Math.floor(targetIndex / PAGE_SIZE) + 1;
      setPage(targetPage);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusedRecordId(filteredRecords[targetIndex].id);
      setHasHandledInitialFocus(true);
    }
  }, [focusId, reviewId, filteredRecords, hasHandledInitialFocus]);

  // Smooth scroll to record only when navigating via deep-link
  useEffect(() => {
    if (!focusId && !reviewId) return;
    if (!focusRecordKey) return;
    const frame = window.requestAnimationFrame(() => {
      const match = document.querySelector<HTMLElement>(`[data-review-record-id="${focusRecordKey}"]`);
      match?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusRecordKey, focusId, reviewId]);



  const isLoading = inventoryQuery.isLoading || (!batchId && batchesQuery.isLoading);
  const isInitialLoading = isEnteringRegistry || isLoading;
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
    farmer !== "All Farmers" ||
    species !== "All Species" ||
    status !== "ALL";

  const handleResetFilters = () => {
    setQuery("");
    setBarangay("All Barangays");
    setFarmer("All Farmers");
    setSpecies("All Species");
    setStatus("ALL");
    setPage(1);
  };

  if (isInitialLoading || keepLoadingScreenMounted) {
    return (
      <>
        <PageHeader
          title="Livestock Records"
          subtitle="Animals, Herds, and Census records in one place"
          variant="farmer"
          maxWidthClass="w-full"
          icon={<Icon iconNode={cowHead} className="size-5 text-white" />}
          hideIconOnMobile
          showTutorialToggle={false}
          mobileActionsInline
        />
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <ValidationLoadingScreen
            isLoading={isInitialLoading}
            title="Loading Farmer Records"
            subtitle="Synchronizing individual livestock registrations, herd submissions, and barangay records..."
            badgeLabel="Livestock Records Sync"
            authorityText="SIBAT Field Validation · Padre Garcia, Batangas"
            items={[
              {
                id: "individual",
                label: "Individual Livestock",
                sublabel: "Animal identification and registration records",
                icon: <Tag className="size-4 text-emerald-700" />,
                loaded: !inventoryQuery.isLoading,
              },
              {
                id: "herds",
                label: "Herd Submissions",
                sublabel: "Herd rosters and field verification records",
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
        title={showHistory ? "Animal History" : "Livestock Records"}
        subtitle={showHistory ? "Sold, deceased, slaughtered, and moved-out animals. Excluded from current population." : "Animals, Herds, and Census records in one place"}
        variant="farmer"
        maxWidthClass="w-full"
        icon={<Icon iconNode={cowHead} className="size-5 text-white" />}
        hideIconOnMobile
        showTutorialToggle={false}
        mobileActionsInline
      />

      {/* ── TOP NAVIGATION & UNIFIED RECORD TABS ── */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-3 sm:space-y-4">
        {/* Navigation Breadcrumb / Back Link & Population Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <Link
            href="/sibat"
            className="group inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" /> Back to Dashboard
          </Link>

          <div className="flex items-center gap-2">
            {batchId && activeTab !== "herds" && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 transition-all"
              >
                <Link href={`/sibat/batches?batchId=${encodeURIComponent(batchId)}&from=registry`}>
                  <Layers className="size-3.5 mr-1" /> View Herd #{batchId}
                </Link>
              </Button>
            )}

            {/* Current Animals / Animal History Dropdown Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "group relative h-9 gap-2 rounded-xl border px-3 text-xs font-bold shadow-2xs transition-all duration-200 hover:shadow-xs active:scale-[0.98] cursor-pointer",
                    showHistory
                      ? "border-amber-200/90 bg-amber-50/70 text-amber-950 hover:bg-amber-100/80 hover:border-amber-300"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {showHistory ? (
                      <History className="size-3.5 text-amber-600 transition-transform duration-300 group-hover:-rotate-45" />
                    ) : (
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                      </span>
                    )}
                    <span className="font-extrabold tracking-tight">
                      {showHistory ? "Animal History" : "Current Animals"}
                    </span>
                  </div>
                  <ChevronDown className="size-3.5 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180 group-hover:text-slate-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 duration-200"
              >
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Registry Population
                </div>
                <DropdownMenuItem
                  onClick={() => handleHistoryToggle(false)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold transition-all duration-150",
                    !showHistory
                      ? "bg-emerald-50/80 text-emerald-950 font-black"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="relative flex size-2 shrink-0">
                      {!showHistory && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      )}
                      <span
                        className={cn(
                          "relative inline-flex size-2 rounded-full",
                          !showHistory ? "bg-emerald-500" : "bg-slate-300"
                        )}
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="leading-snug">Current Animals</p>
                      <p className="text-[10px] font-medium text-slate-500">Active livestock</p>
                    </div>
                  </div>
                  {!showHistory && (
                    <Check className="size-3.5 text-emerald-600 shrink-0 animate-in zoom-in-50 duration-200" />
                  )}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => handleHistoryToggle(true)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold transition-all duration-150",
                    showHistory
                      ? "bg-amber-50/80 text-amber-950 font-black"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <History
                      className={cn(
                        "size-3.5 shrink-0 transition-transform duration-200 group-hover:-rotate-45",
                        showHistory ? "text-amber-600" : "text-slate-400"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="leading-snug">Animal History</p>
                      <p className="text-[10px] font-medium text-slate-500">Sold, deceased, moved</p>
                    </div>
                  </div>
                  {showHistory && (
                    <Check className="size-3.5 text-amber-600 shrink-0 animate-in zoom-in-50 duration-200" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-1 sm:p-1.5 shadow-2xs overflow-hidden">
          <div
            ref={tabsContainerRef}
            className="overflow-x-auto no-scrollbar scroll-smooth flex items-center justify-start sm:justify-between gap-1 sm:gap-1.5 w-full snap-x snap-mandatory px-0.5"
          >
            {/* 1. All Animals */}
            <button
              ref={activeTab === "all" ? activeTabRef : null}
              type="button"
              onClick={() => handleTabChange("all")}
              className={cn(
                "group inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 snap-center",
                activeTab === "all"
                  ? "border border-emerald-300/80 bg-emerald-50 text-emerald-950 font-black shadow-2xs ring-1 ring-emerald-500/20"
                  : "border border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50/80 font-semibold"
              )}
            >
              <Icon
                iconNode={cowHead}
                className={cn(
                  "size-4 sm:size-4.5 transition-colors shrink-0",
                  activeTab === "all" ? "text-emerald-700" : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              <span>
                <span className="sm:hidden">All</span>
                <span className="hidden sm:inline">All Animals</span>
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold tabular-nums transition-colors shrink-0",
                  activeTab === "all" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                )}
              >
                {allCount}
              </span>
            </button>

            {/* 2. Individual */}
            <button
              ref={activeTab === "individual" ? activeTabRef : null}
              type="button"
              onClick={() => handleTabChange("individual")}
              className={cn(
                "group inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 snap-center",
                activeTab === "individual"
                  ? "border border-emerald-300/80 bg-emerald-50 text-emerald-950 font-black shadow-2xs ring-1 ring-emerald-500/20"
                  : "border border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50/80 font-semibold"
              )}
            >
              <Tag
                className={cn(
                  "size-4 sm:size-4.5 transition-colors shrink-0",
                  activeTab === "individual" ? "text-emerald-700" : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              <span>Individual</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold tabular-nums transition-colors shrink-0",
                  activeTab === "individual" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                )}
              >
                {individualCount}
              </span>
            </button>

            {/* 3. Herds */}
            <button
              ref={activeTab === "herds" ? activeTabRef : null}
              type="button"
              onClick={() => handleTabChange("herds")}
              className={cn(
                "group inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 snap-center",
                activeTab === "herds"
                  ? "border border-emerald-300/80 bg-emerald-50 text-emerald-950 font-black shadow-2xs ring-1 ring-emerald-500/20"
                  : "border border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50/80 font-semibold"
              )}
            >
              <Layers
                className={cn(
                  "size-4 sm:size-4.5 transition-colors shrink-0",
                  activeTab === "herds" ? "text-emerald-700" : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              <span>Herds</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold tabular-nums transition-colors shrink-0",
                  activeTab === "herds" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                )}
              >
                {herdsCount}
              </span>
            </button>

            {/* 4. Calving Records */}
            <button
              ref={activeTab === "calving" ? activeTabRef : null}
              type="button"
              onClick={() => handleTabChange("calving")}
              className={cn(
                "group inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 snap-center",
                activeTab === "calving"
                  ? "border border-emerald-300/80 bg-emerald-50 text-emerald-950 font-black shadow-2xs ring-1 ring-emerald-500/20"
                  : "border border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50/80 font-semibold"
              )}
            >
              <Baby
                className={cn(
                  "size-4 sm:size-4.5 transition-colors shrink-0",
                  activeTab === "calving" ? "text-emerald-700" : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              <span>
                <span className="sm:hidden">Calving</span>
                <span className="hidden sm:inline">Calving Records</span>
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold tabular-nums transition-colors shrink-0",
                  activeTab === "calving" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                )}
              >
                {calvingCount}
              </span>
            </button>

            {/* 5. Census */}
            <button
              ref={activeTab === "census" ? activeTabRef : null}
              type="button"
              onClick={() => handleTabChange("census")}
              className={cn(
                "group inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 snap-center",
                activeTab === "census"
                  ? "border border-emerald-300/80 bg-emerald-50 text-emerald-950 font-black shadow-2xs ring-1 ring-emerald-500/20"
                  : "border border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50/80 font-semibold"
              )}
            >
              <FileSpreadsheet
                className={cn(
                  "size-4 sm:size-4.5 transition-colors shrink-0",
                  activeTab === "census" ? "text-emerald-700" : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              <span>Census</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold tabular-nums transition-colors shrink-0",
                  activeTab === "census" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                )}
              >
                {censusCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div ref={recordsSectionRef} id="records-list-anchor" className="w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 scroll-mt-6">

        {activeTab === "census" ? (
          /* ── CENSUS SUBMISSIONS VIEW ── */
          <div ref={censusListRef} className="space-y-6 scroll-mt-6">
            {isLoadingCensus ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                <Card className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 p-4 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
                      <Loader2 className="size-4.5 animate-spin" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 tracking-tight">
                          Loading Quarterly Census Records…
                        </h4>
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                          <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        Retrieving barangay livestock counts, survey batches, and validation statuses...
                      </p>
                    </div>
                  </div>
                </Card>
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-5 w-48 rounded-md bg-slate-200" />
                          <Skeleton className="h-3.5 w-64 rounded-md bg-slate-100" />
                        </div>
                        <Skeleton className="h-9 w-28 rounded-xl bg-slate-100" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : isCensusError ? (
              <Card className="p-6 text-center bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs shadow-2xs">
                <p className="font-bold">Failed to load quarterly census submissions.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refetchCensus()}
                  className="mt-3 text-xs rounded-xl"
                >
                  <RotateCcw className="size-3.5 mr-1" /> Retry
                </Button>
              </Card>
            ) : (
              <CensusSubmissionsView
                censusSubmissions={censuses}
                onOpenSubmitDialog={() => router.push("/sibat/census/submit?from=registry")}
                onSelectCensusForDetail={(c) => setSelectedCensusForDetail(c)}
              />
            )}
          </div>
        ) : (
          <>
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
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${hasAllBarangayAccess ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-3`}>
            {/* 1. Search Box */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by farmer, ear tag, herd tag, or ID"
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

            {/* 2. Filter by Farmer (for the assigned barangay only) */}
            <Select value={farmer} onValueChange={(val) => setFarmer(val)}>
              <SelectTrigger
                aria-label="Filter by farmer"
                className="h-10 rounded-xl border-slate-200 bg-slate-50/80 text-xs sm:text-sm cursor-pointer"
              >
                <SelectValue placeholder="All Farmers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Farmers">
                  All Farmers{user?.assignedBarangayName && !hasAllBarangayAccess ? ` (${user.assignedBarangayName})` : ` (${availableFarmers.length})`}
                </SelectItem>
                {availableFarmers.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 3. Filter by Barangay (only shown if officer has multi-barangay access) */}
            {hasAllBarangayAccess && (
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
            )}

            {/* 3. Filter by Species */}
            <Select value={species} onValueChange={(val) => setSpecies(val)}>
              <SelectTrigger
                aria-label="Filter by species"
                className="h-10 rounded-xl border-slate-200 bg-slate-50/80 text-xs sm:text-sm cursor-pointer"
              >
                <SelectValue placeholder="All Species" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Species">All Species</SelectItem>
                {availableSpecies.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
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

        {/* Result Line & View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm px-1 font-medium text-slate-500">
          <div className="flex items-center gap-2">
            <strong className="text-slate-900 font-bold">
              {filteredRecords.length} {filteredRecords.length === 1 ? "record" : "records"} found
            </strong>
            <span className="text-slate-300">•</span>
            <span>Showing farmer submissions</span>
          </div>

          {/* View Mode Switcher: Table vs Cards */}
          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
              title="Table view"
            >
              <TableProperties className="size-3.5" />
              <span>Table View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "card"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
              title="Card view"
            >
              <LayoutGrid className="size-3.5" />
              <span>Card View</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && pageRecords.length === 0 ? (
          <RegistryRecordsSkeleton viewMode={viewMode} />
        ) : filteredRecords.length > 0 ? (
          /* Main Records List: Table View or Cards View */
          <div
            key={`${showHistory ? "history" : "current"}-${activeTab}-${page}-${viewMode}-${barangay}-${farmer}-${species}-${status}`}
            ref={recordsListRef}
            className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both"
          >
            {viewMode === "table" ? (
              /* TABLE VIEW */
              <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                      <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 py-3.5 pl-5">
                        Ear Tag / Herd Tag
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
                    {pageRecords.map((r, idx) => {
                      const isCalving = r.sourceType === "CALVING";
                      const isBatch = r.entryType === "BATCH" || r.sourceType === "BATCH";
                      const hasParentHerd = !isCalving && !isBatch && Boolean(r.batchId || r.batchCode);
                      const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—";

                      return (
                        <TableRow
                          key={`${r.sourceType}-${r.rawId}`}
                          ref={(el) => {
                            if (idx === 0) {
                              firstRecordRef.current = el;
                            }
                          }}
                          data-review-record-id={r.id}
                          style={{ animationDelay: `${Math.min(idx * 25, 250)}ms` }}
                          className={`cursor-pointer border-b border-slate-100 scroll-mt-24 transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both ${r.id === focusRecordKey ? "bg-emerald-50 ring-2 ring-inset ring-emerald-400" : "hover:bg-slate-50/80"}`}
                          onClick={() => {
                            setFocusedRecordId((prev) => (prev === r.id ? null : r.id));
                          }}
                        >
                          {/* Ear Tag / Herd Tag */}
                          <TableCell className="py-3.5 pl-5">
                            <b className="font-mono text-xs font-black text-slate-900 block">
                              {isCalving ? (r.calfTag ? `Calf Tag #${r.calfTag}` : `Calving #${r.rawId}`) : isBatch ? (r.batchCode || r.tagNumber || `#${r.rawId}`) : (r.tagNumber || `#${r.rawId}`)}
                            </b>
                            {isCalving ? (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-purple-50 text-purple-900 border border-purple-200 shadow-2xs">
                                  Dam Tag: <strong className="font-mono">{r.damTag || "Registered Dam"}</strong>
                                </span>
                              </div>
                            ) : null}
                            <span className="block text-[11px] text-slate-400 font-medium mt-0.5">
                              {isCalving
                                ? [r.livestockTypeName || "Cattle", r.breed || r.damBreed, r.calfSex].filter(Boolean).join(" • ")
                                : isBatch
                                  ? r.batchName || "Herd Container"
                                  : [r.livestockTypeName, r.breed].filter(Boolean).join(" • ") || r.sex || "Individual Animal"}
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isCalving ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                                  <Baby className="size-3 text-purple-700" />
                                  Calving
                                </span>
                              ) : isBatch ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                                  <Layers className="size-3 text-amber-700" />
                                  Herd
                                </span>
                              ) : r.batchCode && activeTab === "all" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black tracking-wide bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                                  <Layers className="size-3 text-amber-700" />
                                  Herd Tag: <strong className="font-mono">{r.batchCode}</strong>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs">
                                  <Tag className="size-3 text-sky-600" />
                                  Individual
                                </span>
                              )}
                            </div>
                            {isCalving ? (
                              <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                                Ease: {r.calvingEase || "Normal"}{r.birthWeight ? ` • ${r.birthWeight} kg` : ""}
                              </span>
                            ) : isBatch && r.quantity ? (
                              <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                                {r.quantity} heads
                              </span>
                            ) : null}
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
                            {showHistory && <span className="block mt-1 text-xs font-semibold text-slate-600">{r.operationalStatus?.replaceAll("_", " ")}</span>}
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
                                <Link href={`/sibat/batches?batchId=${r.rawId}&from=registry`}>
                                  <Layers className="size-3.5 mr-1" /> Review Herd
                                </Link>
                              </Button>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                {hasParentHerd && (
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-8 px-2.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 border-teal-300 hover:bg-teal-100 cursor-pointer"
                                    title={`Review parent herd ${r.batchCode || ""}`}
                                  >
                                    <Link href={`/sibat/batches?batchId=${encodeURIComponent(r.batchId || r.batchCode || "")}&animalId=${r.rawId}&tag=${encodeURIComponent(r.tagNumber || "")}&from=registry`}>
                                      <Layers className="size-3.5 mr-1 text-teal-700" /> Review Herd
                                    </Link>
                                  </Button>
                                )}
                                {!hasParentHerd && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFocusedRecordId(r.id);
                                      setSelectedSubmission(r);
                                    }}
                                    className="h-8 px-3 rounded-xl text-xs font-extrabold bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-300 transition-all cursor-pointer shadow-2xs"
                                  >
                                    <Eye className="size-3.5 mr-1 text-slate-800" /> Review Record
                                  </Button>
                                )}
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
          ) : (
            /* CARDS VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {pageRecords.map((r, idx) => {
                const isCalving = r.sourceType === "CALVING";
                const isBatch = r.entryType === "BATCH" || r.sourceType === "BATCH";
                const hasParentHerd = !isCalving && !isBatch && Boolean(r.batchId || r.batchCode);
                const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—";

                return (
                  <article
                    key={`card-${r.sourceType}-${r.rawId}`}
                    ref={(el) => {
                      if (idx === 0) {
                        firstRecordRef.current = el;
                      }
                    }}
                    data-review-record-id={r.id}
                    style={{ animationDelay: `${Math.min(idx * 35, 300)}ms` }}
                    className={`rounded-2xl border p-4 shadow-2xs space-y-2.5 scroll-mt-24 transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-1.5 fill-mode-both hover:shadow-xs hover:-translate-y-0.5 ${r.id === focusRecordKey ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-300" : "border-slate-200/90 bg-white hover:border-slate-300"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <b className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                          {isCalving ? (r.calfTag || `#${r.rawId}`) : isBatch ? (r.batchCode || r.tagNumber || `#${r.rawId}`) : (r.tagNumber || `#${r.rawId}`)}
                        </b>
                        {isCalving && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-900 border border-pink-200">
                            <Baby className="size-2.5 text-pink-700" />
                            Calving {r.damTag ? `• Dam: ${r.damTag}` : ""}
                          </span>
                        )}
                      </div>
                      <SibatStatusBadge status={r.status as UnifiedStatus} />
                      {showHistory && <span className="text-xs font-semibold text-slate-600">{r.operationalStatus?.replaceAll("_", " ")}</span>}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {isCalving
                          ? `Calving Record ${r.calfSex ? `(${r.calfSex})` : ""}`
                          : (r.livestockTypeName || (isBatch ? "Herd" : "Livestock")) + (isBatch ? ` (${r.quantity} heads)` : "")}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        <b className="text-slate-900 font-bold">{r.farmerName}</b> • {r.barangayName}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>{isCalving ? `Calved ${dateStr}` : `Submitted ${dateStr}`}</span>
                      {isCalving ? (
                        <span className="font-medium text-slate-500">
                          {r.calvingEase || (r.birthWeight ? `${r.birthWeight} kg` : "Calf")}
                        </span>
                      ) : (
                        r.breed && <span className="font-medium text-slate-500">{r.breed}</span>
                      )}
                    </div>

                    {isBatch ? (
                      <Button
                        asChild
                        variant="outline"
                        className="w-full h-10 rounded-xl text-xs font-extrabold text-[#1A365D] border-slate-200 hover:bg-slate-100 mt-2 cursor-pointer"
                      >
                        <Link href={`/sibat/batches?batchId=${r.rawId}&from=registry`}>
                          <Layers className="size-3.5 mr-1" /> Review Herd
                        </Link>
                      </Button>
                    ) : hasParentHerd ? (
                      <Button
                        asChild
                        variant="outline"
                        className="w-full h-10 rounded-xl text-xs font-bold text-teal-800 bg-teal-50/70 border-teal-300 hover:bg-teal-100 cursor-pointer mt-2"
                      >
                        <Link href={`/sibat/batches?batchId=${encodeURIComponent(r.batchId || r.batchCode || "")}&animalId=${r.rawId}&tag=${encodeURIComponent(r.tagNumber || "")}&from=registry`}>
                          <Layers className="size-3.5 mr-1 text-teal-700" /> Review Herd ({r.batchCode || "Parent Herd"})
                        </Link>
                      </Button>
                    ) : (
                      <div className="space-y-1.5 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { setFocusedRecordId(r.id); setSelectedSubmission(r); }}
                          className="w-full h-10 rounded-xl text-xs font-extrabold text-slate-900 border-slate-300 bg-white hover:bg-slate-50 cursor-pointer shadow-2xs"
                        >
                          <Eye className="size-3.5 mr-1 text-slate-800" /> Review Record
                        </Button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

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
          <Card className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-2xs animate-in fade-in-50 zoom-in-95 duration-200">
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
          </>
        )}
      </div>

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
          onOptimisticUpdate={(updated) => {
            setSelectedSubmission(updated);
          }}
          onReviewSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["sibat", "livestock-registry"] });
          }}
        />
      )}

      {/* Census Details Dialog */}
      <CensusDetailsDialog
        submission={selectedCensusForDetail}
        open={Boolean(selectedCensusForDetail)}
        onOpenChange={(open) => !open && setSelectedCensusForDetail(null)}
        onRevise={(item) => router.push(`/sibat/census/submit?revise=${item.id}&from=registry`)}
      />
    </>
  );
}

export default function SibatLivestockRegistryPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader
            title="Livestock Records"
            subtitle="Animals, Herds, and Census records in one place"
            variant="farmer"
            maxWidthClass="w-full"
            icon={<Icon iconNode={cowHead} className="size-5 text-white" />}
            hideIconOnMobile
            showTutorialToggle={false}
            mobileActionsInline
          />
          <div className="mx-auto w-full p-3.5 sm:p-6 lg:px-8">
            <ValidationLoadingScreen
              isLoading={true}
              title="Loading Livestock Records"
              subtitle="Synchronizing individual livestock registrations, herd submissions, and barangay records..."
              badgeLabel="Livestock Records Sync"
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
