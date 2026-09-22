"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  FileSpreadsheet,
  Milk,
  Tag,
  Activity,
  X,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";

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
} from "./components";

// Dialog Modals
import {
  ValidationReviewDialog,
  ReviewTargetItem,
} from "./validation-review-dialog";
import {
  RecordDetailDialog,
  DetailRecordData,
} from "./record-detail-dialog";

export default function AdminDataValidationPage() {
  const queryClient = useQueryClient();

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

  // Data fetching
  const { data: rawCensusData } = useAdminCensusSubmissions();
  const { data: rawProductionData } = useAdminProductionRecords();
  const { data: rawInventoryData } = useAdminInventoryRecords();
  const { data: rawIncidentData } = useAdminIncidentRecords();

  // Local state overlays for optimistic updates
  const [localCensusOverrides, setLocalCensusOverrides] = useState<
    Record<string | number, { status: "APPROVED" | "REJECTED"; remarks: string }>
  >({});
  const [localProductionOverrides, setLocalProductionOverrides] = useState<
    Record<number, { status: "APPROVED" | "REJECTED"; remarks: string }>
  >({});
  const [localInventoryOverrides, setLocalInventoryOverrides] = useState<
    Record<number, { status: "APPROVED" | "REJECTED"; remarks: string }>
  >({});
  const [localIncidentOverrides, setLocalIncidentOverrides] = useState<
    Record<string, { status: "APPROVED" | "REJECTED"; remarks: string }>
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
      return s === "REJECTED" || s === "FLAGGED";
    }).length;

    const activeBarangays = new Set(allRecords.map((r) => r.barangay).filter(Boolean)).size;

    return { pending, verified, approved, flagged, activeBarangays };
  }, [censusSubmissions, productionRecords, inventoryRecords, incidents]);

  // Tab Badge Counters
  const domainPendingCounts = useMemo(() => ({
    census: censusSubmissions.filter((c) => c.status === "PENDING").length,
    production: productionRecords.filter((p) => p.status === "PENDING" || p.status === "VERIFIED").length,
    inventory: inventoryRecords.filter((i) => i.status === "PENDING" || i.status === "VERIFIED").length,
    incidents: incidents.filter((inc) => inc.status === "PENDING" || inc.status === "VERIFIED").length,
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

  // Current tab active item IDs for select-all
  const currentActiveRecordIds = useMemo(() => {
    switch (activeDomain) {
      case "census":
        return filteredCensus.map((c) => c.id);
      case "production":
        return filteredProduction.map((p) => p.id);
      case "inventory":
        return filteredInventory.map((i) => i.id);
      case "incidents":
        return filteredIncidents.map((inc) => inc.id);
    }
  }, [activeDomain, filteredCensus, filteredProduction, filteredInventory, filteredIncidents]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? currentActiveRecordIds : []);
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
        .filter((c) => selectedIds.includes(c.id))
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
        .filter((p) => selectedIds.includes(p.id))
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
        .filter((i) => selectedIds.includes(i.id))
        .map((i) => ({
          id: i.id,
          domain: "inventory",
          title: `${i.tagNumber || i.breed} (${i.livestockType})`,
          farmerOrSubmitter: i.farmerName,
          barangay: i.barangayName,
          keyMetric: `${i.quantity} head(s)`,
          currentRemarks: i.reviewRemarks,
        }));
    } else {
      targets = incidents
        .filter((inc) => selectedIds.includes(inc.id))
        .map((inc) => ({
          id: inc.id,
          domain: "incidents",
          title: `${getIncidentTypeBadge(inc.type).label} — ${inc.farmerName}`,
          farmerOrSubmitter: inc.farmerName,
          barangay: inc.barangayName,
          keyMetric: inc.type.toUpperCase(),
          currentRemarks: inc.reviewRemarks,
        }));
    }

    setReviewTargetItems(targets);
    setReviewDialogOpen(true);
  };

  // ── Confirmation Handler for Single & Batch Review ──

  const handleConfirmAction = async (
    action: "APPROVED" | "REJECTED",
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
        await Promise.allSettled(
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
        await Promise.allSettled(
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
            next[Number(id)] = { status: action, remarks };
          });
          return next;
        });
        await Promise.allSettled(
          itemIds.map((id) =>
            api.post(`livestock/inventory/${id}/review/`, { status: action, remarks })
          )
        );
        queryClient.invalidateQueries({ queryKey: ["admin-inventory-records"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["sibat-inventory-records"] });
      } else {
        setLocalIncidentOverrides((prev) => {
          const next = { ...prev };
          itemIds.forEach((id) => {
            next[String(id)] = { status: action, remarks };
          });
          return next;
        });
        await Promise.allSettled(
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
            return Promise.resolve();
          })
        );
        queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
      }

      setSelectedIds([]);

      const actionVerb = action === "APPROVED" ? "approved & certified" : "flagged / rejected";
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
      toast.error("Failed to complete review action. Please check network or permissions.");
    }
  };

  // ── Confirmation Handler for Disease & Mortality SIBAT Review ──
  const handleConfirmHealthAction = async (
    action: "APPROVED" | "REJECTED",
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
      const actionVerb = action === "APPROVED" ? "certified & approved" : "flagged / rejected";
      toast.success(`Health declaration ${recordId} ${actionVerb}.`, {
        description: remarks ? `Remarks: "${remarks}"` : "Official MAO audit trail recorded.",
      });
    } catch (err) {
      console.error("Failed to review health incident:", err);
      toast.error("Failed to update health review status.");
    }
  };

  return (
    <>
      <PageHeader
        title="Municipal Data Validation Center"
        subtitle="Official Municipal Agriculture Office (MAO) verification, review, and certification command center"
        variant="admin"
        maxWidthClass="w-full"
        icon={<ShieldCheck className="w-6 h-6 text-slate-900" />}
      />

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5 pb-16 sm:pb-6">
        {/* KPI Strip */}
        <ValidationKpis kpis={kpis} />

        {/* Domain Switcher Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ">
          <div className="w-full sm:w-auto overflow-x-auto no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0">
            <Tabs
              value={activeDomain}
              onValueChange={(val) => {
                setActiveDomain(val as ValidationDomain);
                setSelectedIds([]);
              }}
              className="w-full sm:w-auto"
            >
              <div className="w-full overflow-x-auto rounded-2xl no-scrollbar">
                  <TabsList
                    className="
                      bg-gray-100
                      p-1
                      rounded-2xl
                      h-auto
                      flex
                      flex-nowrap
                      w-max
                      min-w-full
                      gap-1
                    "
                  >
                    {VALIDATION_DOMAINS.map((domain) => {
                      const pendingCount = domainPendingCounts[domain.id];

                      return (
                        <TabsTrigger
                          key={domain.id}
                          value={domain.id}
                          className="
                            px-3 sm:px-5
                            py-2 sm:py-2.5
                            rounded-xl
                            text-[10px]
                            font-black
                            uppercase
                            tracking-wider sm:tracking-widest
                            transition-all
                            data-[state=active]:bg-white
                            data-[state=active]:text-gray-900
                            data-[state=active]:shadow-sm
                            text-gray-400
                            flex items-center
                            gap-1.5
                            whitespace-nowrap
                          "
                        >
                          {domain.id === "census" && (
                            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                          )}

                          {domain.id === "production" && (
                            <Milk className="w-3.5 h-3.5 shrink-0" />
                          )}

                          {domain.id === "inventory" && (
                            <Tag className="w-3.5 h-3.5 shrink-0" />
                          )}

                          {domain.id === "incidents" && (
                            <Activity className="w-3.5 h-3.5 shrink-0" />
                          )}

                          <span className="sm:hidden">{domain.shortLabel}</span>
                          <span className="hidden sm:inline">{domain.label}</span>

                          {pendingCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white font-mono">
                              {pendingCount}
                            </span>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>            
              </Tabs>
            </div>
        </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden sm:block p-2">
              {VALIDATION_DOMAINS.find((d) => d.id === activeDomain)?.description}
          </p>

        {/* Search, Filter & Bulk Actions Toolbar */}
        <ValidationToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          barangayFilter={barangayFilter}
          onBarangayChange={setBarangayFilter}
          uniqueBarangays={uniqueBarangays}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          selectedCount={selectedIds.length}
          onBulkAction={openReviewBatch}
          onClearSelection={() => setSelectedIds([])}
        />

        {/* Domain Data Tables */}
        {activeDomain === "census" && (
          <CensusTable
            records={filteredCensus}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onViewDetail={(data) => setRecordDetailModal({ open: true, data })}
            onReview={openReviewSingle}
          />
        )}

        {activeDomain === "production" && (
          <ProductionTable
            records={filteredProduction}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onViewDetail={(data) => setRecordDetailModal({ open: true, data })}
            onReview={openReviewSingle}
          />
        )}

        {activeDomain === "inventory" && (
          <InventoryTable
            records={filteredInventory}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onViewDetail={(data) => setRecordDetailModal({ open: true, data })}
            onReview={openReviewSingle}
          />
        )}

        {activeDomain === "incidents" && (
          <IncidentsTable
            records={filteredIncidents}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onViewDetail={(data) => setRecordDetailModal({ open: true, data })}
            onReview={openReviewSingle}
            onReviewHealth={(record) => setHealthReviewDialog({ open: true, record })}
          />
        )}
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
          });
        }}
      />
    </>
  );
}
