"use client";

import { useAuth } from "@/contexts/auth-context";
import { useState, useMemo } from "react";
import { PageHeader } from "@/app/components/page-header";
import { toast } from "sonner";

// Domain Types, Datasets & Utilities
import {
  DataTab,
  BarangaySummary,
  PADRE_GARCIA_BARANGAYS,
  BARANGAY_MASTER_SUMMARIES,
  SEED_LIVESTOCK,
  SEED_PRODUCTION,
  SEED_SALES,
  SEED_DISEASE,
  SEED_MORTALITY,
  SEED_SLAUGHTER,
  SEED_CENSUS,
  SEED_ACTIVITY_FEED,
  SEED_BATCHES,
  LivestockRecord,
  BatchRecord,
  ProductionRecord,
  SalesRecord,
  DiseaseRecord,
  MortalityRecord,
  SlaughterRecord,
  CensusRecord,
  ActivityFeedItem,
} from "./data-overview-types";

// Modular Components
import { DataOverviewKpis } from "./data-overview-kpis";
import { DataOverviewToolbar } from "./data-overview-toolbar";
import { DataOverviewOverallView } from "./data-overview-overall-view";
import { DataOverviewTable } from "./data-overview-table";
import { DataOverviewCards } from "./data-overview-cards";
import { DataOverviewDetailModal } from "./data-overview-detail-modal";
import { ValidationLoadingScreen } from "@/components/validation-loading-screen";
import { Layers, Boxes, Milk, FileSpreadsheet, Activity, Database } from "lucide-react";

// Backend TanStack hooks & API client for live database connectivity
import { useQuery } from "@tanstack/react-query";
import { municipalRead } from "@/lib/municipal-read";
import {
  useAdminInventoryRecords,
  useAdminProductionRecords,
  useAdminCensusSubmissions,
  useAdminIncidentRecords,
} from "../data-validation/validation-analytics";
import { useGetBarangays } from "@/app/(sibat)/sibat/sibat-analytics";
import { type OverviewSummary, overviewBarangays } from "@/lib/population-metrics";


