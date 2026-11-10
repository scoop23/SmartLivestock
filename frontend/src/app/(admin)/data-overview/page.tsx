"use client";

import type { BatchApiItem } from "@/app/(farmer)/livestock-inventory/livestock-inventory";
import type { OverviewRecord } from "./data-overview-types";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useMemo,useState } from "react";
import { toast } from "sonner";

// Domain Types, Datasets & Utilities
import {
ActivityFeedItem,
BarangaySummary,
BatchRecord,
CensusRecord,
DataTab,
DiseaseRecord,
LivestockRecord,
MortalityRecord,
ProductionRecord,
SalesRecord,
SlaughterRecord
} from "./data-overview-types";

// Modular Components
import { fetchInspections } from "@/app/(auction)/auction-inspections/auction-analytics";
import { ValidationLoadingScreen, useSeamlessLoadingState } from "@/components/validation-loading-screen";
import { cowHead } from "@lucide/lab";
import api from "@/lib/axios";
import { Activity,BarChart3,Boxes,Database,FileSpreadsheet,Icon,Layers,ShieldCheck } from "lucide-react";
import { DataOverviewCards } from "./data-overview-cards";
import { DataOverviewDetailModal } from "./data-overview-detail-modal";
import { DataOverviewKpis } from "./data-overview-kpis";
import { DataOverviewOverallView } from "./data-overview-overall-view";
import { DataOverviewTable } from "./data-overview-table";
import { DataOverviewToolbar } from "./data-overview-toolbar";
import { ProductionTradeRecords } from "./production-trade-records";
import type { ProductionRecordItem } from "@/app/(farmer)/production-dashboard/production-analytics";

// Backend TanStack hooks & API client for live database connectivity
import { useGetBarangays } from "@/app/(sibat)/sibat/sibat-analytics";
import { municipalRead } from "@/lib/municipal-read";
import { type OverviewSummary,overviewBarangays } from "@/lib/population-metrics";
import { useQuery } from "@tanstack/react-query";
import {
useAdminCensusSubmissions,
useAdminIncidentRecords,
useAdminInventoryRecords,
} from "../data-validation/validation-analytics";

type OfficialSlaughterApi = {
  id: number; livestock_type_name: string; barangay_name?: string | null;
  created_by_name: string; selected_animal_tags: string[]; carcass_weight: string | null;
  record_date: string; status: string; farmer_reported: boolean;
};

const normalizeStatus = (value: string) => value.trim().toUpperCase().replace(/[\s-]+/g, "_");
const EMPTY_PRODUCTION_RECORDS: ProductionRecordItem[] = [];

const STATUS_FILTER_ALIASES: Record<string, string[]> = {
  APPROVED: ["CERTIFIED", "MAO_VERIFIED"],
  VERIFIED: ["SIBAT_VERIFIED"],
  PENDING: ["PENDING_REVIEW", "AWAITING_REVIEW", "AWAITING_SIBAT", "PENDING_AUDIT", "PENDING_CLEARANCE", "IN_REVIEW", "AWAITING_MAO"],
  SUBJECT_TO_REVISION: ["SUBJECT_FOR_REVISION", "REVISION_REQUIRED"],
  Healthy: ["PASSED"],
};

function matchesStatusFilter(item: OverviewRecord, filter: string) {
  if (filter === "all") return true;

  const acceptedStatuses = new Set(
    [filter, ...(STATUS_FILTER_ALIASES[filter] ?? [])].map(normalizeStatus)
  );
  const recordStatuses = [
    item.status,
    item.reviewStatus,
    item.review_status,
    item.healthStatus,
  ].filter((status): status is string => typeof status === "string");

  return recordStatuses.some((status) => acceptedStatuses.has(normalizeStatus(status)));
}

