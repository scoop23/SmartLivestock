"use client";

import { CensusSubmissionRecord } from "@/app/(sibat)/sibat/sibat-analytics";
import { ProductionRecordItem } from "@/app/(farmer)/production-dashboard/production-analytics";
import {
  ValidationDomain,
  ValidationInventoryItem,
  ValidationIncidentItem,
} from "../validation-analytics";
import { DetailRecordData } from "../record-detail-dialog";
import { ReviewTargetItem } from "../validation-review-dialog";
import { CensusTable } from "./census-table";
import { ProductionTable } from "./production-table";
import { InventoryTable } from "./inventory-table";
import { IncidentsTable } from "./incidents-table";

interface ActiveDomainTableProps {
  activeDomain: ValidationDomain;
  census: CensusSubmissionRecord[];
  production: ProductionRecordItem[];
  inventory: ValidationInventoryItem[];
  incidents: ValidationIncidentItem[];
  selectedIds: (string | number)[];
  onToggleSelect: (id: string | number) => void;
  onSelectAll: (checked: boolean) => void;
  onViewDetail: (data: DetailRecordData) => void;
  onReview: (target: ReviewTargetItem) => void;
  onReviewHealth: (record: ValidationIncidentItem) => void;
}

export function ActiveDomainTable({
  activeDomain,
  census,
  production,
  inventory,
  incidents,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewDetail,
  onReview,
  onReviewHealth,
}: ActiveDomainTableProps) {
  if (activeDomain === "census") {
    return (
      <CensusTable
        records={census}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onSelectAll={onSelectAll}
        onViewDetail={onViewDetail}
        onReview={onReview}
      />
    );
  }

  if (activeDomain === "production") {
    return (
      <ProductionTable
        records={production}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onSelectAll={onSelectAll}
        onViewDetail={onViewDetail}
        onReview={onReview}
      />
    );
  }

  if (activeDomain === "inventory") {
    return (
      <InventoryTable
        records={inventory}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onSelectAll={onSelectAll}
        onViewDetail={onViewDetail}
        onReview={onReview}
      />
    );
  }

  return (
    <IncidentsTable
      records={incidents}
      selectedIds={selectedIds}
      onToggleSelect={onToggleSelect}
      onSelectAll={onSelectAll}
      onViewDetail={onViewDetail}
      onReview={onReview}
      onReviewHealth={onReviewHealth}
    />
  );
}