export default function DataOverviewPage() {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<DataTab>("overall");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBarangay, setFilterBarangay] = useState("all");
  const [filterSpecie, setFilterSpecie] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Record Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [selectedRecordDomain, setSelectedRecordDomain] = useState<DataTab>("livestock");

  const { user } = useAuth();

  // Backend Data Queries
  const { data: dbBarangays } = useGetBarangays();
  const summaryQuery = useQuery<OverviewSummary>({
    queryKey: ["admin", "analytics", "overview", user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: async ({ signal }) => (await municipalRead<OverviewSummary>("analytics/overview/", { signal })).data,
    staleTime: 0, refetchOnWindowFocus: true,
  });
  const summary = summaryQuery.data;
  const { data: rawInventory, isLoading: isInvLoading, isError: isInventoryError } = useAdminInventoryRecords();
  const { data: rawProduction, isLoading: isProdLoading, isError: isProductionError } = useAdminProductionRecords();
  const { data: rawCensus, isLoading: isCenLoading, isError: isCensusError } = useAdminCensusSubmissions();
  const { data: rawIncidents, isLoading: isIncLoading, isError: isIncidentError } = useAdminIncidentRecords();
  const { data: rawBatches, isLoading: isBatchLoading, isError: isBatchError } = useQuery<any[]>({
    queryKey: ["admin-batches-overview"],
    queryFn: async ({ signal }) => {
      const res = await municipalRead("livestock/batches/?all=true", { signal });
      if (!Array.isArray(res.data)) throw new Error("Unexpected herd response.");
      return res.data;
    },
    staleTime: 30 * 1000,
  });

  const isDataLoading = summaryQuery.isLoading || isInvLoading || isProdLoading || isCenLoading || isIncLoading || isBatchLoading;

  const isInitialLoading =
    summaryQuery.isLoading ||
    (isInvLoading && !rawInventory) ||
    (isBatchLoading && !rawBatches) ||
    (isProdLoading && !rawProduction) ||
    (isCenLoading && !rawCensus) ||
    (isIncLoading && !rawIncidents);

  // Combine backend records with seed datasets
  const livestockList: LivestockRecord[] = useMemo(() => {
    if (!rawInventory || rawInventory.length === 0) return [];
    return rawInventory
      .filter((item) => !item.isBatch)
      .map((item) => {
      // Find matching herd from rawBatches or item fields
      const matchingBatch = rawBatches?.find(
        (b: any) =>
          (item.batchId && (b.id === item.batchId || b.rawId === item.batchId)) ||
          ((item as any).batch && (b.id === (item as any).batch || b.rawId === (item as any).batch)) ||
          (item.batchCode && b.batch_code === item.batchCode) ||
          (b.animals && b.animals.some((a: any) => a.id === item.id || a.tag_number === item.tagNumber))
      );

      const batchCode =
        item.batchCode ||
        (item as any).batch_code ||
        matchingBatch?.batch_code ||
        undefined;

      const batchName =
        item.batchName ||
        (item as any).batch_name ||
        matchingBatch?.batch_name ||
        (matchingBatch ? `Batch #${matchingBatch.id}` : undefined);

      const batchId =
        item.batchId ||
        (item as any).batch ||
        matchingBatch?.id ||
        null;

      const housingPen =
        (item as any).housingPen ||
        (item as any).housing_pen ||
        matchingBatch?.housing_pen ||
        undefined;

      const feedType =
        (item as any).feedType ||
        (item as any).feed_type ||
        matchingBatch?.feed_type ||
        undefined;

      return {
        id: `LIV-${item.id}`,
        farmerName: item.farmerName || "Registered Farmer",
        barangay: item.barangayName || "Unknown barangay",
        cattleId: item.tagNumber || `TAG-${item.id}`,
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
      status: item.review_status || item.status || "PENDING",
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
      type: (item.productionType?.toLowerCase() === "milk"
        ? "Cow Milk"
        : item.productionType?.toLowerCase() === "eggs"
        ? "Eggs"
        : "Wool") as any,
      quantity: `${item.quantity} ${item.unit || "L"}`,
      quantityNumber: Number(item.quantity) || 0,
      unit: item.unit || "LITERS",
      qualityGrade: "Not recorded",
      collectionCenter: "Not recorded",
      estValuePhp: item.valuationSnapshot ? Number(item.valuationSnapshot.estimated_value) : null,
      date: item.recordDate || "",
      status: (item.status === "APPROVED" ? "Certified" : "Pending Review") as any,
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
        status: (item.status === "APPROVED" ? "MAO Verified" : "Pending Audit") as any,
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
      severity: (item.sibatInspection?.severity === "CRITICAL" ? "Critical" : item.sibatInspection?.severity === "MODERATE" ? "Moderate" : "Mild") as any,
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
      necropsyPerformed: Boolean(item.reviewedBy),
      necropsyFindings: item.reviewRemarks || undefined,
      disposalMethod: "Burial with Lime",
      insuranceClaimStatus: (item.status === "APPROVED" ? "Approved" : "In Review") as any,
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
      status: (item.status === "APPROVED" ? "Completed" : "Pending Clearance") as any,
    }));
  }, [rawIncidents]);

  // Linked slaughter records are projected from their production submissions.
  const slaughterList: SlaughterRecord[] = useMemo(() => {
    return (rawProduction ?? []).filter((item) => item.slaughterDetails != null).map((item) => ({
      id: `SLG-${item.slaughterDetails!.id}`,
      inspectionCertNo: "Not recorded", farmerName: item.farmerName || "Unknown farmer",
      meatInspector: item.reviewedByName || "Not recorded",
      barangay: item.barangayName || "Unknown barangay",
      cattleId: item.slaughterDetails!.animals.map((animal) => animal.tag_number || String(animal.id)).join(", "),
      specie: item.livestockTypeName || "Unspecified",
      carcassWeightKg: Number(item.quantity), purpose: "Not recorded",
      anteMortemStatus: "Not recorded", postMortemStatus: "Not recorded",
      destinationMarket: "Not recorded", date: item.recordDate,
      status: item.status,
    }));
  }, [rawProduction]);

  // ── Connected Recent Municipal Activity Stream (Real-Time Multi-Domain) ──
  const recentActivityFeed: ActivityFeedItem[] = useMemo(() => {
    const liveActivities: (ActivityFeedItem & { rawTimestamp: number })[] = [];

    // 1. Live Animal Inventory Registrations
    if (rawInventory && rawInventory.length > 0) {
      rawInventory.forEach((inv) => {
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

        const matchingRecord = livestockList.find(
          (l) => l.id === `LIV-${inv.id}` || l.cattleId === inv.tagNumber
        );

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
            batchCode: inv.batchCode || (inv as any).batch_code,
            batchName: inv.batchName || (inv as any).batch_name,
            housingPen: (inv as any).housingPen || (inv as any).housing_pen,
            feedType: (inv as any).feedType || (inv as any).feed_type,
          },
        });
      });
    }

    // 2. Live Production Declarations
    if (rawProduction && rawProduction.length > 0) {
      rawProduction.forEach((prod) => {
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

        const matchingRecord = productionList.find(
          (p) => p.id === `PRD-${prod.id}`
        );

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
          record: matchingRecord || {
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
    }

    // 3. Live Quarterly Census Batches
    if (rawCensus && rawCensus.length > 0) {
      rawCensus.forEach((cen) => {
        const rawDate = cen.submissionDate ? new Date(cen.submissionDate).getTime() : 0;
        const matchingRecord = censusList.find(
          (c) => c.id === `CEN-${cen.id}`
        );

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
            status: (cen.status === "APPROVED" ? "MAO Verified" : "Pending Audit") as any,
          },
        });
      });
    }

    // 4. Live Incidents: Disease, Mortality, Sales, Calvings
    if (rawIncidents && rawIncidents.length > 0) {
      rawIncidents.forEach((inc) => {
        const dateStr = inc.createdAt || inc.date;
        const rawDate = dateStr ? new Date(dateStr).getTime() : 0;

        if (inc.type === "disease") {
          const matchingRecord = diseaseList.find(
            (d) => d.id === `DIS-${inc.id}` || d.id === String(inc.id)
          );
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
            badgeVariant:
              inc.status === "APPROVED"
                ? "rose"
                : (inc.status as string) === "SUBJECT_TO_REVISION" || (inc.status as string) === "SUBJECT_FOR_REVISION"
                ? "rose"
                : "rose",
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
          const matchingRecord = mortalityList.find(
            (m) => m.id === `MOR-${inc.id}` || m.id === String(inc.id)
          );
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
          const matchingRecord = salesList.find(
            (s) => s.id === `SAL-${inc.id}` || s.id === String(inc.id)
          );
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
          const matchingRecord = livestockList.find(
            (l) => l.cattleId === inc.tagNumber || l.id === `LIV-${inc.id}`
          );
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
            // A calving event is not an inventory record until reconciliation creates one.
            record: matchingRecord,
          });
        }
      });
    }

    // 5. Live Herds
    if (rawBatches && rawBatches.length > 0) {
      rawBatches.forEach((batch) => {
        const rawDate = batch.created_at ? new Date(batch.created_at).getTime() : 0;
        const matchingRecord = batchList.find(
          (b) => b.id === `BAT-${batch.id}` || b.rawId === batch.id || b.batchCode === batch.batch_code
        );
        liveActivities.push({
          id: `act-bat-${batch.id}`,
          domain: "batches",
          title: `Batch Registered: ${batch.batch_code || batch.batch_name}`,
          description: `${batch.batch_name} (${batch.total_animals || 0} heads ${batch.livestock_type_name || "livestock"}) in ${batch.housing_pen || "pen"}.`,
          actor: batch.farmer_name || "Farmer",
          barangay: batch.barangay_name || "Padre Garcia",
          timestamp: formatRelativeTime(batch.created_at),
          rawTimestamp: rawDate,
          badge:
            batch.review_status === "APPROVED"
              ? "MAO Certified"
              : batch.review_status === "SUBJECT_TO_REVISION" || batch.review_status === "SUBJECT_FOR_REVISION"
              ? "Subject for Revision"
              : "Pending Review",
          badgeVariant:
            batch.review_status === "APPROVED"
              ? "emerald"
              : batch.review_status === "SUBJECT_TO_REVISION" || batch.review_status === "SUBJECT_FOR_REVISION"
              ? "rose"
              : "sky",
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
            status: batch.review_status || batch.status || "PENDING",
            createdAt: batch.created_at?.slice(0, 10) || "",
            animals: batch.animals || [],
          },
        });
      });
    }

    // 6. Slaughterhouse & Movement Clearances (Real records)
    if (slaughterList.length > 0) {
      slaughterList.forEach((slg) => {
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
    }

    if (liveActivities.length === 0) {
      return [];
    }

    // Sort chronologically descending (newest first)
    liveActivities.sort((a, b) => b.rawTimestamp - a.rawTimestamp);

    // If filtering by barangay in toolbar
    if (filterBarangay !== "all") {
      const filtered = liveActivities.filter(
        (a) => a.barangay.toLowerCase() === filterBarangay.toLowerCase()
      );
      return filtered.slice(0, 30);
    }

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
      sales: salesList.length,
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
      diseaseList,
      mortalityList,
      slaughterList,
      censusList,
    ]
  );

  // Overall KPI aggregates (Synced directly with canonical backend analytics population)
  const totalLivestockPopulation = summary?.population.total_heads ?? 0;
  const totalMilkVolume = barangayMasterSummaries.reduce((sum, row) => sum + row.monthlyMilkLiters, 0);
  const totalAuctionValue = summary?.approved_sales_value ?? null;
  const activeIncidentsCount = barangayMasterSummaries.reduce((sum, row) => sum + row.activeIncidents, 0);
  const totalFarmersCount = summary?.population.registered_farmers ?? 0;

  // Filtered dataset for active tab
  const filteredData = useMemo(() => {
    let raw: any[] = [];
    switch (activeTab) {
      case "livestock":
        raw = livestockList;
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
        return barangayMasterSummaries;
    }

    return raw.filter((item) => {
      // Search query
      const matchesSearch =
        searchQuery === "" ||
        Object.values(item).some((val) =>
          typeof val === "string" || typeof val === "number"
            ? String(val).toLowerCase().includes(searchQuery.toLowerCase())
            : false
        );

      // Barangay filter
      const matchesBarangay =
        filterBarangay === "all" ||
        item.barangay === filterBarangay ||
        item.barangayName === filterBarangay;

      // Specie filter
      const matchesSpecie =
        filterSpecie === "all" ||
        !item.specie ||
        item.specie.toLowerCase().includes(filterSpecie.toLowerCase());

      // Status filter
      const matchesStatus =
        filterStatus === "all" ||
        item.status === filterStatus ||
        item.status?.toUpperCase() === filterStatus.toUpperCase() ||
        item.reviewStatus === filterStatus ||
        item.review_status === filterStatus ||
        item.healthStatus === filterStatus;

      return matchesSearch && matchesBarangay && matchesSpecie && matchesStatus;
    });
  }, [
    activeTab,
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
  const handleSelectRecord = (record: any, domain: DataTab) => {
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
        "Monthly Milk (L)",
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
        b.monthlyMilkLiters,
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
    const headers = Object.keys(firstItem).filter((k) => typeof firstItem[k] !== "object");
    const rows = filteredData.map((item) =>
      headers
        .map((h) => {
          const val = String(item[h] ?? "").replace(/"/g, '""');
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

  if (summaryQuery.isError || isInventoryError || isProductionError || isCensusError || isIncidentError || isBatchError) {
    return <div className="p-6" role="alert">Data Overview could not load complete data. Refresh to try again.</div>;
  }

  if (isInitialLoading) {
    return (
      <>
        <PageHeader
          title="Municipal System Data Overview"
          subtitle="Consolidated livestock master registry, dairy yields, market trades & biosecurity intelligence — Padre Garcia MAO"
          variant="admin"
          maxWidthClass="w-full"
          icon={<Database className="size-5 text-slate-800" />}
        />
        <div className="p-3 sm:p-4 md:p-5 w-full">
          <ValidationLoadingScreen
            title="Synchronizing Municipal System Data Overview"
            subtitle="Aggregating live animal registries, herds, dairy production, biosecurity alerts, and barangay census..."
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
                id: "production",
                label: "Production & Dairy",
                sublabel: "Milk yield logs & collection hubs",
                icon: <Milk className="size-4 shrink-0 text-sky-700" />,
                loaded: rawProduction !== undefined,
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
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Municipal System Data Overview"
        subtitle="Consolidated livestock master registry, dairy yields, market trades & biosecurity intelligence — Padre Garcia MAO"
        variant="admin"
        maxWidthClass="w-full"
        icon={<Database className="size-5 text-slate-800" />}
      />

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5">
        {/* Executive KPI Intelligence Strip */}
        <DataOverviewKpis
          totalLivestock={totalLivestockPopulation}
          totalBatches={barangayMasterSummaries.reduce((sum, row) => sum + (row.batchCount ?? 0), 0)}
          totalMilkVolume={totalMilkVolume}
          totalAuctionValue={totalAuctionValue}
          activeIncidents={activeIncidentsCount}
          totalFarmers={totalFarmersCount}
          totalSlaughterKg={slaughterList.reduce((sum, s) => sum + (s.carcassWeightKg || 0), 0)}
          isLoading={isDataLoading}
        />

        <p className="text-xs text-slate-500">KPIs show municipal totals. Filters apply to the records and barangay matrix below. Inventory records include historical exits; current heads include only approved, active animals.</p>

        {/* Toolbar & Filter Suite */}
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

        {/* Main Content Area */}
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
        ) : viewMode === "table" ? (
          <DataOverviewTable
            activeTab={activeTab}
            items={filteredData}
            onSelectRecord={handleSelectRecord}
            onResetFilters={handleResetFilters}
          />
        ) : (
          <DataOverviewCards
            activeTab={activeTab}
            items={filteredData}
            onSelectRecord={handleSelectRecord}
          />
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
