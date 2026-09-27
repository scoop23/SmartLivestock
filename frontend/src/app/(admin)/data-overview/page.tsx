"use client";

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
import { Layers, Boxes, Milk, FileSpreadsheet, Activity } from "lucide-react";

// Backend TanStack hooks & API client for live database connectivity
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import {
  useAdminInventoryRecords,
  useAdminProductionRecords,
  useAdminCensusSubmissions,
  useAdminIncidentRecords,
} from "../data-validation/validation-analytics";
import { useGetBarangays } from "@/app/(sibat)/sibat/sibat-analytics";
import { INITIAL_INSPECTIONS } from "@/app/(auction)/auction-inspections/auction-analytics";

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

  // Backend Data Queries
  const { data: dbBarangays } = useGetBarangays();
  const { data: rawInventory, isLoading: isInvLoading } = useAdminInventoryRecords();
  const { data: rawProduction, isLoading: isProdLoading } = useAdminProductionRecords();
  const { data: rawCensus, isLoading: isCenLoading } = useAdminCensusSubmissions();
  const { data: rawIncidents, isLoading: isIncLoading } = useAdminIncidentRecords();
  const { data: rawBatches, isLoading: isBatchLoading } = useQuery<any[]>({
    queryKey: ["admin-batches-overview"],
    queryFn: async () => {
      const res = await api.get("livestock/batches/?all=true");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 30 * 1000,
  });

  const isDataLoading = isInvLoading || isProdLoading || isCenLoading || isIncLoading || isBatchLoading;

  const isInitialLoading =
    (isInvLoading && !rawInventory) ||
    (isBatchLoading && !rawBatches) ||
    (isProdLoading && !rawProduction) ||
    (isCenLoading && !rawCensus) ||
    (isIncLoading && !rawIncidents);

  // Combine backend records with seed datasets
  const livestockList: LivestockRecord[] = useMemo(() => {
    if (!rawInventory || rawInventory.length === 0) return SEED_LIVESTOCK;
    return rawInventory.map((item) => {
      // Find matching cohort batch from rawBatches or item fields
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
        barangay: item.barangayName || "Banaba",
        cattleId: item.tagNumber || `TAG-${item.id}`,
        specie: item.livestockType || "Cattle",
        breed: item.breed || "Standard",
        sex: item.sex || "Female",
        ageMonths: 24,
        weightKg: item.weight || null,
        entryType: item.entryType || (batchCode ? "BATCH" : "INDIVIDUAL"),
        quantity: Number(item.quantity) || 1,
        lastVaccinationDate: item.lastVaccinationDate || null,
        status: item.status || "PENDING",
        registrationDate: item.createdAt?.slice(0, 10) || "2026-04-20",
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
    if (!rawBatches || rawBatches.length === 0) return SEED_BATCHES;
    return rawBatches.map((item) => ({
      id: `BAT-${item.id}`,
      rawId: item.id,
      batchCode: item.batch_code || `BAT-${item.id}`,
      batchName: item.batch_name || `Batch #${item.id}`,
      farmerName: item.farmer_name || "Registered Farmer",
      barangay: item.barangay_name || "Banaba",
      specie: item.livestock_type_name || "Cattle",
      housingPen: item.housing_pen || "General Pen",
      feedType: item.feed_type || "Commercial Concentrates",
      targetWeight: item.target_weight || null,
      targetHarvestDate: item.target_harvest_date || null,
      totalAnimals: item.total_animals || (item.animals ? item.animals.length : 0),
      averageWeight: item.average_weight || null,
      status: item.review_status || item.status || "PENDING",
      reviewRemarks: item.review_remarks,
      reviewedByName: item.reviewed_by_name,
      reviewedAt: item.reviewed_at,
      notes: item.notes,
      createdAt: item.created_at?.slice(0, 10) || "2026-04-20",
      animals: item.animals || [],
    }));
  }, [rawBatches]);

  const productionList: ProductionRecord[] = useMemo(() => {
    if (!rawProduction || rawProduction.length === 0) return SEED_PRODUCTION;
    return rawProduction.map((item) => ({
      id: `PRD-${item.id}`,
      farmerName: item.farmerName || "Registered Farmer",
      barangay: item.barangayName || "Banaba",
      cattleId: `TAG-LIV-${item.livestockId}`,
      type: (item.productionType?.toLowerCase() === "milk"
        ? "Cow Milk"
        : item.productionType?.toLowerCase() === "eggs"
        ? "Eggs"
        : "Wool") as any,
      quantity: `${item.quantity} ${item.unit || "L"}`,
      quantityNumber: Number(item.quantity) || 0,
      unit: item.unit || "LITERS",
      qualityGrade: "Grade A" as const,
      collectionCenter: `${item.barangayName || "Padre Garcia"} Dairy Hub`,
      estValuePhp: Math.round((Number(item.quantity) || 0) * 60),
      date: item.recordDate || "2026-04-20",
      status: (item.status === "APPROVED" ? "Certified" : "Pending Review") as any,
    }));
  }, [rawProduction]);

  const censusList: CensusRecord[] = useMemo(() => {
    if (!rawCensus || rawCensus.length === 0) return SEED_CENSUS;
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
        barangay: item.barangay || "Banaba",
        quarter: `Q${item.reportQuarter || 1}`,
        year: item.reportYear || 2026,
        totalHeads: totalCalculated,
        cattleCount,
        carabaoCount,
        swineCount,
        goatCount,
        enumerator: item.submittedBy || "SIBAT Enumerator",
        verifiedByMAO: item.status === "APPROVED",
        submissionDate: item.submissionDate?.slice(0, 10) || "2026-04-05",
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
    if (!liveCases || liveCases.length === 0) return SEED_DISEASE;
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
      status: (item.status === "APPROVED" ? "Quarantined" : item.status === "VERIFIED" ? "Under Treatment" : "Under Investigation") as any,
      veterinarian: item.reviewedBy || "Municipal Veterinary Office",
      quarantineZone: item.status === "APPROVED",
      dateReported: item.date || "2026-04-20",
      lastUpdated: item.createdAt?.slice(0, 10) || item.date || "2026-04-20",
    }));
  }, [rawIncidents]);

  const mortalityList: MortalityRecord[] = useMemo(() => {
    const liveMortalities = rawIncidents?.filter((i) => i.type === "mortality");
    if (!liveMortalities || liveMortalities.length === 0) return SEED_MORTALITY;
    return liveMortalities.map((item) => ({
      id: item.id,
      farmerName: item.farmerName || "Registered Farmer",
      barangay: item.barangayName || "Padre Garcia",
      cattleId: item.tagNumber || `TAG-${item.id}`,
      specie: item.livestockType || "Cattle",
      breed: item.livestockBreed || "Standard Breed",
      cause: item.conditionName || "Unspecified Cause",
      dateOfDeath: item.date || "2026-04-20",
      necropsyPerformed: Boolean(item.reviewedBy),
      necropsyFindings: item.reviewRemarks || undefined,
      disposalMethod: "Burial with Lime",
      insuranceClaimStatus: (item.status === "APPROVED" ? "Approved" : "In Review") as any,
      verifiedBy: item.reviewedBy || "MAO Biosecurity Officer",
    }));
  }, [rawIncidents]);

  const salesList: SalesRecord[] = useMemo(() => {
    const liveSales = rawIncidents?.filter((i) => i.type === "sale");
    if (!liveSales || liveSales.length === 0) return SEED_SALES;
    return liveSales.map((item) => ({
      id: item.id,
      farmerName: item.farmerName || "Registered Farmer",
      buyer: "Padre Garcia Livestock Trading Center",
      barangay: item.barangayName || "Padre Garcia",
      product: `${item.livestockType || "Livestock"} Trade`,
      specie: item.livestockType || "Cattle",
      cattleId: item.tagNumber || `TAG-${item.id}`,
      quantity: `${item.headCount || 1} Head`,
      amount: item.details.includes("₱") ? item.details.split("Total: ")[1] || "₱45,000" : "₱45,000",
      amountNumber: 45000,
      paymentMethod: "Cash",
      transportPermitNumber: `TP-2026-${item.id.replace(/\D/g, "") || "001"}`,
      date: item.date || "2026-04-20",
      status: (item.status === "APPROVED" ? "Completed" : "Pending Clearance") as any,
    }));
  }, [rawIncidents]);

  const slaughterList = SEED_SLAUGHTER;

  // ── Connected Recent Municipal Activity Stream (Real-Time Multi-Domain) ──
  const recentActivityFeed: ActivityFeedItem[] = useMemo(() => {
    const liveActivities: (ActivityFeedItem & { rawTimestamp: number })[] = [];

    // 1. Live Animal Inventory Registrations
    if (rawInventory && rawInventory.length > 0) {
      rawInventory.forEach((inv) => {
        const rawDate = inv.createdAt ? new Date(inv.createdAt).getTime() : 0;
        const statusBadge =
          inv.status === "APPROVED"
            ? "MAO Certified"
            : inv.status === "SUBJECT_TO_REVISION"
            ? "Subject to Revision"
            : inv.status === "VERIFIED"
            ? "SIBAT Verified"
            : "Pending Review";
        const badgeVariant =
          inv.status === "APPROVED"
            ? "emerald"
            : inv.status === "SUBJECT_TO_REVISION"
            ? "amber"
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
            registrationDate: inv.createdAt?.slice(0, 10) || "2026-04-20",
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
        const badgeVariant =
          prod.status === "APPROVED"
            ? "emerald"
            : prod.status === "SUBJECT_TO_REVISION"
            ? "amber"
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
            qualityGrade: "Grade A",
            collectionCenter: `${prod.barangayName || "Padre Garcia"} Dairy Hub`,
            estValuePhp: Math.round((Number(prod.quantity) || 0) * 60),
            date: prod.recordDate || prod.createdAt?.slice(0, 10) || "2026-04-20",
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
              : cen.status === "SUBJECT_TO_REVISION"
              ? "Subject to Revision"
              : "Pending Audit",
          badgeVariant:
            cen.status === "APPROVED"
              ? "emerald"
              : cen.status === "SUBJECT_TO_REVISION"
              ? "amber"
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
            submissionDate: cen.submissionDate?.slice(0, 10) || "2026-04-05",
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
                ? "Quarantine Enforced"
                : inc.status === "SUBJECT_TO_REVISION"
                ? "Subject to Revision"
                : "Observation Active",
            badgeVariant:
              inc.status === "APPROVED"
                ? "rose"
                : inc.status === "SUBJECT_TO_REVISION"
                ? "amber"
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
              status: inc.status === "APPROVED" ? "Quarantined" : "Under Treatment",
              veterinarian: inc.reviewedBy || "Municipal Veterinarian",
              quarantineZone: true,
              dateReported: dateStr?.slice(0, 10) || "2026-04-20",
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
              dateOfDeath: dateStr?.slice(0, 10) || "2026-04-20",
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
              date: dateStr?.slice(0, 10) || "2026-04-20",
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
            record: matchingRecord || {
              id: `LIV-${inc.id}`,
              cattleId: inc.tagNumber || `CALF-${inc.id}`,
              farmerName: inc.farmerName || "Farmer",
              barangay: inc.barangayName || "Padre Garcia",
              specie: inc.livestockType || "Cattle",
              breed: inc.livestockBreed || "Crossbred",
              sex: "Female",
              ageMonths: 1,
              weightKg: 28,
              status: "APPROVED",
              registrationDate: dateStr?.slice(0, 10) || "2026-04-20",
              notes: inc.details,
            },
          });
        }
      });
    }

    // 5. Live Batches & Cohorts
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
              : batch.review_status === "SUBJECT_TO_REVISION"
              ? "Subject to Revision"
              : "Pending Review",
          badgeVariant:
            batch.review_status === "APPROVED"
              ? "emerald"
              : batch.review_status === "SUBJECT_TO_REVISION"
              ? "amber"
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
            feedType: batch.feed_type || "Commercial Concentrates",
            totalAnimals: batch.total_animals || 0,
            status: batch.review_status || batch.status || "PENDING",
            createdAt: batch.created_at?.slice(0, 10) || "2026-04-20",
            animals: batch.animals || [],
          },
        });
      });
    }

    // 6. Slaughterhouse & Movement Clearances
    INITIAL_INSPECTIONS.forEach((insp) => {
      const rawDate = insp.inspection_date ? new Date(insp.inspection_date).getTime() : 0;
      const brgy = insp.shipper_address?.includes("Manggas")
        ? "Manggas"
        : insp.shipper_address?.includes("Pansol")
        ? "Pansol"
        : "Padre Garcia";

      const matchingRecord = slaughterList.find(
        (s) => s.id === `SLA-${insp.id}` || s.inspectionCertNo === insp.control_number
      );

      liveActivities.push({
        id: `act-insp-${insp.id}`,
        domain: "slaughter",
        title: `Slaughter Clearance: ${insp.control_number}`,
        description: `${insp.items?.map((i) => `${i.quantity} ${i.livestock_type}`).join(", ") || "Inspection"} cleared for ${insp.destination}.`,
        actor: insp.shipper_name || "Meat Inspector",
        barangay: brgy,
        timestamp: formatRelativeTime(insp.inspection_date),
        rawTimestamp: rawDate,
        badge:
          insp.status === "APPROVED"
            ? "Passed"
            : insp.status === "SUBJECT_TO_REVISION"
            ? "Subject to Revision"
            : "Inspected",
        badgeVariant:
          insp.status === "APPROVED"
            ? "emerald"
            : insp.status === "SUBJECT_TO_REVISION"
            ? "amber"
            : "sky",
        record: matchingRecord || {
          id: `SLG-${insp.id}`,
          inspectionCertNo: insp.control_number,
          farmerName: insp.shipper_name || "Meat Inspector",
          meatInspector: "Insp. Rolando Bautista (NAMI)",
          barangay: brgy,
          cattleId: insp.control_number,
          specie: insp.items?.[0]?.livestock_type || "Cattle",
          carcassWeightKg: 280,
          purpose: "Commercial Wholesale",
          anteMortemStatus: "Passed",
          postMortemStatus: "Fit for Human Consumption",
          destinationMarket: insp.destination || "Commercial Market",
          date: insp.inspection_date || "2026-04-18",
          status: insp.status === "APPROVED" ? "Certified" : "Inspection Passed",
        },
      });
    });

    if (liveActivities.length === 0) {
      return SEED_ACTIVITY_FEED;
    }

    // Sort chronologically descending (newest first)
    liveActivities.sort((a, b) => b.rawTimestamp - a.rawTimestamp);

    // If filtering by barangay in toolbar
    if (filterBarangay !== "all") {
      const filtered = liveActivities.filter(
        (a) => a.barangay.toLowerCase() === filterBarangay.toLowerCase()
      );
      if (filtered.length > 0) return filtered.slice(0, 30);
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
  const barangayMasterSummaries: BarangaySummary[] = useMemo(() => {
    // Official 17 Barangays of Padre Garcia
    const officialBarangays =
      dbBarangays && dbBarangays.length > 0
        ? dbBarangays.map((b) => b.barangayName)
        : PADRE_GARCIA_BARANGAYS.filter((b) => b !== "All Barangays");

    const uniqueBarangays = Array.from(new Set(officialBarangays));

    return uniqueBarangays.map((brgyName) => {
      // Find matching items (filtering for APPROVED / Certified records for official tallies)
      const brgyInventories = livestockList.filter(
        (l) =>
          l.barangay?.toLowerCase() === brgyName.toLowerCase() &&
          (!l.status || l.status.toUpperCase() === "APPROVED")
      );
      const brgyCensus = censusList.filter(
        (c) =>
          c.barangay?.toLowerCase() === brgyName.toLowerCase() &&
          (c.status === "MAO Verified" || c.verifiedByMAO || c.status?.toUpperCase() === "APPROVED")
      );
      const brgyProduction = productionList.filter(
        (p) =>
          p.barangay?.toLowerCase() === brgyName.toLowerCase() &&
          (p.status === "Certified" || p.status?.toUpperCase() === "APPROVED")
      );
      const brgyDiseases = diseaseList.filter(
        (d) => d.barangay?.toLowerCase() === brgyName.toLowerCase()
      );
      const brgySlaughter = slaughterList.filter(
        (s) => s.barangay?.toLowerCase() === brgyName.toLowerCase()
      );
      const brgyBatches = batchList.filter(
        (b) => b.barangay?.toLowerCase() === brgyName.toLowerCase()
      );
      const batchCount = brgyBatches.length;

      // Species count from Inventory
      const invCattle = brgyInventories
        .filter(
          (i) =>
            i.specie?.toLowerCase().includes("cattle") ||
            i.specie?.toLowerCase().includes("baka")
        )
        .reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

      const invCarabao = brgyInventories
        .filter(
          (i) =>
            i.specie?.toLowerCase().includes("carabao") ||
            i.specie?.toLowerCase().includes("kalabaw")
        )
        .reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

      const invSwine = brgyInventories
        .filter(
          (i) =>
            i.specie?.toLowerCase().includes("swine") ||
            i.specie?.toLowerCase().includes("baboy") ||
            i.specie?.toLowerCase().includes("pig")
        )
        .reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

      const invGoat = brgyInventories
        .filter(
          (i) =>
            i.specie?.toLowerCase().includes("goat") ||
            i.specie?.toLowerCase().includes("kambing") ||
            i.specie?.toLowerCase().includes("sheep")
        )
        .reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

      // Census additions
      const cenCattle = brgyCensus.reduce((sum, c) => sum + (c.cattleCount || 0), 0);
      const cenCarabao = brgyCensus.reduce((sum, c) => sum + (c.carabaoCount || 0), 0);
      const cenSwine = brgyCensus.reduce((sum, c) => sum + (c.swineCount || 0), 0);
      const cenGoat = brgyCensus.reduce((sum, c) => sum + (c.goatCount || 0), 0);

      // Totals
      const cattleCount = invCattle + cenCattle;
      const carabaoCount = invCarabao + cenCarabao;
      const swineCount = invSwine + cenSwine;
      const goatCount = invGoat + cenGoat;
      const totalLivestock =
        cattleCount + carabaoCount + swineCount + goatCount ||
        brgyInventories.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

      const monthlyMilkLiters = brgyProduction.reduce(
        (sum, p) => sum + (p.quantityNumber || 0),
        0
      );
      const monthlyMeatKg = brgySlaughter.reduce(
        (sum, s) => sum + (s.carcassWeightKg || 0),
        0
      );
      const activeIncidents = brgyDiseases.filter(
        (d) => d.status === "Quarantined" || d.status === "Under Treatment"
      ).length;

      const registeredFarmers = new Set([
        ...brgyInventories.map((i) => i.farmerName),
        ...brgyProduction.map((p) => p.farmerName),
      ]).size;

      return {
        barangay: brgyName,
        totalLivestock,
        cattleCount,
        carabaoCount,
        swineCount,
        goatCount,
        batchCount,
        monthlyMilkLiters,
        monthlyMeatKg,
        activeIncidents,
        registeredFarmers: Math.max(registeredFarmers, brgyInventories.length),
        riskLevel: (activeIncidents > 0 ? "MEDIUM" : "LOW") as "LOW" | "MEDIUM" | "HIGH",
      };
    }).sort((a, b) => b.totalLivestock - a.totalLivestock);
  }, [
    dbBarangays,
    livestockList,
    batchList,
    censusList,
    productionList,
    diseaseList,
    slaughterList,
  ]);

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

  // Overall KPI aggregates
  const totalLivestockPopulation = useMemo(
    () => barangayMasterSummaries.reduce((sum, b) => sum + b.totalLivestock, 0) || 314,
    [barangayMasterSummaries]
  );
  const totalMilkVolume = useMemo(
    () => barangayMasterSummaries.reduce((sum, b) => sum + b.monthlyMilkLiters, 0) || 186400,
    [barangayMasterSummaries]
  );
  const totalAuctionValue = useMemo(
    () => salesList.reduce((sum, s) => sum + s.amountNumber, 0) + 1485000,
    [salesList]
  );
  const activeIncidentsCount = useMemo(
    () =>
      diseaseList.filter(
        (d) => d.status === "Quarantined" || d.status === "Under Treatment"
      ).length,
    [diseaseList]
  );
  const totalFarmersCount = useMemo(
    () => {
      const distinct = new Set(livestockList.map((i) => i.farmerName)).size;
      return distinct > 0 ? distinct : 100;
    },
    [livestockList]
  );

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
        return BARANGAY_MASTER_SUMMARIES;
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
        "Goat Count",
        "Monthly Milk (L)",
        "Monthly Meat (kg)",
        "Active Alerts",
        "Registered Raisers",
      ];
      const rows = barangayMasterSummaries.map((b) => [
        b.barangay,
        b.totalLivestock,
        b.cattleCount,
        b.carabaoCount,
        b.swineCount,
        b.goatCount,
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
        "Batch Name",
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

  if (isInitialLoading) {
    return (
      <>
        <PageHeader
          title="Municipal System Data Overview"
          subtitle="Consolidated livestock master registry, dairy yields, market trades & biosecurity intelligence — Padre Garcia MAO"
          variant="admin"
          maxWidthClass="w-full"
        />
        <div className="p-3 sm:p-4 md:p-5 w-full">
          <ValidationLoadingScreen
            title="Synchronizing Municipal System Data Overview"
            subtitle="Aggregating live animal registries, cohort batches, dairy production, biosecurity alerts, and barangay census..."
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
                label: "Cohorts & Batches",
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
      />

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5">
        {/* Executive KPI Intelligence Strip */}
        <DataOverviewKpis
          totalLivestock={totalLivestockPopulation}
          totalBatches={batchList.length}
          totalMilkVolume={totalMilkVolume}
          totalAuctionValue={totalAuctionValue}
          activeIncidents={activeIncidentsCount}
          totalFarmers={totalFarmersCount}
          isLoading={isDataLoading}
        />

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
            totalBatches={batchList.length}
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
