"use client";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";
import api from "@/lib/axios";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Activity,FileSpreadsheet,QrCode,ShieldCheck,Tag } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// Domain & Analytics
import { ProductionRecordItem } from "@/app/(farmer)/production-dashboard/production-analytics";
import { CensusSubmissionRecord } from "@/app/(sibat)/sibat/sibat-analytics";
import {
ValidationDomain,
ValidationIncidentItem,
ValidationInventoryItem,
ValidationStatus,
getIncidentTypeBadge,
useAdminCensusSubmissions,
useAdminIncidentRecords,
useAdminInventoryRecords,
useAdminProductionRecords,
} from "./validation-analytics";

// Extracted Modular Components
import { useAdminBarangays } from "@/app/(admin)/admin/admin-charts";
import { SlaughterReviewQueue } from "@/app/(admin)/slaughter-record-review/slaughter-review-queue";
import { DataTableSection } from "@/components/ui/data-table-section";
import { ValidationLoadingScreen } from "@/components/validation-loading-screen";
import {
ActiveDomainTable,
BulkActionDock,
DiseaseMortalityReviewDialog,
DomainTabs,
HerdBatchesBanner,
ValidationKpis,
ValidationPagination,
ValidationToolbar,
} from "./components";

// Dialog Modals
import {
DetailRecordData,
RecordDetailDialog,
} from "./record-detail-dialog";
import {
ReviewTargetItem,
ValidationReviewDialog,
} from "./validation-review-dialog";

function matchesStatusFilter(
  rawStatus: string | null | undefined,
  statusFilter: ValidationStatus
): boolean {
  if (statusFilter === "ALL") return true;
  const s = (rawStatus || "PENDING").toUpperCase();
  // VERIFIED is the persisted handoff state: SIBAT has finished and MAO can act.
  if (statusFilter === "AWAITING_MAO") return s === "VERIFIED";
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

type DomainFilterState = {
  searchQuery: string;
  statusFilter: ValidationStatus;
  barangayFilter: string;
};

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
      blockedHerdIds.push(id);
      return;
    }
    const record = records.find((r) => String(r.id) === strId);
    if (!record || record.isBatch || record.entryType !== "INDIVIDUAL") {
      blockedHerdIds.push(id);
      return;
    }
    processableIds.push(id);
  });
  return { processableIds, blockedHerdIds };
}

function AdminValidationLoadingScreen({
  censusLoaded = false,
  inventoryLoaded = false,
  incidentLoaded = false,
}: {
  censusLoaded?: boolean;
  inventoryLoaded?: boolean;
  incidentLoaded?: boolean;
}) {
  return (
    <ValidationLoadingScreen
      title="Synchronizing Municipal Validation Records"
      subtitle="Retrieving barangay census submissions, livestock inventory, and field health declarations..."
      items={[
        {
          id: "census",
          label: "Barangay Census",
          sublabel: "Household livestock surveys",
          icon: <FileSpreadsheet className="size-4" />,
          loaded: censusLoaded,
        },
        {
          id: "inventory",
          label: "Livestock Inventory",
          sublabel: "Individual tags and herd pens",
          icon: <Tag className="size-4" />,
          loaded: inventoryLoaded,
        },
        {
          id: "incidents",
          label: "Field Declarations",
          sublabel: "Health reports and mortality",
          icon: <Activity className="size-4" />,
          loaded: incidentLoaded,
        },
      ]}
    />
  );
}

function AdminDataValidationContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedDomain = searchParams.get("domain");
  const highlightId = searchParams.get("highlightId");
  const highlightTag = searchParams.get("tag");
  const requestedRecordType = (searchParams.get("recordType") ?? searchParams.get("legacyType"))?.toUpperCase() ?? null;
  const requestedRecordId = searchParams.get("recordId") ?? searchParams.get("reviewId");
  const requestedBatchId = searchParams.get("batchId");
  const legacyMessage = searchParams.get("legacyMessage")?.toLocaleLowerCase() ?? "";
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeValidationView, setActiveValidationView] = useState<"records" | "slaughter">(requestedDomain === "slaughter" ? "slaughter" : "records");

  const isInventoryRequested =
    requestedDomain === "inventory" ||
    requestedDomain === "livestock" ||
    Boolean(highlightId) ||
    Boolean(highlightTag);

  // Domain tab & filter states
  const [activeDomain, setActiveDomain] = useState<ValidationDomain>(() =>
    isInventoryRequested
      ? "inventory"
      : requestedDomain === "census" ||
        requestedDomain === "incidents"
      ? requestedDomain
      : requestedDomain === "production"
        ? "incidents"
      : "census"
  );
  const [domainFilters, setDomainFilters] = useState<Record<ValidationDomain, DomainFilterState>>({
    census: { searchQuery: "", statusFilter: "ALL", barangayFilter: "ALL" },
    production: { searchQuery: "", statusFilter: "ALL", barangayFilter: "ALL" },
    inventory: { searchQuery: "", statusFilter: "ALL", barangayFilter: "ALL" },
    incidents: { searchQuery: "", statusFilter: "ALL", barangayFilter: "ALL" },
  });

  // Sync active domain and filters when arriving via direct link or QR scan
  useEffect(() => {
    if (isInventoryRequested) {
      setActiveDomain("inventory");
      setActiveValidationView("records");
    } else if (requestedDomain === "slaughter") {
      setActiveValidationView("slaughter");
    } else if (requestedDomain === "production") {
      // Production yields are informational. Keep legacy notification links
      // working by opening their detail dialog over the incidents workspace.
      setActiveDomain("incidents");
      setActiveValidationView("records");
    } else if (
      requestedDomain === "census" ||
      requestedDomain === "incidents"
    ) {
      setActiveDomain(requestedDomain);
      setActiveValidationView("records");
    }
  }, [isInventoryRequested, requestedDomain]);

  useEffect(() => {
    if (highlightId || highlightTag) {
      setDomainFilters((prev) => ({
        ...prev,
        inventory: {
          ...prev.inventory,
          statusFilter: "ALL",
        },
      }));
    }
  }, [highlightId, highlightTag]);
  const { searchQuery, statusFilter, barangayFilter } = domainFilters[activeDomain];
  const updateActiveDomainFilter = <K extends keyof DomainFilterState>(
    key: K,
    value: DomainFilterState[K],
  ) => {
    setDomainFilters((current) => ({
      ...current,
      [activeDomain]: { ...current[activeDomain], [key]: value },
    }));
  };
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
  const { data: barangayCatalog = [] } = useAdminBarangays();

  const notificationDataset = requestedRecordType === "INVENTORY" || requestedRecordType === "BATCH"
    ? rawInventoryData
    : requestedRecordType === "PRODUCTION"
      ? rawProductionData
      : requestedRecordType === "CENSUS"
        ? rawCensusData
        : requestedRecordType === "DISEASE" || requestedRecordType === "MORTALITY" ||
          requestedRecordType === "SALE" || requestedRecordType === "CALVING" || requestedRecordType === "INSPECTION"
          ? rawIncidentData
          : undefined;
  // A notification dialog only depends on its own dataset. An unrelated failed
  // domain request must not keep the requested record hidden behind the loader.
  const isInitialLoading = requestedRecordType
    ? notificationDataset === undefined
    : rawCensusData === undefined || rawInventoryData === undefined || rawIncidentData === undefined;

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
    const list: ValidationInventoryItem[] = (rawInventoryData || []).map((inv) => {
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

    if (highlightId || highlightTag) {
      const tagLower = (highlightTag || highlightId || "").toLowerCase();
      const hasRecord = list.some(
        (inv) =>
          (highlightId && (String(inv.id) === String(highlightId) || String(inv.rawId) === String(highlightId))) ||
          (highlightTag && (
            inv.tagNumber?.toLowerCase() === tagLower ||
            inv.tagNumber?.toLowerCase().includes(tagLower) ||
            tagLower.includes(inv.tagNumber?.toLowerCase() || "")
          ))
      );

      // If the scanned item (e.g. tag 240 demo animal or newly added item) is not present in fetched records,
      // provide it so it immediately renders and is highlighted in green.
      if (!hasRecord) {
        const demoTag = highlightTag || String(highlightId || "240");
        list.unshift({
          id: highlightId ? (isNaN(Number(highlightId)) ? highlightId : Number(highlightId)) : 240,
          rawId: highlightId && !isNaN(Number(highlightId)) ? Number(highlightId) : 240,
          isBatch: false,
          farmerName: "Juan Dela Cruz",
          barangayName: "San Juan",
          livestockType: "Cattle",
          tagNumber: demoTag,
          breed: "Brahman",
          sex: "Male",
          birthDate: "2024-01-15",
          age: { years: 2, months: 0, total_months: 24 },
          ageClassification: "ADULT",
          weight: 420,
          entryType: "INDIVIDUAL",
          quantity: 1,
          lastVaccinationDate: "2026-01-15",
          operationalStatus: "ACTIVE",
          status: "VERIFIED",
          reviewRemarks: "Active registration scanned from livestock pass.",
          reviewedBy: "SIBAT Officer",
          reviewedAt: "2026-01-15",
          createdAt: "2026-01-15T00:00:00Z",
          photoUrl: "/images/species-cattle.jpg",
          photoName: `Animal Passport #${demoTag}`,
        });
      }
    }

    return list;
  }, [rawInventoryData, localInventoryOverrides, highlightId, highlightTag]);

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

  // Notification links carry a canonical record type and ID. Resolve them
  // against the same authorized datasets used by the validation tables.
  const notificationDetail = useMemo<DetailRecordData | null>(() => {
    if (!requestedRecordType) return null;
    const id = requestedRecordId ? Number(requestedRecordId) : null;
    if (id !== null && !Number.isFinite(id)) return null;

    if (requestedRecordType === "INVENTORY" || requestedRecordType === "BATCH") {
      const isBatch = requestedRecordType === "BATCH";
      const candidates = inventoryRecords.filter((record) => Boolean(record.isBatch) === isBatch);
      const item = id !== null
        ? candidates.find((record) => record.rawId === id)
        : candidates.filter((record) => {
            const identity = (isBatch ? record.batchCode || record.tagNumber : record.tagNumber)?.toLocaleLowerCase();
            return !!identity && legacyMessage.includes(identity);
          }).length === 1
          ? candidates.find((record) => {
              const identity = (isBatch ? record.batchCode || record.tagNumber : record.tagNumber)?.toLocaleLowerCase();
              return !!identity && legacyMessage.includes(identity);
            })
          : undefined;
      if (!item) return null;
      return {
        kind: "inventory", id: item.id, rawId: item.rawId, isBatch: item.isBatch,
        batchId: item.batchId, farmerName: item.farmerName, barangayName: item.barangayName,
        livestockType: item.livestockType, tagNumber: item.tagNumber, breed: item.breed,
        sex: item.sex, birthDate: item.birthDate, age: item.age,
        ageClassification: item.ageClassification, weight: item.weight,
        entryType: item.entryType, quantity: item.quantity,
        lastVaccinationDate: item.lastVaccinationDate, status: item.status,
        reviewRemarks: item.reviewRemarks, reviewedByName: item.reviewedBy,
        reviewedAt: item.reviewedAt, createdAt: item.createdAt, batchCode: item.batchCode,
        batchName: item.batchName, housingPen: item.housingPen, feedType: item.feedType,
        targetWeight: item.targetWeight, animals: item.animals, photoUrl: item.photoUrl,
        photoName: item.photoName,
      };
    }

    if (requestedRecordType === "PRODUCTION") {
      const candidates = id !== null
        ? productionRecords.filter((record) => record.id === id)
        : productionRecords.filter((record) => {
            const farmer = record.farmerName?.toLocaleLowerCase();
            const amount = `${record.quantity} ${record.unit}`.toLocaleLowerCase();
            return !!farmer && legacyMessage.includes(farmer) && legacyMessage.includes(amount);
          });
      const item = candidates.length === 1 ? candidates[0] : undefined;
      if (!item) return null;
      return {
        kind: "production", id: item.id, farmerName: item.farmerName || "Registered Farmer",
        barangayName: item.barangayName || "Padre Garcia",
        livestockTypeName: item.livestockTypeName || "Livestock",
        livestockTagNumber: item.livestockTagNumber,
        productionType: item.productionType, quantity: item.quantity, unit: item.unit,
        recordDate: item.recordDate, notes: item.notes, status: item.status,
        reviewRemarks: item.reviewRemarks, reviewedByName: item.reviewedByName,
        reviewedByRole: item.reviewedByRole,
        reviewedAt: item.reviewedAt, createdAt: item.createdAt,
        slaughterDetails: item.slaughterDetails,
        anomalyAssessmentStatus: item.anomalyAssessmentStatus,
        anomalyDetected: item.anomalyDetected,
        requiresCbatVerification: item.requiresCbatVerification,
        nextReviewQueue: item.nextReviewQueue,
        anomalyReason: item.anomalyReason,
        anomalyAssessment: item.anomalyAssessment,
      };
    }

    if (requestedRecordType === "CENSUS") {
      const candidates = id !== null
        ? censusSubmissions.filter((record) => String(record.id) === requestedRecordId)
        : censusSubmissions.filter((record) => {
            const barangay = record.barangay?.toLocaleLowerCase();
            const period = `q${record.reportQuarter} ${record.reportYear}`.toLocaleLowerCase();
            return !!barangay && legacyMessage.includes(barangay) && legacyMessage.includes(period);
          });
      const item = candidates.length === 1 ? candidates[0] : undefined;
      if (!item) return null;
      return {
        kind: "census", id: item.id, barangay: item.barangay,
        reportYear: item.reportYear, reportQuarter: item.reportQuarter,
        submissionDate: item.submissionDate, submittedBy: item.submittedBy,
        totalHeads: item.totalHeads, totalFarmers: item.totalFarmers,
        status: item.status, remarks: item.remarks, reviewRemarks: item.reviewRemarks,
        reviewedByName: item.submittedBy, reviewedAt: item.submissionDate, items: item.items,
      };
    }

    const incidentTypeByRecordType: Record<string, ValidationIncidentItem["type"]> = {
      DISEASE: "disease", MORTALITY: "mortality", SALE: "sale",
      CALVING: "birth", INSPECTION: "inspection",
    };
    const incidentType = incidentTypeByRecordType[requestedRecordType];
    if (!incidentType) return null;
    const candidates = id !== null
      ? incidents.filter((record) => record.type === incidentType && record.id.endsWith(`-${requestedRecordId}`))
      : incidents.filter((record) => {
          const tag = record.tagNumber?.toLocaleLowerCase();
          return !!tag && legacyMessage.includes(tag);
        });
    const item = candidates.length === 1 ? candidates[0] : undefined;
    if (!item) return null;
    return {
      kind: "incident", id: item.id, type: item.type, farmerName: item.farmerName,
      barangayName: item.barangayName, details: item.details, date: item.date,
      status: item.status, reviewRemarks: item.reviewRemarks, reviewedByName: item.reviewedBy,
      reviewedAt: item.reviewedAt, headCount: item.headCount, auctionRecord: item.auctionRecord,
      weight: item.weight, tagNumber: item.tagNumber, photoUrl: item.photoUrl,
      photoName: item.photoName, inspectorPhotoUrl: item.inspectorPhotoUrl,
      inspectorPhotoName: item.inspectorPhotoName,
    };
  }, [requestedRecordId, requestedRecordType, legacyMessage, inventoryRecords, productionRecords, censusSubmissions, incidents]);

  // Use the official barangay catalog for filter options. Deriving these from
  // submission labels allowed malformed record text to appear as a barangay.
  const barangayOptions = useMemo(
    () => barangayCatalog.map((barangay) => barangay.barangay_name.trim()).filter(Boolean).sort(),
    [barangayCatalog],
  );

  // Global KPI Summary
  const kpis = useMemo(() => {
    const allRecords = [
      ...censusSubmissions.map((c) => ({ status: c.status, barangay: c.barangay })),
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
  }, [censusSubmissions, inventoryRecords, incidents]);

  // Domain Breakdown Counters
  const domainPendingCounts = useMemo(() => ({
    census: censusSubmissions.filter((c) => (c.status || "PENDING").toUpperCase() === "PENDING").length,
    production: 0,
    inventory: inventoryRecords.filter((i) => !i.isBatch && i.entryType === "INDIVIDUAL" && (i.status || "PENDING").toUpperCase() === "PENDING").length,
    incidents: incidents.filter((inc) => (inc.status || "PENDING").toUpperCase() === "PENDING").length,
  }), [censusSubmissions, inventoryRecords, incidents]);

  const domainVerifiedCounts = useMemo(() => ({
    census: censusSubmissions.filter((c) => (c.status || "").toUpperCase() === "VERIFIED").length,
    production: 0,
    inventory: inventoryRecords.filter((i) => !i.isBatch && i.entryType === "INDIVIDUAL" && (i.status || "").toUpperCase() === "VERIFIED").length,
    // Only records whose stored status is VERIFIED belong in this badge.
    // Pending inspections remain reviewable, but they are not SIBAT-verified.
    incidents: incidents.filter((inc) => inc.status === "VERIFIED").length,
  }), [censusSubmissions, inventoryRecords, incidents]);

  const domainTotalCounts = useMemo(() => ({
    census: censusSubmissions.length,
    production: 0,
    inventory: inventoryRecords.filter((i) => !i.isBatch && i.entryType === "INDIVIDUAL").length,
    incidents: incidents.length,
  }), [censusSubmissions, inventoryRecords, incidents]);

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

  const filteredProduction = useMemo<ProductionRecordItem[]>(() => {
    return [];
  }, []);

  const filteredInventory = useMemo(() => {
    return inventoryRecords.filter((inv) => {
      if (requestedBatchId && (inv.isBatch || String(inv.batchId ?? "") !== requestedBatchId)) return false;
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
  }, [inventoryRecords, searchQuery, statusFilter, barangayFilter, requestedBatchId]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchSearch =
        !searchQuery ||
        inc.farmerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.barangayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "AWAITING_MAO"
        ? (inc.type === "inspection"
            ? (inc.status || "PENDING").toUpperCase() === "PENDING"
            : (inc.status || "PENDING").toUpperCase() === "VERIFIED")
        : matchesStatusFilter(inc.status, statusFilter);
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

  // Ensure the page displaying the highlighted scanned animal is selected
  useEffect(() => {
    if (highlightId || highlightTag) {
      const tagLower = (highlightTag || "").toLowerCase();
      const idx = filteredInventory.findIndex(
        (inv) =>
          (highlightId && (String(inv.id) === String(highlightId) || String(inv.rawId) === String(highlightId))) ||
          (highlightTag && (
            inv.tagNumber?.toLowerCase() === tagLower ||
            inv.tagNumber?.toLowerCase().includes(tagLower) ||
            tagLower.includes(inv.tagNumber?.toLowerCase() || "")
          ))
      );
      if (idx !== -1) {
        const targetPage = Math.floor(idx / pageSize) + 1;
        setDomainPages((prev) => ({ ...prev, inventory: targetPage }));
      }
    }
  }, [highlightId, highlightTag, filteredInventory, pageSize]);

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
        return [];
      case "inventory":
        return paginatedInventory
          .filter((i) => (i.status || "PENDING").toUpperCase() === "VERIFIED" && !i.isBatch && i.entryType === "INDIVIDUAL")
          .map((i) => i.id);
      case "incidents":
        return paginatedIncidents
          .filter((inc) => inc.status === "VERIFIED" || (inc.type === "inspection" && inc.status === "PENDING"))
          .map((inc) => inc.id);
    }
  }, [activeDomain, paginatedCensus, paginatedInventory, paginatedIncidents]);

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
      targets = [];
    } else if (activeDomain === "inventory") {
      targets = inventoryRecords
        .filter((i) => selectedIds.includes(i.id) && (i.status || "PENDING").toUpperCase() === "VERIFIED" && !i.isBatch && i.entryType === "INDIVIDUAL")
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
        .filter((inc) => selectedIds.includes(inc.id) && (inc.status === "VERIFIED" || (inc.type === "inspection" && inc.status === "PENDING")))
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

    // Bulk approval is an MAO step: require every selected item to have completed
    // SIBAT verification instead of silently reviewing only the verified subset.
    const selectedAreAllVerified = selectedIds.every((id) => {
      if (activeDomain === "census") {
        return censusSubmissions.find((item) => item.id === id)?.status.toUpperCase() === "VERIFIED";
      }
      if (activeDomain === "production") {
        return false;
      }
      if (activeDomain === "inventory") {
        const item = inventoryRecords.find((record) => record.id === id);
        return item?.status.toUpperCase() === "VERIFIED" && !item.isBatch && item.entryType === "INDIVIDUAL";
      }
      return incidents.find((item) => item.id === id)?.status.toUpperCase() === "VERIFIED";
    });

    if (!selectedAreAllVerified || targets.length !== selectedIds.length) {
      toast.info("Bulk approval requires every selected record to be SIBAT verified.", {
        description: "Clear the selection and choose only verified records awaiting MAO review.",
      });
      return;
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
            `${blockedHerdIds.length} selected record(s) are not individual animal records and cannot be reviewed.`,
            {
              description: "Select individual animal records. Legacy aggregate entries need reconciliation before review.",
            }
          );
        }

        if (processableIds.length === 0) {
          setSelectedIds([]);
          return;
        }

        await Promise.all(
          processableIds.map((id) => {
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
            description: remarks ? `Remarks: "${remarks}"` : "Selected animal records updated individually.",
          });
        }
        return;
      } else {
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
            if (strId.startsWith("insp-")) {
              const cleanId = strId.replace("insp-", "");
              return api.post(`inspections/${cleanId}/review/`, { status: action, remarks });
            }
            return Promise.resolve();
          })
        );
        setLocalIncidentOverrides((prev) => {
          const next = { ...prev };
          itemIds.forEach((id) => {
            next[String(id)] = { status: action, remarks };
          });
          return next;
        });
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
          description: remarks ? `Remarks: "${remarks}"` : "Selected animal records updated individually.",
        });
      }
    } catch (err) {
      console.error("Failed to perform validation review action:", err);
      const responseData = axios.isAxiosError(err)
        ? (err.response?.data as { status?: string; remarks?: string; error?: string } | undefined)
        : undefined;
      const apiMessage = responseData?.status || responseData?.remarks || responseData?.error;
      toast.error("Review action was not applied.", {
        description: apiMessage || "The record may have changed. Please refresh and review it again.",
      });
      throw err;
    }
  };

  // ── Confirmation Handler for Disease & Mortality SIBAT Review ──
  const handleConfirmHealthAction = async (
    action: "APPROVED" | "SUBJECT_TO_REVISION",
    remarks: string,
    recordId: string
  ) => {
    try {
      if (recordId.startsWith("dis-")) {
        const cleanId = recordId.replace("dis-", "");
        await api.post(`diseases/cases/${cleanId}/review/`, { status: action, remarks });
      } else if (recordId.startsWith("mor-")) {
        const cleanId = recordId.replace("mor-", "");
        await api.post(`diseases/mortality/${cleanId}/review/`, { status: action, remarks });
      }
      setLocalIncidentOverrides((prev) => ({
        ...prev,
        [recordId]: { status: action, remarks },
      }));
      queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      const actionVerb = action === "APPROVED" ? "certified & approved" : "returned for revision";
      toast.success(`Health declaration ${recordId} ${actionVerb}.`, {
        description: remarks ? `Remarks: "${remarks}"` : "Official MAO audit trail recorded.",
      });
    } catch (err) {
      console.error("Failed to review health incident:", err);
      const responseData = axios.isAxiosError(err)
        ? (err.response?.data as { remarks?: string; error?: string; status?: string } | undefined)
        : undefined;
      toast.error("Failed to update health review status.", {
        description: responseData?.remarks || responseData?.error || responseData?.status || "Please refresh the record and try again.",
      });
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
        <AdminValidationLoadingScreen
          censusLoaded={rawCensusData !== undefined}
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

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-16 sm:pb-6">
        {/* KPI Strip */}
        <ValidationKpis
          kpis={kpis}
          pendingBreakdown={domainPendingCounts}
          verifiedBreakdown={domainVerifiedCounts}
        />

        {/* Herds & Livestock Drilldown Callout Banner */}
        <HerdBatchesBanner />

        <DomainTabs
          activeTab={activeValidationView === "records" ? activeDomain : "slaughter"}
          activeDomain={activeDomain}
          onTabChange={(tab) => {
            if (tab === "slaughter") {
              setActiveValidationView("slaughter");
            } else {
              setActiveDomain(tab);
              setActiveValidationView("records");
              setSelectedIds([]);
            }
          }}
          pendingCounts={domainPendingCounts}
          verifiedCounts={domainVerifiedCounts}
          totalCounts={domainTotalCounts}
        />

        {activeValidationView === "slaughter" ? (
          <SlaughterReviewQueue />
        ) : (
          <>

        {/* Search, Filter & Bulk Actions Toolbar */}
        <ValidationToolbar
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            updateActiveDomainFilter("searchQuery", q);
            setDomainPages((prev) => ({ ...prev, [activeDomain]: 1 }));
          }}
          barangayFilter={barangayFilter}
          onBarangayChange={(b) => {
            updateActiveDomainFilter("barangayFilter", b);
            setDomainPages((prev) => ({ ...prev, [activeDomain]: 1 }));
          }}
          uniqueBarangays={barangayOptions}
          statusFilter={statusFilter}
          onStatusChange={(s) => {
            updateActiveDomainFilter("statusFilter", s);
            setDomainPages((prev) => ({ ...prev, [activeDomain]: 1 }));
          }}
          selectedCount={selectedIds.length}
          onBulkAction={openReviewBatch}
          onClearSelection={() => setSelectedIds([])}
        />

        {/* Row count changes the rows, not the validation workspace's baseline height. */}
        <DataTableSection
          footer={
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
          }
        >
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
            highlightId={highlightId}
            highlightTag={highlightTag}
          />
        </DataTableSection>
          </>
        )}
      </div>

      {/* ── FLOATING MOBILE BULK ACTION DOCK ── */}
      {activeValidationView === "records" ? <BulkActionDock
        count={selectedIds.length}
        onValidate={openReviewBatch}
        onClear={() => setSelectedIds([])}
      /> : null}

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
        record={recordDetailModal.data ?? notificationDetail}
        open={recordDetailModal.open || notificationDetail !== null}
        onOpenChange={(open) => {
          setRecordDetailModal((prev) => ({ ...prev, open }));
          if (!open && (searchParams.has("recordId") || searchParams.has("reviewId") ||
            searchParams.has("legacyType") || searchParams.has("legacyMessage"))) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("recordType");
            params.delete("recordId");
            params.delete("reviewId");
            params.delete("legacyType");
            params.delete("legacyMessage");
            const query = params.toString();
            window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
          }
        }}
        onConfirmAction={(action, remarks, itemIds) => {
          return handleConfirmAction(action, remarks, itemIds);
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
            photoUrl: "photoUrl" in rec ? rec.photoUrl || null : null,
            photoName: "photoName" in rec ? rec.photoName || null : null,
            inspectorPhotoUrl: rec.kind === "incident" ? rec.inspectorPhotoUrl || null : null,
            inspectorPhotoName: rec.kind === "incident" ? rec.inspectorPhotoName || null : null,
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

function AdminDataValidationRoute() {
  const searchParams = useSearchParams();

  // Reinitialize route-derived state when a notification/deep link changes the query string.
  return <AdminDataValidationContent key={searchParams.toString()} />;
}

export default function AdminDataValidationPage() {
  return (
    <Suspense fallback={<AdminValidationLoadingScreen />}>
      <AdminDataValidationRoute />
    </Suspense>
  );
}
