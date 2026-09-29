"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { PageHeader } from "@/app/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  ShieldCheck,
  Layers,
  ChevronRight,
  FileSpreadsheet,
  Milk,
  Tag,
  Activity,
  X,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";

// Domain & Analytics
import {
  ValidationDomain,
  ValidationStatus,
  VALIDATION_DOMAINS,
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
  CensusTable,
  ProductionTable,
  InventoryTable,
  IncidentsTable,
  DiseaseMortalityReviewDialog,
  ValidationPagination,
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

const DOMAIN_CARD_CONFIG: Record<
  ValidationDomain,
  {
    title: string;
    subtitle: string;
    activeIconBg: string;
    activeBorder: string;
  }
> = {
  census: {
    title: "Quarterly Census",
    subtitle: "Barangay Livestock Roster",
    activeIconBg: "bg-emerald-700 text-white shadow-emerald-700/20",
    activeBorder: "data-[state=active]:border-emerald-300 data-[state=active]:ring-1 data-[state=active]:ring-emerald-300/40",
  },
  production: {
    title: "Production Yields",
    subtitle: "Milk, Eggs, Wool & Honey Logs",
    activeIconBg: "bg-amber-600 text-white shadow-amber-600/20",
    activeBorder: "data-[state=active]:border-amber-300 data-[state=active]:ring-1 data-[state=active]:ring-amber-300/40",
  },
  inventory: {
    title: "Livestock Inventory",
    subtitle: "Individual Tags & Cohort Pens",
    activeIconBg: "bg-sky-700 text-white shadow-sky-700/20",
    activeBorder: "data-[state=active]:border-sky-300 data-[state=active]:ring-1 data-[state=active]:ring-sky-300/40",
  },
  incidents: {
    title: "Field Declarations",
    subtitle: "Disease Outbreaks & Mortalities",
    activeIconBg: "bg-rose-700 text-white shadow-rose-700/20",
    activeBorder: "data-[state=active]:border-rose-300 data-[state=active]:ring-1 data-[state=active]:ring-rose-300/40",
  },
};

export default function AdminDataValidationPage() {
  const queryClient = useQueryClient();
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Domain tab & filter states
  const [activeDomain, setActiveDomain] = useState<ValidationDomain>("census");
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
      const matchStatus =
        statusFilter === "ALL" || (c.status || "PENDING").toUpperCase() === statusFilter;
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
      const matchStatus =
        statusFilter === "ALL" || (p.status || "PENDING").toUpperCase() === statusFilter;
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
      const matchStatus =
        statusFilter === "ALL" || (inv.status || "PENDING").toUpperCase() === statusFilter;
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
      const matchStatus =
        statusFilter === "ALL" || (inc.status || "PENDING").toUpperCase() === statusFilter;
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
          .filter((i) => (i.status || "PENDING").toUpperCase() === "VERIFIED")
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
        .filter((c) => selectedIds.includes(c.id) && (c.status || "PENDING").toUpperCase() === "PENDING")
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
        .filter((i) => selectedIds.includes(i.id) && (i.status || "PENDING").toUpperCase() === "VERIFIED")
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
        queryClient.invalidateQueries({ queryKey: ["admin-production-records"] });
        queryClient.invalidateQueries({ queryKey: ["production-records"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-production-records"] });
      } else if (activeDomain === "inventory") {
        setLocalInventoryOverrides((prev) => {
          const next = { ...prev };
          itemIds.forEach((id) => {
            next[id] = { status: action, remarks };
          });
          return next;
        });
        await Promise.all(
          itemIds.map((id) => {
            const strId = String(id);
            if (strId.startsWith("batch-")) {
              const cleanId = strId.replace("batch-", "");
              return api.post(`livestock/batches/${cleanId}/review/`, { status: action, remarks });
            }
            return api.post(`livestock/inventory/${id}/review/`, { status: action, remarks });
          })
        );
        queryClient.invalidateQueries({ queryKey: ["admin-inventory-records"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-inventory-records"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-batches-records"] });
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

        {/* Cohort Batches & Livestock Drilldown Callout Banner */}
        <div className="bg-gradient-to-r from-[#1E4D2B] via-emerald-900 to-[#163b21] text-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Layers className="size-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  Municipal Cohort Batches &amp; Livestock Drilldown
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-mono">
                  99 Batches • 300 Heads
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium mt-0.5">
                Inspect registered livestock batches and drill down into individual ear tag biometrics, vaccination history, and pen housing.
              </p>
            </div>
          </div>
          <Link href="/data-validation/batches" className="shrink-0">
            <Button
              size="sm"
              className="w-full sm:w-auto bg-white text-[#1E4D2B] hover:bg-emerald-50 font-bold text-xs rounded-xl shadow-xs gap-1.5 h-9"
            >
              <span>Inspect Batches &amp; Drilldown</span>
              <ChevronRight className="size-4" />
            </Button>
          </Link>
        </div>

        {/* ── Remastered Executive Domain Switcher Tabs ── */}
        <div className="w-full space-y-2.5">
          <Tabs
            value={activeDomain}
            onValueChange={(val) => {
              setActiveDomain(val as ValidationDomain);
              setSelectedIds([]);
            }}
            className="w-full space-y-2.5"
          >
            <TabsList className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-2 bg-slate-100/90 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs h-auto">
              {VALIDATION_DOMAINS.map((domain) => {
                const config = DOMAIN_CARD_CONFIG[domain.id];
                const pendingCount = domainPendingCounts[domain.id];
                const verifiedCount = domainVerifiedCounts[domain.id];
                const totalCount = domainTotalCounts[domain.id];
                const isActive = activeDomain === domain.id;

                return (
                  <TabsTrigger
                    key={domain.id}
                    value={domain.id}
                    className={`group relative flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl transition-all duration-200 text-left border border-slate-200/70 bg-white/70 hover:bg-white hover:border-slate-300 data-[state=active]:bg-white data-[state=active]:shadow-sm cursor-pointer h-auto ${config.activeBorder}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`size-10 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-200 shadow-2xs ${
                          isActive
                            ? `${config.activeIconBg} shadow-xs`
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-800"
                        }`}
                      >
                        {domain.id === "census" && <FileSpreadsheet className="size-4.5" />}
                        {domain.id === "production" && <Milk className="size-4.5" />}
                        {domain.id === "inventory" && <Tag className="size-4.5" />}
                        {domain.id === "incidents" && <Activity className="size-4.5" />}
                      </div>

                      <div className="text-left min-w-0">
                        <p className="text-xs sm:text-sm font-black tracking-tight leading-tight text-slate-900 truncate">
                          {config.title}
                        </p>
                        <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-slate-500 truncate mt-0.5">
                          {config.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {pendingCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300/80 font-mono shadow-2xs">
                          <span className="size-1.5 rounded-full bg-amber-600 animate-pulse" />
                          {pendingCount} Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 font-mono">
                          {totalCount} Total
                        </span>
                      )}

                      {verifiedCount > 0 && (
                        <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-md font-mono hidden sm:inline-block">
                          {verifiedCount} Verified
                        </span>
                      )}
                    </div>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {/* Contextual Active Queue Telemetry Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-black text-slate-900 truncate">
                {DOMAIN_CARD_CONFIG[activeDomain].title} Validation Queue
              </span>
              <span className="text-slate-300 hidden sm:inline">&bull;</span>
              <span className="text-slate-500 font-medium truncate hidden sm:inline">
                {VALIDATION_DOMAINS.find((d) => d.id === activeDomain)?.description}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Queue Telemetry:
              </span>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-[10px] font-mono font-bold">
                {domainTotalCounts[activeDomain]} Total Records
              </Badge>
              {domainPendingCounts[activeDomain] > 0 && (
                <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px] font-mono font-bold">
                  {domainPendingCounts[activeDomain]} Awaiting SIBAT
                </Badge>
              )}
              {domainVerifiedCounts[activeDomain] > 0 && (
                <Badge className="bg-sky-100 text-sky-900 border-sky-200 text-[10px] font-mono font-bold">
                  {domainVerifiedCounts[activeDomain]} Ready for MAO
                </Badge>
              )}
            </div>
          </div>
        </div>

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
        {activeDomain === "census" && (
          <CensusTable
            records={paginatedCensus}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onViewDetail={(data) => setRecordDetailModal({ open: true, data })}
            onReview={openReviewSingle}
          />
        )}

        {activeDomain === "production" && (
          <ProductionTable
            records={paginatedProduction}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onViewDetail={(data) => setRecordDetailModal({ open: true, data })}
            onReview={openReviewSingle}
          />
        )}

        {activeDomain === "inventory" && (
          <InventoryTable
            records={paginatedInventory}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onViewDetail={(data) => setRecordDetailModal({ open: true, data })}
            onReview={openReviewSingle}
          />
        )}

        {activeDomain === "incidents" && (
          <IncidentsTable
            records={paginatedIncidents}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onViewDetail={(data) => setRecordDetailModal({ open: true, data })}
            onReview={openReviewSingle}
            onReviewHealth={(record) => setHealthReviewDialog({ open: true, record })}
          />
        )}

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
      {selectedIds.length > 0 && (
        <div className="sm:hidden fixed bottom-4 inset-x-3.5 z-40 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-gray-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-gray-800">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-green-500/20 text-green-400 font-black text-xs flex items-center justify-center font-mono">
                {selectedIds.length}
              </span>
              <span className="text-xs font-bold text-gray-200">
                {selectedIds.length === 1 ? "Record Selected" : "Records Selected"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={openReviewBatch}
                className="bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-bold py-2.5 px-3.5 rounded-xl shadow-md gap-1.5"
              >
                <ShieldCheck size={14} />
                <span>Validate ({selectedIds.length})</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSelectedIds([])}
                className="h-8 w-8 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

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
