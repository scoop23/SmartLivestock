"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { ShieldCheck, QrCode } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";

// Domain & Analytics
import {
  ValidationDomain,
  ValidationStatus,
  useAdminCensusSubmissions,
  useAdminProductionRecords,
  useAdminInventoryRecords,
  useAdminIncidentRecords,
  ValidationIncidentItem,
  ValidationInventoryItem,
  getIncidentTypeBadge,
} from "./validation-analytics";
import { CensusSubmissionRecord } from "@/app/(sibat)/sibat/sibat-analytics";
import { ProductionRecordItem } from "@/app/(farmer)/production-dashboard/production-analytics";

// Extracted Modular Components
import {
  ValidationKpis,
  ValidationToolbar,
  DiseaseMortalityReviewDialog,
  ValidationPagination,
  DomainTabs,
  HerdBatchesBanner,
  BulkActionDock,
  ActiveDomainTable,
} from "./components";
import { ValidationLoadingScreen } from "@/components/validation-loading-screen";

// Dialog Modals
import {
  ValidationReviewDialog,
  ReviewTargetItem,
} from "./validation-review-dialog";
import {
  RecordDetailDialog,
  DetailRecordData,
} from "./record-detail-dialog";

function matchesStatusFilter(
  rawStatus: string | null | undefined,
  statusFilter: ValidationStatus
): boolean {
  if (statusFilter === "ALL") return true;
  const s = (rawStatus || "PENDING").toUpperCase();
  if (statusFilter === "SUBJECT_TO_REVISION") {
    return (
      s === "SUBJECT_TO_REVISION" ||
      s === "SUBJECT_FOR_REVISION" ||
      s === "REJECTED" ||
      s === "FLAGGED"
    );
  }
  return s === statusFilter;
}

// Herd members must move through review as a unit — never individually.
// This splits review targets so herd animals are blocked from individual
// approval and can only move via their batch card.
function splitHerdInventoryIds(
  itemIds: (string | number)[],
  records: ValidationInventoryItem[]
): { processableIds: (string | number)[]; blockedHerdIds: (string | number)[] } {
  const processableIds: (string | number)[] = [];
  const blockedHerdIds: (string | number)[] = [];
  itemIds.forEach((id) => {
    const strId = String(id);
    if (strId.startsWith("batch-")) {
      processableIds.push(id);
      return;
    }
    const record = records.find((r) => String(r.id) === strId);
    if (!record || (!record.isBatch && (record.batchId != null || !!record.batchCode))) {
      blockedHerdIds.push(id);
      return;
    }
    processableIds.push(id);
  });
  return { processableIds, blockedHerdIds };
}

function AdminDataValidationContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedDomain = searchParams.get("domain");
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Domain tab & filter states
  const [activeDomain, setActiveDomain] = useState<ValidationDomain>("census");
  useEffect(() => {
    if (requestedDomain === "inventory" || requestedDomain === "production") {
      setActiveDomain(requestedDomain);
    }
  }, [requestedDomain]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ValidationStatus>("ALL");
  const [barangayFilter, setBarangayFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Dialog states
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewTargetItems, setReviewTargetItems] = useState<ReviewTargetItem[]>([]);
  const [healthReviewDialog, setHealthReviewDialog] = useState<{
    open: boolean;
    record: ValidationIncidentItem | null;
  }>({ open: false, record: null });
  const [recordDetailModal, setRecordDetailModal] = useState<{
    open: boolean;
    data: DetailRecordData | null;
  }>({ open: false, data: null });

  const { data: rawCensusData } = useAdminCensusSubmissions();
  const { data: rawProductionData } = useAdminProductionRecords();
  const { data: rawInventoryData } = useAdminInventoryRecords();
  const { data: rawIncidentData } = useAdminIncidentRecords();

  const isInitialLoading =
    rawCensusData === undefined ||
    rawProductionData === undefined ||
    rawInventoryData === undefined ||
    rawIncidentData === undefined;

  // Local state overlays for optimistic updates
  const [localCensusOverrides, setLocalCensusOverrides] = useState<
    Record<string | number, { status: "APPROVED" | "SUBJECT_TO_REVISION"; remarks: string }>
  >({});
  const [localProductionOverrides, setLocalProductionOverrides] = useState<
    Record<number, { status: "APPROVED" | "SUBJECT_TO_REVISION"; remarks: string }>
  >({});
  const [localInventoryOverrides, setLocalInventoryOverrides] = useState<
    Record<string | number, { status: "APPROVED" | "SUBJECT_TO_REVISION"; remarks: string }>
  >({});
  const [localIncidentOverrides, setLocalIncidentOverrides] = useState<
    Record<string, { status: "APPROVED" | "SUBJECT_TO_REVISION"; remarks: string }>
  >({});

  // Consolidated Data with Overrides
  const censusSubmissions: CensusSubmissionRecord[] = useMemo(() => {
    return (rawCensusData || []).map((sub) => {
      const override = localCensusOverrides[sub.id];
      if (override) {
        return {
          ...sub,
          status: override.status,
          reviewRemarks: override.remarks || sub.reviewRemarks,
        };
      }
      return sub;
    });
  }, [rawCensusData, localCensusOverrides]);

  const productionRecords: ProductionRecordItem[] = useMemo(() => {
    return (rawProductionData || []).map((rec) => {
      const override = localProductionOverrides[rec.id];
      if (override) {
        return {
          ...rec,
          status: override.status,
          reviewRemarks: override.remarks || rec.reviewRemarks,
        };
      }
      return rec;
    });
  }, [rawProductionData, localProductionOverrides]);

  const inventoryRecords: ValidationInventoryItem[] = useMemo(() => {
    return (rawInventoryData || []).map((inv) => {
      const override = localInventoryOverrides[inv.id];
      if (override) {
        return {
          ...inv,
          status: override.status,
          reviewRemarks: override.remarks || inv.reviewRemarks,
        };
      }
      return inv;
    });
  }, [rawInventoryData, localInventoryOverrides]);

  const incidents: ValidationIncidentItem[] = useMemo(() => {
    return (rawIncidentData || []).map((inc) => {
      const override = localIncidentOverrides[inc.id];
      if (override) {
        return {
          ...inc,
          status: override.status,
          reviewRemarks: override.remarks || inc.reviewRemarks,
        };
      }
      return inc;
    });
  }, [rawIncidentData, localIncidentOverrides]);

  // Unique Barangays for dropdown filter
  const uniqueBarangays = useMemo(() => {
    const set = new Set<string>();
    censusSubmissions.forEach((c) => c.barangay && set.add(c.barangay));
    productionRecords.forEach((p) => p.barangayName && set.add(p.barangayName));
    inventoryRecords.forEach((i) => i.barangayName && set.add(i.barangayName));
    incidents.forEach((inc) => inc.barangayName && set.add(inc.barangayName));
    return Array.from(set).sort();
  }, [censusSubmissions, productionRecords, inventoryRecords, incidents]);

  // Global KPI Summary
  const kpis = useMemo(() => {
    const allRecords = [
      ...censusSubmissions.map((c) => ({ status: c.status, barangay: c.barangay })),
      ...productionRecords.map((p) => ({ status: p.status, barangay: p.barangayName })),
      ...inventoryRecords.map((i) => ({ status: i.status, barangay: i.barangayName })),
      ...incidents.map((inc) => ({ status: inc.status, barangay: inc.barangayName })),
    ];

    const pending = allRecords.filter((r) => (r.status || "PENDING").toUpperCase() === "PENDING").length;
    const verified = allRecords.filter((r) => (r.status || "").toUpperCase() === "VERIFIED").length;
    const approved = allRecords.filter((r) => (r.status || "").toUpperCase() === "APPROVED").length;
    const flagged = allRecords.filter((r) => {
      const s = (r.status || "").toUpperCase();
      return s === "SUBJECT_TO_REVISION" || s === "SUBJECT_FOR_REVISION" || s === "REJECTED" || s === "FLAGGED";
    }).length;

    const activeBarangays = new Set(allRecords.map((r) => r.barangay).filter(Boolean)).size;

    return { pending, verified, approved, flagged, activeBarangays };
  }, [censusSubmissions, productionRecords, inventoryRecords, incidents]);

  // Domain Breakdown Counters
  const domainPendingCounts = useMemo(() => ({
    census: censusSubmissions.filter((c) => (c.status || "PENDING").toUpperCase() === "PENDING").length,
    production: productionRecords.filter((p) => (p.status || "PENDING").toUpperCase() === "PENDING").length,
    inventory: inventoryRecords.filter((i) => (i.status || "PENDING").toUpperCase() === "PENDING").length,
    incidents: incidents.filter((inc) => (inc.status || "PENDING").toUpperCase() === "PENDING").length,
  }), [censusSubmissions, productionRecords, inventoryRecords, incidents]);

  const domainVerifiedCounts = useMemo(() => ({
    census: censusSubmissions.filter((c) => (c.status || "").toUpperCase() === "VERIFIED").length,
    production: productionRecords.filter((p) => (p.status || "").toUpperCase() === "VERIFIED").length,
    inventory: inventoryRecords.filter((i) => (i.status || "").toUpperCase() === "VERIFIED").length,
    incidents: incidents.filter((inc) => (inc.status || "").toUpperCase() === "VERIFIED").length,
  }), [censusSubmissions, productionRecords, inventoryRecords, incidents]);

  const domainTotalCounts = useMemo(() => ({
    census: censusSubmissions.length,
    production: productionRecords.length,
    inventory: inventoryRecords.length,
    incidents: incidents.length,
  }), [censusSubmissions, productionRecords, inventoryRecords, incidents]);

  // ── Filtered Domain Data ──

  const filteredCensus = useMemo(() => {
    return censusSubmissions.filter((c) => {
      const matchSearch =
        !searchQuery ||
        c.barangay.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.submittedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.remarks?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = matchesStatusFilter(c.status, statusFilter);
      const matchBarangay = barangayFilter === "ALL" || c.barangay === barangayFilter;
      return matchSearch && matchStatus && matchBarangay;
    });
  }, [censusSubmissions, searchQuery, statusFilter, barangayFilter]);

  const filteredProduction = useMemo(() => {
    return productionRecords.filter((p) => {
      const matchSearch =
        !searchQuery ||
        (p.farmerName && p.farmerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.barangayName && p.barangayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.livestockTypeName && p.livestockTypeName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.notes.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = matchesStatusFilter(p.status, statusFilter);
      const matchBarangay = barangayFilter === "ALL" || p.barangayName === barangayFilter;
      return matchSearch && matchStatus && matchBarangay;
    });
  }, [productionRecords, searchQuery, statusFilter, barangayFilter]);

  const filteredInventory = useMemo(() => {
    return inventoryRecords.filter((inv) => {
      const matchSearch =
        !searchQuery ||
        inv.farmerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.barangayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.tagNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.breed.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.livestockType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = matchesStatusFilter(inv.status, statusFilter);
      const matchBarangay = barangayFilter === "ALL" || inv.barangayName === barangayFilter;
      return matchSearch && matchStatus && matchBarangay;
    });
  }, [inventoryRecords, searchQuery, statusFilter, barangayFilter]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchSearch =
        !searchQuery ||
        inc.farmerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.barangayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = matchesStatusFilter(inc.status, statusFilter);
      const matchBarangay = barangayFilter === "ALL" || inc.barangayName === barangayFilter;
      return matchSearch && matchStatus && matchBarangay;
    });
  }, [incidents, searchQuery, statusFilter, barangayFilter]);

  // ── Pagination State ──
  const [domainPages, setDomainPages] = useState<Record<ValidationDomain, number>>({
    census: 1,
    production: 1,
    inventory: 1,
    incidents: 1,
  });
  const [pageSize, setPageSize] = useState<number>(10);

  // Active domain's full filtered list & pagination metrics
  const activeFilteredList = useMemo(() => {
    switch (activeDomain) {
      case "census":
        return filteredCensus;
      case "production":
        return filteredProduction;
      case "inventory":
        return filteredInventory;
      case "incidents":
        return filteredIncidents;
    }
  }, [activeDomain, filteredCensus, filteredProduction, filteredInventory, filteredIncidents]);

  const rawCurrentPage = domainPages[activeDomain] || 1;
  const totalItems = activeFilteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(rawCurrentPage, totalPages);

  // Paginated slices for each domain
  const paginatedCensus = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCensus.slice(start, start + pageSize);
  }, [filteredCensus, currentPage, pageSize]);

  const paginatedProduction = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProduction.slice(start, start + pageSize);
  }, [filteredProduction, currentPage, pageSize]);

  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInventory.slice(start, start + pageSize);
  }, [filteredInventory, currentPage, pageSize]);

  const paginatedIncidents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIncidents.slice(start, start + pageSize);
  }, [filteredIncidents, currentPage, pageSize]);

  // Current page item IDs for select-all on the active page
  const currentPageRecordIds = useMemo(() => {
    switch (activeDomain) {
      case "census":
        return paginatedCensus
          .filter((c) => (c.status || "PENDING").toUpperCase() === "PENDING")
          .map((c) => c.id);
      case "production":
        return paginatedProduction
          .filter((p) => (p.status || "PENDING").toUpperCase() === "VERIFIED")
          .map((p) => p.id);
      case "inventory":
        return paginatedInventory
          .filter((i) => (i.status || "PENDING").toUpperCase() === "VERIFIED" &&
            (i.isBatch || (i.batchId == null && !i.batchCode)))
          .map((i) => i.id);
      case "incidents":
        return paginatedIncidents
          .filter((inc) => (inc.status || "PENDING").toUpperCase() === "VERIFIED")
          .map((inc) => inc.id);
    }
  }, [activeDomain, paginatedCensus, paginatedProduction, paginatedInventory, paginatedIncidents]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...currentPageRecordIds]));
      } else {
        return prev.filter((id) => !currentPageRecordIds.includes(id));
      }
    });
  };

  const handleToggleSelect = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // ── Modal Triggers ──

  const openReviewSingle = (target: ReviewTargetItem) => {
    setReviewTargetItems([target]);
    setReviewDialogOpen(true);
  };

  const openReviewBatch = () => {
    if (selectedIds.length === 0) return;

    let targets: ReviewTargetItem[] = [];
    if (activeDomain === "census") {
      targets = censusSubmissions
        .filter((c) => selectedIds.includes(c.id) && (c.status || "PENDING").toUpperCase() === "VERIFIED")
        .map((c) => ({
          id: c.id,
          domain: "census",
          title: `${c.barangay} Q${c.reportQuarter} ${c.reportYear}`,
          farmerOrSubmitter: c.submittedBy,
          barangay: c.barangay,
          keyMetric: `${c.totalHeads} Heads`,
          currentRemarks: c.reviewRemarks,
        }));
    } else if (activeDomain === "production") {
      targets = productionRecords
        .filter((p) => selectedIds.includes(p.id) && (p.status || "PENDING").toUpperCase() === "VERIFIED")
        .map((p) => ({
          id: p.id,
          domain: "production",
          title: `${p.farmerName || "Farmer"} — ${p.productionType.toUpperCase()}`,
          farmerOrSubmitter: p.farmerName || "Registered Farmer",
          barangay: p.barangayName || "Municipality",
          keyMetric: `${p.quantity} ${p.unit}`,
          currentRemarks: p.reviewRemarks,
        }));
    } else if (activeDomain === "inventory") {
      targets = inventoryRecords
        .filter((i) => selectedIds.includes(i.id) && (i.status || "PENDING").toUpperCase() === "VERIFIED" &&
          (i.isBatch || (i.batchId == null && !i.batchCode)))
        .map((i) => ({
          id: i.id,
          domain: "inventory",
          title: `${i.tagNumber || i.breed} (${i.livestockType})`,
          farmerOrSubmitter: i.farmerName,
          barangay: i.barangayName,
          keyMetric: `${i.quantity} head(s)`,
          currentRemarks: i.reviewRemarks,
          photoUrl: i.photoUrl,
          photoName: i.photoName,
        }));
    } else {
      targets = incidents
        .filter((inc) => selectedIds.includes(inc.id) && (inc.status || "PENDING").toUpperCase() === "VERIFIED")
        .map((inc) => ({
          id: inc.id,
          domain: "incidents",
          title: `${getIncidentTypeBadge(inc.type).label} — ${inc.farmerName}`,
          farmerOrSubmitter: inc.farmerName,
          barangay: inc.barangayName,
          keyMetric: inc.type.toUpperCase(),
          currentRemarks: inc.reviewRemarks,
          photoUrl: inc.photoUrl,
          photoName: inc.photoName,
          inspectorPhotoUrl: inc.inspectorPhotoUrl,
          inspectorPhotoName: inc.inspectorPhotoName,
        }));
    }

    setReviewTargetItems(targets);
    setReviewDialogOpen(true);
  };

  // ── Confirmation Handler for Single & Batch Review ──

  const handleConfirmAction = async (
    action: "APPROVED" | "SUBJECT_TO_REVISION",
    remarks: string,
    itemIds: (string | number)[]
  ) => {
    try {
      if (activeDomain === "census") {
        setLocalCensusOverrides((prev) => {
          const next = { ...prev };
          itemIds.forEach((id) => {
            next[id] = { status: action, remarks };
          });
          return next;
        });
        await Promise.all(
          itemIds.map((id) =>
            api.post(`livestock/census/${id}/review/`, { status: action, remarks })
          )
        );
        queryClient.invalidateQueries({ queryKey: ["admin-census-submissions"] });
        queryClient.invalidateQueries({ queryKey: ["census-submissions"] });
      } else if (activeDomain === "production") {
        setLocalProductionOverrides((prev) => {
          const next = { ...prev };
          itemIds.forEach((id) => {
            next[Number(id)] = { status: action, remarks };
          });
          return next;
        });
        await Promise.all(
          itemIds.map((id) =>
            api.post(`production/records/${id}/review/`, { status: action, remarks })
          )
        );
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
        queryClient.invalidateQueries({ queryKey: ["admin-inventory-records"] });
        queryClient.invalidateQueries({ queryKey: ["production_records"] });
        queryClient.invalidateQueries({ queryKey: ["admin-production-records"] });
        queryClient.invalidateQueries({ queryKey: ["production-records"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-production-records"] });
      } else if (activeDomain === "inventory") {
        const { processableIds, blockedHerdIds } = splitHerdInventoryIds(itemIds, inventoryRecords);

        if (blockedHerdIds.length > 0) {
          toast.info(
            `${blockedHerdIds.length} livestock record(s) belong to a herd and are reviewed together.`,
            {
              description:
                "Review the whole herd from its herd card in Livestock Inventory or the Herd Validation console.",
            }
          );
        }

        if (processableIds.length === 0) {
          setSelectedIds([]);
          return;
        }

        await Promise.all(
          processableIds.map((id) => {
            const strId = String(id);
            if (strId.startsWith("batch-")) {
              const cleanId = strId.replace("batch-", "");
              return api.post(`livestock/batches/${cleanId}/review/`, { status: action, remarks });
            }
            return api.post(`livestock/inventory/${id}/review/`, { status: action, remarks });
          })
        );
        setLocalInventoryOverrides((prev) => {
          const next = { ...prev };
          processableIds.forEach((id) => {
            next[id] = { status: action, remarks };
          });
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ["admin-inventory-records"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-inventory-records"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-batches-records"] });

        setSelectedIds([]);

        const actionVerb = action === "APPROVED" ? "approved & certified" : "returned for revision";
        if (processableIds.length === 1) {
          toast.success(`Record successfully ${actionVerb}.`, {
            description: remarks ? `Remarks: "${remarks}"` : "Official MAO audit trail recorded.",
          });
        } else {
          toast.success(`${processableIds.length} records successfully ${actionVerb}.`, {
            description: remarks ? `Remarks: "${remarks}"` : "Batch status updated across selected entries.",
          });
        }
        return;
      } else {
        setLocalIncidentOverrides((prev) => {
          const next = { ...prev };
          itemIds.forEach((id) => {
            next[String(id)] = { status: action, remarks };
          });
          return next;
        });
        await Promise.all(
          itemIds.map((id) => {
            const strId = String(id);
            if (strId.startsWith("dis-")) {
              const cleanId = strId.replace("dis-", "");
              return api.post(`diseases/cases/${cleanId}/review/`, { status: action, remarks });
            } else if (strId.startsWith("mor-")) {
              const cleanId = strId.replace("mor-", "");
              return api.post(`diseases/mortality/${cleanId}/review/`, { status: action, remarks });
            } else if (strId.startsWith("sale-")) {
              const cleanId = strId.replace("sale-", "");
              return api.post(`production/sales/${cleanId}/review/`, { status: action, remarks });
            }
            if (strId.startsWith("birth-")) {
              const cleanId = strId.replace("birth-", "");
              return api.post("production/calving/" + cleanId + "/review/", { status: action, remarks });
            }
            return Promise.resolve();
          })
        );
        queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }

      setSelectedIds([]);

      const actionVerb = action === "APPROVED" ? "approved & certified" : "returned for revision";
      if (itemIds.length === 1) {
        toast.success(`Record successfully ${actionVerb}.`, {
          description: remarks ? `Remarks: "${remarks}"` : "Official MAO audit trail recorded.",
        });
      } else {
        toast.success(`${itemIds.length} records successfully ${actionVerb}.`, {
          description: remarks ? `Remarks: "${remarks}"` : "Batch status updated across selected entries.",
        });
      }
    } catch (err) {
      console.error("Failed to perform validation review action:", err);
      const responseData = axios.isAxiosError(err)
        ? (err.response?.data as { status?: string; remarks?: string; error?: string } | undefined)
        : undefined;
      const apiMessage = responseData?.status || responseData?.remarks || responseData?.error;
      toast.error("Review action was not applied.", {
        description: apiMessage || "The record may still require SIBAT verification or a different workflow step.",
      });
    }
  };

  // ── Confirmation Handler for Disease & Mortality SIBAT Review ──
  const handleConfirmHealthAction = async (
    action: "APPROVED" | "SUBJECT_TO_REVISION",
    remarks: string,
    recordId: string
  ) => {
    setLocalIncidentOverrides((prev) => ({
      ...prev,
      [recordId]: { status: action, remarks },
    }));

    try {
      if (recordId.startsWith("dis-")) {
        const cleanId = recordId.replace("dis-", "");
        await api.post(`diseases/cases/${cleanId}/review/`, { status: action, remarks });
      } else if (recordId.startsWith("mor-")) {
        const cleanId = recordId.replace("mor-", "");
        await api.post(`diseases/mortality/${cleanId}/review/`, { status: action, remarks });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      const actionVerb = action === "APPROVED" ? "certified & approved" : "returned for revision";
      toast.success(`Health declaration ${recordId} ${actionVerb}.`, {
        description: remarks ? `Remarks: "${remarks}"` : "Official MAO audit trail recorded.",
      });
    } catch (err) {
      console.error("Failed to review health incident:", err);
      toast.error("Failed to update health review status.");
    }
  };

  if (isInitialLoading) {
    return (
      <>
        <PageHeader
          title="Municipal Data Validation Center"
          subtitle="Official Municipal Agriculture Office (MAO) verification, review, and certification command center"
          variant="admin"
          maxWidthClass="w-full"
          icon={<ShieldCheck className="size-5 text-slate-800" />}
        />
        <ValidationLoadingScreen
          censusLoaded={rawCensusData !== undefined}
          productionLoaded={rawProductionData !== undefined}
          inventoryLoaded={rawInventoryData !== undefined}
          incidentLoaded={rawIncidentData !== undefined}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Municipal Data Validation Center"
        subtitle="Official Municipal Agriculture Office (MAO) verification, review, and certification command center"
        variant="admin"
        maxWidthClass="w-full"
        icon={<ShieldCheck className="size-5 text-slate-800" />}
        action={
          <Button
            size="sm"
            onClick={() => setIsScannerOpen(true)}
            className="bg-[#1E4D2B] hover:bg-[#163b21] text-white font-bold text-xs rounded-xl shadow-xs gap-1.5 h-9 cursor-pointer"
          >
            <QrCode className="size-4" />
            Scan Ear Tag / Pass
          </Button>
        }
      />

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5 pb-16 sm:pb-6">
        {/* KPI Strip */}
        <ValidationKpis
          kpis={kpis}
          pendingBreakdown={domainPendingCounts}
          verifiedBreakdown={domainVerifiedCounts}
        />

        {/* Herds & Livestock Drilldown Callout Banner */}
        <HerdBatchesBanner />

        {/* ── Remastered Executive Domain Switcher Tabs ── */}
        <DomainTabs
          activeDomain={activeDomain}
          onDomainChange={(val) => {
            setActiveDomain(val);
            setSelectedIds([]);
          }}
          pendingCounts={domainPendingCounts}
          verifiedCounts={domainVerifiedCounts}
          totalCounts={domainTotalCounts}
        />

        {/* Search, Filter & Bulk Actions Toolbar */}
        <ValidationToolbar
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            setDomainPages((prev) => ({ ...prev, [activeDomain]: 1 }));
          }}
          barangayFilter={barangayFilter}
          onBarangayChange={(b) => {
            setBarangayFilter(b);
            setDomainPages((prev) => ({ ...prev, [activeDomain]: 1 }));
          }}
          uniqueBarangays={uniqueBarangays}
          statusFilter={statusFilter}
          onStatusChange={(s) => {
            setStatusFilter(s);
            setDomainPages((prev) => ({ ...prev, [activeDomain]: 1 }));
          }}
          selectedCount={selectedIds.length}
          onBulkAction={openReviewBatch}
          onClearSelection={() => setSelectedIds([])}
        />

        {/* Domain Data Tables */}
        <ActiveDomainTable
          activeDomain={activeDomain}
          census={paginatedCensus}
          production={paginatedProduction}
          inventory={paginatedInventory}
          incidents={paginatedIncidents}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onViewDetail={(data) => setRecordDetailModal({ open: true, data })}
          onReview={openReviewSingle}
          onReviewHealth={(record) => setHealthReviewDialog({ open: true, record })}
        />

        {/* Responsive Pagination Bar */}
        <ValidationPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={(newPage) => {
            setDomainPages((prev) => ({ ...prev, [activeDomain]: newPage }));
            window.scrollTo({ top: 380, behavior: "smooth" });
          }}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setDomainPages((prev) => ({ ...prev, [activeDomain]: 1 }));
          }}
        />
      </div>

      {/* ── FLOATING MOBILE BULK ACTION DOCK ── */}
      <BulkActionDock
        count={selectedIds.length}
        onValidate={openReviewBatch}
        onClear={() => setSelectedIds([])}
      />

      {/* Batch / Single Review Dialog */}
      <ValidationReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        items={reviewTargetItems}
        onConfirmAction={handleConfirmAction}
      />

      {/* Dedicated SIBAT Disease & Mortality Review Popup */}
      <DiseaseMortalityReviewDialog
        record={healthReviewDialog.record}
        open={healthReviewDialog.open}
        onOpenChange={(open) => setHealthReviewDialog((prev) => ({ ...prev, open }))}
        onConfirmAction={handleConfirmHealthAction}
      />

      {/* Unified Record Inspection Dialog */}
      <RecordDetailDialog
        record={recordDetailModal.data}
        open={recordDetailModal.open}
        onOpenChange={(open) => setRecordDetailModal((prev) => ({ ...prev, open }))}
        onConfirmAction={(action, remarks, itemIds) => {
          handleConfirmAction(action, remarks, itemIds);
        }}
        onOpenReview={(rec) => {
          let metric = "";
          let title = "";
          let domain: ValidationDomain = "census";
          let submitter = "";
          let bgry = "";
          if (rec.kind === "census") {
            metric = `${rec.totalHeads} Heads`;
            title = `${rec.barangay} Q${rec.reportQuarter} ${rec.reportYear}`;
            domain = "census";
            submitter = rec.submittedBy;
            bgry = rec.barangay;
          } else if (rec.kind === "production") {
            metric = `${rec.quantity} ${rec.unit}`;
            title = `${rec.farmerName} — ${rec.productionType.toUpperCase()}`;
            domain = "production";
            submitter = rec.farmerName;
            bgry = rec.barangayName;
          } else if (rec.kind === "inventory") {
            metric = `${rec.quantity} head(s)`;
            title = `${rec.tagNumber || rec.breed} (${rec.livestockType})`;
            domain = "inventory";
            submitter = rec.farmerName;
            bgry = rec.barangayName;
          } else {
            metric = rec.type.toUpperCase();
            title = `${getIncidentTypeBadge(rec.type).label} — ${rec.farmerName}`;
            domain = "incidents";
            submitter = rec.farmerName;
            bgry = rec.barangayName;
          }

          openReviewSingle({
            id: rec.id,
            domain,
            title,
            farmerOrSubmitter: submitter,
            barangay: bgry,
            keyMetric: metric,
            currentRemarks: rec.reviewRemarks,
            photoUrl: (rec as any).photoUrl || null,
            photoName: (rec as any).photoName || null,
            inspectorPhotoUrl: (rec as any).inspectorPhotoUrl || null,
            inspectorPhotoName: (rec as any).inspectorPhotoName || null,
          });
        }}
      />

      {/* ═══ Universal QR Scanner Dialog for MAO Verification ═══ */}
      <UniversalQrScannerDialog
        isOpen={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        role="admin"
      />
    </>
  );
}

export default function AdminDataValidationPage() {
  return (
    <Suspense fallback={<ValidationLoadingScreen />}>
      <AdminDataValidationContent />
    </Suspense>
  );
}