export default function DataOverviewPage() {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<DataTab>("overall");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBarangay, setFilterBarangay] = useState("all");
  const [filterSpecie, setFilterSpecie] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showLivestockHistory, setShowLivestockHistory] = useState(false);
  const [historyLifecycle, setHistoryLifecycle] = useState("ALL");

  // Record Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<OverviewRecord | null>(null);
  const [selectedRecordDomain, setSelectedRecordDomain] = useState<DataTab>("livestock");

  const { user } = useAuth();

  // The Production & Trade tab count includes its separate ownership and movement registries.
  // Lazy-load only when the Sales/Trade tab is active to avoid downloading 18k+ records on initial overview load.
  const tradeOwnershipQuery = useQuery<unknown[]>({
    queryKey: ["admin", "data-overview", "ownership-transfers", user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: async () => (await api.get<unknown[]>("livestock/ownership-transfers/")).data,
    enabled: activeTab === "sales",
    staleTime: 60 * 1000,
  });
  const tradeMovementQuery = useQuery({
    queryKey: ["admin", "data-overview", "movement-logs", user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: () => fetchInspections(),
    enabled: activeTab === "sales",
    staleTime: 60 * 1000,
  });

  // Backend Data Queries
  const barangaysQuery = useGetBarangays();
  const { data: dbBarangays } = barangaysQuery;
  const summaryQuery = useQuery<OverviewSummary>({
    queryKey: ["admin", "analytics", "overview", user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: async ({ signal }) => (await municipalRead<OverviewSummary>("analytics/overview/", { signal })).data,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
  const summary = summaryQuery.data;
  const inventoryQuery = useAdminInventoryRecords();
  const { data: rawInventory, isLoading: isInvLoading } = inventoryQuery;
  const rawProduction = EMPTY_PRODUCTION_RECORDS;
  const slaughterQuery = useQuery<OfficialSlaughterApi[]>({
    queryKey: ["admin", "official-slaughter-records"],
    queryFn: async ({ signal }) => (await municipalRead<OfficialSlaughterApi[]>("production/slaughterhouse/records/", { signal })).data,
  });
  const censusQuery = useAdminCensusSubmissions();
  const incidentsQuery = useAdminIncidentRecords();
  const { data: rawCensus, isLoading: isCenLoading } = censusQuery;
  const { data: rawIncidents, isLoading: isIncLoading } = incidentsQuery;
  const batchQuery = useQuery<BatchApiItem[]>({
    queryKey: ["admin-batches-overview"],
    queryFn: async ({ signal }) => {
      const res = await municipalRead("livestock/batches/?all=true&include_roster=true", { signal });
      if (!Array.isArray(res.data)) throw new Error("Unexpected herd response.");
      return res.data;
    },
    staleTime: 30 * 1000,
  });
  const { data: rawSlaughter, isLoading: isSlaughterLoading } = slaughterQuery;
  const { data: rawBatches, isLoading: isBatchLoading } = batchQuery;

  const dataSources = [
    { label: "Overview totals", query: summaryQuery },
    { label: "Livestock inventory", query: inventoryQuery },
    { label: "Slaughter records", query: slaughterQuery },
    { label: "Census submissions", query: censusQuery },
    { label: "Disease and mortality records", query: incidentsQuery },
    { label: "Herd batches", query: batchQuery },
    { label: "Barangay list", query: barangaysQuery },
  ];
  const failedSources = dataSources.filter(({ query }) => query.isError).map(({ label }) => label);

  const isDataLoading = summaryQuery.isLoading || isInvLoading || isSlaughterLoading || isCenLoading || isIncLoading || isBatchLoading;

  const isInitialLoading =
    summaryQuery.isLoading ||
    (isInvLoading && !rawInventory) ||
    (isBatchLoading && !rawBatches) ||
    (isSlaughterLoading && !rawSlaughter) ||
    (isCenLoading && !rawCensus) ||
    (isIncLoading && !rawIncidents);
  const { keepLoadingScreenMounted, showContent } = useSeamlessLoadingState(isInitialLoading, {
    exitDurationMs: 500,
    contentDelayMs: 200,
  });

  // Combine backend records with seed datasets
  const livestockList: LivestockRecord[] = useMemo(() => {
    if (!rawInventory || rawInventory.length === 0) return [];

    // Pre-index batches by id, batch_code, and animal references for O(1) matching
    const batchById = new Map<string | number, BatchApiItem>();
    const batchByCode = new Map<string, BatchApiItem>();
    const batchByAnimalId = new Map<string | number, BatchApiItem>();
    const batchByAnimalTag = new Map<string, BatchApiItem>();

    if (rawBatches && rawBatches.length > 0) {
      for (let i = 0; i < rawBatches.length; i++) {
        const b = rawBatches[i];
        if (b.id != null) batchById.set(b.id, b);
        if (b.batch_code) batchByCode.set(b.batch_code, b);
        if (b.animals && b.animals.length > 0) {
          for (let j = 0; j < b.animals.length; j++) {
            const a = b.animals[j];
            if (a.id != null) batchByAnimalId.set(a.id, b);
            if (a.tag_number) batchByAnimalTag.set(a.tag_number, b);
          }
        }
      }
    }

    return rawInventory
      .filter((item) => !item.isBatch)
      .map((item) => {
        const matchingBatch =
          (item.batchId ? batchById.get(item.batchId) : undefined) ||
          (item.batch ? batchById.get(item.batch) : undefined) ||
          (item.batchCode ? batchByCode.get(item.batchCode) : undefined) ||
          batchByAnimalId.get(item.id) ||
          (item.tagNumber ? batchByAnimalTag.get(item.tagNumber) : undefined);

        const batchCode =
          item.batchCode ||
          matchingBatch?.batch_code ||
          undefined;

        const batchName =
          item.batchName ||
          matchingBatch?.batch_name ||
          (matchingBatch ? `Batch #${matchingBatch.id}` : undefined);

        const batchId =
          item.batchId ||
          item.batch ||
          matchingBatch?.id ||
          null;

        const housingPen =
          item.housingPen ||
          matchingBatch?.housing_pen ||
          undefined;

        const feedType =
          item.feedType ||
          matchingBatch?.feed_type ||
          undefined;

        return {
          id: `LIV-${item.id}`,
          // Keep the numeric database key for actions like QR lookup while `id`
          // remains a readable label for the table and record dialog.
          rawId: item.id,
          farmerName: item.farmerName || "Registered Farmer",
          barangay: item.barangayName || "Unknown barangay",
          cattleId: item.tagNumber || `TAG-${item.id}`,
          tagNumber: item.tagNumber || undefined,
          specie: item.livestockType || "Cattle",
          breed: item.breed || "Standard",
          sex: item.sex || "Female",
          birthDate: item.birthDate ?? null,
          age: item.age ?? null,
          ageClassification: item.ageClassification ?? "UNKNOWN",
          weightKg: item.weight || null,
          entryType: item.entryType || (batchCode ? "BATCH" : "INDIVIDUAL"),
          quantity: Number(item.quantity) || 1,
          lastVaccinationDate: item.lastVaccinationDate || null,
          operationalStatus: item.operationalStatus,
          status: item.status || "PENDING",
          registrationDate: item.createdAt?.slice(0, 10) || "",
          notes: item.reviewRemarks || undefined,
          batchId,
          batchCode,
          batchName,
          housingPen,
          feedType,
        };
      });
  }, [rawInventory, rawBatches]);

  const batchList: BatchRecord[] = useMemo(() => {
    if (!rawBatches || rawBatches.length === 0) return [];
    return rawBatches.map((item) => ({
      id: `BAT-${item.id}`,
      rawId: item.id,
      batchCode: item.batch_code || `BAT-${item.id}`,
      batchName: item.batch_name || `Batch #${item.id}`,
      farmerName: item.farmer_name || "Registered Farmer",
      barangay: item.barangay_name || "Unknown barangay",
      specie: item.livestock_type_name || "Cattle",
      housingPen: item.housing_pen || "General Pen",
      feedType: item.feed_type || "—",
      targetWeight: item.target_weight || null,
      targetHarvestDate: item.target_harvest_date || null,
      totalAnimals: item.total_animals || (item.animals ? item.animals.length : 0),
      averageWeight: item.average_weight || null,
      status: item.status || "ACTIVE",
      reviewRemarks: item.review_remarks,
      reviewedByName: item.reviewed_by_name,
      reviewedAt: item.reviewed_at,
      notes: item.notes,
      createdAt: item.created_at?.slice(0, 10) || "",
      animals: item.animals || [],
    }));
  }, [rawBatches]);

  const productionList: ProductionRecord[] = useMemo(() => {
    if (!rawProduction || rawProduction.length === 0) return [];
    return rawProduction.map((item) => ({
      id: `PRD-${item.id}`,
      farmerName: item.farmerName || "Registered Farmer",
      barangay: item.barangayName || "Unknown barangay",
      cattleId: `TAG-LIV-${item.livestockId}`,
      specie: item.livestockTypeName || item.productionType,
      type: (item.productionType?.toLowerCase() === "milk"
        ? "Cow Milk"
        : item.productionType?.toLowerCase() === "eggs"
        ? "Eggs"
        : "Wool"),
      quantity: `${item.quantity} ${item.unit || "L"}`,
      quantityNumber: Number(item.quantity) || 0,
      unit: item.unit || "LITERS",
      qualityGrade: "Not recorded",
      collectionCenter: "Not recorded",
      estValuePhp: item.valuationSnapshot ? Number(item.valuationSnapshot.estimated_value) : null,
      date: item.recordDate || "",
      status: (item.status === "APPROVED" ? "Certified" : "Pending Review"),
      reviewStatus: item.status,
    }));
  }, [rawProduction]);

  const censusList: CensusRecord[] = useMemo(() => {
    if (!rawCensus || rawCensus.length === 0) return [];
    return rawCensus.map((item) => {
      const cattleCount =
        item.items
          ?.filter(
            (i) =>
              i.livestockType?.toLowerCase().includes("cattle") ||
              i.livestockType?.toLowerCase().includes("baka")
          )
          ?.reduce((sum, i) => sum + (i.numberOfHeads || 0), 0) || 0;
      const carabaoCount =
        item.items
          ?.filter(
            (i) =>
              i.livestockType?.toLowerCase().includes("carabao") ||
              i.livestockType?.toLowerCase().includes("kalabaw")
          )
          ?.reduce((sum, i) => sum + (i.numberOfHeads || 0), 0) || 0;
      const swineCount =
        item.items
          ?.filter(
            (i) =>
              i.livestockType?.toLowerCase().includes("swine") ||
              i.livestockType?.toLowerCase().includes("baboy") ||
              i.livestockType?.toLowerCase().includes("pig")
          )
          ?.reduce((sum, i) => sum + (i.numberOfHeads || 0), 0) || 0;
      const goatCount =
        item.items
          ?.filter(
            (i) =>
              i.livestockType?.toLowerCase().includes("goat") ||
              i.livestockType?.toLowerCase().includes("kambing") ||
              i.livestockType?.toLowerCase().includes("sheep")
          )
          ?.reduce((sum, i) => sum + (i.numberOfHeads || 0), 0) || 0;

      const totalCalculated =
        cattleCount + carabaoCount + swineCount + goatCount || item.totalHeads || 0;

      return {
        id: `CEN-${item.id}`,
        barangay: item.barangay || "Unknown barangay",
        quarter: `Q${item.reportQuarter || 1}`,
        year: item.reportYear || 2026,
        totalHeads: totalCalculated,
        cattleCount,
        carabaoCount,
        swineCount,
        goatCount,
        enumerator: item.submittedBy || "SIBAT Enumerator",
        verifiedByMAO: item.status === "APPROVED",
        submissionDate: item.submissionDate?.slice(0, 10) || "",
        status: (item.status === "APPROVED" ? "MAO Verified" : "Pending Audit"),
      };
    });
  }, [rawCensus]);

  // Helper for human-readable relative time formatting
  const formatRelativeTime = (dateInput: string | Date | undefined | null): string => {
    if (!dateInput) return "Recently";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "Recently";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 60_000) return "Just now";

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const diseaseList: DiseaseRecord[] = useMemo(() => {
    const liveCases = rawIncidents?.filter((i) => i.type === "disease");
    if (!liveCases || liveCases.length === 0) return [];
    return liveCases.map((item) => ({
      id: item.id,
      farmerName: item.farmerName || "Registered Farmer",
      barangay: item.barangayName || "Padre Garcia",
      cattleId: item.tagNumber || `TAG-${item.id}`,
      specie: item.livestockType || "Cattle",
      disease: item.conditionName || "Reported Condition",
      symptoms: item.symptoms && item.symptoms.length > 0 ? item.symptoms : ["Clinical surveillance record"],
      affectedHeads: item.headCount || 1,
      severity: (item.sibatInspection?.severity === "CRITICAL" ? "Critical" : item.sibatInspection?.severity === "MODERATE" ? "Moderate" : "Mild"),
      status: item.status,
      veterinarian: item.reviewedBy || "Municipal Veterinary Office",
      quarantineZone: false,
      dateReported: item.date || "",
      lastUpdated: item.createdAt?.slice(0, 10) || item.date || "",
    }));
  }, [rawIncidents]);

  const mortalityList: MortalityRecord[] = useMemo(() => {
    const liveMortalities = rawIncidents?.filter((i) => i.type === "mortality");
    if (!liveMortalities || liveMortalities.length === 0) return [];
    return liveMortalities.map((item) => ({
      id: item.id,
      farmerName: item.farmerName || "Registered Farmer",
      barangay: item.barangayName || "Padre Garcia",
      cattleId: item.tagNumber || `TAG-${item.id}`,
      specie: item.livestockType || "Cattle",
      breed: item.livestockBreed || "Standard Breed",
      cause: item.conditionName || "Unspecified Cause",
      dateOfDeath: item.date || "",
      status: item.status,
      reviewStatus: item.status,
      necropsyPerformed: Boolean(item.reviewedBy),
      necropsyFindings: item.reviewRemarks || undefined,
      disposalMethod: "Burial with Lime",
      insuranceClaimStatus: "Not recorded",
      verifiedBy: item.reviewedBy || "MAO Biosecurity Officer",
    }));
  }, [rawIncidents]);

  const salesList: SalesRecord[] = useMemo(() => {
    const liveSales = rawIncidents?.filter((i) => i.type === "sale");
    if (!liveSales || liveSales.length === 0) return [];
    return liveSales.map((item) => ({
      id: item.id,
      farmerName: item.farmerName || "Registered Farmer",
      buyer: item.buyer || "Not recorded",
      barangay: item.barangayName || "Padre Garcia",
      product: `${item.livestockType || "Livestock"} Trade`,
      specie: item.livestockType || "Cattle",
      cattleId: item.tagNumber || `TAG-${item.id}`,
      quantity: `${item.headCount || 1} Head`,
      amount: item.saleValue == null ? "Not recorded" : `₱${item.saleValue.toLocaleString()}`,
      amountNumber: item.saleValue ?? null,
      paymentMethod: "Cash",
      transportPermitNumber: "Not recorded",
      date: item.date || "",
      status: (item.status === "APPROVED" ? "Completed" : "Pending Clearance"),
    }));
  }, [rawIncidents]);

  // Official slaughter records have their own decision, independent of personal yield logs.
  const slaughterList: SlaughterRecord[] = useMemo(() => {
    return (rawSlaughter ?? []).map((item) => ({
      id: `SLG-${item.id}`,
      inspectionCertNo: "Not recorded", farmerName: item.farmer_reported ? item.created_by_name : "Facility total",
      meatInspector: "Not recorded",
      barangay: item.barangay_name || "Unknown barangay",
      cattleId: item.selected_animal_tags.join(", "),
      specie: item.livestock_type_name || "Unspecified",
      carcassWeightKg: Number(item.carcass_weight || 0), purpose: "Not recorded",
      anteMortemStatus: "Not recorded", postMortemStatus: "Not recorded",
      destinationMarket: "Not recorded", date: item.record_date,
      status: item.status,
    }));
  }, [rawSlaughter]);

  // ── Connected Recent Municipal Activity Stream (Real-Time Multi-Domain) ──
  const recentActivityFeed: ActivityFeedItem[] = useMemo(() => {
    // Fast O(1) record lookups instead of O(N) array scans across thousands of items
    const livestockMap = new Map<string, LivestockRecord>();
    for (let i = 0; i < livestockList.length; i++) {
      const l = livestockList[i];
      livestockMap.set(l.id, l);
      if (l.cattleId) livestockMap.set(l.cattleId, l);
      if (l.rawId != null) livestockMap.set(`LIV-${l.rawId}`, l);
    }

    const batchMap = new Map<string, BatchRecord>();
    for (let i = 0; i < batchList.length; i++) {
      const b = batchList[i];
      batchMap.set(b.id, b);
      batchMap.set(`BAT-${b.rawId}`, b);
      if (b.batchCode) batchMap.set(b.batchCode, b);
    }

    const censusMap = new Map<string, CensusRecord>();
    for (let i = 0; i < censusList.length; i++) {
      const c = censusList[i];
      censusMap.set(c.id, c);
    }

    const diseaseMap = new Map<string, DiseaseRecord>();
    for (let i = 0; i < diseaseList.length; i++) {
      const d = diseaseList[i];
      diseaseMap.set(d.id, d);
      diseaseMap.set(`DIS-${d.id}`, d);
    }

    const mortalityMap = new Map<string, MortalityRecord>();
    for (let i = 0; i < mortalityList.length; i++) {
      const m = mortalityList[i];
      mortalityMap.set(m.id, m);
      mortalityMap.set(`MOR-${m.id}`, m);
    }

    const salesMap = new Map<string, SalesRecord>();
    for (let i = 0; i < salesList.length; i++) {
      const s = salesList[i];
      salesMap.set(s.id, s);
      salesMap.set(`SAL-${s.id}`, s);
    }

    const liveActivities: (ActivityFeedItem & { rawTimestamp: number })[] = [];
    const isBarangayAll = filterBarangay === "all";
    const filterBrgyLower = filterBarangay.toLowerCase();

    // Helper to extract a bounded recent candidate window (max 35 items per domain)
    const getCandidates = <T,>(arr: T[] | undefined | null, matchesBarangayFn: (item: T) => boolean, max = 35): T[] => {
      if (!arr || arr.length === 0) return [];
      const filtered = isBarangayAll ? arr : arr.filter(matchesBarangayFn);
      return filtered.length > max ? filtered.slice(-max) : filtered;
    };

    // 1. Live Animal Inventory Registrations
    const invCandidates = getCandidates(rawInventory, (inv) => (inv.barangayName || "").toLowerCase() === filterBrgyLower);
    invCandidates.forEach((inv) => {
      const rawDate = inv.createdAt ? new Date(inv.createdAt).getTime() : 0;
      const invStatus = (inv.status || "") as string;
      const isInvRevision = invStatus === "SUBJECT_TO_REVISION" || invStatus === "SUBJECT_FOR_REVISION";
      const statusBadge =
        inv.status === "APPROVED"
          ? "MAO Certified"
          : isInvRevision
          ? "Subject for Revision"
          : inv.status === "VERIFIED"
          ? "SIBAT Verified"
          : "Pending Review";
      const badgeVariant =
        inv.status === "APPROVED"
          ? "emerald"
          : isInvRevision
          ? "rose"
          : inv.status === "VERIFIED"
          ? "sky"
          : "amber";

      const matchingRecord = livestockMap.get(`LIV-${inv.id}`) || (inv.tagNumber ? livestockMap.get(inv.tagNumber) : undefined);

      liveActivities.push({
        id: `act-inv-${inv.id}`,
        domain: "livestock",
        title: `${inv.livestockType || "Livestock"} Registered`,
        description: `${inv.breed || "Standard"} (${inv.sex || "Animal"}) tagged #${inv.tagNumber || `ID-${inv.id}`} by ${inv.farmerName || "Farmer"}.`,
        actor: inv.farmerName || "Farmer",
        barangay: inv.barangayName || "Padre Garcia",
        timestamp: formatRelativeTime(inv.createdAt),
        rawTimestamp: rawDate,
        badge: statusBadge,
        badgeVariant,
        record: matchingRecord || {
          id: `LIV-${inv.id}`,
          rawId: inv.id,
          cattleId: inv.tagNumber || `TAG-${inv.id}`,
          farmerName: inv.farmerName || "Farmer",
          barangay: inv.barangayName || "Padre Garcia",
          specie: inv.livestockType || "Livestock",
          breed: inv.breed || "Standard",
          sex: inv.sex || "Female",
          weightKg: inv.weight || null,
          status: inv.status || "PENDING",
          registrationDate: inv.createdAt?.slice(0, 10) || "",
          lastVaccinationDate: inv.lastVaccinationDate || null,
          batchCode: inv.batchCode,
          batchName: inv.batchName,
          housingPen: inv.housingPen,
          feedType: inv.feedType,
        },
      });
    });

    // 2. Live Production Declarations
    const prodCandidates = getCandidates(rawProduction, (prod) => (prod.barangayName || "").toLowerCase() === filterBrgyLower);
    prodCandidates.forEach((prod) => {
      const dateStr = prod.createdAt || prod.recordDate;
      const rawDate = dateStr ? new Date(dateStr).getTime() : 0;
      const typeLabel = prod.productionType
        ? prod.productionType.charAt(0).toUpperCase() + prod.productionType.slice(1).toLowerCase()
        : "Dairy";
      const prodStatus = (prod.status || "") as string;
      const isProdRevision = prodStatus === "SUBJECT_TO_REVISION" || prodStatus === "SUBJECT_FOR_REVISION";
      const badgeVariant =
        prod.status === "APPROVED"
          ? "emerald"
          : isProdRevision
          ? "rose"
          : "sky";

      liveActivities.push({
        id: `act-prod-${prod.id}`,
        domain: "production",
        title: `${typeLabel} Yield Declared`,
        description: `Farmer ${prod.farmerName || "Producer"} logged ${prod.quantity} ${prod.unit || "L"}.`,
        actor: prod.farmerName || "Farmer",
        barangay: prod.barangayName || "Padre Garcia",
        timestamp: formatRelativeTime(dateStr),
        rawTimestamp: rawDate,
        badge: `${prod.quantity} ${prod.unit || "L"}`,
        badgeVariant,
        record: {
          id: `PRD-${prod.id}`,
          farmerName: prod.farmerName || "Farmer",
          barangay: prod.barangayName || "Padre Garcia",
          cattleId: `TAG-LIV-${prod.livestockId || prod.id}`,
          type: typeLabel,
          quantity: `${prod.quantity} ${prod.unit || "L"}`,
          quantityNumber: Number(prod.quantity) || 0,
          unit: prod.unit || "LITERS",
          qualityGrade: "Not recorded",
          collectionCenter: "Not recorded",
          estValuePhp: prod.valuationSnapshot ? Number(prod.valuationSnapshot.estimated_value) : null,
          date: prod.recordDate || prod.createdAt?.slice(0, 10) || "",
          status: prod.status === "APPROVED" ? "Certified" : "Pending Review",
        },
      });
    });

    // 3. Live Quarterly Census Batches
    const cenCandidates = getCandidates(rawCensus, (cen) => (cen.barangay || "").toLowerCase() === filterBrgyLower);
    cenCandidates.forEach((cen) => {
      const rawDate = cen.submissionDate ? new Date(cen.submissionDate).getTime() : 0;
      const matchingRecord = censusMap.get(`CEN-${cen.id}`);

      liveActivities.push({
        id: `act-cen-${cen.id}`,
        domain: "census",
        title: `Q${cen.reportQuarter || 1} Census Batch Submitted`,
        description: `${cen.totalHeads || 0} total head count logged in Brgy. ${cen.barangay} by ${cen.submittedBy || "SIBAT Officer"}.`,
        actor: cen.submittedBy || "SIBAT Enumerator",
        barangay: cen.barangay || "Padre Garcia",
        timestamp: formatRelativeTime(cen.submissionDate),
        rawTimestamp: rawDate,
        badge:
          cen.status === "APPROVED"
            ? "MAO Verified"
            : cen.status === "SUBJECT_TO_REVISION" || cen.status === "SUBJECT_FOR_REVISION"
            ? "Subject for Revision"
            : "Pending Audit",
        badgeVariant:
          cen.status === "APPROVED"
            ? "emerald"
            : cen.status === "SUBJECT_TO_REVISION" || cen.status === "SUBJECT_FOR_REVISION"
            ? "rose"
            : "sky",
        record: matchingRecord || {
          id: `CEN-${cen.id}`,
          barangay: cen.barangay || "Padre Garcia",
          quarter: `Q${cen.reportQuarter || 1}`,
          year: cen.reportYear || 2026,
          totalHeads: cen.totalHeads || 0,
          cattleCount: 0,
          carabaoCount: 0,
          swineCount: 0,
          goatCount: 0,
          enumerator: cen.submittedBy || "SIBAT Officer",
          submissionDate: cen.submissionDate?.slice(0, 10) || "",
          status: (cen.status === "APPROVED" ? "MAO Verified" : "Pending Audit"),
        },
      });
    });

    // 4. Live Incidents: Disease, Mortality, Sales, Calvings
    const incCandidates = getCandidates(rawIncidents, (inc) => (inc.barangayName || "").toLowerCase() === filterBrgyLower, 45);
    incCandidates.forEach((inc) => {
      const dateStr = inc.createdAt || inc.date;
      const rawDate = dateStr ? new Date(dateStr).getTime() : 0;

      if (inc.type === "disease") {
        const matchingRecord = diseaseMap.get(`DIS-${inc.id}`) || diseaseMap.get(String(inc.id));
        liveActivities.push({
          id: `act-${inc.id}`,
          domain: "disease",
          title: `Biosecurity Alert: ${inc.conditionName || "Disease Case"}`,
          description: `${inc.details || "Suspected infection logged for veterinary review."} (${inc.farmerName})`,
          actor: inc.reviewedBy || inc.farmerName || "Field Reporter",
          barangay: inc.barangayName || "Padre Garcia",
          timestamp: formatRelativeTime(dateStr),
          rawTimestamp: rawDate,
          badge:
            inc.status === "APPROVED"
              ? "MAO Approved"
              : (inc.status as string) === "SUBJECT_TO_REVISION" || (inc.status as string) === "SUBJECT_FOR_REVISION"
              ? "Subject for Revision"
              : "Observation Active",
          badgeVariant: "rose",
          record: matchingRecord || {
            id: `DIS-${inc.id}`,
            farmerName: inc.farmerName || "Farmer",
            barangay: inc.barangayName || "Padre Garcia",
            cattleId: inc.tagNumber || `INC-${inc.id}`,
            specie: inc.livestockType || "Livestock",
            disease: inc.conditionName || "Disease Case",
            symptoms: [inc.conditionName || "Suspected Symptoms"],
            affectedHeads: inc.headCount || 1,
            severity: "Moderate",
            status: inc.status,
            veterinarian: inc.reviewedBy || "Municipal Veterinarian",
            quarantineZone: false,
            dateReported: dateStr?.slice(0, 10) || "",
            notes: inc.details,
          },
        });
      } else if (inc.type === "mortality") {
        const matchingRecord = mortalityMap.get(`MOR-${inc.id}`) || mortalityMap.get(String(inc.id));
        liveActivities.push({
          id: `act-${inc.id}`,
          domain: "mortality",
          title: `Mortality Incident: ${inc.conditionName || "Death Reported"}`,
          description: `${inc.headCount || 1} head(s) casualty. ${inc.details || ""}`,
          actor: inc.reviewedBy || inc.farmerName || "Field Officer",
          barangay: inc.barangayName || "Padre Garcia",
          timestamp: formatRelativeTime(dateStr),
          rawTimestamp: rawDate,
          badge:
            inc.status === "APPROVED"
              ? "Verified Loss"
              : inc.status === "SUBJECT_TO_REVISION"
              ? "Subject to Revision"
              : "Pending Review",
          badgeVariant: "rose",
          record: matchingRecord || {
            id: `MOR-${inc.id}`,
            farmerName: inc.farmerName || "Farmer",
            barangay: inc.barangayName || "Padre Garcia",
            cattleId: inc.tagNumber || `INC-${inc.id}`,
            specie: inc.livestockType || "Livestock",
            causeOfDeath: inc.conditionName || "Mortality Record",
            deathCount: inc.headCount || 1,
            dateOfDeath: dateStr?.slice(0, 10) || "",
            disposalMethod: "Burial",
            investigatedBy: inc.reviewedBy || "Field Officer",
            status: inc.status === "APPROVED" ? "Verified" : "Pending Inspection",
            notes: inc.details,
          },
        });
      } else if (inc.type === "sale") {
        const matchingRecord = salesMap.get(`SAL-${inc.id}`) || salesMap.get(String(inc.id));
        liveActivities.push({
          id: `act-${inc.id}`,
          domain: "sales",
          title: "Live Animal Trade Declared",
          description: `${inc.details || "Livestock transaction logged for municipal trade clearance."}`,
          actor: inc.farmerName || "Trader",
          barangay: inc.barangayName || "Padre Garcia",
          timestamp: formatRelativeTime(dateStr),
          rawTimestamp: rawDate,
          badge:
            inc.status === "APPROVED"
              ? "Cleared"
              : inc.status === "SUBJECT_TO_REVISION"
              ? "Subject to Revision"
              : "Pending",
          badgeVariant: inc.status === "APPROVED" ? "emerald" : "sky",
          record: matchingRecord || {
            id: `SAL-${inc.id}`,
            farmerName: inc.farmerName || "Trader",
            buyer: "Padre Garcia Trading Center",
            barangay: inc.barangayName || "Padre Garcia",
            product: "Livestock Trade",
            specie: inc.livestockType || "Livestock",
            cattleId: inc.tagNumber || `SAL-${inc.id}`,
            quantity: `${inc.headCount || 1} Heads`,
            amount: "Trade Completed",
            amountNumber: 0,
            paymentMethod: "Cash",
            transportPermitNumber: `TPN-${inc.id}`,
            date: dateStr?.slice(0, 10) || "",
            status: inc.status === "APPROVED" ? "Completed" : "Pending Clearance",
            notes: inc.details,
          },
        });
      } else if (inc.type === "birth") {
        const matchingRecord = (inc.tagNumber ? livestockMap.get(inc.tagNumber) : undefined) || livestockMap.get(`LIV-${inc.id}`);
        liveActivities.push({
          id: `act-${inc.id}`,
          domain: "livestock",
          title: "Calf Birth Registered",
          description: `${inc.details || "New calf birth entered into registry."}`,
          actor: inc.farmerName || "Farmer",
          barangay: inc.barangayName || "Padre Garcia",
          timestamp: formatRelativeTime(dateStr),
          rawTimestamp: rawDate,
          badge: "Born Active",
          badgeVariant: "emerald",
          record: matchingRecord,
        });
      }
    });

    // 5. Live Herds
    const batchCandidates = getCandidates(rawBatches, (batch) => (batch.barangay_name || "").toLowerCase() === filterBrgyLower);
    batchCandidates.forEach((batch) => {
      const rawDate = batch.created_at ? new Date(batch.created_at).getTime() : 0;
      const matchingRecord = batchMap.get(`BAT-${batch.id}`) || (batch.batch_code ? batchMap.get(batch.batch_code) : undefined);
      liveActivities.push({
        id: `act-bat-${batch.id}`,
        domain: "batches",
        title: `Batch Registered: ${batch.batch_code || batch.batch_name}`,
        description: `${batch.batch_name} (${batch.total_animals || 0} heads ${batch.livestock_type_name || "livestock"}) in ${batch.housing_pen || "pen"}.`,
        actor: batch.farmer_name || "Farmer",
        barangay: batch.barangay_name || "Padre Garcia",
        timestamp: formatRelativeTime(batch.created_at),
        rawTimestamp: rawDate,
        badge: "Herd container",
        badgeVariant: "sky",
        record: matchingRecord || {
          id: `BAT-${batch.id}`,
          rawId: batch.id,
          batchCode: batch.batch_code || `BAT-${batch.id}`,
          batchName: batch.batch_name || `Batch #${batch.id}`,
          farmerName: batch.farmer_name || "Farmer",
          barangay: batch.barangay_name || "Padre Garcia",
          specie: batch.livestock_type_name || "Livestock",
          housingPen: batch.housing_pen || "General Pen",
          feedType: batch.feed_type || "—",
          totalAnimals: batch.total_animals || 0,
          status: batch.status || "ACTIVE",
          createdAt: batch.created_at?.slice(0, 10) || "",
          animals: batch.animals || [],
        },
      });
    });

    // 6. Slaughterhouse & Movement Clearances (Real records)
    const slaughterCandidates = getCandidates(slaughterList, (slg) => (slg.barangay || "").toLowerCase() === filterBrgyLower);
    slaughterCandidates.forEach((slg) => {
      const rawDate = slg.date ? new Date(slg.date).getTime() : 0;
      liveActivities.push({
        id: `act-slg-${slg.id}`,
        domain: "slaughter",
        title: `Slaughter Record: ${slg.inspectionCertNo || slg.id}`,
        description: `${slg.specie} (${slg.carcassWeightKg} kg) cleared for ${slg.destinationMarket} by ${slg.farmerName}.`,
        actor: slg.farmerName || "Farmer",
        barangay: slg.barangay || "Padre Garcia",
        timestamp: formatRelativeTime(slg.date),
        rawTimestamp: rawDate,
        badge: slg.status || "Certified",
        badgeVariant: "emerald",
        record: slg,
      });
    });

    if (liveActivities.length === 0) {
      return [];
    }

    // Sort chronologically descending (newest first) and take top 30
    liveActivities.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
    return liveActivities.slice(0, 30);
  }, [
    rawInventory,
    rawBatches,
    rawProduction,
    rawCensus,
    rawIncidents,
    livestockList,
    batchList,
    productionList,
    censusList,
    diseaseList,
    mortalityList,
    salesList,
    slaughterList,
    filterBarangay,
  ]);

  // ── Compute Real Master Data Matrix per Barangay across all 17 Official Barangays ──
  const barangayMasterSummaries: BarangaySummary[] = useMemo(
    () => overviewBarangays(summary), [summary]
  );

  // Domain Counts
  const counts: Record<DataTab, number> = useMemo(
    () => ({
      overall: barangayMasterSummaries.length,
      livestock: livestockList.length,
      batches: batchList.length,
      production: productionList.length,
      sales: salesList.length + (tradeOwnershipQuery.data?.length ?? 0) + (tradeMovementQuery.data?.length ?? 0),
      disease: diseaseList.length,
      mortality: mortalityList.length,
      slaughter: slaughterList.length,
      census: censusList.length,
    }),
    [
      barangayMasterSummaries,
      livestockList,
      batchList,
      productionList,
      salesList,
      tradeOwnershipQuery.data,
      tradeMovementQuery.data,
      diseaseList,
      mortalityList,
      slaughterList,
      censusList,
    ]
  );

  // Overall KPI aggregates (Synced directly with canonical backend analytics population)
  const totalLivestockPopulation = summary?.population.total_heads ?? 0;
  const vaccinatedHeads = summary?.population.by_barangay.reduce((sum, row) => sum + row.vaccinated, 0) ?? 0;
  const vaccinationCoveragePct = totalLivestockPopulation
    ? Math.round((vaccinatedHeads / totalLivestockPopulation) * 1000) / 10
    : 0;
  const totalTransferValue = summary?.approved_transfer_value ?? null;
  const activeIncidentsCount = barangayMasterSummaries.reduce((sum, row) => sum + row.activeIncidents, 0);
  const totalFarmersCount = summary?.population.registered_farmers ?? 0;

  // Filtered dataset for active tab
  const filteredData = useMemo(() => {
    let raw: OverviewRecord[] = [];
    switch (activeTab) {
      case "livestock":
        raw = livestockList.filter(item =>
          showLivestockHistory
            ? (item.operationalStatus || "ACTIVE") !== "ACTIVE" && (historyLifecycle === "ALL" || item.operationalStatus === historyLifecycle)
            : (item.operationalStatus || "ACTIVE") === "ACTIVE"
        );
        break;
      case "batches":
        raw = batchList;
        break;
      case "production":
        raw = productionList;
        break;
      case "sales":
        raw = salesList;
        break;
      case "disease":
        raw = diseaseList;
        break;
      case "mortality":
        raw = mortalityList;
        break;
      case "slaughter":
        raw = slaughterList;
        break;
      case "census":
        raw = censusList;
        break;
      default:
        return [];
    }

    const query = searchQuery.trim().toLowerCase();
    const isBarangayAll = filterBarangay === "all";
    const isSpecieAll = filterSpecie === "all";
    const specieFilterLower = filterSpecie.toLowerCase();

    return raw.filter((item) => {
      // Barangay filter (fast check first)
      if (!isBarangayAll && item.barangay !== filterBarangay && item.barangayName !== filterBarangay) {
        return false;
      }

      // Specie filter
      if (!isSpecieAll && !(typeof item.specie === "string" && item.specie.toLowerCase().includes(specieFilterLower))) {
        return false;
      }

      // Status filter
      if (!matchesStatusFilter(item, filterStatus)) {
        return false;
      }

      // Search query (only evaluated if filters pass)
      if (query) {
        const matchesSearch = Object.values(item).some((val) =>
          typeof val === "string" || typeof val === "number"
            ? String(val).toLowerCase().includes(query)
            : false
        );
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [
    activeTab,
    showLivestockHistory,
    historyLifecycle,
    livestockList,
    batchList,
    productionList,
    salesList,
    diseaseList,
    mortalityList,
    slaughterList,
    censusList,
    searchQuery,
    filterBarangay,
    filterSpecie,
    filterStatus,
  ]);

  // Handle Record Inspection
  const handleSelectRecord = (record: OverviewRecord, domain: DataTab) => {
    if (domain && domain !== "overall") {
      setActiveTab(domain);
    }
    setSelectedRecord(record);
    setSelectedRecordDomain(domain);
    setDetailModalOpen(true);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterBarangay("all");
    setFilterSpecie("all");
    setFilterStatus("all");
    toast.info("Filters reset to default view");
  };

  // Real CSV Export
  const handleExportCsv = () => {
    if (activeTab === "overall") {
      const headers = [
        "Barangay",
        "Total Livestock",
        "Cattle Count",
        "Carabao Count",
        "Swine Count",
        "Goat & Sheep Count",
        "Poultry & Other Count",
        "Farmer Milk Logs (Private)",
        "Monthly Meat (kg)",
        "Disease Reports Awaiting Review",
        "Registered Raisers",
      ];
      const rows = barangayMasterSummaries.map((b) => [
        b.barangay,
        b.totalLivestock,
        b.cattleCount,
        b.carabaoCount,
        b.swineCount,
        b.goatCount,
        b.otherCount ?? 0,
        b.monthlyMilkLiters ?? "Private to farmer accounts",
        b.monthlyMeatKg,
        b.activeIncidents,
        b.registeredFarmers,
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `Padre_Garcia_Overall_Livestock_Summary_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported Overall Barangay Data to CSV`);
      return;
    }

    if (activeTab === "batches") {
      const headers = [
        "Batch ID",
        "Batch Code",
        "Herd Name",
        "Farmer / Raiser",
        "Barangay",
        "Specie",
        "Housing Pen",
        "Feed Type",
        "Total Heads",
        "Avg Weight (kg)",
        "Target Weight (kg)",
        "Target Harvest Date",
        "Review Status",
        "Reviewer",
        "Date Created",
      ];
      const rows = (filteredData as BatchRecord[]).map((b) => [
        `"${b.id}"`,
        `"${b.batchCode || ""}"`,
        `"${b.batchName || ""}"`,
        `"${b.farmerName || ""}"`,
        `"${b.barangay || ""}"`,
        `"${b.specie || ""}"`,
        `"${b.housingPen || ""}"`,
        `"${b.feedType || ""}"`,
        b.totalAnimals || 0,
        b.averageWeight || "",
        b.targetWeight || "",
        `"${b.targetHarvestDate || ""}"`,
        `"${b.status || ""}"`,
        `"${b.reviewedByName || ""}"`,
        `"${b.createdAt || ""}"`,
      ]);
      const csvContent =
        "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `Padre_Garcia_Batches_Summary_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${filteredData.length} Batch Records to CSV`);
      return;
    }

    if (filteredData.length === 0) {
      toast.warning("No records to export.");
      return;
    }

    const firstItem = filteredData[0];
    const headers = Object.keys(firstItem).filter((k) => typeof Object.fromEntries(Object.entries(firstItem))[k] !== "object");
    const rows = filteredData.map((item) =>
      headers
        .map((h) => {
          const val = String(Object.fromEntries(Object.entries(item))[h] ?? "").replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(",")
    );

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Padre_Garcia_${activeTab}_Records_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredData.length} records in ${activeTab} to CSV`);
  };

  return (
    <>
      <PageHeader
        title="Municipal System Data Overview"
        subtitle="Consolidated livestock master registry, market trades & biosecurity intelligence — Padre Garcia MAO"
        variant="admin"
        maxWidthClass="w-full"
        icon={<Database className="size-5 text-slate-800" />}
      />

      <div className="relative min-h-[calc(100vh-10rem)]">
        {(isInitialLoading || keepLoadingScreenMounted) && (
          <div className={`w-full px-4 sm:px-6 lg:px-8 py-6 ${showContent ? "absolute inset-0 z-30 pointer-events-none" : ""}`}>
            <ValidationLoadingScreen
              isLoading={isInitialLoading}
              title="Synchronizing Municipal System Data Overview"
              subtitle="Aggregating live animal registries, herds, biosecurity alerts, and barangay census..."
              badgeLabel="Live Ledger Sync"
              authorityText="Padre Garcia Municipal Agriculture Office • Batangas"
              items={[
                {
                  id: "inventory",
                  label: "Livestock Inventory",
                  sublabel: "Individual tags & raiser profiles",
                  icon: <Layers className="size-4 shrink-0 text-emerald-700" />,
                  loaded: rawInventory !== undefined,
                },
                {
                  id: "batches",
                  label: "Herds",
                  sublabel: "Housing pens & feeding programs",
                  icon: <Boxes className="size-4 shrink-0 text-[#2D5A27]" />,
                  loaded: rawBatches !== undefined,
                },
                {
                  id: "census",
                  label: "Barangay Census",
                  sublabel: "Quarterly household surveys",
                  icon: <FileSpreadsheet className="size-4 shrink-0 text-indigo-700" />,
                  loaded: rawCensus !== undefined,
                },
                {
                  id: "incidents",
                  label: "Health & Market Events",
                  sublabel: "Disease surveillance & auction records",
                  icon: <Activity className="size-4 shrink-0 text-rose-700" />,
                  loaded: rawIncidents !== undefined,
                },
              ]}
            />
          </div>
        )}

        {showContent && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ease-out motion-reduce:animate-none">
            <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {failedSources.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between" role="status">
            <div>
              <p className="font-semibold">Some Data Overview information could not be loaded.</p>
              <p className="mt-1">Available information is still shown. Failed sources: {failedSources.join(", ")}.</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md border border-amber-400 bg-white px-3 py-2 font-medium hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={dataSources.some(({ query }) => query.isError && query.isFetching)}
              onClick={() => {
                void Promise.allSettled(
                  dataSources.filter(({ query }) => query.isError).map(({ query }) => query.refetch()),
                );
              }}
            >
              Retry failed requests
            </button>
          </div>
        )}

        {/* Executive KPI Intelligence Strip */}
        <DataOverviewKpis
          totalLivestock={totalLivestockPopulation}
          totalBatches={barangayMasterSummaries.reduce((sum, row) => sum + (row.batchCount ?? 0), 0)}
          vaccinationCoveragePct={vaccinationCoveragePct}
          vaccinatedHeads={vaccinatedHeads}
          totalHeads={totalLivestockPopulation}
          totalTransferValue={totalTransferValue}
          activeIncidents={activeIncidentsCount}
          totalFarmers={totalFarmersCount}
          totalSlaughterKg={slaughterList.reduce((sum, s) => sum + (s.carcassWeightKg || 0), 0)}
          isLoading={isDataLoading}
        />

        {/* 4 Strategic Primary Tabs with Interactive Animations */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100 fill-mode-both motion-reduce:animate-none">
          <button
            type="button"
            onClick={() => setActiveTab("overall")}
            className={`group px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ease-out active:scale-95 cursor-pointer flex items-center gap-2 shrink-0 select-none ${
              activeTab === "overall"
                ? "bg-[#0F4A2F] text-white shadow-sm ring-2 ring-[#0F4A2F]/25 -translate-y-0.5"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-2xs"
            }`}
          >
            <BarChart3 className="size-4 transition-transform duration-300 group-hover:scale-110 group-active:scale-90" />
            <span>Municipal Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("livestock")}
            className={`group px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ease-out active:scale-95 cursor-pointer flex items-center gap-2 shrink-0 select-none ${
              activeTab === "livestock"
                ? "bg-[#0F4A2F] text-white shadow-sm ring-2 ring-[#0F4A2F]/25 -translate-y-0.5"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-2xs"
            }`}
          >
            <Icon iconNode={cowHead} className="size-4 transition-transform duration-300 group-hover:scale-110 group-active:scale-90" />
            <span>Livestock</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-200 group-hover:scale-105 ${
              activeTab === "livestock" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}>
              {counts.livestock}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sales")}
            className={`group px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ease-out active:scale-95 cursor-pointer flex items-center gap-2 shrink-0 select-none ${
              activeTab === "sales" || activeTab === "production" || activeTab === "slaughter"
                ? "bg-[#0F4A2F] text-white shadow-sm ring-2 ring-[#0F4A2F]/25 -translate-y-0.5"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-2xs"
            }`}
          >
            <Boxes className="size-4 transition-transform duration-300 group-hover:scale-110 group-active:scale-90" />
            <span>Production</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-200 group-hover:scale-105 ${
              activeTab === "sales" || activeTab === "production" || activeTab === "slaughter"
                ? "bg-white/20 text-white"
                : "bg-slate-100 text-slate-600"
            }`}>
              {counts.sales + counts.slaughter + counts.production}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("disease")}
            className={`group px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ease-out active:scale-95 cursor-pointer flex items-center gap-2 shrink-0 select-none ${
              activeTab === "disease" || activeTab === "mortality" || activeTab === "census"
                ? "bg-[#0F4A2F] text-white shadow-sm ring-2 ring-[#0F4A2F]/25 -translate-y-0.5"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-2xs"
            }`}
          >
            <ShieldCheck className="size-4 transition-transform duration-300 group-hover:scale-110 group-active:scale-90" />
            <span>Reports</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-200 group-hover:scale-105 ${
              activeTab === "disease" || activeTab === "mortality" || activeTab === "census"
                ? "bg-white/20 text-white"
                : "bg-slate-100 text-slate-600"
            }`}>
              {counts.disease + counts.mortality + counts.census}
            </span>
          </button>
        </div>

        {/* Main Content Area with Smooth Enter Animation */}
        <div
          key={activeTab === "overall" ? "overall-view" : activeTab}
          className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both motion-reduce:animate-none"
        >
          {activeTab === "overall" ? (
          <DataOverviewOverallView
            barangaySummaries={barangayMasterSummaries.filter(
              (b) =>
                (filterBarangay === "all" || b.barangay === filterBarangay) &&
                (searchQuery === "" ||
                  b.barangay.toLowerCase().includes(searchQuery.toLowerCase()))
            )}
            activityFeed={recentActivityFeed}
            batchList={batchList}
            totalBatches={barangayMasterSummaries.reduce((sum, row) => sum + (row.batchCount ?? 0), 0)}
            isLoading={isDataLoading}
            onSelectBarangay={(brgy) => {
              setFilterBarangay(brgy);
              toast.info(`Filtered for Brgy. ${brgy}`);
            }}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
            }}
            onSelectRecord={handleSelectRecord}
          />
        ) : (
          <>
            {activeTab === "livestock" && (
              <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Animal record history">
                <Button variant={showLivestockHistory ? "outline" : "default"} onClick={() => setShowLivestockHistory(false)} aria-pressed={!showLivestockHistory}>Current animals</Button>
                <Button variant={showLivestockHistory ? "default" : "outline"} onClick={() => setShowLivestockHistory(true)} aria-pressed={showLivestockHistory}>History</Button>
                {showLivestockHistory && (["ALL", "SOLD", "DECEASED"] as const).map((status) => (
                  <Button key={status} variant={historyLifecycle === status ? "secondary" : "outline"} aria-pressed={historyLifecycle === status} onClick={() => setHistoryLifecycle(status)}>
                    {status === "ALL" ? "All history" : status === "SOLD" ? "Sold" : "Deceased"}
                    {status !== "ALL" && ` (${livestockList.filter((item) => item.operationalStatus === status).length.toLocaleString()})`}
                  </Button>
                ))}
              </div>
            )}
            <DataOverviewToolbar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterBarangay={filterBarangay}
              onBarangayChange={setFilterBarangay}
              filterSpecie={filterSpecie}
              onSpecieChange={setFilterSpecie}
              filterStatus={filterStatus}
              onStatusChange={setFilterStatus}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onExportCsv={handleExportCsv}
              onResetFilters={handleResetFilters}
              counts={counts}
            />

            {activeTab === "sales" ? (
              <ProductionTradeRecords
                onResetFilters={handleResetFilters}
                search={searchQuery}
                statusFilter={filterStatus}
              />
            ) : viewMode === "table" ? (
              <DataOverviewTable
                key={activeTab}
                activeTab={activeTab}
                items={filteredData}
                onSelectRecord={handleSelectRecord}
                onResetFilters={handleResetFilters}
              />
            ) : (
              <DataOverviewCards
                key={activeTab}
                activeTab={activeTab}
                items={filteredData}
                onSelectRecord={handleSelectRecord}
              />
            )}
          </>
        )}
        </div>
            </div>
          </div>
        )}
      </div>

      {/* Record Inspector Detail Modal */}
      <DataOverviewDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        record={selectedRecord}
        domain={selectedRecordDomain}
      />
    </>
  );
}
